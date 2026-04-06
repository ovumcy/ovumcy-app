import type { InterfaceLanguage } from "../models/profile";
import { resolveCopyLanguage } from "./runtime";

const partnerCopyEn = {
  title: "Partner access",
  subtitle:
    "Invite a partner by link, choose the access level, and revoke access quickly when needed.",
  planLocked:
    "Partner access is a managed premium feature for the owner account that creates the invite.",
  ownerTitle: "Invite a partner",
  ownerHint:
    "Ovumcy issues a private invite link from your managed account. The partner signs in on their own device and accepts the link in app.",
  accessLevelLabel: "Access level",
  accessLevelSummary: "Summary only",
  accessLevelFull: "Full access",
  accessLevelSummaryHint:
    "Share the lighter summary view instead of detailed day-by-day history.",
  accessLevelFullHint:
    "Allow the full shared view, including detailed day-by-day history when it is available.",
  issueInviteLabel: "Create invite link",
  inviteLinkTitle: "Invite link",
  inviteLinkHint:
    "Open or share this link with the partner. Acceptance still requires their own managed sign-in.",
  pendingInvitesTitle: "Pending invites",
  pendingInvitesEmpty: "No pending invites yet.",
  pendingInviteLabel: "Invite link pending",
  activePartnersTitle: "Active partner access",
  activePartnersEmpty: "No active partner access yet.",
  activePartnerLabel: "Partner access",
  sharedWithMeTitle: "Access shared with this account",
  sharedWithMeHint:
    "This managed account already has partner access. The granted access level stays visible here even after the invite banner is gone.",
  sharedWithMeEmpty: "No partner access has been shared with this account.",
  sharedGrantLabel: "Shared cycle view",
  lastSeenLabel: "Last seen",
  lastSeenNever: "Not opened yet.",
  openSharedViewLabel: "Open shared view",
  revokeInviteLabel: "Revoke invite",
  revokeGrantLabel: "Revoke access",
  acceptTitle: "Accept partner invite",
  acceptReadyHint:
    "This link is ready to be accepted on the currently signed-in managed account.",
  acceptSignInHint:
    "Sign in to your managed account first, then accept this partner invite on this device.",
  acceptActionLabel: "Accept invite",
  statusInviteIssued: "Partner invite link created.",
  statusInviteAccepted: "Partner invite accepted on this device.",
  statusInviteRevoked: "Pending partner invite revoked.",
  statusGrantRevoked: "Partner access revoked.",
  sharedViewTitle: "Shared cycle view",
  sharedViewSubtitle:
    "This read-only view comes only from Ovumcy Managed partner sharing.",
  sharedViewBackLabel: "Back to partner access",
  sharedViewLoadingTitle: "Loading shared view",
  sharedViewLoadingSubtitle:
    "Decrypting the shared partner snapshot on this device.",
  sharedViewNotReady:
    "The owner has not uploaded shared data for this grant yet.",
  sharedViewLocked:
    "This device cannot open the shared view because the invite key is missing.",
  sharedViewSummaryHint:
    "Summary access keeps the lighter shared overview without detailed day-by-day history.",
  sharedViewFullHint:
    "Full access includes the shared summary and the detailed day-by-day history that the owner allowed.",
  sharedViewGeneratedAtLabel: "Updated",
  sharedViewMetricsTitle: "Shared summary",
  sharedViewHistoryTitle: "Recent shared history",
  sharedViewHistoryEmpty: "No shared day-by-day history is available yet.",
  sharedViewCycleDayLabel: "Cycle day",
  sharedViewNextPeriodLabel: "Next period window",
  sharedViewLastCycleLabel: "Last cycle",
  sharedViewAverageCycleLabel: "Average cycle",
  sharedViewAveragePeriodLabel: "Average period",
  sharedViewLoggedDaysLabel: "Logged days",
  sharedViewTopSymptomsLabel: "Top symptoms",
  errors: {
    notConnected: "Sign in to Ovumcy Cloud first.",
    invalidPartnerInvite: "This partner invite is not valid.",
    partnerInviteNotFound: "This partner invite could not be found.",
    partnerInviteExpired: "This partner invite has expired.",
    partnerAccessUnavailable:
      "Partner access is not available for this managed account right now.",
    partnerAccessNotFound: "This partner access record could not be found.",
    networkFailed: "Unable to reach Ovumcy Cloud right now.",
    generic: "Unable to update partner access right now. Please try again.",
  },
} as const;

