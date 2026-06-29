from app.services.gateways.xai_imagine_video_gateway import (
    SUBTLE_LOOP_VIDEO_PROMPT,
    _resolve_aspect_ratio,
    _video_prompt,
)
from app.services.use_cases.adult.gallery_generation import (
    _build_stage_pose_prompt,
    _build_video_animation_prompt,
)


def test_video_prompt_uses_auto_subtle_motion_suffix() -> None:
    result = _video_prompt("Warm affectionate expression.")
    assert "Warm affectionate expression" in result
    assert "Seamless looping video" in result
    assert "No camera movement" in result


def test_video_prompt_does_not_duplicate_suffix() -> None:
    result = _video_prompt(SUBTLE_LOOP_VIDEO_PROMPT)
    assert result.count("Seamless looping video") == 1


def test_build_video_animation_prompt_keeps_mood_only() -> None:
    result = _build_video_animation_prompt(
        "Needy eager expression. Parted lips, upward gaze, emotional intensity."
    )
    assert result.startswith("Facial mood: Needy eager expression")
    assert "head movement forward and back" not in result


def test_build_stage_pose_prompt_does_not_change_pose() -> None:
    result = _build_stage_pose_prompt(
        title="Playful teasing",
        description="Sweet, seductive, flexible roleplay.",
    )
    assert "Only adjust facial expression" in result
    assert "Do not change pose" in result
    assert "Playful teasing" in result


def test_resolve_aspect_ratio_auto_omits_field() -> None:
    assert _resolve_aspect_ratio("auto") is None
    assert _resolve_aspect_ratio("") is None


def test_resolve_aspect_ratio_explicit_value() -> None:
    assert _resolve_aspect_ratio("9:16") == "9:16"
