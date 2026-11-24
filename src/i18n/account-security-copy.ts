import type { InterfaceLanguage } from "../models/profile";

export type AccountSecurityCopy = {
  title: string;
  subtitle: string;
  backLabel: string;
  loading: string;

  changePassword: {
    title: string;
    hint: string;
    currentPasswordLabel: string;
    newPasswordLabel: string;
    submitLabel: string;
    successMessage: string;
  };

  forgotPassword: {
    title: string;
    hint: string;
    loginLabel: string;
    recoveryCodeLabel: string;
    submitLabel: string;
    stageTwoTitle: string;
    stageTwoHint: string;
    newPasswordLabel: string;
    submitResetLabel: string;
    cancelLabel: string;
    completedMessage: string;
    signedOutMessage: string;
  };

  regenerate: {
    title: string;
    hint: string;
    currentPasswordLabel: string;
    codeLabel: string;
    submitLabel: string;
    signedOutMessage: string;
  };

  reveal: {
    title: string;
    hint: string;
    passwordChangedHint: string;
    confirmLabel: string;
  };

  errors: {
    currentPasswordRequired: string;
    newPasswordRequired: string;
    passwordTooShort: string;
    passwordTooLong: string;
    invalidCurrentPassword: string;
    newPasswordMustDiffer: string;
    weakNewPassword: string;
    invalidRecoveryCredentials: string;
    invalidResetToken: string;
    notConnected: string;
    rateLimitedRetry: string;
    networkFailed: string;
    loginRequired: string;
    recoveryCodeRequired: string;
    resetTokenRequired: string;
    unauthorized: string;
    totpCodeRequired: string;
    regenerateResponseLost: string;
    changePasswordResponseLost: string;
    generic: string;
  };
};

const accountSecurityCopyEn: AccountSecurityCopy = {
  title: "Account security",
  subtitle: "Manage your sync account password and recovery code.",
  backLabel: "Back to backup & sync",
  loading: "Loading account…",

  changePassword: {
    title: "Change password",
    hint: "Other devices will be signed out. This device stays connected.",
    currentPasswordLabel: "Current password",
    newPasswordLabel: "New password",
    submitLabel: "Change password",
    successMessage: "Password changed. Other devices have been signed out.",
  },

  forgotPassword: {
    title: "Forgot password",
    hint: "Use your account-level recovery code to reset the password.",
    loginLabel: "Login or email",
    recoveryCodeLabel: "Recovery code",
    submitLabel: "Request password reset",
    stageTwoTitle: "Set a new password",
    stageTwoHint:
      "Reset will sign you out everywhere, disable two-factor authentication if it was on, and issue a new recovery code.",
    newPasswordLabel: "New password",
    submitResetLabel: "Reset password",
    cancelLabel: "Cancel",
    completedMessage:
      "Password reset. Save the new recovery code shown above, then sign in again.",
    signedOutMessage:
      "You've been signed out on this device. Reconnect with your new password.",
  },

  regenerate: {
    title: "Regenerate recovery code",
    hint: "Confirm with your current password. The new code replaces the old one.",
    currentPasswordLabel: "Current password",
    codeLabel: "Two-factor code from your authenticator app",
    submitLabel: "Generate new recovery code",
    signedOutMessage:
      "Your new recovery code signed you out on all devices. Sign in again to keep using sync.",
  },

  reveal: {
    title: "Save this recovery code",
    hint: "Shown only once. Use it if you ever forget the account password.",
    passwordChangedHint:
      "Changing the password replaced your recovery code, and the old one no longer works. Shown only once.",
    confirmLabel: "I have saved it",
  },

  errors: {
    currentPasswordRequired: "Enter your current password.",
    newPasswordRequired: "Enter a new password.",
    passwordTooShort: "Password must be at least 12 characters.",
    passwordTooLong:
      "Password is too long: use at most 72 characters, fewer with non-Latin letters or emoji.",
    invalidCurrentPassword: "Current password is incorrect.",
    newPasswordMustDiffer:
      "New password must be different from the current one.",
    weakNewPassword: "New password must be at least 12 characters.",
    invalidRecoveryCredentials: "Login or recovery code is incorrect.",
    invalidResetToken: "Reset token expired or is invalid. Start over.",
    notConnected: "Connect a sync account before changing its password.",
    rateLimitedRetry:
      "Too many attempts. Please wait a moment before trying again.",
    networkFailed: "Network error. Try again.",
    loginRequired: "Enter your login or email.",
    recoveryCodeRequired: "Enter the recovery code.",
    resetTokenRequired: "Reset token is missing.",
    unauthorized: "Session expired. Sign in again.",
    totpCodeRequired:
      "Two-factor is on. Enter the current 6-digit code from your authenticator app.",
    regenerateResponseLost:
      "The answer did not reach this device, so your recovery code may already have been replaced and the old one may no longer work. Use “Generate new recovery code” again.",
    changePasswordResponseLost:
      "The answer did not reach this device, so the password may already have changed and the old recovery code may no longer work. Use “Generate new recovery code” with the password that works.",
    generic: "Something went wrong. Try again.",
  },
};

