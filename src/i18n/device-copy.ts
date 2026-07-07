import type { InterfaceLanguage } from "../models/profile";
import { resolveCopyLanguage } from "./runtime";

// Copy for the sync device-management section in Backup & sync. The remove
// prompts deliberately state the real server semantics: removing a device
// frees its slot but does not end that device's session (sessions are not
// device-bound), and a still-connected device re-registers on its next
// sign-in — see docs/sync-trust-model.md.
export type DeviceCopy = {
  title: string;
  subtitle: string;
  showDevicesLabel: string;
  refreshLabel: string;
  emptyLabel: string;
  thisDeviceBadge: string;
  lastSeenLabel: string;
  removeLabel: string;
  removeConfirmAction: string;
  removeDevicePrompt: (label: string) => string;
  removeCurrentDevicePrompt: (label: string) => string;
  statusRemoved: string;
  fallbackDeviceLabel: string;
  errors: {
    notConnected: string;
    syncNotAllowed: string;
    deviceNotFound: string;
    networkFailed: string;
    generic: string;
  };
};

const deviceCopyEn: DeviceCopy = {
  title: "Devices",
  subtitle:
    "Each device attached to this sync account uses one slot. Remove a device you no longer use to free its slot — for example after a reinstall.",
  showDevicesLabel: "Show devices",
  refreshLabel: "Refresh devices",
  emptyLabel: "No devices are attached to this account yet.",
  thisDeviceBadge: "This device",
  lastSeenLabel: "Last seen",
  removeLabel: "Remove device",
  removeConfirmAction: "Remove",
  removeDevicePrompt: (label: string) =>
    `Remove "${label}" from this account's device list? This frees its slot but does not sign that device out; if it is still connected, it can register again on its next sign-in.`,
  removeCurrentDevicePrompt: (label: string) =>
    `"${label}" is the device you are using right now. Removing it frees its slot but does not sign this device out — sync keeps working here, and it will register again the next time you sign in. Remove it anyway?`,
  statusRemoved: "Device removed. Its slot is now free.",
  fallbackDeviceLabel: "Unnamed device",
  errors: {
    notConnected: "Connect this device to your sync account first.",
    syncNotAllowed: "Managing devices requires an active Ovumcy Cloud plan.",
    deviceNotFound: "That device is no longer in the list.",
    networkFailed: "Unable to reach the sync server right now.",
    generic: "Unable to update the device list right now. Please try again.",
  },
};

const deviceCopyDe: DeviceCopy = {
  title: "Geräte",
  subtitle:
    "Jedes mit diesem Sync-Konto verbundene Gerät belegt einen Platz. Entfernen Sie ein Gerät, das Sie nicht mehr verwenden, um seinen Platz freizugeben — zum Beispiel nach einer Neuinstallation.",
  showDevicesLabel: "Geräte anzeigen",
  refreshLabel: "Geräteliste aktualisieren",
  emptyLabel: "Mit diesem Konto sind noch keine Geräte verbunden.",
  thisDeviceBadge: "Dieses Gerät",
  lastSeenLabel: "Zuletzt gesehen",
  removeLabel: "Gerät entfernen",
  removeConfirmAction: "Entfernen",
  removeDevicePrompt: (label: string) =>
    `„${label}“ aus der Geräteliste dieses Kontos entfernen? Das gibt den Platz frei, meldet das Gerät aber nicht ab; ist es noch verbunden, kann es sich bei der nächsten Anmeldung erneut registrieren.`,
  removeCurrentDevicePrompt: (label: string) =>
    `„${label}“ ist das Gerät, das Sie gerade verwenden. Das Entfernen gibt seinen Platz frei, meldet dieses Gerät aber nicht ab — Sync funktioniert hier weiter, und es registriert sich bei der nächsten Anmeldung erneut. Trotzdem entfernen?`,
  statusRemoved: "Gerät entfernt. Sein Platz ist jetzt frei.",
  fallbackDeviceLabel: "Unbenanntes Gerät",
  errors: {
    notConnected: "Verbinden Sie dieses Gerät zuerst mit Ihrem Sync-Konto.",
    syncNotAllowed:
      "Die Geräteverwaltung erfordert einen aktiven Ovumcy-Cloud-Plan.",
    deviceNotFound: "Dieses Gerät ist nicht mehr in der Liste.",
    networkFailed: "Der Sync-Server ist gerade nicht erreichbar.",
    generic:
      "Die Geräteliste konnte gerade nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
  },
};

