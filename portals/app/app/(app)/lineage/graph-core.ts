/**
 * Pure graph core for lineage (L-BL1/L-BL3): layering for the column layout,
 * reachability for impact analysis, and cycle detection for edge writes.
 * Side-effect free so the graph rules are testable without a database.
 */

export interface GraphEdge {
  from: string;
  to: string;
}

/** Longest-path layer per node (sources = 0). Cycle-safe: nodes on a cycle
 *  keep their best-known layer instead of looping forever. */
export function layerNodes(nodeIds: readonly string[], edges: readonly GraphEdge[]): Map<string, number> {
  const layer = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const e of edges) {
    if (!layer.has(e.from) || !layer.has(e.to)) continue;
    (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  // Kahn with longest-path relaxation.
  const queue = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of out.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(id) ?? 0) + 1));
      indeg.set(next, (indeg.get(next) ?? 1) - 1);
      if ((indeg.get(next) ?? 0) <= 0) queue.push(next);
    }
  }
  return layer;
}

/** All nodes reachable FROM `start` following edge direction (start excluded). */
export function downstreamOf(start: string, edges: readonly GraphEdge[]): Set<string> {
  const out = new Map<string, string[]>();
  for (const e of edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  const seen = new Set<string>();
  const stack = [...(out.get(start) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(out.get(id) ?? []));
  }
  return seen;
}

/** Would adding from->to create a cycle (i.e. is `from` reachable from `to`)? */
export function wouldCreateCycle(from: string, to: string, edges: readonly GraphEdge[]): boolean {
  if (from === to) return true;
  return downstreamOf(to, edges).has(from);
}
