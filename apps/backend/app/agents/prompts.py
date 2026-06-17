import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_xai import ChatXAI
from app.core.config import settings
from app.services.system_prompt_service import get_system_prompt
from app.data.enums import prompt_keys
from langchain_core.runnables import Runnable

log = logging.getLogger(__name__)

# --- Qwen Fallbacks ---
QWEN_FLAGSHIP = ChatOpenAI(
    api_key=settings.QWEN_API_KEY,
    base_url=settings.QWEN_BASE_URL,
    model="qwen-plus",
    temperature=0.8,
    max_tokens=512,
    store=False
) if settings.QWEN_API_KEY else None

QWEN_FAST = ChatOpenAI(
    api_key=settings.QWEN_API_KEY,
    base_url=settings.QWEN_BASE_URL,
    model="qwen-turbo",
    temperature=0.5,
    max_tokens=512,
    store=False
) if settings.QWEN_API_KEY else None

def apply_fallback(model: Runnable, fallback_model: Runnable | None) -> Runnable:
    return model.with_fallbacks([fallback_model]) if fallback_model else model

# --- Primary Models ---

MODEL_BASE = ChatOpenAI(
    api_key=settings.OPENAI_API_KEY,
    model_name="gpt-5.2",
    temperature=0.8,
    max_tokens=512,
    store=False
)
MODEL = apply_fallback(MODEL_BASE, QWEN_FLAGSHIP)

FACT_EXTRACTOR_BASE = ChatXAI(
    xai_api_key=settings.XAI_API_KEY,
    model="grok-4-1-fast-reasoning",
    temperature=0.5,
    max_tokens=512,
)
FACT_EXTRACTOR = apply_fallback(FACT_EXTRACTOR_BASE, QWEN_FAST)

CONVO_ANALYZER_BASE = ChatOpenAI(
    openai_api_key=settings.OPENAI_API_KEY,
    model="gpt-4o-mini",
    temperature=0.2,
    max_tokens=256,
    store=False
)
CONVO_ANALYZER = apply_fallback(CONVO_ANALYZER_BASE, QWEN_FAST)

XAI_MODEL_BASE = ChatXAI(
    xai_api_key=settings.XAI_API_KEY,
    model="grok-4-1-fast-reasoning",
    temperature=0.7,
    max_tokens=512,
    store=False
)
XAI_MODEL = apply_fallback(XAI_MODEL_BASE, QWEN_FAST)

SURVEY_SUMMARIZER_BASE = ChatOpenAI(
    api_key=settings.OPENAI_API_KEY,
    model="gpt-4o",
    temperature=1,
    store=False
)
SURVEY_SUMMARIZER = apply_fallback(SURVEY_SUMMARIZER_BASE, QWEN_FLAGSHIP)

DEFAULT_AGENT_MODEL = "gpt-4.1"
OPENAI_ASSISTANT_LLM_BASE = ChatOpenAI(
    api_key=settings.OPENAI_API_KEY,
    model=DEFAULT_AGENT_MODEL,
    temperature=0.7,
    max_tokens=400,
    store=False
)
OPENAI_ASSISTANT_LLM = apply_fallback(OPENAI_ASSISTANT_LLM_BASE, QWEN_FLAGSHIP)

try:
    GREETING_GENERATOR_BASE = ChatOpenAI(
        api_key=settings.OPENAI_API_KEY,
        model="gpt-4.1-mini",
        temperature=0.7,
        max_tokens=120,
        store=False
    )
    GREETING_GENERATOR: Runnable | None = apply_fallback(GREETING_GENERATOR_BASE, QWEN_FAST)
except Exception as exc:
    GREETING_GENERATOR = None
    log.warning("Contextual greeting generator disabled: %s", exc)


def get_grok_model() -> Runnable:
    model_base = ChatXAI(
        xai_api_key=settings.XAI_API_KEY,
        model="grok-4-1-fast-reasoning",
        temperature=0.0,
        max_tokens=150,
    )
    return apply_fallback(model_base, QWEN_FAST)

async def get_fact_prompt(db) -> ChatPromptTemplate:
    template_str = await get_system_prompt(db, prompt_keys.FACT_PROMPT)
    return ChatPromptTemplate.from_template(template_str)
