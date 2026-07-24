import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { createPregnancyRecord } from "../../../models/pregnancy";
import { createPostpartumRecord } from "../../../models/postpartum";
import { createScreeningResponse } from "../../../models/screening";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { addDays, parseLocalDate } from "../../../services/profile-settings-policy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { getPregnancyEndCopy } from "../../../i18n/pregnancy-end-copy";
import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import { getPostpartumCopy } from "../../../i18n/postpartum-copy";
import { getScreeningCopy } from "../../../i18n/screening-copy";
import { openConfirmation } from "../../confirm/open-confirmation";
import {
  PregnancyEndScreen,
  resolveUpdateDueDatePrefill,
  resolveUpdateEddError,
} from "./PregnancyEndScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}));

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn(),
}));

// The default-wiring smoke renders without an injected storage; the real
// appStorage is the SQLite adapter, which has no backing database under Jest,
// so the bootstrap module resolves to an empty storage mock instead.
jest.mock("../../../services/app-bootstrap-service", () => {
  const { createLocalAppStorageMock } = jest.requireActual(
    "../../../test/create-local-app-storage-mock",
  );
  return { appStorage: createLocalAppStorageMock() };
});

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockChallenge = jest.mocked(requestSensitiveActionChallenge);

const EDD = "2026-10-08";

function activeRecord() {
  return createPregnancyRecord({
    edd: EDD,
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
  });
}

function endedRecord() {
  return {
    ...activeRecord(),
    status: "ended" as const,
    endedAt: "2026-05-01",
    endReason: "birth" as const,
    modeOfDelivery: null,
  };
}

// `now` (Date) that makes calcGestationalAge(EDD, formatLocalDate(now))
// report `gaDays`, mirroring pregnancy-timeline-service.test.ts's identical
// helper.
function nowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(EDD)!, gaDays - 280);
}

// loadPostpartumUnlocked defaults to LOCKED so every pre-existing birth
// test navigates to the dashboard exactly as before; postpartum-offer tests
// inject an unlocked resolver explicitly.
function renderEnd(
  storage = createLocalAppStorageMock(),
  reasonParam?: string,
  now: Date = new Date(2026, 5, 15),
  loadPostpartumUnlocked: () => Promise<boolean> = () => Promise.resolve(false),
) {
  return render(
    <AppPreferencesTestProvider languageOverride="en">
      <PregnancyEndScreen
        now={now}
        reasonParam={reasonParam}
        storage={storage}
        loadPostpartumUnlocked={loadPostpartumUnlocked}
      />
    </AppPreferencesTestProvider>,
  );
}

const unlocked = () => Promise.resolve(true);

// Stateful storage so the after-birth offer flow works end-to-end: the birth
// end writes the ended record, and the subsequent startPostpartumFromBirth
// reads it back to derive the postpartum record.
function statefulBirthStorage() {
  let pregnancyRecords = [activeRecord()];
  const postpartumWrites: unknown[] = [];
  const storage = createLocalAppStorageMock({
    readActivePregnancy: jest.fn(
      async () => pregnancyRecords.find((r) => r.status === "active") ?? null,
    ),
    listPregnancyRecords: jest.fn(async () => pregnancyRecords),
    writePregnancyRecord: jest.fn(async (rec) => {
      pregnancyRecords = pregnancyRecords.map((r) => (r.id === rec.id ? rec : r));
    }),
    readActivePostpartum: jest.fn().mockResolvedValue(null),
    writePostpartumRecord: jest.fn(async (rec) => {
      postpartumWrites.push(rec);
    }),
  });
  return { storage, postpartumWrites };
}

function activeStorage() {
  const active = activeRecord();
  return createLocalAppStorageMock({
    readActivePregnancy: jest.fn().mockResolvedValue(active),
    listPregnancyRecords: jest.fn().mockResolvedValue([active]),
  });
}

// Multiples: a twins active record, for the plural birth-congratulations
// copy matrix.
function twinsActiveRecord() {
  return createPregnancyRecord({
    edd: EDD,
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
    fetusCount: 2,
  });
}

function twinsActiveStorage() {
  const active = twinsActiveRecord();
  return createLocalAppStorageMock({
    readActivePregnancy: jest.fn().mockResolvedValue(active),
    listPregnancyRecords: jest.fn().mockResolvedValue([active]),
  });
}

