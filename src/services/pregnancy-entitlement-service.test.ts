import {
  createDevFlagPregnancyEntitlementSource,
  loadPregnancyModuleOwned,
  type PregnancyEntitlementSource,
} from "./pregnancy-entitlement-service";

const FLAG_ENV_KEY = "EXPO_PUBLIC_PREGNANCY_MODULE_DEV_UNLOCK";

describe("loadPregnancyModuleOwned", () => {
  const savedFlag = process.env[FLAG_ENV_KEY];

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env[FLAG_ENV_KEY];
    } else {
      process.env[FLAG_ENV_KEY] = savedFlag;
    }
  });

  it("returns true only when the source answers true", async () => {
    const owned: PregnancyEntitlementSource = {
      loadOwnsPregnancyModule: async () => true,
    };
    const notOwned: PregnancyEntitlementSource = {
      loadOwnsPregnancyModule: async () => false,
    };

    await expect(loadPregnancyModuleOwned(owned)).resolves.toBe(true);
    await expect(loadPregnancyModuleOwned(notOwned)).resolves.toBe(false);
  });

  it("fails closed when the source throws", async () => {
    const broken: PregnancyEntitlementSource = {
      loadOwnsPregnancyModule: async () => {
        throw new Error("store unavailable");
      },
    };

    await expect(loadPregnancyModuleOwned(broken)).resolves.toBe(false);
  });

  it("treats a non-boolean truthy answer as not owned", async () => {
    const garbage: PregnancyEntitlementSource = {
      loadOwnsPregnancyModule: async () => 1 as unknown as boolean,
    };

    await expect(loadPregnancyModuleOwned(garbage)).resolves.toBe(false);
  });

  it("defaults to the dev-flag source: unset flag means not owned even in dev", async () => {
    delete process.env[FLAG_ENV_KEY];

    await expect(loadPregnancyModuleOwned()).resolves.toBe(false);
  });

  it("defaults to the dev-flag source: a set flag unlocks a dev build", async () => {
    // Jest runs with __DEV__ === true, so the default source is on its
    // development path here; the release path is pinned separately below.
    process.env[FLAG_ENV_KEY] = "1";

    await expect(loadPregnancyModuleOwned()).resolves.toBe(true);
  });
});

describe("createDevFlagPregnancyEntitlementSource", () => {
  it("never unlocks a release build, whatever the flag says", async () => {
    const source = createDevFlagPregnancyEntitlementSource({
      isDevelopment: false,
      flagValue: "1",
    });

    await expect(source.loadOwnsPregnancyModule()).resolves.toBe(false);
  });

  it("honors '1' and 'true' in a development build and rejects everything else", async () => {
    const unlocked = ["1", "true"];
    for (const flagValue of unlocked) {
      const source = createDevFlagPregnancyEntitlementSource({
        isDevelopment: true,
        flagValue,
      });
      await expect(source.loadOwnsPregnancyModule()).resolves.toBe(true);
    }

    const locked = ["0", "yes", "TRUE", "", undefined];
    for (const flagValue of locked) {
      const source = createDevFlagPregnancyEntitlementSource({
        isDevelopment: true,
        flagValue,
      });
      await expect(source.loadOwnsPregnancyModule()).resolves.toBe(false);
    }
  });

  it("defaults isDevelopment to __DEV__ when not injected", async () => {
    // Jest runs with __DEV__ === true, so an explicit flag value resolves on
    // the development path without injecting isDevelopment.
    const source = createDevFlagPregnancyEntitlementSource({ flagValue: "1" });

    await expect(source.loadOwnsPregnancyModule()).resolves.toBe(true);
  });
});
