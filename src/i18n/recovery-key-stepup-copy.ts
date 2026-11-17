import type { InterfaceLanguage } from "../models/profile";

export type RecoveryKeyStepUpCopy = {
  title: string;
  explanation: string;
  passwordLabel: string;
  codeLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  errors: {
    invalidCurrentPassword: string;
    totpInvalidCode: string;
    totpReplayed: string;
    rateLimited: string;
  };
};

const en: RecoveryKeyStepUpCopy = {
  title: "Confirm with your password",
  explanation:
    "This upload replaces your account's recovery key. Confirm with your account password.",
  passwordLabel: "Account password",
  codeLabel: "6-digit code",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  errors: {
    invalidCurrentPassword: "Wrong password. Try again.",
    totpInvalidCode: "Wrong code. Try again.",
    totpReplayed: "That code was already used. Wait for the next one.",
    rateLimited: "Too many attempts. Try again later.",
  },
};

const de: RecoveryKeyStepUpCopy = {
  title: "Mit Passwort bestätigen",
  explanation:
    "Dieser Upload ersetzt den Wiederherstellungsschlüssel Ihres Kontos. Bestätigen Sie mit Ihrem Kontopasswort.",
  passwordLabel: "Kontopasswort",
  codeLabel: "6-stelliger Code",
  confirmLabel: "Bestätigen",
  cancelLabel: "Abbrechen",
  errors: {
    invalidCurrentPassword: "Falsches Passwort. Versuche es erneut.",
    totpInvalidCode: "Falscher Code. Versuche es erneut.",
    totpReplayed: "Dieser Code wurde bereits verwendet. Warten Sie auf den nächsten.",
    rateLimited: "Zu viele Versuche. Versuchen Sie es später erneut.",
  },
};

const fr: RecoveryKeyStepUpCopy = {
  title: "Confirmer avec votre mot de passe",
  explanation:
    "Cet envoi remplace la clé de récupération de votre compte. Confirmez avec le mot de passe du compte.",
  passwordLabel: "Mot de passe du compte",
  codeLabel: "Code à 6 chiffres",
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler",
  errors: {
    invalidCurrentPassword: "Mot de passe incorrect. Réessayez.",
    totpInvalidCode: "Code incorrect. Réessayez.",
    totpReplayed: "Ce code a déjà été utilisé. Attendez le suivant.",
    rateLimited: "Trop de tentatives. Réessayez plus tard.",
  },
};

const ru: RecoveryKeyStepUpCopy = {
  title: "Подтвердите паролем",
  explanation:
    "Эта загрузка заменит ключ восстановления вашего аккаунта. Подтвердите паролем от аккаунта.",
  passwordLabel: "Пароль аккаунта",
  codeLabel: "6-значный код",
  confirmLabel: "Подтвердить",
  cancelLabel: "Отмена",
  errors: {
    invalidCurrentPassword: "Неверный пароль. Попробуйте ещё раз.",
    totpInvalidCode: "Неверный код. Попробуйте ещё раз.",
    totpReplayed: "Этот код уже использован. Дождитесь следующего.",
    rateLimited: "Слишком много попыток. Попробуйте позже.",
  },
};

const es: RecoveryKeyStepUpCopy = {
  title: "Confirma con tu contraseña",
  explanation:
    "Esta subida sustituye la clave de recuperación de tu cuenta. Confirma con la contraseña de la cuenta.",
  passwordLabel: "Contraseña de la cuenta",
  codeLabel: "Código de 6 dígitos",
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
  errors: {
    invalidCurrentPassword: "Contraseña incorrecta. Inténtalo de nuevo.",
    totpInvalidCode: "Código incorrecto. Inténtalo de nuevo.",
    totpReplayed: "Ese código ya se usó. Espera al siguiente.",
    rateLimited: "Demasiados intentos. Inténtalo más tarde.",
  },
};

const it: RecoveryKeyStepUpCopy = {
  title: "Conferma con la password",
  explanation:
    "Questo caricamento sostituisce la chiave di recupero del tuo account. Conferma con la password dell'account.",
  passwordLabel: "Password dell'account",
  codeLabel: "Codice a 6 cifre",
  confirmLabel: "Conferma",
  cancelLabel: "Annulla",
  errors: {
    invalidCurrentPassword: "Password errata. Riprova.",
    totpInvalidCode: "Codice errato. Riprova.",
    totpReplayed: "Quel codice è già stato usato. Attendi quello nuovo.",
    rateLimited: "Troppi tentativi. Riprova più tardi.",
  },
};

const COPY: Record<InterfaceLanguage, RecoveryKeyStepUpCopy> = {
  en,
  de,
  fr,
  ru,
  es,
  it,
};

export function selectRecoveryKeyStepUpCopy(
  language: InterfaceLanguage,
): RecoveryKeyStepUpCopy {
  return COPY[language] ?? en;
}
