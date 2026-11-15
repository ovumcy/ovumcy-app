import {
  MANAGED_PARTNER_INVITE_TOKEN_TTL_MS,
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteToken,
  stashManagedPartnerInviteToken,
} from "./managed-partner-invite-token-buffer";

describe("managed-partner-invite-token-buffer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 30, 12));
    clearManagedPartnerInviteToken();
  });

  afterEach(() => {
    clearManagedPartnerInviteToken();
    jest.useRealTimers();
  });

  it("returns the trimmed token within the TTL", () => {
    stashManagedPartnerInviteToken("  invite-token  ");
    jest.advanceTimersByTime(MANAGED_PARTNER_INVITE_TOKEN_TTL_MS - 1);

    expect(readManagedPartnerInviteToken()).toBe("invite-token");
  });

  it("drops the token once the TTL has elapsed", () => {
    stashManagedPartnerInviteToken("invite-token");
    jest.advanceTimersByTime(MANAGED_PARTNER_INVITE_TOKEN_TTL_MS);

    expect(readManagedPartnerInviteToken()).toBe("");
    jest.setSystemTime(new Date(2026, 2, 30, 12));
    expect(readManagedPartnerInviteToken()).toBe("");
  });

  it("restarts the TTL when a new token is stashed", () => {
    stashManagedPartnerInviteToken("first");
    jest.advanceTimersByTime(MANAGED_PARTNER_INVITE_TOKEN_TTL_MS - 1);
    stashManagedPartnerInviteToken("second");
    jest.advanceTimersByTime(MANAGED_PARTNER_INVITE_TOKEN_TTL_MS - 1);

    expect(readManagedPartnerInviteToken()).toBe("second");
  });

  it("clears on demand", () => {
    stashManagedPartnerInviteToken("invite-token");
    clearManagedPartnerInviteToken();

    expect(readManagedPartnerInviteToken()).toBe("");
  });
});
