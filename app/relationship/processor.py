import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.db.models import Influencer
from app.relationship.repo import get_or_create_relationship
from app.relationship.inactivity import apply_inactivity_decay, check_and_trigger_reengagement
from app.relationship.signals import classify_signals
from app.relationship.engine import Signals, update_relationship
from app.relationship.dtr import plan_dtr_goal
from app.constants.relationship_stages import (
    STAGES,
    STAGE_RANGES,
    STAGE_THRESHOLDS,
    STAGE_POINTS_MIN,
    STAGE_POINTS_MAX,
    DIMENSION_RANGES,
    STAGE_DELTA_POSITIVE,
    STAGE_DELTA_NEGATIVE,
    STAGE_DELTA_BASELINE,
    STAGE_DELTA_MULTIPLIER,
    STAGE_DELTA_CAP_MAX_BY_STAGE,
    STAGE_DELTA_CAP_MIN_BY_STAGE,
    STAGE_DELTA_CAP_MAX,
    STAGE_DELTA_CAP_MIN,
)

log = logging.getLogger("teachme-relationship")


def stage_from_signals_and_points(stage_points: float) -> str:
  """
  Determine relationship stage PURELY from accumulated stage_points.
  
  Uses thresholds from relationship_stages constants to ensure consistency.
  
  Note: Stage is determined solely by the cumulative points total.
  Signals affect only the DELTA (how points change), not the stage directly.
  """
  p = float(stage_points or 0.0)
  
  # Pure points-based progression using shared thresholds
  if p < STAGE_THRESHOLDS["HATE"]:
      return "HATE"
  if p < STAGE_THRESHOLDS["DISLIKE"]:
      return "DISLIKE"
  if p < STAGE_THRESHOLDS["STRANGERS"]:
      return "STRANGERS"
  if p < STAGE_THRESHOLDS["FRIENDS"]:
      return "FRIENDS"
  if p < STAGE_THRESHOLDS["FLIRTING"]:
      return "FLIRTING"
  if p < STAGE_THRESHOLDS["DATING"]:
      return "DATING"
  return "GIRLFRIEND"


def adjust_dimensions_for_stage_change(trust: float, closeness: float, attraction: float, safety: float, old_stage: str, new_stage: str):
  """
  When stage changes, ensure dimensions make sense for that stage.
  Prevents unrealistic combinations like "FLIRTING with 20 attraction"
  
  When leveling UP: Boost dimensions to stage minimums (from DIMENSION_RANGES)
  When leveling DOWN: Apply small penalty (relationship damaged)
  
  Uses centralized DIMENSION_RANGES to avoid configuration drift.
  """
  old_idx = STAGES.index(old_stage) if old_stage in STAGES else 0
  new_idx = STAGES.index(new_stage) if new_stage in STAGES else 0
  
  if new_idx > old_idx:  # Leveling UP
      # Extract minimums from DIMENSION_RANGES for the new stage
      if new_stage in DIMENSION_RANGES:
          stage_dims = DIMENSION_RANGES[new_stage]
          min_t = stage_dims["trust"][0]
          min_c = stage_dims["closeness"][0]
          min_a = stage_dims["attraction"][0]
          min_s = stage_dims["safety"][0]
      else:
          min_t, min_c, min_a, min_s = 0, 0, 0, 0
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


def enforce_stage_dimension_caps(trust: float, closeness: float, attraction: float, safety: float, stage: str, stage_points: float):
  """
  Scale dimensions to match progress through current stage.
  
  Dimensions grow proportionally with stage_points progression:
  - At start of stage (0%): dimensions at minimum
  - At middle of stage (50%): dimensions at midpoint
  - At end of stage (100%): dimensions at maximum
  
  This keeps dimensions realistic and rewarding as you progress.
  Uses shared constants from relationship_stages to ensure consistency.
  """
  if stage not in DIMENSION_RANGES or stage not in STAGE_RANGES:
      return trust, closeness, attraction, safety
  
  # Calculate progress through current stage (0.0 to 1.0)
  stage_min, stage_max = STAGE_RANGES[stage]
  stage_range = stage_max - stage_min
  if stage_range > 0:
      progress = max(0.0, min(1.0, (stage_points - stage_min) / stage_range))
  else:
      progress = 0.0
  
  # Get dimension ranges for this stage
  dim_ranges = DIMENSION_RANGES[stage]
  trust_range = dim_ranges["trust"]
  close_range = dim_ranges["closeness"]
  attr_range = dim_ranges["attraction"]
  safety_range = dim_ranges["safety"]
  
  # Calculate target dimensions based on progress
  target_trust = trust_range[0] + (progress * (trust_range[1] - trust_range[0]))
  target_close = close_range[0] + (progress * (close_range[1] - close_range[0]))
  target_attr = attr_range[0] + (progress * (attr_range[1] - attr_range[0]))
  target_safety = safety_range[0] + (progress * (safety_range[1] - safety_range[0]))
  
  # Apply soft caps - pull dimensions toward targets but allow natural variance
  # Upper bounds: cap slightly above target to allow natural variance
  trust = min(trust, target_trust + 5)  # Allow 5 points above target
  closeness = min(closeness, target_close + 5)
  attraction = min(attraction, target_attr + 5)
  safety = min(safety, target_safety + 5)
  
  # Lower bounds: enforce stage minimums to prevent unrealistic values
  # (e.g., can't have trust=10 at FLIRTING stage where min is 40)
  trust = max(trust, trust_range[0])
  closeness = max(closeness, close_range[0])
  attraction = max(attraction, attr_range[0])
  safety = max(safety, safety_range[0])
  
  return trust, closeness, attraction, safety


