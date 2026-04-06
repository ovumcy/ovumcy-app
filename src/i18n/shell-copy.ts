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
    backupSyncTitle: "Loading backup & sync",
    backupSyncDescription: "Preparing your protected backup controls.",
  },
} as const;

type ShellCopy = WidenLiteral<typeof shellCopyEn>;

const shellCopyDe: ShellCopy = {
  tabs: {
    dashboard: "Heute",
    calendar: "Kalender",
    stats: "Einblicke",
    settings: "Einstellungen",
  },
  loading: {
    appShellTitle: "Deine lokale Einrichtung wird geladen…",
    appShellDescription: "Die lokale App-Umgebung wird vorbereitet.",
    dashboardTitle: "Dashboard wird geladen",
    dashboardDescription: "Dein lokaler Zykluskontext wird vorbereitet.",
    calendarTitle: "Kalender wird geladen",
    calendarDescription: "Deine lokale Monatsansicht wird vorbereitet.",
    statsTitle: "Einblicke werden geladen",
    statsDescription: "Deine lokale Verlaufsübersicht wird vorbereitet.",
    settingsTitle: "Einstellungen werden geladen",
    settingsDescription: "Deine lokalen Zykluseinstellungen werden vorbereitet.",
    backupSyncTitle: "Backup & Sync wird geladen",
    backupSyncDescription: "Deine geschützten Backup-Steuerungen werden vorbereitet.",
  },
};

const shellCopyFr: ShellCopy = {
  tabs: {
    dashboard: "Aujourd'hui",
    calendar: "Calendrier",
    stats: "Analyses",
    settings: "Réglages",
  },
  loading: {
    appShellTitle: "Chargement de ta configuration locale…",
    appShellDescription: "Préparation de l'environnement local de l'app.",
    dashboardTitle: "Chargement du dashboard",
    dashboardDescription: "Préparation de ton contexte local de cycle.",
    calendarTitle: "Chargement du calendrier",
    calendarDescription: "Préparation de ta vue mensuelle locale.",
    statsTitle: "Chargement des analyses",
    statsDescription: "Préparation du résumé de ton historique local.",
    settingsTitle: "Chargement des réglages",
    settingsDescription: "Préparation de tes réglages locaux du cycle.",
    backupSyncTitle: "Chargement de la sauvegarde et du sync",
    backupSyncDescription: "Préparation des contrôles de sauvegarde protégée.",
  },
};

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
      backupSyncTitle: "Загружаем резервную копию и sync",
      backupSyncDescription: "Подготавливаем экран защищённой копии и sync.",
    },
  },
  es: {
    tabs: {
      dashboard: "Hoy",
      calendar: "Calendario",
      stats: "Análisis",
      settings: "Ajustes",
    },
    loading: {
      appShellTitle: "Cargando tu configuración local…",
      appShellDescription: "Preparando la shell local-first de la app.",
      dashboardTitle: "Cargando dashboard",
      dashboardDescription: "Preparando tu contexto local del ciclo.",
      calendarTitle: "Cargando calendario",
      calendarDescription: "Preparando tu vista mensual local.",
      statsTitle: "Cargando análisis",
      statsDescription: "Preparando el resumen de tu historial local.",
      settingsTitle: "Cargando ajustes",
      settingsDescription: "Preparando tus ajustes locales del ciclo.",
      backupSyncTitle: "Cargando copia y sync",
      backupSyncDescription: "Preparando los controles de tu copia protegida.",
    },
  },
  de: shellCopyDe,
  fr: shellCopyFr,
};

export function getShellCopy(language: string | null | undefined) {
  return shellCopyCatalog[resolveCopyLanguage(language)];
}
