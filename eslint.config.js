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
  // React Compiler advisories enabled by eslint-plugin-react-hooks 7. They
  // flag render-cascade and ref-timing patterns, not data or security bugs;
  // adopting them means refactoring the flagged components one by one, so the
  // exemption lists only the files that predate the rules.
  {
    files: [
      "src/ui/components/DayLogEditorCard.tsx",
      "src/ui/components/StatusBanner.tsx",
      "src/ui/providers/AppPreferencesProvider.tsx",
      "src/ui/screens/BackupSyncFlowScreen.tsx",
      "src/ui/screens/OnboardingScreen.tsx",
      "src/ui/screens/backup-sync/SettingsSyncSetupSection.tsx",
      "src/ui/screens/backup-sync/useBackupSyncSessionCore.ts",
      "src/ui/screens/day-log/use-day-log-autosave.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);
