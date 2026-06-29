import { getSession } from "../../auth/lib/session";
import { getDashboard } from "./data";
import { DashboardClient } from "./dashboard-client";

// Server component: load workspace aggregates (totals, domain/team distribution,
// top assets, quality) from the DB. Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

const EMPTY = { total: 0, volume: "0", compliance: 0, qualityScore: 0, domainDonut: [], teamBars: [], topAssets: [] };

export default async function DashboardPage() {
  const session = await getSession();
  const data = session ? await getDashboard(session.workspaceId) : EMPTY;
  return <DashboardClient data={data} />;
}
