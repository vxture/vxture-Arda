"use client";

import { DataTable, MetricGrid, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import type { SyncLogRow, SyncLogsData } from "./logs-data";

const ACTION_TONE: Record<string, "success" | "danger" | "info" | "neutral"> = {
  "datasource.sync": "success",
  "datasource.register": "info",
  "datasource.sync_fail": "danger",
};

function fmt(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

/** Sync logs & alerts: the datasource.* audit feed (biz-410). Read-only. */
export function LogsView({ data }: { data: SyncLogsData }) {
  const t = useTranslations("syncLogs");

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("mTotal"), value: data.total.toLocaleString() },
    { id: "syncs", label: t("mSyncs"), value: data.syncs.toLocaleString(), tone: "positive" },
    { id: "fail", label: t("mFailures"), value: data.failures.toLocaleString(), tone: data.failures ? "danger" : "default" },
  ];

  const columns: DataTableColumn<SyncLogRow>[] = [
    { id: "action", header: t("cEvent"), cell: (r) => <StatusBadge tone={ACTION_TONE[r.action] ?? "neutral"}>{t("action." + r.action.replace("datasource.", ""))}</StatusBadge> },
    { id: "source", header: t("cSource"), cell: (r) => <span className="cell-asset-name">{r.source}</span> },
    { id: "detail", header: t("cDetail"), cell: (r) => <span className={r.failed ? "" : "dim"}>{r.detail || "-"}</span> },
    { id: "at", header: t("cAt"), cell: (r) => <span className="dim">{fmt(r.at)}</span> },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="list-numbers" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      <div className="con-card no-pad">
        <DataTable columns={columns} rows={data.rows} rowKey={(r) => r.id} empty={t("empty")} />
      </div>
    </div>
  );
}