describe("PregnancyEndScreen", () => {
  afterEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
    mockOpenConfirmation.mockReset();
    mockChallenge.mockReset();
  });

  it("ends a birth with the chosen mode of delivery and navigates to the dashboard", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = activeStorage();
    renderEnd(storage, "birth");

    fireEvent.press(await screen.findByTestId("pregnancy-end-mode-cesarean"));
    fireEvent.press(screen.getByTestId("pregnancy-end-confirm-button"));

    await waitFor(() =>
      expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ended",
          endReason: "birth",
          modeOfDelivery: "cesarean",
        }),
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("ends a birth with a null mode of delivery when the question is skipped", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = activeStorage();
    renderEnd(storage, "birth");

    // No mode selected — the default is "skip" (null).
    fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));

    await waitFor(() =>
      expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ended",
          endReason: "birth",
          modeOfDelivery: null,
        }),
      ),
    );
  });

  describe("multiples: plural birth congratulations", () => {
    it("renders the singular congratulations and mode question for a singleton active pregnancy (unchanged)", async () => {
      renderEnd(activeStorage(), "birth");

      const congratulations = await screen.findByTestId(
        "pregnancy-end-birth-congratulations",
      );
      expect(congratulations.props.children).toBe(
        "Congratulations on your new arrival. When you're ready, you can switch Ovumcy back to cycle tracking.",
      );
      expect(screen.getByText("How was your baby born?")).toBeTruthy();
    });

    it("renders the plural congratulations and mode question when the active pregnancy is twins+", async () => {
      renderEnd(twinsActiveStorage(), "birth");

      const congratulations = await screen.findByTestId(
        "pregnancy-end-birth-congratulations",
      );
      expect(congratulations.props.children).toBe(
        "Congratulations on your new arrivals. When you're ready, you can switch Ovumcy back to cycle tracking.",
      );
      expect(screen.getByText("How were your babies born?")).toBeTruthy();
    });

    it("keeps loss copy untouched for a twins+ active pregnancy (no plural variant)", async () => {
      mockOpenConfirmation.mockResolvedValue(true);
      renderEnd(twinsActiveStorage(), "loss");

      const acknowledgment = await screen.findByTestId(
        "pregnancy-end-acknowledgment",
      );
      expect(acknowledgment.props.children).toBe(
        "We're sorry you're going through this.",
      );
    });
  });

  it("renders neutral loss copy and ends with reason 'loss' (no mode question)", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = activeStorage();
    renderEnd(storage, "loss");

    const acknowledgment = await screen.findByTestId(
      "pregnancy-end-acknowledgment",
    );
    expect(acknowledgment.props.children).toBe(
      "We're sorry you're going through this.",
    );
    // No mode-of-delivery question on the loss path.
    expect(screen.queryByTestId("pregnancy-end-mode-vaginal")).toBeNull();

    fireEvent.press(screen.getByTestId("pregnancy-end-confirm-button"));

    await waitFor(() =>
      expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
        expect.objectContaining({ endReason: "loss", modeOfDelivery: null }),
      ),
    );
  });

  it("keeps tracking when the confirm dialog is dismissed (service not called)", async () => {
    // A dialog dismissal / cancel resolves to false — the destructive end must
    // NOT run.
    mockOpenConfirmation.mockResolvedValue(false);
    const storage = activeStorage();
    renderEnd(storage, "loss");

    fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalled());
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("offers all three reasons on the manage screen, including birth pre-term", async () => {
    // now = 2026-06-15 with EDD 2026-10-08 → ~week 23 (well before the term
    // CTA appears on the dashboard, but at/above the week-20 birth-option
    // threshold — see BIRTH_OPTION_MIN_WEEK): the manage route offers the
    // birth path from week 20 onward, well before the dashboard's own
    // prominent term CTA — it is the path for preterm births past that
    // point (see the "birth option visibility" suite below for the
    // below-threshold case).
    const storage = activeStorage();
    renderEnd(storage);

    expect(await screen.findByTestId("pregnancy-end-reason-birth")).toBeTruthy();
    expect(screen.getByTestId("pregnancy-end-reason-loss")).toBeTruthy();
    expect(screen.getByTestId("pregnancy-end-reason-other")).toBeTruthy();

    fireEvent.press(screen.getByTestId("pregnancy-end-reason-birth"));
    expect(await screen.findByTestId("pregnancy-end-birth-card")).toBeTruthy();

    // Back returns to the choice screen; the loss path opens the same way.
    fireEvent.press(screen.getByTestId("pregnancy-end-back-button"));
    fireEvent.press(await screen.findByTestId("pregnancy-end-reason-loss"));
    expect(await screen.findByTestId("pregnancy-end-loss-card")).toBeTruthy();
  });

  it("gates hard delete behind device auth — a failed challenge does not delete", async () => {
    mockChallenge.mockResolvedValue({ ok: false, reason: "failed" });
    const storage = activeStorage();
    renderEnd(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-end-delete-button"));

    await waitFor(() => expect(mockChallenge).toHaveBeenCalled());
    expect(storage.deleteAllPregnancyData).not.toHaveBeenCalled();
    expect(mockOpenConfirmation).not.toHaveBeenCalled();
    expect(await screen.findByTestId("pregnancy-end-delete-error")).toBeTruthy();
  });

  it("hard-deletes after device auth and an explicit confirm, then navigates back", async () => {
    mockChallenge.mockResolvedValue({ ok: true });
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = activeStorage();
    renderEnd(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-end-delete-button"));

    await waitFor(() =>
      expect(storage.deleteAllPregnancyData).toHaveBeenCalledTimes(1),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it("does not delete when the confirm dialog is dismissed after device auth", async () => {
    mockChallenge.mockResolvedValue({ ok: true });
    mockOpenConfirmation.mockResolvedValue(false);
    const storage = activeStorage();
    renderEnd(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-end-delete-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalled());
    expect(storage.deleteAllPregnancyData).not.toHaveBeenCalled();
  });

  it("shows the management + delete state when no pregnancy is active but ended records exist", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listPregnancyRecords: jest.fn().mockResolvedValue([endedRecord()]),
    });
    renderEnd(storage);

    expect(await screen.findByTestId("pregnancy-end-manage-card")).toBeTruthy();
    expect(screen.getByTestId("pregnancy-end-delete-button")).toBeTruthy();
    // No end-flow choices without an active pregnancy.
    expect(screen.queryByTestId("pregnancy-end-choice-card")).toBeNull();
  });

  it("shows the empty state when there is no pregnancy data at all", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listPregnancyRecords: jest.fn().mockResolvedValue([]),
    });
    renderEnd(storage);

    expect(await screen.findByTestId("pregnancy-end-empty-body")).toBeTruthy();
    expect(screen.queryByTestId("pregnancy-end-delete-button")).toBeNull();
  });

  it("renders the pregnancy disclaimer on the end screen", async () => {
    renderEnd(activeStorage());
    expect(await screen.findByTestId("pregnancy-end-disclaimer")).toBeTruthy();
  });

  describe("birth option visibility (CHANGE 2, week-20 loss-taxonomy gate)", () => {
    it("hides the birth option at 19+6, keeping loss and other", async () => {
      renderEnd(activeStorage(), undefined, nowForGaDays(19 * 7 + 6));

      await screen.findByTestId("pregnancy-end-choice-card");
      expect(screen.queryByTestId("pregnancy-end-reason-birth")).toBeNull();
      expect(screen.getByTestId("pregnancy-end-reason-loss")).toBeTruthy();
      expect(screen.getByTestId("pregnancy-end-reason-other")).toBeTruthy();
    });

    it("shows all three reasons at 20+0", async () => {
      renderEnd(activeStorage(), undefined, nowForGaDays(20 * 7));

      expect(await screen.findByTestId("pregnancy-end-reason-birth")).toBeTruthy();
      expect(screen.getByTestId("pregnancy-end-reason-loss")).toBeTruthy();
      expect(screen.getByTestId("pregnancy-end-reason-other")).toBeTruthy();
    });

    it("falls the birth deep link back to the choice screen below week 20, never the congratulations card", async () => {
      renderEnd(activeStorage(), "birth", nowForGaDays(19 * 7 + 6));

      await screen.findByTestId("pregnancy-end-choice-card");
      expect(screen.queryByTestId("pregnancy-end-birth-card")).toBeNull();
      expect(screen.queryByTestId("pregnancy-end-birth-congratulations")).toBeNull();
      expect(screen.queryByTestId("pregnancy-end-reason-birth")).toBeNull();
    });

    it("still honors the birth deep link at 20+0 (at the threshold)", async () => {
      renderEnd(activeStorage(), "birth", nowForGaDays(20 * 7));

      expect(await screen.findByTestId("pregnancy-end-birth-card")).toBeTruthy();
    });
  });

  describe("update due date(clinician re-dating)", () => {
    it("shows the row only while a pregnancy is active", async () => {
      renderEnd(activeStorage());
      expect(
        await screen.findByTestId("pregnancy-end-update-due-date-row"),
      ).toBeTruthy();
    });

    it("hides the row when no pregnancy is active (manage/empty states)", async () => {
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([endedRecord()]),
      });
      renderEnd(storage);

      await screen.findByTestId("pregnancy-end-manage-card");
      expect(
        screen.queryByTestId("pregnancy-end-update-due-date-row"),
      ).toBeNull();
    });

    it("prefills the current edd, then updates it end-to-end and navigates to the dashboard", async () => {
      const active = activeRecord();
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(active),
        listPregnancyRecords: jest.fn().mockResolvedValue([active]),
      });
      renderEnd(storage);

      fireEvent.press(
        await screen.findByTestId("pregnancy-end-update-due-date-row"),
      );

      const dateInput = await screen.findByTestId(
        "pregnancy-end-update-due-date-input",
      );
      // Prefilled from the active record's current edd.
      expect(dateInput.props.value).toBe(EDD);

      fireEvent.press(
        screen.getByTestId("pregnancy-end-update-due-date-basis-manual"),
      );
      fireEvent.changeText(dateInput, "2026-11-05");
      fireEvent.press(
        screen.getByTestId("pregnancy-end-update-due-date-confirm-button"),
      );

      await waitFor(() =>
        expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
          expect.objectContaining({
            // Identity/history fields carry over untouched; only edd/eddBasis change.
            id: active.id,
            startedAt: active.startedAt,
            status: "active",
            edd: "2026-11-05",
            eddBasis: "manual",
          }),
        ),
      );
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });

    it("returns to the choice screen when cancelled, without saving", async () => {
      const storage = activeStorage();
      renderEnd(storage);

      fireEvent.press(
        await screen.findByTestId("pregnancy-end-update-due-date-row"),
      );
      await screen.findByTestId("pregnancy-end-update-due-date-step");

      fireEvent.press(
        screen.getByTestId("pregnancy-end-update-due-date-back-button"),
      );

      expect(await screen.findByTestId("pregnancy-end-choice-card")).toBeTruthy();
      expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    });

    it("shows a validation error for an out-of-range date and does not save", async () => {
      const storage = activeStorage();
      renderEnd(storage);

      fireEvent.press(
        await screen.findByTestId("pregnancy-end-update-due-date-row"),
      );
      const dateInput = await screen.findByTestId(
        "pregnancy-end-update-due-date-input",
      );
      fireEvent.changeText(dateInput, "2028-01-01");
      fireEvent.press(
        screen.getByTestId("pregnancy-end-update-due-date-confirm-button"),
      );

      expect(
        await screen.findByTestId("pregnancy-end-update-due-date-error"),
      ).toBeTruthy();
      expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    });
  });

  describe("postpartum offer + management", () => {
    it("offers postpartum tracking after a confirmed birth when premium is unlocked, and starts it with the copied mode of delivery", async () => {
      mockOpenConfirmation.mockResolvedValue(true);
      const { storage, postpartumWrites } = statefulBirthStorage();
      renderEnd(storage, "birth", new Date(2026, 5, 15), unlocked);

      fireEvent.press(await screen.findByTestId("pregnancy-end-mode-cesarean"));
      fireEvent.press(screen.getByTestId("pregnancy-end-confirm-button"));

      // The offer step appears instead of navigating straight to the dashboard.
      await screen.findByTestId("pregnancy-end-postpartum-offer-card");
      expect(mockReplace).not.toHaveBeenCalled();

      fireEvent.press(screen.getByTestId("pregnancy-end-postpartum-offer-start"));

      await waitFor(() => expect(postpartumWrites).toHaveLength(1));
      expect(postpartumWrites[0]).toEqual(
        expect.objectContaining({
          status: "active",
          // startedAt copied from the birth's endedAt (today), mode copied.
          startedAt: "2026-06-15",
          modeOfDelivery: "cesarean",
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });

    it("declining the offer leaves no postpartum record and goes to the dashboard", async () => {
      mockOpenConfirmation.mockResolvedValue(true);
      const { storage, postpartumWrites } = statefulBirthStorage();
      renderEnd(storage, "birth", new Date(2026, 5, 15), unlocked);

      fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));
      fireEvent.press(
        await screen.findByTestId("pregnancy-end-postpartum-offer-decline"),
      );

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard"),
      );
      expect(postpartumWrites).toHaveLength(0);
      expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
    });

    it("never offers postpartum after a loss, even when premium is unlocked (rule B8)", async () => {
      mockOpenConfirmation.mockResolvedValue(true);
      const storage = activeStorage();
      renderEnd(storage, "loss", new Date(2026, 5, 15), unlocked);

      fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard"),
      );
      expect(
        screen.queryByTestId("pregnancy-end-postpartum-offer-card"),
      ).toBeNull();
      expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
    });

    it("goes straight to the dashboard after a birth when premium is locked (offer gated)", async () => {
      mockOpenConfirmation.mockResolvedValue(true);
      const storage = activeStorage();
      renderEnd(storage, "birth"); // default loadPostpartumUnlocked = locked

      fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard"),
      );
      expect(
        screen.queryByTestId("pregnancy-end-postpartum-offer-card"),
      ).toBeNull();
    });

    it("never shows the offer on a bare ?reason=birth deep link (needs a just-confirmed birth in-session)", async () => {
      renderEnd(activeStorage(), "birth", new Date(2026, 5, 15), unlocked);

      // The birth confirm step renders; the offer only appears AFTER confirming.
      expect(await screen.findByTestId("pregnancy-end-birth-card")).toBeTruthy();
      expect(
        screen.queryByTestId("pregnancy-end-postpartum-offer-card"),
      ).toBeNull();
    });

    it("offers a delayed start on the manage screen only within the 8-week window and unlocked", async () => {
      // Recent ended birth (endedAt 2026-05-01, ~45 days before now) + unlocked.
      const recent = {
        ...endedRecord(),
        endedAt: "2026-05-01",
        endReason: "birth" as const,
      };
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([recent]),
      });
      renderEnd(storage, undefined, new Date(2026, 5, 15), unlocked);

      expect(
        await screen.findByTestId("pregnancy-end-postpartum-start-card"),
      ).toBeTruthy();
    });

    it("hides the delayed start beyond the 8-week window", async () => {
      const old = {
        ...endedRecord(),
        endedAt: "2026-01-01", // > 8 weeks before now
        endReason: "birth" as const,
      };
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([old]),
      });
      renderEnd(storage, undefined, new Date(2026, 5, 15), unlocked);

      await screen.findByTestId("pregnancy-end-manage-card");
      expect(
        screen.queryByTestId("pregnancy-end-postpartum-start-card"),
      ).toBeNull();
    });

    it("hides the delayed start within the window when premium is locked", async () => {
      const recent = {
        ...endedRecord(),
        endedAt: "2026-05-01",
        endReason: "birth" as const,
      };
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([recent]),
      });
      renderEnd(storage, undefined, new Date(2026, 5, 15)); // locked

      await screen.findByTestId("pregnancy-end-manage-card");
      expect(
        screen.queryByTestId("pregnancy-end-postpartum-start-card"),
      ).toBeNull();
    });

    it("shows End + Delete rows when a postpartum is active and ends it on confirm", async () => {
      mockOpenConfirmation.mockResolvedValue(true);
      const active = createPostpartumRecord({
        startedAt: "2026-06-01",
        modeOfDelivery: "vaginal",
      });
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([]),
        readActivePostpartum: jest.fn().mockResolvedValue(active),
        listPostpartumRecords: jest.fn().mockResolvedValue([active]),
      });
      renderEnd(storage);

      fireEvent.press(
        await screen.findByTestId("pregnancy-end-postpartum-end-button"),
      );

      await waitFor(() =>
        expect(storage.writePostpartumRecord).toHaveBeenCalledWith(
          expect.objectContaining({ status: "ended", endReason: "manual" }),
        ),
      );
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
      // The delete danger action is available too.
      expect(
        screen.getByTestId("pregnancy-end-postpartum-delete-card"),
      ).toBeTruthy();
    });

    it("hard-deletes postpartum data behind device auth + confirm, leaving pregnancy delete separate", async () => {
      mockChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      const active = createPostpartumRecord({ startedAt: "2026-06-01" });
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([]),
        readActivePostpartum: jest.fn().mockResolvedValue(active),
        listPostpartumRecords: jest.fn().mockResolvedValue([active]),
      });
      renderEnd(storage);

      fireEvent.press(
        await screen.findByTestId("pregnancy-end-postpartum-delete-button"),
      );

      await waitFor(() =>
        expect(storage.deleteAllPostpartumData).toHaveBeenCalledTimes(1),
      );
      // Postpartum delete does not touch the pregnancy data class.
      expect(storage.deleteAllPregnancyData).not.toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });

    it("hard-deletes screening data behind device auth + confirm, separate from postpartum", async () => {
      mockChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      const active = createPostpartumRecord({ startedAt: "2026-06-01" });
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([]),
        readActivePostpartum: jest.fn().mockResolvedValue(active),
        listPostpartumRecords: jest.fn().mockResolvedValue([active]),
        listScreeningResponses: jest.fn().mockResolvedValue([
          createScreeningResponse({
            date: "2026-06-15",
            answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          }),
        ]),
      });
      renderEnd(storage);

      fireEvent.press(
        await screen.findByTestId("pregnancy-end-screening-delete-button"),
      );

      await waitFor(() =>
        expect(storage.deleteAllScreeningData).toHaveBeenCalledTimes(1),
      );
      // Screening delete is its own class — it never touches postpartum or
      // pregnancy data.
      expect(storage.deleteAllPostpartumData).not.toHaveBeenCalled();
      expect(storage.deleteAllPregnancyData).not.toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });

    it("does not delete screening data when the device-auth gate is unavailable", async () => {
      mockChallenge.mockResolvedValue({ ok: false, reason: "unavailable" });
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listPregnancyRecords: jest.fn().mockResolvedValue([]),
        listScreeningResponses: jest.fn().mockResolvedValue([
          createScreeningResponse({
            date: "2026-06-15",
            answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          }),
        ]),
      });
      renderEnd(storage);

      fireEvent.press(
        await screen.findByTestId("pregnancy-end-screening-delete-button"),
      );

      await screen.findByTestId("pregnancy-end-screening-delete-error");
      expect(storage.deleteAllScreeningData).not.toHaveBeenCalled();
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
    });
  });
