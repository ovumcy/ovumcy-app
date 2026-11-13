import { ruCycleWord, ruDayWord, ruDayWordGenitive, ruPlural } from "./ru-plural";

describe("ruPlural / ruCycleWord", () => {
  it.each([
    [1, "цикл"],
    [2, "цикла"],
    [4, "цикла"],
    [5, "циклов"],
    [11, "циклов"],
    [12, "циклов"],
    [21, "цикл"],
    [22, "цикла"],
    [111, "циклов"],
  ])("ruCycleWord(%i) is %s", (count, word) => {
    expect(ruCycleWord(count)).toBe(word);
  });

  it("matches the former hand-rolled participle phrase for every count 0..300", () => {
    const former = (count: number): string => {
      const mod100 = count % 100;
      const mod10 = count % 10;
      if (mod10 === 1 && mod100 !== 11) return `${count} записанный день`;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return `${count} записанных дня`;
      }
      return `${count} записанных дней`;
    };
    for (let count = 0; count <= 300; count += 1) {
      expect(
        `${count} ${ruPlural(count, "записанный день", "записанных дня", "записанных дней")}`,
      ).toBe(former(count));
    }
  });
});

describe("ruDayWord", () => {
  it("returns день for 1 (one-form)", () => {
    expect(ruDayWord(1)).toBe("день");
  });

  it("returns дня for 2 (few-form)", () => {
    expect(ruDayWord(2)).toBe("дня");
  });

  it("returns дня for 3 (few-form)", () => {
    expect(ruDayWord(3)).toBe("дня");
  });

  it("returns дня for 4 (few-form)", () => {
    expect(ruDayWord(4)).toBe("дня");
  });

  it("returns дней for 5 (many-form)", () => {
    expect(ruDayWord(5)).toBe("дней");
  });

  it("returns дней for 11 (many-form, tens exception)", () => {
    expect(ruDayWord(11)).toBe("дней");
  });

  it("returns дней for 12 (many-form, tens exception)", () => {
    expect(ruDayWord(12)).toBe("дней");
  });

  it("returns дней for 14 (many-form, tens exception)", () => {
    expect(ruDayWord(14)).toBe("дней");
  });

  it("returns день for 21 (one-form)", () => {
    expect(ruDayWord(21)).toBe("день");
  });

  it("returns дня for 22 (few-form)", () => {
    expect(ruDayWord(22)).toBe("дня");
  });

  it("returns дней for 25 (many-form)", () => {
    expect(ruDayWord(25)).toBe("дней");
  });

  it("returns день for 31 (one-form)", () => {
    expect(ruDayWord(31)).toBe("день");
  });

  it("returns дней for 100 (many-form)", () => {
    expect(ruDayWord(100)).toBe("дней");
  });

  it("returns день for 101 (one-form)", () => {
    expect(ruDayWord(101)).toBe("день");
  });

  it("returns дня for 102 (few-form)", () => {
    expect(ruDayWord(102)).toBe("дня");
  });

  it("returns дней for 111 (many-form, tens exception)", () => {
    expect(ruDayWord(111)).toBe("дней");
  });
});

describe("ruDayWordGenitive (used after «до» / «от»)", () => {
  it("returns дня for 21 (one-form → дня under до)", () => {
    expect(ruDayWordGenitive(21)).toBe("дня");
  });

  it("returns дней for 24 (few-form → дней under до)", () => {
    expect(ruDayWordGenitive(24)).toBe("дней");
  });

  it("returns дней for 25 (many-form → дней under до)", () => {
    expect(ruDayWordGenitive(25)).toBe("дней");
  });

  it("returns дня for 31 (one-form → дня under до)", () => {
    expect(ruDayWordGenitive(31)).toBe("дня");
  });

  it("returns дней for 28 (many-form)", () => {
    expect(ruDayWordGenitive(28)).toBe("дней");
  });

  it("returns дня for 1 (one-form)", () => {
    expect(ruDayWordGenitive(1)).toBe("дня");
  });

  it("returns дней for 11 (tens exception)", () => {
    expect(ruDayWordGenitive(11)).toBe("дней");
  });
});