const partnerCopyDe = {
  title: "Partnerzugriff",
  subtitle:
    "Partner per Link einladen, Zugriffslevel wählen und den Zugriff bei Bedarf schnell widerrufen.",
  planLocked:
    "Partnerzugriff ist eine Premium-Funktion des Managed-Kontos, das die Einladung erstellt.",
  ownerTitle: "Partner einladen",
  ownerHint:
    "Ovumcy erstellt einen privaten Einladungslink aus deinem Managed-Konto. Der Partner meldet sich auf seinem eigenen Gerät an und nimmt den Link in der App an.",
  accessLevelLabel: "Zugriffslevel",
  accessLevelSummary: "Nur Zusammenfassung",
  accessLevelFull: "Voller Zugriff",
  accessLevelSummaryHint:
    "Teilt die leichtere Zusammenfassung statt einer detaillierten Tageshistorie.",
  accessLevelFullHint:
    "Erlaubt die vollständige geteilte Ansicht, inklusive detaillierter Tageshistorie, wenn sie verfügbar ist.",
  issueInviteLabel: "Einladungslink erstellen",
  inviteLinkTitle: "Einladungslink",
  inviteLinkHint:
    "Diesen Link mit dem Partner teilen oder öffnen. Die Annahme erfordert trotzdem eine eigene Managed-Anmeldung.",
  pendingInvitesTitle: "Ausstehende Einladungen",
  pendingInvitesEmpty: "Noch keine ausstehenden Einladungen.",
  pendingInviteLabel: "Einladungslink ausstehend",
  activePartnersTitle: "Aktive Partnerzugriffe",
  activePartnersEmpty: "Noch kein aktiver Partnerzugriff.",
  activePartnerLabel: "Partnerzugriff",
  sharedWithMeTitle: "Mit diesem Konto geteilter Zugriff",
  sharedWithMeHint:
    "Dieses Managed-Konto hat bereits Partnerzugriff. Das gewährte Zugriffslevel bleibt hier sichtbar, auch nachdem das Einladungsbanner verschwunden ist.",
  sharedWithMeEmpty: "Mit diesem Konto wurde noch kein Partnerzugriff geteilt.",
  sharedGrantLabel: "Geteilte Zyklusansicht",
  lastSeenLabel: "Zuletzt gesehen",
  lastSeenNever: "Noch nicht geöffnet.",
  openSharedViewLabel: "Geteilte Ansicht öffnen",
  revokeInviteLabel: "Einladung widerrufen",
  revokeGrantLabel: "Zugriff widerrufen",
  acceptTitle: "Partnereinladung annehmen",
  acceptReadyHint:
    "Dieser Link kann mit dem aktuell angemeldeten Managed-Konto angenommen werden.",
  acceptSignInHint:
    "Melde dich zuerst bei deinem Managed-Konto an und nimm dann diese Partnereinladung auf diesem Gerät an.",
  acceptActionLabel: "Einladung annehmen",
  statusInviteIssued: "Partner-Einladungslink erstellt.",
  statusInviteAccepted: "Partnereinladung auf diesem Gerät angenommen.",
  statusInviteRevoked: "Ausstehende Partnereinladung widerrufen.",
  statusGrantRevoked: "Partnerzugriff widerrufen.",
  sharedViewTitle: "Geteilte Zyklusansicht",
  sharedViewSubtitle:
    "Diese schreibgeschützte Ansicht stammt nur aus dem Ovumcy-Managed-Partnerzugriff.",
  sharedViewBackLabel: "Zurück zum Partnerzugriff",
  sharedViewLoadingTitle: "Geteilte Ansicht wird geladen",
  sharedViewLoadingSubtitle:
    "Der geteilte Partner-Snapshot wird auf diesem Gerät entschlüsselt.",
  sharedViewNotReady:
    "Der Owner hat für diesen Zugriff noch keine geteilten Daten hochgeladen.",
  sharedViewLocked:
    "Diese geteilte Ansicht kann auf diesem Gerät nicht geöffnet werden, weil der Einladungsschlüssel fehlt.",
  sharedViewSummaryHint:
    "Zusammenfassender Zugriff behält die leichtere Übersicht ohne detaillierte Tageshistorie.",
  sharedViewFullHint:
    "Voller Zugriff enthält die geteilte Übersicht und die detaillierte Tageshistorie, die der Owner erlaubt hat.",
  sharedViewGeneratedAtLabel: "Aktualisiert",
  sharedViewMetricsTitle: "Geteilte Zusammenfassung",
  sharedViewHistoryTitle: "Letzte geteilte Historie",
  sharedViewHistoryEmpty: "Noch keine geteilte Tageshistorie verfügbar.",
  sharedViewCycleDayLabel: "Zyklustag",
  sharedViewNextPeriodLabel: "Nächstes Periodenfenster",
  sharedViewLastCycleLabel: "Letzter Zyklus",
  sharedViewAverageCycleLabel: "Durchschnittlicher Zyklus",
  sharedViewAveragePeriodLabel: "Durchschnittliche Periode",
  sharedViewLoggedDaysLabel: "Erfasste Tage",
  sharedViewTopSymptomsLabel: "Häufigste Symptome",
  errors: {
    notConnected: "Melde dich zuerst bei Ovumcy Cloud an.",
    invalidPartnerInvite: "Diese Partnereinladung ist ungültig.",
    partnerInviteNotFound: "Diese Partnereinladung wurde nicht gefunden.",
    partnerInviteExpired: "Diese Partnereinladung ist abgelaufen.",
    partnerAccessUnavailable:
      "Partnerzugriff ist für dieses Managed-Konto gerade nicht verfügbar.",
    partnerAccessNotFound: "Dieser Partnerzugriff wurde nicht gefunden.",
    networkFailed: "Ovumcy Cloud ist gerade nicht erreichbar.",
    generic: "Partnerzugriff konnte gerade nicht aktualisiert werden. Bitte versuche es erneut.",
  },
} as const;

