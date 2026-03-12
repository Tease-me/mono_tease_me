# FastAPI Guidelines for AI Agents

This document defines how to write and organize code in this project. Follow these conventions when adding or modifying code.

## Project Structure

Code is organized by layer, not by domain. New code must go in the correct layer.

```
app/
├── api/               # Routes — HTTP/WebSocket handlers only
├── services/          # Business logic + its direct dependencies
│   ├── repositories/  # DB queries
│   ├── gateways/      # External API wrappers
│   └── use_cases/     # Complex multi-step operations
├── data/              # Everything data-related
│   ├── models/        # SQLAlchemy ORM table definitions
│   └── schemas/       # Pydantic request/response shapes
├── agents/            # LLM orchestration (prompts, memory, RAG, chains)
├── core/              # Config, logging, DB session
└── utils/             # Pure stateless helpers
```

### Layer Rules

| Layer | Does | Does Not |
|---|---|---|
| `api/` | Parse request, call service, return schema | DB queries, business logic, LLM calls |
| `services/` | All business logic and decisions | Raw SQL, direct HTTP calls |
| `services/repositories/` | DB queries (SELECT/INSERT/UPDATE/DELETE) | Business decisions |
| `services/gateways/` | Wrap external API calls | Business logic |
| `services/use_cases/` | Multi-step ops reusable across routes and scheduler | — |
| `data/models/` | SQLAlchemy ORM class definitions | Pydantic, business logic |
| `data/schemas/` | Pydantic request/response models | DB logic |
| `agents/` | LLM chains, prompts, memory, RAG | Called from routes directly |
| `core/` | Config, logging, DB session | Business logic |
| `utils/` | Stateless helpers (JWT, audio, Redis pool) | Business logic, DB access |

### Request Flow

```
Request → api/ → services/ → repositories/ / gateways/ / agents/ → Response
```

### Import Convention

```python
from app.services.chat_service import ChatService
from app.data.schemas.chat import ChatResponse
from app.services.repositories.chat_repository import get_chat_by_id
```

---

## Async Rules

- All routes and service methods must be `async def`
- Never use blocking calls (`time.sleep`, sync DB drivers) inside `async def`
- Use `run_in_threadpool` for sync libraries in async context

```python
from fastapi.concurrency import run_in_threadpool

result = await run_in_threadpool(sync_client.make_request, data=my_data)
```

---

## Pydantic Schemas

### Use Field validators and built-in types

```python
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    email: EmailStr
```

### Separate request and response schemas

```python
class ChatCreateRequest(BaseModel):
    influencer_id: int

class ChatResponse(BaseModel):
    id: int
    influencer_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

---

## Dependencies

### Use for auth and DB injection

```python
@router.get("/chats/{chat_id}")
async def get_chat(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await chat_service.get_chat(db, chat_id, current_user.id)
```

### Use for validation

```python
async def valid_chat_id(chat_id: int, db: AsyncSession = Depends(get_db)):
    chat = await chat_repository.get_by_id(db, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@router.get("/chats/{chat_id}")
async def get_chat(chat: Chat = Depends(valid_chat_id)):
    return chat
```

---

## Database

### Naming conventions
- Table names: singular, snake_case (`user`, `chat`, `payment_account`)
- DateTime columns: `_at` suffix (`created_at`, `updated_at`)
- Date columns: `_date` suffix (`birth_date`)
- Boolean columns: `is_` prefix (`is_active`, `is_verified`)

### Always use async sessions

```python
async def get_chat_by_id(db: AsyncSession, chat_id: int) -> Chat | None:
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    return result.scalar_one_or_none()
```

### Migrations (Alembic)
- One migration per logical change
- Descriptive names: `2024-03-01_add_relationship_stage.py`
- Always include a `downgrade()` function

---

## API Routes

### Document endpoints

```python
@router.post(
    "/chats",
    response_model=ChatResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Chat"],
)
async def create_chat(...):
    ...
```

### WebSocket pattern

```python
@router.websocket("/ws/chat/{chat_id}")
async def chat_ws(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...),
):
    user = await validate_ws_token(token)
    await websocket.accept()
    # call service, stream response
```

---

## Testing

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client

@pytest.mark.asyncio
async def test_create_chat(client: AsyncClient):
    resp = await client.post("/chats", json={"influencer_id": 1})
    assert resp.status_code == 201
```

---

## Quick Reference

| Scenario | Solution |
|---|---|
| Where does business logic go? | `services/` |
| Where do DB queries go? | `services/repositories/` |
| Where do external API calls go? | `services/gateways/` |
| Where do LLM/AI calls go? | `agents/` (called from services) |
| Where do request/response shapes go? | `data/schemas/` |
| Where do ORM models go? | `data/models/` |
| Blocking I/O in async context | `run_in_threadpool()` |
| Shared route validation | `Depends()` with DB check |
| Multi-step reusable operation | `services/use_cases/` |
