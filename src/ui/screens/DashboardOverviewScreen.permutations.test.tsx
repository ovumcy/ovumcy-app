import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { buildCrisisSupportViewData } from "../../i18n/crisis-copy";
import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultProfileRecord } from "../../models/profile";
import { createPostpartumRecord } from "../../models/postpartum";
import { createPregnancyRecord } from "../../models/pregnancy";
import { createScreeningResponse } from "../../models/screening";
import { loadDashboardScreenState } from "../../services/dashboard-view-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { DashboardOverviewScreen } from "./DashboardOverviewScreen";

const TODAY = "2026-07-20";
const NOW = new Date("2026-07-20T10:00:00.000Z");

// Every required prop of the overview except `viewData`, so each permutation
// renders exactly the mode section it stages and nothing else is wired.
function baseProps(state: Awaited<ReturnType<typeof loadDashboardScreenState>>) {
  return {
    editorViewData: state.editorViewData,
    bleedingSafetyHint: null,
    statusMessage: "",
    entryExists: false,
    isSaving: false,
    onDelete: () => {},
    onPatch: () => {},
    onSave: () => {},
    onManualCycleStart: () => {},
    record: createEmptyDayLogRecord(TODAY),
  };
}

// The container always wires every handler, so the presentational fallbacks
// (`onPress={handler ?? noop}`, the isAcceptingCycleReturn default) and the
// section-hidden branches never run through DashboardScreen tests. These
// permutations render the overview DIRECTLY with real service view-data and
// no handlers at all, pinning that a partially-wired embed renders inertly
// instead of crashing.
describe("DashboardOverviewScreen permutations", () => {
  it("renders the pregnancy mode with metrics logged, no milestones, and no handlers", async () => {
    const today = "2026-07-20";
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(
        createPregnancyRecord({
          edd: "2026-10-08",
          eddBasis: "lmp",
          lmpDate: "2026-01-01",
          startedAt: "2026-01-05",
        }),
      ),
      readDayLogRecord: jest.fn().mockResolvedValue({
        ...createEmptyDayLogRecord(today),
        weightKg: 66.2,
        bpSystolic: 118,
        bpDiastolic: 76,
      }),
    });
    const state = await loadDashboardScreenState(
      storage,
      new Date("2026-07-20T10:00:00.000Z"),
      "en",
    );
    if (!state.viewData.pregnancyDashboard) {
      throw new Error("expected a pregnancy dashboard");
    }
    const viewData = {
      ...state.viewData,
      pregnancyDashboard: {
        ...state.viewData.pregnancyDashboard,
        milestones: {
          ...state.viewData.pregnancyDashboard.milestones,
          items: [],
        },
      },
    };

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen
          editorViewData={state.editorViewData}
          bleedingSafetyHint={null}
          statusMessage=""
          entryExists={false}
          isSaving={false}
          onDelete={() => {}}
          onPatch={() => {}}
          onSave={() => {}}
          onManualCycleStart={() => {}}
          record={createEmptyDayLogRecord("2026-07-20")}
          viewData={viewData}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-pregnancy-mode")).toBeTruthy();
    expect(screen.getByTestId("dashboard-pregnancy-metrics")).toBeTruthy();
  });

  it("renders the postpartum mode with the offer hidden and no handlers", async () => {
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(
        createPostpartumRecord({ startedAt: "2026-07-10" }),
      ),
      readDayLogRecord: jest
        .fn()
        .mockResolvedValue(createEmptyDayLogRecord("2026-07-20")),
      // A 5-day-old response: inside the 14-day cadence, so the offer hides
      // while the "last check-in" history row still renders.
      listScreeningResponses: jest.fn().mockResolvedValue([
        createScreeningResponse({
          date: "2026-07-15",
          answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }),
      ]),
    });
    const state = await loadDashboardScreenState(
      storage,
      new Date("2026-07-20T10:00:00.000Z"),
      "en",
    );
    if (!state.viewData.postpartumDashboard) {
      throw new Error("expected a postpartum dashboard");
    }

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen
          editorViewData={state.editorViewData}
          bleedingSafetyHint={null}
          statusMessage=""
          entryExists={false}
          isSaving={false}
          onDelete={() => {}}
          onPatch={() => {}}
          onSave={() => {}}
          onManualCycleStart={() => {}}
          record={createEmptyDayLogRecord("2026-07-20")}
          viewData={state.viewData}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-postpartum-mode")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-screening-offer")).toBeNull();
  });

  // GA 20: trimester II, so the contraction-timer card renders in its calmer
  // below-the-fold slot rather than the prominent trimester-III one.
  async function loadMidGaState(dayOverrides: Record<string, unknown>) {
    const todayRecord = { ...createEmptyDayLogRecord(TODAY), ...dayOverrides };
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(
        createPregnancyRecord({
          edd: "2026-12-07",
          eddBasis: "lmp",
          lmpDate: "2026-03-02",
          startedAt: "2026-04-01",
        }),
      ),
      readDayLogRecord: jest.fn().mockResolvedValue(todayRecord),
      // The metrics rows read today's log out of the history range, not the
      // single-day read, so the seeded record has to be listed there too.
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([todayRecord]),
    });
    return loadDashboardScreenState(storage, NOW, "en");
  }

  it("renders a mid-pregnancy weight-only metric row with no handlers", async () => {
    const state = await loadMidGaState({ weightKg: 66.2 });

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen {...baseProps(state)} viewData={state.viewData} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-pregnancy-contraction-timer")).toBeTruthy();
    expect(screen.getByTestId("dashboard-pregnancy-metric-weight")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-pregnancy-metric-bp")).toBeNull();
  });

  it("renders a mid-pregnancy blood-pressure-only metric row with no handlers", async () => {
    const state = await loadMidGaState({ bpSystolic: 118, bpDiastolic: 76 });

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen {...baseProps(state)} viewData={state.viewData} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-pregnancy-metric-bp")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-pregnancy-metric-weight")).toBeNull();
  });

  it("renders the term birth CTA and the empty metrics state with no handlers", async () => {
    // GA 39: at term, so the birth CTA renders; the day has no metrics logged.
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(
        createPregnancyRecord({
          edd: "2026-07-27",
          eddBasis: "lmp",
          lmpDate: "2025-10-20",
          startedAt: "2025-11-15",
        }),
      ),
    });
    const state = await loadDashboardScreenState(storage, NOW, "en");

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen {...baseProps(state)} viewData={state.viewData} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-pregnancy-birth-cta")).toBeTruthy();
    expect(screen.getByTestId("dashboard-pregnancy-metrics-empty")).toBeTruthy();
  });

  it("renders the past-window pregnancy stale card with no handlers", async () => {
    // The active record's EDD is long past: GA leaves the trackable window,
    // so the compact stale card renders on the cycle dashboard instead.
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(
        createPregnancyRecord({
          edd: "2026-01-01",
          eddBasis: "lmp",
          lmpDate: "2025-03-27",
          startedAt: "2025-05-01",
        }),
      ),
    });
    const state = await loadDashboardScreenState(storage, NOW, "en");

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen {...baseProps(state)} viewData={state.viewData} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-pregnancy-stale-card")).toBeTruthy();
    expect(screen.getByTestId("dashboard-pregnancy-stale-card-cta")).toBeTruthy();
  });

  it("renders the past-window postpartum stale card with no handlers", async () => {
    // Postpartum started ~29 weeks ago: beyond the 26-week trackable window.
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(
        createPostpartumRecord({ startedAt: "2026-01-01" }),
      ),
    });
    const state = await loadDashboardScreenState(storage, NOW, "en");

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen {...baseProps(state)} viewData={state.viewData} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-postpartum-stale-card")).toBeTruthy();
    expect(
      screen.getByTestId("dashboard-postpartum-stale-card-cta"),
    ).toBeTruthy();
  });

  it("renders the screening offer and expanded crisis support with no handlers", async () => {
    // A 19-day-old response: past the 14-day cadence, so the offer card shows
    // alongside the last-check-in history row.
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(
        createPostpartumRecord({ startedAt: "2026-06-20" }),
      ),
      listScreeningResponses: jest.fn().mockResolvedValue([
        createScreeningResponse({
          date: "2026-07-01",
          answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }),
      ]),
    });
    const state = await loadDashboardScreenState(storage, NOW, "en");

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen
          {...baseProps(state)}
          crisisSupport={buildCrisisSupportViewData("en")}
          viewData={state.viewData}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("dashboard-screening-offer")).toBeTruthy();
    expect(screen.getByTestId("dashboard-screening-history-link")).toBeTruthy();

    // The support-resources row expands in place; its crisis card renders
    // inertly without a save handler.
    fireEvent.press(
      screen.getByTestId("dashboard-postpartum-support-resources-toggle"),
    );
    expect(
      screen.getByTestId("dashboard-postpartum-crisis-support"),
    ).toBeTruthy();
  });

  // Paused-with-no-record: a positive test after the last cycle start with no
  // pregnancy/postpartum record produces the entry card, split locked vs
  // unlocked by the injected ownership check.
  async function loadPausedState(unlocked: boolean) {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-06-01",
      }),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        { ...createEmptyDayLogRecord("2026-06-20"), pregnancyTest: "positive" },
      ]),
    });
    return loadDashboardScreenState(
      storage,
      NOW,
      "en",
      {},
      { loadPregnancyModuleOwned: () => Promise.resolve(unlocked) },
    );
  }

  it("renders the unlocked pregnancy entry card with no handlers", async () => {
    const state = await loadPausedState(true);

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen {...baseProps(state)} viewData={state.viewData} />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("dashboard-pregnancy-entry-card-cta"),
    ).toBeTruthy();
  });

  it("renders the locked pregnancy entry card with no handlers", async () => {
    const state = await loadPausedState(false);

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <DashboardOverviewScreen {...baseProps(state)} viewData={state.viewData} />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("dashboard-pregnancy-entry-card-title"),
    ).toBeTruthy();
  });
});
