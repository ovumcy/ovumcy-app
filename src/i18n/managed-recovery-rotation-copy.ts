import type { InterfaceLanguage } from "../models/profile";
import { selectTOTPCopy } from "./totp-copy";
import {
  selectRecoveryKeyStepUpCopy,
  type RecoveryKeyStepUpCopy,
} from "./recovery-key-stepup-copy";

export type ManagedRecoveryRotationCopy = {
  actionLabel: string;
  // Shown under the disabled action on a managed device with no rollback floor.
  noFloorHint: string;
  confirmPrompt: string;
  confirmAccept: string;
  deviceAuthPrompt: string;
  rotatedStatus: string;
  stepUp: RecoveryKeyStepUpCopy;
};

type RotationStrings = Omit<ManagedRecoveryRotationCopy, "stepUp"> & {
  stepUpTitle: string;
  stepUpExplanation: string;
  candidateTitle: string;
  candidateNotice: string;
  candidateAcknowledge: string;
  rotationUnconfirmed: string;
  rotationFailed: string;
  syncNotConfigured: string;
  totpFreshCodeRequired: string;
  inProgress: string;
};

const STRINGS: Record<InterfaceLanguage, RotationStrings> = {
  en: {
    actionLabel: "Change recovery phrase",
    noFloorHint:
      "Restore or upload a backup first. Then you can change the recovery phrase.",
    confirmPrompt:
      "Create a new recovery phrase for your Ovumcy Cloud account? Your backup and your other devices keep working. The current phrase stops working for recovery once the new one is confirmed.",
    confirmAccept: "Change phrase",
    deviceAuthPrompt: "Confirm it's you to change the recovery phrase",
    rotatedStatus: "Your new recovery phrase is active. Write it down now.",
    inProgress: "Changing the recovery phrase...",
    stepUpTitle: "Confirm the new recovery phrase",
    stepUpExplanation:
      "Ovumcy Cloud asks for your account password before it replaces the recovery phrase. With two-factor on, also enter the current code.",
    candidateTitle: "Your new recovery phrase",
    candidateNotice:
      "Write this phrase down before you confirm. It becomes active only after Ovumcy Cloud confirms the change; until then your current phrase stays active.",
    candidateAcknowledge: "I have written it down",
    rotationUnconfirmed:
      "The change was not confirmed. Your current phrase is still active. Try again with a new code.",
    rotationFailed:
      "The recovery phrase could not be changed. Your current phrase is still active.",
    syncNotConfigured:
      "Ovumcy Cloud cannot change the recovery phrase right now. Nothing was changed, and your current phrase is still active.",
    totpFreshCodeRequired:
      "Nothing was changed yet. Enter a new code to finish. Your current phrase is still active.",
  },
  de: {
    actionLabel: "Wiederherstellungsphrase ändern",
    noFloorHint:
      "Stellen Sie zuerst ein Backup wieder her oder laden Sie eines hoch. Danach können Sie die Wiederherstellungsphrase ändern.",
    confirmPrompt:
      "Eine neue Wiederherstellungsphrase für Ihr Ovumcy-Cloud-Konto erstellen? Ihr Backup und Ihre anderen Geräte funktionieren weiter. Die aktuelle Phrase gilt nicht mehr für die Wiederherstellung, sobald die neue bestätigt ist.",
    confirmAccept: "Phrase ändern",
    deviceAuthPrompt: "Bestätigen Sie, dass Sie es sind, um die Wiederherstellungsphrase zu ändern",
    rotatedStatus: "Ihre neue Wiederherstellungsphrase ist aktiv. Notieren Sie sie jetzt.",
    inProgress: "Wiederherstellungsphrase wird geändert...",
    stepUpTitle: "Neue Wiederherstellungsphrase bestätigen",
    stepUpExplanation:
      "Ovumcy Cloud fragt nach Ihrem Kontopasswort, bevor die Wiederherstellungsphrase ersetzt wird. Ist die Zwei-Faktor-Anmeldung aktiv, geben Sie auch den aktuellen Code ein.",
    candidateTitle: "Ihre neue Wiederherstellungsphrase",
    candidateNotice:
      "Notieren Sie diese Phrase, bevor Sie bestätigen. Sie wird erst aktiv, wenn Ovumcy Cloud die Änderung bestätigt; bis dahin bleibt Ihre aktuelle Phrase aktiv.",
    candidateAcknowledge: "Ich habe sie notiert",
    rotationUnconfirmed:
      "Die Änderung wurde nicht bestätigt. Ihre aktuelle Phrase bleibt aktiv. Versuchen Sie es mit einem neuen Code erneut.",
    rotationFailed:
      "Die Wiederherstellungsphrase konnte nicht geändert werden. Ihre aktuelle Phrase bleibt aktiv.",
    syncNotConfigured:
      "Ovumcy Cloud kann die Wiederherstellungsphrase gerade nicht ändern. Es wurde nichts geändert, Ihre aktuelle Phrase bleibt aktiv.",
    totpFreshCodeRequired:
      "Noch wurde nichts geändert. Geben Sie zum Abschluss einen neuen Code ein. Ihre aktuelle Phrase bleibt aktiv.",
  },
  fr: {
    actionLabel: "Changer la phrase de récupération",
    noFloorHint:
      "Restaurez ou envoyez d'abord une sauvegarde. Vous pourrez ensuite changer la phrase de récupération.",
    confirmPrompt:
      "Créer une nouvelle phrase de récupération pour votre compte Ovumcy Cloud ? Votre sauvegarde et vos autres appareils continuent de fonctionner. La phrase actuelle ne permet plus la récupération dès que la nouvelle est confirmée.",
    confirmAccept: "Changer la phrase",
    deviceAuthPrompt: "Confirmez votre identité pour changer la phrase de récupération",
    rotatedStatus: "Votre nouvelle phrase de récupération est active. Notez-la maintenant.",
    inProgress: "Changement de la phrase de récupération...",
    stepUpTitle: "Confirmer la nouvelle phrase de récupération",
    stepUpExplanation:
      "Ovumcy Cloud demande le mot de passe du compte avant de remplacer la phrase de récupération. Si la double authentification est activée, saisissez aussi le code actuel.",
    candidateTitle: "Votre nouvelle phrase de récupération",
    candidateNotice:
      "Notez cette phrase avant de confirmer. Elle ne devient active qu'une fois le changement confirmé par Ovumcy Cloud ; d'ici là, votre phrase actuelle reste active.",
    candidateAcknowledge: "Je l'ai notée",
    rotationUnconfirmed:
      "Le changement n'a pas été confirmé. Votre phrase actuelle reste active. Réessayez avec un nouveau code.",
    rotationFailed:
      "La phrase de récupération n'a pas pu être changée. Votre phrase actuelle reste active.",
    syncNotConfigured:
      "Ovumcy Cloud ne peut pas changer la phrase de récupération pour le moment. Rien n'a été modifié et votre phrase actuelle reste active.",
    totpFreshCodeRequired:
      "Rien n'a encore été modifié. Saisissez un nouveau code pour terminer. Votre phrase actuelle reste active.",
  },
  ru: {
    actionLabel: "Сменить фразу восстановления",
    noFloorHint:
      "Сначала восстановите или загрузите резервную копию. После этого можно сменить фразу восстановления.",
    confirmPrompt:
      "Создать новую фразу восстановления для аккаунта Ovumcy Cloud? Резервная копия и другие устройства продолжат работать. Текущая фраза перестанет подходить для восстановления, как только новая будет подтверждена.",
    confirmAccept: "Сменить фразу",
    deviceAuthPrompt: "Подтвердите, что это вы, чтобы сменить фразу восстановления",
    rotatedStatus: "Новая фраза восстановления активна. Запишите её сейчас.",
    inProgress: "Меняем фразу восстановления...",
    stepUpTitle: "Подтвердите новую фразу восстановления",
    stepUpExplanation:
      "Перед заменой фразы восстановления Ovumcy Cloud запрашивает пароль аккаунта. Если включена двухфакторная защита, введите и текущий код.",
    candidateTitle: "Новая фраза восстановления",
    candidateNotice:
      "Запишите эту фразу до подтверждения. Она станет активной только после того, как Ovumcy Cloud подтвердит смену; до тех пор действует текущая фраза.",
    candidateAcknowledge: "Фраза записана",
    rotationUnconfirmed:
      "Смена не подтверждена. Текущая фраза по-прежнему активна. Попробуйте ещё раз с новым кодом.",
    rotationFailed:
      "Не удалось сменить фразу восстановления. Текущая фраза по-прежнему активна.",
    syncNotConfigured:
      "Ovumcy Cloud сейчас не может сменить фразу восстановления. Ничего не изменилось, текущая фраза по-прежнему активна.",
    totpFreshCodeRequired:
      "Пока ничего не изменилось. Чтобы завершить, введите новый код. Текущая фраза по-прежнему активна.",
  },
  es: {
    actionLabel: "Cambiar la frase de recuperación",
    noFloorHint:
      "Primero restaura o sube una copia de seguridad. Después podrás cambiar la frase de recuperación.",
    confirmPrompt:
      "¿Crear una nueva frase de recuperación para tu cuenta de Ovumcy Cloud? Tu copia de seguridad y tus otros dispositivos siguen funcionando. La frase actual deja de servir para recuperar la cuenta en cuanto se confirme la nueva.",
    confirmAccept: "Cambiar frase",
    deviceAuthPrompt: "Confirma que eres tú para cambiar la frase de recuperación",
    rotatedStatus: "Tu nueva frase de recuperación está activa. Anótala ahora.",
    inProgress: "Cambiando la frase de recuperación...",
    stepUpTitle: "Confirma la nueva frase de recuperación",
    stepUpExplanation:
      "Ovumcy Cloud pide la contraseña de la cuenta antes de sustituir la frase de recuperación. Si tienes la verificación en dos pasos activada, introduce también el código actual.",
    candidateTitle: "Tu nueva frase de recuperación",
    candidateNotice:
      "Anota esta frase antes de confirmar. Solo se activa cuando Ovumcy Cloud confirma el cambio; hasta entonces sigue activa tu frase actual.",
    candidateAcknowledge: "Ya la he anotado",
    rotationUnconfirmed:
      "El cambio no se confirmó. Tu frase actual sigue activa. Inténtalo de nuevo con un código nuevo.",
    rotationFailed:
      "No se pudo cambiar la frase de recuperación. Tu frase actual sigue activa.",
    syncNotConfigured:
      "Ovumcy Cloud no puede cambiar la frase de recuperación en este momento. No se ha cambiado nada y tu frase actual sigue activa.",
    totpFreshCodeRequired:
      "Todavía no se ha cambiado nada. Introduce un código nuevo para terminar. Tu frase actual sigue activa.",
  },
  it: {
    actionLabel: "Cambia la frase di recupero",
    noFloorHint:
      "Prima ripristina o carica un backup. Poi potrai cambiare la frase di recupero.",
    confirmPrompt:
      "Creare una nuova frase di recupero per il tuo account Ovumcy Cloud? Il backup e gli altri dispositivi continuano a funzionare. La frase attuale non vale più per il recupero non appena la nuova è confermata.",
    confirmAccept: "Cambia frase",
    deviceAuthPrompt: "Conferma la tua identità per cambiare la frase di recupero",
    rotatedStatus: "La nuova frase di recupero è attiva. Annotala ora.",
    inProgress: "Cambio della frase di recupero...",
    stepUpTitle: "Conferma la nuova frase di recupero",
    stepUpExplanation:
      "Ovumcy Cloud chiede la password dell'account prima di sostituire la frase di recupero. Con la verifica in due passaggi attiva, inserisci anche il codice attuale.",
    candidateTitle: "La tua nuova frase di recupero",
    candidateNotice:
      "Annota questa frase prima di confermare. Diventa attiva solo dopo che Ovumcy Cloud ha confermato la modifica; fino ad allora resta attiva la frase attuale.",
    candidateAcknowledge: "L'ho annotata",
    rotationUnconfirmed:
      "La modifica non è stata confermata. La frase attuale resta attiva. Riprova con un nuovo codice.",
    rotationFailed:
      "Non è stato possibile cambiare la frase di recupero. La frase attuale resta attiva.",
    syncNotConfigured:
      "Al momento Ovumcy Cloud non può cambiare la frase di recupero. Non è cambiato nulla e la frase attuale resta attiva.",
    totpFreshCodeRequired:
      "Non è ancora cambiato nulla. Inserisci un nuovo codice per completare. La frase attuale resta attiva.",
  },
};

