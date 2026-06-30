/**
 * Entitlement domain types for arda.
 *
 * The `arda` scope claim carried in the access token is the authoritative
 * source for both lifecycle state and subscription tier (replacing the
 * out-of-band lookup that was planned but never wired). accounts.vxture.com
 * populates this claim; arda reads it at session creation and on every
 * token refresh.
 */

// -- Lifecycle state ----------------------------------------------------------

/** User's position in the arda subscription lifecycle.
 *  trial      - new user on the beta stack; has not subscribed commercially.
 *  subscribed - active paid subscription; on the prod stack.
 *  expired    - subscription lapsed; on the prod stack at free tier.
 *  free       - direct-subscribed user whose subscription lapsed, or a user
 *               who subscribed directly without ever entering trial; on prod. */
export type ArdaState = "trial" | "subscribed" | "expired" | "free";

// -- Subscription tiers -------------------------------------------------------

/** Commercial subscription tier. Meaningful when state = "subscribed".
 *  Five tiers per the entitlement ADR (docs/ADR-entitlement-and-workspace.md):
 *  free < starter < pro < business < enterprise. The platform is the source of
 *  truth for which tier a (workspace, product=arda) subscription holds; arda
 *  only consumes the value. */
export type Tier = "free" | "starter" | "pro" | "business" | "enterprise";

/** Ordered tiers, lowest to highest. The index is the tier rank. */
export const TIER_ORDER: readonly Tier[] = ["free", "starter", "pro", "business", "enterprise"];

/** Numeric rank for a tier (higher = more entitled). */
export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Whether `tier` satisfies (meets or exceeds) the required `min` tier. */
export function tierMeets(tier: Tier, min: Tier): boolean {
  return tierRank(tier) >= tierRank(min);
}

// -- Arda claim (from access token) -------------------------------------------

/** The `arda` nested object inside the OIDC access token.
 *
 *  Invariants enforced by accounts.vxture.com:
 *    state=trial      -> tier = a platform-configured preview tier (e.g. pro or
 *                        business); had_trial = false until the user has been on
 *                        trial, then true.
 *    state=subscribed -> tier in {starter, pro, business, enterprise}
 *    state=expired    -> tier = "free"
 *    state=free       -> tier = "free"
 *
 *  had_trial = true iff the user ever entered a trial (opened beta). This
 *  gates the data-migration step on upgrade: direct-subscribe paths set
 *  had_trial = false and skip the migrate/discard prompt. */
export interface ArdaClaim {
  readonly state: ArdaState;
  readonly tier: Tier;
  readonly had_trial: boolean;
}

// -- Subscription (gate-facing view) ------------------------------------------

export type SubscriptionStatus = "active" | "none" | "expired";

export interface Subscription {
  readonly tier: Tier;
  readonly status: SubscriptionStatus;
}

/** Derive the gate-facing Subscription from an ArdaClaim.
 *
 *  trial / subscribed -> status active (user can access the app on their stack)
 *  expired            -> status expired (prod, free features, upgrade prompt)
 *  free               -> status none   (prod, free features, upgrade prompt) */
export function subscriptionFromClaim(claim: ArdaClaim): Subscription {
  if (claim.state === "trial" || claim.state === "subscribed") {
    return { tier: claim.tier, status: "active" };
  }
  if (claim.state === "expired") {
    return { tier: "free", status: "expired" };
  }
  return { tier: "free", status: "none" };
}
