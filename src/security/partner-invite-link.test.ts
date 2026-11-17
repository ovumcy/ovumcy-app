import {
  buildShareablePartnerInviteURL,
  isPartnerInviteSecretHex,
  parsePartnerInviteLink,
  parsePartnerInviteSecretFromFragment,
  removePartnerInviteSecretFromFragment,
} from "./partner-invite-link";

const SECRET = "ab".repeat(32);

describe("buildShareablePartnerInviteURL", () => {
  it("appends the secret as the fragment of the server's URL", () => {
    expect(
      buildShareablePartnerInviteURL(
        "https://invite.ovumcy.cloud/backup-sync?invite_token=tok",
        SECRET,
      ),
    ).toBe(`https://invite.ovumcy.cloud/backup-sync?invite_token=tok#k=${SECRET}`);
  });

  it("replaces any fragment the server put on its URL", () => {
    expect(
      buildShareablePartnerInviteURL(
        "ovumcy://backup-sync?invite_token=tok#k=server-chosen",
        SECRET,
      ),
    ).toBe(`ovumcy://backup-sync?invite_token=tok#k=${SECRET}`);
  });

  it.each([
    "https://evil.example/backup-sync?invite_token=tok",
    "https://invite.ovumcy.cloud.evil.example/backup-sync?invite_token=tok",
    "https://invite.ovumcy.cloud/other?invite_token=tok",
    "http://invite.ovumcy.cloud/backup-sync?invite_token=tok",
    "https://invite.ovumcy.cloud/backup-sync",
    "javascript:alert(1)//?invite_token=tok",
  ])("refuses a server URL outside the pinned link bases: %s", (serverURL) => {
    expect(() => buildShareablePartnerInviteURL(serverURL, SECRET)).toThrow(
      "invalid_partner_invite",
    );
  });

  it("refuses a malformed secret", () => {
    expect(() =>
      buildShareablePartnerInviteURL("ovumcy://backup-sync?invite_token=tok", "abc"),
    ).toThrow("invalid_partner_invite");
  });
});

describe("parsePartnerInviteSecretFromFragment", () => {
  it.each([
    [`k=${SECRET}`, SECRET],
    [`#k=${SECRET}`, SECRET],
    [`a=1&k=${SECRET}`, SECRET],
    ["", ""],
    [undefined, ""],
    ["k=", ""],
    [`k=${SECRET.toUpperCase()}`, ""],
    [`k=${SECRET}0`, ""],
    [`k=${SECRET}&k=${SECRET}`, ""],
  ])("parses %p as %p", (fragment, expected) => {
    expect(parsePartnerInviteSecretFromFragment(fragment)).toBe(expected);
  });
});

describe("removePartnerInviteSecretFromFragment", () => {
  it("drops only the secret parameter", () => {
    expect(removePartnerInviteSecretFromFragment(`#a=1&k=${SECRET}&b=2`)).toBe(
      "a=1&b=2",
    );
    expect(removePartnerInviteSecretFromFragment(`#k=${SECRET}`)).toBe("");
  });
});

describe("parsePartnerInviteLink", () => {
  it("reads token and secret from a custom-scheme link", () => {
    expect(
      parsePartnerInviteLink(`ovumcy://backup-sync?invite_token=tok%2Bx&kept=1#k=${SECRET}`),
    ).toEqual({ inviteToken: "tok+x", inviteSecretHex: SECRET });
  });

  it("does not read a token that only appears in the fragment", () => {
    expect(
      parsePartnerInviteLink(`ovumcy://backup-sync#invite_token=tok&k=${SECRET}`)
        .inviteToken,
    ).toBe("");
  });

  it("keeps a token whose percent-encoding is malformed as written", () => {
    expect(parsePartnerInviteLink("ovumcy://backup-sync?invite_token=tok%E0%A4%A").inviteToken).toBe(
      "tok%E0%A4%A",
    );
  });

  it("returns empty values for a missing link", () => {
    expect(parsePartnerInviteLink(null)).toEqual({
      inviteToken: "",
      inviteSecretHex: "",
    });
  });
});

describe("isPartnerInviteSecretHex", () => {
  it("accepts only 64 lowercase hex characters", () => {
    expect(isPartnerInviteSecretHex(SECRET)).toBe(true);
    expect(isPartnerInviteSecretHex(SECRET.slice(2))).toBe(false);
    expect(isPartnerInviteSecretHex(SECRET.toUpperCase())).toBe(false);
  });
});
