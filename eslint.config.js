// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const tsParser = require("@typescript-eslint/parser");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      globals: { __dirname: "readonly" },
    },
  },
  // Type-aware promise safety: a lost `await` in the async storage/crypto/sync
  // layers is a silent data race that Jest's mocked timing rarely catches, so
  // it must fail lint instead of relying on review.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        // `onPress={async () => ...}` is idiomatic React Native; the risky
        // half of the rule (conditionals, spread args) stays on.
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
]);
