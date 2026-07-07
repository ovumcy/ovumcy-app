import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { StatsScreen } from "./StatsScreen";

const mockUseEffect = React.useEffect;
const mockPush = jest.fn();

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useRouter: () => ({
      push: mockPush,
    }),
  };
});

function createStorageMock(overrides = {}) {
  return createLocalAppStorageMock({
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-01-17",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: "en",
      themeOverride: "light",
    }),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-01-17",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    ...overrides,
  });
}

describe("StatsScreen", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPush.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders the empty-state hero until two completed cycles exist", async () => {
    const storage = createStorageMock();

    render(
      <AppPreferencesTestProvider>
        <StatsScreen
          now={new Date(2026, 2, 17)}
          storage={storage}
        />
      </AppPreferencesTestProvider>,
    );

    await screen.findByTestId("stats-empty-hero");
    expect(screen.getByTestId("stats-empty-hero")).toBeTruthy();
    expect(screen.getByTestId("stats-screen-title").props.children).toBe("Insights");
    expect(screen.getByText("Cycle length")).toBeTruthy();
    expect(screen.getByText("Cycle 0 of 2 completed")).toBeTruthy();
  });

  it("renders the persistent not-medical-advice prediction disclaimer in the empty state (web parity)", async () => {
    const storage = createStorageMock();

    render(
      <AppPreferencesTestProvider>
        <StatsScreen
          now={new Date(2026, 2, 17)}
          storage={storage}
        />
      </AppPreferencesTestProvider>,
    );

    const disclaimer = await screen.findByTestId("stats-prediction-disclaimer");
    expect(disclaimer.props.children).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
  });

  it("routes back to logging from the empty-state CTA", async () => {
    const storage = createStorageMock();

    render(
      <AppPreferencesTestProvider>
        <StatsScreen
          now={new Date(2026, 2, 17)}
          storage={storage}
        />
      </AppPreferencesTestProvider>,
    );

    await screen.findByTestId("stats-empty-primary-action");
    fireEvent.press(screen.getByTestId("stats-empty-primary-action"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/dashboard"),
    );
  });

  it("renders stats v2 sections after local history is available", async () => {
    const storage = createStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-01-17",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: true,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: "en",
        themeOverride: "light",
      }),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          ...createEmptyDayLogRecord("2025-12-20"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2025-12-21"),
          symptomIDs: ["cramps"],
          mood: 3,
        },
        {
          ...createEmptyDayLogRecord("2026-01-17"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2026-01-18"),
          symptomIDs: ["cramps"],
          mood: 2,
        },
        {
          ...createEmptyDayLogRecord("2026-02-14"),
          isPeriod: true,
          cycleFactorKeys: ["stress"],
        },
        {
          ...createEmptyDayLogRecord("2026-02-15"),
          symptomIDs: ["cramps"],
          mood: 4,
          cycleFactorKeys: ["travel"],
        },
        {
          ...createEmptyDayLogRecord("2026-03-14"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2026-03-15"),
          bbt: 36.48,
          symptomIDs: ["headache"],
        },
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          bbt: 36.52,
        },
        {
          ...createEmptyDayLogRecord("2026-03-17"),
          bbt: 36.55,
        },
        {
          ...createEmptyDayLogRecord("2026-03-18"),
          bbt: 36.61,
        },
        {
          ...createEmptyDayLogRecord("2026-03-19"),
          bbt: 36.66,
        },
      ]),
    });

    render(
      <AppPreferencesTestProvider>
        <StatsScreen
          now={new Date(2026, 2, 19)}
          storage={storage}
        />
      </AppPreferencesTestProvider>,
    );

    await screen.findByTestId("stats-trend-section");
    expect(screen.getByTestId("stats-trend-section")).toBeTruthy();
    expect(screen.getByTestId("stats-prediction-disclaimer").props.children).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
    expect(screen.getByTestId("stats-symptom-frequency")).toBeTruthy();
    expect(screen.getByTestId("stats-last-cycle-symptoms")).toBeTruthy();
    expect(screen.getByTestId("stats-phase-mood")).toBeTruthy();
    expect(screen.getByTestId("stats-bbt-trend")).toBeTruthy();
    expect(screen.getByTestId("stats-factor-context")).toBeTruthy();
    expect(screen.getByLabelText(/Cycle trend/)).toBeTruthy();
    expect(screen.getByLabelText(/Prediction reliability\. Variable pattern\./)).toBeTruthy();
  });

  it("renders the advanced premium insights block when managed premium is active", async () => {
    const syncSecretStore = createSyncSecretStoreMock({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: "managed-session-1",
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          premium_features: {
            advanced_fertility: true,
            advanced_insights: true,
            doctor_pdf: true,
            extended_reports: true,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ) as unknown as typeof global.fetch;

    const storage = createStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-28",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: true,
        temperatureUnit: "c",
        trackCervicalMucus: true,
        hideSexChip: false,
        languageOverride: "en",
        themeOverride: "light",
      }),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          ...createEmptyDayLogRecord("2025-10-01"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2025-10-14"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2025-10-11"),
          symptomIDs: ["headache"],
        },
        {
          ...createEmptyDayLogRecord("2025-10-29"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2025-11-12"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2025-11-08"),
          symptomIDs: ["headache"],
        },
        {
          ...createEmptyDayLogRecord("2025-11-26"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2025-12-10"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2025-12-06"),
          symptomIDs: ["headache"],
        },
        {
          ...createEmptyDayLogRecord("2025-12-24"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2026-01-08"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2026-01-21"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2026-02-04"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2026-02-18"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2026-03-12"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2026-03-28"),
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2026-03-29"),
          bbt: 36.3,
        },
        {
          ...createEmptyDayLogRecord("2026-03-30"),
          bbt: 36.32,
        },
        {
          ...createEmptyDayLogRecord("2026-03-31"),
          bbt: 36.34,
        },
        {
          ...createEmptyDayLogRecord("2026-04-01"),
          bbt: 36.57,
        },
        {
          ...createEmptyDayLogRecord("2026-04-02"),
          bbt: 36.6,
        },
        {
          ...createEmptyDayLogRecord("2026-04-03"),
          bbt: 36.63,
        },
      ]),
    });

    render(
      <AppPreferencesTestProvider>
        <StatsScreen
          now={new Date(2026, 3, 4)}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />
      </AppPreferencesTestProvider>,
    );

    await screen.findByTestId("stats-advanced-insights");
    expect(screen.getByTestId("stats-personal-forecasts")).toBeTruthy();
    expect(screen.getByText("Personal forecasts")).toBeTruthy();
    expect(screen.getAllByText("Headache").length).toBeGreaterThan(0);
    expect(screen.getByTestId("stats-advanced-fertility")).toBeTruthy();
    expect(screen.getByText("Advanced fertility")).toBeTruthy();
    expect(screen.getByText("Observed luteal phase")).toBeTruthy();
    expect(screen.getByTestId("stats-advanced-insights")).toBeTruthy();
    expect(screen.getByText("Advanced insights")).toBeTruthy();
    expect(screen.getByText("Weighted average")).toBeTruthy();
    expect(screen.getByTestId("stats-extended-reports")).toBeTruthy();
    expect(screen.getByText("Extended reports")).toBeTruthy();
  });
});
