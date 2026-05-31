import {
  celsiusDeltaToUnit,
  celsiusToUnit,
  formatTemperatureValue,
  unitToCelsius,
} from "./temperature-policy";

describe("temperature-policy", () => {
  it("returns Celsius unchanged for the Celsius unit", () => {
    expect(celsiusToUnit(36.5, "c")).toBe(36.5);
    expect(unitToCelsius(36.5, "c")).toBe(36.5);
  });

  it("converts between Celsius and Fahrenheit", () => {
    expect(celsiusToUnit(36.5, "f")).toBeCloseTo(97.7, 5);
    expect(unitToCelsius(97.7, "f")).toBeCloseTo(36.5, 5);
    expect(celsiusToUnit(0, "f")).toBe(32);
  });

  it("round-trips a Fahrenheit reading", () => {
    expect(unitToCelsius(celsiusToUnit(36.5, "f"), "f")).toBeCloseTo(36.5, 5);
  });

  it("scales a temperature difference without the 32° offset", () => {
    expect(celsiusDeltaToUnit(0.2, "c")).toBeCloseTo(0.2, 5);
    expect(celsiusDeltaToUnit(0.2, "f")).toBeCloseTo(0.36, 5);
  });

  it("formats the stored Celsius value in the display unit", () => {
    expect(formatTemperatureValue(36.5, "c")).toBe("36.50");
    expect(formatTemperatureValue(36.5, "f")).toBe("97.70");
    expect(formatTemperatureValue(0, "f")).toBe("");
    expect(formatTemperatureValue(-1, "c")).toBe("");
  });
});
