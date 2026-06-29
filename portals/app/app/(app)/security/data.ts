import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";

/**
 * Workspace-scoped Data Security access. The classification distribution, level
 * strip, core-asset count, and coverage are computed from Dataset.classification
 * (real). Masking-rule and blocked-call metrics, and the sharing-request queue,
 * are not modelled in v1 and stay as static demo in the client (flagged).
 */
const LEVEL_ORDER: AssetLevel[] = ["public", "internal", "sensitive", "core"];
const LEVEL_COLOR: Record<AssetLevel, string> = {
  public: "var(--vx-color-success-600)",
  internal: "var(--vx-color-info-600)",
  sensitive: "var(--vx-color-warning-500)",
  core: "var(--vx-color-danger-600)",
};

export interface SecurityData {
  dist: { key: AssetLevel; value: number; color: string }[];
  total: number;
  coreCount: number;
  coverage: number;
}

export async function getSecurity(workspaceId: string): Promise<SecurityData> {
  const grouped = await prisma.dataset.groupBy({
    by: ["classification"],
    where: { workspaceId },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const g of grouped) counts.set(String(g.classification), g._count._all);

  const dist = LEVEL_ORDER.map((k) => ({ key: k, value: counts.get(k) ?? 0, color: LEVEL_COLOR[k] }));
  const total = dist.reduce((a, d) => a + d.value, 0);
  const coreCount = counts.get("core") ?? 0;
  // Every dataset carries a classification (enum, non-null), so any catalogued
  // workspace is fully covered; 0 when empty.
  const coverage = total ? 100 : 0;

  return { dist, total, coreCount, coverage };
}
