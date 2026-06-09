from __future__ import annotations

CENTS_PER_USD = 100
CREDITS_PER_USD = 60


def amount_cents_to_credits(amount_cents: int) -> int:
    if amount_cents < 0:
        raise ValueError("amount_cents must be non-negative")
    return (amount_cents * CREDITS_PER_USD) // CENTS_PER_USD


def balance_cents_to_credits(balance_cents: int) -> int:
    if balance_cents < 0:
        raise ValueError("balance_cents must be non-negative")
    return (balance_cents * CREDITS_PER_USD) // CENTS_PER_USD


def get_conversion_rate() -> dict[str, int]:
    return {
        "cents_per_usd": CENTS_PER_USD,
        "credits_per_usd": CREDITS_PER_USD,
    }
