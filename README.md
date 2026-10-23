# devops-test

Express + Drizzle app that runs against **Neon Local** in development and the
**Neon Cloud serverless database** in production. One image, two Compose stacks.

```
Development                                   Production
┌─────────────┐     HTTP :5432/sql     ┌──────────────────┐
│  app        │ ─────────────────────► │  neon-local      │ ──► ephemeral Neon branch
│  (node)     │     Postgres :5432     │  (Docker proxy)  │     (deleted on `down`)
└─────────────┘ ─────────────────────► └──────────────────┘
        ▲
        │ docker-compose.dev.yml

Production
┌─────────────┐     HTTPS (serverless driver)
│  app        │ ─────────────────────────────► Neon Cloud (neondb)
│  (node)     │     DATABASE_URL from .env.production / CI secrets
└─────────────┘
```

## What is in the box

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build: `development` (dev deps + watch) and `production` (prod deps only, non-root) |
| `docker-compose.yml` | Default stack = local development (extends `docker-compose.dev.yml`) |
| `docker-compose.dev.yml` | App + Neon Local + one-shot migration runner |
| `docker-compose.prod.yml` | App + one-shot migration runner against Neon Cloud (no local proxy) |
| `.env.development(.example)` | Neon Local connection string and proxy credentials |
| `.env.production(.example)` | Neon Cloud connection string and production settings |
| `scripts/db-migrate.js` | Waits for the database, then retries `drizzle-kit migrate` |
| `src/config/env.js` | Loads `.env.<NODE_ENV>` before the app starts |
| `src/config/database.js` | Switches the Neon serverless driver between Neon Local and Neon Cloud |

## Prerequisites

- Docker Engine / Docker Desktop with Compose v2
- A Neon project: **API key**, **project ID**, and (optionally) a **parent branch ID**
- An Arcjet key (the app's security middleware requires one)

Get the Neon values from the Neon Console: the API key under *Account settings →
API keys*, the project ID under *Project settings → General*. `PARENT_BRANCH_ID`
is optional; when omitted, Neon Local branches from your project's default branch.

> Neon Local is a **proxy**, not an offline database. It needs outbound access to
> Neon Cloud to create the ephemeral branch.

## Local development with Neon Local

1. Create your env file and fill in the Neon credentials:

   ```bash
   cp .env.development.example .env.development
   ```

   ```dotenv
   DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb?sslmode=no-verify
   NEON_LOCAL=true
   NEON_API_KEY=...
   NEON_PROJECT_ID=...
   # PARENT_BRANCH_ID=br-...   # optional
   ARCJET_KEY=...
   ```

2. Start the stack:

   ```bash
   docker compose up --build
   # equivalent to:
   # docker compose -f docker-compose.dev.yml up --build
   ```

   What happens:
   1. `neon-local` starts and creates an **ephemeral branch** of your Neon project.
   2. `migrate` waits for the proxy, then applies the Drizzle migrations in `drizzle/`.
   3. `app` starts with `node --watch` on <http://localhost:3000> with the source
      bind-mounted, so edits reload automatically.

3. Verify:

   ```bash
   curl http://localhost:3000/health
   ```

4. Stop everything (the ephemeral branch is deleted):

   ```bash
   docker compose down
   ```

### How the app reaches the proxy

Neon Local serves both protocols on port `5432`:

- **Postgres protocol** — used by `drizzle-kit` migrations:
  `postgres://neon:npg@neon-local:5432/neondb?sslmode=no-verify`
- **Neon serverless protocol (HTTP)** — used by the app:
  `http://neon-local:5432/sql`

The proxy uses fixed local credentials **`neon` / `npg`**. The database segment
(`neondb`) must match a database that exists on the Neon branch. If your project
uses another database name, change it in `DATABASE_URL`.

`src/config/database.js` reads `NEON_LOCAL=true` and redirects the serverless
driver:

```js
if (process.env.NEON_LOCAL === 'true') {
    const { hostname, port } = new URL(databaseUrl);
    neonConfig.fetchEndpoint = `http://${hostname}:${port || 5432}/sql`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.poolQueryViaFetch = true;
}
```

### Running the app on the host (optional)

Start only the proxy, then run Node locally:

```bash
docker compose up -d neon-local
```

Create `.env.development.local` (it overrides `.env.development`):

```dotenv
DATABASE_URL=postgres://neon:npg@localhost:5432/neondb?sslmode=no-verify
```

Then apply migrations and start the app:

```bash
npm run db:migrate
npm run dev
```

`localhost` works here because port `5432` is published on the host; inside the
Compose network the app must use the service name `neon-local`.

## Production with Neon Cloud

1. Create the production env file from the template and set the **real** Neon
   connection string (pooled endpoint recommended):

   ```bash
   cp .env.production.example .env.production
   ```

   ```dotenv
   DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   NEON_LOCAL=false
   NODE_ENV=production
   ARCJET_KEY=...
   ```

2. Deploy:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

   The `migrate` service applies pending migrations and exits; `app` starts only
   after it succeeds (`service_completed_successfully`). There is **no**
   `neon-local` service in this stack — the database is the external Neon Cloud
   branch.

3. Check the deployment:

   ```bash
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs -f app
   curl http://localhost:3000/health
   ```

In CI/CD, replace `env_file: .env.production` with your platform's secret
injection, or run Compose with an env file generated from secrets:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Environment switching summary

| Setting | Development | Production |
| --- | --- | --- |
| Env file | `.env.development` | `.env.production` |
| `NODE_ENV` | `development` | `production` |
| `DATABASE_URL` | `postgres://neon:npg@neon-local:5432/neondb?sslmode=no-verify` | `postgresql://...@ep-...neon.tech/neondb?sslmode=require` |
| `NEON_LOCAL` | `true` | `false` |
| Driver endpoint | `http://neon-local:5432/sql` | Neon Cloud (`https://<endpoint>/sql`) |
| Proxy service | `neon-local` container | none |
| Compose file | `docker-compose.dev.yml` | `docker-compose.prod.yml` |

