/**
 * Role gate for the admin domain (biz-250 §6, biz-300 stage 0 line B).
 *
 * The permission axis is ORTHOGONAL to the subscription axis: a subscription
 * says what the workspace bought; roles say what this member may do. Both
 * must pass (two-axis gating, biz-100 §3.2).
 *
 * Role values come verbatim from the IdP token `roles` claim (session.roles).
 * The platform role vocabulary is not finally confirmed (functional-domains
 * §8), so this uses the conservative default ruled in biz-300: the admin
 * domain is restricted to owner/admin; every unknown or absent role is
 * NON-admin (fail closed). Unlike subscription locking (visible-but-locked),
 * role-locked screens are HIDDEN from the nav - an upgrade cannot buy a role.
 */

const ADMIN_ROLES: readonly string[] = ["owner", "admin"];

export function isWorkspaceAdmin(roles: readonly string[] | undefined | null): boolean {
  return (roles ?? []).some((r) => ADMIN_ROLES.includes(r.toLowerCase()));
}
