import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const settingsCopyEn = {
  title: "Settings",
  subtitle:
    "Manage cycle parameters, tracking fields, export actions, and local profile behavior.",
  common: {
    cancelAction: "Cancel",
    confirmAction: "Confirm",
    saveChanges: "Save changes",
    daysShort: "d",
    changeDate: "Choose date",
    clearDate: "Clear date",
    notSet: "Not set",
    saving: "Saving...",
  },
  cycle: {
    title: "Cycle Parameters",
    cycleLength: "Typical cycle length",
    periodLength: "Period duration",
    lastPeriodStart: "Last period start date",
    lastPeriodStartHint:
      "Optional fallback if your journal does not have a marked cycle start yet.",
    errorIncompatible:
      "Period duration is incompatible with cycle length. Menstruation cannot take up almost the whole cycle.",
    warningApproximate:
      "With these values, ovulation cannot be calculated reliably. Prediction will be approximate.",
    infoAdjusted:
      "Period length was adjusted automatically so at least 10 days remain before the next cycle.",
    infoPeriodLong:
      "A duration above 8 days may indicate cycle irregularities; please discuss with a doctor.",
    infoCycleLong:
      "A cycle longer than 45 days is less common; please discuss with a doctor.",
    infoCycleShort:
      "A cycle shorter than 21 days is less common; please discuss with a doctor.",
    autoPeriodFill: "Auto-fill period days",
    autoPeriodFillHint:
      "When enabled, marking the first day auto-fills the next days based on your period length.",
    predictionModeLabel: "Prediction mode",
    predictionModeHint: "Choose how Ovumcy should show date predictions.",
    predictionModeRegular: "Regular",
    predictionModeRegularHint:
      "Show the standard prediction view from your cycle settings and recorded history.",
    predictionModeIrregular: "Irregular",
    predictionModeIrregularHint:
      "Keep predictions visible, but read them as approximate guidance.",
    predictionModeFactsOnly: "Facts only",
    predictionModeFactsOnlyHint:
      "Turn date predictions off and show only recorded facts and saved markers.",
    save: "Save Changes",
  },
  ageGroup: {
    title: "Age group",
    hint: "Optional. Stored with your profile; predictions use only your own cycle history.",
    under40: "Under 40",
    age40to45: "40-45",
    age45plus: "45+",
  },
  goal: {
    title: "Usage goal",
    hint: "Optional. This changes how fertile days are framed in the UI. It does not change the algorithm.",
    avoid: "Avoid pregnancy",
    trying: "Trying to conceive",
    health: "Track my health",
  },
  tracking: {
    title: "Additional tracking",
    subtitle:
      "Choose extra fields for daily logging. Saved values stay in your private history.",
    trackBBT: "Show BBT field",
    trackBBTHint:
      "Shows a basal body temperature field in dashboard and calendar entries.",
    trackBBTStateOn: "Currently visible in dashboard and calendar day editor.",
    trackBBTStateOff: "Currently hidden from new dashboard and calendar entries.",
    trackCervicalMucus: "Show cervical mucus field",
    trackCervicalMucusHint:
      "Shows cervical mucus choices in dashboard and calendar entries.",
    trackCervicalMucusStateOn:
      "Currently visible in dashboard and calendar day editor.",
    trackCervicalMucusStateOff:
      "Currently hidden from new dashboard and calendar entries.",
    hideSexChip: "Show intimacy section",
    hideSexChipHint:
      "Shows intimacy in new dashboard and calendar entries.",
    hideSexChipStateOn:
      "Currently visible in dashboard and calendar day editor.",
    hideSexChipStateOff:
      "Currently hidden in dashboard and calendar day editor.",
    hideNotes: "Show notes section",
    hideNotesHint:
      "Hides notes in dashboard and calendar entries without deleting saved notes.",
    hideNotesStateOn:
      "Currently visible in dashboard and calendar day editor.",
    hideNotesStateOff:
      "Currently hidden in dashboard and calendar day editor.",
    temperatureUnit: "BBT unit",
    temperatureUnitHint: "Used when the BBT field is visible.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Save tracking",
  },
  reminders: {
    title: "Reminders",
    subtitle:
      "Keep device reminders private on this device and use privacy-safe email prompts when premium delivery is enabled.",
    localOnlyHint:
      "On-device reminders stay on this device only. They do not send your health data to a server.",
    emailHint:
      "Premium reminder emails send only generic prompts. They never include symptoms, notes, or fertile details.",
    lockedHint:
      "Premium reminder delivery needs an active Ovumcy Cloud plan on this device. Your saved reminder choices stay local.",
    timeLabel: "Reminder time",
    timeHint:
      "Used for daily logging and for the next scheduled cycle reminders on this device.",
    emailDelivery: "Also send reminder emails",
    emailDeliveryHint:
      "Uses Ovumcy Cloud email delivery with privacy-safe prompts based on your enabled reminder types.",
    emailDeliveryStateOn:
      "Ovumcy Cloud reminder emails will be synced when available.",
    emailDeliveryStateOff: "Reminder emails are turned off.",
    dailyLog: "Remind me to log today",
    dailyLogHint:
      "Schedules a daily reminder to open Ovumcy and update today's entry.",
    dailyLogStateOn: "A daily on-device reminder is enabled.",
    dailyLogStateOff: "No daily logging reminder is scheduled.",
    upcomingPeriod: "Remind me before the next period window",
    upcomingPeriodHint:
      "Schedules a local reminder ahead of the next predicted period window when predictions are available.",
    upcomingPeriodStateOn:
      "An upcoming-period reminder is enabled.",
    upcomingPeriodStateOff: "No upcoming-period reminder is scheduled.",
    fertileWindow: "Remind me before the fertile window",
    fertileWindowHint:
      "Schedules a local reminder ahead of the next predicted fertile window when predictions are available.",
    fertileWindowStateOn:
      "A fertile-window reminder is enabled.",
    fertileWindowStateOff: "No fertile-window reminder is scheduled.",
    saved: "Reminder settings updated for this device.",
    savedWithEmail:
      "Reminder settings updated. Ovumcy Cloud reminder emails now use privacy-safe prompts.",
    emailUnavailable:
      "Reminder settings were saved, but Ovumcy Cloud reminder emails are unavailable right now.",
    emailSyncFailed:
      "Reminder settings were saved, but Ovumcy Cloud reminder emails could not be updated right now.",
    permissionDenied:
      "Allow notifications in device settings to receive reminders on this device.",
    unavailable: "This device cannot schedule local reminders right now.",
    errors: {
      invalidTime: "Use a valid reminder time in HH:MM format.",
      saveFailed:
        "Unable to save reminder settings right now. Please try again.",
    },
  },
  interface: {
    title: "Interface",
    subtitle: "Control app language and appearance on this device.",
    languageLabel: "Language",
    languageHint: "Saved only on this device.",
    previewHint: "Language and theme preview immediately. Save to keep them on this device.",
    themeLabel: "Theme",
    themeHint: "Saved only on this device.",
    screenCaptureProtectionLabel: "Protect screenshots",
    screenCaptureProtectionHint:
      "Blocks screenshots and recent-app previews on supported devices.",
    screenCaptureProtectionStateOn:
      "Screenshots are blocked on supported devices.",
    screenCaptureProtectionStateOff:
      "Screenshots and app previews can be captured on this device.",
    discardChanges: "Discard changes",
    save: "Save interface",
    saveBeforeLeave: "Save and leave",
    keepEditing: "Keep editing",
    themeLight: "Light",
    themeDark: "Dark",
    saved: "Interface settings updated for this device.",
    languageSaved: "Language updated for this device.",
    themeSaved: "Theme updated for this device.",
    unsavedPrompt:
      "You have unsaved settings changes. Save them before leaving settings?",
  },
  account: {
    title: "Backup & sync",
    subtitle:
      "Protect this device first, then connect either Ovumcy Cloud or your own sync server.",
    hubSubtitle:
      "Open recovery phrase, account connection, cloud plan, and sync actions on a separate screen.",
    openHubLabel: "Open backup & sync",
    backToSettingsLabel: "Back to settings",
    localStepTitle: "1. Protect this device",
    localStepHint:
      "Create a recovery phrase on this device. Keep it offline in case you ever need to restore your data.",
    preparingTitle: "Preparing your protected backup...",
    preparingHint:
      "Ovumcy is generating a recovery phrase on this device right now.",
    accountStepTitle: "2. Connect an account",
    accountStepHintManaged:
      "Sign in to your Ovumcy Cloud account here. Your health data still syncs separately as an encrypted backup.",
    accountStepHintSelfHosted:
      "Create or sign in to the account on your own sync server.",
    planStepTitle: "3. Cloud plan",
    planStepHint:
      "Cloud access and billing are checked separately. Sync turns on only after this account has an active Ovumcy Cloud plan.",
    planSignInFirst: "Sign in first to check your plan status.",
    planUnknown:
      "Ovumcy is checking whether this cloud account has an active plan.",
    planInactive:
      "This cloud account is signed in, but cloud sync is still locked because no active plan was found.",
    planCheckFailed:
      "Ovumcy could not confirm this cloud plan right now. Try again in a moment.",
    planUnavailable:
      "Your Ovumcy Cloud account and billing stay separate from encrypted sync storage.",
    planActive: "Ovumcy Cloud is active for this account.",
    checkPlanAgain: "Check plan again",
    advancedSectionLabel: "Advanced",
    syncStepTitle: "4. Sync this backup",
    syncStepHintManaged:
      "Once this cloud account has an active plan, you can upload or restore the protected backup here.",
    syncStepHintSelfHosted:
      "After you sign in to your own server, you can upload or restore the protected backup here.",
    syncBlockedNoPlan:
      "Cloud sync stays locked until this account has an active Ovumcy Cloud plan.",
    modeLabel: "Sync mode",
    modeManaged: "Ovumcy Cloud",
    modeSelfHosted: "Self-hosted",
    managedHint:
      "Ovumcy Cloud stores your encrypted backup on our hosted service. Self-hosted keeps sync on your own server.",
    selfHostedHint:
      "Use a host, IP:port, or full URL. Public http is rejected; localhost and private-network http are allowed.",
    endpointLabel: "Server endpoint",
    endpointHint: "Required only for self-hosted sync.",
    endpointPlaceholder: "sync.example.com or 192.168.1.20:8080",
    deviceLabel: "Device label",
    deviceHint:
      "Shown later in connected device lists and encrypted recovery flows.",
    devicePlaceholder: "Enter device name",
    stateLabel: "Recovery phrase status",
    stateReady: "This device already has a recovery phrase.",
    stateMissing: "This device does not have a recovery phrase yet.",
    connectionLabel: "Account session",
    connectionReady: "This device is signed in to a sync account.",
    connectionMissing: "This device is not signed in to a sync account yet.",
    lastSyncLabel: "Last sync",
    lastSyncNever: "Not synced yet.",
    modeRowLabel: "Destination",
    endpointRowLabel: "Server",
    encryptionRowLabel: "Device protection",
    encryptionReady: "Recovery materials are stored only on this device.",
    encryptionMissing: "No recovery phrase has been created on this device yet.",
    loginLabel: "Email or login",
    loginPlaceholder: "owner@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
    recoveryImportTitle: "Restore access with a recovery phrase",
    recoveryImportHint:
      "Use this when this device has no local sync keys but you still have the account password and the 12-word recovery phrase.",
    recoveryPhraseInputLabel: "Recovery phrase",
    recoveryPhraseInputPlaceholder: "twelve words separated by spaces",
    recoveryPhraseInputHint:
      "Enter the exact 12 words that protect your sync master key.",
    recoverAccessLabel: "Restore access",
    registerLabel: "Create account",
    loginActionLabel: "Sign in",
    syncNowLabel: "Sync now",
    restoreLabel: "Restore from server",
    disconnectLabel: "Disconnect",
    restorePrompt:
      "Restore the encrypted backup copy from the server and replace the current local data on this device?",
    restoreAccept: "Restore backup copy",
    restoreDeviceAuthPrompt:
      "Confirm with device security to restore encrypted data from the sync server.",
    disconnectPrompt:
      "Disconnect this device from the sync server session? Local encrypted keys will stay on this device.",
    recoveryTitle: "Recovery phrase for this device",
    recoveryHint:
      "Write down the 12 words exactly and keep them offline. If you lose every device and this phrase, synced data cannot be recovered.",
    recoveryNotice:
      "This screen shows the recovery phrase only when you prepare or recreate local sync keys.",
    recoveryShownOnce: "Shown only once after generation.",
    recoveryExportLabel: "Export as text",
    recoveryCodeTitle: "Account recovery code",
    recoveryCodeHint:
      "Save this code somewhere safe. It is shown only once and lets you reset your sync account password if you forget it.",
    prepareLabel: "Create recovery phrase",
    regenerateLabel: "Create a new recovery phrase",
    regeneratePrompt:
      "Recreating local sync keys invalidates older encrypted sync backups until you use the new recovery phrase. Continue?",
    regenerateAccept: "Create new phrase",
    regenerateDeviceAuthPrompt:
      "Confirm with device security to create a new recovery phrase for this device.",
    discardChangesLabel: "Discard changes",
    saveBeforeLeaveLabel: "Save and leave",
    keepEditingLabel: "Keep editing",
    unsavedPrompt:
      "You have unsaved backup and sync changes. Save them before leaving this screen?",
    prepared: "Recovery phrase created for this device.",
    regenerated: "A new recovery phrase was created for this device.",
    connected: "Connected to the sync server on this device.",
    connectedNoPlan:
      "Cloud account connected. Sync will turn on when this account has an active cloud plan.",
    recovered: "Sync access restored on this device.",
    uploaded: "Encrypted backup copy uploaded to the sync server.",
    restored: "Encrypted backup copy restored from the sync server.",
    disconnected: "Sync server session removed from this device.",
    errors: {
      loginRequired: "Login is required.",
      passwordRequired: "Password is required.",
      deviceLabelRequired: "Device label is required.",
      endpointRequired: "Enter a sync server endpoint.",
      invalidEndpoint: "Enter a valid host, IP address, or full URL.",
      unsupportedScheme: "Only https and approved local-network http endpoints are supported.",
      insecurePublicHttp: "Public sync endpoints must use https.",
      invalidRegistrationInput: "Use a valid login and a stronger password.",
      registrationFailed: "Unable to create a sync account with these details.",
      invalidCredentials: "Invalid login or password.",
      recoveryPhraseRequired: "Recovery phrase is required.",
      invalidRecoveryPhrase: "Enter the exact 12-word recovery phrase.",
      recoveryNotAvailable:
        "This sync server does not support recovery phrase import.",
      recoveryPackageNotFound:
        "No recovery package is stored for this account yet.",
      tooManyDevices: "This account has reached the current device limit.",
      syncNotPrepared: "Prepare encrypted sync on this device first.",
      notConnected: "Connect this device to a sync server first.",
      blobNotFound: "No encrypted backup copy exists on this server yet.",
      invalidPayload:
        "The encrypted backup copy from the server could not be read.",
      networkFailed: "Unable to reach the sync server right now.",
      recoveryExportUnavailable:
        "This device cannot export the recovery phrase right now.",
      recoveryExportFailed:
        "The recovery phrase could not be exported right now. Please try again.",
      deviceAuthUnavailable:
        "Set up a device passcode or biometrics before recreating local sync keys.",
      deviceAuthFailed:
        "Unable to confirm device security right now. Please try again.",
      saveFailed: "Unable to prepare encrypted sync right now. Please try again.",
      syncFailed:
        "Unable to upload the encrypted backup copy right now. Please try again.",
      restoreFailed:
        "Unable to restore the encrypted backup copy right now. Please try again.",
    },
  },
  symptoms: {
    title: "Custom symptoms",
    subtitle: "Create short private labels for patterns you want to log.",
    name: "Symptom name",
    namePlaceholder: "Enter symptom name",
    nameHint: "Use 40 characters or fewer. For longer details, use notes.",
    icon: "Icon",
    add: "Add symptom",
    save: "Save symptom",
    hide: "Hide",
    restore: "Restore",
    activeHeading: "Visible in new entries",
    activeHint: "Active custom symptoms appear in dashboard and calendar day pickers.",
    activeItem: "Visible in new entries",
    archivedHeading: "Archived from new entries",
    archivedHint: "Past logs keep them. Restore one when you want it back in the picker.",
    archivedItem: "Hidden from new entries",
    archivedBadge: "Hidden",
    empty: "No custom symptoms yet. Add one above to make it available in new entries.",
    emptyActive:
      "No visible custom symptoms right now. Restore one below or add a new one above.",
    created: "Custom symptom added.",
    updated: "Custom symptom updated.",
    archived: "Custom symptom hidden.",
    restored: "Custom symptom restored.",
    confirmHide:
      "Hide this custom symptom from new entries? Past logs will keep it.",
    errors: {
      labelRequired: "Name is required.",
      labelTooLong:
        "Use 40 characters or fewer. For longer details, use notes.",
      labelInvalidCharacters:
        "Use plain text only. Angle brackets and control characters are not allowed.",
      duplicateLabel: "That symptom name already exists in your list.",
      saveFailed: "Unable to save this symptom right now. Please try again.",
      notFound: "This symptom could not be found anymore. Reload settings and try again.",
    },
  },
  export: {
    title: "Export data",
    subtitle:
      "Create a local backup or a doctor-friendly table from your recorded entries.",
    storageHint:
      "Exports include only manually tracked records. Predictions are not included.",
    sensitiveHint:
      "Exported files are sensitive. Save and share them only where you trust the device or destination.",
    pdfCloudOnlyHint:
      "PDF export is an Ovumcy Cloud perk. CSV and JSON stay available locally on this device.",
    pdfPlanHint:
      "This Ovumcy Cloud account needs an active plan to unlock PDF export.",
    noData:
      "No tracked entries yet. Once you log days in dashboard or calendar, export becomes available here.",
    presetLabel: "Presets",
    presetAll: "All time",
    preset30: "30 days",
    preset90: "90 days",
    preset365: "365 days",
    fromLabel: "From date",
    toLabel: "To date",
    datePlaceholder: "YYYY-MM-DD",
    summaryTotalTemplate: "Total entries: %d",
    summaryRangeTemplate: "Date range: %s to %s",
    summaryRangeEmpty: "Date range: -",
    csvAction: "Export as CSV",
    jsonAction: "Export as JSON",
    pdfAction: "Export as PDF",
    csvStatus: "CSV export is ready.",
    jsonStatus: "JSON backup is ready.",
    pdfStatus: "PDF report is ready.",
    errors: {
      invalidFromDate: "Use a valid start date.",
      invalidToDate: "Use a valid end date.",
      invalidRange: "End date must be on or after start date.",
      pdfLocked: "PDF export is available only with an active Ovumcy Cloud plan.",
      exportFailed: "Unable to prepare your export right now. Please try again.",
      deliveryUnavailable:
        "This device cannot open the export destination right now. Try again from a supported browser or share-capable device.",
      deliveryFailed:
        "The export file was prepared, but sharing or download failed. Please try again.",
    },
  },
  danger: {
    title: "Danger zone",
    subtitle:
      "Closing the app does not clear local data. Use this only when you want to erase local health records from this device.",
    clearTitle: "Clear all local data",
    clearSubtitle:
      "Removes onboarding, profile settings, daily logs, custom symptoms, and local export state, then returns the app to onboarding.",
    confirmationLabel: "Type CLEAR to confirm",
    confirmationPlaceholder: "CLEAR",
    confirmationHint:
      "This action cannot be undone from the app. Export a backup first if you want to keep your records.",
    deviceAuthPrompt:
      "Confirm with device security to erase local data from this device.",
    action: "Clear local data",
    success: "Local data cleared. Returning to onboarding.",
    invalidConfirmation: "Type CLEAR exactly to confirm local data removal.",
    deviceAuthUnavailable:
      "Set up a device passcode or biometrics before clearing local data.",
    deviceAuthFailed: "Unable to confirm device security right now. Please try again.",
    failed:
      "Unable to clear local data right now. Please try again.",
  },
  status: {
    cycleSaved: "Cycle settings saved. Predictions were refreshed.",
    trackingSaved: "Tracking fields updated for dashboard and calendar.",
    invalidLastPeriodStart:
      "Please enter a valid last period start date that is not in the future.",
    saveFailed: "Unable to save your settings. Please try again.",
  },
  premiumLock: {
    eyebrowLabel: "Premium",
    ctaLabel: "Open Ovumcy Cloud",
    remindersTitle: "Premium reminders",
    pdfExportTitle: "Doctor-friendly PDF",
  },
} as const;

