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
  };

  regenerate: {
    title: string;
    hint: string;
    currentPasswordLabel: string;
    submitLabel: string;
  };

  reveal: {
    title: string;
    hint: string;
    confirmLabel: string;
  };

  errors: {
    currentPasswordRequired: string;
    newPasswordRequired: string;
    invalidCurrentPassword: string;
    newPasswordMustDiffer: string;
    weakNewPassword: string;
    invalidRecoveryCredentials: string;
    invalidResetToken: string;
    notConnected: string;
    rateLimited: string;
    networkFailed: string;
    loginRequired: string;
    recoveryCodeRequired: string;
    resetTokenRequired: string;
    unauthorized: string;
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
  },

  regenerate: {
    title: "Regenerate recovery code",
    hint: "Confirm with your current password. The new code replaces the old one.",
    currentPasswordLabel: "Current password",
    submitLabel: "Generate new recovery code",
  },

  reveal: {
    title: "Save this recovery code",
    hint: "Shown only once. Use it if you ever forget the account password.",
    confirmLabel: "I have saved it",
  },

  errors: {
    currentPasswordRequired: "Enter your current password.",
    newPasswordRequired: "Enter a new password.",
    invalidCurrentPassword: "Current password is incorrect.",
    newPasswordMustDiffer:
      "New password must be different from the current one.",
    weakNewPassword: "New password is too short.",
    invalidRecoveryCredentials: "Login or recovery code is incorrect.",
    invalidResetToken: "Reset token expired or is invalid. Start over.",
    notConnected: "Connect a sync account before changing its password.",
    rateLimited: "Too many attempts. Try again later.",
    networkFailed: "Network error. Try again.",
    loginRequired: "Enter your login or email.",
    recoveryCodeRequired: "Enter the recovery code.",
    resetTokenRequired: "Reset token is missing.",
    unauthorized: "Session expired. Sign in again.",
    generic: "Something went wrong. Try again.",
  },
};

const accountSecurityCopyDe: AccountSecurityCopy = {
  title: "Konto-Sicherheit",
  subtitle: "Verwalte das Passwort und den Wiederherstellungscode deines Sync-Kontos.",
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
    hint: "Verwende den Konto-Wiederherstellungscode, um das Passwort zurückzusetzen.",
    loginLabel: "Login oder E-Mail",
    recoveryCodeLabel: "Wiederherstellungscode",
    submitLabel: "Zurücksetzung anfordern",
    stageTwoTitle: "Neues Passwort setzen",
    stageTwoHint:
      "Das Zurücksetzen meldet dich überall ab, deaktiviert die Zwei-Faktor-Authentifizierung (falls aktiv) und gibt einen neuen Wiederherstellungscode aus.",
    newPasswordLabel: "Neues Passwort",
    submitResetLabel: "Passwort zurücksetzen",
    cancelLabel: "Abbrechen",
    completedMessage:
      "Passwort zurückgesetzt. Speichere den neuen Wiederherstellungscode oben und melde dich erneut an.",
  },

  regenerate: {
    title: "Wiederherstellungscode erneuern",
    hint: "Bestätige mit deinem aktuellen Passwort. Der neue Code ersetzt den alten.",
    currentPasswordLabel: "Aktuelles Passwort",
    submitLabel: "Neuen Wiederherstellungscode erzeugen",
  },

  reveal: {
    title: "Diesen Wiederherstellungscode speichern",
    hint: "Wird nur einmal angezeigt. Verwende ihn, falls du das Konto-Passwort vergisst.",
    confirmLabel: "Ich habe ihn gespeichert",
  },

  errors: {
    currentPasswordRequired: "Gib dein aktuelles Passwort ein.",
    newPasswordRequired: "Gib ein neues Passwort ein.",
    invalidCurrentPassword: "Aktuelles Passwort ist falsch.",
    newPasswordMustDiffer:
      "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    weakNewPassword: "Das neue Passwort ist zu kurz.",
    invalidRecoveryCredentials: "Login oder Wiederherstellungscode ist falsch.",
    invalidResetToken:
      "Zurücksetzungs-Token abgelaufen oder ungültig. Starte erneut.",
    notConnected:
      "Verbinde ein Sync-Konto, bevor du dessen Passwort änderst.",
    rateLimited: "Zu viele Versuche. Versuche es später erneut.",
    networkFailed: "Netzwerkfehler. Versuche es erneut.",
    loginRequired: "Gib deinen Login oder deine E-Mail ein.",
    recoveryCodeRequired: "Gib den Wiederherstellungscode ein.",
    resetTokenRequired: "Zurücksetzungs-Token fehlt.",
    unauthorized: "Sitzung abgelaufen. Melde dich erneut an.",
    generic: "Etwas ist schiefgelaufen. Versuche es erneut.",
  },
};

