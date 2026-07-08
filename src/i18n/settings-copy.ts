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
    showHistoricalPhases: "Show fertile windows for past cycles",
    showHistoricalPhasesHint:
      "Shows ovulation, fertile peak, and pre-fertile markers on past completed cycles in the calendar, based on recorded cycle starts.",
    showHistoricalPhasesStateOn:
      "Currently shown on past months in the calendar.",
    showHistoricalPhasesStateOff:
      "Currently hidden; only upcoming predicted cycles show fertile windows.",
    hideCycleFactors: "Show cycle factors",
    hideCycleFactorsHint:
      "Adds cycle factor tags (stress, illness, travel, ...) to dashboard and calendar entries without deleting saved tags.",
    hideCycleFactorsStateOn:
      "Currently visible in dashboard and calendar day editor.",
    hideCycleFactorsStateOff:
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
      "Reminder emails need an active Ovumcy Cloud plan. On-device reminders work without an account or plan, and your saved choices stay local.",
    timeLabel: "Reminder time",
    timeHint:
      "Used for daily logging and for the next scheduled cycle reminders on this device.",
    leadDaysLabel: "Reminder lead time (days)",
    leadDaysHint:
      "How many days before the predicted period window this device schedules the upcoming-period reminder (0–14). 0 reminds you on the day itself.",
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
    statusOn: "On",
    statusOff: "Off",
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
    themeSystem: "System",
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
    uploadOverBackupPrompt:
      "This account already has an encrypted backup copy on the server, but this device has never synced. Uploading now will replace that server copy with this device's data. Replace it?",
    uploadOverBackupAccept: "Replace server copy",
    renewalCancelLabel: "Turn off auto-renewal",
    renewalResumeLabel: "Resume auto-renewal",
    renewalCancelPrompt:
      "Turn off automatic renewal? Your plan stays active until the end of the already-paid period.",
    renewalCancelAccept: "Turn off renewal",
    offerDismissLabel: "Dismiss this offer",
    offerPromoEyebrow: "Offer",
    offerAnnouncementEyebrow: "News",
    disconnectPrompt:
      "Disconnect this device from the sync server session? Local encrypted keys will stay on this device.",
    disconnectDeviceAuthPrompt:
      "Confirm with device security to disconnect this device from the sync server.",
    deleteAccountLabel: "Delete account",
    deleteAccountPrompt:
      "Permanently delete your account and all its data from the server? This cannot be undone.",
    deleteAccountAccept: "Delete account",
    deleteAccountDeviceAuthPrompt:
      "Confirm with device security to permanently delete your account.",
    deleteAccountSubscriptionWarningTitle: "Your subscription will keep billing",
    deleteAccountSubscriptionWarningMessage:
      "Deleting your account does NOT cancel your Google Play subscription. You must cancel it separately in the Play Store, or you will keep being charged. Confirm below only if you understand this and still want to permanently delete your account.",
    deleteAccountSubscriptionWarningAccept: "I understand, delete anyway",
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
    deleted: "Account deleted. Returning to onboarding.",
    renewalCancelled:
      "Auto-renewal is off. Your plan stays active until the current period ends.",
    renewalResumed: "Auto-renewal is on again.",
    errors: {
      loginRequired: "Login is required.",
      passwordRequired: "Password is required.",
      passwordTooShort: "Password must be at least 12 characters.",
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
      tooManyDevices:
        "This account has reached its device limit. On a device that is still connected, open Backup & sync and remove a device you no longer use to free a slot.",
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
      deleteAccountFailed:
        "Unable to delete your account right now. Nothing was changed. Please try again.",
      renewalUnavailable:
        "Renewal for this plan cannot be managed from the app.",
      renewalUpdateFailed:
        "Unable to update the renewal setting right now. Please try again.",
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
  import: {
    title: "Restore from backup",
    subtitle:
      "Import a previous Ovumcy JSON export. Only days you don't already have are added — nothing is overwritten or deleted.",
    pickAction: "Choose export file",
    previewTitle: "Ready to restore",
    previewCreatedTemplate: "Backup created: %s",
    previewRangeTemplate: "Backup range: %s to %s",
    previewTotalTemplate: "Entries in backup: %d",
    previewAddTemplate: "New days to add: %d",
    previewSkipTemplate: "Days already on this device (kept unchanged): %d",
    previewRejectTemplate: "Entries that can't be imported: %d",
    previewSymptomsTemplate: "New custom symptoms: %d",
    previewProfileRestore:
      "Cycle settings from the backup will be applied — this device still has the default settings.",
    previewProfileKept: "Your current settings stay unchanged.",
    previewNothingNew: "Everything in this backup is already on this device.",
    confirmAction: "Restore now",
    cancelAction: "Cancel",
    applyingLabel: "Restoring...",
    successTemplate: "Restored %d days (%d already present, %d ignored).",
    successProfileNote: "Cycle settings were restored from the backup.",
    errors: {
      malformed:
        "This file can't be read as a backup. Choose an unmodified JSON export created by Ovumcy.",
      unrecognizedFormat: "This file isn't a valid Ovumcy export.",
      tooLarge: "That file is too large to import.",
      pickUnavailable: "Choosing files isn't available on this device right now.",
      readFailed: "The selected file couldn't be read. Please try again.",
      importFailed: "Restore failed. Please try again.",
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
    remindersTitle: "Reminder emails",
    pdfExportTitle: "Doctor-friendly PDF",
  },
} as const;

type SettingsCopy = WidenLiteral<typeof settingsCopyEn>;

const settingsCopyDe: SettingsCopy = {
  ...settingsCopyEn,
  title: "Einstellungen",
  subtitle:
    "Verwalten Sie Zyklusparameter, Tracking-Felder, Exportaktionen und das lokale Profilverhalten.",
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
      "Optionaler Fallback, wenn in Ihrem Journal noch kein Zyklusbeginn markiert ist.",
    warningApproximate:
      "Mit diesen Werten lässt sich der Eisprung nicht zuverlässig berechnen. Die Vorhersage wird nur ungefähr sein.",
    infoAdjusted:
      "Die Periodendauer wurde automatisch angepasst, damit mindestens 10 Tage bis zum nächsten Zyklus bleiben.",
    infoPeriodLong:
      "Eine Dauer von mehr als 8 Tagen kann auf Zyklusunregelmäßigkeiten hinweisen. Sprechen Sie darüber mit einer Ärztin oder einem Arzt.",
    infoCycleLong:
      "Ein Zyklus von mehr als 45 Tagen ist seltener. Sprechen Sie darüber mit einer Ärztin oder einem Arzt.",
    infoCycleShort:
      "Ein Zyklus unter 24 Tagen ist seltener. Sprechen Sie darüber mit einer Ärztin oder einem Arzt.",
    autoPeriodFill: "Periodentage automatisch ausfüllen",
    autoPeriodFillHint:
      "Wenn diese Option aktiviert ist, füllt das Markieren des ersten Tages die folgenden Tage automatisch auf Basis Ihrer Periodendauer aus.",
    predictionModeLabel: "Vorhersagemodus",
    predictionModeHint: "Wählen Sie, wie Ovumcy Datumsvorhersagen anzeigen soll.",
    predictionModeRegular: "Regelmäßig",
    predictionModeRegularHint:
      "Zeigt die Standardvorhersage auf Basis Ihrer Zykluseinstellungen und Ihres Verlaufs.",
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
      "Wählen Sie zusätzliche Felder für tägliche Einträge. Gespeicherte Werte bleiben in Ihrem privaten Verlauf.",
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
    showHistoricalPhases: "Fruchtbare Fenster für vergangene Zyklen anzeigen",
    showHistoricalPhasesHint:
      "Zeigt Eisprung, fruchtbares Maximum und vor-fruchtbare Markierungen für vergangene abgeschlossene Zyklen im Kalender, basierend auf erfassten Zyklusbeginnen.",
    showHistoricalPhasesStateOn:
      "Derzeit in vergangenen Kalendermonaten angezeigt.",
    showHistoricalPhasesStateOff:
      "Derzeit verborgen; nur kommende vorhergesagte Zyklen zeigen fruchtbare Fenster.",
    hideCycleFactors: "Zyklusfaktoren anzeigen",
    hideCycleFactorsHint:
      "Fügt Dashboard- und Kalendereinträgen Zyklusfaktor-Tags (Stress, Krankheit, Reisen, ...) hinzu, ohne gespeicherte Tags zu löschen.",
    hideCycleFactorsStateOn:
      "Derzeit im Dashboard und im Tageseditor des Kalenders sichtbar.",
    hideCycleFactorsStateOff:
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
      "Halten Sie Geräte-Erinnerungen privat auf diesem Gerät und nutzen Sie datensparsame E-Mail-Hinweise, wenn Premium-Zustellung aktiv ist.",
    localOnlyHint:
      "Geräte-Erinnerungen bleiben nur auf diesem Gerät. Es werden keine Gesundheitsdaten an einen Server gesendet.",
    emailHint:
      "Premium-Erinnerungs-E-Mails senden nur allgemeine Hinweise. Symptome, Notizen oder fruchtbare Details werden nie aufgenommen.",
    lockedHint:
      "Erinnerungs-E-Mails benötigen einen aktiven Ovumcy-Cloud-Plan. Erinnerungen auf diesem Gerät funktionieren ohne Konto und Plan, und Ihre gespeicherten Auswahloptionen bleiben lokal.",
    timeLabel: "Erinnerungszeit",
    timeHint:
      "Wird für tägliche Log-Erinnerungen und für die nächsten geplanten Zyklus-Erinnerungen auf diesem Gerät verwendet.",
    leadDaysLabel: "Vorlaufzeit der Erinnerung (Tage)",
    leadDaysHint:
      "Wie viele Tage vor dem vorhergesagten Periodenfenster dieses Gerät die Erinnerung plant (0–14). Der Wert 0 erinnert Sie am Tag selbst.",
    emailDelivery: "Auch Erinnerungs-E-Mails senden",
    emailDeliveryHint:
      "Verwendet die E-Mail-Zustellung von Ovumcy Cloud mit datensparsamen Hinweisen basierend auf Ihren aktivierten Erinnerungstypen.",
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
    statusOn: "An",
    statusOff: "Aus",
    saved: "Erinnerungseinstellungen wurden für dieses Gerät aktualisiert.",
    savedWithEmail:
      "Erinnerungseinstellungen wurden aktualisiert. Erinnerungs-E-Mails von Ovumcy Cloud nutzen jetzt datensparsame Hinweise.",
    emailUnavailable:
      "Die Erinnerungseinstellungen wurden gespeichert, aber Erinnerungs-E-Mails von Ovumcy Cloud sind gerade nicht verfügbar.",
    emailSyncFailed:
      "Die Erinnerungseinstellungen wurden gespeichert, aber Erinnerungs-E-Mails von Ovumcy Cloud konnten gerade nicht aktualisiert werden.",
    permissionDenied:
      "Erlauben Sie Benachrichtigungen in den Geräteeinstellungen, um Erinnerungen auf diesem Gerät zu erhalten.",
    unavailable:
      "Dieses Gerät kann lokale Erinnerungen im Moment nicht planen.",
    errors: {
      invalidTime:
        "Verwenden Sie eine gültige Erinnerungszeit im Format HH:MM.",
      saveFailed:
        "Die Erinnerungseinstellungen konnten gerade nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    },
  },
  interface: {
    ...settingsCopyEn.interface,
    title: "Oberfläche",
    subtitle: "Steuern Sie Sprache und Erscheinungsbild der App auf diesem Gerät.",
    languageLabel: "Sprache",
    languageHint: "Wird nur auf diesem Gerät gespeichert.",
    previewHint:
      "Sprache und Design werden sofort als Vorschau angezeigt. Speichern Sie, um sie auf diesem Gerät zu behalten.",
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
    themeSystem: "System",
    saved: "Oberflächeneinstellungen für dieses Gerät aktualisiert.",
    languageSaved: "Sprache für dieses Gerät aktualisiert.",
    themeSaved: "Design für dieses Gerät aktualisiert.",
    unsavedPrompt:
      "Sie haben ungespeicherte Einstellungsänderungen. Vor dem Verlassen speichern?",
  },
  account: {
    ...settingsCopyEn.account,
    title: "Backup & Sync",
    subtitle:
      "Schützen Sie zuerst dieses Gerät und verbinden Sie dann entweder Ovumcy Cloud oder Ihren eigenen Sync-Server.",
    hubSubtitle:
      "Öffnen Sie Wiederherstellungsphrase, Kontoverbindung, Cloud-Tarif und Sync-Aktionen auf einem separaten Bildschirm.",
    openHubLabel: "Backup & Sync öffnen",
    backToSettingsLabel: "Zurück zu den Einstellungen",
    localStepTitle: "1. Dieses Gerät schützen",
    localStepHint:
      "Erstellen Sie auf diesem Gerät eine Wiederherstellungsphrase. Bewahren Sie sie offline auf, falls Sie Ihre Daten jemals wiederherstellen müssen.",
    preparingTitle: "Ihr geschütztes Backup wird vorbereitet...",
    preparingHint:
      "Ovumcy erzeugt gerade auf diesem Gerät eine Wiederherstellungsphrase.",
    accountStepTitle: "2. Konto verbinden",
    accountStepHintManaged:
      "Melden Sie sich hier mit Ihrem Ovumcy-Cloud-Konto an. Ihre Gesundheitsdaten werden weiterhin separat als verschlüsseltes Backup synchronisiert.",
    accountStepHintSelfHosted:
      "Erstellen Sie ein Konto auf Ihrem eigenen Sync-Server oder melden Sie sich dort an.",
    planStepTitle: "3. Cloud-Tarif",
    planStepHint:
      "Cloud-Zugriff und Abrechnung werden getrennt geprüft. Sync wird erst aktiviert, wenn dieses Konto einen aktiven Ovumcy-Cloud-Tarif hat.",
    planSignInFirst: "Melden Sie sich zuerst an, um Ihren Tarifstatus zu prüfen.",
    planUnknown:
      "Ovumcy prüft, ob dieses Cloud-Konto einen aktiven Tarif hat.",
    planInactive:
      "Dieses Cloud-Konto ist angemeldet, aber Cloud-Sync bleibt gesperrt, weil kein aktiver Tarif gefunden wurde.",
    planCheckFailed:
      "Ovumcy konnte den Cloud-Tarif gerade nicht bestätigen. Versuchen Sie es gleich noch einmal.",
    planUnavailable:
      "Ihr Ovumcy-Cloud-Konto und die Abrechnung bleiben vom verschlüsselten Sync-Speicher getrennt.",
    planActive: "Ovumcy Cloud ist für dieses Konto aktiv.",
    checkPlanAgain: "Tarif erneut prüfen",
    advancedSectionLabel: "Erweitert",
    syncStepTitle: "4. Dieses Backup synchronisieren",
    syncStepHintManaged:
      "Sobald dieses Cloud-Konto einen aktiven Tarif hat, können Sie hier das geschützte Backup hochladen oder wiederherstellen.",
    syncStepHintSelfHosted:
      "Sobald Sie an Ihrem eigenen Server angemeldet sind, können Sie hier das geschützte Backup hochladen oder wiederherstellen.",
    syncBlockedNoPlan:
      "Cloud-Sync bleibt gesperrt, bis dieses Konto einen aktiven Ovumcy Cloud-Tarif hat.",
    modeLabel: "Sync-Modus",
    modeManaged: "Ovumcy Cloud",
    modeSelfHosted: "Self-hosted",
    managedHint:
      "Ovumcy Cloud speichert Ihr verschlüsseltes Backup auf unserem gehosteten Dienst. Self-hosted behält Sync auf Ihrem eigenen Server.",
    selfHostedHint:
      "Nutzen Sie einen Host, IP:Port oder eine vollständige URL. Öffentliches http wird abgelehnt; localhost und privates Netzwerk-http sind erlaubt.",
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
      "Nutzen Sie das, wenn dieses Gerät keine lokalen Sync-Schlüssel mehr hat, Sie aber noch Kontopasswort und 12-Wort-Wiederherstellungsphrase besitzen.",
    recoveryPhraseInputLabel: "Wiederherstellungsphrase",
    recoveryPhraseInputPlaceholder: "zwölf Wörter mit Leerzeichen getrennt",
    recoveryPhraseInputHint:
      "Geben Sie exakt die 12 Wörter ein, mit denen Ihr Sync-Master-Key geschützt ist.",
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
      "Bestätigen Sie mit Geräteschutz, um verschlüsselte Daten vom Sync-Server wiederherzustellen.",
    uploadOverBackupPrompt:
      "Für dieses Konto liegt bereits eine verschlüsselte Sicherungskopie auf dem Server, aber dieses Gerät hat noch nie synchronisiert. Beim Hochladen wird die Serverkopie durch die Daten dieses Geräts ersetzt. Ersetzen?",
    uploadOverBackupAccept: "Serverkopie ersetzen",
    renewalCancelLabel: "Automatische Verlängerung deaktivieren",
    renewalResumeLabel: "Automatische Verlängerung fortsetzen",
    renewalCancelPrompt:
      "Automatische Verlängerung deaktivieren? Ihr Tarif bleibt bis zum Ende des bereits bezahlten Zeitraums aktiv.",
    renewalCancelAccept: "Verlängerung deaktivieren",
    offerDismissLabel: "Dieses Angebot ausblenden",
    offerPromoEyebrow: "Angebot",
    offerAnnouncementEyebrow: "Neuigkeiten",
    disconnectPrompt:
      "Dieses Gerät von der Sync-Server-Sitzung trennen? Die lokalen verschlüsselten Schlüssel bleiben auf diesem Gerät.",
    disconnectDeviceAuthPrompt:
      "Bestätigen Sie mit Geräteschutz, um dieses Gerät vom Sync-Server zu trennen.",
    deleteAccountLabel: "Konto löschen",
    deleteAccountPrompt:
      "Ihr Konto und alle Daten dauerhaft vom Server löschen? Dies kann nicht rückgängig gemacht werden.",
    deleteAccountAccept: "Konto löschen",
    deleteAccountDeviceAuthPrompt:
      "Bestätigen Sie mit Geräteschutz, um Ihr Konto dauerhaft zu löschen.",
    deleteAccountSubscriptionWarningTitle: "Ihr Abo wird weiter abgerechnet",
    deleteAccountSubscriptionWarningMessage:
      "Das Löschen Ihres Kontos kündigt NICHT Ihr Google-Play-Abo. Sie müssen es separat im Play Store kündigen, sonst werden Sie weiterhin belastet. Bestätigen Sie unten nur, wenn Sie das verstanden haben und Ihr Konto trotzdem dauerhaft löschen möchten.",
    deleteAccountSubscriptionWarningAccept: "Verstanden, trotzdem löschen",
    recoveryTitle: "Wiederherstellungsphrase für dieses Gerät",
    recoveryHint:
      "Schreiben Sie die 12 Wörter exakt auf und bewahren Sie sie offline auf. Wenn Sie alle Geräte und diese Phrase verlieren, können synchronisierte Daten nicht wiederhergestellt werden.",
    recoveryNotice:
      "Dieser Bildschirm zeigt die Wiederherstellungsphrase nur, wenn Sie lokale Sync-Schlüssel vorbereiten oder neu erstellen.",
    recoveryShownOnce: "Wird nach der Erstellung nur einmal angezeigt.",
    recoveryExportLabel: "Als Text exportieren",
    recoveryCodeTitle: "Konto-Wiederherstellungscode",
    recoveryCodeHint:
      "Speichern Sie diesen Code sicher. Er wird nur einmal angezeigt und erlaubt Ihnen, das Passwort Ihres Sync-Kontos zurückzusetzen, falls Sie es vergessen.",
    prepareLabel: "Wiederherstellungsphrase erstellen",
    regenerateLabel: "Neue Wiederherstellungsphrase erstellen",
    regeneratePrompt:
      "Das Neuerstellen lokaler Sync-Schlüssel macht ältere verschlüsselte Sync-Backups ungültig, bis Sie die neue Wiederherstellungsphrase verwenden. Fortfahren?",
    regenerateAccept: "Neue Phrase erstellen",
    regenerateDeviceAuthPrompt:
      "Bestätigen Sie mit Geräteschutz, um eine neue Wiederherstellungsphrase für dieses Gerät zu erstellen.",
    discardChangesLabel: "Änderungen verwerfen",
    saveBeforeLeaveLabel: "Speichern und verlassen",
    keepEditingLabel: "Weiter bearbeiten",
    unsavedPrompt:
      "Sie haben ungespeicherte Änderungen für Backup und Sync. Vor dem Verlassen speichern?",
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
    deleted: "Konto gelöscht. Rückkehr zum Onboarding.",
    renewalCancelled:
      "Automatische Verlängerung ist aus. Ihr Tarif bleibt bis zum Ende des aktuellen Zeitraums aktiv.",
    renewalResumed: "Automatische Verlängerung ist wieder aktiv.",
    errors: {
      ...settingsCopyEn.account.errors,
      renewalUnavailable:
        "Die Verlängerung dieses Tarifs kann nicht in der App verwaltet werden.",
      renewalUpdateFailed:
        "Die Verlängerungseinstellung konnte gerade nicht geändert werden. Bitte versuchen Sie es erneut.",
      loginRequired: "Login ist erforderlich.",
      passwordRequired: "Passwort ist erforderlich.",
      passwordTooShort: "Das Passwort muss mindestens 12 Zeichen lang sein.",
      deviceLabelRequired: "Die Gerätebezeichnung ist erforderlich.",
      endpointRequired: "Geben Sie einen Sync-Server-Endpunkt ein.",
      invalidEndpoint: "Geben Sie einen gültigen Host, eine IP-Adresse oder eine vollständige URL ein.",
      unsupportedScheme:
        "Nur https und zugelassene lokale http-Endpunkte werden unterstützt.",
      insecurePublicHttp:
        "Öffentliche Sync-Endpunkte müssen https verwenden.",
      invalidRegistrationInput:
        "Nutzen Sie einen gültigen Login und ein stärkeres Passwort.",
      registrationFailed:
        "Mit diesen Angaben konnte kein Sync-Konto erstellt werden.",
      invalidCredentials: "Ungültiger Login oder ungültiges Passwort.",
      recoveryPhraseRequired: "Die Wiederherstellungsphrase ist erforderlich.",
      invalidRecoveryPhrase:
        "Geben Sie die exakte Wiederherstellungsphrase mit 12 Wörtern ein.",
      recoveryNotAvailable:
        "Dieser Sync-Server unterstützt keinen Import per Wiederherstellungsphrase.",
      recoveryPackageNotFound:
        "Für dieses Konto ist noch kein Recovery-Paket gespeichert.",
      tooManyDevices:
        "Dieses Konto hat das Geräte-Limit erreicht. Öffnen Sie auf einem noch verbundenen Gerät Backup & Sync und entfernen Sie ein Gerät, das Sie nicht mehr verwenden, um einen Platz freizugeben.",
      syncNotPrepared:
        "Bereiten Sie zuerst den verschlüsselten Sync auf diesem Gerät vor.",
      notConnected:
        "Verbinden Sie dieses Gerät zuerst mit einem Sync-Server.",
      blobNotFound:
        "Auf diesem Server gibt es noch keine verschlüsselte Sicherungskopie.",
      invalidPayload:
        "Die verschlüsselte Sicherungskopie vom Server konnte nicht gelesen werden.",
      networkFailed:
        "Der Sync-Server ist gerade nicht erreichbar.",
      recoveryExportUnavailable:
        "Dieses Gerät kann die Wiederherstellungsphrase gerade nicht exportieren.",
      recoveryExportFailed:
        "Die Wiederherstellungsphrase konnte gerade nicht exportiert werden. Bitte versuchen Sie es erneut.",
      deviceAuthUnavailable:
        "Richten Sie auf diesem Gerät zuerst einen Code oder Biometrie ein, bevor Sie lokale Sync-Schlüssel neu erstellen.",
      deviceAuthFailed:
        "Der Geräteschutz konnte gerade nicht bestätigt werden. Bitte versuchen Sie es erneut.",
      saveFailed:
        "Der verschlüsselte Sync konnte gerade nicht vorbereitet werden. Bitte versuchen Sie es erneut.",
      syncFailed:
        "Die verschlüsselte Sicherungskopie konnte gerade nicht hochgeladen werden. Bitte versuchen Sie es erneut.",
      restoreFailed:
        "Die verschlüsselte Sicherungskopie konnte gerade nicht wiederhergestellt werden. Bitte versuchen Sie es erneut.",
      deleteAccountFailed:
        "Ihr Konto konnte gerade nicht gelöscht werden. Es wurde nichts geändert. Bitte versuchen Sie es erneut.",
    },
  },
  symptoms: {
    ...settingsCopyEn.symptoms,
    title: "Eigene Symptome",
    subtitle:
      "Erstellen Sie kurze private Bezeichnungen für Muster, die Sie protokollieren möchten.",
    name: "Symptomname",
    namePlaceholder: "Symptomname eingeben",
    nameHint:
      "Verwenden Sie höchstens 40 Zeichen. Für längere Details nutzen Sie Notizen.",
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
      "Vergangene Einträge behalten sie. Stellen Sie eines wieder her, wenn es wieder im Auswahlfeld erscheinen soll.",
    archivedItem: "In neuen Einträgen verborgen",
    archivedBadge: "Verborgen",
    empty:
      "Es gibt noch keine eigenen Symptome. Fügen Sie oben eines hinzu, damit es in neuen Einträgen verfügbar ist.",
    emptyActive:
      "Zurzeit sind keine sichtbaren eigenen Symptome vorhanden. Stellen Sie unten eines wieder her oder fügen Sie oben ein neues hinzu.",
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
        "Verwenden Sie höchstens 40 Zeichen. Für längere Details nutzen Sie Notizen.",
      labelInvalidCharacters:
        "Verwenden Sie nur Klartext. Spitzklammern und Steuerzeichen sind nicht erlaubt.",
      duplicateLabel: "Dieser Symptomname existiert bereits in Ihrer Liste.",
      saveFailed:
        "Dieses Symptom konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut.",
      notFound:
        "Dieses Symptom konnte nicht mehr gefunden werden. Laden Sie die Einstellungen neu und versuchen Sie es erneut.",
    },
  },
  export: {
    ...settingsCopyEn.export,
    title: "Daten exportieren",
    subtitle:
      "Erstellen Sie ein lokales Backup oder eine ärztetaugliche Tabelle aus Ihren erfassten Einträgen.",
    storageHint:
      "Exporte enthalten nur manuell erfasste Einträge. Vorhersagen sind nicht enthalten.",
    sensitiveHint:
      "Exportierte Dateien sind sensibel. Speichern und teilen Sie sie nur an Orten, denen Sie vertrauen.",
    pdfCloudOnlyHint:
      "Der PDF-Export ist ein Ovumcy-Cloud-Vorteil. CSV und JSON bleiben lokal auf diesem Gerät verfügbar.",
    pdfPlanHint:
      "Dieses Ovumcy-Cloud-Konto braucht einen aktiven Tarif, um den PDF-Export freizuschalten.",
    noData:
      "Es gibt noch keine erfassten Einträge. Sobald Sie Tage im Dashboard oder Kalender protokollieren, wird der Export hier verfügbar.",
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
      invalidFromDate: "Verwenden Sie ein gültiges Startdatum.",
      invalidToDate: "Verwenden Sie ein gültiges Enddatum.",
      invalidRange:
        "Das Enddatum muss am oder nach dem Startdatum liegen.",
      pdfLocked:
        "Der PDF-Export ist nur mit einem aktiven Ovumcy-Cloud-Tarif verfügbar.",
      exportFailed:
        "Der Export konnte gerade nicht vorbereitet werden. Bitte versuchen Sie es erneut.",
      deliveryUnavailable:
        "Dieses Gerät kann das Exportziel gerade nicht öffnen. Versuchen Sie es über einen unterstützten Browser oder ein Gerät mit Teilen/Speichern-Funktion.",
      deliveryFailed:
        "Die Exportdatei wurde vorbereitet, aber das Teilen oder Herunterladen ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
    },
  },
  import: {
    title: "Aus Sicherung wiederherstellen",
    subtitle:
      "Importieren Sie einen früheren Ovumcy-JSON-Export. Es werden nur Tage hinzugefügt, die Sie noch nicht haben — nichts wird überschrieben oder gelöscht.",
    pickAction: "Exportdatei auswählen",
    previewTitle: "Bereit zur Wiederherstellung",
    previewCreatedTemplate: "Sicherung erstellt: %s",
    previewRangeTemplate: "Zeitraum der Sicherung: %s bis %s",
    previewTotalTemplate: "Einträge in der Sicherung: %d",
    previewAddTemplate: "Neue Tage zum Hinzufügen: %d",
    previewSkipTemplate: "Tage bereits auf diesem Gerät (bleiben unverändert): %d",
    previewRejectTemplate: "Einträge, die nicht importiert werden können: %d",
    previewSymptomsTemplate: "Neue eigene Symptome: %d",
    previewProfileRestore:
      "Die Zykluseinstellungen aus der Sicherung werden übernommen — dieses Gerät hat noch die Standardeinstellungen.",
    previewProfileKept: "Ihre aktuellen Einstellungen bleiben unverändert.",
    previewNothingNew:
      "Alles aus dieser Sicherung ist bereits auf diesem Gerät vorhanden.",
    confirmAction: "Jetzt wiederherstellen",
    cancelAction: "Abbrechen",
    applyingLabel: "Wird wiederhergestellt...",
    successTemplate: "%d Tage wiederhergestellt (%d bereits vorhanden, %d ignoriert).",
    successProfileNote:
      "Die Zykluseinstellungen wurden aus der Sicherung wiederhergestellt.",
    errors: {
      malformed:
        "Diese Datei konnte nicht als Sicherung gelesen werden. Wählen Sie einen unveränderten JSON-Export aus Ovumcy.",
      unrecognizedFormat: "Diese Datei ist kein gültiger Ovumcy-Export.",
      tooLarge: "Diese Datei ist zu groß zum Importieren.",
      pickUnavailable:
        "Die Dateiauswahl ist auf diesem Gerät gerade nicht verfügbar.",
      readFailed:
        "Die ausgewählte Datei konnte nicht gelesen werden. Bitte versuchen Sie es erneut.",
      importFailed:
        "Wiederherstellung fehlgeschlagen. Bitte versuchen Sie es erneut.",
    },
  },
  danger: {
    ...settingsCopyEn.danger,
    title: "Gefahrenbereich",
    subtitle:
      "Das Schließen der App löscht keine lokalen Daten. Nutzen Sie dies nur, wenn Sie Gesundheitsdaten von diesem Gerät entfernen möchten.",
    clearTitle: "Alle lokalen Daten löschen",
    clearSubtitle:
      "Entfernt Onboarding, Profileinstellungen, tägliche Einträge, eigene Symptome und den lokalen Exportstatus und bringt die App anschließend zurück ins Onboarding.",
    confirmationLabel: "Zum Bestätigen CLEAR eingeben",
    confirmationHint:
      "Diese Aktion kann in der App nicht rückgängig gemacht werden. Exportieren Sie zuerst ein Backup, wenn Sie Ihre Einträge behalten möchten.",
    deviceAuthPrompt:
      "Bestätigen Sie mit Geräteschutz, um lokale Daten von diesem Gerät zu löschen.",
    action: "Lokale Daten löschen",
    success: "Lokale Daten gelöscht. Zurück zum Onboarding.",
    invalidConfirmation:
      "Geben Sie zum Bestätigen exakt CLEAR ein.",
    deviceAuthUnavailable:
      "Richten Sie auf diesem Gerät zuerst einen Code oder Biometrie ein, bevor Sie lokale Daten löschen.",
    deviceAuthFailed:
      "Der Geräteschutz konnte gerade nicht bestätigt werden. Bitte versuchen Sie es erneut.",
    failed:
      "Lokale Daten konnten gerade nicht gelöscht werden. Bitte versuchen Sie es erneut.",
  },
  status: {
    ...settingsCopyEn.status,
    cycleSaved:
      "Zykluseinstellungen gespeichert. Vorhersagen wurden aktualisiert.",
    trackingSaved:
      "Tracking-Felder für Dashboard und Kalender aktualisiert.",
    invalidLastPeriodStart:
      "Bitte geben Sie ein gültiges Startdatum der letzten Periode ein, das nicht in der Zukunft liegt.",
    saveFailed:
      "Ihre Einstellungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  },
  premiumLock: {
    eyebrowLabel: "Premium",
    ctaLabel: "Ovumcy Cloud öffnen",
    remindersTitle: "Erinnerungs-E-Mails",
    pdfExportTitle: "Arztgerechtes PDF",
  },
};