const accountSecurityCopyDe: AccountSecurityCopy = {
  title: "Konto-Sicherheit",
  subtitle: "Verwalten Sie das Passwort und den Wiederherstellungscode Ihres Sync-Kontos.",
  backLabel: "Zurück zu Backup & Sync",
  loading: "Konto wird geladen…",

  changePassword: {
    title: "Passwort ändern",
    hint: "Andere Geräte werden abgemeldet. Dieses Gerät bleibt verbunden.",
    currentPasswordLabel: "Aktuelles Passwort",
    newPasswordLabel: "Neues Passwort",
    submitLabel: "Passwort ändern",
    successMessage: "Passwort geändert. Andere Geräte wurden abgemeldet.",
  },

  forgotPassword: {
    title: "Passwort vergessen",
    hint: "Verwenden Sie den Konto-Wiederherstellungscode, um das Passwort zurückzusetzen.",
    loginLabel: "Login oder E-Mail",
    recoveryCodeLabel: "Wiederherstellungscode",
    submitLabel: "Zurücksetzung anfordern",
    stageTwoTitle: "Neues Passwort setzen",
    stageTwoHint:
      "Das Zurücksetzen meldet Sie überall ab, deaktiviert die Zwei-Faktor-Authentifizierung (falls aktiv) und gibt einen neuen Wiederherstellungscode aus.",
    newPasswordLabel: "Neues Passwort",
    submitResetLabel: "Passwort zurücksetzen",
    cancelLabel: "Abbrechen",
    completedMessage:
      "Passwort zurückgesetzt. Speichern Sie den neuen Wiederherstellungscode oben und melden Sie sich erneut an.",
    signedOutMessage:
      "Sie wurden auf diesem Gerät abgemeldet. Verbinden Sie sich erneut mit Ihrem neuen Passwort.",
  },

  regenerate: {
    title: "Wiederherstellungscode erneuern",
    hint: "Bestätigen Sie mit Ihrem aktuellen Passwort. Der neue Code ersetzt den alten.",
    currentPasswordLabel: "Aktuelles Passwort",
    codeLabel: "Zwei-Faktor-Code aus Ihrer Authenticator-App",
    submitLabel: "Neuen Wiederherstellungscode erzeugen",
    signedOutMessage:
      "Der neue Wiederherstellungscode hat Sie auf allen Geräten abgemeldet. Melden Sie sich erneut an, um die Synchronisierung weiter zu nutzen.",
  },

  reveal: {
    title: "Diesen Wiederherstellungscode speichern",
    hint: "Wird nur einmal angezeigt. Verwenden Sie ihn, falls Sie das Konto-Passwort vergessen.",
    passwordChangedHint:
      "Die Passwortänderung hat Ihren Wiederherstellungscode ersetzt; der alte funktioniert nicht mehr. Wird nur einmal angezeigt.",
    confirmLabel: "Ich habe ihn gespeichert",
  },

  errors: {
    currentPasswordRequired: "Geben Sie Ihr aktuelles Passwort ein.",
    newPasswordRequired: "Geben Sie ein neues Passwort ein.",
    passwordTooShort: "Das Passwort muss mindestens 12 Zeichen lang sein.",
    passwordTooLong:
      "Das Passwort ist zu lang: höchstens 72 Zeichen, mit nicht-lateinischen Buchstaben oder Emoji weniger.",
    invalidCurrentPassword: "Aktuelles Passwort ist falsch.",
    newPasswordMustDiffer:
      "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    weakNewPassword: "Das neue Passwort muss mindestens 12 Zeichen lang sein.",
    invalidRecoveryCredentials: "Login oder Wiederherstellungscode ist falsch.",
    invalidResetToken:
      "Zurücksetzungs-Token abgelaufen oder ungültig. Starten Sie erneut.",
    notConnected:
      "Verbinden Sie ein Sync-Konto, bevor Sie dessen Passwort ändern.",
    rateLimitedRetry:
      "Zu viele Versuche. Bitte warten Sie einen Moment, bevor Sie es erneut versuchen.",
    networkFailed: "Netzwerkfehler. Versuchen Sie es erneut.",
    loginRequired: "Geben Sie Ihren Login oder Ihre E-Mail ein.",
    recoveryCodeRequired: "Geben Sie den Wiederherstellungscode ein.",
    resetTokenRequired: "Zurücksetzungs-Token fehlt.",
    unauthorized: "Sitzung abgelaufen. Melden Sie sich erneut an.",
    totpCodeRequired:
      "Zwei-Faktor ist aktiv. Geben Sie den aktuellen 6-stelligen Code aus Ihrer Authenticator-App ein.",
    regenerateResponseLost:
      "Die Antwort hat dieses Gerät nicht erreicht. Ihr Wiederherstellungscode wurde möglicherweise schon ersetzt, und der bisherige funktioniert dann nicht mehr. Tippen Sie erneut auf „Neuen Wiederherstellungscode erzeugen“.",
    changePasswordResponseLost:
      "Die Antwort hat dieses Gerät nicht erreicht. Das Passwort wurde möglicherweise schon geändert, und der alte Wiederherstellungscode funktioniert dann nicht mehr. Erzeugen Sie mit dem funktionierenden Passwort einen neuen Wiederherstellungscode.",
    generic: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",
  },
};

