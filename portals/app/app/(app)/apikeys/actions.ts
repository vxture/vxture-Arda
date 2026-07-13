"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { prisma } from "../../lib/db";

/**
 * Revoke an API key. Server action: never trust the client - the session,
 * role, and workspace scope are all re-checked here (three-layer defense,
 * action layer). Revocation is a soft flag (`revoked=true`), never a delete,
 * and writes an AuditLog row (biz-250 §7.3 - one of the first real audit
 * write points).
 */
export async function revokeApiKey(keyId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  // Workspace-scoped compound filter: a key id from another workspace never matches.
  const key = await prisma.apiKey.findFirst({ where: { workspaceId: session.workspaceId, id: keyId } });
  if (!key) return { ok: false, error: "not_found" };
  if (key.revoked) return { ok: true }; // idempotent

  await prisma.$transaction([
    prisma.apiKey.update({ where: { id: key.id }, data: { revoked: true } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "apikey.revoke",
        target: key.id,
        metadata: { name: key.name, consumerApp: key.consumerApp },
      },
    }),
  ]);

  revalidatePath("/apikeys");
  return { ok: true };
}
