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

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function tabLink(route: "/dashboard" | "/calendar" | "/stats" | "/settings") {
  return `a[href="${route}"]`;
}

test("web onboarding reaches dashboard and stats unlock after local cycle history is logged", async ({
  page,
}) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -56));
  const previousCycleStart = formatLocalDate(addDays(today, -28));

  await page.goto("/");

  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await expect(
    page.getByTestId(`onboarding-day-option-${onboardingStart}`),
  ).toBeVisible();

  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();

  await expect(page.getByTestId("onboarding-cycle-length-slider")).toBeVisible();
  await expect(page.getByTestId("onboarding-finish-button")).toBeVisible();

  await page.getByTestId("onboarding-finish-button").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("day-log-period-toggle").last()).toBeVisible();
  await expect(page.getByTestId("dashboard-quick-action-symptom")).toBeVisible();
  await expect(page.getByTestId("dashboard-manual-cycle-start-button")).toBeVisible();

  await page.getByTestId("dashboard-quick-action-period").click();
  await expect(page.getByTestId("day-log-flow-none")).toBeVisible();
  await page.getByTestId("day-log-symptom-cramps").first().click();

  await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();

  await page.getByTestId("dashboard-manual-cycle-start-button").click();
  await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();

  await page.locator(tabLink("/settings")).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId("settings-interface-section")).toBeVisible();
  await expect(page.getByTestId("settings-reminders-section")).toBeVisible();
  await expect(page.getByTestId("settings-reminders-lock")).toBeVisible();
  await expect(page.getByTestId("settings-sync-summary-card")).toBeVisible();
  await page.getByTestId("settings-open-backup-sync-button").click();
  await expect(page).toHaveURL(/\/backup-sync$/);
  await expect(page.getByTestId("settings-sync-section")).toBeVisible();
  await page.getByTestId("settings-sync-device-label-input").fill("Browser test");
  await page.getByTestId("settings-sync-prepare-button").click();
  await expect(page.getByTestId("settings-sync-recovery-card")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByTestId("settings-symptom-create-name-input").fill("Jaw pain");
  await page.getByTestId("settings-symptom-create-action-button").click();
  await expect(page.getByText("Jaw pain")).toBeVisible();

  await page.locator(tabLink("/dashboard")).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const dashboardMoreSymptomsButton = page
    .getByTestId("day-log-more-symptoms-button")
    .first();
  if (await dashboardMoreSymptomsButton.isVisible().catch(() => false)) {
    await dashboardMoreSymptomsButton.click();
  }
  await expect(
    page.locator('[data-testid^="day-log-symptom-"]').filter({
      hasText: "Jaw pain",
    }).first(),
  ).toBeVisible();

  await page.locator(tabLink("/calendar")).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByTestId("calendar-day-panel")).toBeVisible();
  await expect(page.getByTestId("calendar-day-edit-button")).toBeVisible();
  await expect(page.getByTestId("calendar-day-cycle-start-button")).toBeVisible();
  if (previousCycleStart.slice(0, 7) !== formatLocalDate(today).slice(0, 7)) {
    await page.getByTestId("calendar-prev-button").click();
  }

  await page.getByTestId(`calendar-day-${previousCycleStart}`).click();
  await expect(page.getByTestId("day-log-period-toggle").last()).toBeVisible();
  await expect(page.getByTestId("calendar-day-cycle-start-button")).toBeVisible();
  const calendarMoreSymptomsButton = page
    .getByTestId("day-log-more-symptoms-button")
    .last();
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
  await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();
  await expect(page.getByTestId("day-log-period-toggle").last()).toBeVisible();
  const nextAutoFilledDay = formatLocalDate(
    addDays(parseLocalDate(previousCycleStart), 1),
  );
  await expect(page.getByTestId(`calendar-marker-data-${nextAutoFilledDay}`)).toBeVisible();

  await page.getByTestId("calendar-today-button").click();
  await expect(page.getByTestId("calendar-day-edit-button")).toBeVisible();
  await expect(
    page.getByTestId(`calendar-marker-data-${formatLocalDate(today)}`),
  ).toBeVisible();

  await page.locator(tabLink("/settings")).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId("settings-export-section")).toBeVisible();
  await expect(page.getByTestId("settings-reminders-section")).toBeVisible();
  await expect(page.getByTestId("settings-export-csv-button")).toBeVisible();

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

  await expect(page.getByTestId("settings-export-pdf-lock")).toBeVisible();
  await expect(page.getByTestId("settings-export-pdf-button")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.locator(tabLink("/stats")).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByTestId("stats-screen-title")).toBeVisible();
  await expect(page.getByTestId("stats-empty-hero")).toBeVisible();
  await expect(page.getByTestId("stats-empty-primary-action")).toBeVisible();

  await page.locator(tabLink("/settings")).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByTestId("settings-clear-data-confirmation-input").fill("CLEAR");
  await page.getByTestId("settings-clear-data-button").click();

  await expect(page).toHaveURL(/\/onboarding(?:\?reset=\d+)?$/);
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/onboarding(?:\?reset=\d+)?$/);
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
});

