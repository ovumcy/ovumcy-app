import Constants from "expo-constants";
import { Platform } from "react-native";

import { selectAboutCopy } from "../i18n/about-copy";
import { DEJAVU_FONT_LICENSE_TEXT } from "./third-party-notices";

export type AboutSectionID = "license" | "fonts" | "components";

export type AboutViewData = {
  title: string;
  subtitle: string;
  backLabel: string;
  version: {
    title: string;
    value: string;
    hint: string;
  };
  sections: { id: AboutSectionID; title: string; body: string }[];
  fontLicense: {
    title: string;
    text: string;
  };
};

/** "1.0.0 (4)": the build number tells builds apart while the version stays. */
export function readAppVersion(): string | null {
  const config = Constants.expoConfig;
  if (!config?.version) {
    return null;
  }
  const build =
    Platform.OS === "ios" ? config.ios?.buildNumber : config.android?.versionCode;
  return build ? `${config.version} (${build})` : config.version;
}

export function buildAboutViewData(
  language: string | null | undefined,
  appVersion: string | null,
): AboutViewData {
  const copy = selectAboutCopy(language);

  return {
    title: copy.title,
    subtitle: copy.subtitle,
    backLabel: copy.backLabel,
    version: {
      title: copy.version.title,
      value: appVersion
        ? copy.version.value.replace("%s", appVersion)
        : copy.version.unknown,
      hint: copy.version.hint,
    },
    sections: [
      { id: "license", title: copy.license.title, body: copy.license.body },
      { id: "fonts", title: copy.fonts.title, body: copy.fonts.body },
      {
        id: "components",
        title: copy.components.title,
        body: copy.components.body,
      },
    ],
    fontLicense: {
      title: copy.fonts.licenseTextTitle,
      text: DEJAVU_FONT_LICENSE_TEXT,
    },
  };
}
