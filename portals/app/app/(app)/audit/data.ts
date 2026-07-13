import { prisma } from "../../lib/db";

export interface AuditLogView {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  createdAt: string;
}

export interface AuditMetrics {
  total: number;
  platformActions: number;
  last24h: number;
}

const PAGE_SIZE = 100;

/** Latest audit entries for the workspace, newest first. Uses the
 *  [workspaceId, createdAt] compound index (data-120). v1 = latest page;
 *  filter/export follow with the retention quota work (biz-250 §5). */
export async function getAuditLog(
  workspaceId: string,
  now: Date = new Date(),
): Promise<{ entries: AuditLogView[]; metrics: AuditMetrics }> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [rows, total, platformActions, last24h] = await Promise.all([
    prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where: { workspaceId } }),
    prisma.auditLog.count({ where: { workspaceId, actor: "platform" } }),
    prisma.auditLog.count({ where: { workspaceId, createdAt: { gte: dayAgo } } }),
  ]);

  return {
    entries: rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      target: r.target,
      createdAt: r.createdAt.toISOString(),
    })),
    metrics: { total, platformActions, last24h },
  };
}
