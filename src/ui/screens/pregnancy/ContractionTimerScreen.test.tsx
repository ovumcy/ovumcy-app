import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createPregnancyRecord, type ContractionEntry, type ContractionSession } from "../../../models/pregnancy";
import { addDays, parseLocalDate } from "../../../services/profile-settings-policy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { getContractionTimerCopy } from "../../../i18n/contraction-timer-copy";
import { openConfirmation } from "../../confirm/open-confirmation";
import { ContractionTimerScreen } from "./ContractionTimerScreen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

const mockOpenConfirmation = jest.mocked(openConfirmation);

const EDD = "2026-10-08";
const NOW = new Date(2026, 5, 1, 10, 0, 0, 0); // 2026-06-01T10:00:00 local

function activeRecord() {
  return createPregnancyRecord({
    edd: EDD,
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
  });
}

// `now` (Date) that makes calcGestationalAge(EDD, formatLocalDate(now))
// report `gaDays`, mirroring contraction-timer-service.test.ts's identical
// helper.
function nowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(EDD)!, gaDays - 280);
}

function entry(startedAt: string, durationSeconds = 60): ContractionEntry {
  return { startedAt, durationSeconds };
}

function contractionSession(overrides: Partial<ContractionSession> = {}): ContractionSession {
  return {
    id: "contraction_seed",
    date: "2026-06-01",
    startedAt: NOW.toISOString(),
    contractions: [],
    ...overrides,
  };
}

// 13 contractions ending exactly at `now`, 5 minutes apart, 60s each --
// satisfies matches511Pattern at `now` (see contraction-timer-service.test.ts
// for the exhaustive boundary matrix; this only needs one known-good shape).
function build511MatchingContractions(now: Date): ContractionEntry[] {
  const nowMs = now.getTime();
  return Array.from({ length: 13 }, (_, indexFromEnd) => {
    const index = 12 - indexFromEnd;
    return entry(new Date(nowMs - index * 5 * 60_000).toISOString(), 60);
  });
}

function renderScreen(storage = createLocalAppStorageMock(), now = NOW) {
  return render(
    <AppPreferencesTestProvider languageOverride="en">
      <ContractionTimerScreen now={now} storage={storage} />
    </AppPreferencesTestProvider>,
  );
}

