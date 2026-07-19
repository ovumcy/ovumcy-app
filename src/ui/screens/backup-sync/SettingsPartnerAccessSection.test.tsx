import { fireEvent, render, screen } from "@testing-library/react-native";

import { getPartnerCopy } from "../../../i18n/partner-copy";
import type {
  ManagedCloudPartnerAccessGrant,
  ManagedCloudPartnerAccessOverview,
  ManagedCloudPartnerInvite,
} from "../../../sync/managed-cloud-api-client";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { SettingsPartnerAccessSection } from "./SettingsPartnerAccessSection";

const copy = getPartnerCopy("en");

function noop() {}

function createInvite(
  overrides: Partial<ManagedCloudPartnerInvite> = {},
): ManagedCloudPartnerInvite {
  return {
    id: "invite-1",
    ownerAccountID: "owner-1",
    accessLevel: "full",
    status: "pending",
    expiresAt: "2026-04-01T00:00:00.000Z",
    acceptedAt: null,
    acceptedAccountID: null,
    revokedAt: null,
    revokedReason: "",
    createdBy: "owner-1",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function createGrant(
  overrides: Partial<ManagedCloudPartnerAccessGrant> = {},
): ManagedCloudPartnerAccessGrant {
  return {
    id: "grant-1",
    ownerAccountID: "owner-1",
    partnerAccountID: "partner-1",
    accessLevel: "summary",
    sourceInviteID: "invite-1",
    acceptedAt: "2026-03-05T00:00:00.000Z",
    lastSeenAt: "2026-03-10T00:00:00.000Z",
    revokedAt: null,
    revokedReason: "",
    createdAt: "2026-03-05T00:00:00.000Z",
    updatedAt: "2026-03-05T00:00:00.000Z",
    ...overrides,
  };
}

function createBaseProps() {
  return {
    copy,
    errorMessage: "",
    hasManagedSession: false,
    inviteAccessLevel: "full" as const,
    inviteLink: "",
    isBusy: false,
    locale: "en",
    onAcceptInvite: noop,
    onAcceptInviteAsGuest: noop,
    onAccessLevelChange: noop,
    onChooseSignIn: noop,
    onIssueInvite: noop,
    onOpenGrant: noop,
    onRevokeGrant: noop,
    onRevokeInvite: noop,
    overview: null as ManagedCloudPartnerAccessOverview | null,
    pendingInviteToken: "",
    showOwnerControls: false,
    statusMessage: "",
  };
}

describe("SettingsPartnerAccessSection", () => {
  it("wires the revoke/open controls for pending invites and owned and shared grants, across both access levels", () => {
    const onRevokeInvite = jest.fn();
    const onOpenGrant = jest.fn();
    const onRevokeGrant = jest.fn();
    const overview: ManagedCloudPartnerAccessOverview = {
      owned: {
        invites: [createInvite({ id: "invite-1", accessLevel: "summary" })],
        grants: [createGrant({ id: "grant-1", accessLevel: "full" })],
      },
      sharedWithMe: [
        createGrant({
          id: "grant-9",
          partnerAccountID: "me",
          accessLevel: "full",
        }),
      ],
    };

    render(
      <AppPreferencesTestProvider>
        <SettingsPartnerAccessSection
          {...createBaseProps()}
          onOpenGrant={onOpenGrant}
          onRevokeGrant={onRevokeGrant}
          onRevokeInvite={onRevokeInvite}
          overview={overview}
          showOwnerControls
        />
      </AppPreferencesTestProvider>,
    );

    // Pending invite renders with the "summary" access level (the "full"
    // arm is exercised via the owned grant below).
    expect(screen.getByTestId("settings-partner-invite-invite-1")).toBeTruthy();
    expect(
      screen.getByTestId("settings-partner-invite-info-invite-1").props
        .accessibilityLabel,
    ).toContain(copy.accessLevelSummary);
    fireEvent.press(screen.getByTestId("settings-partner-revoke-invite-invite-1"));
    expect(onRevokeInvite).toHaveBeenCalledWith("invite-1");

    // Owned grant renders with "full" (the "summary" arm is exercised by
    // the invite above).
    expect(
      screen.getByTestId("settings-partner-grant-info-grant-1").props
        .accessibilityLabel,
    ).toContain(copy.accessLevelFull);
    fireEvent.press(screen.getByTestId("settings-partner-open-grant-grant-1"));
    fireEvent.press(screen.getByTestId("settings-partner-revoke-grant-grant-1"));
    expect(onOpenGrant).toHaveBeenCalledWith("grant-1");
    expect(onRevokeGrant).toHaveBeenCalledWith("grant-1");

    // Shared-with-me grant open action.
    expect(screen.getByTestId("settings-partner-shared-grant-grant-9")).toBeTruthy();
    fireEvent.press(
      screen.getByTestId("settings-partner-open-shared-grant-grant-9"),
    );
    expect(onOpenGrant).toHaveBeenCalledWith("grant-9");
  });

  it("shows the premium lock card instead of owner controls when the plan is locked, even with existing invite history", () => {
    const overview: ManagedCloudPartnerAccessOverview = {
      owned: {
        invites: [createInvite()],
        grants: [],
      },
      sharedWithMe: [],
    };

    render(
      <AppPreferencesTestProvider>
        <SettingsPartnerAccessSection
          {...createBaseProps()}
          overview={overview}
          showOwnerControls={false}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("settings-partner-plan-lock")).toBeTruthy();
    expect(screen.getByText(copy.premiumLockTitle)).toBeTruthy();
    expect(screen.queryByTestId("settings-partner-issue-button")).toBeNull();
    expect(
      screen.queryByTestId("settings-partner-access-level-full"),
    ).toBeNull();
    // The invite/grant history lists still render underneath the lock card.
    expect(screen.getByTestId("settings-partner-invite-invite-1")).toBeTruthy();
  });

  it("shows the error banner when errorMessage is set", () => {
    render(
      <AppPreferencesTestProvider>
        <SettingsPartnerAccessSection
          {...createBaseProps()}
          errorMessage={copy.errors.networkFailed}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("settings-partner-error-banner")).toBeTruthy();
    expect(screen.getByText(copy.errors.networkFailed)).toBeTruthy();
  });
});
