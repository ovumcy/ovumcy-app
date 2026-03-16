export type CycleMode = "regular" | "irregular" | "unpredictable";

export type TrackingPreference = {
  hideSex: boolean;
  trackBBT: boolean;
  trackCervicalMucus: boolean;
};

export type CycleProfile = {
  cycleLength: number;
  periodLength: number;
  mode: CycleMode;
  tracking: TrackingPreference;
};
