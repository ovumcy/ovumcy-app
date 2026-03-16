export type SettingsShellCard = {
  title: string;
  description: string;
  bullets?: string[];
};

export type SettingsShellViewData = {
  eyebrow: string;
  title: string;
  description: string;
  cards: SettingsShellCard[];
};

export function buildSettingsShellViewData(): SettingsShellViewData {
  return {
    eyebrow: "Preferences",
    title: "Settings shell",
    description:
      "This screen will manage local tracking preferences, custom symptoms, exports, and later optional sync setup.",
    cards: [
      {
        title: "Tracking toggles",
        description:
          "Settings will explain how advanced tracking fields affect new entries without hiding what remains in local history.",
      },
      {
        title: "Optional sync later",
        description:
          "Self-hosted or managed sync should appear here as an additive capability, not as a requirement for core use.",
        bullets: ["local profile", "custom symptoms", "export and backup"],
      },
    ],
  };
}
