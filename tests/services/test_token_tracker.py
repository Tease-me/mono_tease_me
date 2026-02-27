from app.services import token_tracker


def test_canonicalize_openai_snapshot_model():
    got = token_tracker._canonicalize_model_for_pricing(
        "gpt-4o-mini-2024-07-18",
        "openai",
    )
    assert got == "gpt-4o-mini"


def test_estimate_cost_openai_snapshot_uses_canonical_pricing():
    cost = token_tracker._estimate_cost(
        model="gpt-4o-mini-2024-07-18",
        provider="openai",
        input_tokens=None,
        output_tokens=1000,
        duration_secs=None,
        purpose="main_reply",
    )
    assert cost == 600


def test_estimate_cost_openai_snapshot_gpt4o_input_and_output():
    cost = token_tracker._estimate_cost(
        model="gpt-4o-2024-08-06",
        provider="openai",
        input_tokens=1000,
        output_tokens=1000,
        duration_secs=None,
        purpose="analysis",
    )
    assert cost == 12500


def test_estimate_cost_canonical_model_unchanged():
    cost = token_tracker._estimate_cost(
        model="gpt-4.1-mini",
        provider="openai",
        input_tokens=1000,
        output_tokens=1000,
        duration_secs=None,
        purpose="analysis",
    )
    assert cost == 750


def test_estimate_cost_unknown_model_returns_none():
    cost = token_tracker._estimate_cost(
        model="foo-model-x",
        provider="openai",
        input_tokens=1000,
        output_tokens=1000,
        duration_secs=None,
        purpose="analysis",
    )
    assert cost is None


def test_canonicalize_non_openai_model_is_not_date_trimmed():
    got = token_tracker._canonicalize_model_for_pricing(
        "grok-4-1-fast-reasoning-2024-07-18",
        "xai",
    )
    assert got == "grok-4-1-fast-reasoning-2024-07-18"


def test_snapshot_override_output_takes_precedence():
    snapshot = "gpt-4o-mini-2024-07-18"
    original = token_tracker._OPENAI_SNAPSHOT_OVERRIDES_OUTPUT.get(snapshot)
    token_tracker._OPENAI_SNAPSHOT_OVERRIDES_OUTPUT[snapshot] = 777
    try:
        cost = token_tracker._estimate_cost(
            model=snapshot,
            provider="openai",
            input_tokens=None,
            output_tokens=1000,
            duration_secs=None,
            purpose="main_reply",
        )
        assert cost == 777
    finally:
        if original is None:
            token_tracker._OPENAI_SNAPSHOT_OVERRIDES_OUTPUT.pop(snapshot, None)
        else:
            token_tracker._OPENAI_SNAPSHOT_OVERRIDES_OUTPUT[snapshot] = original
