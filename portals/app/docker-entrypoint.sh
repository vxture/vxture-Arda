#!/bin/sh
# Container entrypoint: apply pending DB migrations, then start the app.
# One container per stack, so a serial migrate-then-serve is safe (no leader
# election needed). DATABASE_URL is provided by compose; the DB is gated
# service_healthy so it is accepting connections by the time we run.
set -e

# prisma.config.ts + prisma/ live under the workspace dir (app/); run migrate
# from there so its relative schema/migrations paths resolve. Non-fatal for now:
# no route depends on the DB yet, so a migration/DB hiccup must not take the app
# down (it would crash-loop the whole stack). Tighten to fatal once routes read
# the DB.
( cd app && prisma migrate deploy ) || echo "[entrypoint] WARN: prisma migrate deploy failed; starting app anyway"

exec node app/server.js
