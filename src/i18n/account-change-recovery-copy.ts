import type { InterfaceLanguage } from "../models/profile";

export type AccountChangeRecoveryCopy = {
  pendingTitle: string;
  pendingHint: string;
  revealLabel: string;
  lostHint: string;
  replaceLabel: string;
  confirmPrompt: string;
  confirmAccept: string;
  deviceAuthPrompt: string;
  connectedStatus: string;
};

const STRINGS: Record<InterfaceLanguage, AccountChangeRecoveryCopy> = {
  en: {
    pendingTitle: "New recovery phrase",
    pendingHint:
      "You signed in to a different account, so this device created a new sync key for it. The previous recovery phrase does not work for this account. Reveal the new phrase and write it down.",
    revealLabel: "Show new recovery phrase",
    lostHint:
      "The app closed before the new recovery phrase was saved, so it can no longer be shown. Create a new phrase for this device's sync key and write it down.",
    replaceLabel: "Create new recovery phrase",
    confirmPrompt:
      "Show the new recovery phrase now? Make sure nobody can see your screen. It is the only way to restore this account's backup on another device.",
    confirmAccept: "Show phrase",
    deviceAuthPrompt: "Confirm it's you to show the new recovery phrase",
    connectedStatus:
      "Signed in to a different account. A new sync key was created; show and save its recovery phrase.",
  },
  ru: {
    pendingTitle: "Новая фраза восстановления",
    pendingHint:
      "Вы вошли в другой аккаунт, поэтому устройство создало для него новый ключ синхронизации. Прежняя фраза восстановления к этому аккаунту не подходит. Откройте новую фразу и запишите её.",
    revealLabel: "Показать новую фразу восстановления",
    lostHint:
      "Приложение закрылось до того, как новая фраза восстановления была сохранена, и показать её больше нельзя. Создайте новую фразу для ключа синхронизации этого устройства и запишите её.",
    replaceLabel: "Создать новую фразу восстановления",
    confirmPrompt:
      "Показать новую фразу восстановления сейчас? Убедитесь, что экран никто не видит. Только по ней можно восстановить резервную копию этого аккаунта на другом устройстве.",
    confirmAccept: "Показать фразу",
    deviceAuthPrompt: "Подтвердите, что это вы, чтобы показать новую фразу восстановления",
    connectedStatus:
      "Выполнен вход в другой аккаунт. Создан новый ключ синхронизации — покажите и сохраните его фразу восстановления.",
  },
  es: {
    pendingTitle: "Nueva frase de recuperación",
    pendingHint:
      "Has iniciado sesión en otra cuenta, así que este dispositivo creó una nueva clave de sincronización para ella. La frase de recuperación anterior no sirve para esta cuenta. Muestra la nueva frase y anótala.",
    revealLabel: "Mostrar la nueva frase de recuperación",
    lostHint:
      "La app se cerró antes de que guardaras la nueva frase de recuperación, así que ya no se puede mostrar. Crea una frase nueva para la clave de sincronización de este dispositivo y anótala.",
    replaceLabel: "Crear nueva frase de recuperación",
    confirmPrompt:
      "¿Mostrar ahora la nueva frase de recuperación? Asegúrate de que nadie vea tu pantalla. Es la única forma de restaurar la copia de seguridad de esta cuenta en otro dispositivo.",
    confirmAccept: "Mostrar frase",
    deviceAuthPrompt: "Confirma que eres tú para mostrar la nueva frase de recuperación",
    connectedStatus:
      "Sesión iniciada en otra cuenta. Se creó una nueva clave de sincronización; muestra y guarda su frase de recuperación.",
  },
  de: {
    pendingTitle: "Neue Wiederherstellungsphrase",
    pendingHint:
      "Sie haben sich bei einem anderen Konto angemeldet, deshalb hat dieses Gerät dafür einen neuen Synchronisierungsschlüssel erstellt. Die bisherige Wiederherstellungsphrase gilt für dieses Konto nicht. Zeigen Sie die neue Phrase an und notieren Sie sie.",
    revealLabel: "Neue Wiederherstellungsphrase anzeigen",
    lostHint:
      "Die App wurde geschlossen, bevor die neue Wiederherstellungsphrase gesichert war, deshalb kann sie nicht mehr angezeigt werden. Erstellen Sie eine neue Phrase für den Synchronisierungsschlüssel dieses Geräts und notieren Sie sie.",
    replaceLabel: "Neue Wiederherstellungsphrase erstellen",
    confirmPrompt:
      "Die neue Wiederherstellungsphrase jetzt anzeigen? Achten Sie darauf, dass niemand Ihren Bildschirm sieht. Nur mit ihr lässt sich das Backup dieses Kontos auf einem anderen Gerät wiederherstellen.",
    confirmAccept: "Phrase anzeigen",
    deviceAuthPrompt:
      "Bestätigen Sie, dass Sie es sind, um die neue Wiederherstellungsphrase anzuzeigen",
    connectedStatus:
      "Bei einem anderen Konto angemeldet. Ein neuer Synchronisierungsschlüssel wurde erstellt; zeigen Sie seine Wiederherstellungsphrase an und sichern Sie sie.",
  },
  fr: {
    pendingTitle: "Nouvelle phrase de récupération",
    pendingHint:
      "Vous vous êtes connecté à un autre compte : cet appareil a donc créé une nouvelle clé de synchronisation pour lui. L'ancienne phrase de récupération ne fonctionne pas pour ce compte. Affichez la nouvelle phrase et notez-la.",
    revealLabel: "Afficher la nouvelle phrase de récupération",
    lostHint:
      "L'app s'est fermée avant que la nouvelle phrase de récupération soit enregistrée : elle ne peut plus être affichée. Créez une nouvelle phrase pour la clé de synchronisation de cet appareil et notez-la.",
    replaceLabel: "Créer une nouvelle phrase de récupération",
    confirmPrompt:
      "Afficher maintenant la nouvelle phrase de récupération ? Assurez-vous que personne ne voit votre écran. C'est le seul moyen de restaurer la sauvegarde de ce compte sur un autre appareil.",
    confirmAccept: "Afficher la phrase",
    deviceAuthPrompt:
      "Confirmez votre identité pour afficher la nouvelle phrase de récupération",
    connectedStatus:
      "Connecté à un autre compte. Une nouvelle clé de synchronisation a été créée ; affichez et conservez sa phrase de récupération.",
  },
  it: {
    pendingTitle: "Nuova frase di recupero",
    pendingHint:
      "Hai effettuato l'accesso a un altro account, quindi questo dispositivo ha creato una nuova chiave di sincronizzazione per esso. La frase di recupero precedente non vale per questo account. Mostra la nuova frase e annotala.",
    revealLabel: "Mostra la nuova frase di recupero",
    lostHint:
      "L'app si è chiusa prima che la nuova frase di recupero fosse salvata, quindi non può più essere mostrata. Crea una nuova frase per la chiave di sincronizzazione di questo dispositivo e annotala.",
    replaceLabel: "Crea una nuova frase di recupero",
    confirmPrompt:
      "Mostrare ora la nuova frase di recupero? Assicurati che nessuno veda lo schermo. È l'unico modo per ripristinare il backup di questo account su un altro dispositivo.",
    confirmAccept: "Mostra frase",
    deviceAuthPrompt: "Conferma la tua identità per mostrare la nuova frase di recupero",
    connectedStatus:
      "Accesso effettuato a un altro account. È stata creata una nuova chiave di sincronizzazione; mostra e conserva la sua frase di recupero.",
  },
};

export function selectAccountChangeRecoveryCopy(
  language: InterfaceLanguage,
): AccountChangeRecoveryCopy {
  return STRINGS[language] ?? STRINGS.en;
}