const deviceCopyFr: DeviceCopy = {
  title: "Appareils",
  subtitle:
    "Chaque appareil relié à ce compte de sync occupe une place. Retirez un appareil que vous n'utilisez plus pour libérer sa place — par exemple après une réinstallation.",
  showDevicesLabel: "Afficher les appareils",
  refreshLabel: "Actualiser la liste",
  emptyLabel: "Aucun appareil n'est encore relié à ce compte.",
  thisDeviceBadge: "Cet appareil",
  lastSeenLabel: "Dernière activité",
  removeLabel: "Retirer l'appareil",
  removeConfirmAction: "Retirer",
  removeDevicePrompt: (label: string) =>
    `Retirer « ${label} » de la liste des appareils de ce compte ? Cela libère sa place mais ne déconnecte pas cet appareil ; s'il est encore connecté, il pourra se réenregistrer à sa prochaine connexion.`,
  removeCurrentDevicePrompt: (label: string) =>
    `« ${label} » est l'appareil que vous utilisez en ce moment. Le retirer libère sa place sans le déconnecter — le sync continue ici, et il se réenregistrera à votre prochaine connexion. Le retirer quand même ?`,
  statusRemoved: "Appareil retiré. Sa place est maintenant libre.",
  fallbackDeviceLabel: "Appareil sans nom",
  errors: {
    notConnected: "Connectez d'abord cet appareil à votre compte de sync.",
    syncNotAllowed:
      "La gestion des appareils demande un plan Ovumcy Cloud actif.",
    deviceNotFound: "Cet appareil n'est plus dans la liste.",
    networkFailed: "Impossible de joindre le serveur de sync pour le moment.",
    generic:
      "Impossible de mettre à jour la liste des appareils pour le moment. Réessayez.",
  },
};

const deviceCopyRu: DeviceCopy = {
  title: "Устройства",
  subtitle:
    "Каждое устройство, привязанное к этому sync-аккаунту, занимает один слот. Удалите устройство, которым больше не пользуетесь, чтобы освободить слот — например, после переустановки.",
  showDevicesLabel: "Показать устройства",
  refreshLabel: "Обновить список",
  emptyLabel: "К этому аккаунту пока не привязано ни одного устройства.",
  thisDeviceBadge: "Это устройство",
  lastSeenLabel: "Последняя активность",
  removeLabel: "Удалить устройство",
  removeConfirmAction: "Удалить",
  removeDevicePrompt: (label: string) =>
    `Удалить «${label}» из списка устройств этого аккаунта? Это освободит слот, но не завершит сессию на том устройстве; если оно ещё подключено, оно сможет зарегистрироваться снова при следующем входе.`,
  removeCurrentDevicePrompt: (label: string) =>
    `«${label}» — это устройство, которым вы пользуетесь сейчас. Удаление освободит его слот, но не завершит сессию — sync здесь продолжит работать, а устройство снова зарегистрируется при следующем входе. Всё равно удалить?`,
  statusRemoved: "Устройство удалено. Слот освобождён.",
  fallbackDeviceLabel: "Устройство без названия",
  errors: {
    notConnected: "Сначала подключите это устройство к sync-аккаунту.",
    syncNotAllowed:
      "Для управления устройствами нужен активный план Ovumcy Cloud.",
    deviceNotFound: "Этого устройства уже нет в списке.",
    networkFailed: "Сейчас не удаётся связаться с sync-сервером.",
    generic: "Сейчас не удалось обновить список устройств. Попробуйте ещё раз.",
  },
};