def compute_stage_delta(sig: Signals, current_stage: str) -> float:
  """
  Calculate stage points delta with stage-specific multipliers and caps.
  
  Each stage has its own progression speed (multiplier) and caps:
  - HATE/DISLIKE: Faster progression (easier to escape negative stages)
  - STRANGERS: Normal pace
  - FRIENDS: Slower (friendship takes time)
  - FLIRTING: Much slower (romantic tension builds gradually)
  - DATING: Very slow (serious relationships are earned)
  - GIRLFRIEND: Slowest (deepening relationship bond requires consistent effort)
  
  Adjust STAGE_DELTA_* constants in relationship_stages.py to tune per-stage speeds.
  """
  # POSITIVE signals - using configurable multipliers
  delta = (
      STAGE_DELTA_POSITIVE["support"] * sig.support +
      STAGE_DELTA_POSITIVE["affection"] * sig.affection +
      STAGE_DELTA_POSITIVE["respect"] * sig.respect +
      STAGE_DELTA_POSITIVE["flirt"] * sig.flirt
  )

  # NEGATIVE signals - using configurable multipliers
  delta -= STAGE_DELTA_NEGATIVE["boundary_push"] * sig.boundary_push
  delta -= STAGE_DELTA_NEGATIVE["rude"] * sig.rude
  delta -= STAGE_DELTA_NEGATIVE["dislike"] * sig.dislike
  delta -= STAGE_DELTA_NEGATIVE["hate"] * sig.hate

  # Baseline reward for non-negative engagement
  # Rewards genuine engagement without giving free points for spam
  is_negative = (sig.rude > 0.15 or sig.boundary_push > 0.15 or 
                 sig.dislike > 0.15 or sig.hate > 0.1)
  
  baseline = 0.0 if is_negative else STAGE_DELTA_BASELINE
  delta += baseline

  # Apply stage-specific multiplier
  stage_multiplier = STAGE_DELTA_MULTIPLIER.get(current_stage, 1.0)
  delta *= stage_multiplier

  # Apply stage-specific caps for controlled progression
  max_cap = STAGE_DELTA_CAP_MAX_BY_STAGE.get(current_stage, STAGE_DELTA_CAP_MAX)
  min_cap = STAGE_DELTA_CAP_MIN_BY_STAGE.get(current_stage, STAGE_DELTA_CAP_MIN)
  
  return max(min_cap, min(max_cap, delta))


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
            dislike=sig.dislike * 0.4,
            hate=sig.hate * 0.4,
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
    prev_state = rel.state  # Store before any changes
    
    # Calculate stage delta using current stage for stage-specific progression speeds
    # For girlfriends, use dampened signals for consistency with dimension updates
    active_sig = dampened_sig if rel.girlfriend_confirmed else sig
    stage_points_delta = compute_stage_delta(active_sig, prev_state)
    rel.stage_points = max(STAGE_POINTS_MIN, min(STAGE_POINTS_MAX, prev_sp + stage_points_delta))
    
    # CHECK girlfriend_confirmed FIRST to preserve relationship status
    if rel.girlfriend_confirmed:
        # Once girlfriend, maintain at least GIRLFRIEND level unless serious negative interaction
        if sig.hate > 0.6:
            rel.state = "HATE"
            rel.girlfriend_confirmed = False  # Reset on severe negativity
            rel.exclusive_agreed = False
        elif sig.dislike > 0.4 or sig.rude > 0.5:
            rel.state = "DISLIKE"
            rel.girlfriend_confirmed = False
            rel.exclusive_agreed = False
        else:
            rel.state = "GIRLFRIEND"  # Keep as girlfriend
    else:
        # Normal state calculation for non-girlfriends
        rel.state = stage_from_signals_and_points(rel.stage_points)
    
    # Adjust dimensions when stage changes to ensure realistic values
    if prev_state != rel.state:
        rel.trust, rel.closeness, rel.attraction, rel.safety = adjust_dimensions_for_stage_change(
            rel.trust, rel.closeness, rel.attraction, rel.safety,
            prev_state, rel.state
        )
        log.info("[%s] Stage changed %s → %s, dimensions adjusted", cid, prev_state, rel.state)
    
    # Scale dimensions to match progress through current stage
    # Dimensions grow proportionally with stage_points (0% to 100%)
    rel.trust, rel.closeness, rel.attraction, rel.safety = enforce_stage_dimension_caps(
        rel.trust, rel.closeness, rel.attraction, rel.safety,
        rel.state, rel.stage_points
    )

    # Calculate sentiment as 0-100% progress within current stage
    # Uses shared STAGE_RANGES constant for consistency
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
    
    # Calculate sentiment_delta intelligently to handle stage transitions
    # Delta represents meaningful progress, not raw score differences across stages
    if prev_state == current_stage:
        # Same stage: delta is the simple difference
        prev_sentiment = float(rel.sentiment_score or 0.0)
        sentiment_delta = sentiment_score - prev_sentiment
    else:
        # Stage changed: delta should reflect the stage_points change as progress
        # Convert stage_points_delta to a percentage of the overall scale
        stage_points_range = STAGE_POINTS_MAX - STAGE_POINTS_MIN
        sentiment_delta = (stage_points_delta / stage_points_range) * 100.0
        # Clamp to reasonable bounds
        sentiment_delta = max(-15.0, min(15.0, sentiment_delta))
    
    rel.sentiment_score = sentiment_score
    rel.sentiment_delta = sentiment_delta

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
        cid, prev_sp, stage_points_delta, rel.stage_points, rel.state, can_ask
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
