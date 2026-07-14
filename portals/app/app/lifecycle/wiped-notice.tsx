"use client";

import { EmptyState } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../ui/phosphor-icon";

/** Shown in place of ALL (app) content when the workspace carries a wipe
 *  mark: the data still exists until the retention deadline (recovery via
 *  platform re-provision), but nothing is accessible. */
export function WipedNotice({ retainedUntil }: { retainedUntil: string | null }) {
  const t = useTranslations("wiped");
  return (
    <div className="entitlement-pending">
      <EmptyState
        title={
          <span className="app-empty-title">
            <PIcon name="lock-key" /> {t("title")}
          </span>
        }
        description={
          retainedUntil
            ? t("descriptionUntil", { date: new Date(retainedUntil).toLocaleDateString() })
            : t("description")
        }
      />
    </div>
  );
}
