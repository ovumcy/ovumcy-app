import { selectDataSharingConsentCopy } from "../i18n/data-sharing-consent-copy";
import type { InterfaceLanguage } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  DATA_SHARING_CONSENT_PURPOSES,
  withoutDataSharingConsent,
  type DataSharingConsentPurpose,
  type SyncMode,
  type SyncPreferencesRecord,
} from "../sync/sync-contract";
import { PRIVACY_POLICY_URL } from "./privacy-notice-service";

/**
 * Revision of the consent text in `data-sharing-consent-copy.ts`. Bump it when
 * that text changes what the user agrees to: a stored consent for an older
 * revision no longer counts, so the next send asks again.
 */
export const DATA_SHARING_CONSENT_REVISION = "2026-11-25";

export function resolveSyncConsentPurpose(
  mode: SyncMode,
): DataSharingConsentPurpose {
  return mode === "self_hosted" ? "self_hosted_sync" : "managed_sync";
}

export function isDataSharingConsentCurrent(
  record: Pick<SyncPreferencesRecord, "dataSharingConsent">,
  purpose: DataSharingConsentPurpose,
): boolean {
  return (
    record.dataSharingConsent?.[purpose]?.revision ===
    DATA_SHARING_CONSENT_REVISION
  );
}

export async function hasCurrentDataSharingConsent(
  storage: LocalAppStorage,
  purpose: DataSharingConsentPurpose,
): Promise<boolean> {
  return isDataSharingConsentCurrent(
    await storage.readSyncPreferencesRecord(),
    purpose,
  );
}

export async function recordDataSharingConsent(
  storage: LocalAppStorage,
  purpose: DataSharingConsentPurpose,
  now: Date,
): Promise<void> {
  const record = await storage.readSyncPreferencesRecord();
  await storage.writeSyncPreferencesRecord(record, {
    dataSharingConsent: {
      ...record.dataSharingConsent,
      [purpose]: {
        revision: DATA_SHARING_CONSENT_REVISION,
        givenAt: now.toISOString(),
      },
    },
  });
}

/** Drops the stored consent for `purposes`, so the next send asks again. */
export async function withdrawDataSharingConsent(
  storage: LocalAppStorage,
  purposes: readonly DataSharingConsentPurpose[],
): Promise<void> {
  const record = await storage.readSyncPreferencesRecord();
  const current = record.dataSharingConsent ?? {};
  if (!purposes.some((purpose) => current[purpose] !== undefined)) {
    return;
  }
  await storage.writeSyncPreferencesRecord(record, {
    dataSharingConsent: withoutDataSharingConsent(current, purposes),
  });
}

/** The purposes whose stored consent counts at the current revision. */
export async function loadCurrentDataSharingConsentPurposes(
  storage: LocalAppStorage,
): Promise<DataSharingConsentPurpose[]> {
  const record = await storage.readSyncPreferencesRecord();
  return DATA_SHARING_CONSENT_PURPOSES.filter((purpose) =>
    isDataSharingConsentCurrent(record, purpose),
  );
}

/**
 * Drops every stored consent, current or not. The send gates then refuse until
 * the user agrees again. The standalone withdrawal also revokes live partner
 * grants (data-sharing-consent-withdrawal-service); the server backup stays.
 */
export async function withdrawAllDataSharingConsent(
  storage: LocalAppStorage,
): Promise<void> {
  await withdrawDataSharingConsent(storage, DATA_SHARING_CONSENT_PURPOSES);
}

export type DataSharingConsentWithdrawalViewData = {
  title: string;
  givenHeading: string;
  given: string[];
  stops: string;
  keeps: string;
  /** Shown only while a partner-share consent is among the given purposes. */
  revokesPartners: string | null;
  confirmRevoke: string;
  confirmRevokeLabel: string;
  withdrawLabel: string;
  withdrawn: string;
  withdrawnAndRevoked: string;
  revokeFailed: string;
  failed: string;
};

export function buildDataSharingConsentWithdrawalViewData(
  purposes: readonly DataSharingConsentPurpose[],
  language: InterfaceLanguage,
): DataSharingConsentWithdrawalViewData {
  const copy = selectDataSharingConsentCopy(language).withdrawControl;
  const labels: Record<DataSharingConsentPurpose, string> = {
    managed_sync: copy.purposes.managedSync,
    self_hosted_sync: copy.purposes.selfHostedSync,
    partner_share: copy.purposes.partnerShare,
  };
  return {
    title: copy.title,
    givenHeading: copy.givenHeading,
    given: purposes.map((purpose) => labels[purpose]),
    stops: copy.stops,
    keeps: copy.keeps,
    revokesPartners: purposes.includes("partner_share")
      ? copy.revokesPartners
      : null,
    confirmRevoke: copy.confirmRevoke,
    confirmRevokeLabel: copy.confirmRevokeLabel,
    withdrawLabel: copy.withdrawLabel,
    withdrawn: copy.withdrawn,
    withdrawnAndRevoked: copy.withdrawnAndRevoked,
    revokeFailed: copy.revokeFailed,
    failed: copy.failed,
  };
}

export type DataSharingConsentViewData = {
  purpose: DataSharingConsentPurpose;
  title: string;
  intro: string;
  leavesHeading: string;
  items: string[];
  excluded: string | null;
  recipient: string;
  encryption: string;
  withdrawal: string;
  legalBasis: string;
  policyLinkLabel: string;
  policyUnavailable: string;
  policyURL: string;
  agreeLabel: string;
  declineLabel: string;
};

export function buildDataSharingConsentViewData(
  purpose: DataSharingConsentPurpose,
  language: InterfaceLanguage,
): DataSharingConsentViewData {
  const copy = selectDataSharingConsentCopy(language);
  const isPartner = purpose === "partner_share";
  const title =
    purpose === "partner_share"
      ? copy.titles.partnerShare
      : purpose === "self_hosted_sync"
        ? copy.titles.selfHostedSync
        : copy.titles.managedSync;
  const recipient =
    purpose === "partner_share"
      ? copy.recipient.partnerShare
      : purpose === "self_hosted_sync"
        ? copy.recipient.selfHostedSync
        : copy.recipient.managedSync;

  return {
    purpose,
    title,
    intro: isPartner ? copy.intro.partnerShare : copy.intro.sync,
    leavesHeading: copy.leavesHeading,
    items: isPartner
      ? [copy.partnerItems.summary, copy.partnerItems.full]
      : [
          copy.syncItems.backup,
          copy.syncItems.device,
          copy.syncItems.key,
          copy.syncItems.login,
        ],
    excluded: isPartner ? copy.partnerItems.never : null,
    recipient,
    encryption: copy.encryption,
    withdrawal: isPartner ? copy.withdrawal.partnerShare : copy.withdrawal.sync,
    legalBasis: copy.legalBasis,
    policyLinkLabel: copy.policyLinkLabel,
    policyUnavailable: copy.policyUnavailable,
    policyURL: PRIVACY_POLICY_URL,
    agreeLabel: copy.agreeLabel,
    declineLabel: copy.declineLabel,
  };
}
