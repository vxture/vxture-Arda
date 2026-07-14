import { prisma } from "../../lib/db";
import { downstreamOf, layerNodes, type GraphEdge } from "./graph-core";
import type { NodeType } from "./seed";

/**
 * Workspace-scoped lineage graph (L-BL1: the screen reads the DB, not seed).
 *
 * Nodes come from three real tables:
 *   DataSource (source) -> Dataset (table, via Dataset.dataSourceId)
 *   Dataset -> Dataset (LineageEdge, the curated dataset-level lineage)
 *   Dataset -> DataService (api, via DataServiceDataset)
 *
 * Columns are longest-path layers; impact (L-BL3) is the downstream closure
 * of the subject dataset. Everything is derived at read time - lineage has
 * no stored layout or scores (biz-100 §3.5).
 */

const NODE_CAP = 200;

export interface LineageNodeView {
  id: string;
  label: string;
  type: NodeType;
  col: number;
  core?: boolean;
}

export interface LineageView {
  nodes: LineageNodeView[];
  edges: Array<[string, string]>;
  datasets: Array<{ id: string; name: string }>;
  subjectId: string | null;
  impact: { datasets: number; services: number; names: string[] };
  truncated: boolean;
}

const EMPTY_IMPACT = { datasets: 0, services: 0, names: [] as string[] };

export async function getLineage(workspaceId: string, subjectDatasetId?: string): Promise<LineageView> {
  const [datasets, lineageEdges, serviceLinks] = await Promise.all([
    prisma.dataset.findMany({
      where: { workspaceId },
      select: { id: true, name: true, type: true, dataSourceId: true, source: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.lineageEdge.findMany({ where: { workspaceId } }),
    prisma.dataServiceDataset.findMany({
      where: { workspaceId },
      include: { service: { select: { id: true, name: true } } },
    }),
  ]);

  const datasetOptions = datasets.map((d) => ({ id: d.id, name: d.name }));
  if (datasets.length === 0) {
    return { nodes: [], edges: [], datasets: [], subjectId: null, impact: EMPTY_IMPACT, truncated: false };
  }

  const subjectId =
    subjectDatasetId && datasets.some((d) => d.id === subjectDatasetId)
      ? subjectDatasetId
      : pickDefaultSubject(datasets.map((d) => d.id), lineageEdges);

  // Assemble the full workspace graph with prefixed node ids per kind.
  const nodes = new Map<string, LineageNodeView>();
  const edges: GraphEdge[] = [];

  for (const d of datasets) {
    nodes.set(`ds:${d.id}`, {
      id: `ds:${d.id}`,
      label: d.name,
      type: "table",
      col: 0,
      core: d.id === subjectId,
    });
    if (d.source) {
      const sid = `src:${d.source.id}`;
      if (!nodes.has(sid)) nodes.set(sid, { id: sid, label: d.source.name, type: "source", col: 0 });
      edges.push({ from: sid, to: `ds:${d.id}` });
    }
  }
  for (const e of lineageEdges) {
    if (nodes.has(`ds:${e.upstreamDatasetId}`) && nodes.has(`ds:${e.downstreamDatasetId}`)) {
      edges.push({ from: `ds:${e.upstreamDatasetId}`, to: `ds:${e.downstreamDatasetId}` });
    }
  }
  for (const link of serviceLinks) {
    const svcId = `svc:${link.service.id}`;
    if (!nodes.has(svcId)) nodes.set(svcId, { id: svcId, label: link.service.name, type: "api", col: 0 });
    if (nodes.has(`ds:${link.datasetId}`)) edges.push({ from: `ds:${link.datasetId}`, to: svcId });
  }

  // Trim isolated nodes (no edges at all) except the subject - a workspace
  // full of unlinked datasets would otherwise render an unreadable wall.
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  connected.add(`ds:${subjectId}`);
  let truncated = false;
  let kept = [...nodes.values()].filter((n) => connected.has(n.id));
  if (kept.length > NODE_CAP) {
    kept = kept.slice(0, NODE_CAP);
    truncated = true; // reported, never silent
  }
  const keptIds = new Set(kept.map((n) => n.id));
  const keptEdges = edges.filter((e) => keptIds.has(e.from) && keptIds.has(e.to));

  const layers = layerNodes([...keptIds], keptEdges);
  for (const n of kept) n.col = layers.get(n.id) ?? 0;

  // Impact (L-BL3): downstream closure of the subject.
  const closure = downstreamOf(`ds:${subjectId}`, keptEdges);
  const impactedDatasets: string[] = [];
  let impactedServices = 0;
  for (const id of closure) {
    if (id.startsWith("ds:")) impactedDatasets.push(nodes.get(id)?.label ?? id);
    else if (id.startsWith("svc:")) impactedServices += 1;
  }

  return {
    nodes: kept,
    edges: keptEdges.map((e) => [e.from, e.to] as [string, string]),
    datasets: datasetOptions,
    subjectId,
    impact: { datasets: impactedDatasets.length, services: impactedServices, names: impactedDatasets.slice(0, 5) },
    truncated,
  };
}

/** Default subject = the dataset touching the most lineage edges. */
function pickDefaultSubject(
  datasetIds: string[],
  lineageEdges: Array<{ upstreamDatasetId: string; downstreamDatasetId: string }>,
): string {
  const degree = new Map<string, number>();
  for (const e of lineageEdges) {
    degree.set(e.upstreamDatasetId, (degree.get(e.upstreamDatasetId) ?? 0) + 1);
    degree.set(e.downstreamDatasetId, (degree.get(e.downstreamDatasetId) ?? 0) + 1);
  }
  let best = datasetIds[0];
  let bestDeg = -1;
  for (const id of datasetIds) {
    const d = degree.get(id) ?? 0;
    if (d > bestDeg) {
      best = id;
      bestDeg = d;
    }
  }
  return best;
}
