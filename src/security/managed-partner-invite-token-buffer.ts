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
  if (managedPartnerInviteTokenRemainingMs() === 0) {
    clearManagedPartnerInviteToken();
  }
  return pendingManagedPartnerInviteToken;
}

// 0 when nothing is buffered or the TTL has run out. A clock moved backwards
// counts as expired, so a clock change cannot extend the token's life.
export function managedPartnerInviteTokenRemainingMs(): number {
  if (pendingManagedPartnerInviteToken === "") {
    return 0;
  }
  const elapsed = Date.now() - pendingManagedPartnerInviteTokenStashedAt;
  if (elapsed < 0 || elapsed >= MANAGED_PARTNER_INVITE_TOKEN_TTL_MS) {
    return 0;
  }
  return MANAGED_PARTNER_INVITE_TOKEN_TTL_MS - elapsed;
}

export function clearManagedPartnerInviteToken(): void {
  pendingManagedPartnerInviteToken = "";
  pendingManagedPartnerInviteTokenStashedAt = 0;
}
