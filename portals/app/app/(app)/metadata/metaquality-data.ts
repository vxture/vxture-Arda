import { prisma } from "../../lib/db";

/**
 * Metadata completeness (biz-422 MD-BL5): a derived per-dataset score over the
 * presence of the curatable metadata fields (description, owner, subject
 * domain, team, at least one tag). Nothing stored - computed at read time.
 */
const FIELDS = ["description", "owner", "domain", "team", "tags"] as const;
type Field = (typeof FIELDS)[number];

export interface CompletenessRow {
  id: string;
  name: string;
  code: string;
  score: number;
  missing: Field[];
}

export interface MetaQualityData {
  rows: CompletenessRow[];
  avgScore: number | null;
  complete: number;
  total: number;
  byField: Array<{ field: Field; filledPct: number }>;
}

export async function getMetaQuality(workspaceId: string): Promise<MetaQualityData> {
  const rows = await prisma.dataset.findMany({
    where: { workspaceId },
    select: { id: true, name: true, code: true, description: true, ownerUserId: true, domain: true, team: true, _count: { select: { tags: true } } },
    orderBy: { name: "asc" },
  });

  const filledCount: Record<Field, number> = { description: 0, owner: 0, domain: 0, team: 0, tags: 0 };

  const mapped: CompletenessRow[] = rows.map((r) => {
    const present: Record<Field, boolean> = {
      description: !!r.description?.trim(),
      owner: !!r.ownerUserId,
      domain: !!r.domain,
      team: !!r.team,
      tags: r._count.tags > 0,
    };
    const missing = FIELDS.filter((f) => !present[f]);
    for (const f of FIELDS) if (present[f]) filledCount[f] += 1;
    return { id: r.id, name: r.name, code: r.code, score: Math.round(((FIELDS.length - missing.length) / FIELDS.length) * 100), missing };
  });

  const total = rows.length;
  const avgScore = total ? Math.round(mapped.reduce((a, r) => a + r.score, 0) / total) : null;

  return {
    rows: mapped.sort((a, b) => a.score - b.score),
    avgScore,
    complete: mapped.filter((r) => r.missing.length === 0).length,
    total,
    byField: FIELDS.map((field) => ({ field, filledPct: total ? Math.round((filledCount[field] / total) * 100) : 0 })),
  };
}
