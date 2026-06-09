import random


def pick_random_first_message(first_messages: list[str] | None) -> str | None:
    if not first_messages:
        return None
    return random.choice(first_messages)
