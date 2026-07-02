# Arda - Modules

Per-service specification: config, volumes, ports, and environment variables.

---

## arda-app

**Image:** `ghcr.io/vxture/arda-app:<IMAGE_TAG>`
**Container name:** `${PROJECT_NAME}-app` (e.g., `arda-app`, `arda-beta-app`)
**Internal port:** `3230`
**Published port:** `${APP_PUBLISH_PORT}:3230` (tailnet interface only)
**Network:** `arda-net`

The single Next.js application. It is the OIDC Authorization Code + PKCE
relying party, the app-BFF (tokens stay server-side in Redis), the subscription
gate, and all UI surfaces. The app runs as a standard Next.js server on internal
port 3230; the `APP_PUBLISH_PORT` binding exposes it to the tailnet so the
shared public edge can proxy it.

### Volumes

None. The app itself is stateless: session state lives in `arda-redis` and
domain/business data in `arda-db`. The app holds no local persistent state.

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | | `3230` | Internal listen port (fixed) |
| `OIDC_ISSUER` | Yes | | OIDC issuer URL (`https://accounts.vxture.com`) |
| `OIDC_CLIENT_ID` | | `arda` | OIDC client ID (same for both envs) |
| `OIDC_CLIENT_SECRET` | Yes | | Client secret from accounts.vxture.com |
| `OIDC_REDIRECT_URI` | Yes | | Registered callback URI (must match per-env) |
| `OIDC_SCOPES` | | `openid profile email arda:subscription` | Space-separated scopes |
| `OIDC_POST_LOGOUT_REDIRECT_URI` | | | Post-logout redirect (app root) |
| `REDIS_URL` | Yes | `redis://arda-redis:6379` | Redis connection string |
| `DATABASE_URL` | Yes | `postgresql://arda:arda@${PROJECT_NAME}-db:5432/arda?schema=public` | Postgres connection string (Prisma pg adapter + `migrate deploy` at start) |
| `RP_SESSION_TTL` | | `2592000` | Session TTL in seconds (30 days) |
| `RP_SESSION_COOKIE_NAME` | | `vx_rp_session` | Opaque session cookie name |
| `RP_SESSION_COOKIE_DOMAIN` | Yes | | Exact host domain (no leading dot) |
| `DEFAULT_LANDING` | | `/dashboard` | Post-login default route |
| `MOCK_STATE` | | `subscribed` | Mock lifecycle state (dev/beta; see entitlement.md) |
| `MOCK_TIER` | | `pro` | Mock tier (dev/beta; no effect when real claim present) |
| `NEXT_PUBLIC_APP_ENV` | Yes | `prod` | Stack identity baked into browser bundle |
| `NEXT_PUBLIC_PROD_URL` | Yes | | Prod URL for EnvGuard redirect |
| `NEXT_PUBLIC_BETA_URL` | Yes | | Beta URL for EnvGuard redirect |
| `MOCK_AUTH` | | | If `true` (non-prod only): bypass OIDC, use dev-login route |

### Healthcheck

```
GET http://127.0.0.1:3230/api/health
Interval: 30s | Timeout: 5s | Retries: 3 | Start period: 20s
```

Returns `{ "status": "ok" }` when the app is healthy. The `detect` job in
`release.yml` uses this to confirm the container is up after deploy.

### Logging

```
driver: json-file
max-size: 10m
max-file: 3
```

---

## arda-redis

**Image:** `redis:7-alpine`
**Container name:** `${PROJECT_NAME}-redis` (e.g., `arda-redis`, `arda-beta-redis`)
**Internal port:** `6379`
**Published port:** None (container-internal only)
**Network:** `arda-net`

The server-side OIDC RP session store. Holds the PKCE handshake (`authreq:`),
RP sessions (`rpsess:`), token bundles (`rptok:`), and the back-channel logout
index (`sid:`). Tokens never leave the server; the browser sees only an opaque
session cookie. Redis runs with `appendonly yes` so session state survives
container restarts. `--save ""` disables RDB snapshots (AOF is the durability
mechanism). `--maxmemory-policy noeviction` prevents silent session loss if
memory fills: Redis returns errors rather than evicting keys.

### Volumes

```
${DATA_DIR}/redis:/data
```

`DATA_DIR` is on the RAID-1 array (`/srv/md0` prod, `/srv/md1` beta) so
session state survives root-disk failure.

### Healthcheck

```
redis-cli ping
Interval: 30s | Timeout: 5s | Retries: 3 | Start period: 10s
```

### Logging

```
driver: json-file
max-size: 10m
max-file: 3
```

---

## arda-db

**Image:** `postgres:16-alpine`
**Container name:** `${PROJECT_NAME}-db` (e.g., `arda-db`, `arda-beta-db`)
**Internal port:** `5432`
**Published port:** None (container-internal only)
**Network:** `arda-net`

The domain/business data store (catalog + governance, v1): datasets, sources,
policies, quality rules/results, standards, lineage, data services, keys, and
audit. Every business row is isolated by `workspaceId` and force-filtered by it
in the data layer. This is NOT the OIDC session store (that is `arda-redis`) and
NOT subscription/billing (that lives on the vxture platform). Schema and models:
`design/arda-data-architecture-schema.md`.

Migrations are applied by `docker-entrypoint.sh` (`prisma migrate deploy`) at
app start; a migration failure is fatal (the app will not serve a schema behind
the code). `arda-app` gates on `arda-db` being `service_healthy` before start.

### Volumes

```
${DATA_DIR}/postgres:/var/lib/postgresql/data
```

`DATA_DIR` is on the RAID-1 array (`/srv/md0` prod, `/srv/md1` beta) so domain
data survives root-disk failure. Prod and beta use separate stacks/dirs so their
data never mixes. Backups: `deploy/ops.sh backup` runs `pg_dump -Fc`.

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_USER` | | `arda` | DB user (must match `DATABASE_URL`) |
| `POSTGRES_PASSWORD` | Yes | | DB password (must match `DATABASE_URL`) |
| `POSTGRES_DB` | | `arda` | Database name |

### Healthcheck

```
pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
Interval: 30s | Timeout: 5s | Retries: 5 | Start period: 20s
```

### Logging

```
driver: json-file
max-size: 10m
max-file: 3
```

---

## arda-net

**Driver:** bridge

Internal Docker network. `arda-app`, `arda-redis`, and `arda-db` are the members.
`arda-redis` and `arda-db` have no published ports; they are reachable only from
within this network. The prod and beta compose projects each create their own
network (named by `PROJECT_NAME`), so the two stacks are fully isolated at the
network layer.
