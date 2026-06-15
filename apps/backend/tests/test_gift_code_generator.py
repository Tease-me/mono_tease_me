"""Tests for gift code utilities."""

from app.utils.gift_code_generator import (
    GIFT_CODE_LENGTH,
    generate_gift_code,
    normalize_gift_code,
)


def test_generate_gift_code_length_and_charset():
    code = generate_gift_code()
    assert len(code) == GIFT_CODE_LENGTH
    assert code.isupper()


def test_normalize_gift_code():
    assert normalize_gift_code("  m1am0r  ") == "M1AM0R"
