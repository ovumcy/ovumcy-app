import type { InterfaceLanguage } from "../models/profile";

export type TOTPCopy = {
  section: {
    title: string;
    hint: string;
    enableTab: string;
    disableTab: string;
    statusEnabled: string;
    statusDisabled: string;
  };

  enroll: {
    currentPasswordLabel: string;
    startLabel: string;
    secretTitle: string;
    secretHint: string;
    secretManualLabel: string;
    provisioningUriLabel: string;
    codeLabel: string;
    verifyLabel: string;
    successMessage: string;
    cancelLabel: string;
    recoveryCodeReplacedHint: string;
  };

  disable: {
    currentPasswordLabel: string;
    codeLabel: string;
    submitLabel: string;
    successMessage: string;
  };

  challenge: {
    title: string;
    hint: string;
    codeLabel: string;
    submitLabel: string;
    cancelLabel: string;
    expiredHint: string;
  };

  errors: {
    currentPasswordRequired: string;
    invalidCurrentPassword: string;
    totpNotConfigured: string;
    totpAlreadyEnabled: string;
    totpInvalidCode: string;
    totpReplayed: string;
    totpChallengeInvalid: string;
    totpSecretFailed: string;
    challengeIDRequired: string;
    notConnected: string;
    rateLimited: string;
    networkFailed: string;
    unauthorized: string;
    totpEnrollInvalidCode: string;
    totpEnrollmentRestartRequired: string;
    totpEnrollmentNotStarted: string;
    totpAlreadyDisabled: string;
    totpRecoveryCodeLost: string;
    generic: string;
  };
};

const totpCopyEn: TOTPCopy = {
  section: {
    title: "Two-factor authentication",
    hint: "Add a 6-digit code from an authenticator app on top of your password.",
    enableTab: "Enable",
    disableTab: "Disable",
    statusEnabled: "Two-factor authentication is on.",
    statusDisabled: "Two-factor authentication is off.",
  },
  enroll: {
    currentPasswordLabel: "Current password",
    startLabel: "Start setup",
    secretTitle: "Scan or enter this code",
    secretHint:
      "Add it to Google Authenticator, 1Password, Authy, or any RFC 6238 app, then enter the 6-digit code below.",
    secretManualLabel: "Manual setup code",
    provisioningUriLabel: "QR code URI",
    codeLabel: "6-digit code",
    verifyLabel: "Verify and enable",
    successMessage:
      "Two-factor is on. Other devices were signed out; sign in again to keep using sync.",
    cancelLabel: "Cancel",
    recoveryCodeReplacedHint:
      "Turning on two-factor replaced your recovery code. The code from registration or your last regeneration no longer works. Save this one — it is shown only once.",
  },
  disable: {
    currentPasswordLabel: "Current password",
    codeLabel: "6-digit code",
    submitLabel: "Disable two-factor",
    successMessage: "Two-factor is off. All sessions were signed out.",
  },
  challenge: {
    title: "Enter your 6-digit code",
    hint: "Open your authenticator app and enter the current code for this account.",
    codeLabel: "6-digit code",
    submitLabel: "Verify",
    cancelLabel: "Cancel",
    expiredHint: "Challenge expired. Sign in again.",
  },
  errors: {
    currentPasswordRequired: "Enter your current password.",
    invalidCurrentPassword: "Current password is incorrect.",
    totpNotConfigured: "Two-factor is not configured on this server.",
    totpAlreadyEnabled: "Two-factor is already enabled. Disable it first.",
    totpInvalidCode: "Code is incorrect. Try the latest one from your app.",
    totpReplayed: "That code was already used. Wait for a new one.",
    totpChallengeInvalid: "Login challenge expired. Sign in again.",
    totpSecretFailed: "Something went wrong with the secret. Try again.",
    challengeIDRequired: "Missing challenge. Sign in again.",
    notConnected: "Connect a sync account before changing two-factor.",
    rateLimited: "Too many attempts. Try again later.",
    networkFailed: "Network error. Try again.",
    unauthorized: "Session expired. Sign in again.",
    totpEnrollInvalidCode:
      "Code is incorrect. If setup was also started on another device, only the newest setup counts: finish it there, or cancel and start again here.",
    totpEnrollmentRestartRequired:
      "Too many attempts for this setup, so it was cancelled. Enter your password to start again.",
    totpEnrollmentNotStarted:
      "This setup is no longer pending. Enter your password to start again.",
    totpAlreadyDisabled:
      "Two-factor is already off for this account.",
    totpRecoveryCodeLost:
      "Two-factor is now on, but the new recovery code did not reach this device, and your previous code no longer works. Use “Regenerate recovery code” to get a new one.",
    generic: "Something went wrong. Try again.",
  },
};

