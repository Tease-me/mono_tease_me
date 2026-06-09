from app.utils.character_name import extract_first_name


def test_extract_first_name_returns_first_token() -> None:
    assert extract_first_name("Sophie Rain") == "Sophie"
    assert extract_first_name("  Alex   Morgan  ") == "Alex"


def test_extract_first_name_returns_none_for_blank_values() -> None:
    assert extract_first_name(None) is None
    assert extract_first_name("   ") is None
