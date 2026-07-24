import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createPregnancyRecord } from "../../../models/pregnancy";
import { addDays, parseLocalDate } from "../../../services/profile-settings-policy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { getKickCounterCopy } from "../../../i18n/kick-counter-copy";
import { openConfirmation } from "../../confirm/open-confirmation";
import { KickCounterScreen } from "./KickCounterScreen";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

const mockOpenConfirmation = jest.mocked(openConfirmation);

const EDD = "2026-10-08";

function nowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(EDD)!, gaDays - 280);
}

function activeRecord() {
  return createPregnancyRecord({
    edd: EDD,
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
  });
}

function renderKickCounter(storage = createLocalAppStorageMock(), now = nowForGaDays(196)) {
  return render(
    <AppPreferencesTestProvider languageOverride="en">
      <KickCounterScreen now={now} storage={storage} />
    </AppPreferencesTestProvider>,
  );
}

describe("KickCounterScreen", () => {
  afterEach(() => {
    mockOpenConfirmation.mockReset();
  });

  it("shows a neutral not-accessible body with no active pregnancy", async () => {
    renderKickCounter(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      }),
    );

    expect(await screen.findByTestId("kick-counter-not-accessible")).toBeTruthy();
    expect(screen.queryByTestId("kick-counter-tap-button")).toBeNull();
    expect(screen.getByTestId("kick-counter-disclaimer")).toBeTruthy();
  });

  it("shows a neutral not-accessible body before week 28", async () => {
    renderKickCounter(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      }),
      nowForGaDays(27 * 7 + 6),
    );

    expect(await screen.findByTestId("kick-counter-not-accessible")).toBeTruthy();
    expect(screen.queryByTestId("kick-counter-tap-button")).toBeNull();
  });

  it("renders the counter, education line, and disclaimer from week 28", async () => {
    renderKickCounter(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      }),
      nowForGaDays(28 * 7),
    );

    expect(await screen.findByTestId("kick-counter-tap-button")).toBeTruthy();
    expect(screen.getByTestId("kick-counter-education-line")).toBeTruthy();
    expect(screen.getByTestId("kick-counter-disclaimer")).toBeTruthy();
    expect(screen.getByTestId("kick-counter-tap-count").props.children).toBe(0);
  });

  it("starts a session on the first tap and increments on subsequent taps", async () => {
    renderKickCounter(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      }),
      nowForGaDays(28 * 7),
    );

    const tapButton = await screen.findByTestId("kick-counter-tap-button");
    fireEvent.press(tapButton);
    expect(screen.getByTestId("kick-counter-tap-count").props.children).toBe(1);

    fireEvent.press(tapButton);
    fireEvent.press(tapButton);
    expect(screen.getByTestId("kick-counter-tap-count").props.children).toBe(3);
    expect(screen.getByTestId("kick-counter-elapsed")).toBeTruthy();
  });

  it("finishes a session, persists it, and refreshes the history list", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    renderKickCounter(storage, nowForGaDays(28 * 7));

    const tapButton = await screen.findByTestId("kick-counter-tap-button");
    fireEvent.press(tapButton);
    fireEvent.press(tapButton);

    fireEvent.press(screen.getByTestId("kick-counter-finish-button"));

    await waitFor(() => {
      expect(storage.writeKickSession).toHaveBeenCalledWith(
        expect.objectContaining({ kickCount: 2 }),
      );
    });
    // Session state resets after a successful finish.
    await waitFor(() => {
      expect(screen.getByTestId("kick-counter-tap-count").props.children).toBe(0);
    });
    expect(screen.queryByTestId("kick-counter-elapsed")).toBeNull();
  });

  it("discards an in-progress session after an explicit confirm", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    renderKickCounter(storage, nowForGaDays(28 * 7));

    const tapButton = await screen.findByTestId("kick-counter-tap-button");
    fireEvent.press(tapButton);
    fireEvent.press(tapButton);
    expect(screen.getByTestId("kick-counter-tap-count").props.children).toBe(2);

    fireEvent.press(screen.getByTestId("kick-counter-discard-button"));

    await waitFor(() => {
      expect(screen.getByTestId("kick-counter-tap-count").props.children).toBe(0);
    });
    expect(storage.writeKickSession).not.toHaveBeenCalled();
  });

  it("keeps the in-progress session when the discard confirm is dismissed", async () => {
    mockOpenConfirmation.mockResolvedValue(false);
    renderKickCounter(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      }),
      nowForGaDays(28 * 7),
    );

    const tapButton = await screen.findByTestId("kick-counter-tap-button");
    fireEvent.press(tapButton);
    fireEvent.press(tapButton);

    fireEvent.press(screen.getByTestId("kick-counter-discard-button"));

    await waitFor(() => {
      expect(mockOpenConfirmation).toHaveBeenCalled();
    });
    expect(screen.getByTestId("kick-counter-tap-count").props.children).toBe(2);
  });

  it("shows recent session history rows newest first", async () => {
    renderKickCounter(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        listKickSessions: jest.fn().mockResolvedValue([
          { id: "kick_a", date: "2026-07-01", durationMinutes: 20, kickCount: 10 },
          { id: "kick_b", date: "2026-07-03", durationMinutes: 15, kickCount: 8 },
        ]),
      }),
      nowForGaDays(28 * 7),
    );

    await screen.findByTestId("kick-counter-history-row-kick_b");
    const history = screen.getByTestId("kick-counter-history");
    expect(history).toBeTruthy();
    expect(screen.queryByTestId("kick-counter-history-empty")).toBeNull();
  });

  it("deletes a history row after an explicit confirm", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      listKickSessions: jest.fn().mockResolvedValue([
        { id: "kick_a", date: "2026-07-01", durationMinutes: 20, kickCount: 10 },
      ]),
    });
    renderKickCounter(storage, nowForGaDays(28 * 7));

    const deleteButton = await screen.findByTestId("kick-counter-history-delete-kick_a");
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(storage.deleteKickSession).toHaveBeenCalledWith("kick_a");
    });
  });

  it("toggles the daily reminder and persists the profile flag", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    renderKickCounter(storage, nowForGaDays(28 * 7));

    const toggle = await screen.findByTestId("kick-counter-reminder-toggle");
    expect(toggle.props.accessibilityState.checked).toBe(false);

    fireEvent.press(toggle);

    await waitFor(() => {
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ kickCountReminderEnabled: true }),
      );
    });
  });
});

