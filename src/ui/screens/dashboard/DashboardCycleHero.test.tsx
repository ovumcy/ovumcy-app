import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import type { DashboardCycleHeroViewData } from "../../../services/dashboard-view-service";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { DashboardCycleHero } from "./DashboardCycleHero";

const baseViewData: DashboardCycleHeroViewData = {
  state: "regular" as const,
  title: "Day",
  value: "8",
  detail: "Cycle 28 days",
  caption: "Next period: Apr 22",
  upcomingOvulationLabel: null,
  progressPercent: 7 / 28,
  currentTone: "period" as const,
  phaseSegments: [
    { key: "period" as const, startPercent: 0, endPercent: 5 / 28, tone: "period" as const },
    {
      key: "follicular" as const,
      startPercent: 5 / 28,
      endPercent: 13 / 28,
      tone: "follicular" as const,
    },
    {
      key: "ovulation" as const,
      startPercent: 13 / 28,
      endPercent: 14 / 28,
      tone: "ovulation" as const,
    },
    {
      key: "luteal" as const,
      startPercent: 14 / 28,
      endPercent: 1,
      tone: "luteal" as const,
    },
  ],
  phaseCards: [
    {
      key: "period" as const,
      label: "Period",
      rangeLabel: "Days 1-5",
      tone: "period" as const,
      active: true,
    },
    {
      key: "follicular" as const,
      label: "Follicular",
      rangeLabel: "Days 6-13",
      tone: "follicular" as const,
      active: false,
    },
    {
      key: "ovulation" as const,
      label: "Ovulation",
      rangeLabel: "Day 14",
      tone: "ovulation" as const,
      active: false,
    },
    {
      key: "luteal" as const,
      label: "Luteal",
      rangeLabel: "Days 15-28",
      tone: "luteal" as const,
      active: false,
    },
  ],
};

function renderHero(overrides: Partial<typeof baseViewData> = {}) {
  const viewData = {
    ...baseViewData,
    ...overrides,
  };

  return render(
    <AppPreferencesTestProvider>
      <DashboardCycleHero viewData={viewData} />
    </AppPreferencesTestProvider>,
  );
}

describe("DashboardCycleHero", () => {
  it("shows a dedicated ovulation marker when ovulation is not the current phase", () => {
    renderHero();

    expect(screen.getByTestId("dashboard-cycle-hero-ovulation-marker")).toBeTruthy();
    expect(
      screen.getByTestId("dashboard-cycle-hero-phase-card-ovulation").props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: false }));
  });

  it("keeps all phase cards on the same fixed-size grid", () => {
    renderHero();

    const gridStyle = StyleSheet.flatten(
      screen.getByTestId("dashboard-cycle-hero-phase-grid").props.style,
    );
    const periodCardStyle = StyleSheet.flatten(
      screen.getByTestId("dashboard-cycle-hero-phase-card-period").props.style,
    );
    const ovulationCardStyle = StyleSheet.flatten(
      screen.getByTestId("dashboard-cycle-hero-phase-card-ovulation").props.style,
    );

    expect(gridStyle).toEqual(
      expect.objectContaining({
        alignSelf: "center",
        maxWidth: 304,
        width: "100%",
      }),
    );
    expect(periodCardStyle).toEqual(
      expect.objectContaining({
        minHeight: 80,
        width: "48.25%",
      }),
    );
    expect(ovulationCardStyle).toEqual(
      expect.objectContaining({
        minHeight: 80,
        width: "48.25%",
      }),
    );
  });

  it("drops the extra ovulation marker when ovulation is already active", () => {
    renderHero({
      currentTone: "ovulation",
      progressPercent: 13 / 28,
      phaseCards: baseViewData.phaseCards.map((phaseCard) => ({
        ...phaseCard,
        active: phaseCard.key === "ovulation",
      })),
    });

    expect(screen.queryByTestId("dashboard-cycle-hero-ovulation-marker")).toBeNull();
    expect(
      screen.getByTestId("dashboard-cycle-hero-phase-card-ovulation").props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: true }));
  });

  it("renders the upcoming-ovulation line next to the next-period caption", () => {
    renderHero({ upcomingOvulationLabel: "Ovulation: Apr 24" });

    expect(
      screen.getByTestId("dashboard-cycle-hero-upcoming-ovulation").props.children,
    ).toBe("Ovulation: Apr 24");
    expect(
      screen.getByLabelText(
        "Day 8. Period. Cycle 28 days. Next period: Apr 22. Ovulation: Apr 24",
      ),
    ).toBeTruthy();
  });

  it("omits the upcoming-ovulation line entirely when the projection has no upcoming date", () => {
    renderHero({ upcomingOvulationLabel: null });

    expect(screen.queryByTestId("dashboard-cycle-hero-upcoming-ovulation")).toBeNull();
  });
});
