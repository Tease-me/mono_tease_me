# FastAPI Guidelines for AI Agents

This document defines how to write and organize code in this project. The codebase is organized by layer, with strict separation between transport, business logic, persistence, and integrations.

## Project Structure

Code is organized by layer, not by domain. New code must go in the correct layer.

```
app/
├── main.py
├── api/               # Transport layer only
│   ├── routes/        # HTTP route modules
│   ├── deps/          # Shared FastAPI dependencies
│   ├── middleware/    # Middleware registration helpers
│   └── errors/        # HTTP error mapping and handlers
├── services/          # Business logic and orchestration
│   ├── repositories/  # Database access only
│   ├── gateways/      # External service wrappers
│   └── use_cases/     # Reusable multi-step workflows
├── data/              # Data contracts and persistence models
│   ├── models/        # SQLAlchemy ORM table definitions
│   ├── schemas/       # Pydantic request/response shapes
│   └── enums/         # Shared contract-level enums
├── core/              # Config, logging, DB session, app bootstrap
├── utils/             # Pure stateless helpers
└── workers/           # Background jobs and async processing

alembic/
docs/
scripts/
```

### Layer Rules

| Layer | Does | Does Not |
|---|---|---|
| `api/` | Parse request, call service, return schema | DB queries, business logic |
| `services/` | All business logic and decisions | Raw SQL, direct HTTP calls |
| `services/repositories/` | DB queries (SELECT/INSERT/UPDATE/DELETE) | Business decisions |
| `services/gateways/` | Wrap external API calls | Business logic |
| `services/use_cases/` | Multi-step ops reusable across routes and scheduler | — |
| `data/models/` | SQLAlchemy ORM class definitions | Pydantic, business logic |
| `data/schemas/` | Pydantic request/response models | DB logic |
| `data/enums/` | Shared enums used by schemas and models where appropriate | Business workflows |
| `core/` | Config, logging, DB session | Business logic |
| `utils/` | Pure stateless helpers | Business logic, DB access, app state |
| `workers/` | Background jobs, scheduled tasks, async processing | HTTP request handling |

### Request Flow

```
Request → api/ → services/ → repositories/ / gateways/ → Response
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

Route handlers should call services for business behavior. Use dependency validation only for narrow request-scoped checks such as auth, existence checks, or shared parameter validation.

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

Routes should stay thin. They should parse input, call a service or use case, and return a schema response. They should not contain business rules or direct persistence logic.

Do not write route-local helper functions in `api/` or other route modules for reusable shaping, serialization, or decision logic. If logic is shared or non-trivial, move it into `services/use_cases/` for application behavior or `utils/` for pure stateless helpers, then import it into the route.

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

## Quick Reference

| Scenario | Solution |
|---|---|
| Where does business logic go? | `services/` |
| Where do DB queries go? | `services/repositories/` |
| Where do external API calls go? | `services/gateways/` |
| Where do request/response shapes go? | `data/schemas/` |
| Where do ORM models go? | `data/models/` |
| Where do shared data enums go? | `data/enums/` |
| Where do background jobs go? | `workers/` |
| Blocking I/O in async context | `run_in_threadpool()` |
| Shared route validation | `api/deps/` with `Depends()` |
| Multi-step reusable operation | `services/use_cases/` |