const partnerCopyFr = {
  title: "Accès partenaire",
  subtitle:
    "Inviter un partenaire par lien, choisir le niveau d’accès et retirer rapidement l’accès si besoin.",
  planLocked:
    "L’accès partenaire est une fonction premium du compte géré qui crée l’invitation.",
  ownerTitle: "Inviter un partenaire",
  ownerHint:
    "Ovumcy crée un lien d’invitation privé depuis ton compte géré. Le partenaire se connecte sur son propre appareil et accepte le lien dans l’app.",
  accessLevelLabel: "Niveau d’accès",
  accessLevelSummary: "Résumé seulement",
  accessLevelFull: "Accès complet",
  accessLevelSummaryHint:
    "Partage la vue récapitulative légère au lieu d’un historique détaillé jour par jour.",
  accessLevelFullHint:
    "Autorise la vue partagée complète, y compris l’historique détaillé jour par jour lorsqu’il est disponible.",
  issueInviteLabel: "Créer un lien d’invitation",
  inviteLinkTitle: "Lien d’invitation",
  inviteLinkHint:
    "Partage ou ouvre ce lien avec le partenaire. L’acceptation demande quand même sa propre connexion gérée.",
  pendingInvitesTitle: "Invitations en attente",
  pendingInvitesEmpty: "Aucune invitation en attente pour le moment.",
  pendingInviteLabel: "Lien d’invitation en attente",
  activePartnersTitle: "Accès partenaires actifs",
  activePartnersEmpty: "Aucun accès partenaire actif pour le moment.",
  activePartnerLabel: "Accès partenaire",
  sharedWithMeTitle: "Accès partagé avec ce compte",
  sharedWithMeHint:
    "Ce compte géré dispose déjà d’un accès partenaire. Le niveau accordé reste visible ici même après la disparition de la bannière d’invitation.",
  sharedWithMeEmpty: "Aucun accès partenaire n’a encore été partagé avec ce compte.",
  sharedGrantLabel: "Vue de cycle partagée",
  lastSeenLabel: "Dernière ouverture",
  lastSeenNever: "Pas encore ouvert.",
  openSharedViewLabel: "Ouvrir la vue partagée",
  revokeInviteLabel: "Retirer l’invitation",
  revokeGrantLabel: "Retirer l’accès",
  acceptTitle: "Accepter l’invitation partenaire",
  acceptReadyHint:
    "Ce lien peut être accepté avec le compte géré actuellement connecté.",
  acceptSignInHint:
    "Connecte-toi d’abord à ton compte géré, puis accepte cette invitation partenaire sur cet appareil.",
  acceptActionLabel: "Accepter l’invitation",
  statusInviteIssued: "Lien d’invitation partenaire créé.",
  statusInviteAccepted: "Invitation partenaire acceptée sur cet appareil.",
  statusInviteRevoked: "Invitation partenaire en attente retirée.",
  statusGrantRevoked: "Accès partenaire retiré.",
  sharedViewTitle: "Vue de cycle partagée",
  sharedViewSubtitle:
    "Cette vue en lecture seule vient uniquement du partage partenaire Ovumcy Managed.",
  sharedViewBackLabel: "Retour à l’accès partenaire",
  sharedViewLoadingTitle: "Chargement de la vue partagée",
  sharedViewLoadingSubtitle:
    "Le snapshot partenaire partagé est déchiffré sur cet appareil.",
  sharedViewNotReady:
    "Le propriétaire n’a pas encore téléversé de données partagées pour cet accès.",
  sharedViewLocked:
    "Cet appareil ne peut pas ouvrir la vue partagée, car la clé d’invitation est absente.",
  sharedViewSummaryHint:
    "L’accès résumé conserve la vue partagée légère sans historique détaillé jour par jour.",
  sharedViewFullHint:
    "L’accès complet inclut la vue partagée et l’historique détaillé jour par jour autorisé par le propriétaire.",
  sharedViewGeneratedAtLabel: "Mis à jour",
  sharedViewMetricsTitle: "Résumé partagé",
  sharedViewHistoryTitle: "Historique partagé récent",
  sharedViewHistoryEmpty: "Aucun historique détaillé partagé pour le moment.",
  sharedViewCycleDayLabel: "Jour du cycle",
  sharedViewNextPeriodLabel: "Prochaine fenêtre de règles",
  sharedViewLastCycleLabel: "Dernier cycle",
  sharedViewAverageCycleLabel: "Cycle moyen",
  sharedViewAveragePeriodLabel: "Durée moyenne des règles",
  sharedViewLoggedDaysLabel: "Jours saisis",
  sharedViewTopSymptomsLabel: "Symptômes principaux",
  errors: {
    notConnected: "Connecte-toi d’abord à Ovumcy Cloud.",
    invalidPartnerInvite: "Cette invitation partenaire n’est pas valide.",
    partnerInviteNotFound: "Cette invitation partenaire est introuvable.",
    partnerInviteExpired: "Cette invitation partenaire a expiré.",
    partnerAccessUnavailable:
      "L’accès partenaire n’est pas disponible pour ce compte géré pour le moment.",
    partnerAccessNotFound: "Cet accès partenaire est introuvable.",
    networkFailed: "Impossible de joindre Ovumcy Cloud pour le moment.",
    generic: "Impossible de mettre à jour l’accès partenaire pour le moment. Réessaie.",
  },
} as const;

