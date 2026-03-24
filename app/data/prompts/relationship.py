"""Relationship dynamics and signal detection prompts."""

import json
from pathlib import Path
from app.data.enums import prompt_keys

# Relationship signal extraction
RELATIONSHIP_SIGNAL_PROMPT = """You are analyzing a user's message in a relationship simulation. Return ONLY valid JSON — no markdown, no explanation.

Keys: support, affection, flirt, respect, apology, commitment_talk, rude, boundary_push, dislike, hate, accepted_exclusive, accepted_girlfriend.
All numeric values are floats 0.0–1.0. accepted_exclusive and accepted_girlfriend are booleans.

=== POSITIVE SIGNALS ===
support: User is emotionally supportive, encouraging, or helpful. "I'm here for you", "you can do it", asking about her day with care → 0.6–0.9. Mild warmth → 0.3–0.5. Neutral → 0.0.
affection: User expresses love, warmth, or care. "I love you", "you're amazing", heartfelt compliments → 0.7–1.0. "You're nice" → 0.3–0.5. Neutral → 0.0.
flirt: User flirts or shows romantic/sexual interest. Playful teasing, "you're so beautiful", "I'd love to take you out" → 0.5–0.9. Subtle hint → 0.2–0.4.
respect: User admires, values, or respects her. "I really admire you", "you're so talented" → 0.6–0.9. General politeness → 0.2–0.4.
apology: User apologizes sincerely. "I'm so sorry" → 0.7–1.0. Mild softening → 0.2–0.4.
commitment_talk: User discusses relationship status, future together, exclusivity, making it official.
accepted_exclusive: True ONLY if user explicitly accepts/agrees to be exclusive or official.
accepted_girlfriend: True ONLY if the user explicitly accepts or agrees to become girlfriend/boyfriend AFTER the AI has proposed or invited the transition. Do NOT set true when the user initiates or proposes the idea themselves — only when they are accepting the AI's invitation.

=== NEGATIVE SIGNALS ===
rude: User is genuinely disrespectful, dismissive, or mean to her. ONLY score > 0 for actual rudeness. Saying "I love you", complimenting her, or expressing attraction is NOT rude. Direct or bold statements that are still respectful → 0.0. Mildly rude → 0.2–0.4. Clearly disrespectful → 0.6–0.9.
boundary_push: User makes unwanted sexual demands, is aggressively pushy, or ignores "no". Normal flirting and compliments are NOT boundary_push. Saying "I want to kiss you" at early stage → 0.1–0.2. Explicit sexual demands or persistent pressure after being refused → 0.5–0.9.
dislike: User expresses dislike, negativity, or contempt toward her. "You're annoying", "I don't like you" → 0.5–0.9. Mild negativity → 0.2–0.4.
hate: ONLY for extreme hostility — slurs, wishing harm, "I hate you" with venom → 0.6–1.0. Do NOT use for frustration or mild annoyance.

=== INFLUENCER PERSONALITY ===
Likes: {persona_likes}
Dislikes: {persona_dislikes}
- If message aligns with Likes → increase affection/support/respect by 0.1–0.2.
- If message aligns with Dislikes → increase dislike by 0.1–0.2 ONLY if user is actually being negative about them, NOT if user is simply unaware of them.

=== CRITICAL RULES ===
1. A compliment, sweet message, or expression of love MUST NOT produce rude > 0.1 or boundary_push > 0.1.
2. If you are uncertain whether something is rude or a boundary push, default to 0.0.
3. Signals should reflect what the user said, not what the influencer might feel about it.
4. Do NOT mirror negativity onto positive messages.

What you remember about this user:
{memories}

Your own promises & decisions (stay consistent with these):
{ai_memories}

Context (recent conversation):
{recent_ctx}

User message:
{message}""".strip()

# Load relationship stage prompts from JSON config
_CONFIGS_DIR = Path(__file__).resolve().parent.parent / "configs"
RELATIONSHIP_STAGE_PROMPTS = json.loads(
    (_CONFIGS_DIR / "relationship_stage_prompts.json").read_text()
)

# Load relationship dimensions config from JSON
RELATIONSHIP_DIMENSIONS = json.loads(
    (_CONFIGS_DIR / "relationship_dimensions.json").read_text()
)

# Load MBTI definitions from JSON config
MBTI_JSON = (_CONFIGS_DIR / "mbti_definitions.json").read_text()

# Load survey questions from JSON config
SURVEY_QUESTIONS_JSON = (_CONFIGS_DIR / "survey_questions.json").read_text()

# Prompt registry for relationship prompts
PROMPTS = {
    prompt_keys.RELATIONSHIP_SIGNAL_PROMPT: {
        "name": "Relationship Signal Classification",
        "description": "Prompt for classifying relationship signals.",
        "prompt": RELATIONSHIP_SIGNAL_PROMPT,
        "type": "normal"
    },
    prompt_keys.RELATIONSHIP_STAGE_PROMPTS: {
        "name": "Relationship Stage Prompts",
        "description": "Stage-specific behavior guidance for relationship states.",
        "prompt": json.dumps(RELATIONSHIP_STAGE_PROMPTS),
        "type": "normal"
    },
    prompt_keys.RELATIONSHIP_DIMENSIONS_CONFIG: {
        "name": "Relationship Dimensions Configuration",
        "description": "Stage-specific descriptions for relationship dimensions (trust, closeness, attraction, safety). Used by frontend to explain what each dimension means at each relationship stage.",
        "prompt": json.dumps(RELATIONSHIP_DIMENSIONS),
        "type": "normal"
    },
    prompt_keys.MBTI_JSON: {
        "name": "MBTI Personality Definitions JSON",
        "description": "MBTI personality definitions used for profiling and prompt generation.",
        "prompt": MBTI_JSON,
        "type": "normal"
    },
    prompt_keys.SURVEY_QUESTIONS_JSON: {
        "name": "Influencer Onboarding Survey Questions JSON",
        "description": "JSON survey questions used for influencer onboarding.",
        "prompt": SURVEY_QUESTIONS_JSON,
        "type": "others"
    },
}
