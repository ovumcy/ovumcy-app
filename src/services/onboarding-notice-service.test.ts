import { createDefaultProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildOnboardingDayOneNotice,
  dismissOnboardingDayOneNotice,
} from "./onboarding-notice-service";

describe("onboarding-notice-service", () => {
  it("builds the day-one helper notice until it is dismissed", () => {
    expect(
      buildOnboardingDayOneNotice(createDefaultProfileRecord(), "en"),
    ).toEqual({
      dismissLabel: "Dismiss note",
      key: "onboarding_day1_tip_notice_v1",
      message: "Day 1 is the first day of full flow, not spotting.",
    });

    expect(
      buildOnboardingDayOneNotice(
        {
          ...createDefaultProfileRecord(),
          dismissedOnboardingHelperNoticeKey:
            "onboarding_day1_tip_notice_v1",
        },
        "en",
      ),
    ).toBeNull();
  });

  it("persists the dismissed helper note state", async () => {
    const storage = createLocalAppStorageMock();
    const profile = createDefaultProfileRecord();

    const nextProfile = await dismissOnboardingDayOneNotice(storage, profile);

    expect(nextProfile.dismissedOnboardingHelperNoticeKey).toBe(
      "onboarding_day1_tip_notice_v1",
    );
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        dismissedOnboardingHelperNoticeKey:
          "onboarding_day1_tip_notice_v1",
      }),
    );
  });
});