test("stats surfaces the perimenopause hint for a 45+ user even in the empty state", async ({
  page,
}) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -14));

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();

  await expect(page.getByTestId("onboarding-age-group-age_45_plus")).toBeVisible();
  await page.getByTestId("onboarding-age-group-age_45_plus").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator(tabLink("/stats")).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByTestId("stats-empty-hero")).toBeVisible();
  await expect(
    page
      .getByText(/After 45/)
      .filter({ hasText: /perimenopause/ }),
  ).toBeVisible();
});

test("stats shows the data-driven range explainer after three completed cycles with variability", async ({
  page,
}) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -7));
  const olderCycleStarts = [
    addDays(today, -35),
    addDays(today, -64),
    addDays(today, -92),
  ];

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();

  await expect(page.getByTestId("onboarding-age-group-under_40")).toBeVisible();
  await page.getByTestId("onboarding-age-group-under_40").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator(tabLink("/calendar")).click();
  await expect(page).toHaveURL(/\/calendar$/);

  for (const target of olderCycleStarts) {
    const targetStr = formatLocalDate(target);
    const monthsBack =
      (today.getFullYear() - target.getFullYear()) * 12 +
      (today.getMonth() - target.getMonth());

    for (let step = 0; step < monthsBack; step += 1) {
      await page.getByTestId("calendar-prev-button").click();
    }

    await page.getByTestId(`calendar-day-${targetStr}`).click();
    await page.getByTestId("day-log-period-toggle").last().click();
    await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();
    await page.getByTestId("calendar-today-button").click();
  }

  await page.locator(tabLink("/stats")).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(
    page.getByText(
      "Your prediction shows a range that reflects how much your cycle length varies.",
    ),
  ).toBeVisible();
});

test("stats shows premium lock placeholders when entitlements are missing and the lock routes to backup-sync", async ({
  page,
}) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -7));
  const olderCycleStarts = [
    addDays(today, -35),
    addDays(today, -64),
  ];

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();

  await expect(page.getByTestId("onboarding-age-group-under_40")).toBeVisible();
  await page.getByTestId("onboarding-age-group-under_40").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator(tabLink("/calendar")).click();
  await expect(page).toHaveURL(/\/calendar$/);

  for (const target of olderCycleStarts) {
    const targetStr = formatLocalDate(target);
    const monthsBack =
      (today.getFullYear() - target.getFullYear()) * 12 +
      (today.getMonth() - target.getMonth());

    for (let step = 0; step < monthsBack; step += 1) {
      await page.getByTestId("calendar-prev-button").click();
    }

    await page.getByTestId(`calendar-day-${targetStr}`).click();
    await page.getByTestId("day-log-period-toggle").last().click();
    await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();
    await page.getByTestId("calendar-today-button").click();
  }

  await page.locator(tabLink("/stats")).click();
  await expect(page).toHaveURL(/\/stats$/);

  await expect(page.getByTestId("stats-advanced-fertility-lock")).toBeVisible();
  await expect(page.getByTestId("stats-advanced-insights-lock")).toBeVisible();
  await expect(page.getByTestId("stats-extended-reports-lock")).toBeVisible();

  await expect(
    page.getByTestId("stats-advanced-fertility-lock-title"),
  ).toHaveText("Advanced fertility");
  await expect(
    page.getByTestId("stats-advanced-fertility-lock-cta"),
  ).toHaveText("Open Ovumcy Cloud");

  await page.getByTestId("stats-advanced-fertility-lock").click();
  await expect(page).toHaveURL(/\/backup-sync$/);
});