const totpCopyDe: TOTPCopy = {
  section: {
    title: "Zwei-Faktor-Authentifizierung",
    hint: "Ergänzen Sie Ihr Passwort um einen 6-stelligen Code aus einer Authenticator-App.",
    enableTab: "Aktivieren",
    disableTab: "Deaktivieren",
    statusEnabled: "Die Zwei-Faktor-Authentifizierung ist aktiviert.",
    statusDisabled: "Die Zwei-Faktor-Authentifizierung ist deaktiviert.",
  },
  enroll: {
    currentPasswordLabel: "Aktuelles Passwort",
    startLabel: "Einrichtung starten",
    secretTitle: "Diesen Code scannen oder eingeben",
    secretHint:
      "Fügen Sie ihn in Google Authenticator, 1Password, Authy oder einer beliebigen RFC-6238-App hinzu und geben Sie dann den 6-stelligen Code ein.",
    secretManualLabel: "Manueller Einrichtungscode",
    provisioningUriLabel: "QR-Code-URI",
    codeLabel: "6-stelliger Code",
    verifyLabel: "Verifizieren und aktivieren",
    successMessage:
      "Zwei-Faktor ist aktiv. Andere Geräte wurden abgemeldet; melden Sie sich neu an, um Sync weiter zu nutzen.",
    cancelLabel: "Abbrechen",
    recoveryCodeReplacedHint:
      "Durch das Aktivieren der Zwei-Faktor-Authentifizierung wurde Ihr Wiederherstellungscode ersetzt. Der Code aus der Registrierung oder der letzten Neuerstellung funktioniert nicht mehr. Speichern Sie diesen – er wird nur einmal angezeigt.",
  },
  disable: {
    currentPasswordLabel: "Aktuelles Passwort",
    codeLabel: "6-stelliger Code",
    submitLabel: "Zwei-Faktor deaktivieren",
    successMessage: "Zwei-Faktor ist aus. Alle Sitzungen wurden beendet.",
  },
  challenge: {
    title: "Geben Sie Ihren 6-stelligen Code ein",
    hint: "Öffnen Sie Ihre Authenticator-App und geben Sie den aktuellen Code für dieses Konto ein.",
    codeLabel: "6-stelliger Code",
    submitLabel: "Verifizieren",
    cancelLabel: "Abbrechen",
    expiredHint: "Anmelde-Challenge abgelaufen. Bitte erneut anmelden.",
  },
  errors: {
    currentPasswordRequired: "Geben Sie Ihr aktuelles Passwort ein.",
    invalidCurrentPassword: "Aktuelles Passwort ist falsch.",
    totpNotConfigured:
      "Zwei-Faktor ist auf diesem Server nicht konfiguriert.",
    totpAlreadyEnabled: "Zwei-Faktor ist bereits aktiv. Deaktivieren Sie ihn zuerst.",
    totpInvalidCode:
      "Code ist falsch. Probieren Sie den aktuellen Code aus Ihrer App.",
    totpReplayed: "Dieser Code wurde schon verwendet. Warten Sie auf einen neuen.",
    totpChallengeInvalid: "Anmelde-Challenge abgelaufen. Bitte erneut anmelden.",
    totpSecretFailed:
      "Mit dem Secret ist etwas schiefgegangen. Bitte erneut versuchen.",
    challengeIDRequired: "Challenge fehlt. Bitte erneut anmelden.",
    notConnected:
      "Verbinden Sie ein Sync-Konto, bevor Sie Zwei-Faktor ändern.",
    rateLimited: "Zu viele Versuche. Bitte später erneut versuchen.",
    networkFailed: "Netzwerkfehler. Bitte erneut versuchen.",
    unauthorized: "Sitzung abgelaufen. Bitte erneut anmelden.",
    totpEnrollInvalidCode:
      "Der Code ist falsch. Wurde die Einrichtung auch auf einem anderen Gerät gestartet, gilt nur die neueste: Schließen Sie sie dort ab oder brechen Sie ab und starten Sie hier neu.",
    totpEnrollmentRestartRequired:
      "Zu viele Versuche für diese Einrichtung, sie wurde abgebrochen. Geben Sie Ihr Passwort ein, um neu zu starten.",
    totpEnrollmentNotStarted:
      "Diese Einrichtung ist nicht mehr offen. Geben Sie Ihr Passwort ein, um neu zu starten.",
    totpAlreadyDisabled:
      "Zwei-Faktor ist für dieses Konto bereits deaktiviert.",
    totpRecoveryCodeLost:
      "Die Zwei-Faktor-Authentifizierung ist jetzt aktiv, aber der neue Wiederherstellungscode hat dieses Gerät nicht erreicht, und Ihr bisheriger Code funktioniert nicht mehr. Holen Sie sich über „Wiederherstellungscode erneuern“ einen neuen.",
    generic: "Etwas ist schiefgegangen. Bitte erneut versuchen.",
  },
};