const partnerCopyRu = {
  title: "Доступ партнёра",
  subtitle:
    "Приглашай партнёра по ссылке, выбирай уровень доступа и быстро отзыви доступ при необходимости.",
  planLocked:
    "Доступ партнёра — это premium-функция managed-аккаунта, который создаёт приглашение.",
  ownerTitle: "Пригласить партнёра",
  ownerHint:
    "Ovumcy создаёт приватную ссылку-приглашение из твоего managed-аккаунта. Партнёр входит на своём устройстве и принимает ссылку прямо в приложении.",
  accessLevelLabel: "Уровень доступа",
  accessLevelSummary: "Только сводка",
  accessLevelFull: "Полный доступ",
  accessLevelSummaryHint:
    "Открывает облегчённую сводку вместо подробной истории по дням.",
  accessLevelFullHint:
    "Открывает полный общий просмотр, включая подробную историю по дням, когда она доступна.",
  issueInviteLabel: "Создать ссылку-приглашение",
  inviteLinkTitle: "Ссылка-приглашение",
  inviteLinkHint:
    "Поделись этой ссылкой с партнёром или открой её. Для принятия всё равно нужен его собственный managed-вход.",
  pendingInvitesTitle: "Ожидающие приглашения",
  pendingInvitesEmpty: "Пока нет ожидающих приглашений.",
  pendingInviteLabel: "Ссылка-приглашение ожидает принятия",
  activePartnersTitle: "Активный доступ партнёров",
  activePartnersEmpty: "Пока нет активного доступа партнёров.",
  activePartnerLabel: "Доступ партнёра",
  sharedWithMeTitle: "Доступ, выданный этому аккаунту",
  sharedWithMeHint:
    "У этого managed-аккаунта уже есть партнёрский доступ. Выданный уровень доступа остаётся видимым здесь даже после исчезновения баннера приглашения.",
  sharedWithMeEmpty: "Этому аккаунту ещё не выдан партнёрский доступ.",
  sharedGrantLabel: "Общий просмотр цикла",
  lastSeenLabel: "Последний вход",
  lastSeenNever: "Ещё не открывалось.",
  openSharedViewLabel: "Открыть общий просмотр",
  revokeInviteLabel: "Отозвать приглашение",
  revokeGrantLabel: "Отозвать доступ",
  acceptTitle: "Принять приглашение партнёра",
  acceptReadyHint:
    "Эту ссылку можно принять в текущем вошедшем managed-аккаунте.",
  acceptSignInHint:
    "Сначала войди в свой managed-аккаунт, а потом прими это приглашение партнёра на этом устройстве.",
  acceptActionLabel: "Принять приглашение",
  statusInviteIssued: "Ссылка-приглашение для партнёра создана.",
  statusInviteAccepted: "Приглашение партнёра принято на этом устройстве.",
  statusInviteRevoked: "Ожидающее приглашение партнёра отозвано.",
  statusGrantRevoked: "Доступ партнёра отозван.",
  sharedViewTitle: "Общий просмотр цикла",
  sharedViewSubtitle:
    "Этот read-only просмотр приходит только из managed-партнёрского доступа Ovumcy.",
  sharedViewBackLabel: "Назад к доступу партнёра",
  sharedViewLoadingTitle: "Загружаем общий просмотр",
  sharedViewLoadingSubtitle:
    "Общий partner snapshot расшифровывается прямо на этом устройстве.",
  sharedViewNotReady:
    "Владелец ещё не загрузил общие данные для этого доступа.",
  sharedViewLocked:
    "На этом устройстве нельзя открыть общий просмотр, потому что не найден ключ приглашения.",
  sharedViewSummaryHint:
    "Режим сводки сохраняет облегчённый общий обзор без подробной истории по дням.",
  sharedViewFullHint:
    "Полный доступ включает общий обзор и подробную историю по дням в том объёме, который разрешил владелец.",
  sharedViewGeneratedAtLabel: "Обновлено",
  sharedViewMetricsTitle: "Общая сводка",
  sharedViewHistoryTitle: "Недавняя общая история",
  sharedViewHistoryEmpty: "Подробная общая история по дням пока недоступна.",
  sharedViewCycleDayLabel: "День цикла",
  sharedViewNextPeriodLabel: "Следующее окно месячных",
  sharedViewLastCycleLabel: "Последний цикл",
  sharedViewAverageCycleLabel: "Средняя длина цикла",
  sharedViewAveragePeriodLabel: "Средняя длина месячных",
  sharedViewLoggedDaysLabel: "Дней с записями",
  sharedViewTopSymptomsLabel: "Топ симптомов",
  errors: {
    notConnected: "Сначала войди в Ovumcy Cloud.",
    invalidPartnerInvite: "Это приглашение партнёра недействительно.",
    partnerInviteNotFound: "Это приглашение партнёра не найдено.",
    partnerInviteExpired: "Срок действия этого приглашения партнёра истёк.",
    partnerAccessUnavailable:
      "Доступ партнёра сейчас недоступен для этого managed-аккаунта.",
    partnerAccessNotFound: "Эта запись доступа партнёра не найдена.",
    networkFailed: "Сейчас не удаётся связаться с Ovumcy Cloud.",
    generic: "Сейчас не удалось обновить доступ партнёра. Попробуй ещё раз.",
  },
} as const;

