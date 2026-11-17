/**
 * @jest-environment jsdom
 */
import {
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteSecret,
  readManagedPartnerInviteToken,
} from "./managed-partner-invite-token-buffer";
import { scrubManagedPartnerInviteTokenFromWebUrl } from "./web-invite-token-scrub";

const SECRET = "ab".repeat(32);

describe("scrubManagedPartnerInviteTokenFromWebUrl", () => {
  beforeEach(() => {
    clearManagedPartnerInviteToken();
    window.history.replaceState({}, "", "/");
  });

  it("stashes the invite_token and strips it from window.location", () => {
    window.history.replaceState(
      { previous: "state" },
      "",
      "/backup-sync?invite_token=ABC123&kept=yes",
    );

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("ABC123");
    expect(window.location.pathname).toBe("/backup-sync");
    expect(window.location.search).toBe("?kept=yes");
    expect(window.location.href).not.toContain("invite_token");
    expect(window.history.state).toEqual({ previous: "state" });
  });

  it("strips a whitespace-only token without stashing it", () => {
    window.history.replaceState({}, "", "/backup-sync?invite_token=%20%20&kept=yes");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("");
    expect(window.location.search).toBe("?kept=yes");
  });

  it("strips an empty invite_token parameter without stashing it", () => {
    window.history.replaceState({}, "", "/backup-sync?invite_token=&kept=yes");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("");
    expect(window.location.search).toBe("?kept=yes");
  });

  it("is a no-op when the URL has no invite_token", () => {
    window.history.replaceState({}, "", "/backup-sync?kept=yes");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("");
    expect(window.location.search).toBe("?kept=yes");
  });

  it("preserves a hash fragment that carries no invite secret", () => {
    window.history.replaceState({}, "", "/backup-sync?invite_token=tok#section");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("tok");
    expect(readManagedPartnerInviteSecret()).toBe("");
    expect(window.location.hash).toBe("#section");
    expect(window.location.search).toBe("");
  });

  it("stashes the fragment invite secret with the token and strips both", () => {
    window.history.replaceState(
      { previous: "state" },
      "",
      `/backup-sync?invite_token=tok&kept=yes#k=${SECRET}`,
    );

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("tok");
    expect(readManagedPartnerInviteSecret()).toBe(SECRET);
    expect(window.location.href).not.toContain(SECRET);
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?kept=yes");
    expect(window.history.state).toEqual({ previous: "state" });
  });

  it("keeps other fragment parameters when stripping the invite secret", () => {
    window.history.replaceState({}, "", `/backup-sync?invite_token=tok#a=1&k=${SECRET}`);

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteSecret()).toBe(SECRET);
    expect(window.location.hash).toBe("#a=1");
  });

  it("strips a stray invite secret even without a token, stashing nothing", () => {
    window.history.replaceState({}, "", `/backup-sync#k=${SECRET}`);

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("");
    expect(readManagedPartnerInviteSecret()).toBe("");
    expect(window.location.href).not.toContain(SECRET);
  });

  it("stashes the token without a secret when the fragment secret is malformed", () => {
    window.history.replaceState({}, "", "/backup-sync?invite_token=tok#k=abc");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("tok");
    expect(readManagedPartnerInviteSecret()).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("removes the trailing question mark when invite_token was the only parameter", () => {
    window.history.replaceState({}, "", "/backup-sync?invite_token=lone");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("lone");
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/backup-sync");
  });

  it("trims surrounding whitespace from the stashed token", () => {
    window.history.replaceState({}, "", "/backup-sync?invite_token=%20%20padded%20%20");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("padded");
    expect(window.location.search).toBe("");
  });
});
