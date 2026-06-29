from app.services.use_cases.adult.scene_matcher import (
    _resolve_forward_stage,
    _score_keywords,
    _score_tags,
)

GIRLFRIEND_STAGE_1_TAGS = [
    "all yours tonight",
    "hey baby",
    "missed you",
    "home alone",
    "sneaked in",
]
GIRLFRIEND_STAGE_3 = "mmm, protein, feed me, give me that protein, cum for me, muffled, yumm, mouth full"
GIRLFRIEND_STAGE_3_TAGS = [
    "mmm",
    "protein",
    "feed me",
    "give me that protein",
    "cum for me",
    "muffled",
    "yumm",
    "mouth full",
]
GIRLFRIEND_STAGE_4 = "so big, so deep, awww, harder, faster, fuck me harder, deeper, pound me"
GIRLFRIEND_STAGE_4_TAGS = [
    "so big",
    "so deep",
    "awww",
    "harder",
    "faster",
    "fuck me harder",
    "deeper",
    "pound me",
]
GIRLFRIEND_STAGE_5 = "cumming, i'm cumming, sorry baby, fill me, breaking, feels too good, cum all over"
GIRLFRIEND_STAGE_5_TAGS = [
    "cumming",
    "i'm cumming",
    "sorry baby",
    "fill me",
    "breaking",
    "feels too good",
    "cum all over",
]


def test_score_tags_matches_opening_stage_phrases() -> None:
    score = _score_tags("I am all yours tonight hey baby missed you", GIRLFRIEND_STAGE_1_TAGS)
    assert score >= 2


def test_score_tags_matches_oral_stage_phrases() -> None:
    score = _score_tags("mmm give me that protein baby cum for me", GIRLFRIEND_STAGE_3_TAGS)
    assert score >= 2


def test_score_keywords_matches_oral_stage_phrases() -> None:
    score = _score_keywords("mmm give me that protein baby cum for me", GIRLFRIEND_STAGE_3)
    assert score >= 2


def test_score_tags_matches_sex_stage_phrases() -> None:
    score = _score_tags("awww so big fuck me harder baby", GIRLFRIEND_STAGE_4_TAGS)
    assert score >= 2


def test_score_keywords_matches_sex_stage_phrases() -> None:
    score = _score_keywords("awww so big fuck me harder baby", GIRLFRIEND_STAGE_4)
    assert score >= 2


def test_score_tags_distinguishes_climax_from_sex() -> None:
    climax_score = _score_tags("oh fuck yes i'm cumming fill me", GIRLFRIEND_STAGE_5_TAGS)
    sex_score = _score_tags("oh fuck yes i'm cumming fill me", GIRLFRIEND_STAGE_4_TAGS)
    assert climax_score > sex_score


def test_score_keywords_distinguishes_climax_from_sex() -> None:
    climax_score = _score_keywords("oh fuck yes i'm cumming fill me", GIRLFRIEND_STAGE_5)
    sex_score = _score_keywords("oh fuck yes i'm cumming fill me", GIRLFRIEND_STAGE_4)
    assert climax_score > sex_score


def test_score_tags_ignores_unrelated_text() -> None:
    score = _score_tags("hello there how are you", GIRLFRIEND_STAGE_5_TAGS)
    assert score == 0


def test_score_keywords_ignores_unrelated_text() -> None:
    score = _score_keywords("hello there how are you", GIRLFRIEND_STAGE_5)
    assert score == 0


def test_resolve_forward_stage_allows_single_advance() -> None:
    assert _resolve_forward_stage(3, 2, match_score=1) == 3


def test_resolve_forward_stage_caps_jump_without_strong_match() -> None:
    assert _resolve_forward_stage(5, 2, match_score=1) == 3


def test_resolve_forward_stage_allows_big_jump_on_strong_match() -> None:
    assert _resolve_forward_stage(5, 2, match_score=3) == 5


def test_resolve_forward_stage_blocks_rewind() -> None:
    assert _resolve_forward_stage(2, 4, match_score=3) is None


def test_resolve_forward_stage_blocks_same_stage() -> None:
    assert _resolve_forward_stage(3, 3, match_score=3) is None


def test_resolve_forward_stage_allows_initial() -> None:
    assert _resolve_forward_stage(1, None) == 1
