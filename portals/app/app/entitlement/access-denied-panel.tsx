"use client";

import { EmptyState } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../ui/phosphor-icon";

/** Rendered in place of a role-locked screen's content. No CTA on purpose:
 *  roles are granted by a workspace admin, not purchasable - deep-linking to
 *  the console here would be misleading (biz-250 §6). */
export function AccessDeniedPanel() {
  const t = useTranslations("accessDenied");
  return (
    <div className="entitlement-pending">
      <EmptyState
        title={
          <span className="app-empty-title">
            <PIcon name="lock-key" /> {t("title")}
          </span>
        }
        description={t("description")}
      />
    </div>
  );
}
