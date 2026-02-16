import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.db.models import Influencer
from app.relationship.repo import get_or_create_relationship
from app.relationship.inactivity import apply_inactivity_decay, check_and_trigger_reengagement
from app.relationship.signals import classify_signals
from app.relationship.engine import Signals, update_relationship
from app.relationship.dtr import plan_dtr_goal

log = logging.getLogger("teachme-relationship")


STAGES = ["HATE", "DISLIKE", "STRANGERS", "FRIENDS", "FLIRTING", "DATING", "GIRLFRIEND"]


def stage_from_signals_and_points(stage_points: float, sig) -> str:
  """
  Determine relationship stage PURELY from accumulated stage_points.
  
  Thresholds:
  - HATE: -40 to -26 (toxic/abusive relationship)
  - DISLIKE: -25 to -1 (negative relationship)
  - STRANGERS: 0-24 (neutral, building connection)
  - FRIENDS: 25-49 (friendly relationship)
  - FLIRTING: 50-74 (romantic interest)
  - DATING: 75-89 (committed relationship)
  - GIRLFRIEND: 90-100 (ultimate level)
  
  Note: Signals affect the DELTA (how points change), not the stage directly.
  Stage is determined by the cumulative points total.
  """
  p = float(stage_points or 0.0)
  
  # Pure points-based progression
  if p < -25.0:
      return "HATE"
  if p < 0.0:
      return "DISLIKE"
  if p < 25.0:
      return "STRANGERS"
  if p < 50.0:
      return "FRIENDS"
  if p < 75.0:
      return "FLIRTING"
  if p < 90.0:
      return "DATING"
  return "GIRLFRIEND"


def adjust_dimensions_for_stage_change(trust: float, closeness: float, attraction: float, safety: float, old_stage: str, new_stage: str):
  """
  When stage changes, ensure dimensions make sense for that stage.
  Prevents unrealistic combinations like "FLIRTING with 20 attraction"
  
  When leveling UP: Boost dimensions to stage minimums
  When leveling DOWN: Apply small penalty (relationship damaged)
  """
  # Define minimum requirements for each stage
  MINIMUMS = {
      "HATE": (0, 0, 0, 0),
      "DISLIKE": (0, 0, 0, 0),
      "STRANGERS": (0, 0, 0, 0),
      "FRIENDS": (25, 25, 0, 30),      # Need trust, closeness, safety
      "FLIRTING": (40, 40, 50, 45),    # Need attraction!
      "DATING": (65, 65, 65, 65),      # Need all dimensions high
      "GIRLFRIEND": (80, 80, 75, 80)   # Need very high trust/closeness/safety
  }
  
  old_idx = STAGES.index(old_stage) if old_stage in STAGES else 0
  new_idx = STAGES.index(new_stage) if new_stage in STAGES else 0
  
  if new_idx > old_idx:  # Leveling UP
      # Ensure minimums are met for new stage
      min_t, min_c, min_a, min_s = MINIMUMS.get(new_stage, (0, 0, 0, 0))
      trust = max(trust, min_t)
      closeness = max(closeness, min_c)
      attraction = max(attraction, min_a)
      safety = max(safety, min_s)
      
  elif new_idx < old_idx:  # Leveling DOWN (relationship damaged)
      # Apply small penalty to reflect relationship regression
      trust = max(0, trust - 5)
      closeness = max(0, closeness - 5)
      attraction = max(0, attraction - 5)
      safety = max(0, safety - 5)
  
  return trust, closeness, attraction, safety


def compute_stage_delta(sig) -> float:
  """
  Calculate stage points delta with balanced, gradual progression.
  Reduced multipliers for more stable, realistic relationship changes.
  """
  # POSITIVE signals - reduced for slower, more earned progression
  delta = (
      1.0 * sig.support +      # Was 2.0
      0.8 * sig.affection +    # Was 1.6
      0.8 * sig.respect +      # Was 1.6
      0.7 * sig.flirt          # Was 1.4
  )

  # NEGATIVE signals - reduced for less catastrophic drops
  delta -= 2.0 * sig.boundary_push           # Was 5.0
  delta -= 1.5 * sig.rude                    # Was 3.5
  delta -= 1.5 * getattr(sig, "dislike", 0.0)   # Was 4.0
  delta -= 3.0 * getattr(sig, "hate", 0.0)      # Was 8.0
  delta -= 4.0 * getattr(sig, "threat", 0.0)    # Was 10.0
  delta -= 1.5 * getattr(sig, "rejecting", 0.0) # Was 4.0
  delta -= 1.0 * getattr(sig, "insult", 0.0)    # Was 2.0

  # No free baseline points - users must earn progression
  baseline = 0.0
  delta += baseline

  # Tighter caps for more gradual progression
  # Max gain: +1.5 per message, Max loss: -3.0 per message
  return max(-3.0, min(1.5, delta))


