import { getOnboardingCopy } from "../i18n/app-copy";
import type {
  OnboardingHelperNoticeKey,
  ProfileRecord,
} from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";

export type OnboardingNoticeViewData = {
  dismissLabel: string;
  key: OnboardingHelperNoticeKey;
  message: string;
};

const DAY_ONE_NOTICE_KEY: OnboardingHelperNoticeKey =
  "onboarding_day1_tip_notice_v1";

export function buildOnboardingDayOneNotice(
  profile: Pick<ProfileRecord, "dismissedOnboardingHelperNoticeKey">,
  locale: string,
): OnboardingNoticeViewData | null {
  if (profile.dismissedOnboardingHelperNoticeKey === DAY_ONE_NOTICE_KEY) {
    return null;
  }

  const copy = getOnboardingCopy(locale);

  return {
    dismissLabel: copy.step1.dismissTip,
    key: DAY_ONE_NOTICE_KEY,
    message: copy.step1.day1Tip,
  };
}

export async function dismissOnboardingDayOneNotice(
  storage: LocalAppStorage,
  profile: ProfileRecord,
): Promise<ProfileRecord> {
  if (profile.dismissedOnboardingHelperNoticeKey === DAY_ONE_NOTICE_KEY) {
    return profile;
  }

  const nextProfile: ProfileRecord = {
    ...profile,
    dismissedOnboardingHelperNoticeKey: DAY_ONE_NOTICE_KEY,
  };

  await storage.writeProfileRecord(nextProfile);
  return nextProfile;
}
