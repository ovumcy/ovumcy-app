let pendingManagedPartnerInviteToken = "";

export function stashManagedPartnerInviteToken(inviteToken: string): void {
  pendingManagedPartnerInviteToken = inviteToken.trim();
}

export function readManagedPartnerInviteToken(): string {
  return pendingManagedPartnerInviteToken;
}

export function clearManagedPartnerInviteToken(): void {
  pendingManagedPartnerInviteToken = "";
}
