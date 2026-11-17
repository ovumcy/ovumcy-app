import {
  buildLocalDataAad,
  checkLocalDataKey,
  createLocalDataKeyHex,
  decryptLocalDataRecord,
  encryptLocalDataRecord,
} from "./local-data-crypto";
import { encryptPayload } from "./payload-crypto";

describe("local-data-crypto", () => {
  it("encrypts and decrypts local storage records with a generated key and matching AAD", () => {
    const keyHex = createLocalDataKeyHex();
    const aad = buildLocalDataAad("profile_settings", "1");
    const encrypted = encryptLocalDataRecord(
      keyHex,
      {
        cycleLength: 28,
        notes: "Sensitive local note",
      },
      aad,
    );

    expect(encrypted).not.toContain("Sensitive local note");
    expect(decryptLocalDataRecord(keyHex, encrypted, aad)).toEqual({
      cycleLength: 28,
      notes: "Sensitive local note",
    });
  });

  it("rejects decryption with the wrong key", () => {
    const aad = buildLocalDataAad("profile_settings", "1");
    const encrypted = encryptLocalDataRecord(
      createLocalDataKeyHex(),
      { notes: "Sensitive local note" },
      aad,
    );

    expect(() =>
      decryptLocalDataRecord(createLocalDataKeyHex(), encrypted, aad),
    ).toThrow();
  });

  it("rejects decryption when the AAD context does not match the one used to encrypt", () => {
    const keyHex = createLocalDataKeyHex();
    const encrypted = encryptLocalDataRecord(
      keyHex,
      { notes: "row A data" },
      buildLocalDataAad("day_log", "row-a-lookup-key"),
    );

    // Same key, but trying to read the blob as a different row / table.
    expect(() =>
      decryptLocalDataRecord(
        keyHex,
        encrypted,
        buildLocalDataAad("day_log", "row-b-lookup-key"),
      ),
    ).toThrow();
    expect(() =>
      decryptLocalDataRecord(
        keyHex,
        encrypted,
        buildLocalDataAad("symptom", "row-a-lookup-key"),
      ),
    ).toThrow();
  });

  it("rejects decryption when AAD version label is altered", () => {
    const keyHex = createLocalDataKeyHex();
    const encrypted = encryptLocalDataRecord(
      keyHex,
      { v: 1 },
      buildLocalDataAad("bootstrap_state", "1"),
    );

    const manuallyAlteredAad = new TextEncoder().encode(
      `ovumcy-local-v2|bootstrap_state|1`,
    );
    expect(() =>
      decryptLocalDataRecord(keyHex, encrypted, manuallyAlteredAad),
    ).toThrow();
  });
});

describe("checkLocalDataKey", () => {
  const aad = buildLocalDataAad("bootstrap_state", "1");
  const rightKey = "a".repeat(64);
  const encrypted = encryptLocalDataRecord(rightKey, { ok: true }, aad);

  it("authenticates a well-formed envelope under the key that wrote it", () => {
    expect(checkLocalDataKey(rightKey, encrypted, aad)).toBe("authenticated");
  });

  it("reports a mismatch only for an AEAD failure on a well-formed envelope", () => {
    expect(checkLocalDataKey("b".repeat(64), encrypted, aad)).toBe("mismatch");
    expect(
      checkLocalDataKey(rightKey, encrypted, buildLocalDataAad("bootstrap_state", "2")),
    ).toBe("mismatch");
  });

  it("reports a stored key that cannot be a 32-byte hex key as a mismatch", () => {
    expect(checkLocalDataKey("not-a-key", encrypted, aad)).toBe("mismatch");
    expect(checkLocalDataKey("a".repeat(62), encrypted, aad)).toBe("mismatch");
  });

  it.each([
    ["non-JSON text", "not json"],
    ["a JSON scalar", "42"],
    ["JSON null", "null"],
    ["an unknown algorithm", JSON.stringify({ ...JSON.parse(encrypted), algorithm: "aes" })],
    ["a short nonce", JSON.stringify({ ...JSON.parse(encrypted), nonceHex: "00" })],
    ["non-hex ciphertext", JSON.stringify({ ...JSON.parse(encrypted), ciphertextHex: "zz".repeat(20) })],
    ["ciphertext shorter than the tag", JSON.stringify({ ...JSON.parse(encrypted), ciphertextHex: "00".repeat(15) })],
  ])("classifies %s as malformed, never as a mismatch", (_label, rawValue) => {
    expect(checkLocalDataKey(rightKey, rawValue, aad)).toBe("malformed");
  });

  it("does not parse the plaintext once the tag authenticates", () => {
    const nonJsonPlaintext = JSON.stringify({
      ...JSON.parse(encrypted),
      ...encryptPayload(rightKey, new TextEncoder().encode("not json"), aad),
    });
    expect(checkLocalDataKey(rightKey, nonJsonPlaintext, aad)).toBe("authenticated");
  });
});
