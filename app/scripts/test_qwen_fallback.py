import asyncio
import logging
import os

# Set invalid keys BEFORE importing any app modules that initialize clients
os.environ["OPENAI_API_KEY"] = "sk-invalid-key-for-testing"
os.environ["XAI_API_KEY"] = "sk-invalid-key-for-testing"

# Also set fake API keys for everything so pydantic settings validation passes
# wait, pydantic settings loads from .env which overrides environment variables?
# No, env vars usually override .env file.
# Let's see if this works. Pydantic settings will use os.environ if set.

from langchain_core.messages import HumanMessage

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

async def test_fallback():
    from app.agents.prompts import MODEL, FACT_EXTRACTOR
    from app.services.embeddings import get_embedding, get_embeddings_batch
    
    # Explicitly break the embeddings primary client if pydantic didn't
    from app.services.embeddings import client
    client.api_key = "invalid"

    log.info("--- Testing LLM generation with fallback (MODEL) ---")
    try:
        resp = await MODEL.ainvoke([HumanMessage(content="Hello, what is 2+2? Reply short.")])
        log.info(f"MODEL response: {resp.content}")
    except Exception as e:
        log.error(f"MODEL failed: {e}")

    log.info("\n--- Testing Fact Extractor generation with fallback (FACT_EXTRACTOR) ---")
    try:
        resp = await FACT_EXTRACTOR.ainvoke([HumanMessage(content="Hello, what is 3+3? Reply short.")])
        log.info(f"FACT_EXTRACTOR response: {resp.content}")
    except Exception as e:
        log.error(f"FACT_EXTRACTOR failed: {e}")

    log.info("\n--- Testing single embedding with fallback ---")
    try:
        emb = await get_embedding("test fallback embedding")
        log.info(f"Embedding generated, length: {len(emb)}")
    except Exception as e:
        log.error(f"Embedding failed: {e}")
        
    log.info("\n--- Testing batch embedding with fallback ---")
    try:
        embs = await get_embeddings_batch(["test 1", "test 2"])
        log.info(f"Batch Embeddings generated, count: {len(embs)}")
    except Exception as e:
        log.error(f"Batch Embedding failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_fallback())
