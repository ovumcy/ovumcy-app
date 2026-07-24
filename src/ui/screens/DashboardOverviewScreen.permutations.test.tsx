import * as React from "react";
import { render, screen } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createPostpartumRecord } from "../../models/postpartum";
import { createPregnancyRecord } from "../../models/pregnancy";
import { createScreeningResponse } from "../../models/screening";
import { loadDashboardScreenState } from "../../services/dashboard-view-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { DashboardOverviewScreen } from "./DashboardOverviewScreen";

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
});
