import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Platform } from "react-native";

import { selectAboutCopy } from "../i18n/about-copy";
import { buildAboutViewData, readAppVersion } from "./about-view-service";
import { DEJAVU_FONT_LICENSE_TEXT } from "./third-party-notices";

const mockConstants: {
  expoConfig: {
    version?: string;
    android?: { versionCode?: number };
    ios?: { buildNumber?: string };
  } | null;
} = {
  expoConfig: { version: "1.2.3" },
};

jest.mock("expo-constants", () => ({
  __esModule: true,
  get default() {
    return mockConstants;
  },
}));

const LANGUAGES = ["en", "de", "fr", "ru", "es", "it"] as const;

describe("about-view-service", () => {
  afterEach(() => {
    mockConstants.expoConfig = { version: "1.2.3" };
    jest.restoreAllMocks();
  });

  it("reads the app version from the Expo config", () => {
    expect(readAppVersion()).toBe("1.2.3");
  });

  it("adds the platform build number to the version", () => {
    mockConstants.expoConfig = {
      version: "1.2.3",
      android: { versionCode: 4 },
      ios: { buildNumber: "7" },
    };

    jest.replaceProperty(Platform, "OS", "android");
    expect(readAppVersion()).toBe("1.2.3 (4)");

    jest.replaceProperty(Platform, "OS", "ios");
    expect(readAppVersion()).toBe("1.2.3 (7)");
  });

  it("reports no version when the Expo config carries none", () => {
    mockConstants.expoConfig = null;
    expect(readAppVersion()).toBeNull();

    mockConstants.expoConfig = {};
    expect(readAppVersion()).toBeNull();
  });

  it("builds a complete About page for every selectable language", () => {
    for (const language of LANGUAGES) {
      const viewData = buildAboutViewData(language, "1.0.0");

      expect(viewData.version.value).toBe("Ovumcy 1.0.0");
      expect(viewData.sections.map((section) => section.id)).toEqual([
        "license",
        "fonts",
        "components",
      ]);
      for (const section of viewData.sections) {
        expect(section.title.trim()).not.toBe("");
        expect(section.body.trim()).not.toBe("");
      }
      expect(viewData.sections[0]?.body).toContain("PolyForm Noncommercial");
      expect(viewData.sections[1]?.body).toContain("DejaVu Sans Condensed");
      expect(viewData.sections[1]?.body).toContain("Bitstream");
      expect(viewData.sections[1]?.body).toContain("Tavmjong Bah");
      expect(viewData.fontLicense.text).toBe(DEJAVU_FONT_LICENSE_TEXT);
    }
  });

  it("names the missing version instead of printing a placeholder", () => {
    const viewData = buildAboutViewData("ru", null);

    expect(viewData.version.value).toBe(selectAboutCopy("ru").version.unknown);
    expect(viewData.version.value).not.toContain("%s");
  });

  it("falls back to English for an unknown language", () => {
    expect(buildAboutViewData("xx", "1.0.0").title).toBe(selectAboutCopy("en").title);
  });

  it("ships the font licence shown in the app byte-equal to the bundled licence file", () => {
    const file = readFileSync(
      join(process.cwd(), "assets/fonts/LICENSE-DejaVu.txt"),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(DEJAVU_FONT_LICENSE_TEXT).toBe(file);
    expect(DEJAVU_FONT_LICENSE_TEXT).toContain(
      "Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved.",
    );
    expect(DEJAVU_FONT_LICENSE_TEXT).toContain(
      "Copyright (c) 2006 by Tavmjong Bah. All Rights Reserved.",
    );
  });
});
