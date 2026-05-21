import {
  buildLocalDataAad,
  createLocalDataKeyHex,
  decryptLocalDataRecord,
  encryptLocalDataRecord,
} from "./local-data-crypto";

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
