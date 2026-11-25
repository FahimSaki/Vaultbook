import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Every query goes through withTenant(); only these files may touch the raw db.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/server/db/tenant.ts",
      "src/server/db/client.ts",
      "src/server/auth/auth.ts",
      "src/server/auth/hosted.ts",
      "src/server/seed/**",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/client"],
              allowTypeImports: true,
              message: "Query through withTenant() instead of the raw db.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