describe("failure and device-auth paths", () => {
  it("surfaces a failed end without leaving the screen", async () => {
    mockOpenConfirmation.mockResolvedValueOnce(true);
    const storage = activeStorage();
    (storage.writePregnancyRecord as jest.Mock).mockRejectedValue(new Error("busy"));
    renderEnd(storage, "birth");

    fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));

    expect(
      await screen.findByText(getPregnancyEndCopy("en").status.endFailed),
    ).toBeTruthy();
  });

  it("surfaces a failed postpartum start on the post-birth offer", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const { storage } = statefulBirthStorage();
    (storage.writePostpartumRecord as jest.Mock).mockRejectedValue(
      new Error("busy"),
    );
    renderEnd(storage, "birth", new Date(2026, 5, 15), unlocked);

    fireEvent.press(await screen.findByTestId("pregnancy-end-mode-cesarean"));
    fireEvent.press(screen.getByTestId("pregnancy-end-confirm-button"));
    await screen.findByTestId("pregnancy-end-postpartum-offer-card");
    fireEvent.press(screen.getByTestId("pregnancy-end-postpartum-offer-start"));

    expect(
      await screen.findByText(getPostpartumCopy("en").status.startFailed),
    ).toBeTruthy();
  });

  it("covers the 'other' reason path, cancel, and both end-postpartum sides", async () => {
    mockOpenConfirmation.mockResolvedValue(false);
    const storage = activeStorage();
    renderEnd(storage, "other");

    // Declined confirm keeps the pregnancy.
    fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();

    // Back returns to the reason choice; cancel there leaves the screen.
    fireEvent.press(screen.getByTestId("pregnancy-end-back-button"));
    fireEvent.press(await screen.findByTestId("pregnancy-end-choice-cancel-button"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("ends an active postpartum from the manage surface, then surfaces a failure on retry", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const write = jest.fn().mockRejectedValue(new Error("busy"));
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue({
          id: "pp_active",
          status: "active",
          startedAt: "2026-05-01",
          modeOfDelivery: null,
          endedAt: null,
          endReason: null,
        }),
      listPostpartumRecords: jest.fn().mockResolvedValue([{
          id: "pp_active",
          status: "active",
          startedAt: "2026-05-01",
          modeOfDelivery: null,
          endedAt: null,
          endReason: null,
        }]),
      writePostpartumRecord: write,
    });
    renderEnd(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-end-postpartum-end-button"));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByTestId("pregnancy-end-postpartum-error"),
    ).toBeTruthy();
  });

  it("keeps postpartum when the manage-surface end confirm is declined", async () => {
    mockOpenConfirmation.mockResolvedValue(false);
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue({
        id: "pp_active",
        status: "active",
        startedAt: "2026-05-01",
        modeOfDelivery: null,
        endedAt: null,
        endReason: null,
      }),
      listPostpartumRecords: jest.fn().mockResolvedValue([{
        id: "pp_active",
        status: "active",
        startedAt: "2026-05-01",
        modeOfDelivery: null,
        endedAt: null,
        endReason: null,
      }]),
    });
    renderEnd(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-end-postpartum-end-button"));
    await act(async () => {});
    expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
  });

  it("maps the pregnancy hard-delete auth and storage failures", async () => {
    const storage = activeStorage();
    (storage.deleteAllPregnancyData as jest.Mock).mockRejectedValue(
      new Error("busy"),
    );
    const del = getPregnancyEndCopy("en").delete;
    renderEnd(storage);

    mockChallenge.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    fireEvent.press(await screen.findByTestId("pregnancy-end-delete-button"));
    expect(await screen.findByText(del.status.deviceAuthUnavailable)).toBeTruthy();

    mockChallenge.mockResolvedValueOnce({ ok: true });
    mockOpenConfirmation.mockResolvedValueOnce(true);
    fireEvent.press(screen.getByTestId("pregnancy-end-delete-button"));
    expect(await screen.findByText(del.status.failed)).toBeTruthy();
  });

  it("maps the update-due-date validation errors through the shared wizard copy", async () => {
    const storage = activeStorage();
    (storage.writePregnancyRecord as jest.Mock).mockRejectedValue(
      new Error("busy"),
    );
    const validation = getPregnancyCopy("en").wizard.validation;
    renderEnd(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-end-update-due-date-row"));
    const input = await screen.findByTestId("pregnancy-end-update-due-date-input");

    fireEvent.changeText(input, "");
    fireEvent.press(screen.getByTestId("pregnancy-end-update-due-date-confirm-button"));
    expect(await screen.findByText(validation.missingDate)).toBeTruthy();

    fireEvent.changeText(input, "2026-99-99");
    fireEvent.press(screen.getByTestId("pregnancy-end-update-due-date-confirm-button"));
    expect(await screen.findByText(validation.invalidDate)).toBeTruthy();

    fireEvent.changeText(input, "2026-11-05");
    fireEvent.press(screen.getByTestId("pregnancy-end-update-due-date-confirm-button"));
    expect(await screen.findByText(validation.saveFailed)).toBeTruthy();
  });


  it("maps every device-auth outcome for the postpartum delete", async () => {
    const storage = createLocalAppStorageMock({
      listPostpartumRecords: jest.fn().mockResolvedValue([
        {
          id: "pp1",
          status: "ended",
          startedAt: "2026-01-01",
          modeOfDelivery: null,
          endedAt: "2026-03-01",
          endReason: "manual",
        },
      ]),
    });
    const del = getPostpartumCopy("en").delete;
    renderEnd(storage);

    mockChallenge.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    fireEvent.press(await screen.findByTestId("pregnancy-end-postpartum-delete-button"));
    expect(await screen.findByText(del.status.deviceAuthUnavailable)).toBeTruthy();

    mockChallenge.mockResolvedValueOnce({ ok: false, reason: "failed" });
    fireEvent.press(screen.getByTestId("pregnancy-end-postpartum-delete-button"));
    expect(await screen.findByText(del.status.deviceAuthFailed)).toBeTruthy();

    mockChallenge.mockResolvedValueOnce({ ok: true });
    mockOpenConfirmation.mockResolvedValueOnce(true);
    (storage.deleteAllPostpartumData as jest.Mock).mockRejectedValue(new Error("busy"));
    fireEvent.press(screen.getByTestId("pregnancy-end-postpartum-delete-button"));
    expect(await screen.findByText(del.status.failed)).toBeTruthy();
  });

  it("maps device-auth failure and storage failure for the screening delete", async () => {
    const storage = createLocalAppStorageMock({
      listScreeningResponses: jest.fn().mockResolvedValue([
        {
          id: "s1",
          date: "2026-03-01",
          instrument: "epds",
          answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          score: 0,
          selfHarmFlag: false,
        },
      ]),
    });
    const del = getScreeningCopy("en").delete;
    renderEnd(storage);

    mockChallenge.mockResolvedValueOnce({ ok: false, reason: "failed" });
    fireEvent.press(await screen.findByTestId("pregnancy-end-screening-delete-button"));
    expect(await screen.findByText(del.status.deviceAuthFailed)).toBeTruthy();

    mockChallenge.mockResolvedValueOnce({ ok: true });
    mockOpenConfirmation.mockResolvedValueOnce(true);
    (storage.deleteAllScreeningData as jest.Mock).mockRejectedValue(new Error("busy"));
    fireEvent.press(screen.getByTestId("pregnancy-end-screening-delete-button"));
    expect(await screen.findByText(del.status.failed)).toBeTruthy();
  });
});

