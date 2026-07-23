import { render, screen, within } from "@testing-library/react-native";
import { Text } from "react-native";

import type { CalendarDayCellViewData } from "../../services/calendar-view-service";
import type { DashboardCycleHeroViewData } from "../../services/dashboard-view-service";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { CalendarMonthGrid } from "../components/CalendarMonthGrid";
import { StatsBarChart } from "../components/StatsBarChart";
import { DashboardCycleHero } from "../screens/dashboard/DashboardCycleHero";
import { fontScale } from "./tokens";

/**
 * Dynamic Type policy pin.
 *
 * OS font scaling is never switched off in this app: `allowFontScaling` stays
 * at its React Native default everywhere, so body copy grows with the user's
 * system setting without limit. The exception is fixed-geometry surfaces — the
 * calendar month grid, the stats bar chart, the dashboard cycle hero — whose
 * containers cannot grow with their text. Those cap `maxFontSizeMultiplier`
 * instead, so an enormous system font shrinks-to-fit inside its own cell rather
 * than overlapping a neighbour or breaking the grid.
 *
 * These tests fail the moment a new <Text> lands on one of those surfaces
 * without a cap — which is exactly when the surface silently starts clipping
 * for a large-text user.
 */
function createDay(
  overrides: Partial<CalendarDayCellViewData> & { date: string },
): CalendarDayCellViewData {
  return {
    accessibilityLabel: `${overrides.date}. Logged entry.`,
    label: overrides.date.slice(-2),
    isCurrentMonth: true,
    isToday: false,
    isSelected: false,
    isPeriod: false,
    openEditDirectly: false,
    stateKey: "neutral",
    hasData: false,
    hasSex: false,
    hasOvulationMarker: false,
    hasTentativeOvulationMarker: false,
    ...overrides,
  };
}

const heroViewData: DashboardCycleHeroViewData = {
  state: "regular",
  title: "Cycle day",
  value: "12",
  detail: "of a 28-day cycle",
  caption: "Next period in 16 days",
  upcomingOvulationLabel: "Ovulation around 20 March",
  progressPercent: 42,
  currentTone: "follicular",
  phaseSegments: [
    { key: "period", startPercent: 0, endPercent: 18, tone: "period" },
    { key: "follicular", startPercent: 18, endPercent: 55, tone: "follicular" },
  ],
  phaseCards: [
    {
      key: "period",
      label: "Period",
      rangeLabel: "Days 1–5",
      tone: "period",
      active: false,
    },
    {
      key: "follicular",
      label: "Follicular phase",
      rangeLabel: "Days 6–13",
      tone: "follicular",
      active: true,
    },
  ],
};

function textNodesWithin(testID: string) {
  return within(screen.getByTestId(testID)).UNSAFE_getAllByType(Text);
}

describe("dynamic type on fixed-geometry surfaces", () => {
  it("caps every label in the calendar month grid at the dense tier", () => {
    render(
      <AppPreferencesTestProvider>
        <CalendarMonthGrid
          days={[
            createDay({ date: "2026-03-16", isToday: true, hasData: true }),
            createDay({ date: "2026-03-17", hasSex: true }),
            createDay({ date: "2026-03-18", stateKey: "ovulation" }),
            createDay({ date: "2026-03-19", isSelected: true }),
            createDay({ date: "2026-03-20" }),
            createDay({ date: "2026-03-21" }),
            createDay({ date: "2026-03-22" }),
          ]}
          onSelectDay={() => {}}
          todayLabel="Today"
          weekdayLabels={["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]}
        />
      </AppPreferencesTestProvider>,
    );

    // The grid measures itself before it can show the today pill.
    const capsInGrid = screen
      .UNSAFE_getAllByType(Text)
      .map((node) => node.props.maxFontSizeMultiplier);

    expect(capsInGrid.length).toBeGreaterThan(0);
    for (const cap of capsInGrid) {
      expect(cap).toBe(fontScale.dense);
    }
  });

  it("caps the stats bar chart value and axis labels at the dense tier", () => {
    render(
      <AppPreferencesTestProvider>
        <StatsBarChart
          baselineValue={28}
          emptyLabel="No data yet"
          points={[
            { key: "c1", label: "Cycle 1", value: 27 },
            { key: "c2", label: "Cycle 2", value: 29 },
            { key: "c3", label: "Cycle 3", value: 31 },
          ]}
          testID="stats-chart"
          valueSuffix=" days"
        />
      </AppPreferencesTestProvider>,
    );

    const caps = textNodesWithin("stats-chart").map(
      (node) => node.props.maxFontSizeMultiplier,
    );

    // Two labels per column: the value above the bar and the axis label below.
    expect(caps).toHaveLength(6);
    for (const cap of caps) {
      expect(cap).toBe(fontScale.dense);
    }
  });

  it("caps the dashboard phase cards at the dense tier", () => {
    render(
      <AppPreferencesTestProvider>
        <DashboardCycleHero viewData={heroViewData} />
      </AppPreferencesTestProvider>,
    );

    const caps = textNodesWithin("dashboard-cycle-hero-phase-grid").map(
      (node) => node.props.maxFontSizeMultiplier,
    );

    expect(caps).toHaveLength(4);
    for (const cap of caps) {
      expect(cap).toBe(fontScale.dense);
    }
  });

  it("leaves the hero captions free to scale with the OS setting", () => {
    render(
      <AppPreferencesTestProvider>
        <DashboardCycleHero viewData={heroViewData} />
      </AppPreferencesTestProvider>,
    );

    // Captions sit below the fixed ring in a growable column, so they take the
    // user's font size in full — capping them would shrink copy for no reason.
    expect(
      screen.getByTestId("dashboard-cycle-hero-caption").props
        .maxFontSizeMultiplier,
    ).toBeUndefined();
    expect(
      screen.getByTestId("dashboard-cycle-hero-upcoming-ovulation").props
        .maxFontSizeMultiplier,
    ).toBeUndefined();
  });
});
