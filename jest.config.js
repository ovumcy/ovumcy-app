module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
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
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|react-native-svg|@noble/.*|@scure/.*))",
  ],
};
