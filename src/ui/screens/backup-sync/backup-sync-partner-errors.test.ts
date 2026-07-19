import { getPartnerCopy } from "../../../i18n/partner-copy";
import {
  resolveGuestUpgradeErrorMessage,
  resolvePartnerErrorMessage,
} from "./backup-sync-partner-errors";

const copy = getPartnerCopy("en");

describe("resolvePartnerErrorMessage", () => {
  it.each([
    ["not_connected", copy.errors.notConnected],
    ["invalid_partner_invite", copy.errors.invalidPartnerInvite],
    ["partner_invite_not_found", copy.errors.partnerInviteNotFound],
    ["partner_invite_expired", copy.errors.partnerInviteExpired],
    ["partner_access_unavailable", copy.errors.partnerAccessUnavailable],
    ["partner_access_not_found", copy.errors.partnerAccessNotFound],
    ["network_failed", copy.errors.networkFailed],
  ])("maps %s to its dedicated copy", (errorCode, expected) => {
    expect(resolvePartnerErrorMessage(errorCode, copy)).toBe(expected);
  });

  it("falls back to the generic message for an unmapped error code", () => {
    expect(resolvePartnerErrorMessage("some_future_code", copy)).toBe(
      copy.errors.generic,
    );
  });
});

describe("resolveGuestUpgradeErrorMessage", () => {
  it.each([
    ["unauthorized", copy.guestUpgrade.errors.unauthorized],
    ["account_not_guest", copy.guestUpgrade.alreadyUpgradedMessage],
    [
      "invalid_registration_input",
      copy.guestUpgrade.errors.invalidRegistrationInput,
    ],
    ["registration_failed", copy.guestUpgrade.errors.emailTaken],
    ["rate_limited", copy.guestUpgrade.errors.rateLimited],
    // network_failed deliberately reuses the shared (non-guestUpgrade) copy
    // key -- see the doc comment on resolveGuestUpgradeErrorMessage.
    ["network_failed", copy.errors.networkFailed],
  ])("maps %s to its dedicated copy", (errorCode, expected) => {
    expect(resolveGuestUpgradeErrorMessage(errorCode, copy)).toBe(expected);
  });

  it("falls back to the guest-upgrade generic message for an unmapped error code", () => {
    expect(resolveGuestUpgradeErrorMessage("some_future_code", copy)).toBe(
      copy.guestUpgrade.errors.generic,
    );
  });
});