const settingsCopyFr: SettingsCopy = {
  ...settingsCopyEn,
  title: "Réglages",
  subtitle:
    "Gérez les paramètres du cycle, les champs de suivi, les actions d'export et le comportement local du profil.",
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
      "Valeur de secours facultative si votre journal n'a pas encore de début de cycle marqué.",
    warningApproximate:
      "Avec ces valeurs, l'ovulation ne peut pas être calculée de façon fiable. La prédiction sera approximative.",
    infoAdjusted:
      "La durée des règles a été ajustée automatiquement pour qu'il reste au moins 10 jours avant le cycle suivant.",
    infoPeriodLong:
      "Une durée supérieure à 8 jours peut indiquer des irrégularités. Parlez-en avec un médecin.",
    infoCycleLong:
      "Un cycle de plus de 45 jours est moins courant. Parlez-en avec un médecin.",
    infoCycleShort:
      "Un cycle inférieur à 24 jours est moins courant. Parlez-en avec un médecin.",
    autoPeriodFill: "Remplir automatiquement les jours de règles",
    autoPeriodFillHint:
      "Quand cette option est activée, marquer le premier jour remplit automatiquement les jours suivants selon la durée de vos règles.",
    predictionModeLabel: "Mode de prédiction",
    predictionModeHint: "Choisissez comment Ovumcy doit afficher les prévisions de dates.",
    predictionModeRegular: "Régulier",
    predictionModeRegularHint:
      "Affiche la vue standard des prévisions à partir de vos réglages de cycle et de votre historique.",
    predictionModeIrregular: "Irrégulier",
    predictionModeIrregularHint:
      "Laisse les prévisions visibles, mais lisez-les comme une indication approximative.",
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
      "Choisissez des champs supplémentaires pour les entrées quotidiennes. Les valeurs enregistrées restent dans votre historique privé.",
    trackBBT: "Afficher le champ TB",
    trackBBTHint:
      "Affiche un champ de température basale dans le tableau de bord et les entrées du calendrier.",
    trackBBTStateOn:
      "Actuellement visible dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    trackBBTStateOff:
      "Actuellement masqué dans les nouvelles entrées du tableau de bord et du calendrier.",
    trackCervicalMucus: "Afficher le champ de glaire cervicale",
    trackCervicalMucusHint:
      "Affiche des choix de glaire cervicale dans le tableau de bord et les entrées du calendrier.",
    trackCervicalMucusStateOn:
      "Actuellement visible dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    trackCervicalMucusStateOff:
      "Actuellement masqué dans les nouvelles entrées du tableau de bord et du calendrier.",
    hideSexChip: "Afficher la section intimité",
    hideSexChipHint:
      "Affiche l'intimité dans les nouvelles entrées du tableau de bord et du calendrier.",
    hideSexChipStateOn:
      "Actuellement visible dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    hideSexChipStateOff:
      "Actuellement masquée dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    hideNotes: "Afficher la section notes",
    hideNotesHint:
      "Masque les notes dans le tableau de bord et les entrées du calendrier sans supprimer les notes enregistrées.",
    hideNotesStateOn:
      "Actuellement visible dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    hideNotesStateOff:
      "Actuellement masquée dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    showHistoricalPhases: "Afficher les fenêtres fertiles sur les cycles passés",
    showHistoricalPhasesHint:
      "Affiche l'ovulation, le pic de fertilité et les marqueurs pré-fertiles sur les cycles passés terminés dans le calendrier, à partir des débuts de cycle enregistrés.",
    showHistoricalPhasesStateOn:
      "Actuellement affiché sur les mois passés du calendrier.",
    showHistoricalPhasesStateOff:
      "Actuellement masqué ; seuls les prochains cycles prédits affichent des fenêtres fertiles.",
    hideCycleFactors: "Afficher les facteurs de cycle",
    hideCycleFactorsHint:
      "Ajoute les étiquettes de facteurs de cycle (stress, maladie, voyage, ...) au tableau de bord et aux entrées du calendrier sans supprimer les étiquettes enregistrées.",
    hideCycleFactorsStateOn:
      "Actuellement visible dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    hideCycleFactorsStateOff:
      "Actuellement masqué dans le tableau de bord et dans l'éditeur journalier du calendrier.",
    temperatureUnit: "Unité TB",
    temperatureUnitHint: "Utilisée quand le champ TB est visible.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Enregistrer le suivi",
  },
  reminders: {
    title: "Rappels",
    subtitle:
      "Gardez les rappels de l’appareil privés sur cet appareil et utilisez des e-mails prudents quand la livraison premium est active.",
    localOnlyHint:
      "Les rappels de l’appareil restent sur cet appareil uniquement. Ils n’envoient pas vos données de santé à un serveur.",
    emailHint:
      "Les e-mails de rappel premium envoient seulement des messages génériques. Ils n’incluent jamais les symptômes, les notes ni des détails fertiles.",
    lockedHint:
      "Les e-mails de rappel nécessitent un abonnement Ovumcy Cloud actif. Les rappels sur cet appareil fonctionnent sans compte ni abonnement, et vos choix enregistrés restent locaux.",
    timeLabel: "Heure du rappel",
    timeHint:
      "Utilisée pour le rappel quotidien et pour les prochains rappels de cycle planifiés sur cet appareil.",
    leadDaysLabel: "Délai de rappel (jours)",
    leadDaysHint:
      "Combien de jours avant la fenêtre de règles prédite cet appareil planifie le rappel (0–14). La valeur 0 vous rappelle le jour même.",
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
    statusOn: "Activé",
    statusOff: "Désactivé",
    saved: "Les réglages de rappel ont été mis à jour pour cet appareil.",
    savedWithEmail:
      "Les réglages de rappel ont été mis à jour. Les e-mails de rappel Ovumcy Cloud utilisent maintenant des messages prudents.",
    emailUnavailable:
      "Les réglages de rappel ont été enregistrés, mais les e-mails de rappel Ovumcy Cloud sont indisponibles pour le moment.",
    emailSyncFailed:
      "Les réglages de rappel ont été enregistrés, mais les e-mails de rappel Ovumcy Cloud n’ont pas pu être mis à jour pour le moment.",
    permissionDenied:
      "Autorisez les notifications dans les réglages de l’appareil pour recevoir les rappels sur cet appareil.",
    unavailable:
      "Cet appareil ne peut pas planifier de rappels locaux pour le moment.",
    errors: {
      invalidTime: "Utilisez une heure valide au format HH:MM.",
      saveFailed:
        "Impossible d’enregistrer les réglages de rappel pour le moment. Réessayez.",
    },
  },
  interface: {
    ...settingsCopyEn.interface,
    title: "Interface",
    subtitle:
      "Contrôlez la langue et l'apparence de l'app sur cet appareil.",
    languageLabel: "Langue",
    languageHint: "Enregistrée seulement sur cet appareil.",
    previewHint:
      "La langue et le thème se prévisualisent immédiatement. Enregistrez pour les conserver sur cet appareil.",
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
    themeSystem: "Système",
    saved: "Les réglages d'interface ont été mis à jour sur cet appareil.",
    languageSaved: "Langue mise à jour sur cet appareil.",
    themeSaved: "Thème mis à jour sur cet appareil.",
    unsavedPrompt:
      "Vous avez des modifications de réglages non enregistrées. Les enregistrer avant de quitter ?",
  },
  account: {
    ...settingsCopyEn.account,
    title: "Sauvegarde et sync",
    subtitle:
      "Protégez d'abord cet appareil, puis connectez Ovumcy Cloud ou votre propre serveur de sync.",
    hubSubtitle:
      "Ouvrez un écran séparé pour la phrase de récupération, la connexion du compte, le plan cloud et les actions de sync.",
    openHubLabel: "Ouvrir sauvegarde et sync",
    backToSettingsLabel: "Retour aux réglages",
    localStepTitle: "1. Protéger cet appareil",
    localStepHint:
      "Créez une phrase de récupération sur cet appareil. Gardez-la hors ligne au cas où vous auriez besoin de restaurer vos données.",
    preparingTitle: "Préparation de votre sauvegarde protégée...",
    preparingHint:
      "Ovumcy génère une phrase de récupération sur cet appareil en ce moment.",
    accountStepTitle: "2. Connecter un compte",
    accountStepHintManaged:
      "Connectez-vous ici à votre compte Ovumcy Cloud. Vos données de santé restent synchronisées séparément sous forme de sauvegarde chiffrée.",
    accountStepHintSelfHosted:
      "Créez un compte sur votre propre serveur de sync ou connectez-vous-y.",
    planStepTitle: "3. Plan cloud",
    planStepHint:
      "L'accès cloud et la facturation sont vérifiés séparément. Le sync s'active seulement quand ce compte a un plan Ovumcy Cloud actif.",
    planSignInFirst:
      "Connectez-vous d'abord pour vérifier l'état de votre abonnement.",
    planUnknown:
      "Ovumcy vérifie si ce compte cloud a un plan actif.",
    planInactive:
      "Ce compte cloud est connecté, mais le sync cloud reste bloqué car aucun plan actif n'a été trouvé.",
    planCheckFailed:
      "Ovumcy n'a pas pu confirmer le plan cloud pour le moment. Réessayez dans un instant.",
    planUnavailable:
      "Votre compte Ovumcy Cloud et la facturation restent séparés du stockage de sync chiffré.",
    planActive: "Ovumcy Cloud est actif pour ce compte.",
    checkPlanAgain: "Revérifier le plan",
    advancedSectionLabel: "Avancé",
    syncStepTitle: "4. Synchroniser cette sauvegarde",
    syncStepHintManaged:
      "Une fois que ce compte cloud a un plan actif, vous pouvez téléverser ou restaurer la sauvegarde protégée ici.",
    syncStepHintSelfHosted:
      "Après connexion à votre propre serveur, vous pourrez téléverser ou restaurer la sauvegarde protégée ici.",
    syncBlockedNoPlan:
      "Le sync cloud reste bloqué tant que ce compte n'a pas un plan Ovumcy Cloud actif.",
    modeLabel: "Mode de sync",
    modeManaged: "Ovumcy Cloud",
    modeSelfHosted: "Self-hosted",
    managedHint:
      "Ovumcy Cloud stocke votre sauvegarde chiffrée sur notre service hébergé. Self-hosted garde le sync sur votre propre serveur.",
    selfHostedHint:
      "Utilisez un hôte, une IP:port ou une URL complète. Le http public est refusé ; http localhost et réseau privé sont autorisés.",
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
      "Utilisez cette option quand cet appareil n'a plus de clés locales de sync, mais que vous avez encore le mot de passe du compte et la phrase de récupération de 12 mots.",
    recoveryPhraseInputLabel: "Phrase de récupération",
    recoveryPhraseInputPlaceholder: "douze mots séparés par des espaces",
    recoveryPhraseInputHint:
      "Saisissez exactement les 12 mots qui protègent votre clé maître de sync.",
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
      "Confirmez avec la sécurité de l'appareil pour restaurer des données chiffrées depuis le serveur de sync.",
    uploadOverBackupPrompt:
      "Ce compte a déjà une copie de sauvegarde chiffrée sur le serveur, mais cet appareil n'a jamais synchronisé. Le téléversement remplacera cette copie serveur par les données de cet appareil. La remplacer ?",
    uploadOverBackupAccept: "Remplacer la copie serveur",
    renewalCancelLabel: "Désactiver le renouvellement automatique",
    renewalResumeLabel: "Réactiver le renouvellement automatique",
    renewalCancelPrompt:
      "Désactiver le renouvellement automatique ? Votre plan reste actif jusqu'à la fin de la période déjà payée.",
    renewalCancelAccept: "Désactiver le renouvellement",
    offerDismissLabel: "Ignorer cette offre",
    offerPromoEyebrow: "Offre",
    offerAnnouncementEyebrow: "Actualité",
    disconnectPrompt:
      "Déconnecter cet appareil de la session du serveur de sync ? Les clés chiffrées locales resteront sur cet appareil.",
    disconnectDeviceAuthPrompt:
      "Confirmez avec la sécurité de l'appareil pour déconnecter cet appareil du serveur de sync.",
    deleteAccountLabel: "Supprimer le compte",
    deleteAccountPrompt:
      "Supprimer définitivement votre compte et toutes ses données du serveur ? Cette action est irréversible.",
    deleteAccountAccept: "Supprimer le compte",
    deleteAccountDeviceAuthPrompt:
      "Confirmez avec la sécurité de l'appareil pour supprimer définitivement votre compte.",
    deleteAccountSubscriptionWarningTitle:
      "Votre abonnement continuera d'être facturé",
    deleteAccountSubscriptionWarningMessage:
      "Supprimer votre compte n'annule PAS votre abonnement Google Play. Vous devez l'annuler séparément dans le Play Store, sinon vous continuerez à être facturé. Ne confirmez ci-dessous que si vous avez compris et que vous souhaitez quand même supprimer définitivement votre compte.",
    deleteAccountSubscriptionWarningAccept: "J'ai compris, supprimer quand même",
    recoveryTitle: "Phrase de récupération pour cet appareil",
    recoveryHint:
      "Notez exactement les 12 mots et gardez-les hors ligne. Si vous perdez tous les appareils et cette phrase, les données synchronisées ne pourront pas être récupérées.",
    recoveryCodeTitle: "Code de récupération du compte",
    recoveryCodeHint:
      "Conservez ce code en lieu sûr. Il s'affiche une seule fois et permet de réinitialiser le mot de passe de votre compte de sync si vous l'oubliez.",
    recoveryNotice:
      "Cet écran affiche la phrase de récupération seulement quand vous préparez ou recréez les clés locales de sync.",
    recoveryShownOnce: "Affichée une seule fois après la génération.",
    recoveryExportLabel: "Exporter en texte",
    prepareLabel: "Créer la phrase de récupération",
    regenerateLabel: "Créer une nouvelle phrase de récupération",
    regeneratePrompt:
      "Recréer les clés locales de sync invalide les anciennes sauvegardes chiffrées tant que vous n'utilisez pas la nouvelle phrase de récupération. Continuer ?",
    regenerateAccept: "Créer une nouvelle phrase",
    regenerateDeviceAuthPrompt:
      "Confirmez avec la sécurité de l'appareil pour créer une nouvelle phrase de récupération pour cet appareil.",
    discardChangesLabel: "Annuler les modifications",
    saveBeforeLeaveLabel: "Enregistrer et quitter",
    keepEditingLabel: "Continuer la modification",
    unsavedPrompt:
      "Vous avez des modifications de sauvegarde et de sync non enregistrées. Les enregistrer avant de quitter cet écran ?",
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
    deleted: "Compte supprimé. Retour à l'onboarding.",
    renewalCancelled:
      "Renouvellement automatique désactivé. Votre plan reste actif jusqu'à la fin de la période en cours.",
    renewalResumed: "Renouvellement automatique réactivé.",
    errors: {
      ...settingsCopyEn.account.errors,
      renewalUnavailable:
        "Le renouvellement de ce plan ne peut pas être géré depuis l'app.",
      renewalUpdateFailed:
        "Impossible de modifier le renouvellement pour le moment. Veuillez réessayer.",
      loginRequired: "L'identifiant est obligatoire.",
      passwordRequired: "Le mot de passe est obligatoire.",
      passwordTooShort: "Le mot de passe doit comporter au moins 12 caractères.",
      deviceLabelRequired: "Le nom de l'appareil est obligatoire.",
      endpointRequired: "Saisissez un point d'accès du serveur de sync.",
      invalidEndpoint:
        "Saisissez un hôte, une adresse IP ou une URL complète valide.",
      unsupportedScheme:
        "Seuls https et les endpoints http approuvés pour le réseau local sont pris en charge.",
      insecurePublicHttp:
        "Les endpoints publics de sync doivent utiliser https.",
      invalidRegistrationInput:
        "Utilisez un identifiant valide et un mot de passe plus robuste.",
      registrationFailed:
        "Impossible de créer un compte de sync avec ces informations.",
      invalidCredentials: "Identifiant ou mot de passe invalide.",
      recoveryPhraseRequired: "La phrase de récupération est obligatoire.",
      invalidRecoveryPhrase:
        "Saisissez exactement la phrase de récupération de 12 mots.",
      recoveryNotAvailable:
        "Ce serveur de sync ne prend pas en charge l'import par phrase de récupération.",
      recoveryPackageNotFound:
        "Aucun paquet de récupération n'est encore stocké pour ce compte.",
      tooManyDevices:
        "Ce compte a atteint la limite d'appareils. Sur un appareil encore connecté, ouvrez Sauvegarde et sync et retirez un appareil que vous n'utilisez plus pour libérer une place.",
      syncNotPrepared:
        "Préparez d'abord le sync chiffré sur cet appareil.",
      notConnected:
        "Connectez d'abord cet appareil à un serveur de sync.",
      blobNotFound:
        "Aucune copie de sauvegarde chiffrée n'existe encore sur ce serveur.",
      invalidPayload:
        "La copie de sauvegarde chiffrée provenant du serveur n'a pas pu être lue.",
      networkFailed:
        "Impossible d'atteindre le serveur de sync pour le moment.",
      recoveryExportUnavailable:
        "Cet appareil ne peut pas exporter la phrase de récupération pour le moment.",
      recoveryExportFailed:
        "La phrase de récupération n'a pas pu être exportée pour le moment. Réessayez.",
      deviceAuthUnavailable:
        "Configurez un code ou la biométrie sur cet appareil avant de recréer les clés locales de sync.",
      deviceAuthFailed:
        "Impossible de confirmer la sécurité de l'appareil pour le moment. Réessayez.",
      saveFailed:
        "Impossible de préparer le sync chiffré pour le moment. Réessayez.",
      syncFailed:
        "Impossible de téléverser la copie de sauvegarde chiffrée pour le moment. Réessayez.",
      restoreFailed:
        "Impossible de restaurer la copie de sauvegarde chiffrée pour le moment. Réessayez.",
      deleteAccountFailed:
        "Impossible de supprimer votre compte pour le moment. Rien n'a été modifié. Veuillez réessayer.",
    },
  },
  symptoms: {
    ...settingsCopyEn.symptoms,
    title: "Symptômes personnalisés",
    subtitle:
      "Créez des libellés privés et courts pour les schémas que vous voulez enregistrer.",
    name: "Nom du symptôme",
    namePlaceholder: "Saisir le nom du symptôme",
    nameHint:
      "Utilisez 40 caractères ou moins. Pour plus de détails, utilisez les notes.",
    icon: "Icône",
    add: "Ajouter un symptôme",
    save: "Enregistrer le symptôme",
    hide: "Masquer",
    restore: "Restaurer",
    activeHeading: "Visible dans les nouvelles entrées",
    activeHint:
      "Les symptômes personnalisés actifs apparaissent dans le tableau de bord et le calendrier.",
    activeItem: "Visible dans les nouvelles entrées",
    archivedHeading: "Archivé dans les nouvelles entrées",
    archivedHint:
      "Les anciens enregistrements le conservent. Restaurez-en un quand vous voulez le revoir dans le sélecteur.",
    archivedItem: "Masqué dans les nouvelles entrées",
    archivedBadge: "Masqué",
    empty:
      "Aucun symptôme personnalisé pour le moment. Ajoutez-en un ci-dessus pour l'utiliser dans les nouvelles entrées.",
    emptyActive:
      "Aucun symptôme personnalisé visible pour le moment. Restaurez-en un ci-dessous ou ajoutez-en un nouveau ci-dessus.",
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
        "Utilisez 40 caractères ou moins. Pour plus de détails, utilisez les notes.",
      labelInvalidCharacters:
        "Utilisez uniquement du texte simple. Les chevrons et caractères de contrôle ne sont pas autorisés.",
      duplicateLabel: "Ce nom de symptôme existe déjà dans votre liste.",
      saveFailed:
        "Impossible d'enregistrer ce symptôme pour le moment. Réessayez.",
      notFound:
        "Impossible de retrouver ce symptôme. Rechargez les réglages et réessayez.",
    },
  },
  export: {
    ...settingsCopyEn.export,
    title: "Exporter les données",
    subtitle:
      "Créez une sauvegarde locale ou un tableau lisible pour un médecin à partir de vos entrées enregistrées.",
    storageHint:
      "Les exports incluent seulement les enregistrements saisis manuellement. Les prédictions ne sont pas incluses.",
    sensitiveHint:
      "Les fichiers exportés sont sensibles. Enregistrez-les et partagez-les seulement vers une destination de confiance.",
    pdfCloudOnlyHint:
      "L'export PDF est un avantage Ovumcy Cloud. CSV et JSON restent disponibles localement sur cet appareil.",
    pdfPlanHint:
      "Ce compte Ovumcy Cloud a besoin d'un plan actif pour débloquer l'export PDF.",
    noData:
      "Aucune entrée enregistrée pour le moment. Une fois des jours saisis dans le tableau de bord ou le calendrier, l'export apparaîtra ici.",
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
      invalidFromDate: "Utilisez une date de début valide.",
      invalidToDate: "Utilisez une date de fin valide.",
      invalidRange:
        "La date de fin doit être postérieure ou égale à la date de début.",
      pdfLocked:
        "L'export PDF est disponible seulement avec un plan Ovumcy Cloud actif.",
      exportFailed:
        "Impossible de préparer votre export pour le moment. Réessayez.",
      deliveryUnavailable:
        "Cet appareil ne peut pas ouvrir la destination d'export pour le moment. Réessayez depuis un navigateur compatible ou un appareil pouvant partager/enregistrer.",
      deliveryFailed:
        "Le fichier a été préparé, mais le partage ou le téléchargement a échoué. Réessayez.",
    },
  },
  import: {
    title: "Restaurer depuis une sauvegarde",
    subtitle:
      "Importez un export JSON Ovumcy précédent. Seuls les jours que vous n'avez pas déjà sont ajoutés — rien n'est écrasé ni supprimé.",
    pickAction: "Choisir le fichier d'export",
    previewTitle: "Prêt à restaurer",
    previewCreatedTemplate: "Sauvegarde créée : %s",
    previewRangeTemplate: "Période de la sauvegarde : %s à %s",
    previewTotalTemplate: "Entrées dans la sauvegarde : %d",
    previewAddTemplate: "Nouveaux jours à ajouter : %d",
    previewSkipTemplate: "Jours déjà sur cet appareil (conservés tels quels) : %d",
    previewRejectTemplate: "Entrées impossibles à importer : %d",
    previewSymptomsTemplate: "Nouveaux symptômes personnalisés : %d",
    previewProfileRestore:
      "Les réglages de cycle de la sauvegarde seront appliqués — cet appareil a encore les réglages par défaut.",
    previewProfileKept: "Vos réglages actuels restent inchangés.",
    previewNothingNew:
      "Tout le contenu de cette sauvegarde est déjà sur cet appareil.",
    confirmAction: "Restaurer maintenant",
    cancelAction: "Annuler",
    applyingLabel: "Restauration...",
    successTemplate: "%d jours restaurés (%d déjà présents, %d ignorés).",
    successProfileNote:
      "Les réglages de cycle ont été restaurés depuis la sauvegarde.",
    errors: {
      malformed:
        "Ce fichier n'a pas pu être lu comme une sauvegarde. Choisissez un export JSON non modifié créé par Ovumcy.",
      unrecognizedFormat: "Ce fichier n'est pas un export Ovumcy valide.",
      tooLarge: "Ce fichier est trop volumineux pour être importé.",
      pickUnavailable:
        "Le choix de fichiers n'est pas disponible sur cet appareil pour le moment.",
      readFailed: "Le fichier sélectionné n'a pas pu être lu. Réessayez.",
      importFailed: "Échec de la restauration. Réessayez.",
    },
  },
  danger: {
    ...settingsCopyEn.danger,
    title: "Zone de danger",
    subtitle:
      "Fermer l'app ne supprime pas les données locales. Utilisez ceci seulement si vous voulez effacer les données de santé de cet appareil.",
    clearTitle: "Effacer toutes les données locales",
    clearSubtitle:
      "Supprime l'onboarding, les réglages du profil, les entrées quotidiennes, les symptômes personnalisés et l'état local d'export, puis renvoie l'app vers l'onboarding.",
    confirmationLabel: "Tape CLEAR pour confirmer",
    confirmationHint:
      "Cette action ne peut pas être annulée depuis l'app. Exportez d'abord une sauvegarde si vous voulez conserver vos données.",
    deviceAuthPrompt:
      "Confirmez avec la sécurité de l'appareil pour effacer les données locales de cet appareil.",
    action: "Effacer les données locales",
    success: "Données locales effacées. Retour à l'onboarding.",
    invalidConfirmation:
      "Tape exactement CLEAR pour confirmer la suppression des données locales.",
    deviceAuthUnavailable:
      "Configurez un code ou la biométrie sur cet appareil avant d'effacer les données locales.",
    deviceAuthFailed:
      "Impossible de confirmer la sécurité de l'appareil pour le moment. Réessayez.",
    failed:
      "Impossible d'effacer les données locales pour le moment. Réessayez.",
  },
  status: {
    ...settingsCopyEn.status,
    cycleSaved:
      "Réglages du cycle enregistrés. Les prédictions ont été mises à jour.",
    trackingSaved:
      "Les champs de suivi ont été mis à jour pour le tableau de bord et le calendrier.",
    invalidLastPeriodStart:
      "Saisissez une date valide de début des dernières règles qui ne soit pas dans le futur.",
    saveFailed:
      "Impossible d'enregistrer vos réglages. Réessayez.",
  },
  premiumLock: {
    eyebrowLabel: "Premium",
    ctaLabel: "Ouvrir Ovumcy Cloud",
    remindersTitle: "E-mails de rappel",
    pdfExportTitle: "PDF pour votre médecin",
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
      showHistoricalPhases: "Показывать фертильные окна для прошлых циклов",
      showHistoricalPhasesHint:
        "Показывает овуляцию, пик фертильности и предфертильные метки для прошлых завершённых циклов в календаре на основе сохранённых начал циклов.",
      showHistoricalPhasesStateOn:
        "Сейчас показывается для прошлых месяцев календаря.",
      showHistoricalPhasesStateOff:
        "Сейчас скрыто; фертильные окна показываются только для будущих прогнозируемых циклов.",
      hideCycleFactors: "Показывать факторы цикла",
      hideCycleFactorsHint:
        "Добавляет теги факторов цикла (стресс, болезнь, поездка, ...) на панель и в записи календаря, не удаляя сохранённые теги.",
      hideCycleFactorsStateOn:
        "Сейчас видно в dashboard и редакторе дня календаря.",
      hideCycleFactorsStateOff:
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
        "Уведомления на устройстве остаются приватными, а при включённой премиум-доставке email-подсказки не содержат конфиденциальных данных.",
      localOnlyHint:
        "Напоминания устройства остаются только на этом устройстве. Данные о здоровье не отправляются на сервер.",
      emailHint:
        "Премиум email-напоминания содержат только общие подсказки. В них никогда не попадают симптомы, заметки или данные о фертильности.",
      lockedHint:
        "Email-напоминаниям нужен активный план Ovumcy Cloud. Напоминания на этом устройстве работают без аккаунта и плана, а сохранённые настройки остаются на устройстве.",
      timeLabel: "Время напоминания",
      timeHint:
        "Используется для ежедневного напоминания и для ближайших запланированных напоминаний по циклу на этом устройстве.",
      leadDaysLabel: "Заблаговременность напоминания (дней)",
      leadDaysHint:
        "За сколько дней до прогнозируемого окна месячных устройство планирует напоминание (0–14). Значение 0 — напоминание в сам день.",
      emailDelivery: "Также отправлять email-напоминания",
      emailDeliveryHint:
        "Отправляет email через Ovumcy Cloud с текстом без конфиденциальных данных, исходя из включённых типов напоминаний.",
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
      statusOn: "Вкл",
      statusOff: "Выкл",
      saved: "Настройки напоминаний обновлены для этого устройства.",
      savedWithEmail:
        "Настройки напоминаний обновлены. Email-напоминания Ovumcy Cloud теперь используют подсказки без конфиденциальных данных.",
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
      themeSystem: "Системная",
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
      uploadOverBackupPrompt:
        "На сервере уже есть зашифрованная резервная копия этого аккаунта, а это устройство ещё ни разу не синхронизировалось. Загрузка заменит серверную копию данными этого устройства. Заменить?",
      uploadOverBackupAccept: "Заменить копию на сервере",
      renewalCancelLabel: "Отключить автопродление",
      renewalResumeLabel: "Возобновить автопродление",
      renewalCancelPrompt:
        "Отключить автоматическое продление? План останется активным до конца уже оплаченного периода.",
      renewalCancelAccept: "Отключить продление",
      offerDismissLabel: "Скрыть это предложение",
      offerPromoEyebrow: "Предложение",
      offerAnnouncementEyebrow: "Новости",
      disconnectPrompt:
        "Отключить это устройство от сессии sync-сервера? Локальные зашифрованные ключи останутся на устройстве.",
      disconnectDeviceAuthPrompt:
        "Подтвердите защитой устройства отключение этого устройства от sync-сервера.",
      deleteAccountLabel: "Удалить аккаунт",
      deleteAccountPrompt:
        "Безвозвратно удалить ваш аккаунт и все его данные с сервера? Это действие нельзя отменить.",
      deleteAccountAccept: "Удалить аккаунт",
      deleteAccountDeviceAuthPrompt:
        "Подтвердите защитой устройства безвозвратное удаление вашего аккаунта.",
      deleteAccountSubscriptionWarningTitle: "Подписка продолжит списывать средства",
      deleteAccountSubscriptionWarningMessage:
        "Удаление аккаунта НЕ отменяет вашу подписку Google Play. Отменить её нужно отдельно в Play Store, иначе списания продолжатся. Подтверждайте ниже, только если вы это понимаете и всё равно хотите безвозвратно удалить аккаунт.",
      deleteAccountSubscriptionWarningAccept: "Понимаю, всё равно удалить",
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
      deleted: "Аккаунт удалён. Возврат к онбордингу.",
      renewalCancelled:
        "Автопродление отключено. План останется активным до конца текущего периода.",
      renewalResumed: "Автопродление снова включено.",
      errors: {
        loginRequired: "Логин обязателен.",
        passwordRequired: "Пароль обязателен.",
        passwordTooShort: "Пароль должен содержать не менее 12 символов.",
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
        tooManyDevices:
          "Для этого аккаунта уже достигнут лимит устройств. На устройстве, которое ещё подключено, откройте «Резервная копия и sync» и удалите неиспользуемое устройство, чтобы освободить слот.",
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
        deleteAccountFailed:
          "Сейчас не удалось удалить аккаунт. Ничего не изменилось. Попробуйте ещё раз.",
        renewalUnavailable:
          "Продлением этого плана нельзя управлять из приложения.",
        renewalUpdateFailed:
          "Не удалось изменить настройку продления. Попробуйте ещё раз.",
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
    import: {
      title: "Восстановить из резервной копии",
      subtitle:
        "Импортируйте предыдущий JSON-экспорт Ovumcy. Добавляются только дни, которых у Вас ещё нет, — ничего не перезаписывается и не удаляется.",
      pickAction: "Выбрать файл экспорта",
      previewTitle: "Готово к восстановлению",
      previewCreatedTemplate: "Копия создана: %s",
      previewRangeTemplate: "Диапазон копии: %s — %s",
      previewTotalTemplate: "Записей в копии: %d",
      previewAddTemplate: "Новых дней для добавления: %d",
      previewSkipTemplate: "Дней уже есть на устройстве (останутся без изменений): %d",
      previewRejectTemplate: "Записей невозможно импортировать: %d",
      previewSymptomsTemplate: "Новых пользовательских симптомов: %d",
      previewProfileRestore:
        "Настройки цикла из копии будут применены — на этом устройстве ещё стандартные настройки.",
      previewProfileKept: "Ваши текущие настройки останутся без изменений.",
      previewNothingNew: "Всё из этой копии уже есть на этом устройстве.",
      confirmAction: "Восстановить сейчас",
      cancelAction: "Отмена",
      applyingLabel: "Восстановление...",
      successTemplate: "Восстановлено дней: %d (уже было: %d, отклонено: %d).",
      successProfileNote: "Настройки цикла восстановлены из копии.",
      errors: {
        malformed:
          "Не удалось прочитать этот файл как резервную копию. Выберите неизменённый JSON-экспорт, созданный в Ovumcy.",
        unrecognizedFormat: "Этот файл не является допустимым экспортом Ovumcy.",
        tooLarge: "Этот файл слишком большой для импорта.",
        pickUnavailable: "Выбор файлов сейчас недоступен на этом устройстве.",
        readFailed: "Не удалось прочитать выбранный файл. Попробуйте ещё раз.",
        importFailed: "Не удалось восстановить данные. Попробуйте снова.",
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
      remindersTitle: "Email-напоминания",
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
        "Una duración superior a 8 días puede indicar irregularidades; coméntalo con un profesional de la salud.",
      infoCycleLong:
        "Un ciclo de más de 45 días es menos común; coméntalo con un profesional de la salud.",
      infoCycleShort:
        "Un ciclo de menos de 24 días es menos común; coméntalo con un profesional de la salud.",
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
      trackBBT: "Mostrar campo de TBC",
      trackBBTHint:
        "Muestra un campo de temperatura basal en el panel y en el calendario.",
      trackBBTStateOn: "Actualmente visible en el panel y en el editor diario del calendario.",
      trackBBTStateOff: "Actualmente oculto de las nuevas entradas del panel y del calendario.",
      trackCervicalMucus: "Mostrar campo de moco cervical",
      trackCervicalMucusHint:
        "Muestra opciones de moco cervical en el panel y en el calendario.",
      trackCervicalMucusStateOn:
        "Actualmente visible en el panel y en el editor diario del calendario.",
      trackCervicalMucusStateOff:
        "Actualmente oculto de las nuevas entradas del panel y del calendario.",
      hideSexChip: "Mostrar sección de intimidad",
      hideSexChipHint:
        "Muestra la sección de intimidad en nuevas entradas del panel y del calendario.",
      hideSexChipStateOn:
        "Actualmente visible en el panel y en el editor diario del calendario.",
      hideSexChipStateOff:
        "Actualmente oculta en el panel y en el editor diario del calendario.",
      hideNotes: "Mostrar sección de notas",
      hideNotesHint:
        "Oculta las notas en el panel y en las entradas del calendario sin borrar las notas guardadas.",
      hideNotesStateOn:
        "Actualmente visible en el panel y en el editor diario del calendario.",
      hideNotesStateOff:
        "Actualmente oculta en el panel y en el editor diario del calendario.",
      showHistoricalPhases: "Mostrar ventanas fértiles de ciclos pasados",
      showHistoricalPhasesHint:
        "Muestra la ovulación, el pico de fertilidad y los marcadores prefértiles en los ciclos pasados completados del calendario, según los inicios de ciclo registrados.",
      showHistoricalPhasesStateOn:
        "Actualmente se muestra en los meses pasados del calendario.",
      showHistoricalPhasesStateOff:
        "Actualmente oculto; solo los próximos ciclos previstos muestran ventanas fértiles.",
      hideCycleFactors: "Mostrar factores del ciclo",
      hideCycleFactorsHint:
        "Añade etiquetas de factores del ciclo (estrés, enfermedad, viaje, ...) al panel y a las entradas del calendario sin borrar las etiquetas guardadas.",
      hideCycleFactorsStateOn:
        "Actualmente visible en el panel y en el editor diario del calendario.",
      hideCycleFactorsStateOff:
        "Actualmente oculto en el panel y en el editor diario del calendario.",
      temperatureUnit: "Unidad de TBC",
      temperatureUnitHint: "Se usa cuando el campo de TBC está visible.",
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
        "Los correos de recordatorio necesitan un plan activo de Ovumcy Cloud. Los recordatorios en este dispositivo funcionan sin cuenta ni plan, y tus opciones guardadas siguen siendo locales.",
      timeLabel: "Hora del recordatorio",
      timeHint:
        "Se usa para el recordatorio diario y para los próximos recordatorios del ciclo programados en este dispositivo.",
      leadDaysLabel: "Antelación del recordatorio (días)",
      leadDaysHint:
        "Con cuántos días de antelación este dispositivo programa el recordatorio antes de la ventana de período prevista (0–14). El valor 0 te recuerda el mismo día.",
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
      statusOn: "Activado",
      statusOff: "Desactivado",
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
      themeSystem: "Sistema",
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
      uploadOverBackupPrompt:
        "Esta cuenta ya tiene una copia de respaldo cifrada en el servidor, pero este dispositivo nunca ha sincronizado. Subir ahora sustituirá esa copia del servidor por los datos de este dispositivo. ¿Sustituirla?",
      uploadOverBackupAccept: "Sustituir copia del servidor",
      renewalCancelLabel: "Desactivar la renovación automática",
      renewalResumeLabel: "Reanudar la renovación automática",
      renewalCancelPrompt:
        "¿Desactivar la renovación automática? Tu plan sigue activo hasta el final del periodo ya pagado.",
      renewalCancelAccept: "Desactivar renovación",
      offerDismissLabel: "Descartar esta oferta",
      offerPromoEyebrow: "Oferta",
      offerAnnouncementEyebrow: "Novedades",
      disconnectPrompt:
        "¿Desconectar este dispositivo de la sesión del servidor de sync? Las claves cifradas locales permanecerán en este dispositivo.",
      disconnectDeviceAuthPrompt:
        "Confirma con la seguridad del dispositivo para desconectar este dispositivo del servidor de sync.",
      deleteAccountLabel: "Eliminar cuenta",
      deleteAccountPrompt:
        "¿Eliminar permanentemente tu cuenta y todos sus datos del servidor? Esta acción no se puede deshacer.",
      deleteAccountAccept: "Eliminar cuenta",
      deleteAccountDeviceAuthPrompt:
        "Confirma con la seguridad del dispositivo para eliminar permanentemente tu cuenta.",
      deleteAccountSubscriptionWarningTitle:
        "Tu suscripción seguirá cobrándose",
      deleteAccountSubscriptionWarningMessage:
        "Eliminar tu cuenta NO cancela tu suscripción de Google Play. Debes cancelarla por separado en Play Store, o se te seguirá cobrando. Confirma abajo solo si entiendes esto y aun así quieres eliminar permanentemente tu cuenta.",
      deleteAccountSubscriptionWarningAccept: "Entiendo, eliminar de todos modos",
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
      deleted: "Cuenta eliminada. Volviendo al onboarding.",
      renewalCancelled:
        "La renovación automática está desactivada. Tu plan sigue activo hasta el final del periodo actual.",
      renewalResumed: "La renovación automática está activada de nuevo.",
      errors: {
        loginRequired: "El login es obligatorio.",
        passwordRequired: "La contraseña es obligatoria.",
        passwordTooShort: "La contraseña debe tener al menos 12 caracteres.",
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
        tooManyDevices:
          "Esta cuenta ya alcanzó el límite de dispositivos. En un dispositivo que siga conectado, abre Copia y sync y quita un dispositivo que ya no uses para liberar una plaza.",
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
        deleteAccountFailed:
          "No se pudo eliminar tu cuenta ahora. No se cambió nada. Inténtalo de nuevo.",
        renewalUnavailable:
          "La renovación de este plan no se puede gestionar desde la app.",
        renewalUpdateFailed:
          "No se pudo cambiar la renovación ahora mismo. Inténtalo de nuevo.",
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
      activeHint: "Los síntomas personalizados activos aparecen en el panel y en el calendario.",
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
        "Crea una copia local o una tabla útil para un profesional de la salud a partir de tus registros.",
      storageHint:
        "Las exportaciones incluyen solo registros introducidos manualmente. Las predicciones no se incluyen.",
      sensitiveHint:
        "Los archivos exportados son sensibles. Guárdalos y compártelos solo donde confíes en el dispositivo o destino.",
      pdfCloudOnlyHint:
        "La exportación en PDF es una ventaja de Ovumcy Cloud. CSV y JSON siguen disponibles localmente en este dispositivo.",
      pdfPlanHint:
        "Esta cuenta de Ovumcy Cloud necesita un plan activo para desbloquear la exportación en PDF.",
      noData:
        "Todavía no hay entradas registradas. Cuando registres días en el panel o en el calendario, la exportación aparecerá aquí.",
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
    import: {
      title: "Restaurar desde copia de seguridad",
      subtitle:
        "Importa una exportación JSON anterior de Ovumcy. Solo se añaden los días que aún no tienes — no se sobrescribe ni se elimina nada.",
      pickAction: "Elegir archivo de exportación",
      previewTitle: "Todo listo para restaurar",
      previewCreatedTemplate: "Copia creada: %s",
      previewRangeTemplate: "Rango de la copia: %s a %s",
      previewTotalTemplate: "Registros en la copia: %d",
      previewAddTemplate: "Días nuevos para añadir: %d",
      previewSkipTemplate:
        "Días que ya están en este dispositivo (se conservan sin cambios): %d",
      previewRejectTemplate: "Registros que no se pueden importar: %d",
      previewSymptomsTemplate: "Síntomas personalizados nuevos: %d",
      previewProfileRestore:
        "Se aplicarán los ajustes de ciclo de la copia — este dispositivo aún tiene los ajustes predeterminados.",
      previewProfileKept: "Tus ajustes actuales se mantienen sin cambios.",
      previewNothingNew: "Todo lo de esta copia ya está en este dispositivo.",
      confirmAction: "Restaurar ahora",
      cancelAction: "Cancelar",
      applyingLabel: "Restaurando...",
      successTemplate: "Se restauraron %d días (%d ya existentes, %d ignorados).",
      successProfileNote: "Los ajustes de ciclo se restauraron desde la copia.",
      errors: {
        malformed:
          "Este archivo no se pudo leer como copia de seguridad. Elige una exportación JSON sin modificar creada por Ovumcy.",
        unrecognizedFormat: "Este archivo no es una exportación válida de Ovumcy.",
        tooLarge: "Ese archivo es demasiado grande para importarlo.",
        pickUnavailable:
          "Elegir archivos no está disponible en este dispositivo ahora mismo.",
        readFailed: "No se pudo leer el archivo seleccionado. Inténtalo de nuevo.",
        importFailed: "No se pudo restaurar. Inténtalo de nuevo.",
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
      trackingSaved: "Los campos de seguimiento se actualizaron para el panel y el calendario.",
      invalidLastPeriodStart:
        "Introduce una fecha válida del último período que no esté en el futuro.",
      saveFailed: "No se pudieron guardar los ajustes. Inténtalo de nuevo.",
    },
    premiumLock: {
      eyebrowLabel: "Premium",
      ctaLabel: "Abrir Ovumcy Cloud",
      remindersTitle: "Correos de recordatorio",
      pdfExportTitle: "PDF para tu profesional de la salud",
    },
  },
  it: {
    title: "Impostazioni",
    subtitle:
      "Gestisci i parametri del ciclo, i campi di tracciamento, le azioni di esportazione e il comportamento locale del profilo.",
    common: {
      cancelAction: "Annulla",
      confirmAction: "Conferma",
      saveChanges: "Salva modifiche",
      daysShort: "g",
      changeDate: "Scegli data",
      clearDate: "Cancella data",
      notSet: "Non impostato",
      saving: "Salvataggio...",
    },
    cycle: {
      title: "Parametri del ciclo",
      cycleLength: "Lunghezza tipica del ciclo",
      periodLength: "Durata del ciclo mestruale",
      lastPeriodStart: "Data di inizio dell'ultimo ciclo",
      lastPeriodStartHint:
        "Riferimento facoltativo quando il tuo diario non ha ancora un inizio ciclo segnato.",
      errorIncompatible:
        "La durata del ciclo mestruale è incompatibile con la lunghezza del ciclo. La mestruazione non può occupare quasi tutto il ciclo.",
      warningApproximate:
        "Con questi valori, l'ovulazione non può essere calcolata in modo affidabile. La previsione sarà approssimativa.",
      infoAdjusted:
        "La durata del ciclo mestruale è stata regolata automaticamente in modo che rimangano almeno 10 giorni prima del ciclo successivo.",
      infoPeriodLong:
        "Una durata superiore a 8 giorni può indicare irregolarità; parlane con un medico.",
      infoCycleLong:
        "Un ciclo più lungo di 45 giorni è meno comune; parlane con un medico.",
      infoCycleShort:
        "Un ciclo più corto di 24 giorni è meno comune; parlane con un medico.",
      autoPeriodFill: "Compila automaticamente i giorni di ciclo",
      autoPeriodFillHint:
        "Se abilitato, segnare il primo giorno compila automaticamente i giorni successivi in base alla durata del ciclo mestruale.",
      predictionModeLabel: "Modalità di previsione",
      predictionModeHint: "Scegli come Ovumcy deve mostrare le previsioni delle date.",
      predictionModeRegular: "Normale",
      predictionModeRegularHint:
        "Mostra la vista standard delle previsioni in base alle tue impostazioni del ciclo e alla cronologia.",
      predictionModeIrregular: "Irregolare",
      predictionModeIrregularHint:
        "Mantieni visibili le previsioni, ma leggile come un'indicazione approssimativa.",
      predictionModeFactsOnly: "Solo fatti",
      predictionModeFactsOnlyHint:
        "Disattiva le previsioni delle date e mostra solo i fatti registrati e i marcatori salvati.",
      save: "Salva modifiche",
    },
    ageGroup: {
      title: "Fascia d'età",
      hint: "Opzionale. Memorizzata nel profilo; le previsioni usano solo la tua cronologia del ciclo.",
      under40: "Sotto i 40",
      age40to45: "40-45",
      age45plus: "45+",
    },
    goal: {
      title: "Obiettivo d'uso",
      hint: "Opzionale. Cambia come i giorni fertili sono spiegati nell'interfaccia. Non modifica l'algoritmo.",
      avoid: "Evitare una gravidanza",
      trying: "Cercare una gravidanza",
      health: "Monitorare la mia salute",
    },
    tracking: {
      title: "Tracciamento aggiuntivo",
      subtitle:
        "Scegli campi extra per il registro giornaliero. I valori salvati restano nella tua cronologia privata.",
      trackBBT: "Mostra campo BBT",
      trackBBTHint:
        "Mostra un campo temperatura basale nel cruscotto e nel calendario.",
      trackBBTStateOn: "Attualmente visibile nel cruscotto e nell'editor giornaliero del calendario.",
      trackBBTStateOff: "Attualmente nascosto dalle nuove voci del cruscotto e del calendario.",
      trackCervicalMucus: "Mostra campo muco cervicale",
      trackCervicalMucusHint:
        "Mostra le opzioni per il muco cervicale nel cruscotto e nel calendario.",
      trackCervicalMucusStateOn:
        "Attualmente visibile nel cruscotto e nell'editor giornaliero del calendario.",
      trackCervicalMucusStateOff:
        "Attualmente nascosto dalle nuove voci del cruscotto e del calendario.",
      hideSexChip: "Mostra sezione intimità",
      hideSexChipHint:
        "Mostra la sezione intimità nelle nuove voci del cruscotto e del calendario.",
      hideSexChipStateOn:
        "Attualmente visibile nel cruscotto e nell'editor giornaliero del calendario.",
      hideSexChipStateOff:
        "Attualmente nascosta nel cruscotto e nell'editor giornaliero del calendario.",
      hideNotes: "Mostra sezione note",
      hideNotesHint:
        "Nasconde le note nel cruscotto e nelle voci del calendario senza eliminare le note salvate.",
      hideNotesStateOn:
        "Attualmente visibile nel cruscotto e nell'editor giornaliero del calendario.",
      hideNotesStateOff:
        "Attualmente nascosta nel cruscotto e nell'editor giornaliero del calendario.",
      showHistoricalPhases: "Mostra finestre fertili dei cicli passati",
      showHistoricalPhasesHint:
        "Mostra ovulazione, picco di fertilità e marcatori pre-fertili sui cicli passati completati nel calendario, in base agli inizi ciclo registrati.",
      showHistoricalPhasesStateOn:
        "Attualmente mostrato nei mesi passati del calendario.",
      showHistoricalPhasesStateOff:
        "Attualmente nascosto; solo i prossimi cicli previsti mostrano le finestre fertili.",
      hideCycleFactors: "Mostra fattori del ciclo",
      hideCycleFactorsHint:
        "Aggiunge le etichette dei fattori del ciclo (stress, malattia, viaggio, ...) al cruscotto e alle voci del calendario senza eliminare le etichette salvate.",
      hideCycleFactorsStateOn:
        "Attualmente visibile nel cruscotto e nell'editor giornaliero del calendario.",
      hideCycleFactorsStateOff:
        "Attualmente nascosto nel cruscotto e nell'editor giornaliero del calendario.",
      temperatureUnit: "Unità BBT",
      temperatureUnitHint: "Usata quando il campo BBT è visibile.",
      temperatureUnitCelsius: "Celsius",
      temperatureUnitFahrenheit: "Fahrenheit",
      save: "Salva tracciamento",
    },
    reminders: {
      title: "Promemoria",
      subtitle:
        "Mantieni private le notifiche del dispositivo e usa avvisi via email rispettosi della privacy quando la consegna premium è attiva.",
      localOnlyHint:
        "I promemoria del dispositivo restano solo su questo dispositivo. Non inviano i tuoi dati sulla salute a un server.",
      emailHint:
        "Le email premium di promemoria inviano solo avvisi generici. Non includono mai sintomi, note o dettagli sulla fertilità.",
      lockedHint:
        "Le email di promemoria richiedono un piano Ovumcy Cloud attivo. I promemoria su questo dispositivo funzionano senza account né piano, e le tue opzioni salvate restano locali.",
      timeLabel: "Ora del promemoria",
      timeHint:
        "Usata per il promemoria giornaliero e per i prossimi promemoria del ciclo programmati su questo dispositivo.",
      leadDaysLabel: "Anticipo del promemoria (giorni)",
      leadDaysHint:
        "Con quanti giorni di anticipo questo dispositivo programma il promemoria prima della finestra del ciclo prevista (0–14). Il valore 0 ti ricorda il giorno stesso.",
      emailDelivery: "Invia anche email di promemoria",
      emailDeliveryHint:
        "Usa l'invio via email di Ovumcy Cloud con avvisi rispettosi della privacy in base ai tipi di promemoria attivati.",
      emailDeliveryStateOn:
        "Le email di promemoria di Ovumcy Cloud verranno sincronizzate quando disponibili.",
      emailDeliveryStateOff: "Le email di promemoria sono disattivate.",
      dailyLog: "Ricordami di registrare oggi",
      dailyLogHint:
        "Programma un promemoria giornaliero per aprire Ovumcy e aggiornare la voce di oggi.",
      dailyLogStateOn:
        "È attivo un promemoria giornaliero del dispositivo.",
      dailyLogStateOff:
        "Nessun promemoria giornaliero di registrazione programmato.",
      upcomingPeriod: "Ricordami prima della prossima finestra del ciclo",
      upcomingPeriodHint:
        "Programma un promemoria locale prima della prossima finestra del ciclo prevista quando sono disponibili previsioni.",
      upcomingPeriodStateOn:
        "Un promemoria prima del prossimo ciclo è attivo.",
      upcomingPeriodStateOff:
        "Nessun promemoria prima del prossimo ciclo programmato.",
      fertileWindow: "Ricordami prima della finestra fertile",
      fertileWindowHint:
        "Programma un promemoria locale prima della prossima finestra fertile prevista quando sono disponibili previsioni.",
      fertileWindowStateOn:
        "Un promemoria prima della finestra fertile è attivo.",
      fertileWindowStateOff:
        "Nessun promemoria prima della finestra fertile programmato.",
      statusOn: "Attivo",
      statusOff: "Disattivato",
      saved: "Le impostazioni dei promemoria sono state aggiornate per questo dispositivo.",
      savedWithEmail:
        "Le impostazioni dei promemoria sono state aggiornate. Le email di Ovumcy Cloud ora usano avvisi rispettosi della privacy.",
      emailUnavailable:
        "Le impostazioni dei promemoria sono state salvate, ma le email di Ovumcy Cloud non sono al momento disponibili.",
      emailSyncFailed:
        "Le impostazioni dei promemoria sono state salvate, ma non è stato possibile aggiornare le email di Ovumcy Cloud in questo momento.",
      permissionDenied:
        "Consenti le notifiche nelle impostazioni del dispositivo per ricevere promemoria su questo dispositivo.",
      unavailable:
        "Questo dispositivo non può programmare promemoria locali in questo momento.",
      errors: {
        invalidTime:
          "Usa un'ora valida per il promemoria nel formato HH:MM.",
        saveFailed:
          "Impossibile salvare le impostazioni dei promemoria in questo momento. Riprova.",
      },
    },
    interface: {
      title: "Interfaccia",
      subtitle: "Controlla la lingua e l'aspetto dell'app su questo dispositivo.",
      languageLabel: "Lingua",
      languageHint: "Salvata solo su questo dispositivo.",
      previewHint:
        "Lingua e tema si visualizzano in anteprima all'istante. Salva per conservarli su questo dispositivo.",
      themeLabel: "Tema",
      themeHint: "Salvato solo su questo dispositivo.",
      screenCaptureProtectionLabel: "Proteggi screenshot",
      screenCaptureProtectionHint:
        "Blocca gli screenshot e l'anteprima nelle app recenti sui dispositivi compatibili.",
      screenCaptureProtectionStateOn:
        "Gli screenshot sono bloccati sui dispositivi compatibili.",
      screenCaptureProtectionStateOff:
        "Gli screenshot e le anteprime dell'app possono essere acquisiti su questo dispositivo.",
      discardChanges: "Annulla modifiche",
      save: "Salva interfaccia",
      saveBeforeLeave: "Salva ed esci",
      keepEditing: "Continua a modificare",
      themeLight: "Chiaro",
      themeDark: "Scuro",
      themeSystem: "Sistema",
      saved: "L'interfaccia è stata aggiornata per questo dispositivo.",
      languageSaved: "Lingua aggiornata per questo dispositivo.",
      themeSaved: "Tema aggiornato per questo dispositivo.",
      unsavedPrompt:
        "Ci sono modifiche alle impostazioni non salvate. Vuoi salvarle prima di uscire dalle impostazioni?",
    },
    account: {
      title: "Backup & sync",
      subtitle:
        "Prima proteggi questo dispositivo, poi collega Ovumcy Cloud o il tuo server di sync.",
      hubSubtitle:
        "Apre una schermata separata per la frase di recupero, la connessione dell'account, il piano cloud e le azioni di sync.",
      openHubLabel: "Apri backup & sync",
      backToSettingsLabel: "Torna alle impostazioni",
      localStepTitle: "1. Proteggi questo dispositivo",
      localStepHint:
        "Crea una frase di recupero su questo dispositivo. Conservala offline nel caso dovessi mai ripristinare i tuoi dati.",
      preparingTitle: "Preparazione del tuo backup protetto...",
      preparingHint:
        "Ovumcy sta creando una frase di recupero su questo dispositivo.",
      accountStepTitle: "2. Collega un account",
      accountStepHintManaged:
        "Accedi qui con il tuo account Ovumcy Cloud. I tuoi dati sulla salute continuano a sincronizzarsi a parte come backup cifrato.",
      accountStepHintSelfHosted:
        "Crea o accedi all'account del tuo server di sync.",
      planStepTitle: "3. Piano Ovumcy Cloud",
      planStepHint:
        "L'accesso cloud e la fatturazione vengono verificati separatamente. Il sync si attiva solo quando questo account ha un piano Ovumcy Cloud attivo.",
      planSignInFirst:
        "Accedi prima per verificare lo stato del tuo piano.",
      planUnknown:
        "Ovumcy sta verificando se questo account cloud ha un piano attivo.",
      planInactive:
        "Questo account cloud ha effettuato l'accesso, ma il sync cloud resta bloccato perché non è stato trovato un piano attivo.",
      planCheckFailed:
        "Ovumcy non è riuscito a confermare il piano cloud in questo momento. Riprova a breve.",
      planUnavailable:
        "Il tuo account Ovumcy Cloud e la fatturazione restano separati dall'archiviazione di sync cifrata.",
      planActive: "Ovumcy Cloud è attivo per questo account.",
      checkPlanAgain: "Verifica di nuovo il piano",
      advancedSectionLabel: "Avanzate",
      syncStepTitle: "4. Sincronizza questo backup",
      syncStepHintManaged:
        "Quando questo account cloud avrà un piano attivo, qui potrai caricare o ripristinare il backup protetto.",
      syncStepHintSelfHosted:
        "Dopo aver effettuato l'accesso al tuo server, qui potrai caricare o ripristinare il backup protetto.",
      syncBlockedNoPlan:
        "Il sync cloud resta bloccato finché questo account non ha un piano Ovumcy Cloud attivo.",
      modeLabel: "Modalità di sync",
      modeManaged: "Ovumcy Cloud",
      modeSelfHosted: "Self-hosted",
      managedHint:
        "Ovumcy Cloud conserva il tuo backup cifrato nel nostro servizio ospitato. Self-hosted mantiene il sync sul tuo server.",
      selfHostedHint:
        "Usa un host, IP:porta o URL completo. L'http pubblico viene rifiutato; localhost e reti private sono consentiti.",
      endpointLabel: "Endpoint del server",
      endpointHint: "Necessario solo per il sync self-hosted.",
      endpointPlaceholder: "sync.example.com o 192.168.1.20:8080",
      deviceLabel: "Etichetta del dispositivo",
      deviceHint:
        "Comparirà in seguito negli elenchi dei dispositivi connessi e nei flussi di recupero cifrato.",
      devicePlaceholder: "Inserisci il nome del dispositivo",
      stateLabel: "Stato della frase di recupero",
      stateReady: "Questo dispositivo ha già una frase di recupero.",
      stateMissing: "Questo dispositivo non ha ancora una frase di recupero.",
      connectionLabel: "Sessione dell'account",
      connectionReady: "Questo dispositivo ha già effettuato l'accesso a un account sync.",
      connectionMissing: "Questo dispositivo non ha ancora effettuato l'accesso a un account sync.",
      lastSyncLabel: "Ultimo sync",
      lastSyncNever: "Non ancora sincronizzato.",
      modeRowLabel: "Destinazione",
      endpointRowLabel: "Server",
      encryptionRowLabel: "Protezione del dispositivo",
      encryptionReady: "I materiali di recupero sono conservati solo su questo dispositivo.",
      encryptionMissing: "Non è ancora stata creata una frase di recupero su questo dispositivo.",
      loginLabel: "Email o nome utente",
      loginPlaceholder: "owner@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Inserisci la password",
      recoveryImportTitle: "Ripristina l'accesso con una frase di recupero",
      recoveryImportHint:
        "Usalo quando questo dispositivo non ha più le chiavi locali di sync, ma conservi ancora la password dell'account e la frase di recupero di 12 parole.",
      recoveryPhraseInputLabel: "Frase di recupero",
      recoveryPhraseInputPlaceholder: "dodici parole separate da spazi",
      recoveryPhraseInputHint:
        "Inserisci esattamente le 12 parole che proteggono la tua chiave master di sync.",
      recoverAccessLabel: "Ripristina accesso",
      registerLabel: "Crea account",
      loginActionLabel: "Accedi",
      syncNowLabel: "Sincronizza ora",
      restoreLabel: "Ripristina dal server",
      disconnectLabel: "Disconnetti",
      restorePrompt:
        "Ripristinare l'istantanea cifrata dal server e sostituire i dati locali attuali di questo dispositivo?",
      restoreAccept: "Ripristina istantanea",
      restoreDeviceAuthPrompt:
        "Conferma con la sicurezza del dispositivo per ripristinare i dati cifrati dal server di sync.",
      uploadOverBackupPrompt:
        "Questo account ha già un backup cifrato sul server, ma questo dispositivo non ha mai sincronizzato. Caricando ora sostituirai quel backup del server con i dati di questo dispositivo. Sostituirlo?",
      uploadOverBackupAccept: "Sostituisci backup del server",
      renewalCancelLabel: "Disattiva il rinnovo automatico",
      renewalResumeLabel: "Riprendi il rinnovo automatico",
      renewalCancelPrompt:
        "Disattivare il rinnovo automatico? Il tuo piano resta attivo fino alla fine del periodo già pagato.",
      renewalCancelAccept: "Disattiva rinnovo",
      offerDismissLabel: "Ignora questa offerta",
      offerPromoEyebrow: "Offerta",
      offerAnnouncementEyebrow: "Novità",
      disconnectPrompt:
        "Disconnettere questo dispositivo dalla sessione del server di sync? Le chiavi cifrate locali resteranno su questo dispositivo.",
      disconnectDeviceAuthPrompt:
        "Conferma con la sicurezza del dispositivo per disconnettere questo dispositivo dal server di sync.",
      deleteAccountLabel: "Elimina account",
      deleteAccountPrompt:
        "Eliminare definitivamente il tuo account e tutti i suoi dati dal server? Questa operazione non può essere annullata.",
      deleteAccountAccept: "Elimina account",
      deleteAccountDeviceAuthPrompt:
        "Conferma con la sicurezza del dispositivo per eliminare definitivamente il tuo account.",
      deleteAccountSubscriptionWarningTitle:
        "Il tuo abbonamento continuerà a essere addebitato",
      deleteAccountSubscriptionWarningMessage:
        "L'eliminazione del tuo account NON annulla il tuo abbonamento Google Play. Devi annullarlo separatamente nel Play Store, altrimenti continuerai a essere addebitata. Conferma qui sotto solo se hai capito e vuoi comunque eliminare definitivamente il tuo account.",
      deleteAccountSubscriptionWarningAccept: "Ho capito, elimina comunque",
      recoveryTitle: "Frase di recupero di questo dispositivo",
      recoveryHint:
        "Trascrivi esattamente le 12 parole e conservale offline. Se perdi tutti i dispositivi e questa frase, i dati sincronizzati non potranno essere recuperati.",
      recoveryNotice:
        "Questa schermata mostra la frase di recupero solo quando prepari o ricrei le chiavi locali di sync.",
      recoveryShownOnce: "Mostrata solo una volta dopo la generazione.",
      recoveryExportLabel: "Esporta come testo",
      recoveryCodeTitle: "Codice di recupero dell'account",
      recoveryCodeHint:
        "Conserva questo codice in un luogo sicuro. Viene mostrato solo una volta e ti permette di reimpostare la password del tuo account sync se la dimentichi.",
      prepareLabel: "Crea frase di recupero",
      regenerateLabel: "Crea una nuova frase di recupero",
      regeneratePrompt:
        "Ricreare le chiavi locali di sync invalida i vecchi backup cifrati finché non usi la nuova frase di recupero. Continuare?",
      regenerateAccept: "Crea nuova frase",
      regenerateDeviceAuthPrompt:
        "Conferma con la sicurezza del dispositivo per creare una nuova frase di recupero per questo dispositivo.",
      discardChangesLabel: "Annulla modifiche",
      saveBeforeLeaveLabel: "Salva ed esci",
      keepEditingLabel: "Continua a modificare",
      unsavedPrompt:
        "Ci sono modifiche a backup & sync non salvate. Vuoi salvarle prima di uscire da questa schermata?",
      prepared: "La frase di recupero è stata creata per questo dispositivo.",
      regenerated: "È stata creata una nuova frase di recupero per questo dispositivo.",
      connected: "Questo dispositivo è stato collegato al server di sync.",
      connectedNoPlan:
        "L'account cloud è stato collegato. Il sync si attiverà quando questo account avrà un piano cloud attivo.",
      recovered: "L'accesso di sync è stato ripristinato su questo dispositivo.",
      uploaded:
        "Il backup cifrato è stato caricato sul server di sync.",
      restored:
        "Il backup cifrato è stato ripristinato dal server di sync.",
      disconnected: "La sessione del server di sync è stata rimossa da questo dispositivo.",
      deleted: "Account eliminato. Ritorno alla configurazione iniziale.",
      renewalCancelled:
        "Il rinnovo automatico è disattivato. Il tuo piano resta attivo fino alla fine del periodo corrente.",
      renewalResumed: "Il rinnovo automatico è di nuovo attivo.",
      errors: {
        loginRequired: "Il login è obbligatorio.",
        passwordRequired: "La password è obbligatoria.",
        passwordTooShort: "La password deve contenere almeno 12 caratteri.",
        deviceLabelRequired: "L'etichetta del dispositivo è obbligatoria.",
        endpointRequired: "Inserisci un endpoint del server di sync.",
        invalidEndpoint: "Inserisci un host, un IP o un URL completo validi.",
        unsupportedScheme:
          "Sono supportati solo https e gli endpoint http approvati per la rete locale.",
        insecurePublicHttp: "Gli endpoint pubblici di sync devono usare https.",
        invalidRegistrationInput:
          "Usa un login valido e una password più robusta.",
        registrationFailed:
          "Impossibile creare un account sync con questi dati.",
        invalidCredentials: "Login o password non validi.",
        recoveryPhraseRequired: "La frase di recupero è obbligatoria.",
        invalidRecoveryPhrase:
          "Inserisci l'esatta frase di recupero di 12 parole.",
        recoveryNotAvailable:
          "Questo server di sync non supporta l'importazione con frase di recupero.",
        recoveryPackageNotFound:
          "Non c'è ancora alcun pacchetto di recupero salvato per questo account.",
        tooManyDevices:
          "Questo account ha raggiunto il limite di dispositivi. Su un dispositivo ancora collegato, apri Backup & sync e rimuovi un dispositivo che non usi più per liberare uno slot.",
        syncNotPrepared:
          "Prepara prima il sync cifrato su questo dispositivo.",
        notConnected:
          "Collega prima questo dispositivo a un server di sync.",
        blobNotFound:
          "Non esiste ancora un backup cifrato su questo server.",
        invalidPayload:
          "Impossibile leggere il backup cifrato ricevuto dal server.",
        networkFailed:
          "Impossibile raggiungere il server di sync in questo momento.",
        recoveryExportUnavailable:
          "Questo dispositivo non può esportare la frase di recupero in questo momento.",
        recoveryExportFailed:
          "Impossibile esportare la frase di recupero in questo momento. Riprova.",
        deviceAuthUnavailable:
          "Imposta un codice o la biometria su questo dispositivo prima di ricreare le chiavi locali di sync.",
        deviceAuthFailed:
          "Impossibile confermare la sicurezza del dispositivo in questo momento. Riprova.",
        saveFailed:
          "Impossibile preparare il sync cifrato in questo momento. Riprova.",
        syncFailed:
          "Impossibile caricare il backup cifrato in questo momento. Riprova.",
        restoreFailed:
          "Impossibile ripristinare il backup cifrato in questo momento. Riprova.",
        deleteAccountFailed:
          "Impossibile eliminare il tuo account in questo momento. Nulla è stato modificato. Riprova.",
        renewalUnavailable:
          "Il rinnovo di questo piano non può essere gestito dall'app.",
        renewalUpdateFailed:
          "Impossibile modificare il rinnovo in questo momento. Riprova.",
      },
    },
    symptoms: {
      title: "Sintomi personalizzati",
      subtitle: "Crea etichette private e brevi per pattern che vuoi registrare.",
      name: "Nome del sintomo",
      namePlaceholder: "Scrivi il nome del sintomo",
      nameHint: "Usa 40 caratteri o meno. Per dettagli lunghi, usa le note.",
      icon: "Icona",
      add: "Aggiungi sintomo",
      save: "Salva sintomo",
      hide: "Nascondi",
      restore: "Ripristina",
      activeHeading: "Visibile nelle nuove voci",
      activeHint: "I sintomi personalizzati attivi appaiono nel cruscotto e nel calendario.",
      activeItem: "Visibile nelle nuove voci",
      archivedHeading: "Archiviato nelle nuove voci",
      archivedHint: "I registri passati li mantengono. Ripristinane uno quando vuoi che torni nel selettore.",
      archivedItem: "Nascosto nelle nuove voci",
      archivedBadge: "Nascosto",
      empty: "Ancora nessun sintomo personalizzato. Aggiungine uno sopra per usarlo nelle nuove voci.",
      emptyActive:
        "Al momento non ci sono sintomi personalizzati visibili. Ripristinane uno sotto o aggiungine uno nuovo sopra.",
      created: "Sintomo personalizzato aggiunto.",
      updated: "Sintomo personalizzato aggiornato.",
      archived: "Sintomo personalizzato nascosto.",
      restored: "Sintomo personalizzato ripristinato.",
      confirmHide:
        "Nascondere questo sintomo personalizzato dalle nuove voci? I registri passati lo conserveranno.",
      errors: {
        labelRequired: "Il nome è obbligatorio.",
        labelTooLong:
          "Usa 40 caratteri o meno. Per dettagli lunghi, usa le note.",
        labelInvalidCharacters:
          "Usa solo testo semplice. Parentesi angolari e caratteri di controllo non sono consentiti.",
        duplicateLabel: "Quel nome esiste già nella tua lista.",
        saveFailed: "Impossibile salvare questo sintomo in questo momento. Riprova.",
        notFound: "Impossibile trovare questo sintomo. Ricarica le impostazioni e riprova.",
      },
    },
    export: {
      title: "Esporta dati",
      subtitle:
        "Crea una copia locale o una tabella utile per un professionista sanitario a partire dai tuoi registri.",
      storageHint:
        "Le esportazioni includono solo le voci inserite manualmente. Le previsioni non sono incluse.",
      sensitiveHint:
        "I file esportati sono sensibili. Salvali e condividili solo dove ti fidi del dispositivo o della destinazione.",
      pdfCloudOnlyHint:
        "L'esportazione in PDF è un vantaggio di Ovumcy Cloud. CSV e JSON restano disponibili localmente su questo dispositivo.",
      pdfPlanHint:
        "Questo account Ovumcy Cloud richiede un piano attivo per sbloccare l'esportazione in PDF.",
      noData:
        "Ancora nessuna voce registrata. Quando registrerai i giorni nel cruscotto o nel calendario, l'esportazione apparirà qui.",
      presetLabel: "Preimpostazioni",
      presetAll: "Tutto il periodo",
      preset30: "30 giorni",
      preset90: "90 giorni",
      preset365: "365 giorni",
      fromLabel: "Da",
      toLabel: "A",
      datePlaceholder: "AAAA-MM-GG",
      summaryTotalTemplate: "Voci totali: %d",
      summaryRangeTemplate: "Intervallo date: %s a %s",
      summaryRangeEmpty: "Intervallo date: -",
      csvAction: "Esporta CSV",
      jsonAction: "Esporta JSON",
      pdfAction: "Esporta PDF",
      csvStatus: "L'esportazione CSV è pronta.",
      jsonStatus: "La copia JSON è pronta.",
      pdfStatus: "Il report PDF è pronto.",
      errors: {
        invalidFromDate: "Usa una data di inizio valida.",
        invalidToDate: "Usa una data di fine valida.",
        invalidRange: "La data di fine deve essere uguale o successiva alla data di inizio.",
        pdfLocked:
          "L'esportazione in PDF è disponibile solo con un piano Ovumcy Cloud attivo.",
        exportFailed: "Impossibile preparare l'esportazione. Riprova.",
        deliveryUnavailable:
          "Questo dispositivo non può aprire la destinazione di esportazione in questo momento. Prova da un browser compatibile o da un dispositivo con condivisione/salvataggio.",
        deliveryFailed:
          "Il file è stato preparato, ma il download o la condivisione non è riuscito. Riprova.",
      },
    },
    import: {
      title: "Ripristina da backup",
      subtitle:
        "Importa un precedente export JSON di Ovumcy. Vengono aggiunti solo i giorni che non hai già — nulla viene sovrascritto o cancellato.",
      pickAction: "Scegli file di export",
      previewTitle: "Pronto per il ripristino",
      previewCreatedTemplate: "Backup creato: %s",
      previewRangeTemplate: "Periodo del backup: %s a %s",
      previewTotalTemplate: "Voci nel backup: %d",
      previewAddTemplate: "Nuovi giorni da aggiungere: %d",
      previewSkipTemplate:
        "Giorni già su questo dispositivo (restano invariati): %d",
      previewRejectTemplate: "Voci che non possono essere importate: %d",
      previewSymptomsTemplate: "Nuovi sintomi personalizzati: %d",
      previewProfileRestore:
        "Le impostazioni del ciclo del backup verranno applicate — questo dispositivo ha ancora le impostazioni predefinite.",
      previewProfileKept: "Le tue impostazioni attuali restano invariate.",
      previewNothingNew:
        "Tutto il contenuto di questo backup è già su questo dispositivo.",
      confirmAction: "Ripristina ora",
      cancelAction: "Annulla",
      applyingLabel: "Ripristino in corso...",
      successTemplate: "Ripristinati %d giorni (%d già presenti, %d ignorati).",
      successProfileNote:
        "Le impostazioni del ciclo sono state ripristinate dal backup.",
      errors: {
        malformed:
          "Questo file non può essere letto come backup. Scegli un export JSON non modificato creato da Ovumcy.",
        unrecognizedFormat: "Questo file non è un export Ovumcy valido.",
        tooLarge: "Quel file è troppo grande per l'importazione.",
        pickUnavailable:
          "La scelta dei file non è disponibile su questo dispositivo al momento.",
        readFailed: "Impossibile leggere il file selezionato. Riprova.",
        importFailed: "Ripristino fallito. Riprova.",
      },
    },
    danger: {
      title: "Zona pericolosa",
      subtitle:
        "Chiudere l'app non elimina i dati locali. Usa questa opzione solo se vuoi eliminare i registri sulla salute di questo dispositivo.",
      clearTitle: "Elimina tutti i dati locali",
      clearSubtitle:
        "Elimina configurazione iniziale, impostazioni del profilo, registri giornalieri, sintomi personalizzati e stato locale di esportazione, e riporta l'app alla configurazione iniziale.",
      confirmationLabel: "Scrivi CLEAR per confermare",
      confirmationPlaceholder: "CLEAR",
      confirmationHint:
        "Questa operazione non può essere annullata dall'app. Esporta prima una copia se vuoi conservare i registri.",
      deviceAuthPrompt:
        "Conferma con la sicurezza del dispositivo per eliminare i dati locali di questo dispositivo.",
      action: "Elimina dati locali",
      success: "Dati locali eliminati. Ritorno alla configurazione iniziale.",
      invalidConfirmation:
        "Scrivi esattamente CLEAR per confermare l'eliminazione dei dati locali.",
      deviceAuthUnavailable:
        "Imposta un codice o la biometria su questo dispositivo prima di eliminare i dati locali.",
      deviceAuthFailed:
        "Impossibile confermare la sicurezza del dispositivo in questo momento. Riprova.",
      failed:
        "Impossibile eliminare i dati locali in questo momento. Riprova.",
    },
    status: {
      cycleSaved: "Impostazioni del ciclo salvate. Le previsioni sono state aggiornate.",
      trackingSaved: "I campi di tracciamento sono stati aggiornati per il cruscotto e il calendario.",
      invalidLastPeriodStart:
        "Inserisci una data valida dell'ultimo ciclo che non sia nel futuro.",
      saveFailed: "Impossibile salvare le impostazioni. Riprova.",
    },
    premiumLock: {
      eyebrowLabel: "Premium",
      ctaLabel: "Apri Ovumcy Cloud",
      remindersTitle: "Email di promemoria",
      pdfExportTitle: "PDF per il tuo professionista sanitario",
    },
  },
  de: settingsCopyDe,
  fr: settingsCopyFr,
};

export function getSettingsCopy(language: string | null | undefined) {
  return settingsCopyCatalog[resolveCopyLanguage(language)];
}