const accountSecurityCopyFr: AccountSecurityCopy = {
  title: "Sécurité du compte",
  subtitle:
    "Gérez le mot de passe et le code de récupération de votre compte de sync.",
  backLabel: "Retour à Backup & Sync",
  loading: "Chargement du compte…",

  changePassword: {
    title: "Changer le mot de passe",
    hint: "Les autres appareils seront déconnectés. Cet appareil reste connecté.",
    currentPasswordLabel: "Mot de passe actuel",
    newPasswordLabel: "Nouveau mot de passe",
    submitLabel: "Changer le mot de passe",
    successMessage:
      "Mot de passe changé. Les autres appareils ont été déconnectés.",
  },

  forgotPassword: {
    title: "Mot de passe oublié",
    hint: "Utilisez votre code de récupération du compte pour réinitialiser le mot de passe.",
    loginLabel: "Login ou e-mail",
    recoveryCodeLabel: "Code de récupération",
    submitLabel: "Demander la réinitialisation",
    stageTwoTitle: "Définir un nouveau mot de passe",
    stageTwoHint:
      "La réinitialisation vous déconnecte partout, désactive l'authentification à deux facteurs si elle était active, et émet un nouveau code de récupération.",
    newPasswordLabel: "Nouveau mot de passe",
    submitResetLabel: "Réinitialiser le mot de passe",
    cancelLabel: "Annuler",
    completedMessage:
      "Mot de passe réinitialisé. Sauvegardez le nouveau code de récupération affiché ci-dessus, puis reconnectez-vous.",
    signedOutMessage:
      "Vous avez été déconnecté(e) sur cet appareil. Reconnectez-vous avec votre nouveau mot de passe.",
  },

  regenerate: {
    title: "Régénérer le code de récupération",
    hint: "Confirmez avec votre mot de passe actuel. Le nouveau code remplace l'ancien.",
    currentPasswordLabel: "Mot de passe actuel",
    codeLabel: "Code de double authentification de votre application",
    submitLabel: "Générer un nouveau code de récupération",
    signedOutMessage:
      "Le nouveau code de récupération vous a déconnecté de tous vos appareils. Reconnectez-vous pour continuer à utiliser la synchronisation.",
  },

  reveal: {
    title: "Sauvegardez ce code de récupération",
    hint: "Affiché une seule fois. Utilisez-le si vous oubliez le mot de passe du compte.",
    passwordChangedHint:
      "Le changement de mot de passe a remplacé votre code de récupération ; l'ancien ne fonctionne plus. Affiché une seule fois.",
    confirmLabel: "Je l'ai sauvegardé",
  },

  errors: {
    currentPasswordRequired: "Entrez votre mot de passe actuel.",
    newPasswordRequired: "Entrez un nouveau mot de passe.",
    passwordTooShort: "Le mot de passe doit comporter au moins 12 caractères.",
    passwordTooLong:
      "Le mot de passe est trop long : 72 caractères au maximum, moins avec des lettres non latines ou des emoji.",
    invalidCurrentPassword: "Mot de passe actuel incorrect.",
    newPasswordMustDiffer:
      "Le nouveau mot de passe doit être différent de l'actuel.",
    weakNewPassword:
      "Le nouveau mot de passe doit comporter au moins 12 caractères.",
    invalidRecoveryCredentials: "Login ou code de récupération incorrect.",
    invalidResetToken:
      "Token de réinitialisation expiré ou invalide. Recommencez.",
    notConnected:
      "Connectez un compte de sync avant de changer son mot de passe.",
    rateLimitedRetry:
      "Trop de tentatives. Veuillez patienter un instant avant de réessayer.",
    networkFailed: "Erreur réseau. Réessayez.",
    loginRequired: "Entrez votre login ou votre e-mail.",
    recoveryCodeRequired: "Entrez le code de récupération.",
    resetTokenRequired: "Token de réinitialisation manquant.",
    unauthorized: "Session expirée. Reconnectez-vous.",
    totpCodeRequired:
      "La double authentification est activée. Saisissez le code à 6 chiffres actuel de votre application.",
    regenerateResponseLost:
      "La réponse n'est pas parvenue à cet appareil : votre code de récupération a peut-être déjà été remplacé, et l'ancien ne fonctionne alors plus. Utilisez à nouveau « Générer un nouveau code de récupération ».",
    changePasswordResponseLost:
      "La réponse n'est pas parvenue à cet appareil : le mot de passe a peut-être déjà changé et l'ancien code de récupération ne fonctionne peut-être plus. Générez un nouveau code de récupération avec le mot de passe qui fonctionne.",
    generic: "Quelque chose s'est mal passé. Réessayez.",
  },
};

