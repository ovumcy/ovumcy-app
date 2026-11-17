import {
  MANAGED_PARTNER_INVITE_TOKEN_TTL_MS,
  attachManagedPartnerInviteSecret,
  clearManagedPartnerInviteToken,
  managedPartnerInviteTokenRemainingMs,
  readManagedPartnerInviteSecret,
  readManagedPartnerInviteToken,
  stashManagedPartnerInviteToken,
} from "./managed-partner-invite-token-buffer";

const SECRET = "11".repeat(32);

describe("managed-partner-invite-token-buffer invite secret", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 30, 12));
    clearManagedPartnerInviteToken();
  });

  afterEach(() => {
    clearManagedPartnerInviteToken();
    jest.useRealTimers();
  });

  it("holds the secret with its token and drops both together at the TTL", () => {
    stashManagedPartnerInviteToken("invite-token", SECRET);
    expect(readManagedPartnerInviteSecret()).toBe(SECRET);

    jest.advanceTimersByTime(MANAGED_PARTNER_INVITE_TOKEN_TTL_MS);

    expect(readManagedPartnerInviteSecret()).toBe("");
    expect(readManagedPartnerInviteToken()).toBe("");
  });

  it("clears the secret together with the token", () => {
    stashManagedPartnerInviteToken("invite-token", SECRET);
    clearManagedPartnerInviteToken();

    expect(readManagedPartnerInviteSecret()).toBe("");
  });

  it("keeps the secret when the same token is re-stashed without one", () => {
    stashManagedPartnerInviteToken("invite-token", SECRET);
    stashManagedPartnerInviteToken("invite-token");

    expect(readManagedPartnerInviteSecret()).toBe(SECRET);
  });

  it("drops the secret when a different token is stashed", () => {
    stashManagedPartnerInviteToken("first", SECRET);
    stashManagedPartnerInviteToken("second");

    expect(readManagedPartnerInviteSecret()).toBe("");
  });

  it("does not carry an expired invite's secret over to a re-stash of its token", () => {
    stashManagedPartnerInviteToken("invite-token", SECRET);
    jest.advanceTimersByTime(MANAGED_PARTNER_INVITE_TOKEN_TTL_MS);
    stashManagedPartnerInviteToken("invite-token");

    expect(readManagedPartnerInviteSecret()).toBe("");
  });

  it("attaches a secret only to the invite buffered under the same token", () => {
    attachManagedPartnerInviteSecret("invite-token", SECRET);
    expect(readManagedPartnerInviteSecret()).toBe("");

    stashManagedPartnerInviteToken("invite-token");
    attachManagedPartnerInviteSecret("other-token", SECRET);
    expect(readManagedPartnerInviteSecret()).toBe("");

    attachManagedPartnerInviteSecret("invite-token", SECRET);
    expect(readManagedPartnerInviteSecret()).toBe(SECRET);
  });
});

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
