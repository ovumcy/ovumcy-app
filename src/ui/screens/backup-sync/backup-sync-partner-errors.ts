import { getPartnerCopy } from "../../../i18n/partner-copy";

export function resolvePartnerErrorMessage(
  errorCode: string,
  copy: ReturnType<typeof getPartnerCopy>,
): string {
  switch (errorCode) {
    case "not_connected":
      return copy.errors.notConnected;
    case "invalid_partner_invite":
      return copy.errors.invalidPartnerInvite;
    case "partner_invite_not_found":
      return copy.errors.partnerInviteNotFound;
    case "partner_invite_expired":
      return copy.errors.partnerInviteExpired;
    case "partner_access_unavailable":
      return copy.errors.partnerAccessUnavailable;
    case "partner_access_not_found":
      return copy.errors.partnerAccessNotFound;
    case "network_failed":
      return copy.errors.networkFailed;
    default:
      return copy.errors.generic;
  }
}

// resolveGuestUpgradeErrorMessage maps POST /account/upgrade error codes to
// copy. "account_not_guest" is handled separately by the caller (it hides
// the CTA rather than showing a retryable error) but is mapped here too so
// an unexpected mid-form arrival still renders something coherent instead of
// falling through to the generic message.
export function resolveGuestUpgradeErrorMessage(
  errorCode: string,
  copy: ReturnType<typeof getPartnerCopy>,
): string {
  switch (errorCode) {
    case "unauthorized":
      return copy.guestUpgrade.errors.unauthorized;
    case "account_not_guest":
      return copy.guestUpgrade.alreadyUpgradedMessage;
    case "invalid_registration_input":
      return copy.guestUpgrade.errors.invalidRegistrationInput;
    case "registration_failed":
      return copy.guestUpgrade.errors.emailTaken;
    case "rate_limited":
      return copy.guestUpgrade.errors.rateLimited;
    case "network_failed":
      return copy.errors.networkFailed;
    default:
      return copy.guestUpgrade.errors.generic;
  }
}