type SettingsCopy = WidenLiteral<typeof settingsCopyEn>;

const settingsCopyDe: SettingsCopy = {
  ...settingsCopyEn,
  title: "Einstellungen",
  subtitle:
    "Verwalte Zyklusparameter, Tracking-Felder, Exportaktionen und das lokale Profilverhalten.",
  common: {
    ...settingsCopyEn.common,
    cancelAction: "Abbrechen",
    confirmAction: "Bestätigen",
    saveChanges: "Änderungen speichern",
    changeDate: "Datum wählen",
    clearDate: "Datum löschen",
    notSet: "Nicht festgelegt",
    saving: "Wird gespeichert...",
  },
  cycle: {
    ...settingsCopyEn.cycle,
    title: "Zyklusparameter",
    cycleLength: "Übliche Zykluslänge",
    periodLength: "Periodendauer",
    lastPeriodStart: "Startdatum der letzten Periode",
    lastPeriodStartHint:
      "Optionaler Fallback, wenn in deinem Journal noch kein Zyklusbeginn markiert ist.",
    warningApproximate:
      "Mit diesen Werten lässt sich der Eisprung nicht zuverlässig berechnen. Die Vorhersage wird nur ungefähr sein.",
    infoAdjusted:
      "Die Periodendauer wurde automatisch angepasst, damit mindestens 10 Tage bis zum nächsten Zyklus bleiben.",
    infoPeriodLong:
      "Eine Dauer von mehr als 8 Tagen kann auf Zyklusunregelmäßigkeiten hinweisen. Sprich darüber mit einer Ärztin oder einem Arzt.",
    infoCycleLong:
      "Ein Zyklus von mehr als 45 Tagen ist seltener. Sprich darüber mit einer Ärztin oder einem Arzt.",
    infoCycleShort:
      "Ein Zyklus unter 21 Tagen ist seltener. Sprich darüber mit einer Ärztin oder einem Arzt.",
    autoPeriodFill: "Periodentage automatisch ausfüllen",
    autoPeriodFillHint:
      "Wenn diese Option aktiviert ist, füllt das Markieren des ersten Tages die folgenden Tage automatisch auf Basis deiner Periodendauer aus.",
    predictionModeLabel: "Vorhersagemodus",
    predictionModeHint: "Wähle, wie Ovumcy Datumsvorhersagen anzeigen soll.",
    predictionModeRegular: "Regelmäßig",
    predictionModeRegularHint:
      "Zeigt die Standardvorhersage auf Basis deiner Zykluseinstellungen und deines Verlaufs.",
    predictionModeIrregular: "Unregelmäßig",
    predictionModeIrregularHint:
      "Lässt Vorhersagen sichtbar, aber nur als ungefähre Orientierung.",
    predictionModeFactsOnly: "Nur Fakten",
    predictionModeFactsOnlyHint:
      "Schaltet Datumsvorhersagen aus und zeigt nur erfasste Fakten und gespeicherte Marker.",
    save: "Änderungen speichern",
  },
  ageGroup: {
    ...settingsCopyEn.ageGroup,
    title: "Altersgruppe",
    hint: "Optional. Wird mit Ihrem Profil gespeichert; Vorhersagen verwenden ausschließlich Ihre eigene Zyklushistorie.",
    under40: "Unter 40",
  },
  goal: {
    ...settingsCopyEn.goal,
    title: "Nutzungsziel",
    hint: "Optional. Das verändert nur, wie fruchtbare Tage in der Oberfläche eingeordnet werden. Es ändert nicht den Algorithmus.",
    avoid: "Schwangerschaft vermeiden",
    trying: "Schwanger werden",
    health: "Meine Gesundheit verfolgen",
  },
  tracking: {
    ...settingsCopyEn.tracking,
    title: "Zusätzliches Tracking",
    subtitle:
      "Wähle zusätzliche Felder für tägliche Einträge. Gespeicherte Werte bleiben in deinem privaten Verlauf.",
    trackBBT: "BBT-Feld anzeigen",
    trackBBTHint:
      "Zeigt ein Feld für Basaltemperatur in Dashboard- und Kalendereinträgen.",
    trackBBTStateOn:
      "Derzeit im Dashboard und im Tageseditor des Kalenders sichtbar.",
    trackBBTStateOff:
      "Derzeit in neuen Dashboard- und Kalendereinträgen verborgen.",
    trackCervicalMucus: "Zervixschleim-Feld anzeigen",
    trackCervicalMucusHint:
      "Zeigt Auswahlmöglichkeiten für Zervixschleim in Dashboard- und Kalendereinträgen.",
    trackCervicalMucusStateOn:
      "Derzeit im Dashboard und im Tageseditor des Kalenders sichtbar.",
    trackCervicalMucusStateOff:
      "Derzeit in neuen Dashboard- und Kalendereinträgen verborgen.",
    hideSexChip: "Intimitätsbereich anzeigen",
    hideSexChipHint:
      "Zeigt Intimität in neuen Dashboard- und Kalendereinträgen an.",
    hideSexChipStateOn:
      "Derzeit im Dashboard und im Tageseditor des Kalenders sichtbar.",
    hideSexChipStateOff:
      "Derzeit im Dashboard und im Tageseditor des Kalenders verborgen.",
    hideNotes: "Notizbereich anzeigen",
    hideNotesHint:
      "Blendet Notizen in Dashboard- und Kalendereinträgen aus, ohne gespeicherte Notizen zu löschen.",
    hideNotesStateOn:
      "Derzeit im Dashboard und im Tageseditor des Kalenders sichtbar.",
    hideNotesStateOff:
      "Derzeit im Dashboard und im Tageseditor des Kalenders verborgen.",
    temperatureUnit: "BBT-Einheit",
    temperatureUnitHint: "Wird verwendet, wenn das BBT-Feld sichtbar ist.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Tracking speichern",
  },
  reminders: {
    title: "Erinnerungen",
    subtitle:
      "Halte Geräte-Erinnerungen privat auf diesem Gerät und nutze datensparsame E-Mail-Hinweise, wenn Premium-Zustellung aktiv ist.",
    localOnlyHint:
      "Geräte-Erinnerungen bleiben nur auf diesem Gerät. Es werden keine Gesundheitsdaten an einen Server gesendet.",
    emailHint:
      "Premium-Erinnerungs-E-Mails senden nur allgemeine Hinweise. Symptome, Notizen oder fruchtbare Details werden nie aufgenommen.",
    lockedHint:
      "Premium-Erinnerungszustellung benötigt auf diesem Gerät einen aktiven Ovumcy-Cloud-Plan. Deine gespeicherten Auswahloptionen bleiben lokal.",
    timeLabel: "Erinnerungszeit",
    timeHint:
      "Wird für tägliche Log-Erinnerungen und für die nächsten geplanten Zyklus-Erinnerungen auf diesem Gerät verwendet.",
    emailDelivery: "Auch Erinnerungs-E-Mails senden",
    emailDeliveryHint:
      "Verwendet die E-Mail-Zustellung von Ovumcy Cloud mit datensparsamen Hinweisen basierend auf deinen aktivierten Erinnerungstypen.",
    emailDeliveryStateOn:
      "Erinnerungs-E-Mails von Ovumcy Cloud werden synchronisiert, wenn sie verfügbar sind.",
    emailDeliveryStateOff: "Erinnerungs-E-Mails sind ausgeschaltet.",
    dailyLog: "Mich an den heutigen Eintrag erinnern",
    dailyLogHint:
      "Plant eine tägliche Erinnerung, Ovumcy zu öffnen und den heutigen Eintrag zu aktualisieren.",
    dailyLogStateOn: "Eine tägliche Geräte-Erinnerung ist aktiviert.",
    dailyLogStateOff: "Es ist keine tägliche Log-Erinnerung geplant.",
    upcomingPeriod: "Vor dem nächsten Periodenfenster erinnern",
    upcomingPeriodHint:
      "Plant eine lokale Erinnerung vor dem nächsten vorhergesagten Periodenfenster, wenn Vorhersagen verfügbar sind.",
    upcomingPeriodStateOn:
      "Eine Erinnerung vor der nächsten Periode ist aktiviert.",
    upcomingPeriodStateOff:
      "Es ist keine Erinnerung vor der nächsten Periode geplant.",
    fertileWindow: "Vor dem fruchtbaren Fenster erinnern",
    fertileWindowHint:
      "Plant eine lokale Erinnerung vor dem nächsten vorhergesagten fruchtbaren Fenster, wenn Vorhersagen verfügbar sind.",
    fertileWindowStateOn:
      "Eine Erinnerung vor dem fruchtbaren Fenster ist aktiviert.",
    fertileWindowStateOff:
      "Es ist keine Erinnerung vor dem fruchtbaren Fenster geplant.",
    saved: "Erinnerungseinstellungen wurden für dieses Gerät aktualisiert.",
    savedWithEmail:
      "Erinnerungseinstellungen wurden aktualisiert. Erinnerungs-E-Mails von Ovumcy Cloud nutzen jetzt datensparsame Hinweise.",
    emailUnavailable:
      "Die Erinnerungseinstellungen wurden gespeichert, aber Erinnerungs-E-Mails von Ovumcy Cloud sind gerade nicht verfügbar.",
    emailSyncFailed:
      "Die Erinnerungseinstellungen wurden gespeichert, aber Erinnerungs-E-Mails von Ovumcy Cloud konnten gerade nicht aktualisiert werden.",
    permissionDenied:
      "Erlaube Benachrichtigungen in den Geräteeinstellungen, um Erinnerungen auf diesem Gerät zu erhalten.",
    unavailable:
      "Dieses Gerät kann lokale Erinnerungen im Moment nicht planen.",
    errors: {
      invalidTime:
        "Verwende eine gültige Erinnerungszeit im Format HH:MM.",
      saveFailed:
        "Die Erinnerungseinstellungen konnten gerade nicht gespeichert werden. Bitte versuche es erneut.",
    },
  },
  interface: {
    ...settingsCopyEn.interface,
    title: "Oberfläche",
    subtitle: "Steuere Sprache und Erscheinungsbild der App auf diesem Gerät.",
    languageLabel: "Sprache",
    languageHint: "Wird nur auf diesem Gerät gespeichert.",
    previewHint:
      "Sprache und Design werden sofort als Vorschau angezeigt. Speichere, um sie auf diesem Gerät zu behalten.",
    themeLabel: "Design",
    themeHint: "Wird nur auf diesem Gerät gespeichert.",
    screenCaptureProtectionLabel: "Screenshots schützen",
    screenCaptureProtectionHint:
      "Blockiert Screenshots und die Vorschau im App-Umschalter auf unterstützten Geräten.",
    screenCaptureProtectionStateOn:
      "Screenshots sind auf unterstützten Geräten blockiert.",
    screenCaptureProtectionStateOff:
      "Screenshots und App-Vorschauen können auf diesem Gerät aufgenommen werden.",
    discardChanges: "Änderungen verwerfen",
    save: "Oberfläche speichern",
    saveBeforeLeave: "Speichern und verlassen",
    keepEditing: "Weiter bearbeiten",
    themeLight: "Hell",
    themeDark: "Dunkel",
    saved: "Oberflächeneinstellungen für dieses Gerät aktualisiert.",
    languageSaved: "Sprache für dieses Gerät aktualisiert.",
    themeSaved: "Design für dieses Gerät aktualisiert.",
    unsavedPrompt:
      "Du hast ungespeicherte Einstellungsänderungen. Vor dem Verlassen speichern?",
  },
  account: {
    ...settingsCopyEn.account,
    title: "Backup & Sync",
    subtitle:
      "Schütze zuerst dieses Gerät und verbinde dann entweder Ovumcy Cloud oder deinen eigenen Sync-Server.",
    hubSubtitle:
      "Öffne Wiederherstellungsphrase, Kontoverbindung, Cloud-Tarif und Sync-Aktionen auf einem separaten Bildschirm.",
    openHubLabel: "Backup & Sync öffnen",
    backToSettingsLabel: "Zurück zu den Einstellungen",
    localStepTitle: "1. Dieses Gerät schützen",
    localStepHint:
      "Erstelle auf diesem Gerät eine Wiederherstellungsphrase. Bewahre sie offline auf, falls du deine Daten jemals wiederherstellen musst.",
    preparingTitle: "Dein geschütztes Backup wird vorbereitet...",
    preparingHint:
      "Ovumcy erzeugt gerade auf diesem Gerät eine Wiederherstellungsphrase.",
    accountStepTitle: "2. Konto verbinden",
    accountStepHintManaged:
      "Melde dich hier mit deinem Ovumcy-Cloud-Konto an. Deine Gesundheitsdaten werden weiterhin separat als verschlüsseltes Backup synchronisiert.",
    accountStepHintSelfHosted:
      "Erstelle ein Konto auf deinem eigenen Sync-Server oder melde dich dort an.",
    planStepTitle: "3. Cloud-Tarif",
    planStepHint:
      "Cloud-Zugriff und Abrechnung werden getrennt geprüft. Sync wird erst aktiviert, wenn dieses Konto einen aktiven Ovumcy-Cloud-Tarif hat.",
    planSignInFirst: "Melde dich zuerst an, um deinen Tarifstatus zu prüfen.",
    planUnknown:
      "Ovumcy prüft, ob dieses Cloud-Konto einen aktiven Tarif hat.",
    planInactive:
      "Dieses Cloud-Konto ist angemeldet, aber Cloud-Sync bleibt gesperrt, weil kein aktiver Tarif gefunden wurde.",
    planCheckFailed:
      "Ovumcy konnte den Cloud-Tarif gerade nicht bestätigen. Versuche es gleich noch einmal.",
    planUnavailable:
      "Dein Ovumcy-Cloud-Konto und die Abrechnung bleiben vom verschlüsselten Sync-Speicher getrennt.",
    planActive: "Ovumcy Cloud ist für dieses Konto aktiv.",
    checkPlanAgain: "Tarif erneut prüfen",
    advancedSectionLabel: "Erweitert",
    syncStepTitle: "4. Dieses Backup synchronisieren",
    syncStepHintManaged:
      "Sobald dieses Cloud-Konto einen aktiven Tarif hat, kannst du hier das geschützte Backup hochladen oder wiederherstellen.",
    syncStepHintSelfHosted:
      "Sobald du an deinem eigenen Server angemeldet bist, kannst du hier das geschützte Backup hochladen oder wiederherstellen.",
    syncBlockedNoPlan:
      "Cloud-Sync bleibt gesperrt, bis dieses Konto einen aktiven Ovumcy Cloud-Tarif hat.",
    modeLabel: "Sync-Modus",
    modeManaged: "Ovumcy Cloud",
    modeSelfHosted: "Self-hosted",
    managedHint:
      "Ovumcy Cloud speichert dein verschlüsseltes Backup auf unserem gehosteten Dienst. Self-hosted behält Sync auf deinem eigenen Server.",
    selfHostedHint:
      "Nutze einen Host, IP:Port oder eine vollständige URL. Öffentliches http wird abgelehnt; localhost und privates Netzwerk-http sind erlaubt.",
    endpointLabel: "Server-Endpunkt",
    endpointHint: "Nur für self-hosted Sync erforderlich.",
    endpointPlaceholder: "sync.example.com oder 192.168.1.20:8080",
    deviceLabel: "Gerätebezeichnung",
    deviceHint:
      "Wird später in verbundenen Gerätelisten und in verschlüsselten Wiederherstellungsabläufen angezeigt.",
    devicePlaceholder: "Gerätenamen eingeben",
    stateLabel: "Status der Wiederherstellungsphrase",
    stateReady: "Dieses Gerät hat bereits eine Wiederherstellungsphrase.",
    stateMissing: "Dieses Gerät hat noch keine Wiederherstellungsphrase.",
    connectionLabel: "Kontositzung",
    connectionReady: "Dieses Gerät ist bei einem Sync-Konto angemeldet.",
    connectionMissing:
      "Dieses Gerät ist noch bei keinem Sync-Konto angemeldet.",
    lastSyncLabel: "Letzte Synchronisierung",
    lastSyncNever: "Noch nicht synchronisiert.",
    modeRowLabel: "Ziel",
    endpointRowLabel: "Server",
    encryptionRowLabel: "Geräteschutz",
    encryptionReady:
      "Die Wiederherstellungsdaten werden nur auf diesem Gerät gespeichert.",
    encryptionMissing:
      "Auf diesem Gerät wurde noch keine Wiederherstellungsphrase erstellt.",
    loginLabel: "E-Mail oder Login",
    loginPlaceholder: "owner@example.com",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Passwort eingeben",
    recoveryImportTitle: "Zugriff mit Wiederherstellungsphrase wiederherstellen",
    recoveryImportHint:
      "Nutze das, wenn dieses Gerät keine lokalen Sync-Schlüssel mehr hat, du aber noch Kontopasswort und 12-Wort-Wiederherstellungsphrase besitzt.",
    recoveryPhraseInputLabel: "Wiederherstellungsphrase",
    recoveryPhraseInputPlaceholder: "zwölf Wörter mit Leerzeichen getrennt",
    recoveryPhraseInputHint:
      "Gib exakt die 12 Wörter ein, mit denen dein Sync-Master-Key geschützt ist.",
    recoverAccessLabel: "Zugriff wiederherstellen",
    registerLabel: "Konto erstellen",
    loginActionLabel: "Anmelden",
    syncNowLabel: "Jetzt synchronisieren",
    restoreLabel: "Vom Server wiederherstellen",
    disconnectLabel: "Trennen",
    restorePrompt:
      "Die verschlüsselte Sicherungskopie vom Server wiederherstellen und die aktuellen lokalen Daten auf diesem Gerät ersetzen?",
    restoreAccept: "Sicherung wiederherstellen",
    restoreDeviceAuthPrompt:
      "Bestätige mit Geräteschutz, um verschlüsselte Daten vom Sync-Server wiederherzustellen.",
    disconnectPrompt:
      "Dieses Gerät von der Sync-Server-Sitzung trennen? Die lokalen verschlüsselten Schlüssel bleiben auf diesem Gerät.",
    recoveryTitle: "Wiederherstellungsphrase für dieses Gerät",
    recoveryHint:
      "Schreibe die 12 Wörter exakt auf und bewahre sie offline auf. Wenn du alle Geräte und diese Phrase verlierst, können synchronisierte Daten nicht wiederhergestellt werden.",
    recoveryNotice:
      "Dieser Bildschirm zeigt die Wiederherstellungsphrase nur, wenn du lokale Sync-Schlüssel vorbereitest oder neu erstellst.",
    recoveryShownOnce: "Wird nach der Erstellung nur einmal angezeigt.",
    recoveryExportLabel: "Als Text exportieren",
    recoveryCodeTitle: "Konto-Wiederherstellungscode",
    recoveryCodeHint:
      "Speichere diesen Code sicher. Er wird nur einmal angezeigt und erlaubt dir, das Passwort deines Sync-Kontos zurückzusetzen, falls du es vergisst.",
    prepareLabel: "Wiederherstellungsphrase erstellen",
    regenerateLabel: "Neue Wiederherstellungsphrase erstellen",
    regeneratePrompt:
      "Das Neuerstellen lokaler Sync-Schlüssel macht ältere verschlüsselte Sync-Backups ungültig, bis du die neue Wiederherstellungsphrase verwendest. Fortfahren?",
    regenerateAccept: "Neue Phrase erstellen",
    regenerateDeviceAuthPrompt:
      "Bestätige mit Geräteschutz, um eine neue Wiederherstellungsphrase für dieses Gerät zu erstellen.",
    discardChangesLabel: "Änderungen verwerfen",
    saveBeforeLeaveLabel: "Speichern und verlassen",
    keepEditingLabel: "Weiter bearbeiten",
    unsavedPrompt:
      "Du hast ungespeicherte Änderungen für Backup und Sync. Vor dem Verlassen speichern?",
    prepared: "Die Wiederherstellungsphrase wurde für dieses Gerät erstellt.",
    regenerated: "Für dieses Gerät wurde eine neue Wiederherstellungsphrase erstellt.",
    connected: "Dieses Gerät ist mit dem Sync-Server verbunden.",
    connectedNoPlan:
      "Cloud-Konto verbunden. Sync wird aktiviert, wenn dieses Konto einen aktiven Cloud-Tarif hat.",
    recovered: "Der Sync-Zugriff wurde auf diesem Gerät wiederhergestellt.",
    uploaded:
      "Verschlüsselte Sicherungskopie auf den Sync-Server hochgeladen.",
    restored:
      "Verschlüsselte Sicherungskopie vom Sync-Server wiederhergestellt.",
    disconnected: "Die Sync-Server-Sitzung wurde von diesem Gerät entfernt.",
    errors: {
      ...settingsCopyEn.account.errors,
      loginRequired: "Login ist erforderlich.",
      passwordRequired: "Passwort ist erforderlich.",
      deviceLabelRequired: "Die Gerätebezeichnung ist erforderlich.",
      endpointRequired: "Gib einen Sync-Server-Endpunkt ein.",
      invalidEndpoint: "Gib einen gültigen Host, eine IP-Adresse oder eine vollständige URL ein.",
      unsupportedScheme:
        "Nur https und zugelassene lokale http-Endpunkte werden unterstützt.",
      insecurePublicHttp:
        "Öffentliche Sync-Endpunkte müssen https verwenden.",
      invalidRegistrationInput:
        "Nutze einen gültigen Login und ein stärkeres Passwort.",
      registrationFailed:
        "Mit diesen Angaben konnte kein Sync-Konto erstellt werden.",
      invalidCredentials: "Ungültiger Login oder ungültiges Passwort.",
      recoveryPhraseRequired: "Die Wiederherstellungsphrase ist erforderlich.",
      invalidRecoveryPhrase:
        "Gib die exakte Wiederherstellungsphrase mit 12 Wörtern ein.",
      recoveryNotAvailable:
        "Dieser Sync-Server unterstützt keinen Import per Wiederherstellungsphrase.",
      recoveryPackageNotFound:
        "Für dieses Konto ist noch kein Recovery-Paket gespeichert.",
      tooManyDevices:
        "Dieses Konto hat das aktuelle Geräte-Limit erreicht.",
      syncNotPrepared:
        "Bereite zuerst den verschlüsselten Sync auf diesem Gerät vor.",
      notConnected:
        "Verbinde dieses Gerät zuerst mit einem Sync-Server.",
      blobNotFound:
        "Auf diesem Server gibt es noch keine verschlüsselte Sicherungskopie.",
      invalidPayload:
        "Die verschlüsselte Sicherungskopie vom Server konnte nicht gelesen werden.",
      networkFailed:
        "Der Sync-Server ist gerade nicht erreichbar.",
      recoveryExportUnavailable:
        "Dieses Gerät kann die Wiederherstellungsphrase gerade nicht exportieren.",
      recoveryExportFailed:
        "Die Wiederherstellungsphrase konnte gerade nicht exportiert werden. Bitte versuche es erneut.",
      deviceAuthUnavailable:
        "Richte auf diesem Gerät zuerst einen Code oder Biometrie ein, bevor du lokale Sync-Schlüssel neu erstellst.",
      deviceAuthFailed:
        "Der Geräteschutz konnte gerade nicht bestätigt werden. Bitte versuche es erneut.",
      saveFailed:
        "Der verschlüsselte Sync konnte gerade nicht vorbereitet werden. Bitte versuche es erneut.",
      syncFailed:
        "Die verschlüsselte Sicherungskopie konnte gerade nicht hochgeladen werden. Bitte versuche es erneut.",
      restoreFailed:
        "Die verschlüsselte Sicherungskopie konnte gerade nicht wiederhergestellt werden. Bitte versuche es erneut.",
    },
  },
  symptoms: {
    ...settingsCopyEn.symptoms,
    title: "Eigene Symptome",
    subtitle:
      "Erstelle kurze private Bezeichnungen für Muster, die du protokollieren möchtest.",
    name: "Symptomname",
    namePlaceholder: "Symptomname eingeben",
    nameHint:
      "Verwende höchstens 40 Zeichen. Für längere Details nutze Notizen.",
    icon: "Symbol",
    add: "Symptom hinzufügen",
    save: "Symptom speichern",
    hide: "Ausblenden",
    restore: "Wiederherstellen",
    activeHeading: "In neuen Einträgen sichtbar",
    activeHint:
      "Aktive eigene Symptome erscheinen im Dashboard und in Tagesauswahlen des Kalenders.",
    activeItem: "In neuen Einträgen sichtbar",
    archivedHeading: "Für neue Einträge archiviert",
    archivedHint:
      "Vergangene Einträge behalten sie. Stelle eines wieder her, wenn es wieder im Auswahlfeld erscheinen soll.",
    archivedItem: "In neuen Einträgen verborgen",
    archivedBadge: "Verborgen",
    empty:
      "Es gibt noch keine eigenen Symptome. Füge oben eines hinzu, damit es in neuen Einträgen verfügbar ist.",
    emptyActive:
      "Zurzeit sind keine sichtbaren eigenen Symptome vorhanden. Stelle unten eines wieder her oder füge oben ein neues hinzu.",
    created: "Eigenes Symptom hinzugefügt.",
    updated: "Eigenes Symptom aktualisiert.",
    archived: "Eigenes Symptom verborgen.",
    restored: "Eigenes Symptom wiederhergestellt.",
    confirmHide:
      "Dieses eigene Symptom in neuen Einträgen ausblenden? Vergangene Einträge behalten es.",
    errors: {
      ...settingsCopyEn.symptoms.errors,
      labelRequired: "Ein Name ist erforderlich.",
      labelTooLong:
        "Verwende höchstens 40 Zeichen. Für längere Details nutze Notizen.",
      labelInvalidCharacters:
        "Verwende nur Klartext. Spitzklammern und Steuerzeichen sind nicht erlaubt.",
      duplicateLabel: "Dieser Symptomname existiert bereits in deiner Liste.",
      saveFailed:
        "Dieses Symptom konnte gerade nicht gespeichert werden. Bitte versuche es erneut.",
      notFound:
        "Dieses Symptom konnte nicht mehr gefunden werden. Lade die Einstellungen neu und versuche es erneut.",
    },
  },
  export: {
    ...settingsCopyEn.export,
    title: "Daten exportieren",
    subtitle:
      "Erstelle ein lokales Backup oder eine ärztetaugliche Tabelle aus deinen erfassten Einträgen.",
    storageHint:
      "Exporte enthalten nur manuell erfasste Einträge. Vorhersagen sind nicht enthalten.",
    sensitiveHint:
      "Exportierte Dateien sind sensibel. Speichere und teile sie nur an Orten, denen du vertraust.",
    pdfCloudOnlyHint:
      "Der PDF-Export ist ein Ovumcy-Cloud-Vorteil. CSV und JSON bleiben lokal auf diesem Gerät verfügbar.",
    pdfPlanHint:
      "Dieses Ovumcy-Cloud-Konto braucht einen aktiven Tarif, um den PDF-Export freizuschalten.",
    noData:
      "Es gibt noch keine erfassten Einträge. Sobald du Tage im Dashboard oder Kalender protokollierst, wird der Export hier verfügbar.",
    presetLabel: "Voreinstellungen",
    presetAll: "Gesamte Zeit",
    preset30: "30 Tage",
    preset90: "90 Tage",
    preset365: "365 Tage",
    fromLabel: "Von",
    toLabel: "Bis",
    summaryTotalTemplate: "Gesamteinträge: %d",
    summaryRangeTemplate: "Datumsbereich: %s bis %s",
    summaryRangeEmpty: "Datumsbereich: -",
    csvAction: "Als CSV exportieren",
    jsonAction: "Als JSON exportieren",
    pdfAction: "Als PDF exportieren",
    csvStatus: "CSV-Export ist bereit.",
    jsonStatus: "JSON-Backup ist bereit.",
    pdfStatus: "PDF-Bericht ist bereit.",
    errors: {
      ...settingsCopyEn.export.errors,
      invalidFromDate: "Verwende ein gültiges Startdatum.",
      invalidToDate: "Verwende ein gültiges Enddatum.",
      invalidRange:
        "Das Enddatum muss am oder nach dem Startdatum liegen.",
      pdfLocked:
        "Der PDF-Export ist nur mit einem aktiven Ovumcy-Cloud-Tarif verfügbar.",
      exportFailed:
        "Der Export konnte gerade nicht vorbereitet werden. Bitte versuche es erneut.",
      deliveryUnavailable:
        "Dieses Gerät kann das Exportziel gerade nicht öffnen. Versuche es über einen unterstützten Browser oder ein Gerät mit Teilen/Speichern-Funktion.",
      deliveryFailed:
        "Die Exportdatei wurde vorbereitet, aber das Teilen oder Herunterladen ist fehlgeschlagen. Bitte versuche es erneut.",
    },
  },
  danger: {
    ...settingsCopyEn.danger,
    title: "Gefahrenbereich",
    subtitle:
      "Das Schließen der App löscht keine lokalen Daten. Nutze dies nur, wenn du Gesundheitsdaten von diesem Gerät entfernen möchtest.",
    clearTitle: "Alle lokalen Daten löschen",
    clearSubtitle:
      "Entfernt Onboarding, Profileinstellungen, tägliche Einträge, eigene Symptome und den lokalen Exportstatus und bringt die App anschließend zurück ins Onboarding.",
    confirmationLabel: "Zum Bestätigen CLEAR eingeben",
    confirmationHint:
      "Diese Aktion kann in der App nicht rückgängig gemacht werden. Exportiere zuerst ein Backup, wenn du deine Einträge behalten möchtest.",
    deviceAuthPrompt:
      "Bestätige mit Geräteschutz, um lokale Daten von diesem Gerät zu löschen.",
    action: "Lokale Daten löschen",
    success: "Lokale Daten gelöscht. Zurück zum Onboarding.",
    invalidConfirmation:
      "Gib zum Bestätigen exakt CLEAR ein.",
    deviceAuthUnavailable:
      "Richte auf diesem Gerät zuerst einen Code oder Biometrie ein, bevor du lokale Daten löschst.",
    deviceAuthFailed:
      "Der Geräteschutz konnte gerade nicht bestätigt werden. Bitte versuche es erneut.",
    failed:
      "Lokale Daten konnten gerade nicht gelöscht werden. Bitte versuche es erneut.",
  },
  status: {
    ...settingsCopyEn.status,
    cycleSaved:
      "Zykluseinstellungen gespeichert. Vorhersagen wurden aktualisiert.",
    trackingSaved:
      "Tracking-Felder für Dashboard und Kalender aktualisiert.",
    invalidLastPeriodStart:
      "Bitte gib ein gültiges Startdatum der letzten Periode ein, das nicht in der Zukunft liegt.",
    saveFailed:
      "Deine Einstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.",
  },
  premiumLock: {
    eyebrowLabel: "Premium",
    ctaLabel: "Ovumcy Cloud öffnen",
    remindersTitle: "Premium-Erinnerungen",
    pdfExportTitle: "Arztgerechtes PDF",
  },
};