const accountSecurityCopyRu: AccountSecurityCopy = {
  title: "Безопасность аккаунта",
  subtitle:
    "Управляйте паролем и кодом восстановления вашего sync-аккаунта.",
  backLabel: "Назад к Backup & Sync",
  loading: "Загрузка аккаунта…",

  changePassword: {
    title: "Сменить пароль",
    hint: "Другие устройства будут отключены. Это устройство останется подключённым.",
    currentPasswordLabel: "Текущий пароль",
    newPasswordLabel: "Новый пароль",
    submitLabel: "Сменить пароль",
    successMessage: "Пароль изменён. Другие устройства отключены.",
  },

  forgotPassword: {
    title: "Забыли пароль",
    hint: "Используйте код восстановления аккаунта, чтобы сбросить пароль.",
    loginLabel: "Логин или email",
    recoveryCodeLabel: "Код восстановления",
    submitLabel: "Запросить сброс пароля",
    stageTwoTitle: "Задать новый пароль",
    stageTwoHint:
      "Сброс выйдет из всех устройств, выключит двухфакторку (если была включена) и выдаст новый код восстановления.",
    newPasswordLabel: "Новый пароль",
    submitResetLabel: "Сбросить пароль",
    cancelLabel: "Отмена",
    completedMessage:
      "Пароль сброшен. Сохраните новый код восстановления выше и войдите снова.",
    signedOutMessage:
      "Вы вышли из аккаунта на этом устройстве. Подключитесь заново с новым паролем.",
  },

  regenerate: {
    title: "Перевыпустить код восстановления",
    hint: "Подтвердите текущим паролем. Новый код заменяет старый.",
    currentPasswordLabel: "Текущий пароль",
    codeLabel: "Код двухфакторки из приложения-аутентификатора",
    submitLabel: "Сгенерировать новый код восстановления",
    signedOutMessage:
      "Новый код восстановления завершил вход на всех устройствах. Войдите снова, чтобы продолжить пользоваться синхронизацией.",
  },

  reveal: {
    title: "Сохраните этот код восстановления",
    hint: "Показывается только один раз. Понадобится, если забудете пароль аккаунта.",
    passwordChangedHint:
      "Смена пароля заменила код восстановления, старый больше не работает. Показывается только один раз.",
    confirmLabel: "Я сохранил(а)",
  },

  errors: {
    currentPasswordRequired: "Введите текущий пароль.",
    newPasswordRequired: "Введите новый пароль.",
    passwordTooShort: "Пароль должен содержать не менее 12 символов.",
    passwordTooLong:
      "Пароль слишком длинный: не более 72 латинских символов; кириллица и эмодзи занимают больше места.",
    invalidCurrentPassword: "Неверный текущий пароль.",
    newPasswordMustDiffer:
      "Новый пароль должен отличаться от текущего.",
    weakNewPassword: "Новый пароль должен содержать не менее 12 символов.",
    invalidRecoveryCredentials: "Неверный логин или код восстановления.",
    invalidResetToken:
      "Токен сброса истёк или недействителен. Начните заново.",
    notConnected:
      "Сначала подключите sync-аккаунт, чтобы сменить его пароль.",
    rateLimitedRetry:
      "Слишком много попыток. Пожалуйста, подождите немного, прежде чем повторить.",
    networkFailed: "Ошибка сети. Попробуйте снова.",
    loginRequired: "Введите логин или email.",
    recoveryCodeRequired: "Введите код восстановления.",
    resetTokenRequired: "Отсутствует токен сброса.",
    unauthorized: "Сессия истекла. Войдите снова.",
    totpCodeRequired:
      "Двухфакторка включена. Введите текущий шестизначный код из приложения-аутентификатора.",
    regenerateResponseLost:
      "Ответ не дошёл до этого устройства: код восстановления, возможно, уже заменён, и прежний тогда больше не работает. Нажмите «Сгенерировать новый код восстановления» ещё раз.",
    changePasswordResponseLost:
      "Ответ не дошёл до устройства: пароль, возможно, уже изменён, и старый код восстановления может не работать. Создайте новый код восстановления с тем паролем, который подходит.",
    generic: "Что-то пошло не так. Попробуйте снова.",
  },
};

