"""
Single source of truth for relationship stage definitions and ranges.

All stage-related constants are defined here to prevent drift and inconsistencies.
"""

# Stage point ranges (min, max) - used for stage determination and progress calculation
STAGE_RANGES = {
    "HATE": (-40.0, -25.0),      # 15 point range
    "DISLIKE": (-25.0, 0.0),     # 25 point range
    "STRANGERS": (0.0, 25.0),    # 25 point range
    "FRIENDS": (25.0, 50.0),     # 25 point range
    "FLIRTING": (50.0, 75.0),    # 25 point range
    "DATING": (75.0, 90.0),      # 15 point range - becoming girlfriend is earned
    "GIRLFRIEND": (90.0, 100.0), # 10 point range - relationship depth/maintenance phase
}

# Ordered list of stages (for level up/down detection)
STAGES = ["HATE", "DISLIKE", "STRANGERS", "FRIENDS", "FLIRTING", "DATING", "GIRLFRIEND"]

# Stage point boundaries
STAGE_POINTS_MIN = -40.0
STAGE_POINTS_MAX = 100.0

# Stage thresholds for stage_from_signals_and_points()
# Note: Uses "less than" comparison, so thresholds are upper bounds (exclusive)
STAGE_THRESHOLDS = {
    "HATE": -25.0,       # < -25 = HATE
    "DISLIKE": 0.0,      # < 0 = DISLIKE
    "STRANGERS": 25.0,   # < 25 = STRANGERS
    "FRIENDS": 50.0,     # < 50 = FRIENDS
    "FLIRTING": 75.0,    # < 75 = FLIRTING
    "DATING": 90.0,      # < 90 = DATING
    # >= 90 = GIRLFRIEND
}

# Dimension ranges (min, max) for each stage - used for dimension caps
DIMENSION_RANGES = {
    "HATE": {
        "trust": (5, 20),
        "closeness": (5, 20),
        "attraction": (0, 30),
        "safety": (0, 20)
    },
    "DISLIKE": {
        "trust": (10, 30),
        "closeness": (10, 30),
        "attraction": (0, 40),
        "safety": (5, 30)
    },
    "STRANGERS": {
        "trust": (10, 40),
        "closeness": (10, 40),
        "attraction": (5, 60),
        "safety": (20, 50)
    },
    "FRIENDS": {
        "trust": (25, 65),
        "closeness": (25, 65),
        "attraction": (10, 70),
        "safety": (30, 70)
    },
    "FLIRTING": {
        "trust": (40, 80),
        "closeness": (40, 80),
        "attraction": (50, 85),
        "safety": (45, 75)
    },
    "DATING": {
        "trust": (65, 95),
        "closeness": (65, 95),
        "attraction": (65, 95),
        "safety": (65, 90)
    },
    "GIRLFRIEND": {
        "trust": (80, 100),
        "closeness": (80, 100),
        "attraction": (75, 100),
        "safety": (80, 100)
    }
}

# Stage point delta calculation constants
# Controls how quickly relationships progress through stages
# Follows same pattern as K_UP_BY_STAGE/K_DOWN_BY_STAGE in engine.py

# Positive signal multipliers (signals are 0.0 to 1.0 range)
STAGE_DELTA_POSITIVE = {
    "support": 0.4,      # Emotional support, helping, being there (was 0.5)
    "affection": 0.3,    # Warmth, care, affection shown (was 0.4)
    "respect": 0.3,      # Respect, admiration, valuing them (was 0.4)
    "flirt": 0.25,       # Flirting, attraction, romantic interest (was 0.3)
}

# Negative signal multipliers (positive values, will be subtracted)
STAGE_DELTA_NEGATIVE = {
    "boundary_push": 0.8,  # Pushing boundaries, being too forward (was 1.0)
    "rude": 0.6,           # Rude, dismissive, mean behavior (was 0.75)
    "dislike": 0.6,        # Expressing dislike or negativity (was 0.75)
    "hate": 1.2,           # Hateful, extremely negative behavior (was 1.5)
}

# Baseline reward for non-negative engagement (small positive for showing up)
STAGE_DELTA_BASELINE = 0.05  # Was 0.08

# Stage-specific progression multipliers (applied after base delta calculation)
# Higher = faster progression, Lower = slower progression
# This allows different stages to have different progression speeds
STAGE_DELTA_MULTIPLIER = {
    "HATE": 1.2,        # Faster to escape HATE (nobody wants to stay here)
    "DISLIKE": 1.1,     # Slightly faster to move past dislike
    "STRANGERS": 1.0,   # Normal pace - building initial connection
    "FRIENDS": 0.85,    # Slower - deep friendship takes time
    "FLIRTING": 0.7,    # Much slower - romantic tension builds gradually
    "DATING": 0.5,      # Very slow - becoming girlfriend is earned
    "GIRLFRIEND": 0.4,  # Slowest - deepening relationship bond requires consistent effort
}

# Stage-specific max gain caps (points per message)
# Later stages are harder to progress through (more earned)
STAGE_DELTA_CAP_MAX_BY_STAGE = {
    "HATE": 0.8,        # Can gain up to 0.8 pts/msg (escape faster)
    "DISLIKE": 0.7,     # 0.7 pts/msg
    "STRANGERS": 0.6,   # 0.6 pts/msg
    "FRIENDS": 0.5,     # 0.5 pts/msg
    "FLIRTING": 0.4,    # 0.4 pts/msg (slower romantic build)
    "DATING": 0.25,     # 0.25 pts/msg (very slow, girlfriend is earned)
    "GIRLFRIEND": 0.15, # 0.15 pts/msg (slowest - deepening bond takes time)
}

# Stage-specific max loss caps (negative points per message)
# Later stages can be damaged more significantly by bad behavior
STAGE_DELTA_CAP_MIN_BY_STAGE = {
    "HATE": -0.8,       # Can't lose much (already at bottom)
    "DISLIKE": -1.0,    # Moderate loss potential
    "STRANGERS": -1.2,  # Standard loss
    "FRIENDS": -1.2,    # Friendship is resilient
    "FLIRTING": -1.5,   # Romance is more fragile
    "DATING": -2.0,     # Can damage relationship significantly
    "GIRLFRIEND": -0.8, # Girlfriends more forgiving and resilient (also dampened separately)
}

# Legacy single caps (kept for backwards compatibility, but stage-specific caps take precedence)
STAGE_DELTA_CAP_MAX = 0.5    # Default if stage not found
STAGE_DELTA_CAP_MIN = -1.2   # Default if stage not found