const totpCopyFr: TOTPCopy = {
  section: {
    title: "Authentification à deux facteurs",
    hint: "Ajoutez un code à 6 chiffres depuis une appli d'authentification en plus de votre mot de passe.",
    enableTab: "Activer",
    disableTab: "Désactiver",
    statusEnabled: "L'authentification à deux facteurs est activée.",
    statusDisabled: "L'authentification à deux facteurs est désactivée.",
  },
  enroll: {
    currentPasswordLabel: "Mot de passe actuel",
    startLabel: "Démarrer la configuration",
    secretTitle: "Scannez ou saisissez ce code",
    secretHint:
      "Ajoutez-le à Google Authenticator, 1Password, Authy, ou toute appli RFC 6238, puis entrez le code à 6 chiffres ci-dessous.",
    secretManualLabel: "Code de configuration manuelle",
    provisioningUriLabel: "URI du QR code",
    codeLabel: "Code à 6 chiffres",
    verifyLabel: "Vérifier et activer",
    successMessage:
      "Le deuxième facteur est actif. Les autres appareils ont été déconnectés ; reconnectez-vous pour continuer à utiliser sync.",
    cancelLabel: "Annuler",
    recoveryCodeReplacedHint:
      "L'activation du deuxième facteur a remplacé votre code de récupération. Le code reçu à l'inscription ou lors de la dernière régénération ne fonctionne plus. Sauvegardez celui-ci : il n'est affiché qu'une seule fois.",
  },
  disable: {
    currentPasswordLabel: "Mot de passe actuel",
    codeLabel: "Code à 6 chiffres",
    submitLabel: "Désactiver le deuxième facteur",
    successMessage: "Le deuxième facteur est désactivé. Toutes les sessions ont été déconnectées.",
  },
  challenge: {
    title: "Saisissez votre code à 6 chiffres",
    hint: "Ouvrez votre appli d'authentification et saisissez le code actuel pour ce compte.",
    codeLabel: "Code à 6 chiffres",
    submitLabel: "Vérifier",
    cancelLabel: "Annuler",
    expiredHint: "Défi de connexion expiré. Reconnectez-vous.",
  },
  errors: {
    currentPasswordRequired: "Saisissez votre mot de passe actuel.",
    invalidCurrentPassword: "Le mot de passe actuel est incorrect.",
    totpNotConfigured:
      "Le deuxième facteur n'est pas configuré sur ce serveur.",
    totpAlreadyEnabled:
      "Le deuxième facteur est déjà activé. Désactivez-le d'abord.",
    totpInvalidCode:
      "Code incorrect. Essayez le dernier code de votre appli.",
    totpReplayed: "Ce code a déjà été utilisé. Attendez-en un nouveau.",
    totpChallengeInvalid: "Défi de connexion expiré. Reconnectez-vous.",
    totpSecretFailed:
      "Problème avec le secret. Réessayez.",
    challengeIDRequired: "Défi manquant. Reconnectez-vous.",
    notConnected:
      "Connectez un compte sync avant de modifier le deuxième facteur.",
    rateLimited: "Trop d'essais. Réessayez plus tard.",
    networkFailed: "Erreur réseau. Réessayez.",
    unauthorized: "Session expirée. Reconnectez-vous.",
    totpEnrollInvalidCode:
      "Code incorrect. Si la configuration a aussi été lancée sur un autre appareil, seule la plus récente compte : terminez-la là-bas, ou annulez et recommencez ici.",
    totpEnrollmentRestartRequired:
      "Trop d'essais pour cette configuration, elle a été annulée. Entrez votre mot de passe pour recommencer.",
    totpEnrollmentNotStarted:
      "Cette configuration n'est plus en attente. Entrez votre mot de passe pour recommencer.",
    totpAlreadyDisabled:
      "Le deuxième facteur est déjà désactivé pour ce compte.",
    totpRecoveryCodeLost:
      "Le deuxième facteur est maintenant activé, mais le nouveau code de récupération n'est pas parvenu à cet appareil et votre ancien code ne fonctionne plus. Utilisez « Régénérer le code de récupération » pour en obtenir un nouveau.",
    generic: "Quelque chose a échoué. Réessayez.",
  },
};

