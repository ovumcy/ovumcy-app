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
    title: "Account & sync",
    subtitle:
      "Prepare encrypted sync on this device first. Account connection arrives after a sync server is configured.",
    modeLabel: "Sync mode",
    modeManaged: "Ovumcy Cloud",
    modeSelfHosted: "Self-hosted",
    managedHint:
      "Uses the official Ovumcy Cloud endpoint when managed sync becomes available on this device.",
    selfHostedHint:
      "Use a host, IP:port, or full URL. Public http is rejected; localhost and private-network http are allowed.",
    endpointLabel: "Server endpoint",
    endpointHint: "Required only for self-hosted sync.",
    endpointPlaceholder: "sync.example.com or 192.168.1.20:8080",
    deviceLabel: "Device label",
    deviceHint:
      "Shown later in connected device lists and encrypted recovery flows.",
    devicePlaceholder: "Pixel 7",
    stateLabel: "Sync setup state",
    stateReady: "Encrypted sync is prepared on this device.",
    stateMissing: "Encrypted sync has not been prepared on this device yet.",
    connectionLabel: "Server session",
    connectionReady: "Connected to a sync server on this device.",
    connectionMissing: "No sync server session on this device yet.",
    lastSyncLabel: "Last sync",
    lastSyncNever: "Not synced yet.",
    modeRowLabel: "Mode",
    endpointRowLabel: "Endpoint",
    encryptionRowLabel: "Encryption",
    encryptionReady: "Recovery materials are stored locally on this device.",
    encryptionMissing: "No local sync key is prepared yet.",
    loginLabel: "Login",
    loginPlaceholder: "owner@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
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
    recoveryTitle: "Recovery phrase",
    recoveryHint:
      "Write down the 12 words exactly and keep them offline. If you lose every device and this phrase, synced data cannot be recovered.",
    recoveryNotice:
      "This screen shows the recovery phrase only when you prepare or recreate local sync keys.",
    recoveryShownOnce: "Shown only once after generation.",
    prepareLabel: "Prepare encrypted sync",
    regenerateLabel: "Recreate local sync keys",
    regeneratePrompt:
      "Recreating local sync keys invalidates older encrypted sync backups until you use the new recovery phrase. Continue?",
    regenerateAccept: "Recreate keys",
    regenerateDeviceAuthPrompt:
      "Confirm with device security to recreate local sync keys.",
    prepared: "Encrypted sync prepared on this device.",
    regenerated: "Local sync keys recreated for this device.",
    connected: "Connected to the sync server on this device.",
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
      title: "Аккаунт и sync",
      subtitle:
        "Сначала подготовьте зашифрованный sync на этом устройстве. Подключение аккаунта появится после настройки sync-сервера.",
      modeLabel: "Режим sync",
      modeManaged: "Ovumcy Cloud",
      modeSelfHosted: "Self-hosted",
      managedHint:
        "Использует официальный endpoint Ovumcy Cloud, когда managed sync станет доступен на этом устройстве.",
      selfHostedHint:
        "Используйте host, IP:port или полный URL. Публичный http отклоняется; localhost и private-network http разрешены.",
      endpointLabel: "Endpoint сервера",
      endpointHint: "Нужен только для self-hosted sync.",
      endpointPlaceholder: "sync.example.com или 192.168.1.20:8080",
      deviceLabel: "Название устройства",
      deviceHint:
        "Позже будет видно в списках устройств и в зашифрованных recovery-flow.",
      devicePlaceholder: "Pixel 7",
      stateLabel: "Состояние sync setup",
      stateReady: "Зашифрованный sync подготовлен на этом устройстве.",
      stateMissing: "Зашифрованный sync на этом устройстве ещё не подготовлен.",
      connectionLabel: "Серверная сессия",
      connectionReady: "Это устройство подключено к sync-серверу.",
      connectionMissing: "На этом устройстве ещё нет сессии sync-сервера.",
      lastSyncLabel: "Последний sync",
      lastSyncNever: "Синхронизации ещё не было.",
      modeRowLabel: "Режим",
      endpointRowLabel: "Endpoint",
      encryptionRowLabel: "Шифрование",
      encryptionReady: "Recovery-материалы локально сохранены на этом устройстве.",
      encryptionMissing: "Локальный sync key ещё не подготовлен.",
      loginLabel: "Логин",
      loginPlaceholder: "owner@example.com",
      passwordLabel: "Пароль",
      passwordPlaceholder: "Введите пароль",
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
      recoveryTitle: "Recovery phrase",
      recoveryHint:
        "Запишите все 12 слов точно и храните их офлайн. Если вы потеряете все устройства и эту phrase, synced data восстановить нельзя.",
      recoveryNotice:
        "Этот экран показывает recovery phrase только когда вы подготавливаете или пересоздаёте локальные sync keys.",
      recoveryShownOnce: "Показывается только один раз после генерации.",
      prepareLabel: "Подготовить зашифрованный sync",
      regenerateLabel: "Пересоздать локальные sync keys",
      regeneratePrompt:
        "Пересоздание локальных sync keys делает старые зашифрованные sync backup'ы недоступными, пока вы не используете новую recovery phrase. Продолжить?",
      regenerateAccept: "Пересоздать keys",
      regenerateDeviceAuthPrompt:
        "Подтвердите защитой устройства пересоздание локальных sync keys.",
      prepared: "Зашифрованный sync подготовлен на этом устройстве.",
      regenerated: "Локальные sync keys пересозданы для этого устройства.",
      connected: "Это устройство подключено к sync-серверу.",
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
      title: "Cuenta y sync",
      subtitle:
        "Primero prepara el sync cifrado en este dispositivo. La conexión de cuenta llegará después de configurar un servidor de sync.",
      modeLabel: "Modo de sync",
      modeManaged: "Ovumcy Cloud",
      modeSelfHosted: "Self-hosted",
      managedHint:
        "Usa el endpoint oficial de Ovumcy Cloud cuando el sync gestionado esté disponible en este dispositivo.",
      selfHostedHint:
        "Usa un host, IP:puerto o URL completa. El http público se rechaza; localhost y redes privadas sí se permiten.",
      endpointLabel: "Endpoint del servidor",
      endpointHint: "Solo es necesario para sync self-hosted.",
      endpointPlaceholder: "sync.example.com o 192.168.1.20:8080",
      deviceLabel: "Etiqueta del dispositivo",
      deviceHint:
        "Más tarde aparecerá en las listas de dispositivos conectados y en los flujos de recuperación cifrada.",
      devicePlaceholder: "Pixel 7",
      stateLabel: "Estado del sync",
      stateReady: "El sync cifrado está preparado en este dispositivo.",
      stateMissing: "El sync cifrado todavía no está preparado en este dispositivo.",
      connectionLabel: "Sesión del servidor",
      connectionReady: "Este dispositivo está conectado a un servidor de sync.",
      connectionMissing: "Todavía no hay sesión de servidor de sync en este dispositivo.",
      lastSyncLabel: "Último sync",
      lastSyncNever: "Todavía no se ha sincronizado.",
      modeRowLabel: "Modo",
      endpointRowLabel: "Endpoint",
      encryptionRowLabel: "Cifrado",
      encryptionReady: "Los materiales de recuperación se guardan localmente en este dispositivo.",
      encryptionMissing: "Todavía no se ha preparado una clave local de sync.",
      loginLabel: "Login",
      loginPlaceholder: "owner@example.com",
      passwordLabel: "Contraseña",
      passwordPlaceholder: "Introduce la contraseña",
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
      recoveryTitle: "Frase de recuperación",
      recoveryHint:
        "Escribe exactamente las 12 palabras y guárdalas fuera de línea. Si pierdes todos los dispositivos y esta frase, no se podrán recuperar los datos sincronizados.",
      recoveryNotice:
        "Esta pantalla muestra la frase de recuperación solo cuando preparas o recreas las claves locales de sync.",
      recoveryShownOnce: "Se muestra solo una vez después de generarse.",
      prepareLabel: "Preparar sync cifrado",
      regenerateLabel: "Recrear claves locales de sync",
      regeneratePrompt:
        "Recrear las claves locales de sync invalida las copias cifradas antiguas hasta que uses la nueva recovery phrase. ¿Continuar?",
      regenerateAccept: "Recrear claves",
      regenerateDeviceAuthPrompt:
        "Confirma con la seguridad del dispositivo para recrear las claves locales de sync.",
      prepared: "El sync cifrado quedó preparado en este dispositivo.",
      regenerated: "Las claves locales de sync se recrearon para este dispositivo.",
      connected: "Este dispositivo quedó conectado al servidor de sync.",
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
};

export function getSettingsCopy(language: string | null | undefined) {
  return settingsCopyCatalog[resolveCopyLanguage(language)];
}

export const settingsCopy = settingsCopyEn;
