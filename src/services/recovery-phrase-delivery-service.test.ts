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
        "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu\n",
    });
  });

  it("does not include any app-name or 'recovery phrase' label in the body", async () => {
    const deliveryClient = {
      deliver: jest.fn().mockResolvedValue({ ok: true }),
    };

    await deliverRecoveryPhraseArtifact(
      deliveryClient,
      "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu",
      new Date(2026, 2, 26),
    );

    const call = deliveryClient.deliver.mock.calls[0][0];
    expect(call.content).not.toMatch(/recovery/i);
    expect(call.content).not.toMatch(/ovumcy/i);
    expect(call.content).not.toMatch(/phrase/i);
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
