"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, MetricGrid, NativeSelect, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import { LEVEL_TONE } from "../dashboard/seed";
import { setDatasetClassification } from "../catalog/actions";
import type { LabelingData, LabelRow } from "./labeling-data";

const LEVELS = ["public", "internal", "sensitive", "core"];

/** Classification labeling workbench: relabel datasets inline (admin). */
export function LabelingView({ data, isAdmin = false }: { data: LabelingData; isAdmin?: boolean }) {
  const t = useTranslations("labeling");
  const tl = useTranslations("quality");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const relabel = (id: string, level: string) =>
    startTransition(async () => {
      const res = await setDatasetClassification(id, level);
      if (res.ok) router.refresh();
    });

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("mTotal"), value: data.total.toLocaleString() },
    ...data.byLevel.map((b) => ({ id: b.level, label: tl("level." + b.level), value: b.count.toLocaleString(), tone: b.level === "core" ? ("danger" as const) : ("default" as const) })),
  ];

  const columns: DataTableColumn<LabelRow>[] = [
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
    { id: "domain", header: t("cDomain"), cell: (r) => (r.domain ? <span className="dim-tag">{r.domain}</span> : <span className="dim">-</span>) },
    {
      id: "level",
      header: t("cLevel"),
      cell: (r) =>
        isAdmin ? (
          <NativeSelect aria-label={t("cLevel")} value={r.level} disabled={pending} onChange={(e) => relabel(r.id, e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {tl("level." + l)}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <StatusBadge tone={LEVEL_TONE[r.level]}>{tl("level." + r.level)}</StatusBadge>
        ),
    },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="tag" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      <div className="con-card no-pad">
        <DataTable columns={columns} rows={data.rows} rowKey={(r) => r.id} empty={t("empty")} />
      </div>
    </div>
  );
}
