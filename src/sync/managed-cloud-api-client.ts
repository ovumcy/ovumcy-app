import type { SyncAuthResult } from "./sync-contract";

export type ManagedCloudAPIErrorCode =
  | "invalid_registration_input"
  | "registration_failed"
  | "invalid_credentials"
  | "invalid_reminder_schedule"
  | "invalid_partner_invite"
  | "partner_access_not_found"
  | "partner_access_unavailable"
  | "partner_invite_email_mismatch"
  | "partner_invite_expired"
  | "partner_invite_not_found"
  | "reminder_schedule_unavailable"
  | "unauthorized"
  | "sync_not_allowed"
  | "sync_bridge_unavailable"
  | "origin_not_allowed"
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
};

export type ManagedCloudPremiumFeatures = {
  advancedInsights: boolean;
  advancedFertility: boolean;
  doctorPDF: boolean;
  extendedReports: boolean;
  partnerAccess: boolean;
  reminders: boolean;
};

export type ManagedCloudBillingSnapshot = {
  premiumFeatures: ManagedCloudPremiumFeatures;
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

export type ManagedCloudPartnerEmailDelivery = {
  requested: boolean;
  status: "disabled" | "sent" | "failed" | "unavailable";
};

export type ManagedCloudPartnerInvite = {
  id: string;
  ownerAccountID: string;
  invitedEmail: string;
  accessLevel: ManagedCloudPartnerAccessLevel;
  emailNotificationsAllowed: boolean;
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
  partnerEmail: string;
  accessLevel: ManagedCloudPartnerAccessLevel;
  emailNotificationsAllowed: boolean;
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
  inviteToken: string;
  inviteURL: string;
  emailDelivery: ManagedCloudPartnerEmailDelivery;
};

export type ManagedCloudAuthResult = {
  accountID: string;
  email: string;
  sessionToken: string;
  sessionExpiresAt: string;
  entitlement: ManagedCloudEntitlement;
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
  issuePartnerInvite(
    sessionToken: string,
    input: {
      invitedEmail: string;
      accessLevel: ManagedCloudPartnerAccessLevel;
      emailNotificationsAllowed: boolean;
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
};

type RawManagedCloudSessionView = {
  account_id: string;
  email: string;
  session_expires_at: string;
  sync_entitlement: RawManagedCloudEntitlement;
};

type RawManagedCloudBillingSnapshot = {
  premium_features?: {
    advanced_fertility?: boolean;
    advanced_insights?: boolean;
    doctor_pdf?: boolean;
    extended_reports?: boolean;
    partner_access?: boolean;
    reminders?: boolean;
  };
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
  invited_email: string;
  access_level: ManagedCloudPartnerAccessLevel;
  email_notifications_allowed: boolean;
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
  partner_email: string;
  access_level: ManagedCloudPartnerAccessLevel;
  email_notifications_allowed: boolean;
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
    invites: RawManagedCloudPartnerInvite[];
    grants: RawManagedCloudPartnerAccessGrant[];
  };
  shared_with_me: RawManagedCloudPartnerAccessGrant[];
};

type RawManagedCloudPartnerInviteIssueResult = {
  invite: RawManagedCloudPartnerInvite;
  invite_token: string;
  invite_url: string;
  email_delivery: {
    requested: boolean;
    status: "disabled" | "sent" | "failed" | "unavailable";
  };
};

type RawManagedCloudPartnerInviteAcceptResult = {
  invite: RawManagedCloudPartnerInvite;
  grant: RawManagedCloudPartnerAccessGrant;
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

    async issuePartnerInvite(sessionToken, input) {
      return requestJSON<RawManagedCloudPartnerInviteIssueResult>(
        fetchImpl,
        normalizedBaseURL,
        "/account/partner/invites",
        {
          method: "POST",
          sessionToken,
          body: {
            invited_email: input.invitedEmail,
            access_level: input.accessLevel,
            email_notifications_allowed: input.emailNotificationsAllowed,
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
      body: input,
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
      case "invalid_credentials":
      case "invalid_reminder_schedule":
      case "invalid_partner_invite":
      case "partner_access_not_found":
      case "partner_access_unavailable":
      case "partner_invite_email_mismatch":
      case "partner_invite_expired":
      case "partner_invite_not_found":
      case "reminder_schedule_unavailable":
      case "unauthorized":
      case "sync_not_allowed":
      case "sync_bridge_unavailable":
      case "origin_not_allowed":
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

function isRawManagedCloudAuthResult(
  value: unknown,
): value is RawManagedCloudAuthResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.email === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string" &&
    isRawManagedCloudEntitlement(value.sync_entitlement)
  );
}

function isRawManagedCloudSessionView(
  value: unknown,
): value is RawManagedCloudSessionView {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.email === "string" &&
    typeof value.session_expires_at === "string" &&
    isRawManagedCloudEntitlement(value.sync_entitlement)
  );
}

function isRawManagedCloudBillingSnapshot(
  value: unknown,
): value is RawManagedCloudBillingSnapshot {
  if (!isObject(value)) {
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
    typeof value.invited_email === "string" &&
    isPartnerAccessLevel(value.access_level) &&
    typeof value.email_notifications_allowed === "boolean" &&
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
    typeof value.partner_email === "string" &&
    isPartnerAccessLevel(value.access_level) &&
    typeof value.email_notifications_allowed === "boolean" &&
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

function isRawManagedCloudPartnerAccessOverview(
  value: unknown,
): value is RawManagedCloudPartnerAccessOverview {
  return (
    isObject(value) &&
    isObject(value.owned) &&
    Array.isArray(value.owned.invites) &&
    value.owned.invites.every(isRawManagedCloudPartnerInvite) &&
    Array.isArray(value.owned.grants) &&
    value.owned.grants.every(isRawManagedCloudPartnerAccessGrant) &&
    Array.isArray(value.shared_with_me) &&
    value.shared_with_me.every(isRawManagedCloudPartnerAccessGrant)
  );
}

function isRawManagedCloudPartnerInviteIssueResult(
  value: unknown,
): value is RawManagedCloudPartnerInviteIssueResult {
  return (
    isObject(value) &&
    typeof value.invite_token === "string" &&
    typeof value.invite_url === "string" &&
    isObject(value.email_delivery) &&
    typeof value.email_delivery.requested === "boolean" &&
    (value.email_delivery.status === "disabled" ||
      value.email_delivery.status === "sent" ||
      value.email_delivery.status === "failed" ||
      value.email_delivery.status === "unavailable") &&
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
  return {
    accountID: raw.account_id,
    email: raw.email,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
    entitlement: mapEntitlement(raw.sync_entitlement),
  };
}

function mapSessionView(raw: RawManagedCloudSessionView): ManagedCloudSessionView {
  return {
    accountID: raw.account_id,
    email: raw.email,
    sessionExpiresAt: raw.session_expires_at,
    entitlement: mapEntitlement(raw.sync_entitlement),
  };
}

function mapBillingSnapshot(
  raw: RawManagedCloudBillingSnapshot,
): ManagedCloudBillingSnapshot {
  const features = isObject(raw.premium_features) ? raw.premium_features : {};

  return {
    premiumFeatures: {
      advancedFertility: features.advanced_fertility === true,
      advancedInsights: features.advanced_insights === true,
      doctorPDF: features.doctor_pdf === true,
      extendedReports: features.extended_reports === true,
      partnerAccess: features.partner_access === true,
      reminders: features.reminders === true,
    },
  };
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
    invitedEmail: raw.invited_email,
    accessLevel: raw.access_level,
    emailNotificationsAllowed: raw.email_notifications_allowed,
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
    partnerEmail: raw.partner_email,
    accessLevel: raw.access_level,
    emailNotificationsAllowed: raw.email_notifications_allowed,
    sourceInviteID: raw.source_invite_id ?? null,
    acceptedAt: raw.accepted_at,
    lastSeenAt: raw.last_seen_at ?? null,
    revokedAt: raw.revoked_at ?? null,
    revokedReason: raw.revoked_reason ?? "",
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapPartnerAccessOverview(
  raw: RawManagedCloudPartnerAccessOverview,
): ManagedCloudPartnerAccessOverview {
  return {
    owned: {
      invites: raw.owned.invites.map(mapPartnerInvite),
      grants: raw.owned.grants.map(mapPartnerAccessGrant),
    },
    sharedWithMe: raw.shared_with_me.map(mapPartnerAccessGrant),
  };
}

function mapPartnerInviteIssueResult(
  raw: RawManagedCloudPartnerInviteIssueResult,
): ManagedCloudPartnerInviteIssueResult {
  return {
    invite: mapPartnerInvite(raw.invite),
    inviteToken: raw.invite_token,
    inviteURL: raw.invite_url,
    emailDelivery: {
      requested: raw.email_delivery.requested,
      status: raw.email_delivery.status,
    },
  };
}

function mapSyncAuthResult(raw: RawSyncAuthResult): SyncAuthResult {
  return {
    accountID: raw.account_id,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
  };
}
