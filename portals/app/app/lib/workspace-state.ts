import { prisma } from "./db";

/**
 * Workspace wipe state (Lc-BL3): the soft-delete mark lives on the
 * WorkspaceRef anchor, so "is this workspace wiped?" is one indexed lookup -
 * the single choke point replacing per-row deletedAt filters everywhere.
 */

export const RETENTION_DAYS = 90; // arda_303 §1.4: expired data promise floor

export interface WipeState {
  wiped: boolean;
  /** End of the recovery window (wipedAt + RETENTION_DAYS), if wiped. */
  retainedUntil: Date | null;
}

export async function getWipeState(workspaceId: string): Promise<WipeState> {
  const ref = await prisma.workspaceRef.findUnique({
    where: { id: workspaceId },
    select: { wipedAt: true },
  });
  if (!ref?.wipedAt) return { wiped: false, retainedUntil: null };
  return {
    wiped: true,
    retainedUntil: new Date(ref.wipedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };
}
