import { normalizeManagedAccountId } from "./managed-account-id";

describe("normalizeManagedAccountId", () => {
  it("accepts the grouped display form", () => {
    expect(normalizeManagedAccountId("a3f9-0c12-77be-4d01")).toBe(
      "a3f90c1277be4d01",
    );
  });

  it("accepts the bare 16-hex form", () => {
    expect(normalizeManagedAccountId("a3f90c1277be4d01")).toBe(
      "a3f90c1277be4d01",
    );
  });

  it("lowercases uppercase input", () => {
    expect(normalizeManagedAccountId("A3F9-0C12-77BE-4D01")).toBe(
      "a3f90c1277be4d01",
    );
  });

  it("strips surrounding and inner whitespace", () => {
    expect(normalizeManagedAccountId("  a3f9 0c12\t77be-4d01\n")).toBe(
      "a3f90c1277be4d01",
    );
  });

  it("strips typographic dashes from smart punctuation and pasted text", () => {
    expect(normalizeManagedAccountId("a3f9‑0c12–77be−4d01")).toBe(
      "a3f90c1277be4d01",
    );
  });

  it("rejects a wrong length", () => {
    expect(normalizeManagedAccountId("a3f9-0c12-77be-4d0")).toBeNull();
    expect(normalizeManagedAccountId("a3f9-0c12-77be-4d012")).toBeNull();
    expect(normalizeManagedAccountId("")).toBeNull();
  });

  it("rejects non-hex characters", () => {
    expect(normalizeManagedAccountId("g3f9-0c12-77be-4d01")).toBeNull();
    expect(normalizeManagedAccountId("owner@example.com")).toBeNull();
  });
});