const settingsCopyFr: SettingsCopy = {
  ...settingsCopyEn,
  title: "Réglages",
  subtitle:
    "Gère les paramètres du cycle, les champs de suivi, les actions d'export et le comportement local du profil.",
  common: {
    ...settingsCopyEn.common,
    cancelAction: "Annuler",
    confirmAction: "Confirmer",
    saveChanges: "Enregistrer les modifications",
    changeDate: "Choisir une date",
    clearDate: "Effacer la date",
    notSet: "Non défini",
    saving: "Enregistrement...",
  },
  cycle: {
    ...settingsCopyEn.cycle,
    title: "Paramètres du cycle",
    cycleLength: "Durée habituelle du cycle",
    periodLength: "Durée des règles",
    lastPeriodStart: "Date de début des dernières règles",
    lastPeriodStartHint:
      "Valeur de secours facultative si ton journal n'a pas encore de début de cycle marqué.",
    warningApproximate:
      "Avec ces valeurs, l'ovulation ne peut pas être calculée de façon fiable. La prédiction sera approximative.",
    infoAdjusted:
      "La durée des règles a été ajustée automatiquement pour qu'il reste au moins 10 jours avant le cycle suivant.",
    infoPeriodLong:
      "Une durée supérieure à 8 jours peut indiquer des irrégularités. Parles-en avec un médecin.",
    infoCycleLong:
      "Un cycle de plus de 45 jours est moins courant. Parles-en avec un médecin.",
    infoCycleShort:
      "Un cycle inférieur à 21 jours est moins courant. Parles-en avec un médecin.",
    autoPeriodFill: "Remplir automatiquement les jours de règles",
    autoPeriodFillHint:
      "Quand cette option est activée, marquer le premier jour remplit automatiquement les jours suivants selon la durée de tes règles.",
    predictionModeLabel: "Mode de prédiction",
    predictionModeHint: "Choisis comment Ovumcy doit afficher les prévisions de dates.",
    predictionModeRegular: "Régulier",
    predictionModeRegularHint:
      "Affiche la vue standard des prévisions à partir de tes réglages de cycle et de ton historique.",
    predictionModeIrregular: "Irrégulier",
    predictionModeIrregularHint:
      "Laisse les prévisions visibles, mais lis-les comme une indication approximative.",
    predictionModeFactsOnly: "Seulement les faits",
    predictionModeFactsOnlyHint:
      "Désactive les prévisions de dates et affiche seulement les faits enregistrés et les marqueurs sauvegardés.",
    save: "Enregistrer les modifications",
  },
  ageGroup: {
    ...settingsCopyEn.ageGroup,
    title: "Tranche d'âge",
    hint: "Optionnel. Enregistré avec votre profil ; les prédictions n'utilisent que votre propre historique de cycles.",
    under40: "Moins de 40 ans",
  },
  goal: {
    ...settingsCopyEn.goal,
    title: "Objectif d'usage",
    hint: "Optionnel. Cela change seulement la façon dont les jours fertiles sont présentés dans l'interface. L'algorithme ne change pas.",
    avoid: "Éviter une grossesse",
    trying: "Essayer de concevoir",
    health: "Suivre ma santé",
  },
  tracking: {
    ...settingsCopyEn.tracking,
    title: "Suivi supplémentaire",
    subtitle:
      "Choisis des champs supplémentaires pour les entrées quotidiennes. Les valeurs enregistrées restent dans ton historique privé.",
    trackBBT: "Afficher le champ TBC",
    trackBBTHint:
      "Affiche un champ de température basale dans le dashboard et les entrées du calendrier.",
    trackBBTStateOn:
      "Actuellement visible dans le dashboard et dans l'éditeur journalier du calendrier.",
    trackBBTStateOff:
      "Actuellement masqué dans les nouvelles entrées du dashboard et du calendrier.",
    trackCervicalMucus: "Afficher le champ de glaire cervicale",
    trackCervicalMucusHint:
      "Affiche des choix de glaire cervicale dans le dashboard et les entrées du calendrier.",
    trackCervicalMucusStateOn:
      "Actuellement visible dans le dashboard et dans l'éditeur journalier du calendrier.",
    trackCervicalMucusStateOff:
      "Actuellement masqué dans les nouvelles entrées du dashboard et du calendrier.",
    hideSexChip: "Afficher la section intimité",
    hideSexChipHint:
      "Affiche l'intimité dans les nouvelles entrées du dashboard et du calendrier.",
    hideSexChipStateOn:
      "Actuellement visible dans le dashboard et dans l'éditeur journalier du calendrier.",
    hideSexChipStateOff:
      "Actuellement masquée dans le dashboard et dans l'éditeur journalier du calendrier.",
    hideNotes: "Afficher la section notes",
    hideNotesHint:
      "Masque les notes dans le dashboard et les entrées du calendrier sans supprimer les notes enregistrées.",
    hideNotesStateOn:
      "Actuellement visible dans le dashboard et dans l'éditeur journalier du calendrier.",
    hideNotesStateOff:
      "Actuellement masquée dans le dashboard et dans l'éditeur journalier du calendrier.",
    temperatureUnit: "Unité TBC",
    temperatureUnitHint: "Utilisée quand le champ TBC est visible.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Enregistrer le suivi",
  },
  reminders: {
    title: "Rappels",
    subtitle:
      "Garde les rappels de l’appareil privés sur cet appareil et utilise des e-mails prudents quand la livraison premium est active.",
    localOnlyHint:
      "Les rappels de l’appareil restent sur cet appareil uniquement. Ils n’envoient pas tes données de santé à un serveur.",
    emailHint:
      "Les e-mails de rappel premium envoient seulement des messages génériques. Ils n’incluent jamais les symptômes, les notes ni des détails fertiles.",
    lockedHint:
      "La livraison premium des rappels nécessite un abonnement Ovumcy Cloud actif sur cet appareil. Tes choix enregistrés restent locaux.",
    timeLabel: "Heure du rappel",
    timeHint:
      "Utilisée pour le rappel quotidien et pour les prochains rappels de cycle planifiés sur cet appareil.",
    emailDelivery: "Envoyer aussi des e-mails de rappel",
    emailDeliveryHint:
      "Utilise l’envoi d’e-mails d’Ovumcy Cloud avec des messages prudents basés sur les types de rappels activés.",
    emailDeliveryStateOn:
      "Les e-mails de rappel Ovumcy Cloud seront synchronisés lorsqu’ils sont disponibles.",
    emailDeliveryStateOff: "Les e-mails de rappel sont désactivés.",
    dailyLog: "Me rappeler de noter aujourd’hui",
    dailyLogHint:
      "Planifie un rappel quotidien pour ouvrir Ovumcy et mettre à jour l’entrée du jour.",
    dailyLogStateOn: "Un rappel quotidien sur l’appareil est activé.",
    dailyLogStateOff:
      "Aucun rappel quotidien de saisie n’est planifié.",
    upcomingPeriod: "Me rappeler avant la prochaine fenêtre de règles",
    upcomingPeriodHint:
      "Planifie un rappel local avant la prochaine fenêtre de règles prédite lorsque les prédictions sont disponibles.",
    upcomingPeriodStateOn:
      "Un rappel avant les prochaines règles est activé.",
    upcomingPeriodStateOff:
      "Aucun rappel avant les prochaines règles n’est planifié.",
    fertileWindow: "Me rappeler avant la fenêtre fertile",
    fertileWindowHint:
      "Planifie un rappel local avant la prochaine fenêtre fertile prédite lorsque les prédictions sont disponibles.",
    fertileWindowStateOn:
      "Un rappel avant la fenêtre fertile est activé.",
    fertileWindowStateOff:
      "Aucun rappel avant la fenêtre fertile n’est planifié.",
    saved: "Les réglages de rappel ont été mis à jour pour cet appareil.",
    savedWithEmail:
      "Les réglages de rappel ont été mis à jour. Les e-mails de rappel Ovumcy Cloud utilisent maintenant des messages prudents.",
    emailUnavailable:
      "Les réglages de rappel ont été enregistrés, mais les e-mails de rappel Ovumcy Cloud sont indisponibles pour le moment.",
    emailSyncFailed:
      "Les réglages de rappel ont été enregistrés, mais les e-mails de rappel Ovumcy Cloud n’ont pas pu être mis à jour pour le moment.",
    permissionDenied:
      "Autorise les notifications dans les réglages de l’appareil pour recevoir les rappels sur cet appareil.",
    unavailable:
      "Cet appareil ne peut pas planifier de rappels locaux pour le moment.",
    errors: {
      invalidTime: "Utilise une heure valide au format HH:MM.",
      saveFailed:
        "Impossible d’enregistrer les réglages de rappel pour le moment. Réessaie.",
    },
  },
  interface: {
    ...settingsCopyEn.interface,
    title: "Interface",
    subtitle:
      "Contrôle la langue et l'apparence de l'app sur cet appareil.",
    languageLabel: "Langue",
    languageHint: "Enregistrée seulement sur cet appareil.",
    previewHint:
      "La langue et le thème se prévisualisent immédiatement. Enregistre pour les conserver sur cet appareil.",
    themeLabel: "Thème",
    themeHint: "Enregistré seulement sur cet appareil.",
    screenCaptureProtectionLabel: "Protéger les captures d’écran",
    screenCaptureProtectionHint:
      "Bloque les captures d’écran et l’aperçu dans le sélecteur d’apps sur les appareils compatibles.",
    screenCaptureProtectionStateOn:
      "Les captures d’écran sont bloquées sur les appareils compatibles.",
    screenCaptureProtectionStateOff:
      "Les captures d’écran et aperçus de l’app peuvent être capturés sur cet appareil.",
    discardChanges: "Annuler les modifications",
    save: "Enregistrer l'interface",
    saveBeforeLeave: "Enregistrer et quitter",
    keepEditing: "Continuer la modification",
    themeLight: "Clair",
    themeDark: "Sombre",
    saved: "Les réglages d'interface ont été mis à jour sur cet appareil.",
    languageSaved: "Langue mise à jour sur cet appareil.",
    themeSaved: "Thème mis à jour sur cet appareil.",
    unsavedPrompt:
      "Tu as des modifications de réglages non enregistrées. Les enregistrer avant de quitter ?",
  },
  account: {
    ...settingsCopyEn.account,
    title: "Sauvegarde et sync",
    subtitle:
      "Protège d'abord cet appareil, puis connecte Ovumcy Cloud ou ton propre serveur de sync.",
    hubSubtitle:
      "Ouvre un écran séparé pour la phrase de récupération, la connexion du compte, le plan cloud et les actions de sync.",
    openHubLabel: "Ouvrir sauvegarde et sync",
    backToSettingsLabel: "Retour aux réglages",
    localStepTitle: "1. Protéger cet appareil",
    localStepHint:
      "Crée une phrase de récupération sur cet appareil. Garde-la hors ligne au cas où tu aurais besoin de restaurer tes données.",
    preparingTitle: "Préparation de ta sauvegarde protégée...",
    preparingHint:
      "Ovumcy génère une phrase de récupération sur cet appareil en ce moment.",
    accountStepTitle: "2. Connecter un compte",
    accountStepHintManaged:
      "Connecte-toi ici à ton compte Ovumcy Cloud. Tes données de santé restent synchronisées séparément sous forme de sauvegarde chiffrée.",
    accountStepHintSelfHosted:
      "Crée ou connecte-toi au compte de ton propre serveur de sync.",
    planStepTitle: "3. Plan cloud",
    planStepHint:
      "L'accès cloud et la facturation sont vérifiés séparément. Le sync s'active seulement quand ce compte a un plan Ovumcy Cloud actif.",
    planSignInFirst:
      "Connecte-toi d'abord pour vérifier l'état de ton abonnement.",
    planUnknown:
      "Ovumcy vérifie si ce compte cloud a un plan actif.",
    planInactive:
      "Ce compte cloud est connecté, mais le sync cloud reste bloqué car aucun plan actif n'a été trouvé.",
    planCheckFailed:
      "Ovumcy n'a pas pu confirmer le plan cloud pour le moment. Réessaie dans un instant.",
    planUnavailable:
      "Ton compte Ovumcy Cloud et la facturation restent séparés du stockage de sync chiffré.",
    planActive: "Ovumcy Cloud est actif pour ce compte.",
    checkPlanAgain: "Revérifier le plan",
    advancedSectionLabel: "Avancé",
    syncStepTitle: "4. Synchroniser cette sauvegarde",
    syncStepHintManaged:
      "Une fois que ce compte cloud a un plan actif, tu peux téléverser ou restaurer la sauvegarde protégée ici.",
    syncStepHintSelfHosted:
      "Après connexion à ton propre serveur, tu pourras téléverser ou restaurer la sauvegarde protégée ici.",
    syncBlockedNoPlan:
      "Le sync cloud reste bloqué tant que ce compte n'a pas un plan Ovumcy Cloud actif.",
    modeLabel: "Mode de sync",
    modeManaged: "Ovumcy Cloud",
    modeSelfHosted: "Self-hosted",
    managedHint:
      "Ovumcy Cloud stocke ta sauvegarde chiffrée sur notre service hébergé. Self-hosted garde le sync sur ton propre serveur.",
    selfHostedHint:
      "Utilise un hôte, une IP:port ou une URL complète. Le http public est refusé ; http localhost et réseau privé sont autorisés.",
    endpointLabel: "Point d'accès du serveur",
    endpointHint: "Nécessaire seulement pour le sync self-hosted.",
    endpointPlaceholder: "sync.example.com ou 192.168.1.20:8080",
    deviceLabel: "Nom de l'appareil",
    deviceHint:
      "Sera affiché plus tard dans les listes d'appareils connectés et les flux de récupération chiffrée.",
    devicePlaceholder: "Entrer un nom d'appareil",
    stateLabel: "Statut de la phrase de récupération",
    stateReady: "Cet appareil a déjà une phrase de récupération.",
    stateMissing: "Cet appareil n'a pas encore de phrase de récupération.",
    connectionLabel: "Session du compte",
    connectionReady: "Cet appareil est connecté à un compte de sync.",
    connectionMissing:
      "Cet appareil n'est pas encore connecté à un compte de sync.",
    lastSyncLabel: "Dernier sync",
    lastSyncNever: "Pas encore synchronisé.",
    modeRowLabel: "Destination",
    endpointRowLabel: "Serveur",
    encryptionRowLabel: "Protection de l'appareil",
    encryptionReady:
      "Les éléments de récupération sont stockés uniquement sur cet appareil.",
    encryptionMissing:
      "Aucune phrase de récupération n'a encore été créée sur cet appareil.",
    loginLabel: "E-mail ou identifiant",
    loginPlaceholder: "owner@example.com",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Saisir le mot de passe",
    recoveryImportTitle:
      "Restaurer l'accès avec une phrase de récupération",
    recoveryImportHint:
      "Utilise cette option quand cet appareil n'a plus de clés locales de sync, mais que tu as encore le mot de passe du compte et la phrase de récupération de 12 mots.",
    recoveryPhraseInputLabel: "Phrase de récupération",
    recoveryPhraseInputPlaceholder: "douze mots séparés par des espaces",
    recoveryPhraseInputHint:
      "Saisis exactement les 12 mots qui protègent ta clé maître de sync.",
    recoverAccessLabel: "Restaurer l'accès",
    registerLabel: "Créer un compte",
    loginActionLabel: "Se connecter",
    syncNowLabel: "Synchroniser maintenant",
    restoreLabel: "Restaurer depuis le serveur",
    disconnectLabel: "Déconnecter",
    restorePrompt:
      "Restaurer la copie de sauvegarde chiffrée depuis le serveur et remplacer les données locales actuelles de cet appareil ?",
    restoreAccept: "Restaurer la sauvegarde",
    restoreDeviceAuthPrompt:
      "Confirme avec la sécurité de l'appareil pour restaurer des données chiffrées depuis le serveur de sync.",
    disconnectPrompt:
      "Déconnecter cet appareil de la session du serveur de sync ? Les clés chiffrées locales resteront sur cet appareil.",
    recoveryTitle: "Phrase de récupération pour cet appareil",
    recoveryHint:
      "Note exactement les 12 mots et garde-les hors ligne. Si tu perds tous les appareils et cette phrase, les données synchronisées ne pourront pas être récupérées.",
    recoveryCodeTitle: "Code de récupération du compte",
    recoveryCodeHint:
      "Conserve ce code en lieu sûr. Il s'affiche une seule fois et permet de réinitialiser le mot de passe de ton compte de sync si tu l'oublies.",
    recoveryNotice:
      "Cet écran affiche la phrase de récupération seulement quand tu prépares ou recrées les clés locales de sync.",
    recoveryShownOnce: "Affichée une seule fois après la génération.",
    recoveryExportLabel: "Exporter en texte",
    prepareLabel: "Créer la phrase de récupération",
    regenerateLabel: "Créer une nouvelle phrase de récupération",
    regeneratePrompt:
      "Recréer les clés locales de sync invalide les anciennes sauvegardes chiffrées tant que tu n'utilises pas la nouvelle phrase de récupération. Continuer ?",
    regenerateAccept: "Créer une nouvelle phrase",
    regenerateDeviceAuthPrompt:
      "Confirme avec la sécurité de l'appareil pour créer une nouvelle phrase de récupération pour cet appareil.",
    discardChangesLabel: "Annuler les modifications",
    saveBeforeLeaveLabel: "Enregistrer et quitter",
    keepEditingLabel: "Continuer la modification",
    unsavedPrompt:
      "Tu as des modifications de sauvegarde et de sync non enregistrées. Les enregistrer avant de quitter cet écran ?",
    prepared: "La phrase de récupération a été créée pour cet appareil.",
    regenerated:
      "Une nouvelle phrase de récupération a été créée pour cet appareil.",
    connected: "Cet appareil est connecté au serveur de sync.",
    connectedNoPlan:
      "Compte cloud connecté. Le sync s'activera quand ce compte aura un plan cloud actif.",
    recovered: "L'accès au sync a été restauré sur cet appareil.",
    uploaded:
      "Copie de sauvegarde chiffrée téléversée vers le serveur de sync.",
    restored:
      "Copie de sauvegarde chiffrée restaurée depuis le serveur de sync.",
    disconnected: "La session du serveur de sync a été supprimée de cet appareil.",
    errors: {
      ...settingsCopyEn.account.errors,
      loginRequired: "L'identifiant est obligatoire.",
      passwordRequired: "Le mot de passe est obligatoire.",
      deviceLabelRequired: "Le nom de l'appareil est obligatoire.",
      endpointRequired: "Saisis un point d'accès du serveur de sync.",
      invalidEndpoint:
        "Saisis un hôte, une adresse IP ou une URL complète valide.",
      unsupportedScheme:
        "Seuls https et les endpoints http approuvés pour le réseau local sont pris en charge.",
      insecurePublicHttp:
        "Les endpoints publics de sync doivent utiliser https.",
      invalidRegistrationInput:
        "Utilise un identifiant valide et un mot de passe plus robuste.",
      registrationFailed:
        "Impossible de créer un compte de sync avec ces informations.",
      invalidCredentials: "Identifiant ou mot de passe invalide.",
      recoveryPhraseRequired: "La phrase de récupération est obligatoire.",
      invalidRecoveryPhrase:
        "Saisis exactement la phrase de récupération de 12 mots.",
      recoveryNotAvailable:
        "Ce serveur de sync ne prend pas en charge l'import par phrase de récupération.",
      recoveryPackageNotFound:
        "Aucun paquet de récupération n'est encore stocké pour ce compte.",
      tooManyDevices:
        "Ce compte a atteint la limite actuelle d'appareils.",
      syncNotPrepared:
        "Prépare d'abord le sync chiffré sur cet appareil.",
      notConnected:
        "Connecte d'abord cet appareil à un serveur de sync.",
      blobNotFound:
        "Aucune copie de sauvegarde chiffrée n'existe encore sur ce serveur.",
      invalidPayload:
        "La copie de sauvegarde chiffrée provenant du serveur n'a pas pu être lue.",
      networkFailed:
        "Impossible d'atteindre le serveur de sync pour le moment.",
      recoveryExportUnavailable:
        "Cet appareil ne peut pas exporter la phrase de récupération pour le moment.",
      recoveryExportFailed:
        "La phrase de récupération n'a pas pu être exportée pour le moment. Réessaie.",
      deviceAuthUnavailable:
        "Configure un code ou la biométrie sur cet appareil avant de recréer les clés locales de sync.",
      deviceAuthFailed:
        "Impossible de confirmer la sécurité de l'appareil pour le moment. Réessaie.",
      saveFailed:
        "Impossible de préparer le sync chiffré pour le moment. Réessaie.",
      syncFailed:
        "Impossible de téléverser la copie de sauvegarde chiffrée pour le moment. Réessaie.",
      restoreFailed:
        "Impossible de restaurer la copie de sauvegarde chiffrée pour le moment. Réessaie.",
    },
  },
  symptoms: {
    ...settingsCopyEn.symptoms,
    title: "Symptômes personnalisés",
    subtitle:
      "Crée des libellés privés et courts pour les schémas que tu veux enregistrer.",
    name: "Nom du symptôme",
    namePlaceholder: "Saisir le nom du symptôme",
    nameHint:
      "Utilise 40 caractères ou moins. Pour plus de détails, utilise les notes.",
    icon: "Icône",
    add: "Ajouter un symptôme",
    save: "Enregistrer le symptôme",
    hide: "Masquer",
    restore: "Restaurer",
    activeHeading: "Visible dans les nouvelles entrées",
    activeHint:
      "Les symptômes personnalisés actifs apparaissent dans le dashboard et le calendrier.",
    activeItem: "Visible dans les nouvelles entrées",
    archivedHeading: "Archivé dans les nouvelles entrées",
    archivedHint:
      "Les anciens enregistrements le conservent. Restaure-en un quand tu veux le revoir dans le sélecteur.",
    archivedItem: "Masqué dans les nouvelles entrées",
    archivedBadge: "Masqué",
    empty:
      "Aucun symptôme personnalisé pour le moment. Ajoute-en un ci-dessus pour l'utiliser dans les nouvelles entrées.",
    emptyActive:
      "Aucun symptôme personnalisé visible pour le moment. Restaure-en un ci-dessous ou ajoute-en un nouveau ci-dessus.",
    created: "Symptôme personnalisé ajouté.",
    updated: "Symptôme personnalisé mis à jour.",
    archived: "Symptôme personnalisé masqué.",
    restored: "Symptôme personnalisé restauré.",
    confirmHide:
      "Masquer ce symptôme personnalisé dans les nouvelles entrées ? Les anciens enregistrements le conserveront.",
    errors: {
      ...settingsCopyEn.symptoms.errors,
      labelRequired: "Le nom est obligatoire.",
      labelTooLong:
        "Utilise 40 caractères ou moins. Pour plus de détails, utilise les notes.",
      labelInvalidCharacters:
        "Utilise uniquement du texte simple. Les chevrons et caractères de contrôle ne sont pas autorisés.",
      duplicateLabel: "Ce nom de symptôme existe déjà dans ta liste.",
      saveFailed:
        "Impossible d'enregistrer ce symptôme pour le moment. Réessaie.",
      notFound:
        "Impossible de retrouver ce symptôme. Recharge les réglages et réessaie.",
    },
  },
  export: {
    ...settingsCopyEn.export,
    title: "Exporter les données",
    subtitle:
      "Crée une sauvegarde locale ou un tableau lisible pour un médecin à partir de tes entrées enregistrées.",
    storageHint:
      "Les exports incluent seulement les enregistrements saisis manuellement. Les prédictions ne sont pas incluses.",
    sensitiveHint:
      "Les fichiers exportés sont sensibles. Enregistre-les et partage-les seulement vers une destination de confiance.",
    pdfCloudOnlyHint:
      "L'export PDF est un avantage Ovumcy Cloud. CSV et JSON restent disponibles localement sur cet appareil.",
    pdfPlanHint:
      "Ce compte Ovumcy Cloud a besoin d'un plan actif pour débloquer l'export PDF.",
    noData:
      "Aucune entrée enregistrée pour le moment. Une fois des jours saisis dans le dashboard ou le calendrier, l'export apparaîtra ici.",
    presetLabel: "Préréglages",
    presetAll: "Toute la période",
    preset30: "30 jours",
    preset90: "90 jours",
    preset365: "365 jours",
    fromLabel: "Du",
    toLabel: "Au",
    summaryTotalTemplate: "Nombre total d'entrées : %d",
    summaryRangeTemplate: "Plage de dates : %s à %s",
    summaryRangeEmpty: "Plage de dates : -",
    csvAction: "Exporter en CSV",
    jsonAction: "Exporter en JSON",
    pdfAction: "Exporter en PDF",
    csvStatus: "L'export CSV est prêt.",
    jsonStatus: "La sauvegarde JSON est prête.",
    pdfStatus: "Le rapport PDF est prêt.",
    errors: {
      ...settingsCopyEn.export.errors,
      invalidFromDate: "Utilise une date de début valide.",
      invalidToDate: "Utilise une date de fin valide.",
      invalidRange:
        "La date de fin doit être postérieure ou égale à la date de début.",
      pdfLocked:
        "L'export PDF est disponible seulement avec un plan Ovumcy Cloud actif.",
      exportFailed:
        "Impossible de préparer ton export pour le moment. Réessaie.",
      deliveryUnavailable:
        "Cet appareil ne peut pas ouvrir la destination d'export pour le moment. Réessaie depuis un navigateur compatible ou un appareil pouvant partager/enregistrer.",
      deliveryFailed:
        "Le fichier a été préparé, mais le partage ou le téléchargement a échoué. Réessaie.",
    },
  },
  danger: {
    ...settingsCopyEn.danger,
    title: "Zone de danger",
    subtitle:
      "Fermer l'app ne supprime pas les données locales. Utilise ceci seulement si tu veux effacer les données de santé de cet appareil.",
    clearTitle: "Effacer toutes les données locales",
    clearSubtitle:
      "Supprime l'onboarding, les réglages du profil, les entrées quotidiennes, les symptômes personnalisés et l'état local d'export, puis renvoie l'app vers l'onboarding.",
    confirmationLabel: "Tape CLEAR pour confirmer",
    confirmationHint:
      "Cette action ne peut pas être annulée depuis l'app. Exporte d'abord une sauvegarde si tu veux conserver tes données.",
    deviceAuthPrompt:
      "Confirme avec la sécurité de l'appareil pour effacer les données locales de cet appareil.",
    action: "Effacer les données locales",
    success: "Données locales effacées. Retour à l'onboarding.",
    invalidConfirmation:
      "Tape exactement CLEAR pour confirmer la suppression des données locales.",
    deviceAuthUnavailable:
      "Configure un code ou la biométrie sur cet appareil avant d'effacer les données locales.",
    deviceAuthFailed:
      "Impossible de confirmer la sécurité de l'appareil pour le moment. Réessaie.",
    failed:
      "Impossible d'effacer les données locales pour le moment. Réessaie.",
  },
  status: {
    ...settingsCopyEn.status,
    cycleSaved:
      "Réglages du cycle enregistrés. Les prédictions ont été mises à jour.",
    trackingSaved:
      "Les champs de suivi ont été mis à jour pour le dashboard et le calendrier.",
    invalidLastPeriodStart:
      "Saisis une date valide de début des dernières règles qui ne soit pas dans le futur.",
    saveFailed:
      "Impossible d'enregistrer tes réglages. Réessaie.",
  },
  premiumLock: {
    eyebrowLabel: "Premium",
    ctaLabel: "Ouvrir Ovumcy Cloud",
    remindersTitle: "Rappels Premium",
    pdfExportTitle: "PDF pour ton médecin",
  },
};

