import {
  MANAGED_PARTNER_INVITE_TOKEN_TTL_MS,
  clearManagedPartnerInviteToken,
  managedPartnerInviteTokenRemainingMs,
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

  it("treats a clock moved backwards as expired", () => {
    stashManagedPartnerInviteToken("invite-token");
    jest.setSystemTime(new Date(2026, 2, 29, 12));

    expect(managedPartnerInviteTokenRemainingMs()).toBe(0);
    expect(readManagedPartnerInviteToken()).toBe("");
  });

  it("reports the time left and 0 when nothing is buffered", () => {
    expect(managedPartnerInviteTokenRemainingMs()).toBe(0);
    stashManagedPartnerInviteToken("invite-token");
    jest.advanceTimersByTime(1000);

    expect(managedPartnerInviteTokenRemainingMs()).toBe(
      MANAGED_PARTNER_INVITE_TOKEN_TTL_MS - 1000,
    );
  });

  it("clears on demand", () => {
    stashManagedPartnerInviteToken("invite-token");
    clearManagedPartnerInviteToken();

    expect(readManagedPartnerInviteToken()).toBe("");
  });
});