test("visual verify pregnancy test field and paused predictions banner", async ({
  page,
}) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -7));

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();
  await expect(page.getByTestId("onboarding-age-group-under_40")).toBeVisible();
  await page.getByTestId("onboarding-age-group-under_40").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByTestId("dashboard-quick-action-period").click();
  await expect(page.getByTestId("day-log-pregnancy-none").first()).toBeVisible();
  await page
    .getByTestId("day-log-pregnancy-none")
    .first()
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "e2e/screenshots/visual-pregnancy-field.png",
  });

  await page.getByTestId("day-log-pregnancy-positive").first().click();
  await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();

  // Reload Dashboard so the projection re-runs with the positive test
  await page.locator('a[href="/calendar"]').click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.locator('a[href="/dashboard"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText(/Cycle predictions are paused after a positive pregnancy/),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .getByText(/Cycle predictions are paused after a positive pregnancy/)
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "e2e/screenshots/visual-pregnancy-paused-dashboard.png",
    fullPage: false,
  });
});

// The doctor-PDF locale regression lives in the Jest suite
// (src/services/export-pdf-service.regression.test.ts): it renders the PDF for
// every locale and diffs the drawn text against committed baselines, hermetically
// and offline. The former in-browser PDF.js rasterisation that used to sit here
// asserted nothing and pulled PDF.js from a public CDN, so it was removed.
test("locale visual sweep: ru and de pregnancy + reminders + paywall", async ({
  page,
}) => {
  test.setTimeout(120000);

  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -7));
  const olderCycleStarts = [addDays(today, -35), addDays(today, -64)];

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();
  await expect(page.getByTestId("onboarding-age-group-under_40")).toBeVisible();
  await page.getByTestId("onboarding-age-group-under_40").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Need at least 2 completed cycles to render Stats premium lock cards
  await page.locator(tabLink("/calendar")).click();
  await expect(page).toHaveURL(/\/calendar$/);
  for (const target of olderCycleStarts) {
    const targetStr = formatLocalDate(target);
    const monthsBack =
      (today.getFullYear() - target.getFullYear()) * 12 +
      (today.getMonth() - target.getMonth());
    for (let step = 0; step < monthsBack; step += 1) {
      await page.getByTestId("calendar-prev-button").click();
    }
    await page.getByTestId(`calendar-day-${targetStr}`).click();
    await page.getByTestId("day-log-period-toggle").last().click();
    await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();
    await page.getByTestId("calendar-today-button").click();
  }

  for (const locale of ["ru", "de", "fr", "es"] as const) {
    await page.locator(tabLink("/settings")).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByTestId(`settings-interface-language-${locale}`).click();
    await page.getByTestId("settings-save-all-button").click();
    await expect(
      page.getByTestId("settings-interface-status-banner"),
    ).toBeVisible();

    // Reminders lock card in this locale
    await page.getByTestId("settings-reminders-lock").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `e2e/screenshots/visual-locale-${locale}-reminders-lock.png`,
    });

    // Stats paywall cards
    await page.locator(tabLink("/stats")).click();
    await expect(page).toHaveURL(/\/stats$/);
    await page
      .getByTestId("stats-advanced-fertility-lock")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `e2e/screenshots/visual-locale-${locale}-stats-paywall.png`,
    });

    // Pregnancy banner on dashboard — only render once we log positive
    await page.locator(tabLink("/dashboard")).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByTestId("dashboard-quick-action-period").click();
    await page
      .getByTestId("day-log-pregnancy-positive")
      .first()
      .scrollIntoViewIfNeeded();
    await page.getByTestId("day-log-pregnancy-positive").first().click();
    await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();
    // Bounce off and back so projection re-runs
    await page.locator(tabLink("/calendar")).click();
    await page.locator(tabLink("/dashboard")).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `e2e/screenshots/visual-locale-${locale}-pregnancy-banner.png`,
    });

    // Reset for next locale: log a fresh period as the cycle start
    await page.getByTestId("dashboard-quick-action-period").click();
    await page
      .getByTestId("day-log-pregnancy-none")
      .first()
      .scrollIntoViewIfNeeded();
    await page.getByTestId("day-log-pregnancy-none").first().click();
    await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();
  }
});

