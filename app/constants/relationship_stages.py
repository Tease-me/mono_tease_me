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
    "DATING": (75.0, 90.0),      # 15 point range
    "GIRLFRIEND": (90.0, 100.0), # 10 point range
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
