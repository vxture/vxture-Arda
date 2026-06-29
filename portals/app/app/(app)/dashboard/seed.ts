/**
 * Static seed data for the dashboard (Phase 1 - no DB yet). Generic intelligent
 * data-platform sample content; swap for real APIs once the domain schema and
 * entitlement sync land. Colors are DS tokens only.
 */
import type { StatusBadgeTone } from "@vxture/design-system";
import type { PIconName } from "../../ui/phosphor-icon";

export type AssetLevel = "public" | "internal" | "sensitive" | "core";

export const LEVEL_TONE: Record<AssetLevel, StatusBadgeTone> = {
  public: "success",
  internal: "info",
  sensitive: "warning",
  core: "danger",
};

export function qualityTone(score: number): StatusBadgeTone {
  if (score >= 95) return "success";
  if (score >= 85) return "info";
  if (score >= 70) return "warning";
  return "danger";
}

export interface DomainMeta {
  icon: PIconName;
  color: string;
}

export const DOMAINS: Record<string, DomainMeta> = {
  customer: { icon: "users-three", color: "var(--vx-color-brand-600)" },
  product: { icon: "stack", color: "var(--vx-color-info-600)" },
  marketing: { icon: "broadcast", color: "var(--vx-color-teal-600)" },
  finance: { icon: "buildings", color: "var(--vx-color-success-600)" },
  operations: { icon: "flow-arrow", color: "var(--vx-color-warning-500)" },
  web: { icon: "chart-line-up", color: "var(--vx-color-danger-600)" },
};

// Growth trend stays a presentation aggregate (timeseries not modelled in v1).
export const GROWTH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
export const ASSET_GROWTH = [9840, 10380, 10920, 11560, 12180, 12847].map((v) => ({ v }));

/** Quality dimensions; name keys resolve via i18n "dashboard.dim.<key>". */
export const QUALITY_DIMS = [
  { key: "completeness", score: 95.2 },
  { key: "accuracy", score: 92.8 },
  { key: "consistency", score: 89.4 },
  { key: "timeliness", score: 94.1 },
  { key: "uniqueness", score: 96.7 },
  { key: "validity", score: 90.3 },
];

export interface DashAlert {
  key: string;
  icon: PIconName;
  tone: string;
  route: string;
}

export const ALERTS: DashAlert[] = [
  { key: "a1", icon: "warning-octagon", tone: "var(--vx-color-danger-600)", route: "/etl" },
  { key: "a2", icon: "warning", tone: "var(--vx-color-warning-500)", route: "/quality" },
  { key: "a3", icon: "lock-key-open", tone: "var(--vx-color-warning-500)", route: "/security" },
  { key: "a4", icon: "git-pull-request", tone: "var(--vx-color-info-600)", route: "/standards" },
];
