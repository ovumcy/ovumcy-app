import type { TemperatureUnit } from "../models/profile";

export type { TemperatureUnit };

// BBT is stored canonically in Celsius. These helpers convert to/from the unit
// the user selected for display, so switching units only changes how the same
// stored value is presented and validation can stay strict on the canonical
// Celsius value.

export function celsiusToUnit(celsius: number, unit: TemperatureUnit): number {
  return unit === "f" ? (celsius * 9) / 5 + 32 : celsius;
}

export function unitToCelsius(value: number, unit: TemperatureUnit): number {
  return unit === "f" ? ((value - 32) * 5) / 9 : value;
}

// A temperature difference (e.g. a thermal shift) scales without the 32° offset.
export function celsiusDeltaToUnit(delta: number, unit: TemperatureUnit): number {
  return unit === "f" ? (delta * 9) / 5 : delta;
}

export function roundTemperature(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatTemperatureValue(
  celsius: number,
  unit: TemperatureUnit,
): string {
  if (!Number.isFinite(celsius) || celsius <= 0) {
    return "";
  }
  return celsiusToUnit(celsius, unit).toFixed(2);
}
