import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";

/**
 * Workspace-scoped Data Services access. name/path/method/domain/level/status
 * come from the DB; call volume / P99 / SLA / subscriber count are runtime
 * telemetry not modelled in v1 and surface as null ("-") in the client.
 */
export interface ServiceView {
  id: string;
  code: string;
  name: string;
  path: string;
  method: string;
  domain: string | null;
  level: AssetLevel;
  status: string;
  description: string | null;
}

export async function getServices(workspaceId: string): Promise<ServiceView[]> {
  const rows = await prisma.dataService.findMany({ where: { workspaceId }, orderBy: { code: "asc" } });
  return rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    path: s.path,
    method: s.method,
    domain: s.domain,
    level: s.level as AssetLevel,
    status: s.status,
    description: s.description,
  }));
}
