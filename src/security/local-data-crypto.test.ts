import {
  createLocalDataKeyHex,
  decryptLocalDataRecord,
  encryptLocalDataRecord,
} from "./local-data-crypto";

describe("local-data-crypto", () => {
  it("encrypts and decrypts local storage records with a generated key", () => {
    const keyHex = createLocalDataKeyHex();
    const encrypted = encryptLocalDataRecord(keyHex, {
      cycleLength: 28,
      notes: "Sensitive local note",
    });

    expect(encrypted).not.toContain("Sensitive local note");
    expect(decryptLocalDataRecord(keyHex, encrypted)).toEqual({
      cycleLength: 28,
      notes: "Sensitive local note",
    });
  });

  it("rejects decryption with the wrong key", () => {
    const encrypted = encryptLocalDataRecord(createLocalDataKeyHex(), {
      notes: "Sensitive local note",
    });

    expect(() =>
      decryptLocalDataRecord(createLocalDataKeyHex(), encrypted),
    ).toThrow();
  });
});
