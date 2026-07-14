/**
 * GET /api/lifecycle/sweep
 * Triggers the wiped-workspace hard-delete sweep (Lc-BL2). INTERNAL-ONLY,
 * same fail-closed guard as /api/usage/flush (arda-plat-220 §4 / B2): 404
 * unless INTERNAL_JOB_TOKEN is set AND the caller presents it.
 *
 * Intended caller = an internal cron/job on the tailnet. Destructive by
 * design, but only for workspaces past their RETENTION_DAYS recovery window.
 */

import { NextRequest, NextResponse } from "next/server";
import { sweepWipedWorkspaces } from "../../../lifecycle/sweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.INTERNAL_JOB_TOKEN;
  const provided = request.headers.get("x-internal-job-token");
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return new NextResponse(null, { status: 404 });
  }
  const result = await sweepWipedWorkspaces();
  return NextResponse.json(result);
}
