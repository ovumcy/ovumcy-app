import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const settingsCopyEn = {
  title: "Settings",
  subtitle:
    "Manage cycle parameters, tracking fields, export actions, and local profile behavior.",
  common: {
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
    infoCycleShort:
      "A cycle shorter than 24 days is less common; please discuss with a doctor.",
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
    hint: "Optional. Right now this adds age-related context in Insights only. It does not change cycle calculations.",
    under20: "Under 20",
    age20to35: "20-35",
    age35plus: "35+",
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
    hideSexChip: "Hide intimacy section",
    hideSexChipHint:
      "Hides intimacy in new dashboard and calendar entries.",
    hideSexChipStateOn:
      "Currently hidden in dashboard and calendar day editor.",
    hideSexChipStateOff:
      "Currently visible in dashboard and calendar day editor.",
    temperatureUnit: "BBT unit",
    temperatureUnitHint: "Used when the BBT field is visible.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Save tracking",
  },
  interface: {
    title: "Interface",
    subtitle: "Control app language and appearance on this device.",
    languageLabel: "Language",
    languageHint: "Saved only on this device.",
    previewHint: "Language and theme preview immediately. Save to keep them on this device.",
    themeLabel: "Theme",
    themeHint: "Saved only on this device.",
    discardChanges: "Discard changes",
    save: "Save interface",
    saveBeforeLeave: "Save and leave",
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
    planUnknown:
      "Ovumcy is checking whether this cloud account has an active plan.",
    planInactive:
      "This cloud account is signed in, but cloud sync is still locked because no active plan was found.",
    planCheckFailed:
      "Ovumcy could not confirm this cloud plan right now. Try again in a moment.",
    planUnavailable:
      "Your Ovumcy Cloud account and billing stay separate from encrypted sync storage.",
    planActive: "Ovumcy Cloud is active for this account.",
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
    devicePlaceholder: "Pixel 7",
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
      "Restore the encrypted snapshot from the server and replace the current local data on this device?",
    restoreAccept: "Restore snapshot",
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
    prepareLabel: "Create recovery phrase",
    regenerateLabel: "Create a new recovery phrase",
    regeneratePrompt:
      "Recreating local sync keys invalidates older encrypted sync backups until you use the new recovery phrase. Continue?",
    regenerateAccept: "Create new phrase",
    regenerateDeviceAuthPrompt:
      "Confirm with device security to create a new recovery phrase for this device.",
    discardChangesLabel: "Discard changes",
    saveBeforeLeaveLabel: "Save and leave",
    unsavedPrompt:
      "You have unsaved backup and sync changes. Save them before leaving this screen?",
    prepared: "Recovery phrase created for this device.",
    regenerated: "A new recovery phrase was created for this device.",
    connected: "Connected to the sync server on this device.",
    connectedNoPlan:
      "Cloud account connected. Sync will turn on when this account has an active cloud plan.",
    recovered: "Sync access restored on this device.",
    uploaded: "Encrypted snapshot uploaded to the sync server.",
    restored: "Encrypted snapshot restored from the sync server.",
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
      blobNotFound: "No encrypted snapshot exists on this server yet.",
      invalidPayload: "The encrypted snapshot from the server could not be read.",
      networkFailed: "Unable to reach the sync server right now.",
      deviceAuthUnavailable:
        "Set up a device passcode or biometrics before recreating local sync keys.",
      deviceAuthFailed:
        "Unable to confirm device security right now. Please try again.",
      saveFailed: "Unable to prepare encrypted sync right now. Please try again.",
      syncFailed: "Unable to upload the encrypted snapshot right now. Please try again.",
      restoreFailed:
        "Unable to restore the encrypted snapshot right now. Please try again.",
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
} as const;

type SettingsCopy = WidenLiteral<typeof settingsCopyEn>;

const settingsCopyDe: SettingsCopy = {
  ...settingsCopyEn,
  title: "Einstellungen",
  subtitle:
    "Verwalte Zyklusparameter, Tracking-Felder, Exportaktionen und das lokale Profilverhalten.",
  common: {
    ...settingsCopyEn.common,
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
    infoCycleShort:
      "Ein Zyklus unter 24 Tagen ist seltener. Sprich darüber mit einer Ärztin oder einem Arzt.",
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
    hint: "Optional. Momentan ergänzt das nur altersbezogenen Kontext in den Einblicken. Die Zyklusberechnung ändert sich dadurch nicht.",
    under20: "Unter 20",
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
    hideSexChip: "Intimitätsbereich ausblenden",
    hideSexChipHint:
      "Blendet Intimität in neuen Dashboard- und Kalendereinträgen aus.",
    hideSexChipStateOn:
      "Derzeit im Dashboard und im Tageseditor des Kalenders verborgen.",
    hideSexChipStateOff:
      "Derzeit im Dashboard und im Tageseditor des Kalenders sichtbar.",
    temperatureUnit: "BBT-Einheit",
    temperatureUnitHint: "Wird verwendet, wenn das BBT-Feld sichtbar ist.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Tracking speichern",
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
    discardChanges: "Änderungen verwerfen",
    save: "Oberfläche speichern",
    saveBeforeLeave: "Speichern und verlassen",
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
      "Öffne Recovery Phrase, Kontoverbindung, Cloud-Tarif und Sync-Aktionen auf einem separaten Bildschirm.",
    openHubLabel: "Backup & Sync öffnen",
    backToSettingsLabel: "Zurück zu den Einstellungen",
    localStepTitle: "1. Dieses Gerät schützen",
    localStepHint:
      "Erstelle auf diesem Gerät eine Recovery Phrase. Bewahre sie offline auf, falls du deine Daten jemals wiederherstellen musst.",
    preparingTitle: "Dein geschütztes Backup wird vorbereitet...",
    preparingHint:
      "Ovumcy erzeugt gerade auf diesem Gerät eine Recovery Phrase.",
    accountStepTitle: "2. Konto verbinden",
    accountStepHintManaged:
      "Melde dich hier mit deinem Ovumcy-Cloud-Konto an. Deine Gesundheitsdaten werden weiterhin separat als verschlüsseltes Backup synchronisiert.",
    accountStepHintSelfHosted:
      "Erstelle ein Konto auf deinem eigenen Sync-Server oder melde dich dort an.",
    planStepTitle: "3. Cloud-Tarif",
    planStepHint:
      "Cloud-Zugriff und Abrechnung werden getrennt geprüft. Sync wird erst aktiviert, wenn dieses Konto einen aktiven Ovumcy-Cloud-Tarif hat.",
    planUnknown:
      "Ovumcy prüft, ob dieses Cloud-Konto einen aktiven Tarif hat.",
    planInactive:
      "Dieses Cloud-Konto ist angemeldet, aber Cloud-Sync bleibt gesperrt, weil kein aktiver Tarif gefunden wurde.",
    planCheckFailed:
      "Ovumcy konnte den Cloud-Tarif gerade nicht bestätigen. Versuche es gleich noch einmal.",
    planUnavailable:
      "Dein Ovumcy-Cloud-Konto und die Abrechnung bleiben vom verschlüsselten Sync-Speicher getrennt.",
    planActive: "Ovumcy Cloud ist für dieses Konto aktiv.",
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
    devicePlaceholder: "Pixel 7",
    stateLabel: "Status der Recovery Phrase",
    stateReady: "Dieses Gerät hat bereits eine Recovery Phrase.",
    stateMissing: "Dieses Gerät hat noch keine Recovery Phrase.",
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
      "Auf diesem Gerät wurde noch keine Recovery Phrase erstellt.",
    loginLabel: "E-Mail oder Login",
    loginPlaceholder: "owner@example.com",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Passwort eingeben",
    recoveryImportTitle: "Zugriff mit Recovery Phrase wiederherstellen",
    recoveryImportHint:
      "Nutze das, wenn dieses Gerät keine lokalen Sync-Schlüssel mehr hat, du aber noch Kontopasswort und 12-Wort-Recovery-Phrase besitzt.",
    recoveryPhraseInputLabel: "Recovery Phrase",
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
      "Den verschlüsselten Snapshot vom Server wiederherstellen und die aktuellen lokalen Daten auf diesem Gerät ersetzen?",
    restoreAccept: "Snapshot wiederherstellen",
    restoreDeviceAuthPrompt:
      "Bestätige mit Geräteschutz, um verschlüsselte Daten vom Sync-Server wiederherzustellen.",
    disconnectPrompt:
      "Dieses Gerät von der Sync-Server-Sitzung trennen? Die lokalen verschlüsselten Schlüssel bleiben auf diesem Gerät.",
    recoveryTitle: "Recovery Phrase für dieses Gerät",
    recoveryHint:
      "Schreibe die 12 Wörter exakt auf und bewahre sie offline auf. Wenn du alle Geräte und diese Phrase verlierst, können synchronisierte Daten nicht wiederhergestellt werden.",
    recoveryNotice:
      "Dieser Bildschirm zeigt die Recovery Phrase nur, wenn du lokale Sync-Schlüssel vorbereitest oder neu erstellst.",
    recoveryShownOnce: "Wird nach der Erstellung nur einmal angezeigt.",
    prepareLabel: "Recovery Phrase erstellen",
    regenerateLabel: "Neue Recovery Phrase erstellen",
    regeneratePrompt:
      "Das Neuerstellen lokaler Sync-Schlüssel macht ältere verschlüsselte Sync-Backups ungültig, bis du die neue Recovery Phrase verwendest. Fortfahren?",
    regenerateAccept: "Neue Phrase erstellen",
    regenerateDeviceAuthPrompt:
      "Bestätige mit Geräteschutz, um eine neue Recovery Phrase für dieses Gerät zu erstellen.",
    discardChangesLabel: "Änderungen verwerfen",
    saveBeforeLeaveLabel: "Speichern und verlassen",
    unsavedPrompt:
      "Du hast ungespeicherte Änderungen für Backup und Sync. Vor dem Verlassen speichern?",
    prepared: "Die Recovery Phrase wurde für dieses Gerät erstellt.",
    regenerated: "Für dieses Gerät wurde eine neue Recovery Phrase erstellt.",
    connected: "Dieses Gerät ist mit dem Sync-Server verbunden.",
    connectedNoPlan:
      "Cloud-Konto verbunden. Sync wird aktiviert, wenn dieses Konto einen aktiven Cloud-Tarif hat.",
    recovered: "Der Sync-Zugriff wurde auf diesem Gerät wiederhergestellt.",
    uploaded: "Verschlüsselter Snapshot auf den Sync-Server hochgeladen.",
    restored: "Verschlüsselter Snapshot vom Sync-Server wiederhergestellt.",
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
      recoveryPhraseRequired: "Die Recovery Phrase ist erforderlich.",
      invalidRecoveryPhrase:
        "Gib die exakte Recovery Phrase mit 12 Wörtern ein.",
      recoveryNotAvailable:
        "Dieser Sync-Server unterstützt keinen Import per Recovery Phrase.",
      recoveryPackageNotFound:
        "Für dieses Konto ist noch kein Recovery-Paket gespeichert.",
      tooManyDevices:
        "Dieses Konto hat das aktuelle Geräte-Limit erreicht.",
      syncNotPrepared:
        "Bereite zuerst den verschlüsselten Sync auf diesem Gerät vor.",
      notConnected:
        "Verbinde dieses Gerät zuerst mit einem Sync-Server.",
      blobNotFound:
        "Auf diesem Server gibt es noch keinen verschlüsselten Snapshot.",
      invalidPayload:
        "Der verschlüsselte Snapshot vom Server konnte nicht gelesen werden.",
      networkFailed:
        "Der Sync-Server ist gerade nicht erreichbar.",
      deviceAuthUnavailable:
        "Richte auf diesem Gerät zuerst einen Code oder Biometrie ein, bevor du lokale Sync-Schlüssel neu erstellst.",
      deviceAuthFailed:
        "Der Geräteschutz konnte gerade nicht bestätigt werden. Bitte versuche es erneut.",
      saveFailed:
        "Der verschlüsselte Sync konnte gerade nicht vorbereitet werden. Bitte versuche es erneut.",
      syncFailed:
        "Der verschlüsselte Snapshot konnte gerade nicht hochgeladen werden. Bitte versuche es erneut.",
      restoreFailed:
        "Der verschlüsselte Snapshot konnte gerade nicht wiederhergestellt werden. Bitte versuche es erneut.",
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
};

const settingsCopyFr: SettingsCopy = {
  ...settingsCopyEn,
  title: "Réglages",
  subtitle:
    "Gère les paramètres du cycle, les champs de suivi, les actions d'export et le comportement local du profil.",
  common: {
    ...settingsCopyEn.common,
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
    infoCycleShort:
      "Un cycle inférieur à 24 jours est moins courant. Parles-en avec un médecin.",
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
    hint: "Optionnel. Pour l'instant, cela ajoute seulement un contexte lié à l'âge dans les analyses. Cela ne change pas les calculs du cycle.",
    under20: "Moins de 20 ans",
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
    hideSexChip: "Masquer la section intimité",
    hideSexChipHint:
      "Masque l'intimité dans les nouvelles entrées du dashboard et du calendrier.",
    hideSexChipStateOn:
      "Actuellement masquée dans le dashboard et dans l'éditeur journalier du calendrier.",
    hideSexChipStateOff:
      "Actuellement visible dans le dashboard et dans l'éditeur journalier du calendrier.",
    temperatureUnit: "Unité TBC",
    temperatureUnitHint: "Utilisée quand le champ TBC est visible.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Enregistrer le suivi",
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
    discardChanges: "Annuler les modifications",
    save: "Enregistrer l'interface",
    saveBeforeLeave: "Enregistrer et quitter",
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
      "Ouvre un écran séparé pour la recovery phrase, la connexion du compte, le plan cloud et les actions de sync.",
    openHubLabel: "Ouvrir sauvegarde et sync",
    backToSettingsLabel: "Retour aux réglages",
    localStepTitle: "1. Protéger cet appareil",
    localStepHint:
      "Crée une recovery phrase sur cet appareil. Garde-la hors ligne au cas où tu aurais besoin de restaurer tes données.",
    preparingTitle: "Préparation de ta sauvegarde protégée...",
    preparingHint:
      "Ovumcy génère une recovery phrase sur cet appareil en ce moment.",
    accountStepTitle: "2. Connecter un compte",
    accountStepHintManaged:
      "Connecte-toi ici à ton compte Ovumcy Cloud. Tes données de santé restent synchronisées séparément sous forme de sauvegarde chiffrée.",
    accountStepHintSelfHosted:
      "Crée ou connecte-toi au compte de ton propre serveur de sync.",
    planStepTitle: "3. Plan cloud",
    planStepHint:
      "L'accès cloud et la facturation sont vérifiés séparément. Le sync s'active seulement quand ce compte a un plan Ovumcy Cloud actif.",
    planUnknown:
      "Ovumcy vérifie si ce compte cloud a un plan actif.",
    planInactive:
      "Ce compte cloud est connecté, mais le sync cloud reste bloqué car aucun plan actif n'a été trouvé.",
    planCheckFailed:
      "Ovumcy n'a pas pu confirmer le plan cloud pour le moment. Réessaie dans un instant.",
    planUnavailable:
      "Ton compte Ovumcy Cloud et la facturation restent séparés du stockage de sync chiffré.",
    planActive: "Ovumcy Cloud est actif pour ce compte.",
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
    devicePlaceholder: "Pixel 7",
    stateLabel: "Statut de la recovery phrase",
    stateReady: "Cet appareil a déjà une recovery phrase.",
    stateMissing: "Cet appareil n'a pas encore de recovery phrase.",
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
      "Aucune recovery phrase n'a encore été créée sur cet appareil.",
    loginLabel: "E-mail ou identifiant",
    loginPlaceholder: "owner@example.com",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Saisir le mot de passe",
    recoveryImportTitle:
      "Restaurer l'accès avec une recovery phrase",
    recoveryImportHint:
      "Utilise cette option quand cet appareil n'a plus de clés locales de sync, mais que tu as encore le mot de passe du compte et la recovery phrase de 12 mots.",
    recoveryPhraseInputLabel: "Recovery phrase",
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
      "Restaurer l'instantané chiffré depuis le serveur et remplacer les données locales actuelles de cet appareil ?",
    restoreAccept: "Restaurer l'instantané",
    restoreDeviceAuthPrompt:
      "Confirme avec la sécurité de l'appareil pour restaurer des données chiffrées depuis le serveur de sync.",
    disconnectPrompt:
      "Déconnecter cet appareil de la session du serveur de sync ? Les clés chiffrées locales resteront sur cet appareil.",
    recoveryTitle: "Recovery phrase pour cet appareil",
    recoveryHint:
      "Note exactement les 12 mots et garde-les hors ligne. Si tu perds tous les appareils et cette phrase, les données synchronisées ne pourront pas être récupérées.",
    recoveryNotice:
      "Cet écran affiche la recovery phrase seulement quand tu prépares ou recrées les clés locales de sync.",
    recoveryShownOnce: "Affichée une seule fois après la génération.",
    prepareLabel: "Créer la recovery phrase",
    regenerateLabel: "Créer une nouvelle recovery phrase",
    regeneratePrompt:
      "Recréer les clés locales de sync invalide les anciennes sauvegardes chiffrées tant que tu n'utilises pas la nouvelle recovery phrase. Continuer ?",
    regenerateAccept: "Créer une nouvelle phrase",
    regenerateDeviceAuthPrompt:
      "Confirme avec la sécurité de l'appareil pour créer une nouvelle recovery phrase pour cet appareil.",
    discardChangesLabel: "Annuler les modifications",
    saveBeforeLeaveLabel: "Enregistrer et quitter",
    unsavedPrompt:
      "Tu as des modifications de sauvegarde et de sync non enregistrées. Les enregistrer avant de quitter cet écran ?",
    prepared: "La recovery phrase a été créée pour cet appareil.",
    regenerated:
      "Une nouvelle recovery phrase a été créée pour cet appareil.",
    connected: "Cet appareil est connecté au serveur de sync.",
    connectedNoPlan:
      "Compte cloud connecté. Le sync s'activera quand ce compte aura un plan cloud actif.",
    recovered: "L'accès au sync a été restauré sur cet appareil.",
    uploaded: "Instantané chiffré téléversé vers le serveur de sync.",
    restored: "Instantané chiffré restauré depuis le serveur de sync.",
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
      recoveryPhraseRequired: "La recovery phrase est obligatoire.",
      invalidRecoveryPhrase:
        "Saisis exactement la recovery phrase de 12 mots.",
      recoveryNotAvailable:
        "Ce serveur de sync ne prend pas en charge l'import par recovery phrase.",
      recoveryPackageNotFound:
        "Aucun paquet de récupération n'est encore stocké pour ce compte.",
      tooManyDevices:
        "Ce compte a atteint la limite actuelle d'appareils.",
      syncNotPrepared:
        "Prépare d'abord le sync chiffré sur cet appareil.",
      notConnected:
        "Connecte d'abord cet appareil à un serveur de sync.",
      blobNotFound:
        "Aucun instantané chiffré n'existe encore sur ce serveur.",
      invalidPayload:
        "L'instantané chiffré provenant du serveur n'a pas pu être lu.",
      networkFailed:
        "Impossible d'atteindre le serveur de sync pour le moment.",
      deviceAuthUnavailable:
        "Configure un code ou la biométrie sur cet appareil avant de recréer les clés locales de sync.",
      deviceAuthFailed:
        "Impossible de confirmer la sécurité de l'appareil pour le moment. Réessaie.",
      saveFailed:
        "Impossible de préparer le sync chiffré pour le moment. Réessaie.",
      syncFailed:
        "Impossible de téléverser l'instantané chiffré pour le moment. Réessaie.",
      restoreFailed:
        "Impossible de restaurer l'instantané chiffré pour le moment. Réessaie.",
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
};

const settingsCopyCatalog: Record<InterfaceLanguage, SettingsCopy> = {
  en: settingsCopyEn,
  ru: {
    title: "Настройки",
    subtitle:
      "Управляйте параметрами цикла, полями трекинга, экспортом и локальным поведением профиля.",
    common: {
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
      infoCycleShort:
        "Цикл короче 24 дней встречается реже; обсудите это с врачом.",
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
      hint: "Необязательно. Сейчас это добавляет только возрастной контекст в Insights и не меняет расчёт цикла.",
      under20: "Младше 20",
      age20to35: "20-35",
      age35plus: "35+",
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
      hideSexChip: "Скрыть раздел близости",
      hideSexChipHint:
        "Скрывает раздел близости в новых записях dashboard и календаря.",
      hideSexChipStateOn:
        "Сейчас скрыто в dashboard и редакторе дня календаря.",
      hideSexChipStateOff:
        "Сейчас видно в dashboard и редакторе дня календаря.",
      temperatureUnit: "Единица БТТ",
      temperatureUnitHint: "Используется, когда поле БТТ видно.",
      temperatureUnitCelsius: "Цельсий",
      temperatureUnitFahrenheit: "Фаренгейт",
      save: "Сохранить трекинг",
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
      discardChanges: "Не сохранять",
      save: "Сохранить интерфейс",
      saveBeforeLeave: "Сохранить и выйти",
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
        "Откройте отдельный экран, чтобы увидеть recovery phrase, подключение аккаунта, cloud-план и действия sync.",
      openHubLabel: "Открыть резервную копию и sync",
      backToSettingsLabel: "Назад в настройки",
      localStepTitle: "1. Защитить это устройство",
      localStepHint:
        "Создайте recovery phrase на этом устройстве. Храните её офлайн на случай восстановления данных.",
      preparingTitle: "Подготавливаем защищённую копию...",
      preparingHint:
        "Ovumcy сейчас создаёт recovery phrase на этом устройстве.",
      accountStepTitle: "2. Подключить аккаунт",
      accountStepHintManaged:
        "Войдите здесь в аккаунт Ovumcy Cloud. Данные здоровья всё равно синхронизируются отдельно как зашифрованная копия.",
      accountStepHintSelfHosted:
        "Создайте аккаунт на своём sync-сервере или войдите в уже существующий.",
      planStepTitle: "3. План Ovumcy Cloud",
      planStepHint:
        "Доступ к cloud и billing проверяются отдельно. Sync включится только когда у этого аккаунта будет активный план Ovumcy Cloud.",
      planUnknown:
        "Ovumcy проверяет, есть ли у этого cloud-аккаунта активный план.",
      planInactive:
        "Этот cloud-аккаунт уже подключён, но cloud sync остаётся заблокированным, потому что активный план не найден.",
      planCheckFailed:
        "Сейчас Ovumcy не смог подтвердить cloud-план. Попробуйте ещё раз через минуту.",
      planUnavailable:
        "Аккаунт Ovumcy Cloud и billing остаются отдельными от зашифрованного sync-хранилища.",
      planActive: "Для этого аккаунта Ovumcy Cloud уже активен.",
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
      devicePlaceholder: "Pixel 7",
      stateLabel: "Статус recovery phrase",
      stateReady: "На этом устройстве уже есть recovery phrase.",
      stateMissing: "На этом устройстве ещё нет recovery phrase.",
      connectionLabel: "Сессия аккаунта",
      connectionReady: "Это устройство уже вошло в sync-аккаунт.",
      connectionMissing: "Это устройство ещё не вошло в sync-аккаунт.",
      lastSyncLabel: "Последний sync",
      lastSyncNever: "Синхронизации ещё не было.",
      modeRowLabel: "Назначение",
      endpointRowLabel: "Сервер",
      encryptionRowLabel: "Защита устройства",
      encryptionReady: "Recovery-материалы хранятся только на этом устройстве.",
      encryptionMissing: "Recovery phrase на этом устройстве ещё не создана.",
      loginLabel: "Email или логин",
      loginPlaceholder: "owner@example.com",
      passwordLabel: "Пароль",
      passwordPlaceholder: "Введите пароль",
      recoveryImportTitle: "Восстановить доступ по recovery phrase",
      recoveryImportHint:
        "Используйте это, если на устройстве больше нет локальных sync keys, но у вас остались пароль аккаунта и recovery phrase из 12 слов.",
      recoveryPhraseInputLabel: "Recovery phrase",
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
        "Восстановить зашифрованный слепок с сервера и заменить текущие локальные данные на этом устройстве?",
      restoreAccept: "Восстановить слепок",
      restoreDeviceAuthPrompt:
        "Подтвердите защитой устройства восстановление зашифрованных данных с sync-сервера.",
      disconnectPrompt:
        "Отключить это устройство от сессии sync-сервера? Локальные зашифрованные ключи останутся на устройстве.",
      recoveryTitle: "Recovery phrase для этого устройства",
      recoveryHint:
        "Запишите все 12 слов точно и храните их офлайн. Если вы потеряете все устройства и эту phrase, synced data восстановить нельзя.",
      recoveryNotice:
        "Этот экран показывает recovery phrase только когда вы подготавливаете или пересоздаёте локальные sync keys.",
      recoveryShownOnce: "Показывается только один раз после генерации.",
      prepareLabel: "Создать recovery phrase",
      regenerateLabel: "Создать новую recovery phrase",
      regeneratePrompt:
        "Пересоздание локальных sync keys делает старые зашифрованные sync backup'ы недоступными, пока вы не используете новую recovery phrase. Продолжить?",
      regenerateAccept: "Создать новую phrase",
      regenerateDeviceAuthPrompt:
        "Подтвердите защитой устройства создание новой recovery phrase для этого устройства.",
      discardChangesLabel: "Не сохранять",
      saveBeforeLeaveLabel: "Сохранить и выйти",
      unsavedPrompt:
        "Есть несохранённые изменения в резервной копии и sync. Сохранить их перед выходом с экрана?",
      prepared: "Recovery phrase создана для этого устройства.",
      regenerated: "Для этого устройства создана новая recovery phrase.",
      connected: "Это устройство подключено к sync-серверу.",
      connectedNoPlan:
        "Cloud-аккаунт подключён. Sync включится, когда у аккаунта появится активный cloud-план.",
      recovered: "Доступ к sync восстановлен на этом устройстве.",
      uploaded: "Зашифрованный слепок отправлен на sync-сервер.",
      restored: "Зашифрованный слепок восстановлен с sync-сервера.",
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
        recoveryPhraseRequired: "Recovery phrase обязательна.",
        invalidRecoveryPhrase:
          "Введите точную recovery phrase из 12 слов.",
        recoveryNotAvailable:
          "Этот sync-сервер не поддерживает импорт по recovery phrase.",
        recoveryPackageNotFound:
          "Для этого аккаунта ещё не сохранён recovery package.",
        tooManyDevices: "Для этого аккаунта уже достигнут лимит устройств.",
        syncNotPrepared: "Сначала подготовьте зашифрованный sync на этом устройстве.",
        notConnected: "Сначала подключите это устройство к sync-серверу.",
        blobNotFound: "На этом сервере ещё нет зашифрованного слепка.",
        invalidPayload:
          "Не удалось прочитать зашифрованный слепок, полученный с сервера.",
        networkFailed: "Сейчас не удаётся связаться с sync-сервером.",
        deviceAuthUnavailable:
          "Перед пересозданием локальных sync keys настройте код-пароль или биометрию на устройстве.",
        deviceAuthFailed:
          "Сейчас не удалось подтвердить защиту устройства. Попробуйте ещё раз.",
        saveFailed:
          "Сейчас не удалось подготовить зашифрованный sync. Попробуйте ещё раз.",
        syncFailed:
          "Сейчас не удалось отправить зашифрованный слепок. Попробуйте ещё раз.",
        restoreFailed:
          "Сейчас не удалось восстановить зашифрованный слепок. Попробуйте ещё раз.",
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
  },
  es: {
    title: "Ajustes",
    subtitle:
      "Gestiona parámetros del ciclo, campos de seguimiento, acciones de exportación y el comportamiento local del perfil.",
    common: {
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
      infoCycleShort:
        "Un ciclo más corto de 24 días es menos común; coméntalo con un médico.",
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
      hint: "Opcional. Por ahora esto solo añade contexto relacionado con la edad en Insights. No cambia los cálculos del ciclo.",
      under20: "Menos de 20",
      age20to35: "20-35",
      age35plus: "35+",
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
      hideSexChip: "Ocultar sección de intimidad",
      hideSexChipHint:
        "Oculta la sección de intimidad en nuevas entradas del dashboard y del calendario.",
      hideSexChipStateOn:
        "Actualmente oculta en el dashboard y en el editor diario del calendario.",
      hideSexChipStateOff:
        "Actualmente visible en el dashboard y en el editor diario del calendario.",
      temperatureUnit: "Unidad de TCB",
      temperatureUnitHint: "Se usa cuando el campo de TCB está visible.",
      temperatureUnitCelsius: "Celsius",
      temperatureUnitFahrenheit: "Fahrenheit",
      save: "Guardar seguimiento",
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
      discardChanges: "Descartar cambios",
      save: "Guardar interfaz",
      saveBeforeLeave: "Guardar y salir",
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
        "Abre una pantalla separada para ver la recovery phrase, la conexión de la cuenta, el plan cloud y las acciones de sync.",
      openHubLabel: "Abrir copia y sync",
      backToSettingsLabel: "Volver a ajustes",
      localStepTitle: "1. Proteger este dispositivo",
      localStepHint:
        "Crea una recovery phrase en este dispositivo. Guárdala fuera de línea por si alguna vez necesitas restaurar tus datos.",
      preparingTitle: "Preparando tu copia protegida...",
      preparingHint:
        "Ovumcy está creando una recovery phrase en este dispositivo.",
      accountStepTitle: "2. Conectar una cuenta",
      accountStepHintManaged:
        "Inicia sesión aquí con tu cuenta de Ovumcy Cloud. Tus datos de salud siguen sincronizándose aparte como copia cifrada.",
      accountStepHintSelfHosted:
        "Crea o inicia sesión en la cuenta de tu propio servidor de sync.",
      planStepTitle: "3. Plan de Ovumcy Cloud",
      planStepHint:
        "El acceso cloud y la facturación se comprueban por separado. El sync solo se activa cuando esta cuenta tiene un plan activo de Ovumcy Cloud.",
      planUnknown:
        "Ovumcy está comprobando si esta cuenta cloud tiene un plan activo.",
      planInactive:
        "Esta cuenta cloud ha iniciado sesión, pero el sync cloud sigue bloqueado porque no se encontró un plan activo.",
      planCheckFailed:
        "Ovumcy no pudo confirmar el plan cloud en este momento. Vuelve a intentarlo enseguida.",
      planUnavailable:
        "Tu cuenta de Ovumcy Cloud y la facturación permanecen separadas del almacenamiento de sync cifrado.",
      planActive: "Ovumcy Cloud está activo para esta cuenta.",
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
      devicePlaceholder: "Pixel 7",
      stateLabel: "Estado de la recovery phrase",
      stateReady: "Este dispositivo ya tiene una recovery phrase.",
      stateMissing: "Este dispositivo todavía no tiene una recovery phrase.",
      connectionLabel: "Sesión de la cuenta",
      connectionReady: "Este dispositivo ya inició sesión en una cuenta de sync.",
      connectionMissing: "Este dispositivo todavía no ha iniciado sesión en una cuenta de sync.",
      lastSyncLabel: "Último sync",
      lastSyncNever: "Todavía no se ha sincronizado.",
      modeRowLabel: "Destino",
      endpointRowLabel: "Servidor",
      encryptionRowLabel: "Protección del dispositivo",
      encryptionReady: "Los materiales de recuperación se guardan solo en este dispositivo.",
      encryptionMissing: "Todavía no se ha creado una recovery phrase en este dispositivo.",
      loginLabel: "Correo o usuario",
      loginPlaceholder: "owner@example.com",
      passwordLabel: "Contraseña",
      passwordPlaceholder: "Introduce la contraseña",
      recoveryImportTitle: "Restaurar acceso con una recovery phrase",
      recoveryImportHint:
        "Úsalo cuando este dispositivo ya no tenga claves locales de sync, pero todavía conserves la contraseña de la cuenta y la recovery phrase de 12 palabras.",
      recoveryPhraseInputLabel: "Recovery phrase",
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
      recoveryTitle: "Recovery phrase de este dispositivo",
      recoveryHint:
        "Escribe exactamente las 12 palabras y guárdalas fuera de línea. Si pierdes todos los dispositivos y esta frase, no se podrán recuperar los datos sincronizados.",
      recoveryNotice:
        "Esta pantalla muestra la frase de recuperación solo cuando preparas o recreas las claves locales de sync.",
      recoveryShownOnce: "Se muestra solo una vez después de generarse.",
      prepareLabel: "Crear recovery phrase",
      regenerateLabel: "Crear una nueva recovery phrase",
      regeneratePrompt:
        "Recrear las claves locales de sync invalida las copias cifradas antiguas hasta que uses la nueva recovery phrase. ¿Continuar?",
      regenerateAccept: "Crear nueva phrase",
      regenerateDeviceAuthPrompt:
        "Confirma con la seguridad del dispositivo para crear una nueva recovery phrase para este dispositivo.",
      discardChangesLabel: "Descartar cambios",
      saveBeforeLeaveLabel: "Guardar y salir",
      unsavedPrompt:
        "Hay cambios de copia y sync sin guardar. ¿Quieres guardarlos antes de salir de esta pantalla?",
      prepared: "La recovery phrase quedó creada para este dispositivo.",
      regenerated: "Se creó una nueva recovery phrase para este dispositivo.",
      connected: "Este dispositivo quedó conectado al servidor de sync.",
      connectedNoPlan:
        "La cuenta cloud quedó conectada. El sync se activará cuando esta cuenta tenga un plan cloud activo.",
      recovered: "El acceso de sync quedó restaurado en este dispositivo.",
      uploaded: "La instantánea cifrada se subió al servidor de sync.",
      restored: "La instantánea cifrada se restauró desde el servidor de sync.",
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
        recoveryPhraseRequired: "La recovery phrase es obligatoria.",
        invalidRecoveryPhrase:
          "Introduce la recovery phrase exacta de 12 palabras.",
        recoveryNotAvailable:
          "Este servidor de sync no admite importar con recovery phrase.",
        recoveryPackageNotFound:
          "Todavía no hay ningún paquete de recuperación guardado para esta cuenta.",
        tooManyDevices: "Esta cuenta ya alcanzó el límite actual de dispositivos.",
        syncNotPrepared:
          "Primero prepara el sync cifrado en este dispositivo.",
        notConnected:
          "Primero conecta este dispositivo a un servidor de sync.",
        blobNotFound:
          "Todavía no existe una instantánea cifrada en este servidor.",
        invalidPayload:
          "No se pudo leer la instantánea cifrada recibida del servidor.",
        networkFailed:
          "No se puede alcanzar el servidor de sync ahora mismo.",
        deviceAuthUnavailable:
          "Configura un código o biometría en este dispositivo antes de recrear las claves locales de sync.",
        deviceAuthFailed:
          "No se pudo confirmar la seguridad del dispositivo ahora mismo. Inténtalo de nuevo.",
        saveFailed:
          "No se pudo preparar el sync cifrado ahora. Inténtalo de nuevo.",
        syncFailed:
          "No se pudo subir la instantánea cifrada ahora. Inténtalo de nuevo.",
        restoreFailed:
          "No se pudo restaurar la instantánea cifrada ahora. Inténtalo de nuevo.",
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
  },
  de: settingsCopyDe,
  fr: settingsCopyFr,
};

export function getSettingsCopy(language: string | null | undefined) {
  return settingsCopyCatalog[resolveCopyLanguage(language)];
}

export const settingsCopy = settingsCopyEn;
