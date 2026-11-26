import { act, renderHook, waitFor } from "@testing-library/react-native";

import { DATA_SHARING_CONSENT_REVISION } from "../../../services/data-sharing-consent-service";
import * as partnerAccessService from "../../../services/managed-partner-access-service";
import * as partnerShareService from "../../../services/managed-partner-share-service";
import { createBackupSyncSessionCoreMock } from "../../../test/create-backup-sync-session-core-mock";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import type { ManagedCloudPartnerAccessGrant } from "../../../sync/managed-cloud-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../../../sync/sync-contract";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useBackupSyncConsentWithdrawal } from "./useBackupSyncConsentWithdrawal";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));
jest.mock("../../../services/managed-partner-access-service");
jest.mock("../../../services/managed-partner-share-service");

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockLoadPartnerAccess = jest.mocked(
  partnerAccessService.loadManagedPartnerAccess,
);
const mockRevokeGrant = jest.mocked(
  partnerAccessService.revokeManagedPartnerGrant,
);
const mockClearGrantKey = jest.mocked(
  partnerShareService.clearManagedPartnerGrantKey,
);

const GIVEN = {
  revision: DATA_SHARING_CONSENT_REVISION,
  givenAt: "2026-05-01T08:00:00.000Z",
};

const WITH_CONSENT: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  dataSharingConsent: { managed_sync: GIVEN },
};

const WITH_PARTNER_CONSENT: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  dataSharingConsent: { managed_sync: GIVEN, partner_share: GIVEN },
};

function liveGrant(
  id: string,
  accessLevel: ManagedCloudPartnerAccessGrant["accessLevel"] = "summary",
): ManagedCloudPartnerAccessGrant {
  return {
    id,
    ownerAccountID: "owner",
    partnerAccountID: "partner-" + id,
    accessLevel,
    sourceInviteID: null,
    acceptedAt: "2026-11-01T08:00:00.000Z",
    lastSeenAt: null,
    revokedAt: null,
    revokedReason: "",
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  };
}

async function renderWithLiveGrants() {
  const storage = createLocalAppStorageMock();
  let record = WITH_PARTNER_CONSENT;
  jest
    .mocked(storage.readSyncPreferencesRecord)
    .mockImplementation(async () => record);
  jest
    .mocked(storage.writeSyncPreferencesRecord)
    .mockImplementation(async (current, patch) => {
      record = { ...current, ...patch };
    });
  mockLoadPartnerAccess.mockResolvedValue({
    ok: true,
    value: {
      owned: {
        invites: [],
        grants: [liveGrant("g1"), liveGrant("g2", "full")],
      },
      sharedWithMe: [],
    },
  });
  const core = createBackupSyncSessionCoreMock({ storage });
  const setPartnerInviteLink = jest.fn();
  const { result } = await renderHook(() =>
    useBackupSyncConsentWithdrawal(core, { setPartnerInviteLink }),
  );
  await waitFor(() =>
    expect(result.current.dataSharingConsentWithdrawal.hasConsent).toBe(true),
  );
  return {
    core,
    setPartnerInviteLink,
    readRecord: () => record,
    result,
    storage,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClearGrantKey.mockResolvedValue(undefined);
});

