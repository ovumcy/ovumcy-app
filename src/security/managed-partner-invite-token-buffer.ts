// A pending invite token not consumed within the TTL is dropped, so it never
// outlives the pairing attempt it was stashed for.
export const MANAGED_PARTNER_INVITE_TOKEN_TTL_MS = 15 * 60 * 1000;

let pendingManagedPartnerInviteToken = "";
let pendingManagedPartnerInviteTokenStashedAt = 0;

export function stashManagedPartnerInviteToken(inviteToken: string): void {
  pendingManagedPartnerInviteToken = inviteToken.trim();
  pendingManagedPartnerInviteTokenStashedAt = Date.now();
}

export function readManagedPartnerInviteToken(): string {
  if (
    pendingManagedPartnerInviteToken !== "" &&
    Date.now() - pendingManagedPartnerInviteTokenStashedAt >=
      MANAGED_PARTNER_INVITE_TOKEN_TTL_MS
  ) {
    clearManagedPartnerInviteToken();
  }
  return pendingManagedPartnerInviteToken;
}

export function clearManagedPartnerInviteToken(): void {
  pendingManagedPartnerInviteToken = "";
  pendingManagedPartnerInviteTokenStashedAt = 0;
}
