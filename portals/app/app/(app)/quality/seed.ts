/**
 * Static seed for Data Quality (no DB yet). Generic intelligent data-platform
 * audit rules. Reuses asset-meta helpers + quality dimensions from the dashboard.
 */
import type { AssetLevel } from "../dashboard/seed";

export { LEVEL_TONE, qualityTone, type AssetLevel } from "../dashboard/seed";
export { QUALITY_DIMS } from "../dashboard/seed";

/** Quality score trend over the last audit cycles. */
export const SCORE_TREND = [88.1, 89.4, 90.2, 89.8, 91.1, 91.6, 92.0, 91.4, 92.2, 92.4];

export interface QualityRule {
  id: string;
  name: string;
  target: string; // dataset audited
  dim: string; // i18n key, matches QUALITY_DIMS keys
  level: AssetLevel;
  pass: number; // pass rate %
  issues: number;
  trend: "up" | "down" | "flat";
}

export const QUALITY_RULES: QualityRule[] = [
  { id: "Q-201", name: "Identifier checksum", target: "Customer Master", dim: "validity", level: "core", pass: 99.2, issues: 9842, trend: "down" },
  { id: "Q-188", name: "Order id uniqueness", target: "Order Transactions", dim: "uniqueness", level: "internal", pass: 97.6, issues: 12480, trend: "up" },
  { id: "Q-174", name: "Geo bounds check", target: "Web Clickstream", dim: "accuracy", level: "public", pass: 99.8, issues: 1204, trend: "flat" },
  { id: "Q-159", name: "Timestamp null rate", target: "Support Tickets", dim: "completeness", level: "sensitive", pass: 91.4, issues: 184200, trend: "down" },
  { id: "Q-143", name: "Amount range threshold", target: "Revenue Ledger", dim: "validity", level: "sensitive", pass: 86.2, issues: 42600, trend: "up" },
  { id: "Q-126", name: "Freshness SLA", target: "Churn Risk Scores", dim: "timeliness", level: "core", pass: 88.7, issues: 23400, trend: "down" },
];

export function passColor(pass: number): string {
  if (pass >= 95) return "var(--vx-color-success-500)";
  if (pass >= 90) return "var(--vx-color-info-500)";
  return "var(--vx-color-warning-500)";
}
