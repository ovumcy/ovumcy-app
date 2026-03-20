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
  await expect(page.getByTestId("dashboard-quick-action-symptom")).toBeVisible();
  await expect(page.getByTestId("dashboard-manual-cycle-start-button")).toBeVisible();

  await page.getByTestId("dashboard-quick-action-period").click();
  await expect(page.getByText("Flow")).toBeVisible();
  await page.getByTestId("day-log-symptom-cramps").first().click();
  await page.getByTestId("day-log-save-button").click();

  await expect(page.getByText("Entry saved locally.")).toBeVisible();

  await page.getByTestId("dashboard-manual-cycle-start-button").click();
  await expect(page.getByText("Cycle start updated locally.")).toBeVisible();

  await page.getByRole("tab", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId("settings-interface-section")).toBeVisible();
  await expect(page.getByTestId("settings-sync-section")).toBeVisible();
  await page.getByTestId("settings-sync-device-label-input").fill("Browser test");
  await page.getByTestId("settings-sync-prepare-button").click();
  await expect(page.getByTestId("settings-sync-recovery-card")).toBeVisible();
  await page.getByTestId("settings-symptom-create-name-input").fill("Jaw pain");
  await page.getByTestId("settings-symptom-create-action-button").click();
  await expect(page.getByText("Jaw pain")).toBeVisible();

  await page.getByRole("tab", { name: /Today/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const dashboardMoreSymptomsButton = page.getByTestId("day-log-more-symptoms-button").first();
  if (await dashboardMoreSymptomsButton.isVisible().catch(() => false)) {
    await dashboardMoreSymptomsButton.click();
  }
  await expect(
    page.locator('[data-testid^="day-log-symptom-"]').filter({
      hasText: "Jaw pain",
    }).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: /Calendar/ }).click();

  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByTestId("calendar-day-panel")).toBeVisible();
  await expect(page.getByTestId("calendar-day-edit-button")).toBeVisible();
  await expect(page.getByTestId("calendar-day-cycle-start-button")).toBeVisible();
  if (previousCycleStart.slice(0, 7) !== formatLocalDate(today).slice(0, 7)) {
    await page.getByTestId("calendar-prev-button").click();
  }

  await page.getByTestId(`calendar-day-${previousCycleStart}`).click();
  await expect(page.getByTestId("calendar-day-add-button")).toBeVisible();
  await expect(
    page.getByTestId("calendar-day-cycle-start-button"),
  ).toBeVisible();
  await page.getByTestId("calendar-day-add-button").click();
  const calendarMoreSymptomsButton = page.getByTestId("day-log-more-symptoms-button").last();
  if (await calendarMoreSymptomsButton.isVisible().catch(() => false)) {
    await calendarMoreSymptomsButton.click();
  }
  await expect(
    page.locator('[data-testid^="day-log-symptom-"]').filter({
      hasText: "Jaw pain",
    }).last(),
  ).toBeVisible();
  await page.getByTestId("day-log-period-toggle").last().click();
  await page.getByTestId("day-log-symptom-cramps").last().click();
  await page.getByTestId("day-log-save-button").last().click();

  await expect(page.getByText("Entry saved locally.")).toBeVisible();
  await expect(page.getByTestId("calendar-day-edit-button")).toBeVisible();

  await page.getByTestId("calendar-today-button").click();
  await expect(page.getByTestId("calendar-day-edit-button")).toBeVisible();
  await expect(
    page.getByTestId(`calendar-marker-data-${formatLocalDate(today)}`),
  ).toBeVisible();

  await page.getByRole("tab", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Export data")).toBeVisible();
  await expect(page.getByText("Total entries: 2")).toBeVisible();

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

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("settings-export-pdf-button").click(),
  ]);
  await expect(pdfDownload.suggestedFilename()).toContain("ovumcy-export-");
  await expect(pdfDownload.suggestedFilename()).toContain(".pdf");

  await page.getByRole("tab", { name: /Insights/ }).click();

  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByText("Prediction reliability")).toBeVisible();
  await expect(page.getByText("Cycle trend")).toBeVisible();
  await expect(page.getByText("Symptom frequency")).toBeVisible();
  await expect(page.getByText("Last cycle symptoms")).toBeVisible();
  await expect(
    page.getByTestId("stats-symptom-frequency").getByText("Cramps"),
  ).toBeVisible();

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
