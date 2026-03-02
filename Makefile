.PHONY: seed-influencers seed-pricing seed-users seed-all seed-prompts seed-subscription-plans
.PHONY: lint lint-fix format format-check lint-docker lint-docker-fix format-docker format-docker-check
.PHONY: db-backup db-restore db-backup-list

COMPOSE ?= docker compose
SERVICE ?= backend

LINT_PATHS := app
ifneq ("$(wildcard tests)","")
LINT_PATHS += tests
endif

seed-influencers:
	$(COMPOSE) exec $(SERVICE) python -m app.scripts.seed_influencers

seed-pricing:
	$(COMPOSE) exec $(SERVICE) python -m app.scripts.seed_pricing

seed-users:
	$(COMPOSE) exec $(SERVICE) python -m app.scripts.seed_users

seed-prompts:
	$(COMPOSE) exec $(SERVICE) python -m app.scripts.seed_prompts

seed-subscription-plans:
	$(COMPOSE) exec $(SERVICE) python -m app.scripts.seed_subscription_plans

seed-all: seed-influencers seed-pricing seed-users seed-prompts seed-subscription-plans

.PHONY: db-wipe-conversations
db-wipe-conversations:
	$(COMPOSE) exec db psql -U postgres -d teaseme -c "TRUNCATE messages, memories, chats, calls CASCADE;"

db-backup:
	COMPOSE_CMD="$(COMPOSE)" bash scripts/db_backup.sh

db-restore:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make db-restore FILE=backups/db/<backup>.sql.gz [CONFIRM_RESTORE=yes]"; \
		exit 1; \
	fi
	COMPOSE_CMD="$(COMPOSE)" FILE="$(FILE)" CONFIRM_RESTORE="$(CONFIRM_RESTORE)" bash scripts/db_restore.sh

db-backup-list:
	@mkdir -p backups/db
	@ls -lh backups/db | tail -n +2 || true

.PHONY: alembic-revision alembic-upgrade alembic-downgrade alembic-current alembic-history alembic-stamp-production
alembic-revision:
	$(COMPOSE) exec $(SERVICE) alembic revision --autogenerate -m "$(MESSAGE)"

alembic-upgrade:
	$(COMPOSE) exec $(SERVICE) alembic upgrade head

alembic-downgrade:
	$(COMPOSE) exec $(SERVICE) alembic downgrade -1

alembic-current:
	$(COMPOSE) exec $(SERVICE) alembic current

alembic-history:
	$(COMPOSE) exec $(SERVICE) alembic history

# IMPORTANTE: Use este comando em produção após o primeiro deploy
alembic-stamp-production:
	@echo "⚠️  ATENÇÃO: Este comando marca o banco de produção sem executar migrações"
	@echo "📋 Use apenas na primeira vez após limpar as migrações antigas"
	@read -p "Você tem certeza? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		$(COMPOSE) exec $(SERVICE) alembic stamp head; \
		echo "✅ Banco marcado como versão inicial"; \
	else \
		echo "❌ Operação cancelada"; \
	fi

# Desenvolvimento local (fora do Docker)
.PHONY: alembic-local-revision alembic-local-upgrade alembic-local-current
alembic-local-revision:
	DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/teaseme" \
	poetry run alembic revision --autogenerate -m "$(MESSAGE)"

alembic-local-upgrade:
	DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/teaseme" \
	poetry run alembic upgrade head

alembic-local-current:
	DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/teaseme" \
	poetry run alembic current

lint:
	poetry run ruff check $(LINT_PATHS)

lint-fix:
	poetry run ruff check --fix $(LINT_PATHS)

format:
	poetry run ruff format $(LINT_PATHS)

format-check:
	poetry run ruff format --check $(LINT_PATHS)

lint-docker:
	$(COMPOSE) exec $(SERVICE) ruff check $(LINT_PATHS)

lint-docker-fix:
	$(COMPOSE) exec $(SERVICE) ruff check --fix $(LINT_PATHS)

format-docker:
	$(COMPOSE) exec $(SERVICE) ruff format $(LINT_PATHS)

format-docker-check:
	$(COMPOSE) exec $(SERVICE) ruff format --check $(LINT_PATHS)

.PHONY: doctor-python-env
doctor-python-env:
	$(COMPOSE) exec $(SERVICE) python -c "import sqlalchemy,fastapi,httpx; print('ok')"