export function selectManagedRecoveryRotationCopy(
  language: InterfaceLanguage,
): ManagedRecoveryRotationCopy {
  const strings = STRINGS[language] ?? STRINGS.en;
  const base = selectRecoveryKeyStepUpCopy(language);
  return {
    actionLabel: strings.actionLabel,
    noFloorHint: strings.noFloorHint,
    confirmPrompt: strings.confirmPrompt,
    confirmAccept: strings.confirmAccept,
    deviceAuthPrompt: strings.deviceAuthPrompt,
    rotatedStatus: strings.rotatedStatus,
    stepUp: {
      ...base,
      title: strings.stepUpTitle,
      explanation: strings.stepUpExplanation,
      confirmLabel: strings.confirmAccept,
      inProgressLabel: strings.inProgress,
      candidate: {
        title: strings.candidateTitle,
        notice: strings.candidateNotice,
        acknowledgeLabel: strings.candidateAcknowledge,
      },
      errors: {
        ...base.errors,
        rotationUnconfirmed: strings.rotationUnconfirmed,
        rotationFailed: strings.rotationFailed,
        totpNotConfigured: selectTOTPCopy(language).errors.totpNotConfigured,
        syncNotConfigured: strings.syncNotConfigured,
        totpFreshCodeRequired: strings.totpFreshCodeRequired,
      },
    },
  };
}
