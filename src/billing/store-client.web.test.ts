import { storeClient } from "./store-client.web";

describe("store client (web)", () => {
  it("rejects every call: the web build has no store", async () => {
    expect(storeClient.supported).toBe(false);
    await expect(storeClient.listPurchases()).rejects.toThrow(
      /^store_unavailable$/,
    );
    await expect(storeClient.loadProduct("pregnancy_module")).rejects.toThrow();
    await expect(storeClient.purchase("pregnancy_module")).rejects.toThrow();
    await expect(storeClient.acknowledge("pregnancy_module")).rejects.toThrow();
  });
});
