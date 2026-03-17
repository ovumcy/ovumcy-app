import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("web onboarding reaches dashboard and the local journal persists into calendar", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("When did your last period start?")).toBeVisible();
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(page.getByText("dd.mm.yyyy")).toBeVisible();

  await page.locator('[data-testid^="onboarding-day-option-"]').first().click();
  await page.getByText("Next").click();

  await expect(page.getByText("Set up cycle parameters")).toBeVisible();

  await page.getByTestId("onboarding-finish-button").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Cycle snapshot")).toBeVisible();
  await expect(page.getByTestId("day-log-save-button")).toBeVisible();

  await page.getByTestId("day-log-period-toggle").click();
  await page.getByTestId("day-log-save-button").click();

  await expect(page.getByText("Saved locally.")).toBeVisible();

  await page.getByText("Calendar").click();

  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByText("Day details")).toBeVisible();
  await expect(page.getByTestId("day-log-delete-button").first()).toBeVisible();
});

test("web shell publishes the canonical favicon", async ({ page }) => {
  await page.goto("/");

  const faviconHref = await page.locator('head link[rel*="icon"]').getAttribute("href");
  expect(faviconHref).toContain("favicon");

  const faviconResponse = await page.evaluate(async () => {
    const response = await fetch("/favicon.ico", { cache: "no-store" });
    return {
      contentType: response.headers.get("content-type"),
      status: response.status,
    };
  });

  expect(faviconResponse.status).toBe(200);
  expect(faviconResponse.contentType).toContain("image");
});
