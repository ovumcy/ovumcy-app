import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  clearAllLocalSettingsData,
  CLEAR_LOCAL_DATA_CONFIRMATION,
  isClearLocalDataConfirmationValid,
} from "./settings-danger-zone-service";

describe("settings-danger-zone-service", () => {
  it("validates the destructive confirmation phrase strictly", () => {
    expect(isClearLocalDataConfirmationValid(CLEAR_LOCAL_DATA_CONFIRMATION)).toBe(
      true,
    );
    expect(isClearLocalDataConfirmationValid(" clear ")).toBe(true);
    expect(isClearLocalDataConfirmationValid("CLEAR ALL")).toBe(false);
    expect(isClearLocalDataConfirmationValid("")).toBe(false);
  });

  it("clears all local app data through the canonical storage boundary", async () => {
    const storage = createLocalAppStorageMock();

    await expect(clearAllLocalSettingsData(storage)).resolves.toEqual({
      ok: true,
    });
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
  });

  it("returns a stable error code when the storage reset fails", async () => {
    const storage = createLocalAppStorageMock({
      clearAllLocalData: jest.fn().mockRejectedValue(new Error("boom")),
    });

    await expect(clearAllLocalSettingsData(storage)).resolves.toEqual({
      ok: false,
      errorCode: "generic",
    });
  });
});