const accountSecurityCopyEs: AccountSecurityCopy = {
  title: "Seguridad de la cuenta",
  subtitle:
    "Administra la contraseña y el código de recuperación de tu cuenta de sync.",
  backLabel: "Volver a Backup & Sync",
  loading: "Cargando cuenta…",

  changePassword: {
    title: "Cambiar contraseña",
    hint: "Los otros dispositivos serán desconectados. Este dispositivo se mantiene conectado.",
    currentPasswordLabel: "Contraseña actual",
    newPasswordLabel: "Nueva contraseña",
    submitLabel: "Cambiar contraseña",
    successMessage:
      "Contraseña cambiada. Los otros dispositivos han sido desconectados.",
  },

  forgotPassword: {
    title: "Olvidé la contraseña",
    hint: "Usa el código de recuperación de la cuenta para restablecer la contraseña.",
    loginLabel: "Login o email",
    recoveryCodeLabel: "Código de recuperación",
    submitLabel: "Solicitar restablecimiento",
    stageTwoTitle: "Establecer una nueva contraseña",
    stageTwoHint:
      "El restablecimiento te desconecta en todas partes, desactiva la verificación en dos pasos si estaba activada y emite un nuevo código de recuperación.",
    newPasswordLabel: "Nueva contraseña",
    submitResetLabel: "Restablecer contraseña",
    cancelLabel: "Cancelar",
    completedMessage:
      "Contraseña restablecida. Guarda el nuevo código de recuperación mostrado arriba y vuelve a iniciar sesión.",
    signedOutMessage:
      "Has cerrado sesión en este dispositivo. Vuelve a conectarte con tu nueva contraseña.",
  },

  regenerate: {
    title: "Regenerar código de recuperación",
    hint: "Confirma con tu contraseña actual. El nuevo código reemplaza al anterior.",
    currentPasswordLabel: "Contraseña actual",
    codeLabel: "Código de doble factor de tu app de autenticación",
    submitLabel: "Generar nuevo código de recuperación",
    signedOutMessage:
      "El nuevo código de recuperación cerró tu sesión en todos los dispositivos. Inicia sesión de nuevo para seguir usando la sincronización.",
  },

  reveal: {
    title: "Guarda este código de recuperación",
    hint: "Se muestra solo una vez. Úsalo si olvidas la contraseña de la cuenta.",
    passwordChangedHint:
      "El cambio de contraseña reemplazó tu código de recuperación y el anterior ya no funciona. Se muestra solo una vez.",
    confirmLabel: "Lo he guardado",
  },

  errors: {
    currentPasswordRequired: "Introduce tu contraseña actual.",
    newPasswordRequired: "Introduce una nueva contraseña.",
    passwordTooShort: "La contraseña debe tener al menos 12 caracteres.",
    passwordTooLong:
      "La contraseña es demasiado larga: 72 caracteres como máximo, menos con letras no latinas o emoji.",
    invalidCurrentPassword: "La contraseña actual es incorrecta.",
    newPasswordMustDiffer:
      "La nueva contraseña debe ser distinta de la actual.",
    weakNewPassword: "La nueva contraseña debe tener al menos 12 caracteres.",
    invalidRecoveryCredentials:
      "Login o código de recuperación incorrecto.",
    invalidResetToken:
      "Token de restablecimiento caducado o inválido. Empieza de nuevo.",
    notConnected:
      "Conecta una cuenta de sync antes de cambiar su contraseña.",
    rateLimitedRetry:
      "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
    networkFailed: "Error de red. Vuelve a intentarlo.",
    loginRequired: "Introduce tu login o email.",
    recoveryCodeRequired: "Introduce el código de recuperación.",
    resetTokenRequired: "Falta el token de restablecimiento.",
    unauthorized: "La sesión ha caducado. Vuelve a iniciar sesión.",
    totpCodeRequired:
      "El doble factor está activado. Introduce el código actual de 6 dígitos de tu app de autenticación.",
    regenerateResponseLost:
      "La respuesta no llegó a este dispositivo: es posible que tu código de recuperación ya se haya reemplazado y que el anterior ya no funcione. Usa de nuevo «Generar nuevo código de recuperación».",
    changePasswordResponseLost:
      "La respuesta no llegó a este dispositivo: puede que la contraseña ya haya cambiado y que el código de recuperación anterior ya no funcione. Genera un nuevo código de recuperación con la contraseña que funcione.",
    generic: "Algo salió mal. Vuelve a intentarlo.",
  },
};

