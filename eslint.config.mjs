import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "token/**",
    "watchtower/**",
    "packages/watchtower-sdk/src/*.js",
    "packages/watchtower-sdk/src/*.d.ts",
    "packages/watchtower-sdk/src/*.map",
  ]),
]);

export default eslintConfig;