async def process_relationship_turn(
    *,
    db,
    user_id: int,
    influencer_id: str,
    message: str,
    recent_ctx: str,
    cid: str,
    convo_analyzer,
    influencer: Any | None = None,
) -> Dict[str, Any]:
    """
    Shared relationship update pipeline used by chat turns and webhooks.
    Returns the updated RelationshipState plus derived metadata.
    """
    now = datetime.now(timezone.utc)
    log.info("[REL %s] START user_id=%s influencer_id=%s", cid, user_id, influencer_id)

    rel = await get_or_create_relationship(db, int(user_id), influencer_id)

    days_idle = apply_inactivity_decay(rel, now)

    if days_idle >= 3:
        await check_and_trigger_reengagement(
            db=db,
            user_id=int(user_id),
            influencer_id=influencer_id,
            days_idle=days_idle,
        )

    if influencer is None:
        influencer = await db.get(Influencer, influencer_id)
    if influencer is None:
        raise ValueError(f"Influencer not found: {influencer_id}")

    bio = influencer.bio_json or {}

    persona_likes: List[str] = bio.get("likes", []) or []
    persona_dislikes: List[str] = bio.get("dislikes", []) or []

    if not isinstance(persona_likes, list):
        persona_likes = []
    if not isinstance(persona_dislikes, list):
        persona_dislikes = []

    sig_dict = await classify_signals(
        db, message, recent_ctx, persona_likes, persona_dislikes, convo_analyzer
    )
    log.info("[%s] SIG_DICT=%s", cid, sig_dict)
    sig = Signals(**sig_dict)

    # Calculate sentiment as 0-100% progress within current stage
    # This will be calculated AFTER stage_points is updated, so we'll do it later

    # For girlfriends, reduce negative signal impact by 60% (they're more forgiving)
    if rel.girlfriend_confirmed:
        dampened_sig = Signals(
            support=sig.support,
            affection=sig.affection,
            flirt=sig.flirt,
            respect=sig.respect,
            rude=sig.rude * 0.4,  # Reduce negative signals
            boundary_push=sig.boundary_push * 0.4,
            dislike=getattr(sig, 'dislike', 0.0) * 0.4,
            hate=getattr(sig, 'hate', 0.0) * 0.4,
            apology=sig.apology,
            commitment_talk=sig.commitment_talk,
            accepted_exclusive=sig.accepted_exclusive,
            accepted_girlfriend=sig.accepted_girlfriend,
        )
        out = update_relationship(rel.trust, rel.closeness, rel.attraction, rel.safety, rel.state, dampened_sig)
    else:
        out = update_relationship(rel.trust, rel.closeness, rel.attraction, rel.safety, rel.state, sig)

    log.info(
        "[%s] DIM before->after | t %.4f->%.4f c %.4f->%.4f a %.4f->%.4f s %.4f->%.4f",
        cid,
        rel.trust, out.trust,
        rel.closeness, out.closeness,
        rel.attraction, out.attraction,
        rel.safety, out.safety,
    )

    rel.trust = out.trust
    rel.closeness = out.closeness
    rel.attraction = out.attraction
    rel.safety = out.safety

    prev_sp = float(rel.stage_points or 0.0)
    delta = compute_stage_delta(sig)
    rel.stage_points = max(-40.0, min(100.0, prev_sp + delta))  # Allow negative points down to -40

    # Store previous state to detect changes
    prev_state = rel.state
    
    # CHECK girlfriend_confirmed FIRST to preserve relationship status
    if rel.girlfriend_confirmed:
        # Once girlfriend, maintain at least GIRLFRIEND level unless serious negative interaction
        if sig.hate > 0.6 or getattr(sig, "threat", 0.0) > 0.20:
            rel.state = "HATE"
            rel.girlfriend_confirmed = False  # Reset on severe negativity
            rel.exclusive_agreed = False
        elif sig.dislike > 0.4 or getattr(sig, "rejecting", 0.0) > 0.40:
            rel.state = "DISLIKE"
            rel.girlfriend_confirmed = False
            rel.exclusive_agreed = False
        else:
            rel.state = "GIRLFRIEND"  # Keep as girlfriend
    else:
        # Normal state calculation for non-girlfriends
        rel.state = stage_from_signals_and_points(rel.stage_points, sig)
    
    # Adjust dimensions when stage changes to ensure realistic values
    if prev_state != rel.state:
        rel.trust, rel.closeness, rel.attraction, rel.safety = adjust_dimensions_for_stage_change(
            rel.trust, rel.closeness, rel.attraction, rel.safety,
            prev_state, rel.state
        )
        log.info("[%s] Stage changed %s → %s, dimensions adjusted", cid, prev_state, rel.state)

    # Calculate sentiment as 0-100% progress within current stage
    STAGE_RANGES = {
        "HATE": (-40.0, -25.0),
        "DISLIKE": (-25.0, 0.0),
        "STRANGERS": (0.0, 25.0),
        "FRIENDS": (25.0, 50.0),
        "FLIRTING": (50.0, 75.0),
        "DATING": (75.0, 90.0),
        "GIRLFRIEND": (90.0, 100.0),
    }
    
    stage_points_value = float(rel.stage_points or 0.0)
    current_stage = rel.state
    
    if current_stage in STAGE_RANGES:
        stage_min, stage_max = STAGE_RANGES[current_stage]
        stage_range = stage_max - stage_min
        
        if stage_range > 0:
            # Calculate percentage: 0 = just entered stage, 100 = about to level up
            progress_in_stage = (stage_points_value - stage_min) / stage_range
            sentiment_score = progress_in_stage * 100.0
            
            # Clamp to 0-100
            sentiment_score = max(0.0, min(100.0, sentiment_score))
        else:
            sentiment_score = 0.0
    else:
        sentiment_score = 0.0
    
    # Store sentiment
    prev_sentiment = float(rel.sentiment_score or 0.0)
    rel.sentiment_score = sentiment_score
    rel.sentiment_delta = sentiment_score - prev_sentiment

    can_ask = (
        rel.state == "DATING"
        and rel.safety >= 70
        and rel.trust >= 75
        and rel.closeness >= 70
        and rel.attraction >= 65
    )

    if rel.state in ("HATE", "DISLIKE"):
        can_ask = False

    if sig.accepted_exclusive and rel.state in ("DATING", "GIRLFRIEND"):
        rel.exclusive_agreed = True

    if sig.accepted_girlfriend and can_ask:
        rel.girlfriend_confirmed = True
        rel.exclusive_agreed = True
        rel.state = "GIRLFRIEND"

    dtr_goal = plan_dtr_goal(rel, can_ask)

    log.info(
        "[%s] STAGE prev=%.2f delta=%.2f new=%.2f state=%s can_ask=%s",
        cid, prev_sp, delta, rel.stage_points, rel.state, can_ask
    )

    rel.last_interaction_at = now
    rel.updated_at = now

    log.info(
        "[REL %s] BEFORE COMMIT id=%s user=%s infl=%s trust=%.4f close=%.4f attr=%.4f safe=%.4f sp=%.2f state=%s sent=%.2f",
        cid,
        getattr(rel, "id", None),
        rel.user_id,
        rel.influencer_id,
        rel.trust, rel.closeness, rel.attraction, rel.safety,
        float(rel.stage_points or 0.0),
        rel.state,
        float(rel.sentiment_score or 0.0),
    )

    db.add(rel)
    await db.commit()
    await db.refresh(rel)

    log.info(
        "[REL %s] AFTER COMMIT updated_at=%s trust=%.4f sp=%.2f state=%s",
        cid,
        rel.updated_at,
        rel.trust,
        float(rel.stage_points or 0.0),
        rel.state,
    )

    return {
        "rel": rel,
        "sig": sig,
        "persona_likes": persona_likes,
        "persona_dislikes": persona_dislikes,
        "days_idle": days_idle,
        "dtr_goal": dtr_goal,
        "can_ask": can_ask,
        "timestamp": now,
    }
