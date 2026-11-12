// The jest-expo preset is spread rather than named in `preset`, because Jest
// appends a preset's setupFiles to the config's and jest.setup-env.js has to
// replace them (see that file).
const expoPreset = require("jest-expo/jest-preset");

module.exports = {
  ...expoPreset,
  roots: ["<rootDir>/src"],
  setupFiles: ["<rootDir>/jest.setup-env.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Screen suites that exercise real key-stretching crypto (BIP39 PBKDF2,
  // recovery-phrase wrap) can exceed Jest's 5s default under the serial
  // `--runInBand` full run even though each passes in <1s in isolation.
  // Raise the ceiling so `npm test` stays deterministic; a genuine hang
  // still fails, just at 15s.
  testTimeout: 15000,
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.d.ts",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-native-svg|@noble/.*|@scure/.*|standard-navigation))",
  ],
};
