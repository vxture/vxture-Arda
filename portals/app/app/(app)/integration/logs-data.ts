import { prisma } from "../../lib/db";

/**
 * Sync logs & alerts (biz-410 monitoring ring): the datasource.* AuditLog the
 * ingestion path already writes (register / sync / sync_fail). Read-only feed;
 * no new model.
 */
export interface SyncLogRow {
  id: string;
  action: string; // datasource.register | datasource.sync | datasource.sync_fail
  source: string;
  detail: string;
  actor: string;
  at: string;
  failed: boolean;
}

export interface SyncLogsData {
  rows: SyncLogRow[];
  total: number;
  syncs: number;
  failures: number;
}

function detailOf(action: string, md: Record<string, unknown>): string {
  if (action === "datasource.sync_fail") return String(md.reason ?? md.error ?? "");
  if (action === "datasource.sync") {
    const created = md.created ?? md.updated;
    return [created != null ? `+${created}` : null, md.skippedByQuota ? `skip ${md.skippedByQuota}` : null].filter(Boolean).join(" ");
  }
  return String(md.name ?? "");
}

export async function getSyncLogs(workspaceId: string): Promise<SyncLogsData> {
  const rows = await prisma.auditLog.findMany({
    where: { workspaceId, action: { startsWith: "datasource." } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, action: true, target: true, actor: true, metadata: true, createdAt: true },
  });

  const mapped: SyncLogRow[] = rows.map((r) => {
    const md = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      action: r.action,
      source: String(md.name ?? r.target ?? "-"),
      detail: detailOf(r.action, md),
      actor: r.actor,
      at: r.createdAt.toISOString(),
      failed: r.action === "datasource.sync_fail",
    };
  });

  return {
    rows: mapped,
    total: mapped.length,
    syncs: mapped.filter((r) => r.action === "datasource.sync").length,
    failures: mapped.filter((r) => r.failed).length,
  };
}
