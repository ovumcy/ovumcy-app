import type { ManagedCloudAPIClient } from "../sync/managed-cloud-api-client";

// Typed against the client, so a new endpoint fails to compile until it is
// listed here and covered by the sweep.
export const MANAGED_CLOUD_ENDPOINTS: {
  [K in keyof ManagedCloudAPIClient]: (
    client: ManagedCloudAPIClient,
  ) => Promise<unknown>;
} = {
  register: (c) => c.register({ email: "a@example.test", password: "pw" }),
  login: (c) => c.login({ email: "a@example.test", password: "pw" }),
  logout: (c) => c.logout({ sessionToken: "s", refreshToken: "r" }),
  deleteAccount: (c) => c.deleteAccount("s", {} as never),
  changePassword: (c) => c.changePassword("s", {} as never),
  forgotPassword: (c) => c.forgotPassword({} as never),
  resetPassword: (c) => c.resetPassword({} as never),
  regenerateRecoveryCode: (c) => c.regenerateRecoveryCode("s", {} as never),
  replaceRecoveryKey: (c) =>
    c.replaceRecoveryKey("s", { recoveryKeyPackage: {} } as never),
  startTOTPEnrollment: (c) => c.startTOTPEnrollment("s", {} as never),
  verifyTOTPEnrollment: (c) => c.verifyTOTPEnrollment("s", {} as never),
  disableTOTP: (c) => c.disableTOTP("s", {} as never),
  completeTOTPChallenge: (c) => c.completeTOTPChallenge({} as never),
  refreshSession: (c) => c.refreshSession("r"),
  getSession: (c) => c.getSession("s"),
  createSyncSession: (c) => c.createSyncSession("s"),
  getBillingSnapshot: (c) => c.getBillingSnapshot("s"),
  getEntitlementToken: (c) => c.getEntitlementToken("s"),
  getPartnerAccess: (c) => c.getPartnerAccess("s"),
  getPartnerProjection: (c) => c.getPartnerProjection("s", "grant-1"),
  issuePartnerInvite: (c) => c.issuePartnerInvite("s", {} as never),
  acceptPartnerInvite: (c) => c.acceptPartnerInvite("s", "invite-token"),
  acceptPartnerInviteAsGuest: (c) => c.acceptPartnerInviteAsGuest("invite-token"),
  upgradeGuestAccount: (c) => c.upgradeGuestAccount("s", {} as never),
  revokePartnerInvite: (c) => c.revokePartnerInvite("s", "invite-1"),
  revokePartnerGrant: (c) => c.revokePartnerGrant("s", "grant-1"),
  upsertPartnerProjection: (c) =>
    c.upsertPartnerProjection("s", "grant-1", { ciphertextSize: 1 } as never),
};