const settingsCopyCatalog: Record<InterfaceLanguage, SettingsCopy> = {
  en: settingsCopyEn,
  ru: {
    title: "Настройки",
    subtitle:
      "Управляйте параметрами цикла, полями трекинга, экспортом и локальным поведением профиля.",
    common: {
      cancelAction: "Отмена",
      confirmAction: "Подтвердить",
      saveChanges: "Сохранить изменения",
      daysShort: "д",
      changeDate: "Выбрать дату",
      clearDate: "Очистить дату",
      notSet: "Не задано",
      saving: "Сохранение...",
    },
    cycle: {
      title: "Параметры цикла",
      cycleLength: "Типичная длина цикла",
      periodLength: "Длительность менструации",
      lastPeriodStart: "Дата начала последней менструации",
      lastPeriodStartHint:
        "Необязательная запасная дата, если в журнале ещё нет отмеченного начала цикла.",
      errorIncompatible:
        "Длительность менструации несовместима с длиной цикла. Менструация не может занимать почти весь цикл.",
      warningApproximate:
        "С такими значениями овуляцию нельзя вычислить надёжно. Предсказание будет приблизительным.",
      infoAdjusted:
        "Длительность менструации была автоматически скорректирована, чтобы до следующего цикла оставалось минимум 10 дней.",
      infoPeriodLong:
        "Длительность более 8 дней может указывать на нерегулярность; обсудите это с врачом.",
      infoCycleLong:
        "Цикл длиннее 45 дней встречается реже; обсудите это с врачом.",
      infoCycleShort:
        "Цикл короче 21 дня встречается реже; обсудите это с врачом.",
      autoPeriodFill: "Автозаполнение дней менструации",
      autoPeriodFillHint:
        "Когда опция включена, отметка первого дня автоматически заполнит следующие дни по длительности менструации.",
      predictionModeLabel: "Режим предсказаний",
      predictionModeHint: "Выберите, как Ovumcy должен показывать предсказания дат.",
      predictionModeRegular: "Обычный",
      predictionModeRegularHint:
        "Показывать стандартные предсказания по настройкам цикла и записанной истории.",
      predictionModeIrregular: "Нерегулярный",
      predictionModeIrregularHint:
        "Оставить предсказания видимыми, но читать их как приблизительный ориентир.",
      predictionModeFactsOnly: "Только факты",
      predictionModeFactsOnlyHint:
        "Отключить предсказания дат и показывать только записанные факты и сохранённые отметки.",
      save: "Сохранить изменения",
    },
    ageGroup: {
      title: "Возрастная группа",
      hint: "Необязательно. Сохраняется в профиле; прогнозы строятся только по вашей истории циклов.",
      under40: "Младше 40",
      age40to45: "40-45",
      age45plus: "45+",
    },
    goal: {
      title: "Цель использования",
      hint: "Необязательно. Это меняет формулировки о фертильных днях в UI, но не алгоритм.",
      avoid: "Избежать беременности",
      trying: "Пытаюсь зачать",
      health: "Отслеживать здоровье",
    },
    tracking: {
      title: "Дополнительный трекинг",
      subtitle:
        "Выберите дополнительные поля для дневных записей. Сохранённые значения останутся в приватной истории.",
      trackBBT: "Показывать поле БТТ",
      trackBBTHint:
        "Показывает поле базальной температуры в dashboard и записях календаря.",
      trackBBTStateOn: "Сейчас видно в dashboard и редакторе дня календаря.",
      trackBBTStateOff: "Сейчас скрыто из новых записей dashboard и календаря.",
      trackCervicalMucus: "Показывать поле цервикальной слизи",
      trackCervicalMucusHint:
        "Показывает варианты цервикальной слизи в dashboard и записях календаря.",
      trackCervicalMucusStateOn:
        "Сейчас видно в dashboard и редакторе дня календаря.",
      trackCervicalMucusStateOff:
        "Сейчас скрыто из новых записей dashboard и календаря.",
      hideSexChip: "Показывать раздел близости",
      hideSexChipHint:
        "Показывает раздел близости в новых записях dashboard и календаря.",
      hideSexChipStateOn:
        "Сейчас видно в dashboard и редакторе дня календаря.",
      hideSexChipStateOff:
        "Сейчас скрыто в dashboard и редакторе дня календаря.",
      hideNotes: "Показывать раздел заметок",
      hideNotesHint:
        "Скрывает заметки в dashboard и записях календаря, не удаляя сохранённые заметки.",
      hideNotesStateOn:
        "Сейчас видно в dashboard и редакторе дня календаря.",
      hideNotesStateOff:
        "Сейчас скрыто в dashboard и редакторе дня календаря.",
      temperatureUnit: "Единица БТТ",
      temperatureUnitHint: "Используется, когда поле БТТ видно.",
      temperatureUnitCelsius: "Цельсий",
      temperatureUnitFahrenheit: "Фаренгейт",
      save: "Сохранить трекинг",
    },
    reminders: {
      title: "Напоминания",
      subtitle:
        "Оставляйте уведомления устройства приватными на этом устройстве и используйте privacy-safe email-подсказки, когда premium-доставка включена.",
      localOnlyHint:
        "Напоминания устройства остаются только на этом устройстве. Данные о здоровье не отправляются на сервер.",
      emailHint:
        "Premium email-напоминания отправляют только общие подсказки. В них никогда не попадают симптомы, заметки или фертильные детали.",
      lockedHint:
        "Premium-доставка напоминаний требует активного плана Ovumcy Cloud на этом устройстве. Сохранённые настройки остаются локально.",
      timeLabel: "Время напоминания",
      timeHint:
        "Используется для ежедневного напоминания и для ближайших запланированных напоминаний по циклу на этом устройстве.",
      emailDelivery: "Также отправлять email-напоминания",
      emailDeliveryHint:
        "Использует email-доставку Ovumcy Cloud с privacy-safe текстом на основе включённых типов напоминаний.",
      emailDeliveryStateOn:
        "Email-напоминания Ovumcy Cloud будут синхронизироваться, когда это доступно.",
      emailDeliveryStateOff: "Email-напоминания выключены.",
      dailyLog: "Напоминать заполнить запись за сегодня",
      dailyLogHint:
        "Планирует ежедневное напоминание открыть Ovumcy и обновить сегодняшнюю запись.",
      dailyLogStateOn:
        "Ежедневное локальное напоминание включено.",
      dailyLogStateOff:
        "Ежедневное напоминание о записи не запланировано.",
      upcomingPeriod: "Напоминать перед следующим окном месячных",
      upcomingPeriodHint:
        "Планирует локальное напоминание перед следующим прогнозируемым окном месячных, когда прогноз доступен.",
      upcomingPeriodStateOn:
        "Напоминание перед следующим окном месячных включено.",
      upcomingPeriodStateOff:
        "Напоминание перед следующим окном месячных не запланировано.",
      fertileWindow: "Напоминать перед фертильным окном",
      fertileWindowHint:
        "Планирует локальное напоминание перед следующим прогнозируемым фертильным окном, когда прогноз доступен.",
      fertileWindowStateOn:
        "Напоминание перед фертильным окном включено.",
      fertileWindowStateOff:
        "Напоминание перед фертильным окном не запланировано.",
      saved: "Настройки напоминаний обновлены для этого устройства.",
      savedWithEmail:
        "Настройки напоминаний обновлены. Email-напоминания Ovumcy Cloud теперь используют privacy-safe подсказки.",
      emailUnavailable:
        "Настройки напоминаний сохранены, но email-напоминания Ovumcy Cloud сейчас недоступны.",
      emailSyncFailed:
        "Настройки напоминаний сохранены, но email-напоминания Ovumcy Cloud сейчас не удалось обновить.",
      permissionDenied:
        "Разрешите уведомления в настройках устройства, чтобы получать напоминания на этом устройстве.",
      unavailable:
        "Сейчас это устройство не может планировать локальные напоминания.",
      errors: {
        invalidTime:
          "Используйте корректное время напоминания в формате HH:MM.",
        saveFailed:
          "Сейчас не удалось сохранить настройки напоминаний. Попробуйте ещё раз.",
      },
    },
    interface: {
      title: "Интерфейс",
      subtitle: "Управляйте языком приложения и темой на этом устройстве.",
      languageLabel: "Язык",
      languageHint: "Сохраняется только на этом устройстве.",
      previewHint:
        "Язык и тема меняются сразу в предпросмотре. Сохраните, чтобы оставить их на этом устройстве.",
      themeLabel: "Тема",
      themeHint: "Сохраняется только на этом устройстве.",
      screenCaptureProtectionLabel: "Защита скриншотов",
      screenCaptureProtectionHint:
        "Блокирует скриншоты и превью приложения в списке недавних на поддерживаемых устройствах.",
      screenCaptureProtectionStateOn:
        "Скриншоты заблокированы на поддерживаемых устройствах.",
      screenCaptureProtectionStateOff:
        "На этом устройстве можно делать скриншоты и получать превью приложения.",
      discardChanges: "Не сохранять",
      save: "Сохранить интерфейс",
      saveBeforeLeave: "Сохранить и выйти",
      keepEditing: "Продолжить редактирование",
      themeLight: "Светлая",
      themeDark: "Тёмная",
      saved: "Настройки интерфейса обновлены для этого устройства.",
      languageSaved: "Язык обновлён для этого устройства.",
      themeSaved: "Тема обновлена для этого устройства.",
      unsavedPrompt:
        "Есть несохранённые изменения в настройках. Сохранить их перед выходом из настроек?",
    },
    account: {
      title: "Резервная копия и sync",
      subtitle:
        "Сначала защитите данные на этом устройстве, затем подключите Ovumcy Cloud или свой sync-сервер.",
      hubSubtitle:
        "Откройте отдельный экран, чтобы увидеть фразу восстановления, подключение аккаунта, cloud-план и действия sync.",
      openHubLabel: "Открыть резервную копию и sync",
      backToSettingsLabel: "Назад в настройки",
      localStepTitle: "1. Защитить это устройство",
      localStepHint:
        "Создайте фразу восстановления на этом устройстве. Храните её офлайн на случай восстановления данных.",
      preparingTitle: "Подготавливаем защищённую копию...",
      preparingHint:
        "Ovumcy сейчас создаёт фразу восстановления на этом устройстве.",
      accountStepTitle: "2. Подключить аккаунт",
      accountStepHintManaged:
        "Войдите здесь в аккаунт Ovumcy Cloud. Данные здоровья всё равно синхронизируются отдельно как зашифрованная копия.",
      accountStepHintSelfHosted:
        "Создайте аккаунт на своём sync-сервере или войдите в уже существующий.",
      planStepTitle: "3. План Ovumcy Cloud",
      planStepHint:
        "Доступ к cloud и billing проверяются отдельно. Sync включится только когда у этого аккаунта будет активный план Ovumcy Cloud.",
      planSignInFirst:
        "Сначала войдите в аккаунт, чтобы проверить статус плана.",
      planUnknown:
        "Ovumcy проверяет, есть ли у этого cloud-аккаунта активный план.",
      planInactive:
        "Этот cloud-аккаунт уже подключён, но cloud sync остаётся заблокированным, потому что активный план не найден.",
      planCheckFailed:
        "Сейчас Ovumcy не смог подтвердить cloud-план. Попробуйте ещё раз через минуту.",
      planUnavailable:
        "Аккаунт Ovumcy Cloud и billing остаются отдельными от зашифрованного sync-хранилища.",
      planActive: "Для этого аккаунта Ovumcy Cloud уже активен.",
      checkPlanAgain: "Проверить план ещё раз",
      advancedSectionLabel: "Дополнительно",
      syncStepTitle: "4. Синхронизировать копию",
      syncStepHintManaged:
        "Когда у этого cloud-аккаунта будет активный план, здесь можно отправить или восстановить защищённую копию.",
      syncStepHintSelfHosted:
        "После входа на свой сервер здесь можно отправить или восстановить защищённую копию.",
      syncBlockedNoPlan:
        "Cloud sync остаётся заблокированным, пока у аккаунта нет активного плана Ovumcy Cloud.",
      modeLabel: "Режим sync",
      modeManaged: "Ovumcy Cloud",
      modeSelfHosted: "Self-hosted",
      managedHint:
        "Ovumcy Cloud хранит вашу зашифрованную копию в нашем hosted-сервисе. Self-hosted оставляет sync на вашем сервере.",
      selfHostedHint:
        "Используйте host, IP:port или полный URL. Публичный http отклоняется; localhost и private-network http разрешены.",
      endpointLabel: "Endpoint сервера",
      endpointHint: "Нужен только для self-hosted sync.",
      endpointPlaceholder: "sync.example.com или 192.168.1.20:8080",
      deviceLabel: "Название устройства",
      deviceHint:
        "Позже будет видно в списках устройств и в зашифрованных recovery-flow.",
      devicePlaceholder: "Введите название устройства",
      stateLabel: "Статус фразы восстановления",
      stateReady: "На этом устройстве уже есть фраза восстановления.",
      stateMissing: "На этом устройстве ещё нет фразы восстановления.",
      connectionLabel: "Сессия аккаунта",
      connectionReady: "Это устройство уже вошло в sync-аккаунт.",
      connectionMissing: "Это устройство ещё не вошло в sync-аккаунт.",
      lastSyncLabel: "Последний sync",
      lastSyncNever: "Синхронизации ещё не было.",
      modeRowLabel: "Назначение",
      endpointRowLabel: "Сервер",
      encryptionRowLabel: "Защита устройства",
      encryptionReady: "Recovery-материалы хранятся только на этом устройстве.",
      encryptionMissing: "Фраза восстановления на этом устройстве ещё не создана.",
      loginLabel: "Email или логин",
      loginPlaceholder: "owner@example.com",
      passwordLabel: "Пароль",
      passwordPlaceholder: "Введите пароль",
      recoveryImportTitle: "Восстановить доступ по фразе восстановления",
      recoveryImportHint:
        "Используйте это, если на устройстве больше нет локальных sync keys, но у вас остались пароль аккаунта и фраза восстановления из 12 слов.",
      recoveryPhraseInputLabel: "Фраза восстановления",
      recoveryPhraseInputPlaceholder: "двенадцать слов через пробел",
      recoveryPhraseInputHint:
        "Введите все 12 слов точно так, как они защищают ваш sync master key.",
      recoverAccessLabel: "Восстановить доступ",
      registerLabel: "Создать аккаунт",
      loginActionLabel: "Войти",
      syncNowLabel: "Синхронизировать сейчас",
      restoreLabel: "Восстановить с сервера",
      disconnectLabel: "Отключить",
      restorePrompt:
        "Восстановить зашифрованную резервную копию с сервера и заменить текущие локальные данные на этом устройстве?",
      restoreAccept: "Восстановить копию",
      restoreDeviceAuthPrompt:
        "Подтвердите защитой устройства восстановление зашифрованных данных с sync-сервера.",
      disconnectPrompt:
        "Отключить это устройство от сессии sync-сервера? Локальные зашифрованные ключи останутся на устройстве.",
      recoveryTitle: "Фраза восстановления для этого устройства",
      recoveryHint:
        "Запишите все 12 слов точно и храните их офлайн. Если вы потеряете все устройства и эту фразу, synced data восстановить нельзя.",
      recoveryNotice:
        "Этот экран показывает фразу восстановления только когда вы подготавливаете или пересоздаёте локальные sync keys.",
      recoveryShownOnce: "Показывается только один раз после генерации.",
      recoveryCodeTitle: "Код восстановления аккаунта",
      recoveryCodeHint:
        "Сохраните этот код в надёжном месте. Он показывается только один раз и позволяет сбросить пароль вашего sync-аккаунта, если вы его забудете.",
      recoveryExportLabel: "Экспортировать как текст",
      prepareLabel: "Создать фразу восстановления",
      regenerateLabel: "Создать новую фразу восстановления",
      regeneratePrompt:
        "Пересоздание локальных sync keys делает старые зашифрованные sync backup'ы недоступными, пока вы не используете новую фразу восстановления. Продолжить?",
      regenerateAccept: "Создать новую фразу",
      regenerateDeviceAuthPrompt:
        "Подтвердите защитой устройства создание новой фразы восстановления для этого устройства.",
      discardChangesLabel: "Не сохранять",
      saveBeforeLeaveLabel: "Сохранить и выйти",
      keepEditingLabel: "Продолжить редактирование",
      unsavedPrompt:
        "Есть несохранённые изменения в резервной копии и sync. Сохранить их перед выходом с экрана?",
      prepared: "Фраза восстановления создана для этого устройства.",
      regenerated: "Для этого устройства создана новая фраза восстановления.",
      connected: "Это устройство подключено к sync-серверу.",
      connectedNoPlan:
        "Cloud-аккаунт подключён. Sync включится, когда у аккаунта появится активный cloud-план.",
      recovered: "Доступ к sync восстановлен на этом устройстве.",
      uploaded: "Зашифрованная резервная копия отправлена на sync-сервер.",
      restored: "Зашифрованная резервная копия восстановлена с sync-сервера.",
      disconnected: "Сессия sync-сервера удалена с этого устройства.",
      errors: {
        loginRequired: "Логин обязателен.",
        passwordRequired: "Пароль обязателен.",
        deviceLabelRequired: "Название устройства обязательно.",
        endpointRequired: "Введите endpoint sync-сервера.",
        invalidEndpoint: "Введите корректный host, IP-адрес или полный URL.",
        unsupportedScheme:
          "Поддерживаются только https и разрешённые local-network http endpoint.",
        insecurePublicHttp: "Публичные sync endpoint должны использовать https.",
        invalidRegistrationInput:
          "Используйте корректный логин и более надёжный пароль.",
        registrationFailed: "Не удалось создать sync-аккаунт с этими данными.",
        invalidCredentials: "Неверный логин или пароль.",
        recoveryPhraseRequired: "Фраза восстановления обязательна.",
        invalidRecoveryPhrase:
          "Введите точную фразу восстановления из 12 слов.",
        recoveryNotAvailable:
          "Этот sync-сервер не поддерживает импорт по фразе восстановления.",
        recoveryPackageNotFound:
          "Для этого аккаунта ещё не сохранён recovery package.",
        tooManyDevices: "Для этого аккаунта уже достигнут лимит устройств.",
        syncNotPrepared: "Сначала подготовьте зашифрованный sync на этом устройстве.",
        notConnected: "Сначала подключите это устройство к sync-серверу.",
        blobNotFound:
          "На этом сервере ещё нет зашифрованной резервной копии.",
        invalidPayload:
          "Не удалось прочитать зашифрованную резервную копию, полученную с сервера.",
        networkFailed: "Сейчас не удаётся связаться с sync-сервером.",
        recoveryExportUnavailable:
          "Сейчас это устройство не может экспортировать фразу восстановления.",
        recoveryExportFailed:
          "Сейчас не удалось экспортировать фразу восстановления. Попробуйте ещё раз.",
        deviceAuthUnavailable:
          "Перед пересозданием локальных sync keys настройте код-пароль или биометрию на устройстве.",
        deviceAuthFailed:
          "Сейчас не удалось подтвердить защиту устройства. Попробуйте ещё раз.",
        saveFailed:
          "Сейчас не удалось подготовить зашифрованный sync. Попробуйте ещё раз.",
        syncFailed:
          "Сейчас не удалось отправить зашифрованную резервную копию. Попробуйте ещё раз.",
        restoreFailed:
          "Сейчас не удалось восстановить зашифрованную резервную копию. Попробуйте ещё раз.",
      },
    },
    symptoms: {
      title: "Пользовательские симптомы",
      subtitle: "Создавайте короткие приватные названия для паттернов, которые хотите отмечать.",
      name: "Название симптома",
      namePlaceholder: "Введите название симптома",
      nameHint: "Используйте не более 40 символов. Для длинных деталей используйте заметки.",
      icon: "Иконка",
      add: "Добавить симптом",
      save: "Сохранить симптом",
      hide: "Скрыть",
      restore: "Восстановить",
      activeHeading: "Видно в новых записях",
      activeHint: "Активные пользовательские симптомы появляются в dashboard и календаре.",
      activeItem: "Видно в новых записях",
      archivedHeading: "Скрыто из новых записей",
      archivedHint: "Старые записи сохранят их. Восстановите симптом, когда захотите вернуть его в picker.",
      archivedItem: "Скрыто из новых записей",
      archivedBadge: "Скрыто",
      empty: "Пока нет пользовательских симптомов. Добавьте один выше, чтобы он появился в новых записях.",
      emptyActive:
        "Сейчас нет видимых пользовательских симптомов. Восстановите один ниже или добавьте новый выше.",
      created: "Пользовательский симптом добавлен.",
      updated: "Пользовательский симптом обновлён.",
      archived: "Пользовательский симптом скрыт.",
      restored: "Пользовательский симптом восстановлен.",
      confirmHide:
        "Скрыть этот симптом из новых записей? Прошлые записи его сохранят.",
      errors: {
        labelRequired: "Название обязательно.",
        labelTooLong:
          "Используйте не более 40 символов. Для длинных деталей используйте заметки.",
        labelInvalidCharacters:
          "Используйте только обычный текст. Угловые скобки и управляющие символы запрещены.",
        duplicateLabel: "Такое название уже есть в вашем списке.",
        saveFailed: "Сейчас не удалось сохранить симптом. Попробуйте ещё раз.",
        notFound: "Этот симптом больше не найден. Перезагрузите настройки и попробуйте снова.",
      },
    },
    export: {
      title: "Экспорт данных",
      subtitle:
        "Создайте локальный бэкап или дружественную для врача таблицу по записанным дням.",
      storageHint:
        "Экспорт включает только вручную записанные данные. Предсказания не включаются.",
      sensitiveHint:
        "Экспортированные файлы чувствительны. Сохраняйте и отправляйте их только туда, где доверяете устройству или получателю.",
      pdfCloudOnlyHint:
        "PDF-экспорт относится к плюшкам Ovumcy Cloud. CSV и JSON по-прежнему доступны локально на этом устройстве.",
      pdfPlanHint:
        "Для этого аккаунта Ovumcy Cloud нужен активный план, чтобы открыть PDF-экспорт.",
      noData:
        "Пока нет записанных дней. После записей в dashboard или календаре экспорт станет доступен здесь.",
      presetLabel: "Пресеты",
      presetAll: "За всё время",
      preset30: "30 дней",
      preset90: "90 дней",
      preset365: "365 дней",
      fromLabel: "Дата начала",
      toLabel: "Дата конца",
      datePlaceholder: "ГГГГ-ММ-ДД",
      summaryTotalTemplate: "Всего записей: %d",
      summaryRangeTemplate: "Диапазон дат: %s — %s",
      summaryRangeEmpty: "Диапазон дат: -",
      csvAction: "Экспорт CSV",
      jsonAction: "Экспорт JSON",
      pdfAction: "Экспорт PDF",
      csvStatus: "CSV-экспорт готов.",
      jsonStatus: "JSON-бэкап готов.",
      pdfStatus: "PDF-отчёт готов.",
      errors: {
        invalidFromDate: "Введите корректную начальную дату.",
        invalidToDate: "Введите корректную конечную дату.",
        invalidRange: "Дата окончания должна быть не раньше даты начала.",
        pdfLocked:
          "PDF-экспорт доступен только при активном плане Ovumcy Cloud.",
        exportFailed: "Не удалось подготовить экспорт. Попробуйте ещё раз.",
        deliveryUnavailable:
          "Это устройство сейчас не может открыть экспорт. Попробуйте из поддерживаемого браузера или на устройстве с share/save.",
        deliveryFailed:
          "Файл был подготовлен, но download или share завершился неудачно. Попробуйте ещё раз.",
      },
    },
    danger: {
      title: "Опасная зона",
      subtitle:
        "Закрытие приложения не очищает локальные данные. Используйте это только если хотите удалить локальные health records с устройства.",
      clearTitle: "Очистить все локальные данные",
      clearSubtitle:
        "Удаляет onboarding, настройки профиля, дневные записи, пользовательские симптомы и локальное состояние экспорта, затем возвращает приложение в onboarding.",
      confirmationLabel: "Введите CLEAR для подтверждения",
      confirmationPlaceholder: "CLEAR",
      confirmationHint:
        "Это действие нельзя отменить из приложения. Сначала экспортируйте бэкап, если хотите сохранить записи.",
      deviceAuthPrompt:
        "Подтвердите защитой устройства удаление локальных данных с этого устройства.",
      action: "Очистить локальные данные",
      success: "Локальные данные очищены. Возвращаемся в onboarding.",
      invalidConfirmation: "Введите CLEAR точно, чтобы подтвердить удаление локальных данных.",
      deviceAuthUnavailable:
        "Перед очисткой локальных данных настройте код-пароль или биометрию на устройстве.",
      deviceAuthFailed:
        "Сейчас не удалось подтвердить защиту устройства. Попробуйте ещё раз.",
      failed:
        "Сейчас не удалось очистить локальные данные. Попробуйте ещё раз.",
    },
    status: {
      cycleSaved: "Настройки цикла сохранены. Предсказания обновлены.",
      trackingSaved: "Поля трекинга обновлены для dashboard и календаря.",
      invalidLastPeriodStart:
        "Введите корректную дату начала последней менструации, не в будущем.",
      saveFailed: "Не удалось сохранить настройки. Попробуйте ещё раз.",
    },
    premiumLock: {
      eyebrowLabel: "Премиум",
      ctaLabel: "Открыть Ovumcy Cloud",
      remindersTitle: "Премиум-напоминания",
      pdfExportTitle: "PDF для врача",
    },
  },
  es: {
    title: "Ajustes",
    subtitle:
      "Gestiona parámetros del ciclo, campos de seguimiento, acciones de exportación y el comportamiento local del perfil.",
    common: {
      cancelAction: "Cancelar",
      confirmAction: "Confirmar",
      saveChanges: "Guardar cambios",
      daysShort: "d",
      changeDate: "Elegir fecha",
      clearDate: "Borrar fecha",
      notSet: "Sin definir",
      saving: "Guardando...",
    },
    cycle: {
      title: "Parámetros del ciclo",
      cycleLength: "Duración habitual del ciclo",
      periodLength: "Duración del período",
      lastPeriodStart: "Fecha de inicio del último período",
      lastPeriodStartHint:
        "Referencia opcional si tu diario todavía no tiene un inicio de ciclo marcado.",
      errorIncompatible:
        "La duración del período es incompatible con la duración del ciclo. La menstruación no puede ocupar casi todo el ciclo.",
      warningApproximate:
        "Con estos valores no se puede calcular la ovulación con fiabilidad. La predicción será aproximada.",
      infoAdjusted:
        "La duración del período se ajustó automáticamente para que queden al menos 10 días antes del siguiente ciclo.",
      infoPeriodLong:
        "Una duración superior a 8 días puede indicar irregularidades; coméntalo con un médico.",
      infoCycleLong:
        "Un ciclo de más de 45 días es menos común; coméntalo con un médico.",
      infoCycleShort:
        "Un ciclo de menos de 21 días es menos común; coméntalo con un médico.",
      autoPeriodFill: "Autocompletar días de período",
      autoPeriodFillHint:
        "Cuando está activado, marcar el primer día completa automáticamente los siguientes días según la duración del período.",
      predictionModeLabel: "Modo de predicción",
      predictionModeHint: "Elige cómo debe mostrar Ovumcy las predicciones de fechas.",
      predictionModeRegular: "Normal",
      predictionModeRegularHint:
        "Muestra la vista estándar de predicción según tus ajustes del ciclo y tu historial.",
      predictionModeIrregular: "Irregular",
      predictionModeIrregularHint:
        "Mantén visibles las predicciones, pero léelas como una guía aproximada.",
      predictionModeFactsOnly: "Solo hechos",
      predictionModeFactsOnlyHint:
        "Desactiva las predicciones de fechas y muestra solo hechos registrados y marcadores guardados.",
      save: "Guardar cambios",
    },
    ageGroup: {
      title: "Grupo de edad",
      hint: "Opcional. Se guarda con tu perfil; las predicciones usan solo tu propio historial de ciclos.",
      under40: "Menos de 40",
      age40to45: "40-45",
      age45plus: "45+",
    },
    goal: {
      title: "Objetivo de uso",
      hint: "Opcional. Esto cambia cómo se explican los días fértiles en la UI. No cambia el algoritmo.",
      avoid: "Evitar embarazo",
      trying: "Intentar concebir",
      health: "Seguir mi salud",
    },
    tracking: {
      title: "Seguimiento adicional",
      subtitle:
        "Elige campos extra para el registro diario. Los valores guardados siguen en tu historial privado.",
      trackBBT: "Mostrar campo de TCB",
      trackBBTHint:
        "Muestra un campo de temperatura basal en dashboard y calendario.",
      trackBBTStateOn: "Actualmente visible en el dashboard y en el editor diario del calendario.",
      trackBBTStateOff: "Actualmente oculto de las nuevas entradas del dashboard y del calendario.",
      trackCervicalMucus: "Mostrar campo de moco cervical",
      trackCervicalMucusHint:
        "Muestra opciones de moco cervical en dashboard y calendario.",
      trackCervicalMucusStateOn:
        "Actualmente visible en el dashboard y en el editor diario del calendario.",
      trackCervicalMucusStateOff:
        "Actualmente oculto de las nuevas entradas del dashboard y del calendario.",
      hideSexChip: "Mostrar sección de intimidad",
      hideSexChipHint:
        "Muestra la sección de intimidad en nuevas entradas del dashboard y del calendario.",
      hideSexChipStateOn:
        "Actualmente visible en el dashboard y en el editor diario del calendario.",
      hideSexChipStateOff:
        "Actualmente oculta en el dashboard y en el editor diario del calendario.",
      hideNotes: "Mostrar sección de notas",
      hideNotesHint:
        "Oculta las notas en el dashboard y en las entradas del calendario sin borrar las notas guardadas.",
      hideNotesStateOn:
        "Actualmente visible en el dashboard y en el editor diario del calendario.",
      hideNotesStateOff:
        "Actualmente oculta en el dashboard y en el editor diario del calendario.",
      temperatureUnit: "Unidad de TCB",
      temperatureUnitHint: "Se usa cuando el campo de TCB está visible.",
      temperatureUnitCelsius: "Celsius",
      temperatureUnitFahrenheit: "Fahrenheit",
      save: "Guardar seguimiento",
    },
    reminders: {
      title: "Recordatorios",
      subtitle:
        "Mantén privadas las notificaciones del dispositivo y usa avisos por correo respetuosos con la privacidad cuando la entrega premium esté activa.",
      localOnlyHint:
        "Los recordatorios del dispositivo se quedan solo en este dispositivo. No envían tus datos de salud a un servidor.",
      emailHint:
        "Los correos premium de recordatorio envían solo avisos genéricos. Nunca incluyen síntomas, notas ni detalles fértiles.",
      lockedHint:
        "La entrega premium de recordatorios necesita un plan activo de Ovumcy Cloud en este dispositivo. Tus opciones guardadas siguen siendo locales.",
      timeLabel: "Hora del recordatorio",
      timeHint:
        "Se usa para el recordatorio diario y para los próximos recordatorios del ciclo programados en este dispositivo.",
      emailDelivery: "Enviar también correos de recordatorio",
      emailDeliveryHint:
        "Usa el envío por correo de Ovumcy Cloud con avisos respetuosos con la privacidad según los tipos de recordatorio activados.",
      emailDeliveryStateOn:
        "Los correos de recordatorio de Ovumcy Cloud se sincronizarán cuando estén disponibles.",
      emailDeliveryStateOff: "Los correos de recordatorio están desactivados.",
      dailyLog: "Recuérdame registrar hoy",
      dailyLogHint:
        "Programa un recordatorio diario para abrir Ovumcy y actualizar la entrada de hoy.",
      dailyLogStateOn:
        "Hay un recordatorio diario del dispositivo activado.",
      dailyLogStateOff:
        "No hay recordatorio diario de registro programado.",
      upcomingPeriod: "Recuérdame antes de la próxima ventana del período",
      upcomingPeriodHint:
        "Programa un recordatorio local antes de la próxima ventana de período prevista cuando haya predicciones disponibles.",
      upcomingPeriodStateOn:
        "Un recordatorio antes del próximo período está activado.",
      upcomingPeriodStateOff:
        "No hay recordatorio antes del próximo período programado.",
      fertileWindow: "Recuérdame antes de la ventana fértil",
      fertileWindowHint:
        "Programa un recordatorio local antes de la próxima ventana fértil prevista cuando haya predicciones disponibles.",
      fertileWindowStateOn:
        "Un recordatorio antes de la ventana fértil está activado.",
      fertileWindowStateOff:
        "No hay recordatorio antes de la ventana fértil programado.",
      saved: "Los ajustes de recordatorios se actualizaron para este dispositivo.",
      savedWithEmail:
        "Los ajustes de recordatorios se actualizaron. Los correos de Ovumcy Cloud ahora usan avisos respetuosos con la privacidad.",
      emailUnavailable:
        "Los ajustes de recordatorios se guardaron, pero los correos de Ovumcy Cloud no están disponibles ahora mismo.",
      emailSyncFailed:
        "Los ajustes de recordatorios se guardaron, pero no se pudieron actualizar los correos de Ovumcy Cloud ahora mismo.",
      permissionDenied:
        "Permite las notificaciones en los ajustes del dispositivo para recibir recordatorios en este dispositivo.",
      unavailable:
        "Este dispositivo no puede programar recordatorios locales ahora mismo.",
      errors: {
        invalidTime:
          "Usa una hora válida para el recordatorio con formato HH:MM.",
        saveFailed:
          "No se pudieron guardar los ajustes de recordatorios ahora. Inténtalo de nuevo.",
      },
    },
    interface: {
      title: "Interfaz",
      subtitle: "Controla el idioma y la apariencia de la app en este dispositivo.",
      languageLabel: "Idioma",
      languageHint: "Se guarda solo en este dispositivo.",
      previewHint:
        "Idioma y tema se previsualizan al instante. Guarda para conservarlos en este dispositivo.",
      themeLabel: "Tema",
      themeHint: "Se guarda solo en este dispositivo.",
      screenCaptureProtectionLabel: "Proteger capturas de pantalla",
      screenCaptureProtectionHint:
        "Bloquea capturas de pantalla y la vista previa en apps recientes en dispositivos compatibles.",
      screenCaptureProtectionStateOn:
        "Las capturas de pantalla están bloqueadas en dispositivos compatibles.",
      screenCaptureProtectionStateOff:
        "Las capturas y vistas previas de la app se pueden capturar en este dispositivo.",
      discardChanges: "Descartar cambios",
      save: "Guardar interfaz",
      saveBeforeLeave: "Guardar y salir",
      keepEditing: "Seguir editando",
      themeLight: "Claro",
      themeDark: "Oscuro",
      saved: "La interfaz se actualizó para este dispositivo.",
      languageSaved: "Idioma actualizado para este dispositivo.",
      themeSaved: "Tema actualizado para este dispositivo.",
      unsavedPrompt:
        "Hay cambios de ajustes sin guardar. ¿Quieres guardarlos antes de salir de ajustes?",
    },
    account: {
      title: "Copia y sync",
      subtitle:
        "Primero protege este dispositivo y luego conecta Ovumcy Cloud o tu propio servidor de sync.",
      hubSubtitle:
        "Abre una pantalla separada para ver la frase de recuperación, la conexión de la cuenta, el plan cloud y las acciones de sync.",
      openHubLabel: "Abrir copia y sync",
      backToSettingsLabel: "Volver a ajustes",
      localStepTitle: "1. Proteger este dispositivo",
      localStepHint:
        "Crea una frase de recuperación en este dispositivo. Guárdala fuera de línea por si alguna vez necesitas restaurar tus datos.",
      preparingTitle: "Preparando tu copia protegida...",
      preparingHint:
        "Ovumcy está creando una frase de recuperación en este dispositivo.",
      accountStepTitle: "2. Conectar una cuenta",
      accountStepHintManaged:
        "Inicia sesión aquí con tu cuenta de Ovumcy Cloud. Tus datos de salud siguen sincronizándose aparte como copia cifrada.",
      accountStepHintSelfHosted:
        "Crea o inicia sesión en la cuenta de tu propio servidor de sync.",
      planStepTitle: "3. Plan de Ovumcy Cloud",
      planStepHint:
        "El acceso cloud y la facturación se comprueban por separado. El sync solo se activa cuando esta cuenta tiene un plan activo de Ovumcy Cloud.",
      planSignInFirst:
        "Inicia sesión primero para comprobar el estado de tu plan.",
      planUnknown:
        "Ovumcy está comprobando si esta cuenta cloud tiene un plan activo.",
      planInactive:
        "Esta cuenta cloud ha iniciado sesión, pero el sync cloud sigue bloqueado porque no se encontró un plan activo.",
      planCheckFailed:
        "Ovumcy no pudo confirmar el plan cloud en este momento. Vuelve a intentarlo enseguida.",
      planUnavailable:
        "Tu cuenta de Ovumcy Cloud y la facturación permanecen separadas del almacenamiento de sync cifrado.",
      planActive: "Ovumcy Cloud está activo para esta cuenta.",
      checkPlanAgain: "Comprobar el plan de nuevo",
      advancedSectionLabel: "Avanzado",
      syncStepTitle: "4. Sincronizar esta copia",
      syncStepHintManaged:
        "Cuando esta cuenta cloud tenga un plan activo, aquí podrás subir o restaurar la copia protegida.",
      syncStepHintSelfHosted:
        "Después de iniciar sesión en tu propio servidor, aquí podrás subir o restaurar la copia protegida.",
      syncBlockedNoPlan:
        "El sync cloud sigue bloqueado hasta que esta cuenta tenga un plan activo de Ovumcy Cloud.",
      modeLabel: "Modo de sync",
      modeManaged: "Ovumcy Cloud",
      modeSelfHosted: "Self-hosted",
      managedHint:
        "Ovumcy Cloud guarda tu copia cifrada en nuestro servicio hospedado. Self-hosted mantiene el sync en tu propio servidor.",
      selfHostedHint:
        "Usa un host, IP:puerto o URL completa. El http público se rechaza; localhost y redes privadas sí se permiten.",
      endpointLabel: "Endpoint del servidor",
      endpointHint: "Solo es necesario para sync self-hosted.",
      endpointPlaceholder: "sync.example.com o 192.168.1.20:8080",
      deviceLabel: "Etiqueta del dispositivo",
      deviceHint:
        "Más tarde aparecerá en las listas de dispositivos conectados y en los flujos de recuperación cifrada.",
      devicePlaceholder: "Introduce el nombre del dispositivo",
      stateLabel: "Estado de la frase de recuperación",
      stateReady: "Este dispositivo ya tiene una frase de recuperación.",
      stateMissing: "Este dispositivo todavía no tiene una frase de recuperación.",
      connectionLabel: "Sesión de la cuenta",
      connectionReady: "Este dispositivo ya inició sesión en una cuenta de sync.",
      connectionMissing: "Este dispositivo todavía no ha iniciado sesión en una cuenta de sync.",
      lastSyncLabel: "Último sync",
      lastSyncNever: "Todavía no se ha sincronizado.",
      modeRowLabel: "Destino",
      endpointRowLabel: "Servidor",
      encryptionRowLabel: "Protección del dispositivo",
      encryptionReady: "Los materiales de recuperación se guardan solo en este dispositivo.",
      encryptionMissing: "Todavía no se ha creado una frase de recuperación en este dispositivo.",
      loginLabel: "Correo o usuario",
      loginPlaceholder: "owner@example.com",
      passwordLabel: "Contraseña",
      passwordPlaceholder: "Introduce la contraseña",
      recoveryImportTitle: "Restaurar acceso con una frase de recuperación",
      recoveryImportHint:
        "Úsalo cuando este dispositivo ya no tenga claves locales de sync, pero todavía conserves la contraseña de la cuenta y la frase de recuperación de 12 palabras.",
      recoveryPhraseInputLabel: "Frase de recuperación",
      recoveryPhraseInputPlaceholder: "doce palabras separadas por espacios",
      recoveryPhraseInputHint:
        "Introduce exactamente las 12 palabras que protegen tu clave maestra de sync.",
      recoverAccessLabel: "Restaurar acceso",
      registerLabel: "Crear cuenta",
      loginActionLabel: "Iniciar sesión",
      syncNowLabel: "Sincronizar ahora",
      restoreLabel: "Restaurar desde el servidor",
      disconnectLabel: "Desconectar",
      restorePrompt:
        "¿Restaurar la instantánea cifrada desde el servidor y sustituir los datos locales actuales de este dispositivo?",
      restoreAccept: "Restaurar instantánea",
      restoreDeviceAuthPrompt:
        "Confirma con la seguridad del dispositivo para restaurar datos cifrados desde el servidor de sync.",
      disconnectPrompt:
        "¿Desconectar este dispositivo de la sesión del servidor de sync? Las claves cifradas locales permanecerán en este dispositivo.",
      recoveryTitle: "Frase de recuperación de este dispositivo",
      recoveryHint:
        "Escribe exactamente las 12 palabras y guárdalas fuera de línea. Si pierdes todos los dispositivos y esta frase, no se podrán recuperar los datos sincronizados.",
      recoveryNotice:
        "Esta pantalla muestra la frase de recuperación solo cuando preparas o recreas las claves locales de sync.",
      recoveryShownOnce: "Se muestra solo una vez después de generarse.",
      recoveryExportLabel: "Exportar como texto",
      recoveryCodeTitle: "Código de recuperación de la cuenta",
      recoveryCodeHint:
        "Guarda este código en un lugar seguro. Se muestra solo una vez y te permite restablecer la contraseña de tu cuenta de sync si la olvidas.",
      prepareLabel: "Crear frase de recuperación",
      regenerateLabel: "Crear una nueva frase de recuperación",
      regeneratePrompt:
        "Recrear las claves locales de sync invalida las copias cifradas antiguas hasta que uses la nueva frase de recuperación. ¿Continuar?",
      regenerateAccept: "Crear nueva frase",
      regenerateDeviceAuthPrompt:
        "Confirma con la seguridad del dispositivo para crear una nueva frase de recuperación para este dispositivo.",
      discardChangesLabel: "Descartar cambios",
      saveBeforeLeaveLabel: "Guardar y salir",
      keepEditingLabel: "Seguir editando",
      unsavedPrompt:
        "Hay cambios de copia y sync sin guardar. ¿Quieres guardarlos antes de salir de esta pantalla?",
      prepared: "La frase de recuperación quedó creada para este dispositivo.",
      regenerated: "Se creó una nueva frase de recuperación para este dispositivo.",
      connected: "Este dispositivo quedó conectado al servidor de sync.",
      connectedNoPlan:
        "La cuenta cloud quedó conectada. El sync se activará cuando esta cuenta tenga un plan cloud activo.",
      recovered: "El acceso de sync quedó restaurado en este dispositivo.",
      uploaded:
        "La copia de respaldo cifrada se subió al servidor de sync.",
      restored:
        "La copia de respaldo cifrada se restauró desde el servidor de sync.",
      disconnected: "La sesión del servidor de sync se eliminó de este dispositivo.",
      errors: {
        loginRequired: "El login es obligatorio.",
        passwordRequired: "La contraseña es obligatoria.",
        deviceLabelRequired: "La etiqueta del dispositivo es obligatoria.",
        endpointRequired: "Introduce un endpoint del servidor de sync.",
        invalidEndpoint: "Introduce un host, una IP o una URL completa válidos.",
        unsupportedScheme:
          "Solo se admiten https y endpoints http aprobados para red local.",
        insecurePublicHttp: "Los endpoints públicos de sync deben usar https.",
        invalidRegistrationInput:
          "Usa un login válido y una contraseña más fuerte.",
        registrationFailed:
          "No se pudo crear una cuenta de sync con estos datos.",
        invalidCredentials: "Login o contraseña no válidos.",
        recoveryPhraseRequired: "La frase de recuperación es obligatoria.",
        invalidRecoveryPhrase:
          "Introduce la frase de recuperación exacta de 12 palabras.",
        recoveryNotAvailable:
          "Este servidor de sync no admite importar con frase de recuperación.",
        recoveryPackageNotFound:
          "Todavía no hay ningún paquete de recuperación guardado para esta cuenta.",
        tooManyDevices: "Esta cuenta ya alcanzó el límite actual de dispositivos.",
        syncNotPrepared:
          "Primero prepara el sync cifrado en este dispositivo.",
        notConnected:
          "Primero conecta este dispositivo a un servidor de sync.",
        blobNotFound:
          "Todavía no existe una copia de respaldo cifrada en este servidor.",
        invalidPayload:
          "No se pudo leer la copia de respaldo cifrada recibida del servidor.",
        networkFailed:
          "No se puede alcanzar el servidor de sync ahora mismo.",
        recoveryExportUnavailable:
          "Este dispositivo no puede exportar la frase de recuperación ahora mismo.",
        recoveryExportFailed:
          "No se pudo exportar la frase de recuperación ahora mismo. Inténtalo de nuevo.",
        deviceAuthUnavailable:
          "Configura un código o biometría en este dispositivo antes de recrear las claves locales de sync.",
        deviceAuthFailed:
          "No se pudo confirmar la seguridad del dispositivo ahora mismo. Inténtalo de nuevo.",
        saveFailed:
          "No se pudo preparar el sync cifrado ahora. Inténtalo de nuevo.",
        syncFailed:
          "No se pudo subir la copia de respaldo cifrada ahora. Inténtalo de nuevo.",
        restoreFailed:
          "No se pudo restaurar la copia de respaldo cifrada ahora. Inténtalo de nuevo.",
      },
    },
    symptoms: {
      title: "Síntomas personalizados",
      subtitle: "Crea etiquetas privadas y cortas para patrones que quieras registrar.",
      name: "Nombre del síntoma",
      namePlaceholder: "Escribe el nombre del síntoma",
      nameHint: "Usa 40 caracteres o menos. Para detalles largos, usa notas.",
      icon: "Icono",
      add: "Añadir síntoma",
      save: "Guardar síntoma",
      hide: "Ocultar",
      restore: "Restaurar",
      activeHeading: "Visible en nuevas entradas",
      activeHint: "Los síntomas personalizados activos aparecen en dashboard y calendario.",
      activeItem: "Visible en nuevas entradas",
      archivedHeading: "Archivado en nuevas entradas",
      archivedHint: "Los registros pasados los mantienen. Restaura uno cuando quieras devolverlo al selector.",
      archivedItem: "Oculto en nuevas entradas",
      archivedBadge: "Oculto",
      empty: "Todavía no hay síntomas personalizados. Añade uno arriba para usarlo en nuevas entradas.",
      emptyActive:
        "Ahora no hay síntomas personalizados visibles. Restaura uno abajo o añade uno nuevo arriba.",
      created: "Síntoma personalizado añadido.",
      updated: "Síntoma personalizado actualizado.",
      archived: "Síntoma personalizado ocultado.",
      restored: "Síntoma personalizado restaurado.",
      confirmHide:
        "¿Ocultar este síntoma personalizado de nuevas entradas? Los registros pasados lo conservarán.",
      errors: {
        labelRequired: "El nombre es obligatorio.",
        labelTooLong:
          "Usa 40 caracteres o menos. Para detalles largos, usa notas.",
        labelInvalidCharacters:
          "Usa solo texto simple. No se permiten corchetes angulares ni caracteres de control.",
        duplicateLabel: "Ese nombre ya existe en tu lista.",
        saveFailed: "No se pudo guardar este síntoma ahora. Inténtalo de nuevo.",
        notFound: "No se pudo encontrar este síntoma. Recarga ajustes e inténtalo de nuevo.",
      },
    },
    export: {
      title: "Exportar datos",
      subtitle:
        "Crea una copia local o una tabla útil para el médico a partir de tus registros.",
      storageHint:
        "Las exportaciones incluyen solo registros introducidos manualmente. Las predicciones no se incluyen.",
      sensitiveHint:
        "Los archivos exportados son sensibles. Guárdalos y compártelos solo donde confíes en el dispositivo o destino.",
      pdfCloudOnlyHint:
        "La exportación en PDF es una ventaja de Ovumcy Cloud. CSV y JSON siguen disponibles localmente en este dispositivo.",
      pdfPlanHint:
        "Esta cuenta de Ovumcy Cloud necesita un plan activo para desbloquear la exportación en PDF.",
      noData:
        "Todavía no hay entradas registradas. Cuando registres días en dashboard o calendario, la exportación aparecerá aquí.",
      presetLabel: "Preajustes",
      presetAll: "Todo el tiempo",
      preset30: "30 días",
      preset90: "90 días",
      preset365: "365 días",
      fromLabel: "Desde",
      toLabel: "Hasta",
      datePlaceholder: "AAAA-MM-DD",
      summaryTotalTemplate: "Entradas totales: %d",
      summaryRangeTemplate: "Rango de fechas: %s a %s",
      summaryRangeEmpty: "Rango de fechas: -",
      csvAction: "Exportar CSV",
      jsonAction: "Exportar JSON",
      pdfAction: "Exportar PDF",
      csvStatus: "La exportación CSV está lista.",
      jsonStatus: "La copia JSON está lista.",
      pdfStatus: "El informe PDF está listo.",
      errors: {
        invalidFromDate: "Usa una fecha inicial válida.",
        invalidToDate: "Usa una fecha final válida.",
        invalidRange: "La fecha final debe ser igual o posterior a la inicial.",
        pdfLocked:
          "La exportación en PDF solo está disponible con un plan activo de Ovumcy Cloud.",
        exportFailed: "No se pudo preparar la exportación. Inténtalo de nuevo.",
        deliveryUnavailable:
          "Este dispositivo no puede abrir el destino de exportación ahora. Inténtalo desde un navegador compatible o un dispositivo con share/save.",
        deliveryFailed:
          "El archivo se preparó, pero la descarga o el compartir fallaron. Inténtalo de nuevo.",
      },
    },
    danger: {
      title: "Zona de peligro",
      subtitle:
        "Cerrar la app no borra los datos locales. Usa esto solo si quieres borrar los registros de salud de este dispositivo.",
      clearTitle: "Borrar todos los datos locales",
      clearSubtitle:
        "Elimina onboarding, ajustes del perfil, registros diarios, síntomas personalizados y estado local de exportación, y devuelve la app al onboarding.",
      confirmationLabel: "Escribe CLEAR para confirmar",
      confirmationPlaceholder: "CLEAR",
      confirmationHint:
        "Esta acción no se puede deshacer desde la app. Exporta una copia antes si quieres conservar los registros.",
      deviceAuthPrompt:
        "Confirma con la seguridad del dispositivo para borrar los datos locales de este dispositivo.",
      action: "Borrar datos locales",
      success: "Datos locales borrados. Volviendo al onboarding.",
      invalidConfirmation:
        "Escribe CLEAR exactamente para confirmar la eliminación de datos locales.",
      deviceAuthUnavailable:
        "Configura un código o biometría en este dispositivo antes de borrar los datos locales.",
      deviceAuthFailed:
        "No se pudo confirmar la seguridad del dispositivo ahora mismo. Inténtalo de nuevo.",
      failed:
        "No se pudieron borrar los datos locales ahora. Inténtalo de nuevo.",
    },
    status: {
      cycleSaved: "Ajustes del ciclo guardados. Las predicciones se actualizaron.",
      trackingSaved: "Los campos de seguimiento se actualizaron para dashboard y calendario.",
      invalidLastPeriodStart:
        "Introduce una fecha válida del último período que no esté en el futuro.",
      saveFailed: "No se pudieron guardar los ajustes. Inténtalo de nuevo.",
    },
    premiumLock: {
      eyebrowLabel: "Premium",
      ctaLabel: "Abrir Ovumcy Cloud",
      remindersTitle: "Recordatorios Premium",
      pdfExportTitle: "PDF para tu médica/o",
    },
  },
  de: settingsCopyDe,
  fr: settingsCopyFr,
};

export function getSettingsCopy(language: string | null | undefined) {
  return settingsCopyCatalog[resolveCopyLanguage(language)];
}

export const settingsCopy = settingsCopyEn;
