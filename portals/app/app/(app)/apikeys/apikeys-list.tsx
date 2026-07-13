"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  MetricGrid,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { revokeApiKey } from "./actions";
import type { ApiKeyMetrics, ApiKeyView } from "./data";

function fmtDate(iso: string | null, never: string): string {
  return iso ? new Date(iso).toLocaleString() : never;
}

export function ApiKeysList({ keys, metrics }: { keys: ApiKeyView[]; metrics: ApiKeyMetrics }) {
  const t = useTranslations("apikeys");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const revoke = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      await revokeApiKey(id);
      setBusyId(null);
    });
  };

  const metricItems: MetricGridItem[] = useMemo(
    () => [
      { id: "total", label: t("metrics.total"), value: metrics.total.toLocaleString() },
      { id: "active", label: t("metrics.active"), value: metrics.active.toLocaleString() },
      {
        id: "revoked",
        label: t("metrics.revoked"),
        value: metrics.revoked.toLocaleString(),
        tone: metrics.revoked ? "warning" : "default",
      },
    ],
    [metrics, t],
  );

  const columns: DataTableColumn<ApiKeyView>[] = [
    {
      id: "name",
      header: t("col.name"),
      cell: (k) => (
        <div>
          <div className="cell-asset-name">{k.name}</div>
          {k.consumerApp && <div className="cell-asset-code">{k.consumerApp}</div>}
        </div>
      ),
    },
    {
      id: "service",
      header: t("col.service"),
      cell: (k) => (k.serviceName ? <span className="dim-tag">{k.serviceName}</span> : <span className="dim">-</span>),
    },
    {
      id: "scopes",
      header: t("col.scopes"),
      cell: (k) => <span className="mono dim">{k.scopes.length ? k.scopes.join(", ") : "-"}</span>,
    },
    { id: "lastUsed", header: t("col.lastUsed"), cell: (k) => <span className="dim">{fmtDate(k.lastUsedAt, t("neverUsed"))}</span> },
    {
      id: "status",
      header: t("col.status"),
      cell: (k) => (
        <StatusBadge tone={k.revoked ? "neutral" : "success"}>{k.revoked ? t("status.revoked") : t("status.active")}</StatusBadge>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (k) =>
        k.revoked ? null : (
          <Button variant="secondary" size="sm" disabled={pending && busyId === k.id} onClick={() => revoke(k.id)}>
            <PIcon name="lock-key" /> {t("revoke")}
          </Button>
        ),
    },
  ];

  return (
    <div className="screen">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <MetricGrid items={metricItems} />

      {keys.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="lock-key" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("listTitle")}</div>
          </div>
          <DataTable columns={columns} rows={keys} rowKey={(k) => k.id} />
        </div>
      )}
    </div>
  );
}
