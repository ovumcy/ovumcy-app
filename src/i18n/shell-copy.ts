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
    appShellTitle: "Ihre lokale Einrichtung wird geladen…",
    appShellDescription: "Die lokale App-Umgebung wird vorbereitet.",
    dashboardTitle: "Dashboard wird geladen",
    dashboardDescription: "Ihr lokaler Zykluskontext wird vorbereitet.",
    calendarTitle: "Kalender wird geladen",
    calendarDescription: "Ihre lokale Monatsansicht wird vorbereitet.",
    statsTitle: "Einblicke werden geladen",
    statsDescription: "Ihre lokale Verlaufsübersicht wird vorbereitet.",
    settingsTitle: "Einstellungen werden geladen",
    settingsDescription: "Ihre lokalen Zykluseinstellungen werden vorbereitet.",
    backupSyncTitle: "Backup & Sync wird geladen",
    backupSyncDescription: "Ihre geschützten Backup-Steuerungen werden vorbereitet.",
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
    appShellTitle: "Chargement de votre configuration locale…",
    appShellDescription: "Préparation de l'environnement local de l'app.",
    dashboardTitle: "Chargement du tableau de bord",
    dashboardDescription: "Préparation de votre contexte local de cycle.",
    calendarTitle: "Chargement du calendrier",
    calendarDescription: "Préparation de votre vue mensuelle locale.",
    statsTitle: "Chargement des analyses",
    statsDescription: "Préparation du résumé de votre historique local.",
    settingsTitle: "Chargement des réglages",
    settingsDescription: "Préparation de vos réglages locaux du cycle.",
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
      stats: "Аналитика",
      settings: "Настройки",
    },
    loading: {
      appShellTitle: "Загружаем локальную настройку…",
      appShellDescription: "Подготавливаем local-first оболочку приложения.",
      dashboardTitle: "Загружаем панель",
      dashboardDescription: "Подготавливаем локальный контекст цикла.",
      calendarTitle: "Загружаем календарь",
      calendarDescription: "Подготавливаем локальный вид месяца.",
      statsTitle: "Загружаем аналитику",
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
      dashboardTitle: "Cargando panel",
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
  it: {
    tabs: {
      dashboard: "Oggi",
      calendar: "Calendario",
      stats: "Statistiche",
      settings: "Impostazioni",
    },
    loading: {
      appShellTitle: "Caricamento della tua configurazione locale…",
      appShellDescription: "Preparazione della shell local-first dell'app.",
      dashboardTitle: "Caricamento del cruscotto",
      dashboardDescription: "Preparazione del tuo contesto locale del ciclo.",
      calendarTitle: "Caricamento del calendario",
      calendarDescription: "Preparazione della tua vista mensile locale.",
      statsTitle: "Caricamento delle statistiche",
      statsDescription: "Preparazione del riepilogo della tua cronologia locale.",
      settingsTitle: "Caricamento delle impostazioni",
      settingsDescription: "Preparazione delle tue impostazioni locali del ciclo.",
      backupSyncTitle: "Caricamento di backup e sync",
      backupSyncDescription: "Preparazione dei controlli del tuo backup protetto.",
    },
  },
};

export function getShellCopy(language: string | null | undefined) {
  return shellCopyCatalog[resolveCopyLanguage(language)];
}
