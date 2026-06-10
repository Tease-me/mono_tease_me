from app.utils.vip_invite_code import (
    VIP_INVITE_CODE_ALPHABET,
    VIP_INVITE_CODE_LENGTH,
    generate_vip_invite_code,
    normalize_vip_invite_code,
)


def test_generate_vip_invite_code_length_and_charset() -> None:
    code = generate_vip_invite_code()
    assert len(code) == VIP_INVITE_CODE_LENGTH
    assert all(char in VIP_INVITE_CODE_ALPHABET for char in code)


def test_normalize_vip_invite_code_strips_and_uppercases() -> None:
    assert normalize_vip_invite_code(" 3dfc6r ") == "3DFC6R"
