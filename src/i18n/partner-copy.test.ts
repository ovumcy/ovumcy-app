import { getPartnerCopy } from "./partner-copy";

describe("partner copy invite link hint", () => {
  it.each([
    ["en", "guest"],
    ["de", "Gast"],
    ["fr", "invité"],
    ["ru", "гость"],
    ["es", "invitad"],
    ["it", "ospite"],
  ])("names guest acceptance in %s", (locale, guestWord) => {
    const copy = getPartnerCopy(locale);

    expect(copy.inviteLinkHint).toContain(guestWord);
    expect(copy.shareInviteLinkLabel.length).toBeGreaterThan(0);
    expect(copy.inviteReplacedNotice.length).toBeGreaterThan(0);
  });
});

describe("partner copy (ru)", () => {
  const copy = getPartnerCopy("ru");

  it("pluralises the guest-access expiry nudge in the formal register", () => {
    expect(copy.guestUpgrade.nudgeMessage(1)).toBe(
      "Гостевой доступ истекает через 1 день — сохраните его заранее.",
    );
    expect(copy.guestUpgrade.nudgeMessage(3)).toBe(
      "Гостевой доступ истекает через 3 дня — сохраните его заранее.",
    );
    expect(copy.guestUpgrade.nudgeMessage(5)).toBe(
      "Гостевой доступ истекает через 5 дней — сохраните его заранее.",
    );
  });

  it("addresses the reader formally in the guest-upgrade reveal hint", () => {
    expect(copy.guestUpgrade.revealHint).toContain("забудете");
  });
});