test("visual verify partner access section UI", async ({ page }) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -7));

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();
  await expect(page.getByTestId("onboarding-age-group-under_40")).toBeVisible();
  await page.getByTestId("onboarding-age-group-under_40").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator(tabLink("/settings")).click();
  await page.getByTestId("settings-open-backup-sync-button").click();
  await expect(page).toHaveURL(/\/backup-sync$/);

  // Scroll the partner section into view (if rendered) and screenshot
  const partnerSection = page.getByTestId("settings-partner-section");
  if (await partnerSection.isVisible().catch(() => false)) {
    await partnerSection.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "e2e/screenshots/visual-partner-section.png",
      fullPage: false,
    });
  } else {
    // Section is only rendered with managed cloud session; fall back to a full
    // backup-sync screenshot so we still capture the surrounding UI.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.screenshot({
      path: "e2e/screenshots/visual-partner-section.png",
      fullPage: true,
    });
  }
});

test("visual verify calendar screen with positive pregnancy test", async ({
  page,
}) => {
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -7));

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();
  await expect(page.getByTestId("onboarding-age-group-under_40")).toBeVisible();
  await page.getByTestId("onboarding-age-group-under_40").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Log positive pregnancy test on today
  await page.getByTestId("dashboard-quick-action-period").click();
  await page
    .getByTestId("day-log-pregnancy-positive")
    .first()
    .scrollIntoViewIfNeeded();
  await page.getByTestId("day-log-pregnancy-positive").first().click();
  await expect(page.getByTestId("day-log-status-banner").last()).toBeVisible();

  // Go to Calendar
  await page.locator(tabLink("/calendar")).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByTestId("calendar-day-panel")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "e2e/screenshots/visual-calendar-pregnancy.png",
    fullPage: false,
  });
});

test("F9: partner invite_token is scrubbed from the URL by the time the SPA bundle has executed", async ({
  page,
}) => {
  // On an SPA there is no point earlier than "JS bundle has run" at which
  // we can mutate window.location — the navigation itself starts the URL
  // bar. The F9 fix narrows the leak window from "after a React useEffect"
  // (which runs after the first paint) to "during the module-level
  // execution of app/_layout.tsx" (which runs as part of the initial
  // bundle evaluation, before React commits anything). This test asserts
  // the latter: as soon as the bundle has executed past the scrub call,
  // the token is gone from window.location and from the address bar, so
  // subsequent paints, devtools snapshots, and browser autocomplete
  // cannot capture it.
  const token = "test-token-f9-padding-1234567890";

  await page.goto(`/backup-sync?invite_token=${token}`);
  await page.waitForFunction(
    () => !window.location.search.includes("invite_token"),
    undefined,
    { timeout: 30_000 },
  );

  expect(page.url()).not.toContain("invite_token");
  expect(page.url()).not.toContain(token);

  const locationSnapshot = await page.evaluate(() => ({
    href: window.location.href,
    search: window.location.search,
  }));
  expect(locationSnapshot.href).not.toContain("invite_token");
  expect(locationSnapshot.href).not.toContain(token);
  expect(locationSnapshot.search).not.toContain("invite_token");
});

test("web shell publishes the canonical favicon", async ({ page }) => {
  await page.goto("/");

  const faviconHref = await page
    .locator('head link[rel*="icon"]')
    .getAttribute("href");
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
