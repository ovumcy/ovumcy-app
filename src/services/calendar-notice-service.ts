import { getCalendarCopy } from "../i18n/calendar-copy";
import type {
  CalendarPredictionNoticeKey,
  ProfileRecord,
} from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";

export type CalendarPredictionNoticeViewData = {
  dismissLabel: string;
  key: CalendarPredictionNoticeKey;
  message: string;
};

export function resolveCalendarPredictionNoticeKey(
  profile: Pick<ProfileRecord, "irregularCycle" | "unpredictableCycle">,
): CalendarPredictionNoticeKey | null {
  if (profile.unpredictableCycle) {
    return "calendar_unpredictable_prediction_notice_v1";
  }

  if (profile.irregularCycle) {
    return "calendar_irregular_prediction_notice_v1";
  }

  return null;
}

export function buildCalendarPredictionNotice(
  profile: Pick<
    ProfileRecord,
    | "dismissedCalendarPredictionNoticeKey"
    | "irregularCycle"
    | "unpredictableCycle"
  >,
  locale: string,
): CalendarPredictionNoticeViewData | null {
  const key = resolveCalendarPredictionNoticeKey(profile);
  if (!key || profile.dismissedCalendarPredictionNoticeKey === key) {
    return null;
  }

  const copy = getCalendarCopy(locale);
  return {
    dismissLabel: copy.dismissNotice,
    key,
    message:
      key === "calendar_unpredictable_prediction_notice_v1"
        ? copy.predictionModeUnpredictable
        : copy.predictionModeIrregular,
  };
}

export async function dismissCalendarPredictionNotice(
  storage: LocalAppStorage,
  profile: ProfileRecord,
  key: CalendarPredictionNoticeKey,
): Promise<ProfileRecord> {
  if (profile.dismissedCalendarPredictionNoticeKey === key) {
    return profile;
  }

  const nextProfile: ProfileRecord = {
    ...profile,
    dismissedCalendarPredictionNoticeKey: key,
  };
  await storage.writeProfileRecord(nextProfile);
  return nextProfile;
}

export function resetDismissedCalendarPredictionNotice(
  previousProfile: Pick<
    ProfileRecord,
    | "dismissedCalendarPredictionNoticeKey"
    | "irregularCycle"
    | "unpredictableCycle"
  >,
  nextProfile: ProfileRecord,
): ProfileRecord {
  const previousKey = resolveCalendarPredictionNoticeKey(previousProfile);
  const nextKey = resolveCalendarPredictionNoticeKey(nextProfile);

  if (previousKey === nextKey) {
    return nextProfile;
  }

  return {
    ...nextProfile,
    dismissedCalendarPredictionNoticeKey: null,
  };
}