const accountSecurityCopyIt: AccountSecurityCopy = {
  title: "Sicurezza dell'account",
  subtitle:
    "Gestisci la password e il codice di recupero del tuo account sync.",
  backLabel: "Torna a Backup & Sync",
  loading: "Caricamento dell'account…",

  changePassword: {
    title: "Cambia password",
    hint: "Gli altri dispositivi verranno disconnessi. Questo dispositivo resta connesso.",
    currentPasswordLabel: "Password corrente",
    newPasswordLabel: "Nuova password",
    submitLabel: "Cambia password",
    successMessage: "Password modificata. Gli altri dispositivi sono stati disconnessi.",
  },

  forgotPassword: {
    title: "Password dimenticata",
    hint: "Usa il codice di recupero dell'account per reimpostare la password.",
    loginLabel: "Login o email",
    recoveryCodeLabel: "Codice di recupero",
    submitLabel: "Richiedi la reimpostazione della password",
    stageTwoTitle: "Imposta una nuova password",
    stageTwoHint:
      "La reimpostazione ti disconnette ovunque, disattiva l'autenticazione a due fattori se era attiva ed emette un nuovo codice di recupero.",
    newPasswordLabel: "Nuova password",
    submitResetLabel: "Reimposta password",
    cancelLabel: "Annulla",
    completedMessage:
      "Password reimpostata. Salva il nuovo codice di recupero mostrato sopra, poi accedi di nuovo.",
    signedOutMessage:
      "Sei stata disconnessa su questo dispositivo. Riconnettiti con la tua nuova password.",
  },

  regenerate: {
    title: "Rigenera codice di recupero",
    hint: "Conferma con la tua password corrente. Il nuovo codice sostituisce quello precedente.",
    currentPasswordLabel: "Password corrente",
    codeLabel: "Codice a due fattori dalla tua app di autenticazione",
    submitLabel: "Genera nuovo codice di recupero",
    signedOutMessage:
      "Il nuovo codice di recupero ti ha disconnesso da tutti i dispositivi. Accedi di nuovo per continuare a usare la sincronizzazione.",
  },

  reveal: {
    title: "Salva questo codice di recupero",
    hint: "Mostrato solo una volta. Usalo se dovessi dimenticare la password dell'account.",
    passwordChangedHint:
      "La modifica della password ha sostituito il codice di recupero e quello precedente non funziona più. Mostrato solo una volta.",
    confirmLabel: "L'ho salvato",
  },

  errors: {
    currentPasswordRequired: "Inserisci la tua password corrente.",
    newPasswordRequired: "Inserisci una nuova password.",
    passwordTooShort: "La password deve contenere almeno 12 caratteri.",
    passwordTooLong:
      "La password è troppo lunga: al massimo 72 caratteri, meno con lettere non latine o emoji.",
    invalidCurrentPassword: "La password corrente non è corretta.",
    newPasswordMustDiffer:
      "La nuova password deve essere diversa da quella corrente.",
    weakNewPassword: "La nuova password deve contenere almeno 12 caratteri.",
    invalidRecoveryCredentials: "Login o codice di recupero non corretto.",
    invalidResetToken: "Token di reimpostazione scaduto o non valido. Ricomincia.",
    notConnected: "Collega un account sync prima di cambiarne la password.",
    rateLimitedRetry:
      "Troppi tentativi. Attendi un momento prima di riprovare.",
    networkFailed: "Errore di rete. Riprova.",
    loginRequired: "Inserisci il tuo login o la tua email.",
    recoveryCodeRequired: "Inserisci il codice di recupero.",
    resetTokenRequired: "Token di reimpostazione mancante.",
    unauthorized: "Sessione scaduta. Accedi di nuovo.",
    totpCodeRequired:
      "L'autenticazione a due fattori è attiva. Inserisci il codice a 6 cifre attuale della tua app di autenticazione.",
    regenerateResponseLost:
      "La risposta non è arrivata su questo dispositivo: il codice di recupero potrebbe essere già stato sostituito e quello precedente non funzionare più. Usa di nuovo «Genera nuovo codice di recupero».",
    changePasswordResponseLost:
      "La risposta non è arrivata a questo dispositivo: la password potrebbe essere già cambiata e il vecchio codice di recupero potrebbe non funzionare più. Genera un nuovo codice di recupero con la password che funziona.",
    generic: "Qualcosa è andato storto. Riprova.",
  },
};

const ACCOUNT_SECURITY_COPY: Record<InterfaceLanguage, AccountSecurityCopy> = {
  en: accountSecurityCopyEn,
  de: accountSecurityCopyDe,
  fr: accountSecurityCopyFr,
  ru: accountSecurityCopyRu,
  es: accountSecurityCopyEs,
  it: accountSecurityCopyIt,
};

export function selectAccountSecurityCopy(
  language: InterfaceLanguage,
): AccountSecurityCopy {
  return ACCOUNT_SECURITY_COPY[language] ?? accountSecurityCopyEn;
}