describe("handler edges", () => {
  it("selecting Skip after a mode clears it back to null on the persisted record", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = activeStorage();
    renderEnd(storage, "birth");

    fireEvent.press(await screen.findByTestId("pregnancy-end-mode-vaginal"));
    fireEvent.press(screen.getByTestId("pregnancy-end-mode-skip"));
    fireEvent.press(screen.getByTestId("pregnancy-end-confirm-button"));

    await waitFor(() =>
      expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
        expect.objectContaining({ endReason: "birth", modeOfDelivery: null }),
      ),
    );
  });

  it("surfaces a failed loss ending on the loss step", async () => {
    mockOpenConfirmation.mockResolvedValueOnce(true);
    const storage = activeStorage();
    (storage.writePregnancyRecord as jest.Mock).mockRejectedValue(
      new Error("busy"),
    );
    renderEnd(storage, "loss");

    fireEvent.press(await screen.findByTestId("pregnancy-end-confirm-button"));

    expect(
      await screen.findByText(getPregnancyEndCopy("en").status.endFailed),
    ).toBeTruthy();
  });

  it("surfaces a failed delayed postpartum start on its manage card", async () => {
    const recent = {
      ...endedRecord(),
      endedAt: "2026-05-01",
      endReason: "birth" as const,
    };
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listPregnancyRecords: jest.fn().mockResolvedValue([recent]),
      writePostpartumRecord: jest.fn().mockRejectedValue(new Error("busy")),
    });
    renderEnd(storage, undefined, new Date(2026, 5, 15), unlocked);

    fireEvent.press(
      await screen.findByTestId("pregnancy-end-postpartum-start-button"),
    );

    expect(
      await screen.findByText(getPostpartumCopy("en").status.startFailed),
    ).toBeTruthy();
    expect(
      screen.getByTestId("pregnancy-end-postpartum-start-card"),
    ).toBeTruthy();
  });

  it("stays silent when the pregnancy-delete device-auth challenge is cancelled", async () => {
    mockChallenge.mockResolvedValue({ ok: false, reason: "cancelled" });
    const storage = activeStorage();
    renderEnd(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-end-delete-button"));

    await waitFor(() => expect(mockChallenge).toHaveBeenCalled());
    expect(mockOpenConfirmation).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pregnancy-end-delete-error")).toBeNull();
  });

  it("stays silent when the postpartum and screening delete challenges are cancelled", async () => {
    mockChallenge.mockResolvedValue({ ok: false, reason: "cancelled" });
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listPostpartumRecords: jest
        .fn()
        .mockResolvedValue([createPostpartumRecord({ startedAt: "2026-04-01" })]),
      listScreeningResponses: jest.fn().mockResolvedValue([
        createScreeningResponse({
          date: "2026-06-01",
          answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }),
      ]),
    });
    renderEnd(storage);

    fireEvent.press(
      await screen.findByTestId("pregnancy-end-postpartum-delete-button"),
    );
    fireEvent.press(
      screen.getByTestId("pregnancy-end-screening-delete-button"),
    );

    await waitFor(() => expect(mockChallenge).toHaveBeenCalledTimes(2));
    expect(mockOpenConfirmation).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("pregnancy-end-postpartum-delete-error"),
    ).toBeNull();
    expect(
      screen.queryByTestId("pregnancy-end-screening-delete-error"),
    ).toBeNull();
  });

  it("keeps postpartum and screening data when their delete confirms are declined", async () => {
    mockChallenge.mockResolvedValue({ ok: true });
    mockOpenConfirmation.mockResolvedValue(false);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listPostpartumRecords: jest
        .fn()
        .mockResolvedValue([createPostpartumRecord({ startedAt: "2026-04-01" })]),
      listScreeningResponses: jest.fn().mockResolvedValue([
        createScreeningResponse({
          date: "2026-06-01",
          answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }),
      ]),
    });
    renderEnd(storage);

    fireEvent.press(
      await screen.findByTestId("pregnancy-end-postpartum-delete-button"),
    );
    fireEvent.press(
      screen.getByTestId("pregnancy-end-screening-delete-button"),
    );

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(2));
    expect(storage.deleteAllPostpartumData).not.toHaveBeenCalled();
    expect(storage.deleteAllScreeningData).not.toHaveBeenCalled();
  });

  it("unmounts cleanly while the initial load is still in flight", async () => {
    let resolveRecords: (value: unknown) => void = () => {};
    const storage = createLocalAppStorageMock({
      listPregnancyRecords: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRecords = resolve;
        }),
      ),
    });
    const view = renderEnd(storage);
    view.unmount();
    resolveRecords([]);
    await act(async () => {});
  });

  it("unmounts cleanly while the delayed-start unlock check is still in flight", async () => {
    let resolveUnlock: (value: boolean) => void = () => {};
    const recent = {
      ...endedRecord(),
      endedAt: "2026-05-01",
      endReason: "birth" as const,
    };
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listPregnancyRecords: jest.fn().mockResolvedValue([recent]),
    });
    const view = renderEnd(
      storage,
      undefined,
      new Date(2026, 5, 15),
      () =>
        new Promise<boolean>((resolve) => {
          resolveUnlock = resolve;
        }),
    );
    // Let the first storage batch resolve so the load reaches the unlock read.
    await act(async () => {});
    view.unmount();
    resolveUnlock(true);
    await act(async () => {});
  });

  it("renders with default wiring when no storage or clock is injected", async () => {
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <PregnancyEndScreen />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("pregnancy-end-empty-card")).toBeTruthy();
  });
});

