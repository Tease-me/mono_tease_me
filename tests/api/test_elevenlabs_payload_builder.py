from app.api.elevenlabs import _build_agent_patch_payload


def test_build_agent_patch_payload_includes_required_defaults():
    payload = _build_agent_patch_payload(prompt_text="hello")
    cfg = payload["conversation_config"]
    agent_prompt = cfg["agent"]["prompt"]

    assert cfg["asr"]["provider"] == "scribe_realtime"
    assert cfg["turn"]["turn_eagerness"] == "eager"
    assert cfg["turn"]["turn_timeout"] == 5
    assert cfg["conversation"]["max_duration_seconds"] == 3600
    assert cfg["tts"]["model_id"] == "eleven_v3_conversational"
    assert cfg["agent"]["first_message"] == "{{first_message}}"
    assert agent_prompt["llm"] == "claude-sonnet-4-5"
    assert agent_prompt["cascade_timeout_seconds"] == 4
    assert agent_prompt["prompt"] == "hello"
    assert "client" not in cfg
    override_cfg = payload["platform_settings"]["overrides"]["conversation_config_override"]
    assert override_cfg["agent"]["first_message"] is True
    assert override_cfg["agent"]["prompt"]["prompt"] is True
    assert override_cfg["tts"]["voice_id"] is True


def test_build_agent_patch_payload_keeps_tools_and_optional_fields():
    payload = _build_agent_patch_payload(
        prompt_text="hello",
        temperature=0.7,
        max_tokens=256,
    )
    cfg = payload["conversation_config"]
    agent_cfg = cfg["agent"]

    assert len(agent_cfg["tools"]) == 2
    assert agent_cfg["prompt"]["temperature"] == 0.7
    assert agent_cfg["prompt"]["max_tokens"] == 256
