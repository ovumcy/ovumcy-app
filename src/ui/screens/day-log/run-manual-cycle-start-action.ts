import type { DayLogRecord } from "../../../models/day-log";
import type { ProfileRecord } from "../../../models/profile";
import {
  applyManualCycleStart,
  buildManualCycleStartViewData,
  listManualCycleStartPregnancyEndDates,
  type ManualCycleStartViewData,
} from "../../../services/manual-cycle-start-service";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";

type ConfirmManualCycleStartPrompt = (
  message: string,
  acceptLabel: string,
  cancelLabel: string,
) => Promise<boolean>;

type RunManualCycleStartActionOptions = {
  cancelLabel: string;
  confirmPrompt: ConfirmManualCycleStartPrompt;
  locale?: string;
  manualCycleStart: ManualCycleStartViewData;
  now: Date;
  profile: ProfileRecord;
  record: DayLogRecord;
  records: readonly DayLogRecord[];
  storage: LocalAppStorage;
};

type ManualCycleStartActionResult =
  | { ok: true; record: DayLogRecord }
  | { errorMessage: string; ok: false };

export async function runManualCycleStartAction({
  cancelLabel,
  confirmPrompt,
  locale = "en",
  manualCycleStart,
  now,
  profile,
  record,
  records,
  storage,
}: RunManualCycleStartActionOptions): Promise<ManualCycleStartActionResult | null> {
  let replaceExisting = false;
  let markUncertain = false;

  // The screen's view data is built without pregnancy end dates (a screen
  // load never reads the pregnancy tables), so the prompts are rebuilt here
  // with them, and apply checks the same input.
  const pregnancyEndDates = await listManualCycleStartPregnancyEndDates(storage);
  const prompts =
    buildManualCycleStartViewData(profile, records, record, now, locale, {
      pregnancyEndDates,
    })?.prompts ?? manualCycleStart.prompts;

  for (const prompt of prompts) {
    const confirmed = await confirmPrompt(
      prompt.message,
      prompt.acceptLabel,
      cancelLabel,
    );
    if (!confirmed) {
      return null;
    }

    if (prompt.kind === "replace_existing") {
      replaceExisting = true;
    }
    if (prompt.kind === "short_gap") {
      markUncertain = true;
    }
  }

  return applyManualCycleStart(
    storage,
    profile,
    records,
    record,
    now,
    locale,
    {
      markUncertain,
      pregnancyEndDates,
      replaceExisting,
    },
  );
}