`NODE_ENV` selects the env file at startup (`src/config/env.js`), and
`DATABASE_URL` is the only thing that changes the database target. In Docker,
variables are injected by Compose and the env files are **not** copied into the
image (see `.dockerignore`).

### Environment variable reference

| Variable | Where | Description |
| --- | --- | --- |
| `DATABASE_URL` | app, migrate, neon-local | Connection string. Neon Local in dev, Neon Cloud in prod |
| `NEON_LOCAL` | app, migrate | `true` routes the serverless driver to the local proxy |
| `NEON_LOCAL_FETCH_ENDPOINT` | app | Optional override; defaults to `http://<DATABASE_URL host>:<port>/sql` |
| `NEON_API_KEY` | neon-local | Neon API key used to create/delete the ephemeral branch |
| `NEON_PROJECT_ID` | neon-local | Neon project that owns the branch |
| `PARENT_BRANCH_ID` | neon-local | Optional parent branch for the ephemeral branch |
| `DELETE_BRANCH` | neon-local | `true` (default) deletes the branch when the container stops |
| `NODE_ENV` | app | Selects `.env.<NODE_ENV>`; production writes logs to files only |
| `PORT` | app | HTTP port (default `3000`) |
| `LOG_LEVEL` | app | Winston log level |
| `ARCJET_KEY` | app | Arcjet site key |
| `DB_WAIT_TIMEOUT_MS` | migrate | How long to wait for the database (default `120000`) |
| `DB_MIGRATE_ATTEMPTS` | migrate | Number of migration attempts (default `10`) |
| `DB_MIGRATE_RETRY_DELAY_MS` | migrate | Delay between attempts (default `5000`) |

## Migrations

