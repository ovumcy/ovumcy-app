import type { SyncAPIClient } from "../sync/sync-api-client";

// One call per client method, so a transport sweep (redirect refusal, request
// timeout) covers every endpoint; a new method fails the sweep's key check.
export const SYNC_ENDPOINTS: Record<
  keyof SyncAPIClient,
  (client: SyncAPIClient) => Promise<unknown>
> = {
  attachDevice: (c) => c.attachDevice("s", { deviceID: "d", deviceLabel: "Phone" }),
  listDevices: (c) => c.listDevices("s"),
  removeDevice: (c) => c.removeDevice("s", { deviceID: "d" }),
  getBlob: (c) => c.getBlob("s"),
  getCapabilities: (c) => c.getCapabilities("s"),
  getRecoveryKey: (c) => c.getRecoveryKey("s"),
  getSession: (c) => c.getSession("s"),
  login: (c) => c.login({ login: "a", password: "p" }),
  logout: (c) => c.logout("s"),
  deleteAccount: (c) => c.deleteAccount("s", { currentPassword: "p" }),
  putBlob: (c) =>
    c.putBlob("s", {
      schemaVersion: 3,
      generation: 1,
      checksumSHA256: "00",
      ciphertextBase64: "AA==",
    }),
  putRecoveryKey: (c) =>
    c.putRecoveryKey("s", {
      algorithm: "xchacha20poly1305",
      kdf: "bip39_seed_hkdf_sha256",
      mnemonicWordCount: 12,
      wrapNonceHex: "00",
      wrappedMasterKeyHex: "00",
      phraseFingerprintHex: "00",
      updatedAt: "2026-01-01T00:00:00Z",
    } as never),
  register: (c) => c.register({ login: "a", password: "p" }),
  changePassword: (c) => c.changePassword("s", { currentPassword: "p", newPassword: "q" }),
  forgotPassword: (c) => c.forgotPassword({ login: "a", recoveryCode: "r" }),
  resetPassword: (c) => c.resetPassword({ resetToken: "t", newPassword: "q" }),
  regenerateRecoveryCode: (c) => c.regenerateRecoveryCode("s", { currentPassword: "p" }),
  startTOTPEnrollment: (c) => c.startTOTPEnrollment("s", { currentPassword: "p" }),
  verifyTOTPEnrollment: (c) => c.verifyTOTPEnrollment("s", { code: "123456" }),
  disableTOTP: (c) => c.disableTOTP("s", { currentPassword: "p", code: "123456" }),
  completeTOTPChallenge: (c) => c.completeTOTPChallenge({ challengeID: "c", code: "123456" }),
};
