"use client";

import {
  Button,
  DataTable,
  MetricGrid,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../ui/phosphor-icon";
import { AreaChart, Radar } from "../../ui/charts";
import {
  LEVEL_TONE,
  passColor,
  QUALITY_DIMS,
  QUALITY_RULES,
  SCORE_TREND,
  type QualityRule,
} from "./seed";

const TREND_META: Record<string, { icon: PIconName; color: string }> = {
  up: { icon: "trend-up", color: "var(--vx-color-success-600)" },
  down: { icon: "trend-down", color: "var(--vx-color-danger-600)" },
  flat: { icon: "minus", color: "var(--vx-color-text-muted)" },
};

export default function QualityPage() {
  const t = useTranslations("quality");

  const metrics: MetricGridItem[] = [
    { id: "score", label: t("metrics.score"), value: "92.4", trend: t("metrics.scoreTrend"), tone: "positive" },
    { id: "rules", label: t("metrics.rules"), value: "1,284", trend: t("metrics.rulesTrend"), tone: "positive" },
    { id: "issues", label: t("metrics.issues"), value: "386K", trend: t("metrics.issuesTrend"), tone: "positive" },
    { id: "pending", label: t("metrics.pending"), value: "142", tone: "warning" },
  ];

  const columns: DataTableColumn<QualityRule>[] = [
    {
      id: "rule",
      header: t("col.rule"),
      cell: (r) => (
        <div>
          <div className="cell-asset-name">{r.name}</div>
          <div className="cell-asset-code">{r.id}</div>
        </div>
      ),
    },
    { id: "target", header: t("col.target"), cell: (r) => r.target },
    { id: "dim", header: t("col.dim"), cell: (r) => <span className="dim-tag">{t("dim." + r.dim)}</span> },
    {
      id: "level",
      header: t("col.level"),
      cell: (r) => <StatusBadge tone={LEVEL_TONE[r.level]}>{t("level." + r.level)}</StatusBadge>,
    },
    {
      id: "pass",
      header: t("col.pass"),
      cell: (r) => (
        <div className="pass-cell">
          <span className="pass-track">
            <span style={{ width: r.pass + "%", background: passColor(r.pass) }} />
          </span>
          <span className="pass-val">{r.pass}%</span>
        </div>
      ),
    },
    { id: "issues", header: t("col.issues"), align: "right", cell: (r) => r.issues.toLocaleString() },
    {
      id: "trend",
      header: t("col.trend"),
      cell: (r) => <PIcon name={TREND_META[r.trend].icon} color={TREND_META[r.trend].color} />,
    },
  ];

  return (
    <div className="screen">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="secondary">
              <PIcon name="funnel" /> {t("rules")}
            </Button>
            <Button>
              <PIcon name="play" /> {t("runAudit")}
            </Button>
          </>
        }
      />

      <MetricGrid items={metrics} />

      <div className="dash-cols">
        <div className="con-card">
          <div className="con-card-hd">
            <div>
              <div className="con-card-heading">{t("trendTitle")}</div>
              <div className="con-card-sub">{t("trendSub")}</div>
            </div>
            <StatusBadge tone="success">{t("ratingGood")}</StatusBadge>
          </div>
          <AreaChart data={SCORE_TREND} id="qTrend" color="var(--vx-color-success-600)" height={150} />
        </div>
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("sixDim")}</div>
          </div>
          <div className="q-radar-center">
            <Radar data={QUALITY_DIMS.map((d) => ({ name: t("dim." + d.key), score: d.score }))} size={230} />
          </div>
        </div>
      </div>

      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div>
            <div className="con-card-heading">{t("execTitle")}</div>
            <div className="con-card-sub">{t("execSub")}</div>
          </div>
        </div>
        <DataTable columns={columns} rows={QUALITY_RULES} rowKey={(r) => r.id} />
      </div>
    </div>
  );
}
