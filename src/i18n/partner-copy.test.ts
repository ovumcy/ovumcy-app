import { getPartnerCopy } from "./partner-copy";

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
