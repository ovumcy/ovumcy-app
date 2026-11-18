import type { InterfaceLanguage } from "../models/profile";
import {
  selectRecoveryKeyStepUpCopy,
  type RecoveryKeyStepUpCopy,
} from "./recovery-key-stepup-copy";

type DeletionOverrides = Pick<
  RecoveryKeyStepUpCopy,
  "title" | "explanation" | "confirmLabel"
>;

const OVERRIDES: Record<InterfaceLanguage, DeletionOverrides> = {
  en: {
    title: "Confirm account deletion",
    explanation:
      "Ovumcy Cloud asks for your account password before it erases the account. With two-factor on, also enter the current code.",
    confirmLabel: "Delete account",
  },
  de: {
    title: "Kontolöschung bestätigen",
    explanation:
      "Ovumcy Cloud fragt vor dem Löschen nach Ihrem Kontopasswort. Ist die Zwei-Faktor-Anmeldung aktiv, geben Sie auch den aktuellen Code ein.",
    confirmLabel: "Konto löschen",
  },
  fr: {
    title: "Confirmer la suppression du compte",
    explanation:
      "Ovumcy Cloud demande le mot de passe du compte avant de l'effacer. Si la double authentification est activée, saisissez aussi le code actuel.",
    confirmLabel: "Supprimer le compte",
  },
  ru: {
    title: "Подтвердите удаление аккаунта",
    explanation:
      "Перед удалением аккаунта Ovumcy Cloud запрашивает пароль. Если включена двухфакторная защита, введите и текущий код.",
    confirmLabel: "Удалить аккаунт",
  },
  es: {
    title: "Confirma la eliminación de la cuenta",
    explanation:
      "Ovumcy Cloud pide la contraseña de la cuenta antes de borrarla. Si tienes la verificación en dos pasos activada, introduce también el código actual.",
    confirmLabel: "Eliminar cuenta",
  },
  it: {
    title: "Conferma l'eliminazione dell'account",
    explanation:
      "Ovumcy Cloud chiede la password dell'account prima di cancellarlo. Con la verifica in due passaggi attiva, inserisci anche il codice attuale.",
    confirmLabel: "Elimina account",
  },
};

export function selectAccountDeletionStepUpCopy(
  language: InterfaceLanguage,
): RecoveryKeyStepUpCopy {
  return {
    ...selectRecoveryKeyStepUpCopy(language),
    ...(OVERRIDES[language] ?? OVERRIDES.en),
  };
}