describe("resolveUpdateEddError", () => {
  it("maps every update error code to the shared wizard validation copy", () => {
    const copy = getPregnancyCopy("en");
    expect(resolveUpdateEddError("no_active_pregnancy", copy)).toBe(
      copy.wizard.validation.saveFailed,
    );
    expect(resolveUpdateEddError("missing_date", copy)).toBe(
      copy.wizard.validation.missingDate,
    );
    expect(resolveUpdateEddError("invalid_date", copy)).toBe(
      copy.wizard.validation.invalidDate,
    );
    expect(resolveUpdateEddError("out_of_range", copy)).toBe(
      copy.wizard.validation.outOfRange,
    );
    expect(resolveUpdateEddError("save_failed", copy)).toBe(
      copy.wizard.validation.saveFailed,
    );
  });
});

describe("resolveUpdateDueDatePrefill", () => {
  it("opens a blank ultrasound form for the defensive null record", () => {
    expect(resolveUpdateDueDatePrefill(null)).toEqual({
      basis: "ultrasound",
      value: "",
    });
  });

  it("falls an LMP-based record back to the ultrasound toggle, keeping its edd", () => {
    expect(resolveUpdateDueDatePrefill(activeRecord())).toEqual({
      basis: "ultrasound",
      value: EDD,
    });
  });

  it("keeps a non-LMP basis as the starting toggle", () => {
    const manualRecord = { ...activeRecord(), eddBasis: "manual" as const };
    expect(resolveUpdateDueDatePrefill(manualRecord)).toEqual({
      basis: "manual",
      value: EDD,
    });
  });
});

});
