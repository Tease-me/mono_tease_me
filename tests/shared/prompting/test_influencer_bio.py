from app.db.models import Influencer
from app.shared.prompting.influencer_bio import extract_influencer_bio_context


def _make_influencer(bio_json):
    return Influencer(
        id="influencer-test",
        display_name="Test Influencer",
        prompt_template="template",
        bio_json=bio_json,
    )


def test_extract_influencer_bio_context_defaults_when_empty():
    ctx = extract_influencer_bio_context(_make_influencer(None))

    assert ctx.likes == []
    assert ctx.dislikes == []
    assert ctx.stages == {}
    assert ctx.personality_rules == ""
    assert ctx.tone == ""
    assert ctx.mbti_archetype == ""
    assert ctx.mbti_rules_addon == ""


def test_extract_influencer_bio_context_coerces_non_list_fields():
    ctx = extract_influencer_bio_context(
        _make_influencer(
            {
                "likes": "not-a-list",
                "dislikes": {"bad": "shape"},
            }
        )
    )

    assert ctx.likes == []
    assert ctx.dislikes == []


def test_extract_influencer_bio_context_normalizes_stages_and_scalar_fields():
    ctx = extract_influencer_bio_context(
        _make_influencer(
            {
                "likes": [" music ", "", 10, None],
                "dislikes": [" spam ", " "],
                "stages": {
                    "dating": " warm and open ",
                    "friends": "",
                    "hate": None,
                    123: "numeric key accepted",
                    "flirting": ["not a string"],
                },
                "personality_rules": " playful and curious ",
                "tone": " confident ",
                "mbti_architype": " enfp ",
                "mbti_rules": " spontaneous ",
            }
        )
    )

    assert ctx.likes == ["music"]
    assert ctx.dislikes == ["spam"]
    assert ctx.stages == {
        "DATING": "warm and open",
        "123": "numeric key accepted",
    }
    assert ctx.personality_rules == "playful and curious"
    assert ctx.tone == "confident"
    assert ctx.mbti_archetype == "enfp"
    assert ctx.mbti_rules_addon == "spontaneous"


def test_extract_influencer_bio_context_handles_malformed_bio_json_shape():
    influencer = _make_influencer({"likes": ["ok"]})
    influencer.bio_json = ["invalid", "shape"]  # type: ignore[assignment]

    ctx = extract_influencer_bio_context(influencer)
    assert ctx.likes == []
    assert ctx.dislikes == []
    assert ctx.stages == {}
