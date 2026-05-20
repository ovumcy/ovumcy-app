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

test.describe("PDF locale visual sweep", () => {
  for (const locale of ["en", "ru", "de", "fr", "es"] as const) {
    test(`renders sample doctor PDF in ${locale}`, async ({ page }) => {
      const { existsSync, copyFileSync, writeFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const pdfSrc = join(
        process.cwd(),
        "e2e",
        "screenshots",
        `sample-doctor-${locale}.pdf`,
      );
      const pdfDest = join(process.cwd(), "dist", `sample-doctor-${locale}.pdf`);
      test.skip(!existsSync(pdfSrc), `Sample PDF for ${locale} not generated yet`);
      copyFileSync(pdfSrc, pdfDest);

      for (const pageIndex of [1, 2]) {
        const viewerHtml = `
          <!doctype html>
          <html><head><meta charset="utf-8"/><title>PDF viewer</title>
            <style>html,body{margin:0;padding:0;background:#fff;}</style>
          </head>
          <body>
            <canvas id="page"></canvas>
            <script type="module">
              import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs";
              pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
              try {
                const pdf = await pdfjs.getDocument("/sample-doctor-${locale}.pdf").promise;
                if (pdf.numPages >= ${pageIndex}) {
                  const pdfPage = await pdf.getPage(${pageIndex});
                  const viewport = pdfPage.getViewport({ scale: 1.4 });
                  const canvas = document.getElementById("page");
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
                }
              } finally {
                window.__pdfDone = true;
              }
            </script>
          </body></html>
        `;
        writeFileSync(
          join(process.cwd(), "dist", `pdf-viewer-${locale}.html`),
          viewerHtml,
        );
        await page.goto(`http://127.0.0.1:4173/pdf-viewer-${locale}.html`);
        await page.waitForFunction(
          () => (window as unknown as { __pdfDone?: boolean }).__pdfDone === true,
          undefined,
          { timeout: 15000 },
        );
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `e2e/screenshots/visual-pdf-${locale}-page${pageIndex}.png`,
          fullPage: true,
        });
      }
    });
  }
});

test("render the sample doctor PDF first page for visual inspection", async ({
  page,
}) => {
  // Requires e2e/screenshots/sample-doctor.pdf to be generated first:
  // OVUMCY_PDF_SAMPLE=1 npx jest export-pdf-service.sample
  const { existsSync, copyFileSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const pdfSrc = join(process.cwd(), "e2e", "screenshots", "sample-doctor.pdf");
  const pdfDest = join(process.cwd(), "dist", "sample-doctor.pdf");
  test.skip(!existsSync(pdfSrc), "Sample PDF not generated yet");
  copyFileSync(pdfSrc, pdfDest);

  // Wrap the PDF in a PDF.js viewer so we can rasterize each page.
  for (const pageIndex of [1, 2]) {
    const viewerHtml = `
      <!doctype html>
      <html><head><meta charset="utf-8"/><title>PDF viewer</title>
        <style>html,body{margin:0;padding:0;background:#fff;}</style>
      </head>
      <body>
        <canvas id="page"></canvas>
        <script type="module">
          import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs";
          pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
          try {
            const pdf = await pdfjs.getDocument("/sample-doctor.pdf").promise;
            window.__pdfPageCount = pdf.numPages;
            if (pdf.numPages >= ${pageIndex}) {
              const page = await pdf.getPage(${pageIndex});
              const viewport = page.getViewport({ scale: 1.4 });
              const canvas = document.getElementById("page");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
            }
          } finally {
            window.__pdfDone = true;
          }
        </script>
      </body></html>
    `;
    writeFileSync(join(process.cwd(), "dist", "pdf-viewer.html"), viewerHtml);

    await page.goto(`http://127.0.0.1:4173/pdf-viewer.html`);
    await page.waitForFunction(() => (window as unknown as { __pdfDone?: boolean }).__pdfDone === true, undefined, { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `e2e/screenshots/visual-pdf-page${pageIndex}.png`,
      fullPage: true,
    });
  }
});

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

test("visual verify premium screens by mocking the managed billing snapshot", async ({
  page,
}) => {
  test.setTimeout(120000);
  const today = new Date();
  const onboardingStart = formatLocalDate(addDays(today, -7));
  const olderCycleStarts = [addDays(today, -35), addDays(today, -64)];

  // Intercept billing snapshot and return all premium features active
  await page.route("**/account/billing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        has_active_plan: true,
        premium_features: {
          advanced_fertility: true,
          advanced_insights: true,
          doctor_pdf: true,
          extended_reports: true,
          partner_access: true,
          reminders: true,
        },
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("onboarding-next-button")).toBeVisible();
  await page.getByTestId(`onboarding-day-option-${onboardingStart}`).click();
  await page.getByTestId("onboarding-next-button").click();
  await expect(page.getByTestId("onboarding-age-group-under_40")).toBeVisible();
  await page.getByTestId("onboarding-age-group-under_40").click();
  await page.getByTestId("onboarding-finish-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Log a few cycles to unlock insights
  await page.locator(tabLink("/calendar")).click();
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

  // Set up managed cloud session
  await page.locator(tabLink("/settings")).click();
  await page.getByTestId("settings-open-backup-sync-button").click();
  await expect(page).toHaveURL(/\/backup-sync$/);
  await page.getByTestId("settings-sync-device-label-input").fill("Premium test");
  await page.getByTestId("settings-sync-prepare-button").click();
  await expect(page.getByTestId("settings-sync-recovery-card")).toBeVisible();

  // Register against the local managed dev server so the app has a session
  const uniqueEmail = `premium-test-${Date.now()}@ovumcy.test`;
  await page.getByTestId("settings-sync-login-input").fill(uniqueEmail);
  await page.getByTestId("settings-sync-password-input").fill("CorrectHorseBattery42!");
  await page.getByTestId("settings-sync-register-button").click();
  await page
    .getByTestId("settings-sync-managed-account-banner")
    .waitFor({ timeout: 30000 });

  // Go to Stats — should now see real premium sections instead of locks
  await page.locator(tabLink("/stats")).click();
  await expect(page).toHaveURL(/\/stats$/);
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({
    path: "e2e/screenshots/visual-premium-stats.png",
    fullPage: true,
  });
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
