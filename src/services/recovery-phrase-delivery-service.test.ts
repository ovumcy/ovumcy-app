import { deliverRecoveryPhraseArtifact } from "./recovery-phrase-delivery-service";

describe("recovery-phrase-delivery-service", () => {
  it("uses a generic filename and trims the exported phrase", async () => {
    const deliveryClient = {
      deliver: jest.fn().mockResolvedValue({ ok: true }),
    };

    const result = await deliverRecoveryPhraseArtifact(
      deliveryClient,
      "  alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu  ",
      new Date(2026, 2, 26),
    );

    expect(result).toEqual({ ok: true });
    expect(deliveryClient.deliver).toHaveBeenCalledWith({
      filename: "ovumcy-private-export-2026-03-26.txt",
      mimeType: "text/plain",
      content:
        "Ovumcy recovery phrase\n\nalpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu\n",
    });
  });

  it("rejects empty recovery phrase exports before delivery", async () => {
    const deliveryClient = {
      deliver: jest.fn(),
    };

    await expect(
      deliverRecoveryPhraseArtifact(
        deliveryClient,
        "   ",
        new Date(2026, 2, 26),
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "delivery_failed",
    });

    expect(deliveryClient.deliver).not.toHaveBeenCalled();
  });
});
