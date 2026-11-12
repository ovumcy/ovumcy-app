// Replaces the jest-expo preset's setupFiles. The React Native setup redefines
// `global.window`, which jsdom declares non-configurable, so suites that pin
// `@jest-environment jsdom` load the Expo web setup instead.
const preset = require("jest-expo/jest-preset");

if (typeof document !== "undefined") {
  require("jest-expo/src/preset/setup-web.js");
} else {
  for (const setupFile of preset.setupFiles) {
    require(setupFile);
  }
}
