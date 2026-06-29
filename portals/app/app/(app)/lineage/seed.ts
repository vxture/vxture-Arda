/**
 * Static seed for the Data Lineage graph (no DB yet). A small generic
 * source -> job -> table -> table -> service/app graph for a sample asset.
 */
import type { PIconName } from "../../ui/phosphor-icon";

export type NodeType = "source" | "job" | "table" | "api" | "app";

export interface LineageNode {
  id: string;
  label: string;
  type: NodeType;
  col: number;
  core?: boolean;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: [string, string][];
}

export const LINEAGE: LineageGraph = {
  nodes: [
    { id: "s1", label: "CRM System", type: "source", col: 0 },
    { id: "s2", label: "Billing System", type: "source", col: 0 },
    { id: "s3", label: "Web Events", type: "source", col: 0 },
    { id: "e1", label: "Daily ETL Merge", type: "job", col: 1 },
    { id: "t1", label: "Customer Master", type: "table", col: 2, core: true },
    { id: "t2", label: "Customer 360", type: "table", col: 3 },
    { id: "a1", label: "Customer API", type: "api", col: 4 },
    { id: "a2", label: "Exec Dashboard", type: "app", col: 4 },
  ],
  edges: [
    ["s1", "e1"],
    ["s2", "e1"],
    ["s3", "e1"],
    ["e1", "t1"],
    ["t1", "t2"],
    ["t2", "a1"],
    ["t2", "a2"],
  ],
};

/** type -> icon + token color + i18n label key. */
export const TYPE_META: Record<NodeType, { icon: PIconName; color: string }> = {
  source: { icon: "database", color: "var(--vx-color-gray-500)" },
  job: { icon: "flow-arrow", color: "var(--vx-color-warning-500)" },
  table: { icon: "table", color: "var(--vx-color-brand-600)" },
  api: { icon: "broadcast", color: "var(--vx-color-info-600)" },
  app: { icon: "app-window", color: "var(--vx-color-teal-600)" },
};
