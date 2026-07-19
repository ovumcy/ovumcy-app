import { act, renderHook } from "@testing-library/react-native";

import {
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteToken,
} from "../../../security/managed-partner-invite-token-buffer";
import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import * as managedPartnerAccessService from "../../../services/managed-partner-access-service";
import * as managedPartnerShareService from "../../../services/managed-partner-share-service";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import type { ManagedCloudPartnerAccessGrant } from "../../../sync/managed-cloud-api-client";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useBackupSyncPartnerAccess } from "./useBackupSyncPartnerAccess";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../services/managed-partner-access-service");
jest.mock("../../../services/managed-partner-share-service");
jest.mock("../../../services/backup-sync-screen-service");

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockIssueManagedPartnerInvite = jest.mocked(
  managedPartnerAccessService.issueManagedPartnerInvite,
);
const mockAcceptManagedPartnerInvite = jest.mocked(
  managedPartnerAccessService.acceptManagedPartnerInvite,
);
const mockRevokeManagedPartnerInvite = jest.mocked(
  managedPartnerAccessService.revokeManagedPartnerInvite,
);
const mockRevokeManagedPartnerGrant = jest.mocked(
  managedPartnerAccessService.revokeManagedPartnerGrant,
);
const mockAcceptBackupSyncPartnerInviteAsGuest = jest.mocked(
  backupSyncScreenService.acceptBackupSyncPartnerInviteAsGuest,
);
const mockStoreIssuedManagedPartnerInviteKey = jest.mocked(
  managedPartnerShareService.storeIssuedManagedPartnerInviteKey,
);
const mockStoreAcceptedManagedPartnerGrantKey = jest.mocked(
  managedPartnerShareService.storeAcceptedManagedPartnerGrantKey,
);
const mockClearManagedPartnerGrantKey = jest.mocked(
  managedPartnerShareService.clearManagedPartnerGrantKey,
);

function createGrant(
  overrides: Partial<ManagedCloudPartnerAccessGrant> = {},
): ManagedCloudPartnerAccessGrant {
  return {
    id: "grant-1",
    ownerAccountID: "owner-1",
    partnerAccountID: "partner-1",
    accessLevel: "summary",
    sourceInviteID: "invite-1",
    acceptedAt: "2026-03-18T08:00:00.000Z",
    lastSeenAt: null,
    revokedAt: null,
    revokedReason: "",
    createdAt: "2026-03-18T08:00:00.000Z",
    updatedAt: "2026-03-18T08:00:00.000Z",
    ...overrides,
  };
}