const accountSecurityCopyFr: AccountSecurityCopy = {
  title: "Sécurité du compte",
  subtitle:
    "Gère le mot de passe et le code de récupération de ton compte de sync.",
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
    hint: "Utilise ton code de récupération du compte pour réinitialiser le mot de passe.",
    loginLabel: "Login ou e-mail",
    recoveryCodeLabel: "Code de récupération",
    submitLabel: "Demander la réinitialisation",
    stageTwoTitle: "Définir un nouveau mot de passe",
    stageTwoHint:
      "La réinitialisation te déconnecte partout, désactive l'authentification à deux facteurs si elle était active, et émet un nouveau code de récupération.",
    newPasswordLabel: "Nouveau mot de passe",
    submitResetLabel: "Réinitialiser le mot de passe",
    cancelLabel: "Annuler",
    completedMessage:
      "Mot de passe réinitialisé. Sauvegarde le nouveau code de récupération affiché ci-dessus, puis reconnecte-toi.",
  },

  regenerate: {
    title: "Régénérer le code de récupération",
    hint: "Confirme avec ton mot de passe actuel. Le nouveau code remplace l'ancien.",
    currentPasswordLabel: "Mot de passe actuel",
    submitLabel: "Générer un nouveau code de récupération",
  },

  reveal: {
    title: "Sauvegarde ce code de récupération",
    hint: "Affiché une seule fois. Utilise-le si tu oublies le mot de passe du compte.",
    confirmLabel: "Je l'ai sauvegardé",
  },

  errors: {
    currentPasswordRequired: "Entre ton mot de passe actuel.",
    newPasswordRequired: "Entre un nouveau mot de passe.",
    invalidCurrentPassword: "Mot de passe actuel incorrect.",
    newPasswordMustDiffer:
      "Le nouveau mot de passe doit être différent de l'actuel.",
    weakNewPassword: "Le nouveau mot de passe est trop court.",
    invalidRecoveryCredentials: "Login ou code de récupération incorrect.",
    invalidResetToken:
      "Token de réinitialisation expiré ou invalide. Recommence.",
    notConnected:
      "Connecte un compte de sync avant de changer son mot de passe.",
    rateLimited: "Trop de tentatives. Réessaie plus tard.",
    networkFailed: "Erreur réseau. Réessaie.",
    loginRequired: "Entre ton login ou ton e-mail.",
    recoveryCodeRequired: "Entre le code de récupération.",
    resetTokenRequired: "Token de réinitialisation manquant.",
    unauthorized: "Session expirée. Reconnecte-toi.",
    generic: "Quelque chose s'est mal passé. Réessaie.",
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
  },

  regenerate: {
    title: "Перевыпустить код восстановления",
    hint: "Подтвердите текущим паролем. Новый код заменяет старый.",
    currentPasswordLabel: "Текущий пароль",
    submitLabel: "Сгенерировать новый код восстановления",
  },

  reveal: {
    title: "Сохраните этот код восстановления",
    hint: "Показывается только один раз. Понадобится, если забудете пароль аккаунта.",
    confirmLabel: "Я сохранил(а)",
  },

  errors: {
    currentPasswordRequired: "Введите текущий пароль.",
    newPasswordRequired: "Введите новый пароль.",
    invalidCurrentPassword: "Неверный текущий пароль.",
    newPasswordMustDiffer:
      "Новый пароль должен отличаться от текущего.",
    weakNewPassword: "Новый пароль слишком короткий.",
    invalidRecoveryCredentials: "Неверный логин или код восстановления.",
    invalidResetToken:
      "Токен сброса истёк или недействителен. Начните заново.",
    notConnected:
      "Сначала подключите sync-аккаунт, чтобы сменить его пароль.",
    rateLimited: "Слишком много попыток. Попробуйте позже.",
    networkFailed: "Ошибка сети. Попробуйте снова.",
    loginRequired: "Введите логин или email.",
    recoveryCodeRequired: "Введите код восстановления.",
    resetTokenRequired: "Отсутствует токен сброса.",
    unauthorized: "Сессия истекла. Войдите снова.",
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
  },

  regenerate: {
    title: "Regenerar código de recuperación",
    hint: "Confirma con tu contraseña actual. El nuevo código reemplaza al anterior.",
    currentPasswordLabel: "Contraseña actual",
    submitLabel: "Generar nuevo código de recuperación",
  },

  reveal: {
    title: "Guarda este código de recuperación",
    hint: "Se muestra solo una vez. Úsalo si olvidas la contraseña de la cuenta.",
    confirmLabel: "Lo he guardado",
  },

  errors: {
    currentPasswordRequired: "Introduce tu contraseña actual.",
    newPasswordRequired: "Introduce una nueva contraseña.",
    invalidCurrentPassword: "La contraseña actual es incorrecta.",
    newPasswordMustDiffer:
      "La nueva contraseña debe ser distinta de la actual.",
    weakNewPassword: "La nueva contraseña es demasiado corta.",
    invalidRecoveryCredentials:
      "Login o código de recuperación incorrecto.",
    invalidResetToken:
      "Token de restablecimiento caducado o inválido. Empieza de nuevo.",
    notConnected:
      "Conecta una cuenta de sync antes de cambiar su contraseña.",
    rateLimited: "Demasiados intentos. Inténtalo más tarde.",
    networkFailed: "Error de red. Vuelve a intentarlo.",
    loginRequired: "Introduce tu login o email.",
    recoveryCodeRequired: "Introduce el código de recuperación.",
    resetTokenRequired: "Falta el token de restablecimiento.",
    unauthorized: "La sesión ha caducado. Vuelve a iniciar sesión.",
    generic: "Algo salió mal. Vuelve a intentarlo.",
  },
};

const ACCOUNT_SECURITY_COPY: Record<InterfaceLanguage, AccountSecurityCopy> = {
  en: accountSecurityCopyEn,
  de: accountSecurityCopyDe,
  fr: accountSecurityCopyFr,
  ru: accountSecurityCopyRu,
  es: accountSecurityCopyEs,
};

export function selectAccountSecurityCopy(
  language: InterfaceLanguage,
): AccountSecurityCopy {
  return ACCOUNT_SECURITY_COPY[language] ?? accountSecurityCopyEn;
}
