/**
 * Arda version and build metadata shared across the app.
 * The build process stamps GIT_SHA at compile time via CI; fallback values
 * are used in local dev.
 */

declare const __GIT_SHA__: string | undefined;

const GIT_SHA: string =
  typeof __GIT_SHA__ !== "undefined" && __GIT_SHA__
    ? __GIT_SHA__
    : "dev";

export const ardaVersion = {
  /** SemVer-style product version (manual bump on significant releases). */
  product: "0.1.0",
  /** Git commit SHA, injected by the CI build or "dev" in local dev. */
  sha: GIT_SHA,
  /** Human-friendly build label. */
  label: `arda-app/${GIT_SHA === "dev" ? "dev" : `${GIT_SHA.slice(0, 7)}`}`,
  /** Deployment pipeline stage, set at deploy time or "local" for dev. */
  stage: GIT_SHA === "dev" ? "local" : "ci",
} as const;
