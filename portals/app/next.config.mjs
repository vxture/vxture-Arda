import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: {
    // Next's build-time type check can't drive the TypeScript 7 native
    // compiler's API (it reports "typescript not installed"). Types are still
    // fully enforced by the dedicated `type-check` step (tsc --noEmit) that
    // runs in CI before the build, so this only skips Next's redundant pass -
    // it does not weaken the CI type gate. Revisit once Next supports TS 7.
    ignoreBuildErrors: true,
  },
  // Transpile the internal workspace package (raw TS source).
  transpilePackages: ["@arda/shared"],
  // Trace from the workspace root so standalone output includes the hoisted
  // node_modules and the shared package (monorepo standalone pattern).
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
