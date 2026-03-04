"""ASCII Vigenère cipher for obfuscating sensitive values.

Uses the printable ASCII range (32–126, 95 characters) so hashes
containing symbols like $, /, digits, and letters survive the round-trip.

Usage:
    from app.utils.crypto import vigenere_cipher

    ciphered = vigenere_cipher(password_hash, key)           # encrypt
    original = vigenere_cipher(ciphered, key, decrypt=True)  # decrypt
"""


def vigenere_cipher(text: str, key: str, *, decrypt: bool = False) -> str:
    """Encrypt or decrypt *text* using an ASCII Vigenère cipher.

    Parameters
    ----------
    text : str
        The plaintext (or ciphertext) to process.
    key : str
        The secret keyword used for shifting.
    decrypt : bool
        If ``True``, reverse the cipher (decrypt).

    Returns
    -------
    str
        The ciphered (or deciphered) string.
    """
    if not key:
        raise ValueError("Cipher key must not be empty")

    result: list[str] = []
    for i, char in enumerate(text):
        key_char = key[i % len(key)]
        shift = ord(key_char) - 32  # offset into printable range

        if decrypt:
            new_char = chr((ord(char) - 32 - shift) % 95 + 32)
        else:
            new_char = chr((ord(char) - 32 + shift) % 95 + 32)

        result.append(new_char)

    return "".join(result)
