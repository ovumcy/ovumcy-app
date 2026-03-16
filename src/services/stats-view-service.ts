export type StatsShellViewData = {
  eyebrow: string;
  title: string;
  description: string;
  cardTitle: string;
  cardDescription: string;
  bullets: string[];
};

export function buildStatsShellViewData(): StatsShellViewData {
  return {
    eyebrow: "Insights",
    title: "Stats shell",
    description:
      "This screen will host reliability messaging, cycle summaries, and factor context built from local history.",
    cardTitle: "Conservative by design",
    cardDescription:
      "Stats and predictions will stay honest with sparse data and keep medical claims out of the product.",
    bullets: [
      "reliability summary",
      "cycle overview cards",
      "factor explanation blocks",
    ],
  };
}
