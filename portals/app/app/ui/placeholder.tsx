"use client";

import { EmptyState, Icon } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";

// Shared "under construction" surface for sections/sub-views not built yet.
// Most (app) surfaces are now real (DB-backed); this renders for the remaining
// placeholder areas.
export function PlaceholderSection() {
  const t = useTranslations("placeholder");
  return (
    <div className="app-section">
      <EmptyState
        title={
          <span className="app-empty-title">
            <Icon name="cube" size="sm" />
            {t("title")}
          </span>
        }
        description={t("description")}
      />
    </div>
  );
}