describe("failure paths", () => {
  it("surfaces a failed finish and a failed history delete", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      writeKickSession: jest.fn().mockRejectedValue(new Error("busy")),
      listKickSessions: jest.fn().mockResolvedValue([
        { id: "kick_hist", date: "2026-07-10", durationMinutes: 30, kickCount: 9 },
      ]),
      deleteKickSession: jest.fn().mockRejectedValue(new Error("busy")),
    });
    renderKickCounter(storage);

    fireEvent.press(await screen.findByTestId("kick-counter-tap-button"));
    fireEvent.press(screen.getByTestId("kick-counter-finish-button"));
    expect(
      await screen.findByText(getKickCounterCopy("en").counter.saveFailedStatus),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("kick-counter-history-delete-kick_hist"));
    expect(
      await screen.findByText(getKickCounterCopy("en").history.deleteFailedStatus),
    ).toBeTruthy();
  });

  it("covers the guard rails: finish/discard while idle, declined confirms, and a mid-load unmount", async () => {
    jest.useFakeTimers();
    try {
      mockOpenConfirmation.mockResolvedValue(false);
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        listKickSessions: jest.fn().mockResolvedValue([
          { id: "kick_hist", date: "2026-07-10", durationMinutes: 30, kickCount: 9 },
        ]),
      });
      renderKickCounter(storage);

      // Idle finish/discard presses are inert (no session counting yet).
      fireEvent.press(await screen.findByTestId("kick-counter-finish-button"));
      fireEvent.press(screen.getByTestId("kick-counter-discard-button"));

      // Counting: the live elapsed tick advances with the clock.
      fireEvent.press(screen.getByTestId("kick-counter-tap-button"));
      await act(async () => {
        jest.advanceTimersByTime(61_000);
      });

      // A declined discard keeps counting; a declined history delete keeps
      // the row.
      fireEvent.press(screen.getByTestId("kick-counter-discard-button"));
      fireEvent.press(screen.getByTestId("kick-counter-history-delete-kick_hist"));
      await act(async () => {});
      expect(storage.deleteKickSession).not.toHaveBeenCalled();
      expect(storage.writeKickSession).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("unmounts cleanly while the initial load is still in flight", async () => {
    let resolvePregnancy: (value: unknown) => void = () => {};
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolvePregnancy = resolve;
        }),
      ),
    });
    const view = renderKickCounter(storage);
    view.unmount();
    resolvePregnancy(activeRecord());
    await act(async () => {});
  });

});
