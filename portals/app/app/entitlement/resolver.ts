import { type ArdaClaim, type ArdaState, type Subscription, type Tier, subscriptionFromClaim } from "./types";

/** Resolve entitlement from an ArdaClaim extracted from the access token.
 *  When claim is null (local dev, no real IdP) the resolver falls back to
 *  MOCK_TIER / MOCK_STATE env vars so the app is usable without accounts. */
export interface EntitlementResolver {
  resolve(claim: ArdaClaim | null): Promise<Subscription>;
}

/**
 * Stand-in resolver used until accounts.vxture.com emits the real `arda`
 * scope claim. When a real claim is present it is passed through unchanged.
 * When absent (local dev without a real IdP) falls back to MOCK_STATE +
 * MOCK_TIER so the shell and overview page are reachable.
 */
export class MockEntitlementResolver implements EntitlementResolver {
  async resolve(claim: ArdaClaim | null): Promise<Subscription> {
    if (claim) return subscriptionFromClaim(claim);
    // Legacy MOCK_STATE=free still maps to the current "none" state.
    const rawState = process.env.MOCK_STATE ?? "subscribed";
    const state = (rawState === "free" ? "none" : rawState) as ArdaState;
    const tier = (process.env.MOCK_TIER as Tier) ?? "pro";
    return subscriptionFromClaim({ state, tier, had_trial: false });
  }
}

/**
 * Factory for the active entitlement resolver.
 * TODO(accounts): once accounts.vxture.com emits the `arda` claim, the mock
 * becomes transparent (it passes real claims through). No factory change is
 * needed; remove MockEntitlementResolver only when the claim is guaranteed
 * to be present in all environments.
 */
export function getEntitlementResolver(): EntitlementResolver {
  return new MockEntitlementResolver();
}
