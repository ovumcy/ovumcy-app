import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import {
  DATA_SHARING_CONSENT_PURPOSES,
  normalizeDataSharingConsentRecord,
  resolveSyncModeConsentPurposes,
} from "../sync/sync-contract";
import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import {
  DATA_SHARING_CONSENT_REVISION,
  buildDataSharingConsentViewData,
  hasCurrentDataSharingConsent,
  recordDataSharingConsent,
  resolveSyncConsentPurpose,
  withdrawDataSharingConsent,
} from "./data-sharing-consent-service";
import { PRIVACY_POLICY_URL } from "./privacy-notice-service";

const NOW = new Date("2026-11-25T08:00:00.000Z");

describe("data-sharing consent record", () => {
  it("has no consent on a fresh device", async () => {
    const storage = createVolatileWebAppStorage();

    for (const purpose of DATA_SHARING_CONSENT_PURPOSES) {
      await expect(hasCurrentDataSharingConsent(storage, purpose)).resolves.toBe(false);
    }
  });

  it("records the revision and date for one purpose only", async () => {
    const storage = createVolatileWebAppStorage();

    await recordDataSharingConsent(storage, "managed_sync", NOW);

    await expect(storage.readSyncPreferencesRecord()).resolves.toMatchObject({
      dataSharingConsent: {
        managed_sync: {
          revision: DATA_SHARING_CONSENT_REVISION,
          givenAt: NOW.toISOString(),
        },
      },
    });
    await expect(hasCurrentDataSharingConsent(storage, "managed_sync")).resolves.toBe(true);
    await expect(hasCurrentDataSharingConsent(storage, "self_hosted_sync")).resolves.toBe(false);
    await expect(hasCurrentDataSharingConsent(storage, "partner_share")).resolves.toBe(false);
  });

  it("survives an ordinary preferences write built from an older in-memory copy", async () => {
    const storage = createVolatileWebAppStorage();
    const staleCopy = await storage.readSyncPreferencesRecord();

    await recordDataSharingConsent(storage, "partner_share", NOW);
    await storage.writeSyncPreferencesRecord({ ...staleCopy, deviceLabel: "Pixel 7" });

    await expect(hasCurrentDataSharingConsent(storage, "partner_share")).resolves.toBe(true);
  });

  it("does not count a consent given for an older revision of the text", async () => {
    const storage = createVolatileWebAppStorage();
    const record = await storage.readSyncPreferencesRecord();
    await storage.writeSyncPreferencesRecord(record, {
      dataSharingConsent: {
        managed_sync: { revision: "2020-01-01", givenAt: "2020-01-01T08:00:00.000Z" },
      },
    });

    await expect(hasCurrentDataSharingConsent(storage, "managed_sync")).resolves.toBe(false);
  });

  it("withdraws only the named purposes", async () => {
    const storage = createVolatileWebAppStorage();
    await recordDataSharingConsent(storage, "managed_sync", NOW);
    await recordDataSharingConsent(storage, "partner_share", NOW);
    await recordDataSharingConsent(storage, "self_hosted_sync", NOW);

    await withdrawDataSharingConsent(storage, resolveSyncModeConsentPurposes("managed"));

    await expect(hasCurrentDataSharingConsent(storage, "managed_sync")).resolves.toBe(false);
    await expect(hasCurrentDataSharingConsent(storage, "partner_share")).resolves.toBe(false);
    await expect(hasCurrentDataSharingConsent(storage, "self_hosted_sync")).resolves.toBe(true);
  });

  it("is cleared by the local data reset", async () => {
    const storage = createVolatileWebAppStorage();
    await recordDataSharingConsent(storage, "managed_sync", NOW);

    await storage.clearAllLocalData();

    await expect(hasCurrentDataSharingConsent(storage, "managed_sync")).resolves.toBe(false);
  });

  it("drops malformed grants when normalizing a stored record", () => {
    expect(
      normalizeDataSharingConsentRecord({
        managed_sync: { revision: "r1", givenAt: "2026-11-25T08:00:00.000Z" },
        partner_share: { revision: "", givenAt: "2026-11-25T08:00:00.000Z" },
        self_hosted_sync: "yes",
        unknown_purpose: { revision: "r1", givenAt: "2026-11-25T08:00:00.000Z" },
      }),
    ).toEqual({
      managed_sync: { revision: "r1", givenAt: "2026-11-25T08:00:00.000Z" },
    });
  });

  it("maps the sync mode to its own consent purpose", () => {
    expect(resolveSyncConsentPurpose("managed")).toBe("managed_sync");
    expect(resolveSyncConsentPurpose("self_hosted")).toBe("self_hosted_sync");
    expect(resolveSyncModeConsentPurposes("self_hosted")).toEqual(["self_hosted_sync"]);
  });
});

describe("buildDataSharingConsentViewData", () => {
  it.each(SUPPORTED_INTERFACE_LANGUAGES)(
    "fills every field for each purpose in %s",
    (language) => {
      for (const purpose of DATA_SHARING_CONSENT_PURPOSES) {
        const view = buildDataSharingConsentViewData(purpose, language);
        const texts = [
          view.title,
          view.intro,
          view.leavesHeading,
          ...view.items,
          view.recipient,
          view.encryption,
          view.withdrawal,
          view.legalBasis,
          view.policyLinkLabel,
          view.policyUnavailable,
          view.agreeLabel,
          view.declineLabel,
        ];
        for (const text of texts) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
        expect(view.policyURL).toBe(PRIVACY_POLICY_URL);
        expect(view.legalBasis).toContain("9");
        expect(view.excluded === null).toBe(purpose !== "partner_share");
      }
    },
  );

  it("names what leaves the device for sync and for partner sharing in English", () => {
    const sync = buildDataSharingConsentViewData("managed_sync", "en");
    expect(sync.items.join(" ")).toMatch(/encrypted backup/);
    expect(sync.items.join(" ")).toMatch(/device's ID and the label/);
    expect(sync.items.join(" ")).toMatch(/encrypted under your recovery phrase/);
    expect(sync.encryption).toMatch(/end-to-end encrypted/);
    expect(sync.withdrawal).toMatch(/disconnecting sync or deleting your account/);

    const partner = buildDataSharingConsentViewData("partner_share", "en");
    expect(partner.items[0]).toMatch(/^Summary level/);
    expect(partner.items[1]).toMatch(/^Full level/);
    expect(partner.excluded).toMatch(
      /pregnancy, postpartum and screening data, weight, blood pressure and your crisis-support contact/,
    );
    expect(partner.withdrawal).toMatch(/revoking the partner or deleting your account/);
  });

  it("names a different recipient for managed and self-hosted sync", () => {
    const managed = buildDataSharingConsentViewData("managed_sync", "en");
    const selfHosted = buildDataSharingConsentViewData("self_hosted_sync", "en");
    expect(managed.title).not.toBe(selfHosted.title);
    expect(managed.recipient).toMatch(/Ovumcy Cloud/);
    expect(selfHosted.recipient).toMatch(/self-hosted server/);
  });
});
