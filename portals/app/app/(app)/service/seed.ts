/**
 * Service presentation metadata. The service rows now come from the DB (see
 * data.ts); this file holds the method/status/domain display maps.
 */
import type { StatusBadgeTone } from "@vxture/design-system";
import type { PIconName } from "../../ui/phosphor-icon";

export { LEVEL_TONE, DOMAINS, type AssetLevel } from "../dashboard/seed";

export const METHOD_COLOR: Record<string, string> = {
  GET: "var(--vx-color-success-600)",
  POST: "var(--vx-color-info-600)",
};

export const STATUS_META: Record<string, { tone: StatusBadgeTone; icon: PIconName }> = {
  running: { tone: "success", icon: "play" },
  review: { tone: "warning", icon: "clock" },
  paused: { tone: "neutral", icon: "pause" },
};
