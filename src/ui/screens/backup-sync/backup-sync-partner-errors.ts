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
