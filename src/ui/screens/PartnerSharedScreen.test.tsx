import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { InterfaceLanguage } from "../../models/profile";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { PartnerSharedScreen } from "./PartnerSharedScreen";
import { loadManagedPartnerAccess } from "../../services/managed-partner-access-service";
import { loadManagedPartnerProjection } from "../../services/managed-partner-share-service";
import type { PartnerSharedProjectionPayload } from "../../models/partner-share";

const mockUseEffect = React.useEffect;
const mockBack = jest.fn();
let mockSearchParams: { grant_id?: string | string[] } = { grant_id: "grant-1" };

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => ({
      back: mockBack,
    }),
  };
});

jest.mock("../../services/managed-partner-access-service", () => {
  return {
    loadManagedPartnerAccess: jest.fn(),
  };
});

jest.mock("../../services/managed-partner-share-service", () => {
  return {
    loadManagedPartnerProjection: jest.fn(),
  };
});

const mockLoadManagedPartnerAccess = jest.mocked(loadManagedPartnerAccess);
const mockLoadManagedPartnerProjection = jest.mocked(loadManagedPartnerProjection);

function createProjectionPayload(): PartnerSharedProjectionPayload {
  return {
    schemaVersion: 1,
    generatedAt: "2026-04-05T08:00:00.000Z",
    generation: 1,
    accessLevel: "full",
    ownerAccountID: "owner-1",
    grantID: "grant-1",
    profile: {
      ageGroup: "",
      cycleLength: 28,
      hideNotes: false,
      hideSexChip: false,
      irregularCycle: false,
      lastPeriodStart: "2026-04-01",
      periodLength: 5,
      temperatureUnit: "c",
      trackBBT: true,
      trackCervicalMucus: true,
      unpredictableCycle: false,
      usageGoal: "health",
    },
    dayLogs: [
      {
        date: "2026-03-08",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "light",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-03-07",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "light",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-03-06",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-03-05",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-03-04",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-04-05",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "light",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-04-03",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-04-02",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-04-04",
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "light",
        mood: 3,
        sexActivity: "protected",
        bbt: 36.7,
        cervicalMucus: "eggwhite",
        lhTest: "peak",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: ["cramps"],
        notes: "Shared note",
      },
      {
        date: "2026-04-01",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ],
    symptomRecords: [
      {
        id: "cramps",
        slug: "cramps",
        label: "Cramps",
        icon: "",
        color: "#000000",
        isArchived: false,
        sortOrder: 1,
        isDefault: true,
      },
    ],
  };
}

function renderPartnerSharedScreen(
  languageOverride: InterfaceLanguage | null = "en",
  now: Date = new Date("2026-04-05T10:00:00.000Z"),
) {
  return render(
    <AppPreferencesTestProvider languageOverride={languageOverride}>
      <PartnerSharedScreen now={now} />
    </AppPreferencesTestProvider>,
  );
}

function setupMocksWithPayload(payload: PartnerSharedProjectionPayload) {
  mockLoadManagedPartnerAccess.mockResolvedValue({
    ok: true,
    value: {
      owned: { invites: [], grants: [] },
      sharedWithMe: [
        {
          id: "grant-1",
          ownerAccountID: "owner-1",
          partnerAccountID: "partner-1",
          accessLevel: "full",
          sourceInviteID: "invite-1",
          acceptedAt: "2026-04-05T08:00:00.000Z",
          lastSeenAt: "2026-04-05T08:05:00.000Z",
          revokedAt: null,
          revokedReason: "",
          createdAt: "2026-04-05T08:00:00.000Z",
          updatedAt: "2026-04-05T08:05:00.000Z",
        },
      ],
    },
  });
  mockLoadManagedPartnerProjection.mockResolvedValue({ ok: true, value: payload });
}

describe("PartnerSharedScreen", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockSearchParams = { grant_id: "grant-1" };
    mockLoadManagedPartnerAccess.mockReset();
    mockLoadManagedPartnerProjection.mockReset();
  });

  it("renders the managed shared projection for an accepted grant", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [],
        },
        sharedWithMe: [
          {
            id: "grant-1",
            ownerAccountID: "owner-1",
            partnerAccountID: "partner-1",
            accessLevel: "full",
            sourceInviteID: "invite-1",
            acceptedAt: "2026-04-05T08:00:00.000Z",
            lastSeenAt: "2026-04-05T08:05:00.000Z",
            revokedAt: null,
            revokedReason: "",
            createdAt: "2026-04-05T08:00:00.000Z",
            updatedAt: "2026-04-05T08:05:00.000Z",
          },
        ],
      },
    });
    mockLoadManagedPartnerProjection.mockResolvedValue({
      ok: true,
      value: createProjectionPayload(),
    });

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-summary-card");
    expect(screen.getByTestId("partner-shared-history-card")).toBeTruthy();
    expect(screen.getByText("Shared cycle view")).toBeTruthy();
    expect(
      screen.getByText(
        "This read-only view is available only through Ovumcy Cloud partner sharing.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Top symptoms: Cramps")).toBeTruthy();
    expect(screen.getByTestId("partner-shared-row-2026-04-04")).toBeTruthy();
    expect(screen.getByText("Shared note")).toBeTruthy();
    // Medical-safety disclaimer sits with the prediction window (matches the
    // owner Dashboard/Calendar/Stats surfaces; deviates beyond web parity).
    expect(screen.getByTestId("partner-shared-prediction-disclaimer")).toBeTruthy();
    expect(
      screen.getByText(
        "These are estimates, not medical advice or a method of contraception.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("partner-shared-back-button"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("keeps the prediction disclaimer visible in the empty no-data state", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({
      ok: true,
      value: {
        owned: { invites: [], grants: [] },
        sharedWithMe: [
          {
            id: "grant-1",
            ownerAccountID: "owner-1",
            partnerAccountID: "partner-1",
            accessLevel: "full",
            sourceInviteID: "invite-1",
            acceptedAt: "2026-04-05T08:00:00.000Z",
            lastSeenAt: null,
            revokedAt: null,
            revokedReason: "",
            createdAt: "2026-04-05T08:00:00.000Z",
            updatedAt: "2026-04-05T08:05:00.000Z",
          },
        ],
      },
    });
    // No projection uploaded yet → read state stays null → empty card renders.
    mockLoadManagedPartnerProjection.mockResolvedValue({
      ok: false,
      errorCode: "partner_projection_not_found",
    });

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-empty-card");
    expect(screen.queryByTestId("partner-shared-summary-card")).toBeNull();
    // Disclaimer is unconditional, matching how Stats shows it in its empty state.
    expect(screen.getByTestId("partner-shared-prediction-disclaimer")).toBeTruthy();
    expect(
      screen.getByText(
        "These are estimates, not medical advice or a method of contraception.",
      ),
    ).toBeTruthy();
  });

  it("shows the locked-state banner when the share key is unavailable", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [],
        },
        sharedWithMe: [
          {
            id: "grant-1",
            ownerAccountID: "owner-1",
            partnerAccountID: "partner-1",
            accessLevel: "summary",
            sourceInviteID: "invite-1",
            acceptedAt: "2026-04-05T08:00:00.000Z",
            lastSeenAt: null,
            revokedAt: null,
            revokedReason: "",
            createdAt: "2026-04-05T08:00:00.000Z",
            updatedAt: "2026-04-05T08:05:00.000Z",
          },
        ],
      },
    });
    mockLoadManagedPartnerProjection.mockResolvedValue({
      ok: false,
      errorCode: "share_key_unavailable",
    });

    renderPartnerSharedScreen();

    await waitFor(() =>
      expect(screen.getByTestId("partner-shared-error-banner")).toBeTruthy(),
    );
    expect(
      screen.getByText(
        "This device cannot open the shared view because the invite key is missing.",
      ),
    ).toBeTruthy();
  });

  it("shows stale notice and suppresses prediction block when snapshot is 30 days old", async () => {
    const stalePayload: PartnerSharedProjectionPayload = {
      ...createProjectionPayload(),
      generatedAt: "2026-03-01T00:00:00.000Z",
    };
    setupMocksWithPayload(stalePayload);

    // now is 2026-04-05 → 35 days after generatedAt → stale
    renderPartnerSharedScreen("en", new Date("2026-04-05T10:00:00.000Z"));

    await screen.findByTestId("partner-shared-summary-card");
    expect(screen.getByTestId("partner-shared-stale-banner")).toBeTruthy();
    expect(
      screen.getByText("Shared data may be out of date — predictions hidden."),
    ).toBeTruthy();
    // Prediction metrics (cycle day, next period) must not be visible
    expect(screen.queryByText("Cycle day")).toBeNull();
    expect(screen.queryByText("Next period window")).toBeNull();
  });

  it("does not show stale notice when snapshot is fresh", async () => {
    setupMocksWithPayload(createProjectionPayload()); // generatedAt 2026-04-05, now 2026-04-05 (2h old)

    renderPartnerSharedScreen("en", new Date("2026-04-05T10:00:00.000Z"));

    await screen.findByTestId("partner-shared-summary-card");
    expect(screen.queryByTestId("partner-shared-stale-banner")).toBeNull();
    // Prediction metrics should be visible
    expect(screen.getByText("Cycle day")).toBeTruthy();
  });

  it("shows 90-day qualifier on history card when rows are present", async () => {
    setupMocksWithPayload(createProjectionPayload());

    renderPartnerSharedScreen("en", new Date("2026-04-05T10:00:00.000Z"));

    await screen.findByTestId("partner-shared-history-card");
    expect(screen.getByText("Showing the last 90 days.")).toBeTruthy();
  });

  it("shows no qualifier (empty description) on history card when there are no rows", async () => {
    const emptyPayload: PartnerSharedProjectionPayload = {
      ...createProjectionPayload(),
      // summary access → recentRows will be [] in the read state
      accessLevel: "summary",
      dayLogs: [],
    };
    setupMocksWithPayload(emptyPayload);

    renderPartnerSharedScreen("en", new Date("2026-04-05T10:00:00.000Z"));

    await screen.findByTestId("partner-shared-history-card");
    expect(screen.queryByText("Showing the last 90 days.")).toBeNull();
    // The empty body text is still rendered inside the card
    expect(screen.getByText("No shared day-by-day history is available yet.")).toBeTruthy();
  });

  it("localizes shared history details and builtin symptom labels", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [],
        },
        sharedWithMe: [
          {
            id: "grant-1",
            ownerAccountID: "owner-1",
            partnerAccountID: "partner-1",
            accessLevel: "full",
            sourceInviteID: "invite-1",
            acceptedAt: "2026-04-05T08:00:00.000Z",
            lastSeenAt: "2026-04-05T08:05:00.000Z",
            revokedAt: null,
            revokedReason: "",
            createdAt: "2026-04-05T08:00:00.000Z",
            updatedAt: "2026-04-05T08:05:00.000Z",
          },
        ],
      },
    });
    mockLoadManagedPartnerProjection.mockResolvedValue({
      ok: true,
      value: createProjectionPayload(),
    });

    renderPartnerSharedScreen("ru");

    await screen.findByTestId("partner-shared-summary-card");
    expect(screen.getByText("Топ симптомов: Спазмы")).toBeTruthy();
    expect(screen.getAllByText("28 д").length).toBeGreaterThan(0);
    expect(screen.getByText("5 д")).toBeTruthy();
    expect(
      screen.getByText(
        "День менструации · Интенсивность: Слабая · Настроение: 3/5 · Близость: С защитой · БТТ: 36.70 °C · Цервикальная слизь: Как яичный белок · LH-тест: Пик",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Спазмы")).toBeTruthy();
  });
});
