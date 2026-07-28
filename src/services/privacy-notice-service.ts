import { openURL } from "expo-linking";

import { selectPrivacyNoticeCopy } from "../i18n/privacy-copy";
import type { InterfaceLanguage } from "../models/profile";

/**
 * Canonical public policy address. Kept as a module constant with no
 * interpolation: an external link must never be able to carry account, health,
 * or invite context out of the app (see SECURITY.md).
 */
export const PRIVACY_POLICY_URL = "https://ovumcy.com/privacy";

/** Bumped whenever the notice text below changes in a user-relevant way. */
export const PRIVACY_NOTICE_REVISION = "2026-07-28";

export type PrivacyNoticeSectionID =
  | "on-device"
  | "no-tracking"
  | "leaves-device"
  | "exports"
  | "rights"
  | "retention"
  | "predictions"
  | "contact";

export type PrivacyNoticeSectionViewData = {
  id: PrivacyNoticeSectionID;
  title: string;
  body: string;
};

export type PrivacyNoticeViewData = {
  title: string;
  subtitle: string;
  backLabel: string;
  revisionText: string;
  sections: PrivacyNoticeSectionViewData[];
  policyLink: {
    title: string;
    hint: string;
    actionLabel: string;
    unavailable: string;
    url: string;
  };
};

export function buildPrivacyNoticeViewData(
  language: InterfaceLanguage,
): PrivacyNoticeViewData {
  const copy = selectPrivacyNoticeCopy(language);

  return {
    title: copy.title,
    subtitle: copy.subtitle,
    backLabel: copy.backLabel,
    revisionText: `${copy.revisionLabel}: ${PRIVACY_NOTICE_REVISION}`,
    sections: [
      { id: "on-device", ...copy.sections.onDevice },
      { id: "no-tracking", ...copy.sections.noTracking },
      { id: "leaves-device", ...copy.sections.leavesDevice },
      { id: "exports", ...copy.sections.exports },
      { id: "rights", ...copy.sections.rights },
      { id: "retention", ...copy.sections.retention },
      { id: "predictions", ...copy.sections.predictions },
      { id: "contact", ...copy.sections.contact },
    ],
    policyLink: {
      title: copy.policyLink.title,
      hint: copy.policyLink.hint,
      actionLabel: copy.policyLink.actionLabel,
      unavailable: copy.policyLink.unavailable,
      url: PRIVACY_POLICY_URL,
    },
  };
}

/**
 * Hands the policy address to the platform browser. Resolves `false` when the
 * platform refuses (no browser, blocked pop-up) so the screen can fall back to
 * showing the address instead of failing silently.
 */
export async function openPrivacyPolicy(): Promise<boolean> {
  try {
    await openURL(PRIVACY_POLICY_URL);
    return true;
  } catch {
    return false;
  }
}