describe("ContractionTimerScreen", () => {
  afterEach(() => {
    mockOpenConfirmation.mockReset();
    mockPush.mockReset();
  });

  it("shows a neutral not-accessible body with no active pregnancy", async () => {
    renderScreen(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      }),
    );

    expect(await screen.findByTestId("contraction-timer-not-accessible")).toBeTruthy();
    expect(screen.queryByTestId("contraction-timer-toggle-button")).toBeNull();
    expect(screen.getByTestId("contraction-timer-disclaimer")).toBeTruthy();
  });

  it("shows a neutral not-accessible body for an ended pregnancy", async () => {
    const ended = {
      ...activeRecord(),
      status: "ended" as const,
      endedAt: "2026-05-01",
      endReason: "birth" as const,
      modeOfDelivery: "vaginal" as const,
    };
    renderScreen(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(ended),
      }),
    );

    expect(await screen.findByTestId("contraction-timer-not-accessible")).toBeTruthy();
  });

  it("renders the toggle, education line, birth CTA, and disclaimer for any active pregnancy", async () => {
    renderScreen(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      }),
    );

    expect(await screen.findByTestId("contraction-timer-toggle-button")).toBeTruthy();
    expect(screen.getByTestId("contraction-timer-education-line")).toBeTruthy();
    expect(screen.getByTestId("contraction-timer-birth-cta")).toBeTruthy();
    expect(screen.getByTestId("contraction-timer-disclaimer")).toBeTruthy();
    expect(screen.getByTestId("contraction-timer-toggle-label").props.children).toBe(
      "Contraction started",
    );
  });

  it("starts and stops a contraction via the toggle, persisting it with a duration", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    renderScreen(storage);

    const toggle = await screen.findByTestId("contraction-timer-toggle-button");
    fireEvent.press(toggle);
    expect(screen.getByTestId("contraction-timer-toggle-label").props.children).toBe(
      "Contraction ended",
    );
    expect(screen.getByTestId("contraction-timer-elapsed")).toBeTruthy();

    fireEvent.press(toggle);

    await waitFor(() => {
      expect(storage.writeContractionSession).toHaveBeenCalledWith(
        expect.objectContaining({
          contractions: [expect.objectContaining({ durationSeconds: expect.any(Number) })],
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("contraction-timer-toggle-label").props.children).toBe(
        "Contraction started",
      );
    });
    expect(screen.queryByTestId("contraction-timer-elapsed")).toBeNull();
  });

  it("renders this session's rows and the window summary from seeded view-data", async () => {
    const seeded = contractionSession({
      id: "contraction_current",
      startedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString(),
      contractions: [
        entry(new Date(NOW.getTime() - 10 * 60_000).toISOString(), 45),
        entry(new Date(NOW.getTime() - 5 * 60_000).toISOString(), 50),
      ],
    });
    renderScreen(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        listContractionSessions: jest.fn().mockResolvedValue([seeded]),
      }),
    );

    await screen.findByTestId("contraction-timer-rows");
    expect(screen.queryByTestId("contraction-timer-rows-empty")).toBeNull();
    expect(screen.getByTestId("contraction-timer-window-count").props.children).toBe(
      "Contractions: 2",
    );
    expect(screen.getByTestId("contraction-timer-window-avg-duration")).toBeTruthy();
    expect(screen.getByTestId("contraction-timer-window-avg-interval")).toBeTruthy();
  });

  it("renders the calmer (non-prominent) education presentation without a matching 5-1-1 pattern", async () => {
    renderScreen(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      }),
    );

    await screen.findByTestId("contraction-timer-education-wrap");
    expect(screen.queryByTestId("contraction-timer-education-wrap-prominent")).toBeNull();
  });

  it("renders the visually elevated education presentation when the 5-1-1 pattern matches, with the same routine wording", async () => {
    // Anchored at term (38+0, >=37) so this exercises the routine_511
    // variant specifically -- see the "GA-aware contraction education" suite
    // below for the preterm variant.
    const termNow = nowForGaDays(38 * 7);
    const matching = contractionSession({
      id: "contraction_matching",
      startedAt: new Date(termNow.getTime() - 65 * 60_000).toISOString(),
      contractions: build511MatchingContractions(termNow),
    });
    renderScreen(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        listContractionSessions: jest.fn().mockResolvedValue([matching]),
      }),
      termNow,
    );

    const wrap = await screen.findByTestId("contraction-timer-education-wrap-prominent");
    expect(wrap).toBeTruthy();
    expect(screen.getByTestId("contraction-timer-education-line").props.children).toMatch(
      /common guideline/i,
    );
  });

  it("navigates to the end-of-pregnancy birth hand-off from the 'I gave birth' button", async () => {
    renderScreen(
      createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      }),
    );

    const cta = await screen.findByTestId("contraction-timer-birth-cta");
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith("/pregnancy-end?reason=birth");
  });

  it("keeps the current session when the discard confirm is dismissed", async () => {
    mockOpenConfirmation.mockResolvedValue(false);
    const seeded = contractionSession({
      id: "contraction_keep",
      contractions: [entry(NOW.toISOString(), 50)],
    });
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      listContractionSessions: jest.fn().mockResolvedValue([seeded]),
    });
    renderScreen(storage);

    await screen.findByTestId(`contraction-timer-row-${NOW.toISOString()}`);
    fireEvent.press(screen.getByTestId("contraction-timer-discard-button"));

    await waitFor(() => {
      expect(mockOpenConfirmation).toHaveBeenCalled();
    });
    expect(storage.deleteContractionSession).not.toHaveBeenCalled();
    expect(screen.getByTestId(`contraction-timer-row-${NOW.toISOString()}`)).toBeTruthy();
  });

  it("discards the current session's persisted data after an explicit confirm", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const seeded = contractionSession({
      id: "contraction_discard",
      contractions: [entry(NOW.toISOString(), 50)],
    });
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      listContractionSessions: jest.fn().mockResolvedValue([seeded]),
    });
    renderScreen(storage);

    await screen.findByTestId(`contraction-timer-row-${NOW.toISOString()}`);
    fireEvent.press(screen.getByTestId("contraction-timer-discard-button"));

    await waitFor(() => {
      expect(storage.deleteContractionSession).toHaveBeenCalledWith("contraction_discard");
    });
    await waitFor(() => {
      expect(screen.getByTestId("contraction-timer-rows-empty")).toBeTruthy();
    });
  });

  it("finishing a session clears the active rows without deleting the already-saved data", async () => {
    const seeded = contractionSession({
      id: "contraction_finish",
      contractions: [entry(NOW.toISOString(), 50)],
    });
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      listContractionSessions: jest.fn().mockResolvedValue([seeded]),
    });
    renderScreen(storage);

    await screen.findByTestId(`contraction-timer-row-${NOW.toISOString()}`);
    fireEvent.press(screen.getByTestId("contraction-timer-finish-button"));

    expect(storage.deleteContractionSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("contraction-timer-rows-empty")).toBeTruthy();
    });
    // The finished session moves into history rather than being lost.
    await waitFor(() => {
      expect(screen.getByTestId("contraction-timer-history-row-contraction_finish")).toBeTruthy();
    });
  });

  it("deletes a past session from history after an explicit confirm", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const past = contractionSession({
      id: "contraction_past",
      startedAt: new Date(NOW.getTime() - 5 * 60 * 60_000).toISOString(),
      contractions: [entry(new Date(NOW.getTime() - 5 * 60 * 60_000).toISOString(), 40)],
    });
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      listContractionSessions: jest.fn().mockResolvedValue([past]),
    });
    renderScreen(storage);

    const deleteButton = await screen.findByTestId("contraction-timer-history-delete-contraction_past");
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(storage.deleteContractionSession).toHaveBeenCalledWith("contraction_past");
    });
  });

  describe("GA-aware contraction education (CHANGE 1)", () => {
    it("shows the preterm notice before week 37", async () => {
      renderScreen(
        createLocalAppStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        }),
        nowForGaDays(36 * 7 + 6),
      );

      await screen.findByTestId("contraction-timer-education-line");
      expect(screen.getByTestId("contraction-timer-education-line").props.children).toMatch(
        /preterm labour/i,
      );
    });

    it("shows the routine 5-1-1 guideline from week 37", async () => {
      renderScreen(
        createLocalAppStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        }),
        nowForGaDays(37 * 7),
      );

      await screen.findByTestId("contraction-timer-education-line");
      expect(screen.getByTestId("contraction-timer-education-line").props.children).toMatch(
        /common guideline/i,
      );
    });
  });

  describe("birth CTA visibility (CHANGE 2, week-20 loss-taxonomy gate)", () => {
    it("hides the birth CTA at 19+6", async () => {
      renderScreen(
        createLocalAppStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        }),
        nowForGaDays(19 * 7 + 6),
      );

      // The timer itself stays fully usable -- only the CTA is gated.
      await screen.findByTestId("contraction-timer-toggle-button");
      expect(screen.queryByTestId("contraction-timer-birth-cta")).toBeNull();
    });

    it("shows the birth CTA at 20+0", async () => {
      renderScreen(
        createLocalAppStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        }),
        nowForGaDays(20 * 7),
      );

      expect(await screen.findByTestId("contraction-timer-birth-cta")).toBeTruthy();
    });

    it("keeps the birth CTA visible at week 38, unchanged", async () => {
      renderScreen(
        createLocalAppStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        }),
        nowForGaDays(38 * 7),
      );

      expect(await screen.findByTestId("contraction-timer-birth-cta")).toBeTruthy();
    });
  });
});