describe("useBackupSyncConsentWithdrawal", () => {
  it("ignores a purpose load that resolves after the withdrawal", async () => {
    let resolveFirstLoad: (record: SyncPreferencesRecord) => void = () => {};
    const storage = createLocalAppStorageMock();
    jest
      .mocked(storage.readSyncPreferencesRecord)
      .mockImplementationOnce(
        () =>
          new Promise<SyncPreferencesRecord>((resolve) => {
            resolveFirstLoad = resolve;
          }),
      )
      .mockResolvedValue(WITH_CONSENT);
    const core = createBackupSyncSessionCoreMock({ storage });

    const { result } = await renderHook(() => useBackupSyncConsentWithdrawal(core));
    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });
    await act(async () => {
      resolveFirstLoad(WITH_CONSENT);
    });

    expect(result.current.dataSharingConsentWithdrawal.hasConsent).toBe(false);
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe(
      "Consent withdrawn. Nothing more is sent until you agree again.",
    );
  });

  it("offers no control when the stored consent cannot be read", async () => {
    const storage = createLocalAppStorageMock();
    jest
      .mocked(storage.readSyncPreferencesRecord)
      .mockRejectedValue(new Error("locked"));
    const core = createBackupSyncSessionCoreMock({ storage });

    const { result } = await renderHook(() => useBackupSyncConsentWithdrawal(core));

    await waitFor(() =>
      expect(storage.readSyncPreferencesRecord).toHaveBeenCalled(),
    );
    expect(result.current.dataSharingConsentWithdrawal.hasConsent).toBe(false);
    expect(result.current.dataSharingConsentWithdrawal.errorMessage).toBe("");
  });

  it("withdraws in one tap without a confirm when no partner grant is live", async () => {
    const storage = createLocalAppStorageMock();
    jest.mocked(storage.readSyncPreferencesRecord).mockResolvedValue(WITH_CONSENT);
    const core = createBackupSyncSessionCoreMock({ storage });

    const { result } = await renderHook(() => useBackupSyncConsentWithdrawal(core));
    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(mockOpenConfirmation).not.toHaveBeenCalled();
    expect(mockRevokeGrant).not.toHaveBeenCalled();
    expect(core.reloadPartnerAccess).not.toHaveBeenCalled();
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe(
      "Consent withdrawn. Nothing more is sent until you agree again.",
    );
  });

  it("names the live partners in one confirm and changes nothing when it is dismissed", async () => {
    mockOpenConfirmation.mockResolvedValue(false);
    const { result, storage } = await renderWithLiveGrants();

    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(mockOpenConfirmation).toHaveBeenCalledWith(
      [
        "Withdraw consent and revoke access for these partners? Their copy is deleted from the server.",
        "• Partner access · Summary only · Shared view last fetched: Not fetched yet.",
        "• Partner access · Full access · Shared view last fetched: Not fetched yet.",
      ].join("\n"),
      "Withdraw and revoke",
      expect.any(String),
    );
    expect(mockRevokeGrant).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    expect(result.current.dataSharingConsentWithdrawal.hasConsent).toBe(true);
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe("");
    expect(result.current.dataSharingConsentWithdrawal.errorMessage).toBe("");
    expect(result.current.dataSharingConsentWithdrawal.isBusy).toBe(false);
  });

  it("revokes every live grant with its key, withdraws, and reloads without asking again", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    mockRevokeGrant.mockImplementation(async (_store, _mode, grantID) => ({
      ok: true,
      value: liveGrant(grantID),
    }));
    const { core, setPartnerInviteLink, readRecord, result } =
      await renderWithLiveGrants();

    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(mockRevokeGrant.mock.calls.map((call) => call[2])).toEqual(["g1", "g2"]);
    expect(mockClearGrantKey.mock.calls.map((call) => call[1])).toEqual(["g1", "g2"]);
    expect(readRecord().dataSharingConsent).toEqual({});
    expect(setPartnerInviteLink).toHaveBeenCalledTimes(1);
    expect(setPartnerInviteLink).toHaveBeenCalledWith("");
    expect(core.reloadPartnerAccess).toHaveBeenCalledWith(core.state, {
      askPartnerShareConsent: false,
    });
    expect(result.current.dataSharingConsentWithdrawal.hasConsent).toBe(false);
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe(
      "Consent withdrawn and partner access revoked. Nothing more is sent until you agree again.",
    );
    expect(result.current.dataSharingConsentWithdrawal.errorMessage).toBe("");
  });

  it("says a partner kept access when a revoke fails, with the consent still withdrawn", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    mockRevokeGrant
      .mockResolvedValueOnce({ ok: true, value: liveGrant("g1") })
      .mockResolvedValueOnce({ ok: false, errorCode: "network_failed" });
    const { readRecord, result } = await renderWithLiveGrants();

    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(readRecord().dataSharingConsent).toEqual({});
    expect(mockClearGrantKey.mock.calls.map((call) => call[1])).toEqual(["g1"]);
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe("");
    expect(result.current.dataSharingConsentWithdrawal.errorMessage).toBe(
      "Consent withdrawn, so nothing more is sent. Access could not be revoked for every partner: a partner still listed under “Active partner access” can read the last copy until you revoke them there.",
    );
  });

  it("does not report a clean withdrawal when no partner listing could be read", async () => {
    const { readRecord, result } = await renderWithLiveGrants();
    mockLoadPartnerAccess.mockResolvedValue({
      ok: false,
      errorCode: "network_failed",
    });

    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(mockOpenConfirmation).not.toHaveBeenCalled();
    expect(readRecord().dataSharingConsent).toEqual({});
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe("");
    expect(result.current.dataSharingConsentWithdrawal.errorMessage).toMatch(
      /^Consent withdrawn, so nothing more is sent\. Access could not be revoked/,
    );
  });

  it("keeps the withdrawn outcome when the partner reload afterwards fails", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    mockRevokeGrant.mockImplementation(async (_store, _mode, grantID) => ({
      ok: true,
      value: liveGrant(grantID),
    }));
    const { core, result } = await renderWithLiveGrants();
    jest.mocked(core.reloadPartnerAccess).mockRejectedValue(new Error("offline"));

    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe(
      "Consent withdrawn and partner access revoked. Nothing more is sent until you agree again.",
    );
    expect(result.current.dataSharingConsentWithdrawal.isBusy).toBe(false);
  });

  it("does nothing before the settings state has loaded", async () => {
    const storage = createLocalAppStorageMock();
    const core = createBackupSyncSessionCoreMock({ state: null, storage });

    const { result } = await renderHook(() => useBackupSyncConsentWithdrawal(core));
    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(storage.readSyncPreferencesRecord).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe("");
  });

  it("adds the generic error when a revoked grant's key could not be cleared", async () => {
    mockOpenConfirmation.mockResolvedValue(true);
    mockRevokeGrant.mockImplementation(async (_store, _mode, grantID) => ({
      ok: true,
      value: liveGrant(grantID),
    }));
    mockClearGrantKey.mockRejectedValue(new Error("secure store"));
    const { core, result } = await renderWithLiveGrants();

    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });

    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe(
      "Consent withdrawn and partner access revoked. Nothing more is sent until you agree again.",
    );
    expect(result.current.dataSharingConsentWithdrawal.errorMessage).toBe(
      core.partnerCopy.errors.generic,
    );
  });
});