describe("useBackupSyncPartnerAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearManagedPartnerInviteToken();
    mockStoreIssuedManagedPartnerInviteKey.mockResolvedValue(undefined);
    mockStoreAcceptedManagedPartnerGrantKey.mockResolvedValue(undefined);
    mockClearManagedPartnerGrantKey.mockResolvedValue(undefined);
  });

  describe("handleIssuePartnerInvite", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleIssuePartnerInvite();
      });

      expect(core.resetPartnerFeedback).not.toHaveBeenCalled();
      expect(mockIssueManagedPartnerInvite).not.toHaveBeenCalled();
    });

    it("forwards the currently selected access level to the service", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockIssueManagedPartnerInvite.mockResolvedValue({
        ok: true,
        value: {
          invite: {
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
            createdAt: "2026-03-20T08:00:00.000Z",
            updatedAt: "2026-03-20T08:00:00.000Z",
          },
          inviteURL: "https://invite.ovumcy.cloud/i/abc123",
        },
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      act(() => {
        result.current.setPartnerInviteAccessLevel("full");
      });

      await act(async () => {
        await result.current.handleIssuePartnerInvite();
      });

      expect(mockIssueManagedPartnerInvite).toHaveBeenCalledWith(
        core.syncSecretStore,
        core.state!.syncPreferences.mode,
        { accessLevel: "full" },
      );
    });

    it("surfaces the mapped error message when issuing fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockIssueManagedPartnerInvite.mockResolvedValue({
        ok: false,
        errorCode: "not_connected",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleIssuePartnerInvite();
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.notConnected,
      );
      expect(mockStoreIssuedManagedPartnerInviteKey).not.toHaveBeenCalled();
      expect(result.current.isPartnerBusy).toBe(false);
    });

    it("surfaces the generic error when persisting the invite key throws", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockIssueManagedPartnerInvite.mockResolvedValue({
        ok: true,
        value: {
          invite: {
            id: "invite-1",
            ownerAccountID: "owner-1",
            accessLevel: "summary",
            status: "pending",
            expiresAt: "2026-04-01T00:00:00.000Z",
            acceptedAt: null,
            acceptedAccountID: null,
            revokedAt: null,
            revokedReason: "",
            createdBy: "owner-1",
            createdAt: "2026-03-20T08:00:00.000Z",
            updatedAt: "2026-03-20T08:00:00.000Z",
          },
          inviteURL: "https://invite.ovumcy.cloud/i/abc123",
        },
      });
      mockStoreIssuedManagedPartnerInviteKey.mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleIssuePartnerInvite();
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.generic,
      );
      expect(result.current.partnerInviteLink).toBe("");
      expect(core.reloadPartnerAccess).not.toHaveBeenCalled();
      expect(result.current.isPartnerBusy).toBe(false);
    });

    it("stores the invite link and refreshes partner access on success", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockIssueManagedPartnerInvite.mockResolvedValue({
        ok: true,
        value: {
          invite: {
            id: "invite-1",
            ownerAccountID: "owner-1",
            accessLevel: "summary",
            status: "pending",
            expiresAt: "2026-04-01T00:00:00.000Z",
            acceptedAt: null,
            acceptedAccountID: null,
            revokedAt: null,
            revokedReason: "",
            createdBy: "owner-1",
            createdAt: "2026-03-20T08:00:00.000Z",
            updatedAt: "2026-03-20T08:00:00.000Z",
          },
          inviteURL: "https://invite.ovumcy.cloud/i/abc123",
        },
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleIssuePartnerInvite();
      });

      expect(result.current.partnerInviteLink).toBe(
        "https://invite.ovumcy.cloud/i/abc123",
      );
      expect(core.setPartnerStatusMessage).toHaveBeenCalledWith(
        core.partnerCopy.statusInviteIssued,
      );
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(core.state);
      expect(result.current.isPartnerBusy).toBe(false);
    });
  });

  describe("handleAcceptPartnerInvite", () => {
    it("does nothing without a loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: null,
        pendingPartnerInviteToken: "invite-token",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInvite();
      });

      expect(mockAcceptManagedPartnerInvite).not.toHaveBeenCalled();
    });

    it("does nothing without a pending invite token", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInvite();
      });

      expect(mockAcceptManagedPartnerInvite).not.toHaveBeenCalled();
    });

    it("surfaces the mapped error message when accept fails", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "invite-token",
      });
      mockAcceptManagedPartnerInvite.mockResolvedValue({
        ok: false,
        errorCode: "partner_invite_expired",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInvite();
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.partnerInviteExpired,
      );
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
    });

    it("surfaces the generic error when persisting the grant key throws", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "invite-token",
      });
      const grant = createGrant();
      mockAcceptManagedPartnerInvite.mockResolvedValue({
        ok: true,
        value: {
          invite: {
            id: "invite-1",
            ownerAccountID: "owner-1",
            accessLevel: "summary",
            status: "accepted",
            expiresAt: "2026-04-01T00:00:00.000Z",
            acceptedAt: "2026-03-20T08:00:00.000Z",
            acceptedAccountID: "partner-1",
            revokedAt: null,
            revokedReason: "",
            createdBy: "owner-1",
            createdAt: "2026-03-18T00:00:00.000Z",
            updatedAt: "2026-03-20T08:00:00.000Z",
          },
          grant,
        },
      });
      mockStoreAcceptedManagedPartnerGrantKey.mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInvite();
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.generic,
      );
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
      expect(readManagedPartnerInviteToken()).toBe("");
    });

    it("clears the pending invite, navigates back, and refreshes partner access on success", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "invite-token",
      });
      const grant = createGrant();
      mockAcceptManagedPartnerInvite.mockResolvedValue({
        ok: true,
        value: {
          invite: {
            id: "invite-1",
            ownerAccountID: "owner-1",
            accessLevel: "summary",
            status: "accepted",
            expiresAt: "2026-04-01T00:00:00.000Z",
            acceptedAt: "2026-03-20T08:00:00.000Z",
            acceptedAccountID: "partner-1",
            revokedAt: null,
            revokedReason: "",
            createdBy: "owner-1",
            createdAt: "2026-03-18T00:00:00.000Z",
            updatedAt: "2026-03-20T08:00:00.000Z",
          },
          grant,
        },
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInvite();
      });

      expect(mockStoreAcceptedManagedPartnerGrantKey).toHaveBeenCalledWith(
        core.partnerShareSecretStore,
        grant,
        "invite-token",
        core.effectiveNow,
      );
      expect(core.setPartnerStatusMessage).toHaveBeenCalledWith(
        core.partnerCopy.statusInviteAccepted,
      );
      expect(readManagedPartnerInviteToken()).toBe("");
      expect(core.setPendingPartnerInviteToken).toHaveBeenCalledWith("");
      expect(core.router.replace).toHaveBeenCalledWith("/backup-sync");
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(core.state);
      // The owner (already-signed-in) accept path never mutates the session
      // state itself — only the guest path does.
      expect(core.setState).not.toHaveBeenCalled();
    });
  });

  describe("handleAcceptPartnerInviteAsGuest", () => {
    it("does nothing without a loaded state or pending invite token", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInviteAsGuest();
      });

      expect(mockAcceptBackupSyncPartnerInviteAsGuest).not.toHaveBeenCalled();
    });

    it("surfaces the mapped error message when the guest accept fails", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "invite-token",
      });
      mockAcceptBackupSyncPartnerInviteAsGuest.mockResolvedValue({
        ok: false,
        errorCode: "partner_invite_not_found",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInviteAsGuest();
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.partnerInviteNotFound,
      );
      expect(core.setState).not.toHaveBeenCalled();
    });

    it("surfaces the generic error when persisting the grant key throws", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "invite-token",
      });
      const guestState = createLoadedSettingsStateFixture({
        hasSyncSession: true,
      });
      mockAcceptBackupSyncPartnerInviteAsGuest.mockResolvedValue({
        ok: true,
        state: guestState,
        grant: createGrant(),
      });
      mockStoreAcceptedManagedPartnerGrantKey.mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInviteAsGuest();
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.generic,
      );
      // The guest session was already redeemed server-side even though the
      // local key-store write failed, so the caller does NOT roll back state.
      expect(core.setState).not.toHaveBeenCalled();
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
    });

    it("persists the new guest session, clears the invite, navigates, and refreshes partner access on success", async () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "invite-token",
      });
      const guestState = createLoadedSettingsStateFixture({
        hasSyncSession: true,
      });
      const grant = createGrant();
      mockAcceptBackupSyncPartnerInviteAsGuest.mockResolvedValue({
        ok: true,
        state: guestState,
        grant,
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleAcceptPartnerInviteAsGuest();
      });

      expect(mockAcceptBackupSyncPartnerInviteAsGuest).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
        "invite-token",
        core.effectiveNow,
      );
      expect(mockStoreAcceptedManagedPartnerGrantKey).toHaveBeenCalledWith(
        core.partnerShareSecretStore,
        grant,
        "invite-token",
        core.effectiveNow,
      );
      // Unlike the logged-in accept path, the guest path DOES adopt the
      // freshly minted session state and reloads partner access using it
      // (not the stale pre-accept `state`).
      expect(core.setState).toHaveBeenCalledWith(guestState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(guestState);
      expect(core.setPartnerStatusMessage).toHaveBeenCalledWith(
        core.partnerCopy.statusInviteAccepted,
      );
      expect(readManagedPartnerInviteToken()).toBe("");
      expect(core.setPendingPartnerInviteToken).toHaveBeenCalledWith("");
      expect(core.router.replace).toHaveBeenCalledWith("/backup-sync");
    });
  });

  describe("handleChoosePartnerSignIn", () => {
    it("only resets partner feedback and leaves the pending invite untouched", () => {
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "invite-token",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      act(() => {
        result.current.handleChoosePartnerSignIn();
      });

      expect(core.resetPartnerFeedback).toHaveBeenCalledTimes(1);
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
      expect(mockAcceptManagedPartnerInvite).not.toHaveBeenCalled();
      expect(mockAcceptBackupSyncPartnerInviteAsGuest).not.toHaveBeenCalled();
      // The single-use token must survive this choice so "Accept as guest"
      // still works afterward.
      expect(readManagedPartnerInviteToken()).toBe("");
    });
  });

  describe("handleRevokePartnerInvite", () => {
    it("does nothing without a loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerInvite("invite-1");
      });

      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockRevokeManagedPartnerInvite).not.toHaveBeenCalled();
    });

    it("asks for confirmation with the expected copy and does not revoke on decline", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerInvite("invite-1");
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.partnerCopy.revokeInviteLabel,
        core.viewData.common.confirmAction,
        core.viewData.common.cancelAction,
      );
      expect(mockRevokeManagedPartnerInvite).not.toHaveBeenCalled();
    });

    it("surfaces the mapped error message when revoke fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(true);
      mockRevokeManagedPartnerInvite.mockResolvedValue({
        ok: false,
        errorCode: "not_connected",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerInvite("invite-1");
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.notConnected,
      );
      expect(core.reloadPartnerAccess).not.toHaveBeenCalled();
      expect(result.current.isPartnerBusy).toBe(false);
    });

    it("revokes the invite and refreshes partner access on confirmed success", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(true);
      mockRevokeManagedPartnerInvite.mockResolvedValue({
        ok: true,
        value: {
          id: "invite-1",
          ownerAccountID: "owner-1",
          accessLevel: "summary",
          status: "revoked",
          expiresAt: "2026-04-01T00:00:00.000Z",
          acceptedAt: null,
          acceptedAccountID: null,
          revokedAt: "2026-03-20T08:00:00.000Z",
          revokedReason: "owner_revoked",
          createdBy: "owner-1",
          createdAt: "2026-03-18T00:00:00.000Z",
          updatedAt: "2026-03-20T08:00:00.000Z",
        },
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerInvite("invite-1");
      });

      expect(mockRevokeManagedPartnerInvite).toHaveBeenCalledWith(
        core.syncSecretStore,
        core.state!.syncPreferences.mode,
        "invite-1",
      );
      expect(core.setPartnerStatusMessage).toHaveBeenCalledWith(
        core.partnerCopy.statusInviteRevoked,
      );
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(core.state);
      expect(result.current.isPartnerBusy).toBe(false);
    });
  });

  describe("handleRevokePartnerGrant", () => {
    it("does nothing without a loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerGrant("grant-1");
      });

      expect(mockRevokeManagedPartnerGrant).not.toHaveBeenCalled();
    });

    it("does not revoke when the owner declines the confirm", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerGrant("grant-1");
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.partnerCopy.revokeGrantLabel,
        core.viewData.common.confirmAction,
        core.viewData.common.cancelAction,
      );
      expect(mockRevokeManagedPartnerGrant).not.toHaveBeenCalled();
    });

    it("surfaces the mapped error and never touches the local grant key when the server call fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(true);
      mockRevokeManagedPartnerGrant.mockResolvedValue({
        ok: false,
        errorCode: "not_connected",
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerGrant("grant-1");
      });

      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.notConnected,
      );
      expect(mockClearManagedPartnerGrantKey).not.toHaveBeenCalled();
      expect(core.reloadPartnerAccess).not.toHaveBeenCalled();
      expect(result.current.isPartnerBusy).toBe(false);
    });

    it("clears the local grant key and refreshes partner access on confirmed success", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(true);
      mockRevokeManagedPartnerGrant.mockResolvedValue({
        ok: true,
        value: createGrant({ revokedAt: "2026-03-20T08:00:00.000Z" }),
      });
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerGrant("grant-1");
      });

      expect(mockClearManagedPartnerGrantKey).toHaveBeenCalledWith(
        core.partnerShareSecretStore,
        "grant-1",
      );
      expect(core.setPartnerStatusMessage).toHaveBeenCalledWith(
        core.partnerCopy.statusGrantRevoked,
      );
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(core.state);
      expect(result.current.isPartnerBusy).toBe(false);
    });

    it("still surfaces success after a non-fatal failure to clear the local grant key", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(true);
      mockRevokeManagedPartnerGrant.mockResolvedValue({
        ok: true,
        value: createGrant({ revokedAt: "2026-03-20T08:00:00.000Z" }),
      });
      mockClearManagedPartnerGrantKey.mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      await act(async () => {
        await result.current.handleRevokePartnerGrant("grant-1");
      });

      // The server already accepted the revoke, so the flow still ends in
      // the success state even though the local key cleanup failed...
      expect(core.setPartnerErrorMessage).toHaveBeenCalledWith(
        core.partnerCopy.errors.generic,
      );
      expect(core.setPartnerStatusMessage).toHaveBeenCalledWith(
        core.partnerCopy.statusGrantRevoked,
      );
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(core.state);
      expect(result.current.isPartnerBusy).toBe(false);
    });
  });

  describe("handleOpenPartnerGrant", () => {
    it("navigates to the read-only partner-shared route with the grant id", () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncPartnerAccess(core));

      act(() => {
        result.current.handleOpenPartnerGrant("grant-42");
      });

      expect(core.router.push).toHaveBeenCalledWith({
        pathname: "/partner-shared",
        params: { grant_id: "grant-42" },
      });
    });
  });
});