`drizzle-kit` prefers the `pg` driver (installed as a dev dependency) over the
serverless driver, so migrations use the standard Postgres protocol that Neon
Local also exposes. No WebSocket configuration is required.

- Local: the `migrate` service runs automatically before the app starts.
- Production: the `migrate` service runs automatically before the app starts.
- Manual (host):

  ```bash
  npm run db:generate   # generate a new migration
  npm run db:migrate    # apply migrations
  ```

To run migrations only:

```bash
docker compose -f docker-compose.dev.yml run --rm migrate
docker compose -f docker-compose.prod.yml run --rm migrate
```

## CI/CD (GitHub Actions)

Three workflows live in `.github/workflows`:

| Workflow | Triggers | What it does |
| --- | --- | --- |
| `lint-and-format.yml` | push and pull request to `main`, `staging` | `npm ci`, then `npm run lint` and `npm run format:check`; annotates failures with the fix commands |
| `tests.yml` | push and pull request to `main`, `staging` | Runs Jest with coverage (`NODE_ENV=test`), uploads the coverage report for 30 days, writes a job summary, annotates failing tests |
| `docker-build-and-push.yml` | push to `main`, `workflow_dispatch` | Builds the `production` Dockerfile target for `linux/amd64` and `linux/arm64` and pushes it to Docker Hub with branch, SHA, `latest` and `prod-YYYYMMDD-HHmmss` tags |

Repository secrets used by the workflows:

| Secret | Workflow | Purpose |
| --- | --- | --- |
| `DOCKER_USERNAME` | `docker-build-and-push.yml` | Docker Hub account; also used as the image namespace |
| `DOCKER_PASSWORD` | `docker-build-and-push.yml` | Docker Hub access token |
| `DATABASE_URL` | `tests.yml` | Database used by the test suite (falls back to a local placeholder when unset) |

The lint workflow calls the `lint`, `lint:fix`, `format` and `format:check` npm
scripts, which must be provided by ESLint and Prettier in `package.json`.

## Common tasks

```bash
# Rebuild after dependency changes
docker compose build --no-cache

# Open a shell in the app container
docker compose exec app sh

# Follow logs
docker compose logs -f app neon-local

# Persistent branch per Git branch (optional)
# Add to the neon-local service in docker-compose.dev.yml:
#   volumes:
#     - ./.neon_local:/tmp/.neon_local
#     - ./.git/HEAD:/tmp/.git/HEAD:ro,consistent
# and set DELETE_BRANCH=false
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `password authentication failed` during migration | Use `neon:npg` — Neon Local's fixed local credentials |
| `database "..." does not exist` | The database segment of `DATABASE_URL` must exist on the Neon branch (default `neondb`) |
| `self-signed certificate` / TLS error | Keep `?sslmode=no-verify` on the local `DATABASE_URL` (Neon Local uses a self-signed certificate) |
| Neon Local exits with `401` / branch errors | Check `NEON_API_KEY` and `NEON_PROJECT_ID`; the container needs internet access |
| `neon-local` not resolvable | Use `neon-local` inside Compose, `localhost` only from the host |
| Port `5432` already in use | Change the published port to `5433:5432` and use `localhost:5433` for host tooling |
| App container starts before migrations | It should not; `depends_on` waits for `migrate` to complete. Check `docker compose logs migrate` |
| No console logs in production | Logs are written to `logs/*.log`; they are persisted in the `app-logs` volume |

## Security notes

- **Never commit real credentials.** Only `*.example` files are tracked. If a
  real `.env` was committed previously, rotate its Neon/Arcjet credentials and
  untrack it:

  ```bash
  git rm --cached .env
  ```

- The production image runs as the unprivileged `node` user and contains only
  production dependencies.
- `env_file` injects secrets into container environments (visible through
  `docker inspect`). For stricter isolation use Docker secrets or your
  orchestrator's secret store and reference the values as environment variables.
