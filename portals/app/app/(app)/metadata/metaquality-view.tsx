"use client";

import { DataTable, MetricGrid, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import { HBars } from "../../ui/charts";
import type { CompletenessRow, MetaQualityData } from "./metaquality-data";

const BAR = "var(--vx-color-primary)";

function scoreTone(s: number): "success" | "warning" | "danger" {
  return s >= 80 ? "success" : s >= 50 ? "warning" : "danger";
}

/** Metadata completeness: derived per-dataset curation score (biz-422). */
export function MetaQualityView({ data }: { data: MetaQualityData }) {
  const t = useTranslations("metaQuality");

  const metrics: MetricGridItem[] = [
    { id: "avg", label: t("mAvg"), value: data.avgScore == null ? "-" : data.avgScore + "%", tone: "positive" },
    { id: "complete", label: t("mComplete"), value: data.complete.toLocaleString() },
    { id: "incomplete", label: t("mIncomplete"), value: (data.total - data.complete).toLocaleString(), tone: data.total - data.complete ? "warning" : "default" },
  ];

  const fieldBars = data.byField.map((f) => ({ label: t("field." + f.field), value: f.filledPct, color: BAR }));

  const columns: DataTableColumn<CompletenessRow>[] = [
    {
      id: "asset",
      header: t("cAsset"),
      cell: (r) => (
        <div>
          <div className="cell-asset-name">{r.name}</div>
          <div className="cell-asset-code">{r.code}</div>
        </div>
      ),
    },
    { id: "score", header: t("cScore"), cell: (r) => <StatusBadge tone={scoreTone(r.score)}>{r.score}%</StatusBadge> },
    {
      id: "missing",
      header: t("cMissing"),
      cell: (r) =>
        r.missing.length === 0 ? (
          <span className="dim">-</span>
        ) : (
          <span className="tag-list">
            {r.missing.map((f) => (
              <span className="tag" key={f}>
                {t("field." + f)}
              </span>
            ))}
          </span>
        ),
    },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="seal-check" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      <div className="con-card">
        <div className="con-card-hd">
          <div className="con-card-heading">{t("byFieldTitle")}</div>
        </div>
        {fieldBars.length ? <HBars data={fieldBars} /> : <p className="dim">{t("empty")}</p>}
      </div>
      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div className="con-card-heading">{t("listTitle")}</div>
        </div>
        <DataTable columns={columns} rows={data.rows} rowKey={(r) => r.id} empty={t("empty")} />
      </div>
    </div>
  );
}
