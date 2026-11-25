import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { loadHasPregnancyModuleData } from "./settings-state-service";
import { buildSettingsPregnancyManageRow } from "./settings-view-service";

describe("loadHasPregnancyModuleData", () => {
  it("is false when no pregnancy, postpartum or check-in data is saved", async () => {
    await expect(loadHasPregnancyModuleData(createLocalAppStorageMock())).resolves.toBe(false);
  });

  it.each([
    ["listPregnancyRecords"],
    ["listPostpartumRecords"],
    ["listScreeningResponses"],
  ] as const)("is true when %s returns a record", async (method) => {
    const storage = createLocalAppStorageMock({
      [method]: jest.fn().mockResolvedValue([{ id: "record-1" }]),
    });

    await expect(loadHasPregnancyModuleData(storage)).resolves.toBe(true);
  });

  it("hides the row when a read fails", async () => {
    const storage = createLocalAppStorageMock({
      listPostpartumRecords: jest.fn().mockRejectedValue(new Error("read failed")),
    });

    await expect(loadHasPregnancyModuleData(storage)).resolves.toBe(false);
  });
});

describe("buildSettingsPregnancyManageRow", () => {
  it("titles the row for pregnancy and postpartum data", () => {
    expect(buildSettingsPregnancyManageRow("en")).toEqual({
      title: "Pregnancy and postpartum",
      description: "Manage or delete saved pregnancy, postpartum and check-in data.",
    });
  });
});
