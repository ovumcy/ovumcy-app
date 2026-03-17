import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("web shell onboarding reaches dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("When did your last period start?")).toBeVisible();
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(page.getByText("dd.mm.yyyy")).toBeVisible();

  await page.locator('[data-testid^="onboarding-day-option-"]').first().click();
  await page.getByText("Next").click();

  await expect(page.getByText("Set up cycle parameters")).toBeVisible();

  await page.getByTestId("onboarding-finish-button").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Dashboard shell")).toBeVisible();
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