const totpCopyRu: TOTPCopy = {
  section: {
    title: "Двухфакторная аутентификация",
    hint: "Дополните пароль шестизначным кодом из приложения-аутентификатора.",
    enableTab: "Включить",
    disableTab: "Выключить",
    statusEnabled: "Двухфакторная аутентификация включена.",
    statusDisabled: "Двухфакторная аутентификация выключена.",
  },
  enroll: {
    currentPasswordLabel: "Текущий пароль",
    startLabel: "Начать настройку",
    secretTitle: "Отсканируйте или введите этот код",
    secretHint:
      "Добавьте его в Google Authenticator, 1Password, Authy или любое приложение по RFC 6238, затем введите шестизначный код ниже.",
    secretManualLabel: "Код для ручного ввода",
    provisioningUriLabel: "URI QR-кода",
    codeLabel: "Шестизначный код",
    verifyLabel: "Проверить и включить",
    successMessage:
      "Двухфакторка включена. Остальные устройства были отключены; войдите заново, чтобы продолжить пользоваться синхронизацией.",
    cancelLabel: "Отмена",
    recoveryCodeReplacedHint:
      "Включение двухфакторки заменило код восстановления. Код, полученный при регистрации или последнем обновлении, больше не работает. Сохраните этот — он показывается только один раз.",
  },
  disable: {
    currentPasswordLabel: "Текущий пароль",
    codeLabel: "Шестизначный код",
    submitLabel: "Выключить двухфакторку",
    successMessage: "Двухфакторка выключена. Все сессии завершены.",
  },
  challenge: {
    title: "Введите свой шестизначный код",
    hint: "Откройте приложение-аутентификатор и введите текущий код для этого аккаунта.",
    codeLabel: "Шестизначный код",
    submitLabel: "Проверить",
    cancelLabel: "Отмена",
    expiredHint: "Срок запроса истёк. Войдите заново.",
  },
  errors: {
    currentPasswordRequired: "Введите текущий пароль.",
    invalidCurrentPassword: "Текущий пароль неверный.",
    totpNotConfigured: "Двухфакторка не настроена на этом сервере.",
    totpAlreadyEnabled:
      "Двухфакторка уже включена. Сначала выключите её.",
    totpInvalidCode: "Код неверный. Попробуйте последний код из приложения.",
    totpReplayed: "Этот код уже использовался. Подождите следующий.",
    totpChallengeInvalid: "Срок запроса на вход истёк. Войдите заново.",
    totpSecretFailed: "Что-то с секретом пошло не так. Повторите попытку.",
    challengeIDRequired: "Запрос отсутствует. Войдите заново.",
    notConnected:
      "Сначала подключите аккаунт синхронизации, чтобы менять двухфакторку.",
    rateLimited: "Слишком много попыток. Повторите позже.",
    networkFailed: "Сетевая ошибка. Повторите попытку.",
    unauthorized: "Сессия истекла. Войдите заново.",
    totpEnrollInvalidCode:
      "Код неверный. Если настройку начали и на другом устройстве, действует только самая новая: завершите её там или отмените и начните заново здесь.",
    totpEnrollmentRestartRequired:
      "Слишком много попыток для этой настройки, она отменена. Введите пароль, чтобы начать заново.",
    totpEnrollmentNotStarted:
      "Эта настройка больше не активна. Введите пароль, чтобы начать заново.",
    totpAlreadyDisabled:
      "Двухфакторка для этого аккаунта уже выключена.",
    totpRecoveryCodeLost:
      "Двухфакторка включена, но новый код восстановления не дошёл до этого устройства, а прежний код больше не работает. Получите новый через «Перевыпустить код восстановления».",
    generic: "Что-то пошло не так. Повторите попытку.",
  },
};

