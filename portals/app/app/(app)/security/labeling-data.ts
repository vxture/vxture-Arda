import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";

/**
 * Classification labeling workbench (biz-435 process ring): every dataset with
 * its current classification, so an admin can (re)label in bulk. Uses the
 * existing Dataset.classification + setDatasetClassification action - read-only
 * here.
 */
export interface LabelRow {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  level: AssetLevel;
}

const LEVELS: AssetLevel[] = ["public", "internal", "sensitive", "core"];

export interface LabelingData {
  rows: LabelRow[];
  byLevel: Array<{ level: AssetLevel; count: number }>;
  total: number;
}

export async function getLabelingData(workspaceId: string): Promise<LabelingData> {
  const rows = await prisma.dataset.findMany({
    where: { workspaceId },
    select: { id: true, name: true, code: true, domain: true, classification: true },
    orderBy: { name: "asc" },
  });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.classification, (counts.get(r.classification) ?? 0) + 1);
  return {
    rows: rows.map((r) => ({ id: r.id, name: r.name, code: r.code, domain: r.domain, level: r.classification as AssetLevel })),
    byLevel: LEVELS.map((level) => ({ level, count: counts.get(level) ?? 0 })),
    total: rows.length,
  };
}
