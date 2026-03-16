import { appInfo } from "../i18n/app-copy";

export type OnboardingShellViewData = {
  eyebrow: string;
  title: string;
  description: string;
  cards: {
    title: string;
    description: string;
  }[];
  note: string;
  continueLabel: string;
};

export function buildOnboardingShellViewData(): OnboardingShellViewData {
  return {
    eyebrow: "Start here",
    title: "A private cycle tracker that starts on your phone.",
    description: `${appInfo.name} begins as a local-first app. Core tracking works before sync, before accounts, and before any cloud setup.`,
    cards: [
      {
        title: "Local-first by default",
        description:
          "Cycle logs, predictions, and settings are designed to work on-device before optional sync exists.",
      },
      {
        title: "One product, several clients",
        description:
          "This repo targets iOS and Android first, while keeping a future web client and optional sync contract in mind.",
      },
    ],
    note:
      "Bootstrap milestone: establish architecture, quality gates, and screen shells before moving real cycle logic into shared service and model modules.",
    continueLabel: "Continue to app shell",
  };
}
