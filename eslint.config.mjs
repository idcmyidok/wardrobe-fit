import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 디자인 토큰 외 색상/radius 임의 값 사용 경고 (PROJECT_SPEC.md 6.11)
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/(?:bg|text|border|outline|ring|fill|stroke)-\\[(?:#|rgb|hsl)|rounded(?:-[a-z]+)?-\\[/]",
          message: "임의 색상/radius 값 대신 디자인 토큰을 사용하세요 (src/styles/tokens.css).",
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
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
