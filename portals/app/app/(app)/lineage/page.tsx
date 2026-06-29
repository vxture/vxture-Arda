"use client";

import { Button, PageHeader } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../ui/phosphor-icon";
import { LINEAGE, TYPE_META, type NodeType } from "./seed";

const COL_W = 220;
const NODE_W = COL_W - 40;
const NODE_H = 64;
const GAP_Y = 26;
const PAD = 40;

export default function LineagePage() {
  const t = useTranslations("lineage");

  // Column-based layout: group nodes by col, vertically center each column.
  const cols: Record<number, typeof LINEAGE.nodes> = {};
  let maxCol = 0;
  for (const n of LINEAGE.nodes) {
    (cols[n.col] ??= []).push(n);
    maxCol = Math.max(maxCol, n.col);
  }
  const colHeight = (list: typeof LINEAGE.nodes) => list.length * NODE_H + (list.length - 1) * GAP_Y;
  const maxH = Math.max(...Object.values(cols).map(colHeight));
  const pos: Record<string, { x: number; y: number }> = {};
  for (let c = 0; c <= maxCol; c++) {
    const list = cols[c] ?? [];
    const startY = PAD + (maxH - colHeight(list)) / 2;
    list.forEach((n, i) => {
      pos[n.id] = { x: PAD + c * COL_W, y: startY + i * (NODE_H + GAP_Y) };
    });
  }
  const W = PAD * 2 + maxCol * COL_W + NODE_W;
  const H = maxH + PAD * 2;

  const TYPES: NodeType[] = ["source", "job", "table", "api", "app"];

  return (
    <div className="screen">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="secondary">
              <PIcon name="magnifying-glass-plus" /> {t("impact")}
            </Button>
            <Button variant="secondary">
              <PIcon name="corners-out" /> {t("fullscreen")}
            </Button>
          </>
        }
      />

      <div className="lineage-toolbar">
        <span className="lt-label">{t("subject")}</span>
        <span className="lt-chip">
          <PIcon name="table" /> Customer Master <PIcon name="caret-down" />
        </span>
        <span className="lt-legend">
          {TYPES.map((ty) => (
            <span className="ltl-item" key={ty}>
              <span className="ltl-dot" style={{ background: TYPE_META[ty].color }} />
              {t("type." + ty)}
            </span>
          ))}
        </span>
      </div>

      <div className="con-card lineage-canvas" style={{ height: H + 24 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
          {LINEAGE.edges.map(([a, b], i) => {
            const p1 = pos[a];
            const p2 = pos[b];
            const x1 = p1.x + NODE_W;
            const y1 = p1.y + NODE_H / 2;
            const x2 = p2.x;
            const y2 = p2.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                stroke="var(--vx-color-border-strong)"
                strokeWidth="1.6"
              />
            );
          })}
        </svg>
        {LINEAGE.nodes.map((n) => {
          const p = pos[n.id];
          const meta = TYPE_META[n.type];
          return (
            <div
              key={n.id}
              className={"ln-node" + (n.core ? " core" : "")}
              style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
            >
              <span
                className="ln-ico"
                style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
              >
                <PIcon name={meta.icon as PIconName} />
              </span>
              <div className="ln-text">
                <div className="ln-label">{n.label}</div>
                <div className="ln-type">{t("type." + n.type)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lineage-foot">
        <InfoChip icon="arrows-split" label={t("foot.upstream")} value={t("foot.upstreamVal")} />
        <InfoChip icon="arrow-right" label={t("foot.job")} value="JOB-1001" />
        <InfoChip icon="arrows-merge" label={t("foot.downstream")} value={t("foot.downstreamVal")} />
        <InfoChip icon="warning" label={t("foot.impact")} value={t("foot.impactVal")} warn />
      </div>
    </div>
  );
}

function InfoChip({ icon, label, value, warn }: { icon: PIconName; label: string; value: string; warn?: boolean }) {
  return (
    <div className={"info-chip" + (warn ? " warn" : "")}>
      <PIcon name={icon} />
      <div>
        <div className="ic-label">{label}</div>
        <div className="ic-value">{value}</div>
      </div>
    </div>
  );
}
