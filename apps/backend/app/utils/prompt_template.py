from __future__ import annotations

from string import Formatter


def extract_template_variables(template: str) -> set[str]:
    try:
        parsed = Formatter().parse(template)
    except ValueError as exc:
        raise ValueError(f"Invalid prompt template: {exc}") from exc

    return {field_name for _, field_name, _, _ in parsed if field_name}


def validate_required_template_variables(
    template: str,
    required: set[str] | frozenset[str],
) -> None:
    variables = extract_template_variables(template)
    missing = sorted(set(required) - variables)
    if missing:
        raise ValueError(
            "Prompt template is missing required placeholders "
            f"{missing}"
        )


def render_template(
    template: str,
    values: dict[str, str],
    required: set[str] | frozenset[str] | None = None,
) -> str:
    required_variables = set(required or set())
    if required_variables:
        validate_required_template_variables(template, required_variables)

        missing_values = sorted(
            key
            for key in required_variables
            if key not in values or not values[key] or not values[key].strip()
        )
        if missing_values:
            raise ValueError(
                "Prompt values are missing or empty for placeholders "
                f"{missing_values}"
            )

    try:
        return template.format_map(values)
    except KeyError as exc:
        raise ValueError(
            f"Missing prompt value for placeholder '{exc.args[0]}'"
        ) from exc
    except ValueError as exc:
        raise ValueError(f"Invalid prompt template: {exc}") from exc
