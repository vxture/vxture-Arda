-- Lc-BL3 (2026-07-14): workspace-level soft delete. The wipe mark lives on the
-- WorkspaceRef anchor; business tables carry no per-row deletedAt.
ALTER TABLE "WorkspaceRef" ADD COLUMN "wipedAt" TIMESTAMP(3);
CREATE INDEX "WorkspaceRef_wipedAt_idx" ON "WorkspaceRef"("wipedAt");
