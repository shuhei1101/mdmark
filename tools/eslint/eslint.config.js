import { fileURLToPath } from "node:url";
import { defineConfig } from "eslint/config";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import boundaries from "eslint-plugin-boundaries";
import importX from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

/** リポジトリの直下（`files` と plugin のパスの基準） */
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** ESLint を適用する Webview のフォルダ */
const WEBVIEW = "vscode/src/webview";
/** 複雑さの規則を適用する TypeScript */
const COMPLEXITY_FILES = [
  "src/**/*.ts",
  "scripts/**/*.ts",
  "vscode/src/**/*.{ts,tsx}",
  "plugin/**/*.ts",
];

export default defineConfig([
  {
    basePath: REPO_ROOT,
    ignores: ["**/node_modules/**", "**/dist/**", "**/*.{js,mjs,cjs}"],
  },
  {
    basePath: REPO_ROOT,
    files: COMPLEXITY_FILES,
    languageOptions: { parser: tseslint.parser },
    plugins: { sonarjs },
    rules: {
      complexity: ["error", 10],
      "max-depth": ["error", 4],
      "max-params": ["error", 3],
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
  {
    basePath: REPO_ROOT,
    files: [`${WEBVIEW}/**/*.{ts,tsx}`],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: {
      boundaries,
      "better-tailwindcss": betterTailwindcss,
      sonarjs,
      "import-x": importX,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: REPO_ROOT,
      },
    },
    settings: {
      "boundaries/root-path": REPO_ROOT,
      "boundaries/elements": [
        { type: "app", pattern: `${WEBVIEW}/app`, partialMatch: false },
        {
          type: "features",
          pattern: `${WEBVIEW}/features`,
          partialMatch: false,
        },
        { type: "shared", pattern: `${WEBVIEW}/shared`, partialMatch: false },
        { type: "testing", pattern: `${WEBVIEW}/testing`, partialMatch: false },
      ],
      "boundaries/files": [
        { pattern: "**/*.stories.{ts,tsx}", category: "story" },
      ],
      "better-tailwindcss": {
        entryPoint: `${REPO_ROOT}${WEBVIEW}/shared/styles/panel.css`,
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-autofocus": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: {
                to: { element: { types: ["app", "features", "shared"] } },
              },
            },
            {
              from: { element: { type: "features" } },
              allow: { to: { element: { types: ["features", "shared"] } } },
            },
            {
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: "shared" } } },
            },
            {
              from: { element: { type: "testing" } },
              allow: {
                to: { element: { types: ["features", "shared", "testing"] } },
              },
            },
            {
              from: { file: { categories: "story" } },
              allow: { to: { element: { type: "testing" } } },
            },
          ],
        },
      ],
      ...betterTailwindcss.configs["recommended-error"].rules,
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unknown-classes": [
        "error",
        { ignore: ["^mdmark-"] },
      ],
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              pattern: "\\[",
              message:
                "任意値の class は使用せず、トークンか @utility で記載する",
            },
          ],
        },
      ],
      "func-style": ["error", "expression"],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "enum は使用せず、文字列のユニオン型で記載する",
        },
      ],
      "import-x/no-default-export": "error",
    },
  },
  {
    basePath: REPO_ROOT,
    files: [`${WEBVIEW}/**/*.stories.{ts,tsx}`],
    rules: {
      "import-x/no-default-export": "off",
    },
  },
]);
