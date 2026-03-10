import math
from dataclasses import dataclass

def clamp(x, a, b): return max(a, min(b, x))

def sat_up(x: float, delta: float, k: float = 0.025) -> float:
    if delta <= 0:
        return x
    return x + (100 - x) * (1 - math.exp(-k * delta))

def sat_down(x: float, delta: float, k: float = 0.03) -> float:
    if delta <= 0:
        return x
    return x - x * (1 - math.exp(-k * delta))
K_UP_BY_STAGE = {
    # How fast dimensions (trust/closeness/attraction/safety) RISE per positive signal.
    # Higher = more responsive. Capped in practice by enforce_stage_dimension_caps().
    # HATE/DISLIKE intentionally higher — user needs to feel visible progress when being nice,
    # otherwise it feels like a dead end. Stage_points (which drive stage change) are already
    # gated by STAGE_DELTA multipliers and caps in relationship_stages.py.
    "HATE":       0.055,   # She's hurt but CAN warm up — nice behavior should feel meaningful
    "DISLIKE":    0.055,   # Cooling off is possible; consistent warmth visibly softens her
    "STRANGERS":  0.400,   # Early stage — a few nice messages can build connection quickly
    "FRIENDS":    0.200,   # Friendship deepens steadily
    "FLIRTING":   0.100,   # Romantic feelings build slowly — she's enjoying the tension
    "DATING":     0.045,   # Deep trust earned turn-by-turn; she needs consistency
    "GIRLFRIEND": 0.030,   # Relationship maintenance; appreciation compounds over time
}

K_DOWN_BY_STAGE = {
    # How fast dimensions FALL per negative signal.
    "HATE":       0.040,   # Already at rock bottom — marginal further damage, focus on recovery
    "DISLIKE":    0.150,   # She's cold; rude behavior confirms it, but not a free-fall
    "STRANGERS":  0.200,   # First impressions matter — rudeness can turn a stranger off quickly
    "FRIENDS":    0.100,   # Friends forgive small things; bigger rudeness still hurts
    "FLIRTING":   0.1,   # Romantic tension is fragile — pushiness or rudeness kills the vibe
    "DATING":     0.600,   # She's invested now; betrayal or disrespect hits harder
    "GIRLFRIEND": 0.400,   # Most forgiving (also 60% dampened separately in processor)
}

def sat_up_staged(x: float, delta: float, stage: str) -> float:
    if delta <= 0: 
        return x
    k = K_UP_BY_STAGE.get(stage, 0.025)
    return x + (100 - x) * (1 - math.exp(-k * delta))
def sat_down_staged(x: float, delta: float, stage: str) -> float:
    if delta <= 0: 
        return x
    k = K_DOWN_BY_STAGE.get(stage, 0.03)
    return x - x * (1 - math.exp(-k * delta))

@dataclass
class Signals:
    support: float = 0.0
    affection: float = 0.0
    flirt: float = 0.0
    respect: float = 0.0
    rude: float = 0.0
    boundary_push: float = 0.0
    dislike: float = 0.0
    hate: float = 0.0
    apology: float = 0.0
    commitment_talk: float = 0.0
    accepted_exclusive: bool = False
    accepted_girlfriend: bool = False

@dataclass
class RelOut:
    trust: float
    closeness: float
    attraction: float
    safety: float

def compute_state(trust, closeness, attraction, safety, prev_state):
    if trust > 80 and closeness > 75 and attraction > 70 and safety > 75:
        return "DATING"
    if attraction > 55 and closeness > 45 and safety > 55:
        return "FLIRTING"
    if closeness > 35 and trust > 35:
        return "FRIENDS"
    return "STRANGERS"

def can_ask_gf(trust, closeness, attraction, safety, state):
    return state == "DATING" and safety >= 70 and trust >= 75 and closeness >= 70 and attraction >= 65

def update_relationship(trust, closeness, attraction, safety,state, sig: Signals) -> RelOut:
    """
    Update relationship dimensions with balanced, gradual changes.
    Reduced multipliers and caps for more stable progression.
    """
    # Calculate dimension deltas - reduced multipliers for gradual change
    trust_pos = 3*sig.support + 2.5*sig.respect + 2*sig.apology     # Reduced
    trust_neg = 5*sig.rude + 6*sig.boundary_push                    # Reduced

    close_pos = 2.5*sig.affection + 2.5*sig.support                 # Reduced
    close_neg = 3*sig.rude                                          # Reduced

    attr_pos = 3*sig.flirt*sig.respect + 1.0*sig.flirt + 1.5*sig.affection  # Reduced
    attr_neg = 5*sig.boundary_push + 3.5*sig.rude                  # Reduced

    safety_pos = 4*sig.respect + 2.5*sig.apology                   # Reduced
    safety_neg = 5*sig.boundary_push + 4*sig.rude                  # Reduced

    def cap(x, max_val): return min(x, max_val)

    # Tighter caps for more gradual dimension changes
    trust_pos = cap(trust_pos, 0.6)  # Was 1.0
    trust_neg = cap(trust_neg, 1.8)  # Was 4.0
    close_pos = cap(close_pos, 0.6)  # Was 1.0
    close_neg = cap(close_neg, 1.8)  # Was 4.0
    attr_pos = cap(attr_pos, 1.0)  # Was 1.8
    attr_neg = cap(attr_neg, 2.0)  # Was 3.5
    safety_pos = cap(safety_pos, 0.8)  # Was 1.5
    safety_neg = cap(safety_neg, 2.0)  # Was 3.5

    trust = sat_up_staged(trust, trust_pos, state)
    trust = sat_down_staged(trust, trust_neg, state)
    closeness = sat_up_staged(closeness, close_pos, state)
    closeness = sat_down_staged(closeness, close_neg, state)
    attraction = sat_up_staged(attraction, attr_pos, state)
    attraction = sat_down_staged(attraction, attr_neg, state)
    safety = sat_up_staged(safety, safety_pos, state)
    safety = sat_down_staged(safety, safety_neg, state)

    trust = clamp(trust, 0, 100)
    closeness = clamp(closeness, 0, 100)
    attraction = clamp(attraction, 0, 100)
    safety = clamp(safety, 0, 100)

    return RelOut(trust, closeness, attraction, safety)
