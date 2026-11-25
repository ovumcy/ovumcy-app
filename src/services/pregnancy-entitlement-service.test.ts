import {
  createDefaultPregnancyEntitlementSource,
  createDevFlagPregnancyEntitlementSource,
  loadPregnancyModuleOwned,
  type PregnancyEntitlementSource,
} from "./pregnancy-entitlement-service";

describe("loadPregnancyModuleOwned", () => {
  const savedFlag = process.env.EXPO_PUBLIC_PREGNANCY_MODULE_DEV_UNLOCK;

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env.EXPO_PUBLIC_PREGNANCY_MODULE_DEV_UNLOCK;
    } else {
      process.env.EXPO_PUBLIC_PREGNANCY_MODULE_DEV_UNLOCK = savedFlag;
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

  it("defaults to the store source: no store purchase and no flag means not owned", async () => {
    // Jest has no store, so the default store source rejects and the resolver
    // fails closed.
    delete process.env.EXPO_PUBLIC_PREGNANCY_MODULE_DEV_UNLOCK;

    await expect(loadPregnancyModuleOwned()).resolves.toBe(false);
  });

  it("keeps the development flag as an override on top of the default source", async () => {
    // Jest runs with __DEV__ === true, so the default source is on its
    // development path here; the release path is pinned separately below.
    process.env.EXPO_PUBLIC_PREGNANCY_MODULE_DEV_UNLOCK = "1";

    await expect(loadPregnancyModuleOwned()).resolves.toBe(true);
  });
});

describe("createDefaultPregnancyEntitlementSource", () => {
  const owned: PregnancyEntitlementSource = {
    loadOwnsPregnancyModule: async () => true,
  };
  const notOwned: PregnancyEntitlementSource = {
    loadOwnsPregnancyModule: async () => false,
  };
  const broken: PregnancyEntitlementSource = {
    loadOwnsPregnancyModule: async () => {
      throw new Error("unavailable");
    },
  };
  const releaseFlag = createDevFlagPregnancyEntitlementSource({
    isDevelopment: false,
    flagValue: "1",
  });

  it("owns the module from the store purchase alone in a release build", async () => {
    const source = createDefaultPregnancyEntitlementSource({
      devFlagSource: releaseFlag,
      storeSource: owned,
    });

    await expect(loadPregnancyModuleOwned(source)).resolves.toBe(true);
  });

  it("ignores the development flag in a release build: without a store purchase the module is not owned", async () => {
    for (const storeSource of [notOwned, broken]) {
      const source = createDefaultPregnancyEntitlementSource({
        devFlagSource: releaseFlag,
        storeSource,
      });

      await expect(loadPregnancyModuleOwned(source)).resolves.toBe(false);
    }
  });

  it("lets the development flag add ownership without asking the store", async () => {
    const storeSource = { loadOwnsPregnancyModule: jest.fn(async () => false) };
    const source = createDefaultPregnancyEntitlementSource({
      devFlagSource: createDevFlagPregnancyEntitlementSource({
        isDevelopment: true,
        flagValue: "1",
      }),
      storeSource,
    });

    await expect(loadPregnancyModuleOwned(source)).resolves.toBe(true);
    expect(storeSource.loadOwnsPregnancyModule).not.toHaveBeenCalled();
  });

  it("never lets a failing or truthy-but-not-true flag hide or fake a store answer", async () => {
    const truthy = {
      loadOwnsPregnancyModule: async () => 1 as unknown as boolean,
    };

    await expect(
      loadPregnancyModuleOwned(
        createDefaultPregnancyEntitlementSource({
          devFlagSource: broken,
          storeSource: owned,
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      loadPregnancyModuleOwned(
        createDefaultPregnancyEntitlementSource({
          devFlagSource: truthy,
          storeSource: notOwned,
        }),
      ),
    ).resolves.toBe(false);
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
      // Spread keeps exactOptionalPropertyTypes happy: an unset flag is an
      // absent property, not an explicit undefined (same resolution either
      // way through the ?? chain).
      const source = createDevFlagPregnancyEntitlementSource({
        isDevelopment: true,
        ...(flagValue === undefined ? {} : { flagValue }),
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
