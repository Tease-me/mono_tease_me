# Database Backup & Restore Guide

## Production app database

Production does **not** run Postgres in Docker. The backend container connects to **AWS RDS** via `DB_URL` in the server-local `.env`:

```bash
DB_URL=postgresql+asyncpg://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme
```

Deploy with:

```bash
docker compose -f compose.production.yml up -d --build
```

Alembic reads the same `DB_URL` at container startup (converted to sync `psycopg2` automatically).

---

## Infrastructure

| Component           | Details                                                  |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| **DB**              | AWS RDS PostgreSQL 18.4 (`ap-southeast-2` Sydney)        |
| **RDS Host**        | `db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com` |
| **DB Name**         | `teaseme`                                                |
| **DB User**         | `postgres`                                               |
| **Backup Server**   | Linux Mint 22.2 (`mjserver`) — user `mxj`                |
| **pg_dump binary**  | `/usr/lib/postgresql/18/bin/pg_dump`                     |
| **Backup location** | `/home/mxj/backups/teaseme/`                             |
| **pgAdmin 4**       | http://127.0.0.1:5050 · login `dev.mjpro@gmail.com`      |
| **pgAdmin start**   | `/usr/pgadmin4/bin/pgadmin4`                             | `nohup /usr/pgadmin4/bin/pgadmin4 > /tmp/pgadmin4.log 2>&1 &` |
| **AnyDesk ID**      | `1251151096`                                             |

> The RDS password is stored in pgAdmin — right-click **TEASEME - PRODUCTION** → **Properties** → **Connection** tab.

---

## Quick Reference

| Task             | Command                                                  |
| ---------------- | -------------------------------------------------------- |
| Take a backup    | See section 1                                            |
| Restore a backup | See section 2                                            |
| Start pgAdmin    | `/usr/pgadmin4/bin/pgadmin4`                             |
| Run migrations   | `docker compose -f compose.production.yml up -d --build` |

---

## 1. Taking a Backup (on `mjserver`)

```bash
/usr/lib/postgresql/18/bin/pg_dump \
  "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme" \
  | gzip > /home/mxj/backups/teaseme/teaseme_$(date +%Y%m%d_%H%M%S).sql.gz

# Verify size (should be ~24 MB)
ls -lh /home/mxj/backups/teaseme/
```

> **Note:** Use `/usr/lib/postgresql/18/bin/pg_dump` — the system default `pg_dump` is version 16
> and will fail with a version mismatch error against RDS 18.4.

---

## 2. Restoring a Backup (on `mjserver`)

Backups are plain SQL format — use `psql`, **not** `pg_restore`.

### Restore into production

```bash
gunzip -c ~/backups/teaseme/teaseme_YYYY_MM_DD.sql.gz | \
/usr/lib/postgresql/18/bin/psql \
  "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme"
```

### Restore into a test database (safe — does not touch production)

```bash
# Create test DB
/usr/lib/postgresql/18/bin/psql \
  "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/postgres" \
  -c "CREATE DATABASE teaseme;"

# Restore
gunzip -c /home/mxj/backups/teaseme/<backup_file>.sql.gz | \
/usr/lib/postgresql/18/bin/psql \
  "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme"

# Verify
/usr/lib/postgresql/18/bin/psql \
  "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme" \
  -c "SELECT COUNT(*) FROM users;"

# Clean up when done
/usr/lib/postgresql/18/bin/psql \
  "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/postgres" \
  -c "DROP DATABASE teaseme;"
```

---

## 3. Daily Automated Backup (Cron on `mjserver`)

Set up once — runs every day at **8 PM Brisbane time (AEST)**:

**Step 1 — register the cron job** (replace `<RDS_PASSWORD>` with the real password from pgAdmin):

```bash
(crontab -l 2>/dev/null; echo '0 20 * * * /usr/lib/postgresql/18/bin/pg_dump "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme" | gzip > /home/mxj/backups/teaseme/teaseme_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz 2>> /home/mxj/backups/teaseme/backup.log') | crontab -
```

**Step 2 — verify it saved:**

```bash
crontab -l
```

You should see a line starting with `0 20 * * *`.

**Step 3 — test it manually right now:**

```bash
/usr/lib/postgresql/18/bin/pg_dump \
  "postgresql://postgres:<RDS_PASSWORD>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme" \
  | gzip > /home/mxj/backups/teaseme/teaseme_$(date +%Y%m%d_%H%M%S).sql.gz && echo "Backup OK"

# Verify size (~24 MB expected)
ls -lh /home/mxj/backups/teaseme/
```

**Check logs after it runs:**

```bash
cat /home/mxj/backups/teaseme/backup.log
ls -lh /home/mxj/backups/teaseme/
```

---

## 4. pgAdmin 4

Start it on `mjserver`:

```bash
/usr/pgadmin4/bin/pgadmin4
```

Then open **http://127.0.0.1:5050** in the browser.

| Field       | Value                                                    |
| ----------- | -------------------------------------------------------- |
| Email       | `dev.mjpro@gmail.com`                                    |
| Server name | `TEASEME - PRODUCTION`                                   |
| Host        | `db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com` |
| Port        | `5432`                                                   |
| Database    | `teaseme`                                                |
| Username    | `postgres`                                               |

---

## 5. Running Migrations

Migrations run automatically when the backend container starts:

```bash
docker compose -f compose.production.yml up -d --build

# Watch migration output
docker compose -f compose.production.yml logs -f backend
```

### Check migration state

```bash
docker exec teaseme-backend alembic current
docker exec teaseme-backend alembic heads
```

### Rollback one migration

```bash
docker exec teaseme-backend alembic downgrade -1
```

---

## 6. Deleting a User (Admin)

### Via API (preferred — cascades automatically)

```bash
curl -X DELETE https://teasemebackend.mxjprod.work/user/<user_id> \
  -H "X-Internal-Token: $MJFP_TOKEN"
```

### Via SQL (run in pgAdmin Query Tool)

```sql
BEGIN;

DELETE FROM messages_18
WHERE chat_id IN (SELECT id FROM chats_18 WHERE user_id = <id>);

DELETE FROM chats_18 WHERE user_id = <id>;

DELETE FROM memories
WHERE chat_id IN (SELECT id FROM chats WHERE user_id = <id>);

DELETE FROM messages
WHERE chat_id IN (SELECT id FROM chats WHERE user_id = <id>);

UPDATE calls SET chat_id = NULL
WHERE chat_id IN (SELECT id FROM chats WHERE user_id = <id>);

DELETE FROM chats WHERE user_id = <id>;

DELETE FROM subscriptions WHERE user_id = <id>;
DELETE FROM daily_usage WHERE user_id = <id>;

-- All other tables (wallets, transactions, relationship_state, etc.)
-- cascade automatically via ON DELETE CASCADE.
DELETE FROM users WHERE id = <id>;

COMMIT;
```

> Replace `<id>` with the actual user ID.

---

## 7. Installing pg_dump 18 on `mjserver` (one-time setup)

Required because the system pg_dump (v16) doesn't work against RDS PostgreSQL 18.

```bash
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt noble-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
sudo apt update
sudo apt install -y postgresql-client-18

# Verify
/usr/lib/postgresql/18/bin/pg_dump --version
```

---

## 8. Remote Access

| Field         | Value                 |
| ------------- | --------------------- |
| AnyDesk ID    | `1251151096`          |
| pgAdmin 4     | http://127.0.0.1:5050 |
| pgAdmin login | `dev.mjpro@gmail.com` |
