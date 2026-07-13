import { prisma } from "../../lib/db";

export interface ApiKeyView {
  id: string;
  name: string;
  consumerApp: string | null;
  serviceName: string | null;
  scopes: string[];
  lastUsedAt: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface ApiKeyMetrics {
  total: number;
  active: number;
  revoked: number;
}

export async function getApiKeys(
  workspaceId: string,
): Promise<{ keys: ApiKeyView[]; metrics: ApiKeyMetrics }> {
  const rows = await prisma.apiKey.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { service: { select: { name: true } } },
  });

  const keys: ApiKeyView[] = rows.map((k) => ({
    id: k.id,
    name: k.name,
    consumerApp: k.consumerApp,
    serviceName: k.service?.name ?? null,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revoked: k.revoked,
    createdAt: k.createdAt.toISOString(),
  }));

  const revoked = keys.filter((k) => k.revoked).length;
  return { keys, metrics: { total: keys.length, active: keys.length - revoked, revoked } };
}
