import { getCalendarCopy } from "../i18n/calendar-copy";
import type {
  CalendarPredictionNoticeKey,
  DismissibleCalendarPredictionNoticeKey,
  ProfileRecord,
} from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";

// Discriminated on dismissalScope: dismissing a "persistent" notice writes its
// key into profile.dismissedCalendarPredictionNoticeKey and it never returns;
// the pregnancy-paused notice is "session" -- its dismissal is held in screen
// state only, so it reappears on the next screen mount and for any future
// pregnancy that suppresses predictions again.
export type CalendarPredictionNoticeViewData =
  | {
      dismissalScope: "persistent";
      dismissLabel: string;
      key: DismissibleCalendarPredictionNoticeKey;
      message: string;
    }
  | {
      dismissalScope: "session";
      dismissLabel: string;
      key: "calendar_pregnancy_paused_prediction_notice_v1";
      message: string;
    };

export function resolveCalendarPredictionNoticeKey(
  profile: Pick<ProfileRecord, "irregularCycle" | "unpredictableCycle">,
  options: { pregnancyActive?: boolean } = {},
): CalendarPredictionNoticeKey | null {
  // An active pregnancy outranks both mode notices: while it suppresses the
  // calendar's prediction cells, the irregular-mode copy ("Ovumcy still shows
  // predictions here") would be plainly false.
  if (options.pregnancyActive) {
    return "calendar_pregnancy_paused_prediction_notice_v1";
  }

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
  options: { pregnancyActive?: boolean } = {},
): CalendarPredictionNoticeViewData | null {
  const key = resolveCalendarPredictionNoticeKey(profile, options);
  if (!key) {
    return null;
  }

  if (key === "calendar_pregnancy_paused_prediction_notice_v1") {
    const copy = getCalendarCopy(locale);
    return {
      dismissalScope: "session",
      dismissLabel: copy.dismissNotice,
      key,
      message: copy.predictionPregnancyPaused,
    };
  }

  if (profile.dismissedCalendarPredictionNoticeKey === key) {
    return null;
  }

  const copy = getCalendarCopy(locale);
  return {
    dismissalScope: "persistent",
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
  key: DismissibleCalendarPredictionNoticeKey,
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
