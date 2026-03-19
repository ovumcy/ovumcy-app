import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const shellCopyEn = {
  tabs: {
    dashboard: "Today",
    calendar: "Calendar",
    stats: "Insights",
    settings: "Settings",
  },
  loading: {
    appShellTitle: "Loading your local setup…",
    appShellDescription: "Preparing your local-first app shell.",
    dashboardTitle: "Loading dashboard",
    dashboardDescription: "Preparing your local cycle context.",
    calendarTitle: "Loading calendar",
    calendarDescription: "Preparing your local month view.",
    statsTitle: "Loading insights",
    statsDescription: "Preparing your local history summary.",
    settingsTitle: "Loading settings",
    settingsDescription: "Preparing your local cycle settings.",
  },
} as const;

type ShellCopy = WidenLiteral<typeof shellCopyEn>;

const shellCopyCatalog: Record<InterfaceLanguage, ShellCopy> = {
  en: shellCopyEn,
  ru: {
    tabs: {
      dashboard: "Сегодня",
      calendar: "Календарь",
      stats: "Инсайты",
      settings: "Настройки",
    },
    loading: {
      appShellTitle: "Загружаем локальную настройку…",
      appShellDescription: "Подготавливаем local-first оболочку приложения.",
      dashboardTitle: "Загружаем dashboard",
      dashboardDescription: "Подготавливаем локальный контекст цикла.",
      calendarTitle: "Загружаем календарь",
      calendarDescription: "Подготавливаем локальный вид месяца.",
      statsTitle: "Загружаем инсайты",
      statsDescription: "Подготавливаем сводку по локальной истории.",
      settingsTitle: "Загружаем настройки",
      settingsDescription: "Подготавливаем локальные настройки цикла.",
    },
  },
  es: {
    tabs: {
      dashboard: "Hoy",
      calendar: "Calendario",
      stats: "Insights",
      settings: "Ajustes",
    },
    loading: {
      appShellTitle: "Cargando tu configuración local…",
      appShellDescription: "Preparando la shell local-first de la app.",
      dashboardTitle: "Cargando dashboard",
      dashboardDescription: "Preparando tu contexto local del ciclo.",
      calendarTitle: "Cargando calendario",
      calendarDescription: "Preparando tu vista mensual local.",
      statsTitle: "Cargando insights",
      statsDescription: "Preparando el resumen de tu historial local.",
      settingsTitle: "Cargando ajustes",
      settingsDescription: "Preparando tus ajustes locales del ciclo.",
    },
  },
};

export function getShellCopy(language: string | null | undefined) {
  return shellCopyCatalog[resolveCopyLanguage(language)];
}