const partnerCopyEs = {
  title: "Acceso de pareja",
  subtitle:
    "Invita a una pareja por enlace, elige el nivel de acceso y retira el acceso rápidamente si hace falta.",
  planLocked:
    "El acceso de pareja es una función premium de la cuenta managed que crea la invitación.",
  ownerTitle: "Invitar a una pareja",
  ownerHint:
    "Ovumcy crea un enlace privado de invitación desde tu cuenta managed. La pareja inicia sesión en su propio dispositivo y acepta el enlace dentro de la app.",
  accessLevelLabel: "Nivel de acceso",
  accessLevelSummary: "Solo resumen",
  accessLevelFull: "Acceso completo",
  accessLevelSummaryHint:
    "Comparte la vista resumida en lugar de un historial detallado día por día.",
  accessLevelFullHint:
    "Permite la vista compartida completa, incluido el historial detallado día por día cuando esté disponible.",
  issueInviteLabel: "Crear enlace de invitación",
  inviteLinkTitle: "Enlace de invitación",
  inviteLinkHint:
    "Comparte o abre este enlace con la pareja. La aceptación igualmente requiere su propio inicio de sesión managed.",
  pendingInvitesTitle: "Invitaciones pendientes",
  pendingInvitesEmpty: "Todavía no hay invitaciones pendientes.",
  pendingInviteLabel: "Enlace de invitación pendiente",
  activePartnersTitle: "Accesos de pareja activos",
  activePartnersEmpty: "Todavía no hay acceso de pareja activo.",
  activePartnerLabel: "Acceso de pareja",
  sharedWithMeTitle: "Acceso compartido con esta cuenta",
  sharedWithMeHint:
    "Esta cuenta managed ya tiene acceso de pareja. El nivel concedido sigue visible aquí incluso después de que desaparezca el banner de invitación.",
  sharedWithMeEmpty: "Todavía no se ha compartido acceso de pareja con esta cuenta.",
  sharedGrantLabel: "Vista compartida del ciclo",
  lastSeenLabel: "Última visita",
  lastSeenNever: "Todavía no se abrió.",
  openSharedViewLabel: "Abrir vista compartida",
  revokeInviteLabel: "Revocar invitación",
  revokeGrantLabel: "Revocar acceso",
  acceptTitle: "Aceptar invitación de pareja",
  acceptReadyHint:
    "Este enlace puede aceptarse con la cuenta managed que ya inició sesión.",
  acceptSignInHint:
    "Primero inicia sesión en tu cuenta managed y después acepta esta invitación de pareja en este dispositivo.",
  acceptActionLabel: "Aceptar invitación",
  statusInviteIssued: "Se creó el enlace de invitación de pareja.",
  statusInviteAccepted: "La invitación de pareja se aceptó en este dispositivo.",
  statusInviteRevoked: "Se revocó la invitación de pareja pendiente.",
  statusGrantRevoked: "Se revocó el acceso de pareja.",
  sharedViewTitle: "Vista compartida del ciclo",
  sharedViewSubtitle:
    "Esta vista de solo lectura llega solo desde el acceso de pareja de Ovumcy Managed.",
  sharedViewBackLabel: "Volver al acceso de pareja",
  sharedViewLoadingTitle: "Cargando vista compartida",
  sharedViewLoadingSubtitle:
    "El snapshot compartido de pareja se está descifrando en este dispositivo.",
  sharedViewNotReady:
    "La persona propietaria todavía no ha subido datos compartidos para este acceso.",
  sharedViewLocked:
    "Este dispositivo no puede abrir la vista compartida porque falta la clave de invitación.",
  sharedViewSummaryHint:
    "El acceso de resumen mantiene la vista compartida ligera sin historial detallado día a día.",
  sharedViewFullHint:
    "El acceso completo incluye la vista compartida y el historial detallado día a día que la persona propietaria permitió.",
  sharedViewGeneratedAtLabel: "Actualizado",
  sharedViewMetricsTitle: "Resumen compartido",
  sharedViewHistoryTitle: "Historial compartido reciente",
  sharedViewHistoryEmpty: "Todavía no hay historial detallado compartido.",
  sharedViewCycleDayLabel: "Día del ciclo",
  sharedViewNextPeriodLabel: "Próxima ventana del periodo",
  sharedViewLastCycleLabel: "Último ciclo",
  sharedViewAverageCycleLabel: "Ciclo medio",
  sharedViewAveragePeriodLabel: "Periodo medio",
  sharedViewLoggedDaysLabel: "Días registrados",
  sharedViewTopSymptomsLabel: "Síntomas principales",
  errors: {
    notConnected: "Primero inicia sesión en Ovumcy Cloud.",
    invalidPartnerInvite: "Esta invitación de pareja no es válida.",
    partnerInviteNotFound: "No se encontró esta invitación de pareja.",
    partnerInviteExpired: "Esta invitación de pareja ha caducado.",
    partnerAccessUnavailable:
      "El acceso de pareja no está disponible para esta cuenta managed ahora mismo.",
    partnerAccessNotFound: "No se encontró este acceso de pareja.",
    networkFailed: "No se puede contactar con Ovumcy Cloud ahora mismo.",
    generic: "No se pudo actualizar el acceso de pareja ahora mismo. Inténtalo otra vez.",
  },
} as const;

const catalogs = {
  en: partnerCopyEn,
  de: partnerCopyDe,
  fr: partnerCopyFr,
  ru: partnerCopyRu,
  es: partnerCopyEs,
} as const;

export function getPartnerCopy(locale?: string) {
  return catalogs[resolveCopyLanguage(locale) as InterfaceLanguage] ?? partnerCopyEn;
}

export type PartnerCopy = ReturnType<typeof getPartnerCopy>;
