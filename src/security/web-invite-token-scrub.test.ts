/**
 * @jest-environment jsdom
 */
import {
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteToken,
} from "./managed-partner-invite-token-buffer";
import { scrubManagedPartnerInviteTokenFromWebUrl } from "./web-invite-token-scrub";

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

  it("preserves the URL hash fragment", () => {
    window.history.replaceState({}, "", "/backup-sync?invite_token=tok#section");

    scrubManagedPartnerInviteTokenFromWebUrl();

    expect(readManagedPartnerInviteToken()).toBe("tok");
    expect(window.location.hash).toBe("#section");
    expect(window.location.search).toBe("");
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
