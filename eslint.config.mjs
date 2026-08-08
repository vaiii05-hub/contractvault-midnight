import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["scripts/**/*.ts"],
    rules: {
      // The Midnight deploy harness (following the official example-bboard /
      // eightblock pattern) needs `any` casts to satisfy deployContract's
      // heavy generic overloads.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compact compiler output.
    "contract/build/**",
  ]),
]);

export default eslintConfig;
