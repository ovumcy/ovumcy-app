import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import type {
  DayCervicalMucus,
  DayCycleFactorKey,
  DayFlow,
  DayLHTest,
} from "../../models/day-log";
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
    // Full access shows the detailed hint (contrast: summary-access test below).
    expect(
      screen.getByText(
        "Full access includes the shared summary and the detailed day-by-day history that the owner allowed.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Top symptoms: Cramps")).toBeTruthy();
    expect(screen.getByTestId("partner-shared-row-2026-04-04")).toBeTruthy();
    expect(screen.getByText("Shared note")).toBeTruthy();
    // One shared day is one announcement: date, details, symptoms, factors and
    // note arrive together instead of as five orphan lines.
    const sharedRow = screen.getByTestId("partner-shared-row-2026-04-04");
    expect(sharedRow.props.accessible).toBe(true);
    expect(sharedRow.props.accessibilityLabel).toContain("Shared note");
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

describe("PartnerSharedScreen state orchestration", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockSearchParams = { grant_id: "grant-1" };
    mockLoadManagedPartnerAccess.mockReset();
    mockLoadManagedPartnerProjection.mockReset();
  });

  it("shows the loading state before the shared view resolves, and back navigation still works", () => {
    // Never resolves within this test: proves the loading branch renders
    // (title/subtitle/back button) independent of any service response.
    mockLoadManagedPartnerAccess.mockReturnValue(new Promise(() => {}));

    renderPartnerSharedScreen();

    expect(screen.getByText("Loading shared view")).toBeTruthy();
    expect(
      screen.getByText("Decrypting the shared partner view on this device."),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("partner-shared-back-button"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("falls back to the current wall-clock time when no now override is provided", () => {
    // Never resolves: only the synchronous initial render matters here,
    // proving `now ?? new Date()` in the component doesn't throw or hang
    // when the optional `now` prop is omitted (the real app call site).
    mockLoadManagedPartnerAccess.mockReturnValue(new Promise(() => {}));

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <PartnerSharedScreen />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByText("Loading shared view")).toBeTruthy();
  });

  it.each<[string, string | string[] | undefined]>([
    ["missing", undefined],
    ["whitespace-only", "   "],
    ["an empty array", []],
  ])(
    "shows a not-found error when the grant id is %s, without calling the access service",
    async (_label, grantID) => {
      mockSearchParams = grantID === undefined ? {} : { grant_id: grantID };

      renderPartnerSharedScreen();

      await waitFor(() =>
        expect(screen.getByTestId("partner-shared-error-banner")).toBeTruthy(),
      );
      expect(
        screen.getByText("This partner access record could not be found."),
      ).toBeTruthy();
      expect(mockLoadManagedPartnerAccess).not.toHaveBeenCalled();
    },
  );

  it("shows a not-found error when the grant id matches neither an owned nor a shared grant, and the empty-card back button navigates back", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({
      ok: true,
      value: { owned: { invites: [], grants: [] }, sharedWithMe: [] },
    });

    renderPartnerSharedScreen();

    await waitFor(() =>
      expect(screen.getByTestId("partner-shared-error-banner")).toBeTruthy(),
    );
    expect(
      screen.getByText("This partner access record could not be found."),
    ).toBeTruthy();
    expect(mockLoadManagedPartnerProjection).not.toHaveBeenCalled();

    // readState stayed null, so the empty-state card (with its own back
    // button, separate from the top InlineBackButton) also renders.
    fireEvent.press(screen.getByTestId("partner-shared-empty-back-button"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("finds the grant among the caller's own owned grants when it is absent from sharedWithMe", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [
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
        sharedWithMe: [],
      },
    });
    mockLoadManagedPartnerProjection.mockResolvedValue({
      ok: true,
      value: createProjectionPayload(),
    });

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-summary-card");
    expect(mockLoadManagedPartnerProjection).toHaveBeenCalledTimes(1);
  });

  it("resolves a route param delivered as an array of grant ids", async () => {
    mockSearchParams = { grant_id: ["grant-1"] };
    setupMocksWithPayload(createProjectionPayload());

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-summary-card");
  });

  it("maps a not-connected access error to its sign-in message", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({ ok: false, errorCode: "not_connected" });

    renderPartnerSharedScreen();

    await waitFor(() =>
      expect(screen.getByTestId("partner-shared-error-banner")).toBeTruthy(),
    );
    expect(screen.getByText("Sign in to Ovumcy Cloud first.")).toBeTruthy();
  });

  it("maps an unrecognized access error code to the generic retry message", async () => {
    mockLoadManagedPartnerAccess.mockResolvedValue({ ok: false, errorCode: "rate_limited" });

    renderPartnerSharedScreen();

    await waitFor(() =>
      expect(screen.getByTestId("partner-shared-error-banner")).toBeTruthy(),
    );
    expect(
      screen.getByText("Unable to update partner access right now. Please try again."),
    ).toBeTruthy();
  });

  it("maps an invalid-projection error to the generic retry message", async () => {
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
    mockLoadManagedPartnerProjection.mockResolvedValue({
      ok: false,
      errorCode: "invalid_partner_projection",
    });

    renderPartnerSharedScreen();

    await waitFor(() =>
      expect(screen.getByTestId("partner-shared-error-banner")).toBeTruthy(),
    );
    expect(
      screen.getByText("Unable to update partner access right now. Please try again."),
    ).toBeTruthy();
  });

  it("shows the summary-access hint instead of the full-access hint for a summary grant", async () => {
    const payload: PartnerSharedProjectionPayload = {
      ...createProjectionPayload(),
      accessLevel: "summary",
    };
    setupMocksWithPayload(payload);

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-summary-card");
    expect(
      screen.getByText(
        "Summary access keeps the lighter shared overview without detailed day-by-day history.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        "Full access includes the shared summary and the detailed day-by-day history that the owner allowed.",
      ),
    ).toBeNull();
  });

  it("shows placeholder dashes for cycle day and next period window when there is no cycle anchor yet", async () => {
    const base = createProjectionPayload();
    const payload: PartnerSharedProjectionPayload = {
      ...base,
      dayLogs: [],
      symptomRecords: [],
      profile: { ...base.profile, lastPeriodStart: null },
    };
    setupMocksWithPayload(payload);

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-summary-card");
    expect(screen.getByText("Cycle day")).toBeTruthy();
    expect(screen.getByText("Next period window")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a projected next-period date range once three completed cycles exist", async () => {
    const base = createProjectionPayload();
    const payload: PartnerSharedProjectionPayload = {
      ...base,
      generatedAt: "2026-04-05T09:00:00.000Z",
      profile: { ...base.profile, lastPeriodStart: "2026-03-30", irregularCycle: false },
      dayLogs: [
        { ...createEmptyDayLogRecord("2026-01-05"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-02-01"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-03-02"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-03-30"), isPeriod: true, cycleStart: true },
      ],
      symptomRecords: [],
    };
    setupMocksWithPayload(payload);

    renderPartnerSharedScreen("en", new Date("2026-04-05T10:00:00.000Z"));

    await screen.findByTestId("partner-shared-summary-card");
    // "Mon D - Mon D" — a real range, not the "—" placeholder.
    expect(screen.getByText(/^[A-Za-z]{3} \d{1,2} - [A-Za-z]{3} \d{1,2}$/)).toBeTruthy();
  });

  it("collapses the next-period window to a single date when the irregular-cycle spread is zero", async () => {
    // Three completed cycles of the *same* length give an irregular-cycle
    // window with an identical start and end date (min == max spread), so
    // formatDateRange's range-vs-single-date fallback resolves to one label
    // instead of a "Mon D - Mon D" span.
    const base = createProjectionPayload();
    const payload: PartnerSharedProjectionPayload = {
      ...base,
      generatedAt: "2026-04-05T09:00:00.000Z",
      profile: { ...base.profile, lastPeriodStart: "2026-03-30", irregularCycle: true },
      dayLogs: [
        { ...createEmptyDayLogRecord("2026-01-05"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-02-02"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-03-02"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-03-30"), isPeriod: true, cycleStart: true },
      ],
      symptomRecords: [],
    };
    setupMocksWithPayload(payload);

    renderPartnerSharedScreen("en", new Date("2026-04-05T10:00:00.000Z"));

    await screen.findByTestId("partner-shared-summary-card");
    expect(screen.getByText(/^[A-Za-z]{3} \d{1,2}$/)).toBeTruthy();
    expect(screen.queryByText(/^[A-Za-z]{3} \d{1,2} - [A-Za-z]{3} \d{1,2}$/)).toBeNull();
  });

  it("guards against a state update after the screen unmounts while the shared view is loading", async () => {
    setupMocksWithPayload(createProjectionPayload());
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderPartnerSharedScreen();
    unmount();

    await waitFor(() => expect(mockLoadManagedPartnerProjection).toHaveBeenCalledTimes(1));
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("PartnerSharedScreen privacy invariants and row rendering", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockSearchParams = { grant_id: "grant-1" };
    mockLoadManagedPartnerAccess.mockReset();
    mockLoadManagedPartnerProjection.mockReset();
  });

  it("never renders the pregnancy-test field on the read-only shared view, even if a row carries a value", async () => {
    const payload: PartnerSharedProjectionPayload = {
      ...createProjectionPayload(),
      dayLogs: [
        {
          ...createEmptyDayLogRecord("2026-04-04"),
          isPeriod: true,
          // Defense in depth: the owner-side projection builder
          // (partner-shared-projection-service.ts) always zeroes
          // pregnancyTest before upload. The read-only history row must
          // never surface it even if a legacy or corrupted payload carried
          // a real value — buildHistoryDetailText has no pregnancyTest
          // branch at all, unlike every other day-log field.
          pregnancyTest: "positive",
        },
      ],
      symptomRecords: [],
    };
    setupMocksWithPayload(payload);

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-history-card");
    // The row's detail line is exactly "Period day" — no pregnancy-test
    // label is ever appended, unlike flow/mood/sex/bbt/cervicalMucus/lhTest.
    expect(screen.getByText("Period day")).toBeTruthy();
    expect(screen.queryByText("Positive")).toBeNull();
    // Note (out of this UI-only tranche's scope, not fixed here): a leaked
    // pregnancyTest also feeds the *shared* buildCurrentCycleProjection /
    // buildPredictionExplanation pipeline this screen reuses from the owner
    // surfaces, so the generic "predictions paused" explanation text can
    // still indirectly reflect a pause even though the field itself is
    // never labeled. In real operation this is unreachable because
    // partner-shared-projection-service.redactDayLogForPartner always zeroes
    // pregnancyTest before a projection is ever uploaded — the redaction
    // boundary is the projection builder, not this screen, per
    // architecture.md ("access-level filtering lives in shared projection
    // services").
  });

  it("falls back to raw option values, lists cycle factors outside the known catalog, and hides the detail line when a row has no notable fields", async () => {
    const base = createProjectionPayload();
    const payload: PartnerSharedProjectionPayload = {
      ...base,
      // Exercises the Fahrenheit display branch (the other fixtures in this
      // file are all Celsius).
      profile: { ...base.profile, temperatureUnit: "f" },
      dayLogs: [
        {
          ...createEmptyDayLogRecord("2026-04-03"),
          isPeriod: true,
          // Simulates forward/backward-compat: an option value or cycle
          // factor this reader's copy catalog does not recognize (e.g. a
          // newer owner-app version, or a removed/renamed factor key).
          flow: "unusual_flow" as DayFlow,
          bbt: 37,
          cervicalMucus: "unusual_cm" as DayCervicalMucus,
          lhTest: "unusual_lh" as DayLHTest,
          cycleFactorKeys: ["travel", "legacy_removed_factor" as DayCycleFactorKey],
        },
        {
          ...createEmptyDayLogRecord("2026-04-02"),
          notes: "Quiet day, nothing notable",
        },
      ],
      symptomRecords: [],
    };
    setupMocksWithPayload(payload);

    renderPartnerSharedScreen();

    await screen.findByTestId("partner-shared-row-2026-04-03");
    expect(
      screen.getByText(
        "Period day · Flow: unusual_flow · BBT: 98.60 °F · Cervical mucus: unusual_cm · LH test: unusual_lh",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Travel, legacy_removed_factor")).toBeTruthy();

    expect(screen.getByTestId("partner-shared-row-2026-04-02")).toBeTruthy();
    expect(screen.getByText("Quiet day, nothing notable")).toBeTruthy();
  });
});
