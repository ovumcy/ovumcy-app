import { expect, test } from "@playwright/test";

function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

test("web onboarding reaches dashboard and stats unlock after local cycle history is logged", async ({
  page,
}) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -56));
  const previousCycleStart = formatLocalDate(addDays(today, -28));

  await page.goto("/");

  await expect(page.getByText("When did your last period start?")).toBeVisible();
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(page.getByText("dd.mm.yyyy")).toBeVisible();

  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByText("Next").click();

  await expect(page.getByText("Set up cycle parameters")).toBeVisible();

  await page.getByTestId("onboarding-finish-button").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Cycle snapshot")).toBeVisible();
  await expect(page.getByTestId("day-log-save-button")).toBeVisible();

  await page.getByText("Calendar").click();

  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByText("Day details")).toBeVisible();
  if (previousCycleStart.slice(0, 7) !== formatLocalDate(today).slice(0, 7)) {
    await page.getByTestId("calendar-prev-button").click();
  }

  await page.getByTestId(`calendar-day-${previousCycleStart}`).click();
  await page.getByTestId("day-log-period-toggle").last().click();
  await page.getByTestId("day-log-save-button").last().click();

  await expect(page.getByText("Saved locally.")).toBeVisible();

  await page.getByTestId("calendar-today-button").click();
  await page.getByTestId("day-log-period-toggle").last().click();
  await page.getByTestId("day-log-save-button").last().click();

  await expect(page.getByText("Saved locally.")).toBeVisible();
  await expect(
    page.getByTestId(`calendar-marker-data-${formatLocalDate(today)}`),
  ).toBeVisible();

  await page.getByText("Insights").click();

  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByText("Prediction reliability")).toBeVisible();
  await expect(page.getByText("Last cycle length")).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("When did your last period start?")).toBeVisible();
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
