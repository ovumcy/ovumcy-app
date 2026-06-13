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
    generic: "Algo salió mal. Inténtalo de nuevo.",
  },
};

const TOTP_COPY: Record<InterfaceLanguage, TOTPCopy> = {
  en: totpCopyEn,
  de: totpCopyDe,
  fr: totpCopyFr,
  ru: totpCopyRu,
  es: totpCopyEs,
};

export function selectTOTPCopy(language: InterfaceLanguage): TOTPCopy {
  return TOTP_COPY[language] ?? totpCopyEn;
}
