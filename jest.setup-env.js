// Replaces the jest-expo preset's setupFiles. The React Native setup redefines
// `global.window`, which jsdom declares non-configurable, so suites that pin
// `@jest-environment jsdom` load the Expo web setup instead.
const preset = require("jest-expo/jest-preset");

// ICU's default locale has no environment switch on Windows (it follows the
// OS region format), so a locale-less Intl constructor or toLocale* call is
// given CI's en-US here. Without it the device-language fallback resolves to
// the runner's language and screen suites fail off CI.
const TEST_LOCALE = "en-US";

for (const name of [
  "Collator",
  "DateTimeFormat",
  "DisplayNames",
  "ListFormat",
  "NumberFormat",
  "PluralRules",
  "RelativeTimeFormat",
  "Segmenter",
]) {
  const Native = Intl[name];
  if (typeof Native !== "function") {
    continue;
  }
  function Pinned(locales, options) {
    return new Native(locales === undefined ? TEST_LOCALE : locales, options);
  }
  Pinned.prototype = Native.prototype;
  Pinned.supportedLocalesOf = Native.supportedLocalesOf.bind(Native);
  Intl[name] = Pinned;
}

for (const [proto, method, localesIndex] of [
  [Date.prototype, "toLocaleString", 0],
  [Date.prototype, "toLocaleDateString", 0],
  [Date.prototype, "toLocaleTimeString", 0],
  [Number.prototype, "toLocaleString", 0],
  [String.prototype, "localeCompare", 1],
]) {
  const native = proto[method];
  Object.defineProperty(proto, method, {
    configurable: true,
    writable: true,
    value: function (...args) {
      if (args[localesIndex] === undefined) {
        args[localesIndex] = TEST_LOCALE;
      }
      return native.apply(this, args);
    },
  });
}

if (typeof document !== "undefined") {
  require("jest-expo/src/preset/setup-web.js");
} else {
  for (const setupFile of preset.setupFiles) {
    require(setupFile);
  }
}
