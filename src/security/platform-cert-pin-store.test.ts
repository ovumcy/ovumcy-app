import * as SecureStore from "expo-secure-store";

import { createPlatformCertPinStore as createNativeStore } from "./platform-cert-pin-store.native";
import { createPlatformCertPinStore as createWebStore } from "./platform-cert-pin-store.web";

const mockSecureStoreState = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "after-first-unlock-this-device-only",
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreState.delete(key);
  }),
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreState.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreState.set(key, value);
  }),
}));

const RECORD = {
  host: "sync.example.com",
  fingerprint: "A".repeat(43) + "=",
  pinnedAt: "2026-05-22T10:00:00.000Z",
};

describe.each([
  ["native", createNativeStore],
  ["web", createWebStore],
])("platform cert pin store (%s)", (_platform, createStore) => {
  beforeEach(() => {
    mockSecureStoreState.clear();
  });

  it("persists a pin and clears every pin", async () => {
    const store = createStore();

    await store.writePin(RECORD);
    await expect(store.readPin(RECORD.host)).resolves.toEqual(RECORD);

    await store.clearAll();
    await expect(store.readPin(RECORD.host)).resolves.toBeNull();
  });
});

it("writes native pins with this-device-only keychain access", async () => {
  await createNativeStore().writePin(RECORD);

  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "ovumcy.sync-cert-pins",
    expect.any(String),
    { keychainAccessible: "after-first-unlock-this-device-only" },
  );
});
