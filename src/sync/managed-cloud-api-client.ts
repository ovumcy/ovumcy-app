import type {
  SyncAuthResult,
  SyncTOTPChallengeHandoff,
  SyncTOTPEnrollmentStart,
} from "./sync-contract";

export type ManagedCloudAPIErrorCode =
  | "invalid_registration_input"
  | "registration_failed"
  | "account_not_guest"
  | "invalid_credentials"
  | "invalid_current_password"
  | "new_password_must_differ"
  | "weak_new_password"
  | "invalid_recovery_credentials"
  | "invalid_reset_token"
  | "rate_limited"
  | "invalid_reminder_schedule"
  | "invalid_partner_invite"
  | "invalid_partner_projection"
  | "partner_access_not_found"
  | "partner_projection_not_found"
  | "partner_access_unavailable"
  | "partner_invite_expired"
  | "partner_invite_not_found"
  | "reminder_schedule_unavailable"
  | "entitlements_unavailable"
  | "entitlements_not_configured"
  | "billing_management_unavailable"
  | "billing_subscription_conflict"
  | "billing_provider_unavailable"
  | "unauthorized"
  | "sync_not_allowed"
  | "sync_bridge_unavailable"
  | "origin_not_allowed"
  | "totp_not_configured"
  | "totp_already_enabled"
  | "totp_invalid_code"
  | "totp_replayed"
  | "totp_challenge_invalid"
  | "totp_secret_failed"
  | "network_failed"
  | "invalid_response"
  | "generic";

export type ManagedCloudEntitlement = {
  syncAllowed: boolean;
  source: string;
  updatedAt: string;
  effectiveAt: string;
  explanation: string;
};

export type ManagedCloudSessionView = {
  accountID: string;
  email: string;
  sessionExpiresAt: string;
  entitlement: ManagedCloudEntitlement;
  twoFactorEnabled: boolean;
};

export type ManagedCloudPremiumFeatures = {
  advancedInsights: boolean;
  advancedFertility: boolean;
  doctorPDF: boolean;
  extendedReports: boolean;
  partnerAccess: boolean;
  reminders: boolean;
};

export type ManagedCloudActiveSubscription = {
  planCode: string;
  planName: string;
  billingInterval: string;
  source: string;
  status: string;
  currency: string;
  amountMinor: number;
  displayAmount: string;
  currentPeriodStartsAt: string;
  currentPeriodEndsAt: string;
  cancelAtPeriodEnd: boolean;
};

export type ManagedCloudBillingManagement = {
  canManageRenewal: boolean;
  canCancelAtPeriodEnd: boolean;
  canResumeRenewal: boolean;
};

export type ManagedCloudBillingOfferCopy = {
  title: string;
  body: string;
  cta: string;
};

// Action keeps `type`/`screen` as plain strings on purpose: the client stays
// structurally tolerant (a future action type must not break parsing), and
// `offers-service` narrows to the action kinds this app version understands.
export type ManagedCloudBillingOfferAction = {
  type: string;
  productId: string | null;
  basePlanId: string | null;
  offerId: string | null;
  screen: string | null;
};

export type ManagedCloudBillingOffer = {
  id: string;
  // kind is a plain string for the same forward tolerance as action.type;
  // known values today: "subscription_promo" | "announcement".
  kind: string;
  audience: string[];
  startsAt: string | null;
  endsAt: string | null;
  // copy maps a locale tag ("en", "ru", ...) to the offer strings; entries
  // with missing/invalid title/body/cta are dropped at parse time.
  copy: Record<string, ManagedCloudBillingOfferCopy>;
  action: ManagedCloudBillingOfferAction;
};

export type ManagedCloudBillingSnapshot = {
  hasActivePlan: boolean;
  premiumFeatures: ManagedCloudPremiumFeatures;
  // activeSubscription carries the current plan/trial details for display
  // (status, period end, price). Null when no subscription row exists.
  activeSubscription: ManagedCloudActiveSubscription | null;
  // billingManagement reports which self-service renewal actions the backend
  // currently allows for this account (drives cancel/resume affordances).
  billingManagement: ManagedCloudBillingManagement;
  // offers carries billing-surface promos/announcements. Parsing is fully
  // tolerant (mirrors the null-tolerant partner-overview pattern): a missing
  // or malformed offers field yields [], malformed entries are dropped.
  offers: ManagedCloudBillingOffer[];
};

export type ManagedCloudEntitlementToken = {
  // token is the compact JWT (EdDSA) the app verifies with
  // verifyEntitlementToken before trusting any entitlement claim.
  token: string;
  // expiresAt is the server-reported expiry (RFC3339). The authoritative expiry
  // is the signed `exp` claim inside the token; this mirror is informational.
  expiresAt: string;
};

export type ManagedCloudReminderEmailScheduleKind =
  | "daily_log"
  | "upcoming_period"
  | "fertile_window";

export type ManagedCloudReminderEmailScheduleType = "daily" | "once";