describe("failure paths", () => {
  it("surfaces a failed finish and a failed history delete", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      writeContractionSession: jest.fn().mockRejectedValue(new Error("busy")),
      listContractionSessions: jest.fn().mockResolvedValue([
        {
          id: "contraction_hist",
          date: "2026-05-20",
          startedAt: "2026-05-20T09:00:00.000Z",
          contractions: [],
        },
      ]),
      deleteContractionSession: jest.fn().mockRejectedValue(new Error("busy")),
    });
    renderScreen(storage);

    fireEvent.press(await screen.findByTestId("contraction-timer-toggle-button"));
    fireEvent.press(screen.getByTestId("contraction-timer-toggle-button"));
    fireEvent.press(screen.getByTestId("contraction-timer-finish-button"));
    expect(
      await screen.findByText(
        getContractionTimerCopy("en").counter.saveFailedStatus,
      ),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByTestId("contraction-timer-history-delete-contraction_hist"),
    );
    expect(
      await screen.findByText(
        getContractionTimerCopy("en").history.deleteFailedStatus,
      ),
    ).toBeTruthy();
  });

  it("covers the guard rails: idle finish/discard, live tick, declined confirms, mid-load unmount", async () => {
    jest.useFakeTimers();
    try {
      mockOpenConfirmation.mockResolvedValue(false);
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
        listContractionSessions: jest.fn().mockResolvedValue([
          {
            id: "contraction_hist",
            date: "2026-05-20",
            startedAt: "2026-05-20T09:00:00.000Z",
            contractions: [],
          },
        ]),
      });
      renderScreen(storage);

      fireEvent.press(await screen.findByTestId("contraction-timer-finish-button"));
      fireEvent.press(screen.getByTestId("contraction-timer-discard-button"));

      fireEvent.press(screen.getByTestId("contraction-timer-toggle-button"));
      await act(async () => {
        jest.advanceTimersByTime(31_000);
      });

      fireEvent.press(screen.getByTestId("contraction-timer-discard-button"));
      fireEvent.press(
        screen.getByTestId("contraction-timer-history-delete-contraction_hist"),
      );
      await act(async () => {});
      expect(storage.deleteContractionSession).not.toHaveBeenCalled();
      expect(storage.writeContractionSession).not.toHaveBeenCalled();
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
    const view = renderScreen(storage);
    view.unmount();
    resolvePregnancy(activeRecord());
    await act(async () => {});
  });

});
