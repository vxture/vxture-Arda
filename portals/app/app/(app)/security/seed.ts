/**
 * Security presentation metadata + static demo for the parts not modelled in v1.
 * The classification distribution / level strip / core / coverage now come from
 * the DB (see data.ts). The sharing-request queue is a workflow with no v1
 * entity, so it stays as static demo here (flagged) until an AccessRequest model
 * exists.
 */
import type { StatusBadgeTone } from "@vxture/design-system";
import type { AssetLevel } from "../dashboard/seed";

export { LEVEL_TONE, type AssetLevel } from "../dashboard/seed";

export const REQUEST_TONE: Record<string, StatusBadgeTone> = {
  pending: "warning",
  approved: "success",
};

export interface ShareRequest {
  who: string;
  asset: string;
  level: AssetLevel;
  time: string;
  status: string;
}

export const REQUESTS: ShareRequest[] = [
  { who: "Risk & Compliance", asset: "Customer Master", level: "core", time: "8 min ago", status: "pending" },
  { who: "Operations Center", asset: "Revenue Ledger", level: "sensitive", time: "1 hr ago", status: "pending" },
  { who: "Finance BI", asset: "Subscription Entitlements", level: "core", time: "2 hr ago", status: "approved" },
  { who: "Open Data Portal", asset: "Product Catalog", level: "public", time: "today", status: "approved" },
];
