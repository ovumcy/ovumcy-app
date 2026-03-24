describe("sync-contract env resolution", () => {
  const originalSyncBaseURL = process.env.EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL;
  const originalManagedBaseURL = process.env.EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL = originalSyncBaseURL;
    process.env.EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL = originalManagedBaseURL;
    jest.resetModules();
  });

  it("uses EXPO_PUBLIC managed and sync base URLs when they are provided", () => {
    process.env.EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL = "http://127.0.0.1:8080";
    process.env.EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL = "http://127.0.0.1:8090";

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const contract = require("./sync-contract");

    expect(contract.MANAGED_SYNC_BASE_URL).toBe("http://127.0.0.1:8080");
    expect(contract.MANAGED_CLOUD_AUTH_BASE_URL).toBe("http://127.0.0.1:8090");
  });

  it("falls back to the hosted cloud defaults when no public env is set", () => {
    delete process.env.EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL;
    delete process.env.EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL;

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const contract = require("./sync-contract");

    expect(contract.MANAGED_SYNC_BASE_URL).toBe("https://sync.ovumcy.cloud");
    expect(contract.MANAGED_CLOUD_AUTH_BASE_URL).toBe(
      "https://managed.ovumcy.cloud",
    );
  });
});
