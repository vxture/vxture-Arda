import { getSession } from "../../auth/lib/session";
import { getSecurity } from "./data";
import { SecurityList } from "./security-list";

// Server component: classification distribution + counts come from the DB
// (workspace-scoped). Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await getSession();
  const data = session
    ? await getSecurity(session.workspaceId)
    : { dist: [], total: 0, coreCount: 0, coverage: 0 };
  return <SecurityList data={data} />;
}
