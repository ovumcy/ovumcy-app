export type DashboardShellSection = {
  title: string;
  bullets: string[];
};

export type DashboardShellViewData = {
  eyebrow: string;
  title: string;
  description: string;
  section: DashboardShellSection;
};

export function buildDashboardShellViewData(): DashboardShellViewData {
  return {
    eyebrow: "Today",
    title: "Dashboard shell",
    description:
      "This screen will become the local-first logging home for today, cycle context, and quick-entry actions.",
    section: {
      title: "Owner-first quick logging",
      bullets: [
        "cycle context card",
        "quick symptom entry",
        "advanced tracking shortcuts",
      ],
    },
  };
}