const deviceCopyEs: DeviceCopy = {
  title: "Dispositivos",
  subtitle:
    "Cada dispositivo vinculado a esta cuenta de sync ocupa una plaza. Quita un dispositivo que ya no uses para liberar su plaza — por ejemplo, tras una reinstalación.",
  showDevicesLabel: "Mostrar dispositivos",
  refreshLabel: "Actualizar lista",
  emptyLabel: "Todavía no hay dispositivos vinculados a esta cuenta.",
  thisDeviceBadge: "Este dispositivo",
  lastSeenLabel: "Última actividad",
  removeLabel: "Quitar dispositivo",
  removeConfirmAction: "Quitar",
  removeDevicePrompt: (label: string) =>
    `¿Quitar "${label}" de la lista de dispositivos de esta cuenta? Esto libera su plaza, pero no cierra la sesión de ese dispositivo; si sigue conectado, podrá registrarse de nuevo en su próximo inicio de sesión.`,
  removeCurrentDevicePrompt: (label: string) =>
    `"${label}" es el dispositivo que estás usando ahora. Quitarlo libera su plaza sin cerrar la sesión: el sync sigue funcionando aquí y volverá a registrarse la próxima vez que inicies sesión. ¿Quitarlo de todos modos?`,
  statusRemoved: "Dispositivo quitado. Su plaza queda libre.",
  fallbackDeviceLabel: "Dispositivo sin nombre",
  errors: {
    notConnected: "Primero conecta este dispositivo a tu cuenta de sync.",
    syncNotAllowed:
      "Gestionar dispositivos requiere un plan activo de Ovumcy Cloud.",
    deviceNotFound: "Ese dispositivo ya no está en la lista.",
    networkFailed: "No se puede contactar con el servidor de sync ahora mismo.",
    generic:
      "No se pudo actualizar la lista de dispositivos ahora mismo. Inténtalo otra vez.",
  },
};

const deviceCopyIt: DeviceCopy = {
  title: "Dispositivi",
  subtitle:
    "Ogni dispositivo collegato a questo account di sync occupa uno slot. Rimuovi un dispositivo che non usi più per liberare il suo slot — per esempio dopo una reinstallazione.",
  showDevicesLabel: "Mostra dispositivi",
  refreshLabel: "Aggiorna elenco",
  emptyLabel: "Nessun dispositivo è ancora collegato a questo account.",
  thisDeviceBadge: "Questo dispositivo",
  lastSeenLabel: "Ultima attività",
  removeLabel: "Rimuovi dispositivo",
  removeConfirmAction: "Rimuovi",
  removeDevicePrompt: (label: string) =>
    `Rimuovere "${label}" dall'elenco dei dispositivi di questo account? Questo libera il suo slot ma non disconnette quel dispositivo; se è ancora collegato, potrà registrarsi di nuovo al prossimo accesso.`,
  removeCurrentDevicePrompt: (label: string) =>
    `"${label}" è il dispositivo che stai usando adesso. Rimuoverlo libera il suo slot senza disconnetterlo: il sync continua a funzionare qui e si registrerà di nuovo al prossimo accesso. Rimuoverlo comunque?`,
  statusRemoved: "Dispositivo rimosso. Il suo slot è ora libero.",
  fallbackDeviceLabel: "Dispositivo senza nome",
  errors: {
    notConnected: "Collega prima questo dispositivo al tuo account di sync.",
    syncNotAllowed:
      "La gestione dei dispositivi richiede un piano Ovumcy Cloud attivo.",
    deviceNotFound: "Questo dispositivo non è più nell'elenco.",
    networkFailed: "Impossibile raggiungere il server di sync in questo momento.",
    generic:
      "Impossibile aggiornare l'elenco dei dispositivi in questo momento. Riprova.",
  },
};

const catalogs = {
  en: deviceCopyEn,
  de: deviceCopyDe,
  fr: deviceCopyFr,
  ru: deviceCopyRu,
  es: deviceCopyEs,
  it: deviceCopyIt,
} as const satisfies Record<InterfaceLanguage, DeviceCopy>;

export function getDeviceCopy(locale?: string): DeviceCopy {
  return catalogs[resolveCopyLanguage(locale) as InterfaceLanguage] ?? deviceCopyEn;
}
