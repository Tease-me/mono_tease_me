import time
from typing import Any, Dict, List, Optional
from uuid import UUID
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult
from app.services.token_tracker import track_usage_bg

class UsageTrackingCallback(AsyncCallbackHandler):
    """
    LangChain AsyncCallbackHandler that intercepts LLM calls globally
    and automatically calculates the latency and extracts tokens to fire 
    track_usage_bg without manual retrieval in agent logic.
    """
    def __init__(
        self,
        category: str,
        purpose: str,
        chat_id: Optional[str] = None,
        user_id: Optional[int] = None,
        influencer_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ):
        self.category = category
        self.purpose = purpose
        self.user_id = user_id
        self.influencer_id = influencer_id
        self.chat_id = chat_id
        self.conversation_id = conversation_id
        self.start_times: Dict[UUID, float] = {}

    async def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], *, run_id: UUID, **kwargs: Any
    ) -> None:
        """Fires when the LLM starts. Records the start time for latency."""
        self.start_times[run_id] = time.perf_counter()

    async def on_llm_end(
        self, response: LLMResult, *, run_id: UUID, **kwargs: Any
    ) -> None:
        """Fires when the LLM finishes. Extracts tokens and logs usage."""
        latency_ms = int((time.perf_counter() - self.start_times.pop(run_id, time.perf_counter())) * 1000)
        
        # LangChain populates llm_output with token usage automatically
        llm_output = response.llm_output or {}
        usage = llm_output.get("token_usage", {})
        
        # If testing with mock models or incomplete payloads, default to unknown
        model_name = llm_output.get("model_name", "unknown_model")
        
        # Determine provider dynamically based on the model name
        lower_model = model_name.lower()
        if "gpt" in lower_model or "openai" in lower_model:
            provider = "openai"
        elif "grok" in lower_model or "xai" in lower_model:
            provider = "xai"
        elif "qwen" in lower_model:
            provider = "alibaba"
        else:
            provider = "unknown"

        # Safe fallback for tokens
        input_tokens = usage.get("prompt_tokens") or usage.get("input_tokens")
        output_tokens = usage.get("completion_tokens") or usage.get("output_tokens")
        total_tokens = usage.get("total_tokens")

        track_usage_bg(
            category=self.category,
            provider=provider,
            model=model_name,
            purpose=self.purpose,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            user_id=self.user_id,
            influencer_id=self.influencer_id,
            chat_id=self.chat_id,
            conversation_id=self.conversation_id,
        )
