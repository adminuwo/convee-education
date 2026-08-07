# Database Setup & Bootstrap

## What runs on backend startup

Supervisor launches the backend via `scripts/start.sh`, which:

1. Runs `scripts/bootstrap.sh` (idempotent):
   - Waits for PostgreSQL to be reachable
   - Creates the `app_user` role if missing (with `LOGIN` + `CREATEDB`)
   - Creates the `collab_platform` database if missing (owned by `app_user`)
   - Runs `npx prisma migrate deploy` to apply any new migrations
   - Seeds demo data only when the `User` table is empty (safe on subsequent boots)
2. Execs `node dist/server.js`

Bootstrap errors are non-fatal for the server startup so the backend can still come up if the DB was pre-provisioned. Watch `/var/log/supervisor/backend.out.log` for `[bootstrap]` lines.

## Migrations

Committed migration files live under `prisma/migrations/`:

```
prisma/migrations/
├── migration_lock.toml           # provider = "postgresql"
└── 20260731000000_init/
    └── migration.sql             # full initial schema (27 tables + enums + indexes)
```

- **Schema is authoritative** in `prisma/schema.prisma`.
- To add a change: edit `schema.prisma`, then run:
  ```
  cd /app/backend
  npx prisma migrate dev --name <descriptive_name>
  ```
  This creates a new folder under `prisma/migrations/` with the SQL diff.
- On boot, `prisma migrate deploy` will apply any pending migrations in order and record them in the `_prisma_migrations` table.

## Manual operations

Recreate from scratch (destructive):
```
supervisorctl stop backend
su - postgres -c "psql -c 'DROP DATABASE IF EXISTS collab_platform;'"
su - postgres -c "psql -c 'DROP ROLE IF EXISTS app_user;'"
supervisorctl start backend    # bootstrap will recreate everything and seed
```

Verify state:
```
su - postgres -c "psql -d collab_platform -c '\\dt'"
PGPASSWORD='app_password_secure' psql -h 127.0.0.1 -U app_user -d collab_platform -c 'SELECT COUNT(*) FROM \"User\";'
```

## Environment

`DATABASE_URL` (in `/app/backend/.env`):
```
postgresql://app_user:app_password_secure@localhost:5432/collab_platform?schema=public
```

The password is intentionally the same as what the bootstrap script assigns via `ALTER ROLE ... WITH LOGIN PASSWORD ...` on every boot, so a drifted password will be corrected.
