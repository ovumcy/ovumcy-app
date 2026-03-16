module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
