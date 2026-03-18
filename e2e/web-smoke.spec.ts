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
  await expect(page.getByTestId("day-log-save-button")).toBeVisible();
  await expect(page.getByText("Symptoms", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Interface")).toBeVisible();
  await expect(page.getByText("Account & sync")).toBeVisible();
  await page.getByTestId("settings-symptom-create-name-input").fill("Jaw pain");
  await page.getByTestId("settings-symptom-create-action-button").click();
  await expect(page.getByText("Jaw pain")).toBeVisible();

  await page.getByRole("tab", { name: /Today/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.locator('[data-testid^="day-log-symptom-"]').filter({
      hasText: "Jaw pain",
    }).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: /Calendar/ }).click();

  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByText("Day details")).toBeVisible();
  await expect(
    page.locator('[data-testid^="day-log-symptom-"]').filter({
      hasText: "Jaw pain",
    }).first(),
  ).toBeVisible();
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

  await page.getByRole("tab", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Export data")).toBeVisible();
  await expect(page.getByText("Total entries: 2")).toBeVisible();
  await expect(page.getByTestId("settings-export-pdf-button")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("settings-export-csv-button").click(),
  ]);
  await expect(csvDownload.suggestedFilename()).toContain("ovumcy-export-");
  await expect(csvDownload.suggestedFilename()).toContain(".csv");

  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("settings-export-json-button").click(),
  ]);
  await expect(jsonDownload.suggestedFilename()).toContain("ovumcy-export-");
  await expect(jsonDownload.suggestedFilename()).toContain(".json");

  await page.getByRole("tab", { name: /Insights/ }).click();

  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByText("Prediction reliability")).toBeVisible();
  await expect(page.getByText("Last cycle length")).toBeVisible();

  await page.getByRole("tab", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByTestId("settings-clear-data-confirmation-input").fill("CLEAR");
  await page.getByTestId("settings-clear-data-button").click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("When did your last period start?")).toBeVisible();

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
