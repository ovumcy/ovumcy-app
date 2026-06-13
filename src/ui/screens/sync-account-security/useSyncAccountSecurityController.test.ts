import { act, renderHook } from "@testing-library/react-native";

import { createSyncSecretsRecord } from "../../../security/sync-crypto";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../../../sync/sync-contract";
import * as syncTOTPService from "../../../sync/sync-totp-service";
import * as syncAccountSessionService from "../../../sync/sync-account-session-service";
import { useSyncAccountSecurityController } from "./useSyncAccountSecurityController";

function connectedSecrets() {
  const { record } = createSyncSecretsRecord(
    "Pixel 7",
    new Date("2026-05-17T08:00:00.000Z"),
  );
  return {
    ...record,
    authSessionToken: "community-session-1",
    managedAuthSessionToken: "managed-session-1",
  };
}

function managedPreferences(): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
  };
}

describe("useSyncAccountSecurityController", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleVerifyTOTPEnrollment", () => {
    it("re-derives twoFactorEnabled from the server after successful verify", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      // Initial describe on mount returns unknown (null)
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValueOnce(null)
        // After verify succeeds, describe returns the real server state
        .mockResolvedValueOnce({ twoFactorEnabled: true });

      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      // Wait for initial mount effect
      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBeNull();

      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(syncAccountSessionService.describeSyncAccountTwoFactor).toHaveBeenCalledTimes(2);
      expect(result.current.twoFactorEnabled).toBe(true);
    });

    it("keeps previous twoFactorEnabled when describe fails after verify", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        // Mount: returns false (was already disabled)
        .mockResolvedValueOnce({ twoFactorEnabled: false })
        // After verify: describe fails
        .mockResolvedValueOnce(null);

      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBe(false);

      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      // State is preserved from before the mutation
      expect(result.current.twoFactorEnabled).toBe(false);
    });
  });

  describe("handleDisableTOTP", () => {
    it("re-derives twoFactorEnabled from the server after successful disable", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        // Mount: 2FA is on
        .mockResolvedValueOnce({ twoFactorEnabled: true })
        // After disable: server confirms it's off
        .mockResolvedValueOnce({ twoFactorEnabled: false });

      jest
        .spyOn(syncTOTPService, "disableTOTP")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBe(true);

      await act(async () => {
        await result.current.handleDisableTOTP();
      });

      expect(syncAccountSessionService.describeSyncAccountTwoFactor).toHaveBeenCalledTimes(2);
      expect(result.current.twoFactorEnabled).toBe(false);
    });

    it("keeps previous twoFactorEnabled when describe fails after disable", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        // Mount: 2FA is on
        .mockResolvedValueOnce({ twoFactorEnabled: true })
        // After disable: describe fails
        .mockResolvedValueOnce(null);

      jest
        .spyOn(syncTOTPService, "disableTOTP")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBe(true);

      await act(async () => {
        await result.current.handleDisableTOTP();
      });

      // Preserved from before the mutation
      expect(result.current.twoFactorEnabled).toBe(true);
    });
  });
});