export type ManagedCloudReminderEmailSchedule = {
  kind: ManagedCloudReminderEmailScheduleKind;
  scheduleType: ManagedCloudReminderEmailScheduleType;
  locale: string;
  timeZone: string;
  dailyHour: number;
  dailyMinute: number;
  nextDeliveryAt: string | null;
  lastDeliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManagedCloudReminderEmailScheduleSnapshot = {
  enabled: boolean;
  schedules: ManagedCloudReminderEmailSchedule[];
};

export type ManagedCloudPartnerAccessLevel = "summary" | "full";

export type ManagedCloudPartnerInvite = {
  id: string;
  ownerAccountID: string;
  accessLevel: ManagedCloudPartnerAccessLevel;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedAccountID: string | null;
  revokedAt: string | null;
  revokedReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ManagedCloudPartnerAccessGrant = {
  id: string;
  ownerAccountID: string;
  partnerAccountID: string;
  accessLevel: ManagedCloudPartnerAccessLevel;
  sourceInviteID: string | null;
  acceptedAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  revokedReason: string;
  createdAt: string;
  updatedAt: string;
};

export type ManagedCloudPartnerAccessOverview = {
  owned: {
    invites: ManagedCloudPartnerInvite[];
    grants: ManagedCloudPartnerAccessGrant[];
  };
  sharedWithMe: ManagedCloudPartnerAccessGrant[];
};

export type ManagedCloudPartnerInviteIssueResult = {
  invite: ManagedCloudPartnerInvite;
  inviteURL: string;
};

export type ManagedCloudPartnerProjection = {
  grantID: string;
  accessLevel: ManagedCloudPartnerAccessLevel;
  schemaVersion: number;
  checksumSHA256: string;
  ciphertextBase64: string;
  ciphertextSize: number;
  createdAt: string;
  updatedAt: string;
};

export type ManagedCloudAuthResult = {
  accountID: string;
  email: string;
  sessionToken: string;
  sessionExpiresAt: string;
  entitlement: ManagedCloudEntitlement;
  // recoveryCode is the plaintext account-level recovery code surfaced only on
  // register responses. Login and managed-bridge sessions leave it unset.
  recoveryCode?: string;
  // totpChallenge is set ONLY on login responses when the account has TOTP
  // enabled on the server. When present, sessionToken is empty and the caller
  // must complete the challenge through `completeTOTPChallenge` before any
  // session can be used. Register responses never set this field.
  totpChallenge?: SyncTOTPChallengeHandoff;
  // refreshToken renews the session without the password. Present only when
  // the server supports refresh tokens and this client declared support; an
  // older managed deployment simply omits it and the session keeps the long
  // legacy lifetime. Single-use — each renewal returns its successor.
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
};

// ManagedCloudGuestPartnerAcceptResult is the response shape of the
// unauthenticated guest-partner-accept endpoint. It deliberately does NOT
// mirror ManagedCloudAuthResult: a guest account has no email/password, so
// the server returns no `email`, no `sync_entitlement` (guest accounts carry
// none — see PartnerService.AcceptInviteAsGuest in the managed cloud), and no
// TOTP challenge (a brand-new guest account can never have TOTP enabled).
export type ManagedCloudGuestPartnerAcceptResult = {
  accountID: string;
  sessionToken: string;
  sessionExpiresAt: string;
  // Set only when the server issued a refresh token for this guest — the
  // short access session and the token that renews it always arrive together
  // or not at all. Absent means the session is the long-lived kind with no
  // renewal path, which is what a managed server with refresh disabled hands
  // back.
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  grant: ManagedCloudPartnerAccessGrant;
  invite: ManagedCloudPartnerInvite;
};

export type ManagedCloudForgotPasswordResult = {
  resetToken: string;
  resetTokenExpiresAt: string;
};

export type ManagedCloudPasswordResetResult = {
  recoveryCode: string;
};

export type ManagedCloudRegenerateRecoveryCodeResult = {
  recoveryCode: string;
};

// ManagedCloudAccountUpgradeResult is the response shape of
// POST /account/upgrade (guest partner -> normal account). Bearer auth is
// the guest's EXISTING managed session — success never issues or revokes a
// session token, so unlike register/login there is no sessionToken field
// here. recoveryCode is plaintext and returned exactly once, never
// re-fetchable (mirrors the register-flow recovery code contract).
export type ManagedCloudAccountUpgradeResult = {
  accountID: string;
  email: string;
  recoveryCode: string;
};

export type ManagedCloudAPIClient = {
  createSyncSession(
    sessionToken: string,
  ): Promise<
    | { ok: true; auth: SyncAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  getBillingSnapshot(
    sessionToken: string,
  ): Promise<
    | { ok: true; billing: ManagedCloudBillingSnapshot }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  // updateBillingRenewal toggles cancel_at_period_end on the account's
  // subscription (PUT /account/billing/renewal) and returns the refreshed
  // billing snapshot on success.
  updateBillingRenewal(
    sessionToken: string,
    input: { cancelAtPeriodEnd: boolean },
  ): Promise<
    | { ok: true; billing: ManagedCloudBillingSnapshot }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  // getEntitlementToken fetches a signed entitlement token (JWT-EdDSA) for the
  // purely-local premium gates. The managed server returns 503 when no signing
  // key is configured (pre-rollout) and may be entirely absent on older
  // servers; both surface as `ok: false` with an error code so the caller can
  // fall back to the billing-snapshot boolean without any behaviour change.
  getEntitlementToken(
    sessionToken: string,
  ): Promise<
    | { ok: true; result: ManagedCloudEntitlementToken }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  getReminderEmailSchedules(
    sessionToken: string,
  ): Promise<
    | { ok: true; snapshot: ManagedCloudReminderEmailScheduleSnapshot }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  getPartnerAccess(
    sessionToken: string,
  ): Promise<
    | { ok: true; overview: ManagedCloudPartnerAccessOverview }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  getPartnerProjection(
    sessionToken: string,
    grantID: string,
  ): Promise<
    | { ok: true; projection: ManagedCloudPartnerProjection }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  getSession(
    sessionToken: string,
  ): Promise<
    | { ok: true; session: ManagedCloudSessionView }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  login(
    input: { email: string; password: string },
  ): Promise<
    | { ok: true; auth: ManagedCloudAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  logout(
    sessionToken: string,
  ): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }>;
  // deleteAccount permanently erases the managed account and all its data
  // (DELETE /account). It does NOT cancel the external app-store subscription
  // — the caller is responsible for surfacing that limitation to the owner
  // before calling this.
  deleteAccount(
    sessionToken: string,
  ): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }>;
  issuePartnerInvite(
    sessionToken: string,
    input: {
      accessLevel: ManagedCloudPartnerAccessLevel;
    },
  ): Promise<
    | { ok: true; result: ManagedCloudPartnerInviteIssueResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  replaceReminderEmailSchedules(
    sessionToken: string,
    input: {
      schedules: {
        kind: ManagedCloudReminderEmailScheduleKind;
        scheduleType: ManagedCloudReminderEmailScheduleType;
        locale: string;
        timeZone: string;
        dailyHour: number;
        dailyMinute: number;
        nextDeliveryAt: string;
      }[];
    },
  ): Promise<
    | { ok: true; snapshot: ManagedCloudReminderEmailScheduleSnapshot }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  register(
    input: { email: string; password: string },
  ): Promise<
    | { ok: true; auth: ManagedCloudAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  changePassword(
    sessionToken: string,
    input: { currentPassword: string; newPassword: string },
  ): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }>;
  forgotPassword(
    input: { email: string; recoveryCode: string },
  ): Promise<
    | { ok: true; result: ManagedCloudForgotPasswordResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  resetPassword(
    input: { resetToken: string; newPassword: string },
  ): Promise<
    | { ok: true; result: ManagedCloudPasswordResetResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  regenerateRecoveryCode(
    sessionToken: string,
    input: { currentPassword: string },
  ): Promise<
    | { ok: true; result: ManagedCloudRegenerateRecoveryCodeResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  startTOTPEnrollment(
    sessionToken: string,
    input: { currentPassword: string },
  ): Promise<
    | { ok: true; enrollment: SyncTOTPEnrollmentStart }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  verifyTOTPEnrollment(
    sessionToken: string,
    input: { code: string },
  ): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }>;
  disableTOTP(
    sessionToken: string,
    input: { currentPassword: string; code: string },
  ): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }>;
  completeTOTPChallenge(
    input: { challengeID: string; code: string },
  ): Promise<
    | { ok: true; auth: ManagedCloudAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  // refreshSession exchanges a refresh token for a fresh access session and a
  // rotated successor token. It carries no bearer header on purpose: the
  // access session it replaces has usually expired already. `unauthorized`
  // means the refresh chain is dead — the owner must sign in again — and the
  // server has already revoked the whole family, so retrying is pointless.
  refreshSession(
    refreshToken: string,
  ): Promise<
    | { ok: true; auth: ManagedCloudAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  acceptPartnerInvite(
    sessionToken: string,
    inviteToken: string,
  ): Promise<
    | {
        ok: true;
        invite: ManagedCloudPartnerInvite;
        grant: ManagedCloudPartnerAccessGrant;
      }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  // acceptPartnerInviteAsGuest redeems a pending invite WITHOUT an existing
  // session (POST /auth/partner/invites/accept, no Authorization header sent):
  // the managed cloud atomically provisions a brand-new guest account and
  // issues it a session in the same call. Reachable only with a valid pending
  // invite token — an unknown/expired/already-used token yields the same
  // error keys acceptPartnerInvite returns and creates no account.
  acceptPartnerInviteAsGuest(
    inviteToken: string,
  ): Promise<
    | { ok: true; result: ManagedCloudGuestPartnerAcceptResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  // upgradeGuestAccount converts the caller's existing guest-partner account
  // into a normal one (POST /account/upgrade). Bearer auth is the guest's
  // CURRENT session token — unlike register/login this never issues a new
  // session; the existing one stays valid. `account_not_guest` (409) means
  // the account was already upgraded (or was never a guest); the caller
  // hides the upgrade affordance when it sees that code.
  upgradeGuestAccount(
    sessionToken: string,
    input: { email: string; password: string },
  ): Promise<
    | { ok: true; result: ManagedCloudAccountUpgradeResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  revokePartnerInvite(
    sessionToken: string,
    inviteID: string,
  ): Promise<
    | { ok: true; invite: ManagedCloudPartnerInvite }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  revokePartnerGrant(
    sessionToken: string,
    grantID: string,
  ): Promise<
    | { ok: true; grant: ManagedCloudPartnerAccessGrant }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  upsertPartnerProjection(
    sessionToken: string,
    grantID: string,
    input: {
      schemaVersion: number;
      checksumSHA256: string;
      ciphertextBase64: string;
      ciphertextSize: number;
    },
  ): Promise<
    | { ok: true; projection: ManagedCloudPartnerProjection }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  clearReminderEmailSchedules(
    sessionToken: string,
  ): Promise<
    | { ok: true; snapshot: ManagedCloudReminderEmailScheduleSnapshot }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
};

type FetchLike = typeof fetch;

type RawSyncAuthResult = {
  account_id: string;
  session_token: string;
  session_expires_at: string;
};

type RawManagedCloudTOTPChallenge = {
  challenge_id: string;
  challenge_expires_at: string;
};

type RawManagedCloudEntitlement = {
  sync_allowed: boolean;
  source: string;
  updated_at: string;
  effective_at: string;
  explanation: string;
};

type RawManagedCloudAuthResult = RawSyncAuthResult & {
  email: string;
  sync_entitlement: RawManagedCloudEntitlement;
  recovery_code?: string;
  totp_challenge?: RawManagedCloudTOTPChallenge;
  refresh_token?: string;
  refresh_token_expires_at?: string;
};

type RawManagedCloudTOTPEnrollmentStart = {
  secret_base32: string;
  provisioning_uri: string;
};

type RawManagedCloudStatusPayload = {
  status: string;
};

type RawManagedCloudForgotPasswordResult = {
  reset_token: string;
  reset_token_expires_at: string;
};

type RawManagedCloudRecoveryCodePayload = {
  recovery_code: string;
};

type RawManagedCloudChangePasswordResult = {
  status: string;
};

type RawManagedCloudSessionView = {
  account_id: string;
  email: string;
  session_expires_at: string;
  sync_entitlement: RawManagedCloudEntitlement;
  // Optional so an older server that does not yet send it still validates;
  // a missing value maps to `false`.
  totp_enabled?: boolean;
};

type RawManagedCloudActiveSubscription = {
  plan_code?: string;
  plan_name?: string;
  billing_interval?: string;
  source?: string;
  status?: string;
  currency?: string;
  amount_minor?: number;
  display_amount?: string;
  current_period_starts_at?: string;
  current_period_ends_at?: string;
  cancel_at_period_end?: boolean;
};

type RawManagedCloudBillingManagement = {
  can_manage_renewal?: boolean;
  can_cancel_at_period_end?: boolean;
  can_resume_renewal?: boolean;
};

type RawManagedCloudBillingSnapshot = {
  has_active_plan?: boolean;
  premium_features?: {
    advanced_fertility?: boolean;
    advanced_insights?: boolean;
    doctor_pdf?: boolean;
    extended_reports?: boolean;
    partner_access?: boolean;
    reminders?: boolean;
  };
  active_subscription?: RawManagedCloudActiveSubscription | null;
  billing_management?: RawManagedCloudBillingManagement;
  // offers stays `unknown`: the guard never validates it, mapBillingOffers
  // absorbs any malformed shape instead of failing the whole snapshot.
  offers?: unknown;
};

type RawManagedCloudEntitlementToken = {
  token: string;
  expires_at: string;
};

type RawManagedCloudReminderEmailSchedule = {
  kind: ManagedCloudReminderEmailScheduleKind;
  schedule_type: ManagedCloudReminderEmailScheduleType;
  locale: string;
  time_zone: string;
  daily_hour: number;
  daily_minute: number;
  next_delivery_at?: string | null;
  last_delivered_at?: string | null;
  created_at: string;
  updated_at: string;
};

type RawManagedCloudReminderEmailScheduleSnapshot = {
  enabled: boolean;
  schedules: RawManagedCloudReminderEmailSchedule[];
};

type RawManagedCloudPartnerInvite = {
  id: string;
  owner_account_id: string;
  access_level: ManagedCloudPartnerAccessLevel;
  status: string;
  expires_at: string;
  accepted_at?: string | null;
  accepted_account_id?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type RawManagedCloudPartnerAccessGrant = {
  id: string;
  owner_account_id: string;
  partner_account_id: string;
  access_level: ManagedCloudPartnerAccessLevel;
  source_invite_id?: string | null;
  accepted_at: string;
  last_seen_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string;
  created_at: string;
  updated_at: string;
};

type RawManagedCloudPartnerAccessOverview = {
  owned: {
    invites: RawManagedCloudPartnerInvite[] | null;
    grants: RawManagedCloudPartnerAccessGrant[] | null;
  };
  shared_with_me: RawManagedCloudPartnerAccessGrant[] | null;
};

type RawManagedCloudPartnerInviteIssueResult = {
  invite: RawManagedCloudPartnerInvite;
  invite_url: string;
};

type RawManagedCloudPartnerInviteAcceptResult = {
  invite: RawManagedCloudPartnerInvite;
  grant: RawManagedCloudPartnerAccessGrant;
};

type RawManagedCloudGuestPartnerAcceptResult = {
  account_id: string;
  session_token: string;
  session_expires_at: string;
  refresh_token?: string;
  refresh_token_expires_at?: string;
  grant: RawManagedCloudPartnerAccessGrant;
  invite: RawManagedCloudPartnerInvite;
};

type RawManagedCloudAccountUpgradeResult = {
  account_id: string;
  email: string;
  recovery_code: string;
};

type RawManagedCloudPartnerProjection = {
  grant_id: string;
  access_level: ManagedCloudPartnerAccessLevel;
  schema_version: number;
  checksum_sha256: string;
  ciphertext_base64: string;
  ciphertext_size: number;
  created_at: string;
  updated_at: string;
};

type ErrorPayload = {
  error?: string;
};

export function createManagedCloudAPIClient(
  baseURL: string,
  fetchImpl: FetchLike = fetch,
): ManagedCloudAPIClient {
  const normalizedBaseURL = baseURL.replace(/\/+$/, "");

  return {
    async register(input) {
      return requestAuthResult(fetchImpl, normalizedBaseURL, "/auth/register", input);
    },

    async login(input) {
      return requestAuthResult(fetchImpl, normalizedBaseURL, "/auth/login", input);
    },

    async logout(sessionToken) {
      return requestNoPayload(fetchImpl, normalizedBaseURL, "/auth/session", {
        method: "DELETE",
        sessionToken,
      });
    },

    async deleteAccount(sessionToken) {
      return requestNoPayload(fetchImpl, normalizedBaseURL, "/account", {
        method: "DELETE",
        sessionToken,
      });
    },

    async changePassword(sessionToken, input) {
      return requestJSON<RawManagedCloudChangePasswordResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/change-password",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
            new_password: input.newPassword,
          },
        },
        isRawManagedCloudChangePasswordResult,
      ).then((result) =>
        result.ok
          ? { ok: true }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async forgotPassword(input) {
      return requestJSON<RawManagedCloudForgotPasswordResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/forgot-password",
        {
          method: "POST",
          body: {
            email: input.email,
            recovery_code: input.recoveryCode,
          },
        },
        isRawManagedCloudForgotPasswordResult,
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: {
                resetToken: result.payload.reset_token,
                resetTokenExpiresAt: result.payload.reset_token_expires_at,
              },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async resetPassword(input) {
      return requestJSON<RawManagedCloudRecoveryCodePayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/reset-password",
        {
          method: "POST",
          body: {
            reset_token: input.resetToken,
            new_password: input.newPassword,
          },
        },
        isRawManagedCloudRecoveryCodePayload,
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: { recoveryCode: result.payload.recovery_code },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async regenerateRecoveryCode(sessionToken, input) {
      return requestJSON<RawManagedCloudRecoveryCodePayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/recovery-code/regenerate",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
          },
        },
        isRawManagedCloudRecoveryCodePayload,
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: { recoveryCode: result.payload.recovery_code },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async startTOTPEnrollment(sessionToken, input) {
      return requestJSON<RawManagedCloudTOTPEnrollmentStart>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/enroll",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
          },
        },
        isRawManagedCloudTOTPEnrollmentStart,
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              enrollment: {
                secretBase32: result.payload.secret_base32,
                provisioningURI: result.payload.provisioning_uri,
              },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async verifyTOTPEnrollment(sessionToken, input) {
      return requestJSON<RawManagedCloudStatusPayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/verify",
        {
          method: "POST",
          sessionToken,
          body: {
            code: input.code,
          },
        },
        isRawManagedCloudStatusPayload,
      ).then((result) =>
        result.ok ? { ok: true } : { ok: false, errorCode: result.errorCode },
      );
    },

    async disableTOTP(sessionToken, input) {
      return requestJSON<RawManagedCloudStatusPayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/disable",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
            code: input.code,
          },
        },
        isRawManagedCloudStatusPayload,
      ).then((result) =>
        result.ok ? { ok: true } : { ok: false, errorCode: result.errorCode },
      );
    },

    async completeTOTPChallenge(input) {
      return requestJSON<RawManagedCloudAuthResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/challenge",
        {
          method: "POST",
          body: {
            challenge_id: input.challengeID,
            code: input.code,
            refresh_supported: true,
          },
        },
        isRawManagedCloudAuthResult,
      ).then((result) =>
        result.ok
          ? { ok: true, auth: mapAuthResult(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async refreshSession(refreshToken) {
      return requestJSON<RawManagedCloudAuthResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/refresh",
        {
          method: "POST",
          body: { refresh_token: refreshToken },
        },
        isRawManagedCloudAuthResult,
      ).then((result) =>
        result.ok
          ? { ok: true, auth: mapAuthResult(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getSession(sessionToken) {
      return requestJSON<RawManagedCloudSessionView>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/session",
        {
          method: "GET",
          sessionToken,
        },
        isRawManagedCloudSessionView,
      ).then((result) =>
        result.ok
          ? { ok: true, session: mapSessionView(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async createSyncSession(sessionToken) {
      return requestJSON<RawSyncAuthResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/sync-session",
        {
          method: "POST",
          sessionToken,
        },
        isRawSyncAuthResult,
      ).then((result) =>
        result.ok
          ? { ok: true, auth: mapSyncAuthResult(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getBillingSnapshot(sessionToken) {
      return requestJSON<RawManagedCloudBillingSnapshot>(
        fetchImpl,
        normalizedBaseURL,
        "/account/billing",
        {
          method: "GET",
          sessionToken,
        },
        isRawManagedCloudBillingSnapshot,
      ).then((result) =>
        result.ok
          ? { ok: true, billing: mapBillingSnapshot(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async updateBillingRenewal(sessionToken, input) {
      return requestJSON<RawManagedCloudBillingSnapshot>(
        fetchImpl,
        normalizedBaseURL,
        "/account/billing/renewal",
        {
          method: "PUT",
          sessionToken,
          body: {
            cancel_at_period_end: input.cancelAtPeriodEnd,
          },
        },
        isRawManagedCloudBillingSnapshot,
      ).then((result) =>
        result.ok
          ? { ok: true, billing: mapBillingSnapshot(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getEntitlementToken(sessionToken) {
      return requestJSON<RawManagedCloudEntitlementToken>(
        fetchImpl,
        normalizedBaseURL,
        "/account/entitlements/token",
        {
          method: "POST",
          sessionToken,
        },
        isRawManagedCloudEntitlementToken,
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: {
                token: result.payload.token,
                expiresAt: result.payload.expires_at,
              },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getReminderEmailSchedules(sessionToken) {
      return requestJSON<RawManagedCloudReminderEmailScheduleSnapshot>(
        fetchImpl,
        normalizedBaseURL,
        "/account/reminders/email",
        {
          method: "GET",
          sessionToken,
        },
        isRawManagedCloudReminderEmailScheduleSnapshot,
      ).then((result) =>
        result.ok
          ? { ok: true, snapshot: mapReminderEmailScheduleSnapshot(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getPartnerAccess(sessionToken) {
      return requestJSON<RawManagedCloudPartnerAccessOverview>(
        fetchImpl,
        normalizedBaseURL,
        "/account/partner/access",
        {
          method: "GET",
          sessionToken,
        },
        isRawManagedCloudPartnerAccessOverview,
      ).then((result) =>
        result.ok
          ? { ok: true, overview: mapPartnerAccessOverview(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getPartnerProjection(sessionToken, grantID) {
      return requestJSON<RawManagedCloudPartnerProjection>(
        fetchImpl,
        normalizedBaseURL,
        `/account/partner/grants/${encodeURIComponent(grantID)}/projection`,
        {
          method: "GET",
          sessionToken,
        },
        isRawManagedCloudPartnerProjection,
      ).then((result) =>
        result.ok
          ? { ok: true, projection: mapPartnerProjection(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async issuePartnerInvite(sessionToken, input) {
      return requestJSON<RawManagedCloudPartnerInviteIssueResult>(
        fetchImpl,
        normalizedBaseURL,
        "/account/partner/invites",
        {
          method: "POST",
          sessionToken,
          body: {
            access_level: input.accessLevel,
          },
        },
        isRawManagedCloudPartnerInviteIssueResult,
      ).then((result) =>
        result.ok
          ? { ok: true, result: mapPartnerInviteIssueResult(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async replaceReminderEmailSchedules(sessionToken, input) {
      return requestJSON<RawManagedCloudReminderEmailScheduleSnapshot>(
        fetchImpl,
        normalizedBaseURL,
        "/account/reminders/email",
        {
          method: "PUT",
          sessionToken,
          body: {
            schedules: input.schedules.map((schedule) => ({
              kind: schedule.kind,
              schedule_type: schedule.scheduleType,
              locale: schedule.locale,
              time_zone: schedule.timeZone,
              daily_hour: schedule.dailyHour,
              daily_minute: schedule.dailyMinute,
              next_delivery_at: schedule.nextDeliveryAt,
            })),
          },
        },
        isRawManagedCloudReminderEmailScheduleSnapshot,
      ).then((result) =>
        result.ok
          ? { ok: true, snapshot: mapReminderEmailScheduleSnapshot(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async acceptPartnerInvite(sessionToken, inviteToken) {
      return requestJSON<RawManagedCloudPartnerInviteAcceptResult>(
        fetchImpl,
        normalizedBaseURL,
        "/account/partner/invites/accept",
        {
          method: "POST",
          sessionToken,
          body: { invite_token: inviteToken },
        },
        isRawManagedCloudPartnerInviteAcceptResult,
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              invite: mapPartnerInvite(result.payload.invite),
              grant: mapPartnerAccessGrant(result.payload.grant),
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async acceptPartnerInviteAsGuest(inviteToken) {
      // Deliberately no `sessionToken` in the request options: performFetch
      // only sets an Authorization header when one is supplied, so this call
      // reaches the unauthenticated /auth/... endpoint with no bearer, the
      // same way register/login do.
      return requestJSON<RawManagedCloudGuestPartnerAcceptResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/partner/invites/accept",
        {
          method: "POST",
          // Declaring refresh support matters most on this endpoint: a guest
          // account has no password to fall back on, so without it the device
          // holds a link-minted bearer good for the full SESSION_TTL.
          body: { invite_token: inviteToken, refresh_supported: true },
        },
        isRawManagedCloudGuestPartnerAcceptResult,
      ).then((result) =>
        result.ok
          ? { ok: true, result: mapGuestPartnerAcceptResult(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async upgradeGuestAccount(sessionToken, input) {
      return requestJSON<RawManagedCloudAccountUpgradeResult>(
        fetchImpl,
        normalizedBaseURL,
        "/account/upgrade",
        {
          method: "POST",
          sessionToken,
          body: {
            email: input.email,
            password: input.password,
          },
        },
        isRawManagedCloudAccountUpgradeResult,
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: {
                accountID: result.payload.account_id,
                email: result.payload.email,
                recoveryCode: result.payload.recovery_code,
              },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async revokePartnerInvite(sessionToken, inviteID) {
      return requestJSON<RawManagedCloudPartnerInvite>(
        fetchImpl,
        normalizedBaseURL,
        `/account/partner/invites/${encodeURIComponent(inviteID)}`,
        {
          method: "DELETE",
          sessionToken,
        },
        isRawManagedCloudPartnerInvite,
      ).then((result) =>
        result.ok
          ? { ok: true, invite: mapPartnerInvite(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async revokePartnerGrant(sessionToken, grantID) {
      return requestJSON<RawManagedCloudPartnerAccessGrant>(
        fetchImpl,
        normalizedBaseURL,
        `/account/partner/grants/${encodeURIComponent(grantID)}`,
        {
          method: "DELETE",
          sessionToken,
        },
        isRawManagedCloudPartnerAccessGrant,
      ).then((result) =>
        result.ok
          ? { ok: true, grant: mapPartnerAccessGrant(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async upsertPartnerProjection(sessionToken, grantID, input) {
      return requestJSON<RawManagedCloudPartnerProjection>(
        fetchImpl,
        normalizedBaseURL,
        `/account/partner/grants/${encodeURIComponent(grantID)}/projection`,
        {
          method: "PUT",
          sessionToken,
          body: {
            schema_version: input.schemaVersion,
            checksum_sha256: input.checksumSHA256,
            ciphertext_base64: input.ciphertextBase64,
            ciphertext_size: input.ciphertextSize,
          },
        },
        isRawManagedCloudPartnerProjection,
      ).then((result) =>
        result.ok
          ? { ok: true, projection: mapPartnerProjection(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async clearReminderEmailSchedules(sessionToken) {
      return requestJSON<RawManagedCloudReminderEmailScheduleSnapshot>(
        fetchImpl,
        normalizedBaseURL,
        "/account/reminders/email",
        {
          method: "DELETE",
          sessionToken,
        },
        isRawManagedCloudReminderEmailScheduleSnapshot,
      ).then((result) =>
        result.ok
          ? { ok: true, snapshot: mapReminderEmailScheduleSnapshot(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },
  };
}

async function requestAuthResult(
  fetchImpl: FetchLike,
  baseURL: string,
  path: string,
  input: { email: string; password: string },
): Promise<
  | { ok: true; auth: ManagedCloudAuthResult }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode }
> {
  const result = await requestJSON<RawManagedCloudAuthResult>(
    fetchImpl,
    baseURL,
    path,
    {
      method: "POST",
      // Declaring refresh support is what makes the server issue a short
      // access session with a renewable refresh token instead of a long-lived
      // one. A server that predates the flag ignores it and answers exactly as
      // before.
      body: { ...input, refresh_supported: true },
    },
    isRawManagedCloudAuthResult,
  );

  return result.ok
    ? { ok: true, auth: mapAuthResult(result.payload) }
    : { ok: false, errorCode: result.errorCode };
}

async function requestNoPayload(
  fetchImpl: FetchLike,
  baseURL: string,
  path: string,
  options: {
    method: "DELETE";
    sessionToken?: string;
  },
): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }> {
  const response = await performFetch(fetchImpl, `${baseURL}${path}`, options);
  if (!response.ok) {
    return {
      ok: false,
      errorCode: await readErrorCode(response),
    };
  }

  return { ok: true };
}

async function requestJSON<T>(
  fetchImpl: FetchLike,
  baseURL: string,
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    sessionToken?: string;
  },
  guard: (value: unknown) => value is T,
): Promise<
  | { ok: true; payload: T }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode }
> {
  const response = await performFetch(fetchImpl, `${baseURL}${path}`, options);
  if (!response.ok) {
    return {
      ok: false,
      errorCode: await readErrorCode(response),
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, errorCode: "invalid_response" };
  }

  if (!guard(payload)) {
    return { ok: false, errorCode: "invalid_response" };
  }

  return { ok: true, payload };
}

async function performFetch(
  fetchImpl: FetchLike,
  url: string,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    sessionToken?: string;
  },
): Promise<Response> {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (options.sessionToken) {
    headers.set("Authorization", `Bearer ${options.sessionToken}`);
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const requestInit: RequestInit = {
      method: options.method,
      headers,
      // Same rationale as sync-api-client: refuse redirects so a malicious
      // upstream cannot exfiltrate the managed bearer session token via a
      // 307/308 Location to an attacker-controlled host.
      redirect: "error",
    };
    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    return await fetchImpl(url, requestInit);
  } catch {
    return new Response(JSON.stringify({ error: "network_failed" }), {
      status: 599,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function readErrorCode(response: Response): Promise<ManagedCloudAPIErrorCode> {
  if (response.status === 599) {
    return "network_failed";
  }

  try {
    const payload = (await response.json()) as ErrorPayload;
    switch (payload?.error) {
      case "invalid_registration_input":
      case "registration_failed":
      case "account_not_guest":
      case "invalid_credentials":
      case "invalid_current_password":
      case "new_password_must_differ":
      case "weak_new_password":
      case "invalid_recovery_credentials":
      case "invalid_reset_token":
      case "rate_limited":
      case "invalid_reminder_schedule":
      case "invalid_partner_invite":
      case "partner_access_not_found":
      case "partner_access_unavailable":
      case "partner_invite_expired":
      case "partner_invite_not_found":
      case "invalid_partner_projection":
      case "partner_projection_not_found":
      case "reminder_schedule_unavailable":
      case "entitlements_unavailable":
      case "entitlements_not_configured":
      case "billing_management_unavailable":
      case "billing_subscription_conflict":
      case "billing_provider_unavailable":
      case "unauthorized":
      case "sync_not_allowed":
      case "sync_bridge_unavailable":
      case "origin_not_allowed":
      case "totp_not_configured":
      case "totp_already_enabled":
      case "totp_invalid_code":
      case "totp_replayed":
      case "totp_challenge_invalid":
      case "totp_secret_failed":
        return payload.error;
      default:
        return "generic";
    }
  } catch {
    return "generic";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableArrayOf(
  value: unknown,
  itemGuard: (item: unknown) => boolean,
): boolean {
  // The managed API serializes an empty list field as JSON `null` (a Go nil
  // slice), so treat null/undefined as an empty array instead of rejecting the
  // whole payload.
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.every(itemGuard))
  );
}

function isRawManagedCloudEntitlement(
  value: unknown,
): value is RawManagedCloudEntitlement {
  return (
    isObject(value) &&
    typeof value.sync_allowed === "boolean" &&
    typeof value.source === "string" &&
    typeof value.updated_at === "string" &&
    typeof value.effective_at === "string" &&
    typeof value.explanation === "string"
  );
}

function isRawManagedCloudTOTPChallenge(
  value: unknown,
): value is RawManagedCloudTOTPChallenge {
  return (
    isObject(value) &&
    typeof value.challenge_id === "string" &&
    typeof value.challenge_expires_at === "string"
  );
}

function isRawManagedCloudAuthResult(
  value: unknown,
): value is RawManagedCloudAuthResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.email === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string" &&
    isRawManagedCloudEntitlement(value.sync_entitlement) &&
    (typeof value.recovery_code === "string" ||
      typeof value.recovery_code === "undefined") &&
    (typeof value.totp_challenge === "undefined" ||
      isRawManagedCloudTOTPChallenge(value.totp_challenge))
  );
}

function isRawManagedCloudTOTPEnrollmentStart(
  value: unknown,
): value is RawManagedCloudTOTPEnrollmentStart {
  return (
    isObject(value) &&
    typeof value.secret_base32 === "string" &&
    typeof value.provisioning_uri === "string"
  );
}

function isRawManagedCloudStatusPayload(
  value: unknown,
): value is RawManagedCloudStatusPayload {
  return isObject(value) && typeof value.status === "string";
}

function isRawManagedCloudForgotPasswordResult(
  value: unknown,
): value is RawManagedCloudForgotPasswordResult {
  return (
    isObject(value) &&
    typeof value.reset_token === "string" &&
    typeof value.reset_token_expires_at === "string"
  );
}

function isRawManagedCloudRecoveryCodePayload(
  value: unknown,
): value is RawManagedCloudRecoveryCodePayload {
  return isObject(value) && typeof value.recovery_code === "string";
}

function isRawManagedCloudChangePasswordResult(
  value: unknown,
): value is RawManagedCloudChangePasswordResult {
  return isObject(value) && typeof value.status === "string";
}

function isRawManagedCloudSessionView(
  value: unknown,
): value is RawManagedCloudSessionView {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.email === "string" &&
    typeof value.session_expires_at === "string" &&
    isRawManagedCloudEntitlement(value.sync_entitlement) &&
    (value.totp_enabled === undefined ||
      typeof value.totp_enabled === "boolean")
  );
}

function isRawManagedCloudBillingSnapshot(
  value: unknown,
): value is RawManagedCloudBillingSnapshot {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.has_active_plan !== "boolean" &&
    typeof value.has_active_plan !== "undefined"
  ) {
    return false;
  }

  const features = value.premium_features;
  if (typeof features === "undefined") {
    return true;
  }

  return (
    isObject(features) &&
    (typeof features.doctor_pdf === "boolean" ||
      typeof features.doctor_pdf === "undefined") &&
    (typeof features.advanced_fertility === "boolean" ||
      typeof features.advanced_fertility === "undefined") &&
    (typeof features.advanced_insights === "boolean" ||
      typeof features.advanced_insights === "undefined") &&
    (typeof features.extended_reports === "boolean" ||
      typeof features.extended_reports === "undefined") &&
    (typeof features.partner_access === "boolean" ||
      typeof features.partner_access === "undefined") &&
    (typeof features.reminders === "boolean" ||
      typeof features.reminders === "undefined")
  );
}

function isRawManagedCloudEntitlementToken(
  value: unknown,
): value is RawManagedCloudEntitlementToken {
  return (
    isObject(value) &&
    typeof value.token === "string" &&
    value.token.length > 0 &&
    typeof value.expires_at === "string"
  );
}

function isReminderEmailScheduleKind(
  value: unknown,
): value is ManagedCloudReminderEmailScheduleKind {
  return (
    value === "daily_log" ||
    value === "upcoming_period" ||
    value === "fertile_window"
  );
}

function isReminderEmailScheduleType(
  value: unknown,
): value is ManagedCloudReminderEmailScheduleType {
  return value === "daily" || value === "once";
}

function isRawManagedCloudReminderEmailSchedule(
  value: unknown,
): value is RawManagedCloudReminderEmailSchedule {
  return (
    isObject(value) &&
    isReminderEmailScheduleKind(value.kind) &&
    isReminderEmailScheduleType(value.schedule_type) &&
    typeof value.locale === "string" &&
    typeof value.time_zone === "string" &&
    typeof value.daily_hour === "number" &&
    typeof value.daily_minute === "number" &&
    (typeof value.next_delivery_at === "string" ||
      value.next_delivery_at === null ||
      typeof value.next_delivery_at === "undefined") &&
    (typeof value.last_delivered_at === "string" ||
      value.last_delivered_at === null ||
      typeof value.last_delivered_at === "undefined") &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isRawManagedCloudReminderEmailScheduleSnapshot(
  value: unknown,
): value is RawManagedCloudReminderEmailScheduleSnapshot {
  return (
    isObject(value) &&
    typeof value.enabled === "boolean" &&
    Array.isArray(value.schedules) &&
    value.schedules.every(isRawManagedCloudReminderEmailSchedule)
  );
}

function isPartnerAccessLevel(
  value: unknown,
): value is ManagedCloudPartnerAccessLevel {
  return value === "summary" || value === "full";
}

function isRawManagedCloudPartnerInvite(
  value: unknown,
): value is RawManagedCloudPartnerInvite {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.owner_account_id === "string" &&
    isPartnerAccessLevel(value.access_level) &&
    typeof value.status === "string" &&
    typeof value.expires_at === "string" &&
    (typeof value.accepted_at === "string" ||
      value.accepted_at === null ||
      typeof value.accepted_at === "undefined") &&
    (typeof value.accepted_account_id === "string" ||
      value.accepted_account_id === null ||
      typeof value.accepted_account_id === "undefined") &&
    (typeof value.revoked_at === "string" ||
      value.revoked_at === null ||
      typeof value.revoked_at === "undefined") &&
    (typeof value.revoked_reason === "string" ||
      typeof value.revoked_reason === "undefined") &&
    typeof value.created_by === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isRawManagedCloudPartnerAccessGrant(
  value: unknown,
): value is RawManagedCloudPartnerAccessGrant {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.owner_account_id === "string" &&
    typeof value.partner_account_id === "string" &&
    isPartnerAccessLevel(value.access_level) &&
    (typeof value.source_invite_id === "string" ||
      value.source_invite_id === null ||
      typeof value.source_invite_id === "undefined") &&
    typeof value.accepted_at === "string" &&
    (typeof value.last_seen_at === "string" ||
      value.last_seen_at === null ||
      typeof value.last_seen_at === "undefined") &&
    (typeof value.revoked_at === "string" ||
      value.revoked_at === null ||
      typeof value.revoked_at === "undefined") &&
    (typeof value.revoked_reason === "string" ||
      typeof value.revoked_reason === "undefined") &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isRawManagedCloudPartnerProjection(
  value: unknown,
): value is RawManagedCloudPartnerProjection {
  return (
    isObject(value) &&
    typeof value.grant_id === "string" &&
    isPartnerAccessLevel(value.access_level) &&
    typeof value.schema_version === "number" &&
    typeof value.checksum_sha256 === "string" &&
    typeof value.ciphertext_base64 === "string" &&
    typeof value.ciphertext_size === "number" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isRawManagedCloudPartnerAccessOverview(
  value: unknown,
): value is RawManagedCloudPartnerAccessOverview {
  return (
    isObject(value) &&
    isObject(value.owned) &&
    isNullableArrayOf(value.owned.invites, isRawManagedCloudPartnerInvite) &&
    isNullableArrayOf(value.owned.grants, isRawManagedCloudPartnerAccessGrant) &&
    isNullableArrayOf(value.shared_with_me, isRawManagedCloudPartnerAccessGrant)
  );
}

function isRawManagedCloudPartnerInviteIssueResult(
  value: unknown,
): value is RawManagedCloudPartnerInviteIssueResult {
  return (
    isObject(value) &&
    typeof value.invite_url === "string" &&
    isRawManagedCloudPartnerInvite(value.invite)
  );
}

function isRawManagedCloudPartnerInviteAcceptResult(
  value: unknown,
): value is RawManagedCloudPartnerInviteAcceptResult {
  return (
    isObject(value) &&
    isRawManagedCloudPartnerInvite(value.invite) &&
    isRawManagedCloudPartnerAccessGrant(value.grant)
  );
}

function isRawManagedCloudGuestPartnerAcceptResult(
  value: unknown,
): value is RawManagedCloudGuestPartnerAcceptResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string" &&
    isRawManagedCloudPartnerAccessGrant(value.grant) &&
    isRawManagedCloudPartnerInvite(value.invite)
  );
}

function isRawManagedCloudAccountUpgradeResult(
  value: unknown,
): value is RawManagedCloudAccountUpgradeResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.email === "string" &&
    typeof value.recovery_code === "string"
  );
}

function isRawSyncAuthResult(value: unknown): value is RawSyncAuthResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string"
  );
}

function mapEntitlement(
  raw: RawManagedCloudEntitlement,
): ManagedCloudEntitlement {
  return {
    syncAllowed: raw.sync_allowed,
    source: raw.source,
    updatedAt: raw.updated_at,
    effectiveAt: raw.effective_at,
    explanation: raw.explanation,
  };
}

function mapAuthResult(raw: RawManagedCloudAuthResult): ManagedCloudAuthResult {
  const result: ManagedCloudAuthResult = {
    accountID: raw.account_id,
    email: raw.email,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
    entitlement: mapEntitlement(raw.sync_entitlement),
  };
  if (typeof raw.recovery_code === "string" && raw.recovery_code.length > 0) {
    result.recoveryCode = raw.recovery_code;
  }
  if (raw.totp_challenge !== undefined) {
    result.totpChallenge = {
      challengeID: raw.totp_challenge.challenge_id,
      challengeExpiresAt: raw.totp_challenge.challenge_expires_at,
    };
  }
  // Both refresh fields travel together; a response carrying only one is
  // treated as carrying neither rather than storing half a credential.
  if (
    typeof raw.refresh_token === "string" &&
    raw.refresh_token.length > 0 &&
    typeof raw.refresh_token_expires_at === "string" &&
    raw.refresh_token_expires_at.length > 0
  ) {
    result.refreshToken = raw.refresh_token;
    result.refreshTokenExpiresAt = raw.refresh_token_expires_at;
  }
  return result;
}

function mapSessionView(raw: RawManagedCloudSessionView): ManagedCloudSessionView {
  return {
    accountID: raw.account_id,
    email: raw.email,
    sessionExpiresAt: raw.session_expires_at,
    entitlement: mapEntitlement(raw.sync_entitlement),
    twoFactorEnabled: raw.totp_enabled ?? false,
  };
}

function mapActiveSubscription(
  raw: RawManagedCloudActiveSubscription | null | undefined,
): ManagedCloudActiveSubscription | null {
  if (!isObject(raw)) {
    return null;
  }
  // Require the two fields the trial/plan UI actually reads. Without a status
  // and a period end there is nothing useful to display, so treat as absent
  // rather than rendering a half-empty card.
  if (
    typeof raw.status !== "string" ||
    typeof raw.current_period_ends_at !== "string"
  ) {
    return null;
  }
  return {
    planCode: typeof raw.plan_code === "string" ? raw.plan_code : "",
    planName: typeof raw.plan_name === "string" ? raw.plan_name : "",
    billingInterval:
      typeof raw.billing_interval === "string" ? raw.billing_interval : "",
    source: typeof raw.source === "string" ? raw.source : "",
    status: raw.status,
    currency: typeof raw.currency === "string" ? raw.currency : "",
    amountMinor: typeof raw.amount_minor === "number" ? raw.amount_minor : 0,
    displayAmount:
      typeof raw.display_amount === "string" ? raw.display_amount : "",
    currentPeriodStartsAt:
      typeof raw.current_period_starts_at === "string"
        ? raw.current_period_starts_at
        : "",
    currentPeriodEndsAt: raw.current_period_ends_at,
    cancelAtPeriodEnd: raw.cancel_at_period_end === true,
  };
}

function mapBillingSnapshot(
  raw: RawManagedCloudBillingSnapshot,
): ManagedCloudBillingSnapshot {
  const features = isObject(raw.premium_features) ? raw.premium_features : {};
  const management = isObject(raw.billing_management)
    ? raw.billing_management
    : {};

  return {
    hasActivePlan: raw.has_active_plan === true,
    premiumFeatures: {
      advancedFertility: features.advanced_fertility === true,
      advancedInsights: features.advanced_insights === true,
      doctorPDF: features.doctor_pdf === true,
      extendedReports: features.extended_reports === true,
      partnerAccess: features.partner_access === true,
      reminders: features.reminders === true,
    },
    activeSubscription: mapActiveSubscription(raw.active_subscription),
    billingManagement: {
      canManageRenewal: management.can_manage_renewal === true,
      canCancelAtPeriodEnd: management.can_cancel_at_period_end === true,
      canResumeRenewal: management.can_resume_renewal === true,
    },
    offers: mapBillingOffers(raw.offers),
  };
}

// mapBillingOffers is the tolerant boundary for the offers contract: the
// server side is built in parallel against this shape, so a missing/invalid
// offers field maps to [] and each malformed entry is dropped — never an
// error that would take down the whole billing snapshot.
function mapBillingOffers(raw: unknown): ManagedCloudBillingOffer[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const offers: ManagedCloudBillingOffer[] = [];
  for (const entry of raw) {
    const offer = mapBillingOffer(entry);
    if (offer) {
      offers.push(offer);
    }
  }
  return offers;
}

function mapBillingOffer(raw: unknown): ManagedCloudBillingOffer | null {
  if (!isObject(raw)) {
    return null;
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return null;
  }
  if (typeof raw.kind !== "string" || raw.kind.length === 0) {
    return null;
  }
  if (!isObject(raw.action) || typeof raw.action.type !== "string") {
    return null;
  }

  return {
    id: raw.id,
    kind: raw.kind,
    audience: Array.isArray(raw.audience)
      ? raw.audience.filter((item): item is string => typeof item === "string")
      : [],
    startsAt: typeof raw.startsAt === "string" ? raw.startsAt : null,
    endsAt: typeof raw.endsAt === "string" ? raw.endsAt : null,
    copy: mapBillingOfferCopy(raw.copy),
    action: {
      type: raw.action.type,
      productId:
        typeof raw.action.productId === "string" ? raw.action.productId : null,
      basePlanId:
        typeof raw.action.basePlanId === "string" ? raw.action.basePlanId : null,
      offerId: typeof raw.action.offerId === "string" ? raw.action.offerId : null,
      screen: typeof raw.action.screen === "string" ? raw.action.screen : null,
    },
  };
}

function mapBillingOfferCopy(
  raw: unknown,
): Record<string, ManagedCloudBillingOfferCopy> {
  if (!isObject(raw)) {
    return {};
  }

  const copy: Record<string, ManagedCloudBillingOfferCopy> = {};
  for (const [locale, entry] of Object.entries(raw)) {
    if (
      isObject(entry) &&
      typeof entry.title === "string" &&
      typeof entry.body === "string" &&
      typeof entry.cta === "string"
    ) {
      copy[locale] = {
        title: entry.title,
        body: entry.body,
        cta: entry.cta,
      };
    }
  }
  return copy;
}

function mapReminderEmailSchedule(
  raw: RawManagedCloudReminderEmailSchedule,
): ManagedCloudReminderEmailSchedule {
  return {
    kind: raw.kind,
    scheduleType: raw.schedule_type,
    locale: raw.locale,
    timeZone: raw.time_zone,
    dailyHour: raw.daily_hour,
    dailyMinute: raw.daily_minute,
    nextDeliveryAt: raw.next_delivery_at ?? null,
    lastDeliveredAt: raw.last_delivered_at ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapReminderEmailScheduleSnapshot(
  raw: RawManagedCloudReminderEmailScheduleSnapshot,
): ManagedCloudReminderEmailScheduleSnapshot {
  return {
    enabled: raw.enabled,
    schedules: raw.schedules.map(mapReminderEmailSchedule),
  };
}

function mapPartnerInvite(
  raw: RawManagedCloudPartnerInvite,
): ManagedCloudPartnerInvite {
  return {
    id: raw.id,
    ownerAccountID: raw.owner_account_id,
    accessLevel: raw.access_level,
    status: raw.status,
    expiresAt: raw.expires_at,
    acceptedAt: raw.accepted_at ?? null,
    acceptedAccountID: raw.accepted_account_id ?? null,
    revokedAt: raw.revoked_at ?? null,
    revokedReason: raw.revoked_reason ?? "",
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapPartnerAccessGrant(
  raw: RawManagedCloudPartnerAccessGrant,
): ManagedCloudPartnerAccessGrant {
  return {
    id: raw.id,
    ownerAccountID: raw.owner_account_id,
    partnerAccountID: raw.partner_account_id,
    accessLevel: raw.access_level,
    sourceInviteID: raw.source_invite_id ?? null,
    acceptedAt: raw.accepted_at,
    lastSeenAt: raw.last_seen_at ?? null,
    revokedAt: raw.revoked_at ?? null,
    revokedReason: raw.revoked_reason ?? "",
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapPartnerProjection(
  raw: RawManagedCloudPartnerProjection,
): ManagedCloudPartnerProjection {
  return {
    grantID: raw.grant_id,
    accessLevel: raw.access_level,
    schemaVersion: raw.schema_version,
    checksumSHA256: raw.checksum_sha256,
    ciphertextBase64: raw.ciphertext_base64,
    ciphertextSize: raw.ciphertext_size,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapPartnerAccessOverview(
  raw: RawManagedCloudPartnerAccessOverview,
): ManagedCloudPartnerAccessOverview {
  return {
    owned: {
      invites: (raw.owned.invites ?? []).map(mapPartnerInvite),
      grants: (raw.owned.grants ?? []).map(mapPartnerAccessGrant),
    },
    sharedWithMe: (raw.shared_with_me ?? []).map(mapPartnerAccessGrant),
  };
}

function mapPartnerInviteIssueResult(
  raw: RawManagedCloudPartnerInviteIssueResult,
): ManagedCloudPartnerInviteIssueResult {
  return {
    invite: mapPartnerInvite(raw.invite),
    inviteURL: raw.invite_url,
  };
}

function mapGuestPartnerAcceptResult(
  raw: RawManagedCloudGuestPartnerAcceptResult,
): ManagedCloudGuestPartnerAcceptResult {
  const result: ManagedCloudGuestPartnerAcceptResult = {
    accountID: raw.account_id,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
    grant: mapPartnerAccessGrant(raw.grant),
    invite: mapPartnerInvite(raw.invite),
  };
  // Both refresh fields travel together; a response carrying only one is
  // treated as carrying neither rather than storing half a credential. Same
  // rule as mapAuthResult.
  if (
    typeof raw.refresh_token === "string" &&
    raw.refresh_token.length > 0 &&
    typeof raw.refresh_token_expires_at === "string" &&
    raw.refresh_token_expires_at.length > 0
  ) {
    result.refreshToken = raw.refresh_token;
    result.refreshTokenExpiresAt = raw.refresh_token_expires_at;
  }
  return result;
}

function mapSyncAuthResult(raw: RawSyncAuthResult): SyncAuthResult {
  return {
    accountID: raw.account_id,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
  };
}