const totpCopyEs: TOTPCopy = {
  section: {
    title: "Autenticación en dos pasos",
    hint: "Añade un código de 6 dígitos de una app de autenticación además de tu contraseña.",
    enableTab: "Activar",
    disableTab: "Desactivar",
    statusEnabled: "La autenticación de dos factores está activada.",
    statusDisabled: "La autenticación de dos factores está desactivada.",
  },
  enroll: {
    currentPasswordLabel: "Contraseña actual",
    startLabel: "Empezar configuración",
    secretTitle: "Escanea o introduce este código",
    secretHint:
      "Añádelo a Google Authenticator, 1Password, Authy o cualquier app RFC 6238, luego introduce el código de 6 dígitos abajo.",
    secretManualLabel: "Código de configuración manual",
    provisioningUriLabel: "URI del código QR",
    codeLabel: "Código de 6 dígitos",
    verifyLabel: "Verificar y activar",
    successMessage:
      "Dos pasos activo. Otros dispositivos fueron desconectados; vuelve a iniciar sesión para seguir usando sync.",
    cancelLabel: "Cancelar",
    recoveryCodeReplacedHint:
      "Al activar la verificación en dos pasos se reemplazó tu código de recuperación. El código del registro o de la última regeneración ya no funciona. Guarda este: se muestra solo una vez.",
  },
  disable: {
    currentPasswordLabel: "Contraseña actual",
    codeLabel: "Código de 6 dígitos",
    submitLabel: "Desactivar dos pasos",
    successMessage: "Dos pasos desactivado. Todas las sesiones fueron cerradas.",
  },
  challenge: {
    title: "Introduce tu código de 6 dígitos",
    hint: "Abre tu app de autenticación e introduce el código actual de esta cuenta.",
    codeLabel: "Código de 6 dígitos",
    submitLabel: "Verificar",
    cancelLabel: "Cancelar",
    expiredHint: "El desafío de inicio de sesión expiró. Vuelve a iniciar sesión.",
  },
  errors: {
    currentPasswordRequired: "Introduce tu contraseña actual.",
    invalidCurrentPassword: "La contraseña actual es incorrecta.",
    totpNotConfigured:
      "El segundo factor no está configurado en este servidor.",
    totpAlreadyEnabled:
      "El segundo factor ya está activo. Desactívalo primero.",
    totpInvalidCode:
      "Código incorrecto. Prueba el último código de tu app.",
    totpReplayed: "Ese código ya se usó. Espera uno nuevo.",
    totpChallengeInvalid:
      "El desafío de inicio de sesión expiró. Vuelve a iniciar sesión.",
    totpSecretFailed: "Hubo un problema con el secreto. Inténtalo de nuevo.",
    challengeIDRequired: "Falta el desafío. Vuelve a iniciar sesión.",
    notConnected:
      "Conecta una cuenta de sync antes de cambiar el segundo factor.",
    rateLimited: "Demasiados intentos. Inténtalo más tarde.",
    networkFailed: "Error de red. Inténtalo de nuevo.",
    unauthorized: "La sesión ha caducado. Vuelve a iniciar sesión.",
    totpEnrollInvalidCode:
      "Código incorrecto. Si también iniciaste la configuración en otro dispositivo, solo cuenta la más reciente: termínala allí o cancela y empieza de nuevo aquí.",
    totpEnrollmentRestartRequired:
      "Demasiados intentos para esta configuración; se canceló. Introduce tu contraseña para empezar de nuevo.",
    totpEnrollmentNotStarted:
      "Esta configuración ya no está pendiente. Introduce tu contraseña para empezar de nuevo.",
    totpAlreadyDisabled:
      "El segundo factor ya está desactivado en esta cuenta.",
    totpRecoveryCodeLost:
      "La verificación en dos pasos ya está activada, pero el nuevo código de recuperación no llegó a este dispositivo y tu código anterior ya no funciona. Usa «Regenerar código de recuperación» para obtener uno nuevo.",
    generic: "Algo salió mal. Inténtalo de nuevo.",
  },
};

