// A pending invite not consumed within the TTL is dropped, so it never
// outlives the pairing attempt it was stashed for. The token and the invite
// secret share one TTL and one clear.
export const MANAGED_PARTNER_INVITE_TOKEN_TTL_MS = 15 * 60 * 1000;

let pendingManagedPartnerInviteToken = "";
let pendingManagedPartnerInviteSecretHex = "";
let pendingManagedPartnerInviteTokenStashedAt = 0;

// Re-stashing the same token without a secret keeps the secret already
// buffered for it: the route param and the raw link can arrive in either
// order, and only the raw link carries the fragment on custom-scheme links.
export function stashManagedPartnerInviteToken(
  inviteToken: string,
  inviteSecretHex = "",
): void {
  const token = inviteToken.trim();
  const secret = inviteSecretHex.trim();
  const keepSecret =
    secret === "" &&
    token === pendingManagedPartnerInviteToken &&
    managedPartnerInviteTokenRemainingMs() > 0;
  pendingManagedPartnerInviteSecretHex = keepSecret
    ? pendingManagedPartnerInviteSecretHex
    : secret;
  pendingManagedPartnerInviteToken = token;
  pendingManagedPartnerInviteTokenStashedAt = Date.now();
}

// Attaches a secret only to the invite already buffered under the same
// token, so a stale link can never pair its secret with another invite.
export function attachManagedPartnerInviteSecret(
  inviteToken: string,
  inviteSecretHex: string,
): void {
  const token = inviteToken.trim();
  const secret = inviteSecretHex.trim();
  if (
    secret === "" ||
    token === "" ||
    readManagedPartnerInviteToken() !== token
  ) {
    return;
  }
  pendingManagedPartnerInviteSecretHex = secret;
}

export function readManagedPartnerInviteToken(): string {
  if (managedPartnerInviteTokenRemainingMs() === 0) {
    clearManagedPartnerInviteToken();
  }
  return pendingManagedPartnerInviteToken;
}

export function readManagedPartnerInviteSecret(): string {
  if (managedPartnerInviteTokenRemainingMs() === 0) {
    clearManagedPartnerInviteToken();
  }
  return pendingManagedPartnerInviteSecretHex;
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
  pendingManagedPartnerInviteSecretHex = "";
  pendingManagedPartnerInviteTokenStashedAt = 0;
}
