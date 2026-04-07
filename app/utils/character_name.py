def _extract_first_name(value: str | None) -> str | None:
    if not value:
        return None
    parts = [part for part in value.strip().split() if part]
    if not parts:
        return None
    return parts[0]


def _resolve_user_name(username: str | None) -> str:
    if username and username.strip():
        return username.strip()
    return ""


def resolve_required_user_name(*, full_name: str | None, username: str | None) -> str:
    if username and username.strip():
        return username.strip()
    if full_name and full_name.strip():
        return full_name.strip()
    raise ValueError("User name is required to render adult prompt")


def _resolve_user_title(gender: str | None) -> str:
    normalized = (gender or "").strip().lower()
    if normalized in {"male", "man", "m"}:
        return "Mr"
    if normalized in {"female", "woman", "f"}:
        return "Ms"
    return ""


def build_character_template_context(
    *,
    influencer_display_name: str | None,
    user_full_name: str | None,
    user_username: str | None,
    user_gender: str | None,
) -> dict[str, str]:
    influencer_name = (influencer_display_name or "").strip()
    user_name = _resolve_user_name(user_username)
    user_title = _resolve_user_title(user_gender)

    return {
        "influencer_name": influencer_name,
        "influencer_first_name": _extract_first_name(influencer_name)
        or influencer_name,
        "user_name": user_name,
        "user_first_name": _extract_first_name(user_full_name) or user_name,
        "user_title": user_title,
        "user_honorific": user_title,
    }


def render_character_ui_text(
    template: str | None,
    *,
    context: dict[str, str],
) -> str | None:
    if template is None:
        return None

    try:
        rendered = template.format_map(context)
    except (KeyError, ValueError):
        return template

    rendered = " ".join(rendered.split()).strip()
    return rendered or template
