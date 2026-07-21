import { NextResponse } from "next/server";
import { buildHealthIdentity } from "@vxture/shared";

// Shared liveness handler for every portal's /api/health route (org standard
// docs/10-standards/020 + 025). buildHealthIdentity is the single source for the
// identity block {status, service, version, gitSha, stage, buildTime, time};
// provenance is injected at build/runtime as ENV (APP_VERSION / GIT_SHA /
// BUILD_TIME from the CI build-args; DEPLOY_STAGE per-stack at runtime) with
// honest fallbacks (dev / unknown) - never hardcoded.
//
// Dependency-free by contract (020): no DB / Redis / upstream checks here, so
// the endpoint stays green as long as the server is serving.
export function GET() {
  return NextResponse.json(buildHealthIdentity({ service: "arda-app" }));
}