const totpCopyIt: TOTPCopy = {
  section: {
    title: "Autenticazione a due fattori",
    hint: "Aggiungi un codice a 6 cifre da un'app di autenticazione oltre alla tua password.",
    enableTab: "Attiva",
    disableTab: "Disattiva",
    statusEnabled: "L'autenticazione a due fattori è attiva.",
    statusDisabled: "L'autenticazione a due fattori è disattivata.",
  },
  enroll: {
    currentPasswordLabel: "Password corrente",
    startLabel: "Avvia la configurazione",
    secretTitle: "Scansiona o inserisci questo codice",
    secretHint:
      "Aggiungilo a Google Authenticator, 1Password, Authy o a qualsiasi app RFC 6238, poi inserisci il codice a 6 cifre qui sotto.",
    secretManualLabel: "Codice di configurazione manuale",
    provisioningUriLabel: "URI del codice QR",
    codeLabel: "Codice a 6 cifre",
    verifyLabel: "Verifica e attiva",
    successMessage:
      "L'autenticazione a due fattori è attiva. Gli altri dispositivi sono stati disconnessi; accedi di nuovo per continuare a usare sync.",
    cancelLabel: "Annulla",
    recoveryCodeReplacedHint:
      "L'attivazione dell'autenticazione a due fattori ha sostituito il codice di recupero. Il codice della registrazione o dell'ultima rigenerazione non funziona più. Salva questo: viene mostrato una sola volta.",
  },
  disable: {
    currentPasswordLabel: "Password corrente",
    codeLabel: "Codice a 6 cifre",
    submitLabel: "Disattiva l'autenticazione a due fattori",
    successMessage: "L'autenticazione a due fattori è disattivata. Tutte le sessioni sono state disconnesse.",
  },
  challenge: {
    title: "Inserisci il tuo codice a 6 cifre",
    hint: "Apri la tua app di autenticazione e inserisci il codice corrente per questo account.",
    codeLabel: "Codice a 6 cifre",
    submitLabel: "Verifica",
    cancelLabel: "Annulla",
    expiredHint: "La verifica è scaduta. Accedi di nuovo.",
  },
  errors: {
    currentPasswordRequired: "Inserisci la tua password corrente.",
    invalidCurrentPassword: "La password corrente non è corretta.",
    totpNotConfigured: "L'autenticazione a due fattori non è configurata su questo server.",
    totpAlreadyEnabled: "L'autenticazione a due fattori è già attiva. Disattivala prima.",
    totpInvalidCode: "Codice non corretto. Prova l'ultimo generato dalla tua app.",
    totpReplayed: "Quel codice è già stato usato. Attendi quello nuovo.",
    totpChallengeInvalid: "La verifica di accesso è scaduta. Accedi di nuovo.",
    totpSecretFailed: "Qualcosa è andato storto con il segreto. Riprova.",
    challengeIDRequired: "Verifica mancante. Accedi di nuovo.",
    notConnected: "Collega un account sync prima di modificare l'autenticazione a due fattori.",
    rateLimited: "Troppi tentativi. Riprova più tardi.",
    networkFailed: "Errore di rete. Riprova.",
    unauthorized: "Sessione scaduta. Accedi di nuovo.",
    totpEnrollInvalidCode:
      "Codice non corretto. Se la configurazione è stata avviata anche su un altro dispositivo, vale solo la più recente: completala lì, oppure annulla e ricomincia qui.",
    totpEnrollmentRestartRequired:
      "Troppi tentativi per questa configurazione, che è stata annullata. Inserisci la password per ricominciare.",
    totpEnrollmentNotStarted:
      "Questa configurazione non è più in attesa. Inserisci la password per ricominciare.",
    totpAlreadyDisabled:
      "L'autenticazione a due fattori è già disattivata per questo account.",
    totpRecoveryCodeLost:
      "L'autenticazione a due fattori è ora attiva, ma il nuovo codice di recupero non è arrivato su questo dispositivo e il codice precedente non funziona più. Usa «Rigenera codice di recupero» per ottenerne uno nuovo.",
    generic: "Qualcosa è andato storto. Riprova.",
  },
};

const TOTP_COPY: Record<InterfaceLanguage, TOTPCopy> = {
  en: totpCopyEn,
  de: totpCopyDe,
  fr: totpCopyFr,
  ru: totpCopyRu,
  es: totpCopyEs,
  it: totpCopyIt,
};

export function selectTOTPCopy(language: InterfaceLanguage): TOTPCopy {
  return TOTP_COPY[language] ?? totpCopyEn;
}
