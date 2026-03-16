export type CalendarShellViewData = {
  eyebrow: string;
  title: string;
  description: string;
  cardTitle: string;
  cardDescription: string;
  bullets: string[];
};

export function buildCalendarShellViewData(): CalendarShellViewData {
  return {
    eyebrow: "History",
    title: "Calendar shell",
    description:
      "This screen will hold day-by-day tracking, period markers, and future prediction presentation driven by local data.",
    cardTitle: "Navigation first",
    cardDescription:
      "The calendar shell exists now so service and storage work can target a stable navigation surface.",
    bullets: ["month grid", "selected day summary", "prediction badges"],
  };
}
