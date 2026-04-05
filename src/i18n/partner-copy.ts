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
    "Ovumcy issues a private invite link from your managed account. You can revoke pending or active access at any time.",
  inviteEmailLabel: "Partner email",
  inviteEmailPlaceholder: "partner@example.com",
  accessLevelLabel: "Access level",
  accessLevelSummary: "Summary only",
  accessLevelFull: "Full access",
  issueInviteLabel: "Create invite link",
  inviteLinkTitle: "Invite link",
  inviteLinkHint:
    "Open or share this link with the partner. Acceptance still requires their own managed sign-in.",
  pendingInvitesTitle: "Pending invites",
  pendingInvitesEmpty: "No pending invites yet.",
  activePartnersTitle: "Active partner access",
  activePartnersEmpty: "No active partner access yet.",
  sharedWithMeTitle: "Access shared with this account",
  sharedWithMeHint:
    "This managed account already has partner access. The granted access level stays visible here even after the invite banner is gone.",
  sharedWithMeEmpty: "No partner access has been shared with this account.",
  lastSeenLabel: "Last seen",
  lastSeenNever: "Not opened yet.",
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
  errors: {
    notConnected: "Sign in to Ovumcy Cloud first.",
    invalidPartnerInvite: "This partner invite is not valid.",
    partnerInviteNotFound: "This partner invite could not be found.",
    partnerInviteExpired: "This partner invite has expired.",
    partnerInviteEmailMismatch:
      "This invite belongs to a different email address.",
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
    "Ovumcy erstellt einen privaten Einladungslink aus deinem Managed-Konto. Ausstehende oder aktive Zugriffe kannst du jederzeit widerrufen.",
  inviteEmailLabel: "E-Mail des Partners",
  inviteEmailPlaceholder: "partner@example.com",
  accessLevelLabel: "Zugriffslevel",
  accessLevelSummary: "Nur Zusammenfassung",
  accessLevelFull: "Voller Zugriff",
  issueInviteLabel: "Einladungslink erstellen",
  inviteLinkTitle: "Einladungslink",
  inviteLinkHint:
    "Diesen Link mit dem Partner teilen oder öffnen. Die Annahme erfordert trotzdem eine eigene Managed-Anmeldung.",
  pendingInvitesTitle: "Ausstehende Einladungen",
  pendingInvitesEmpty: "Noch keine ausstehenden Einladungen.",
  activePartnersTitle: "Aktive Partnerzugriffe",
  activePartnersEmpty: "Noch kein aktiver Partnerzugriff.",
  sharedWithMeTitle: "Mit diesem Konto geteilter Zugriff",
  sharedWithMeHint:
    "Dieses Managed-Konto hat bereits Partnerzugriff. Das gewährte Zugriffslevel bleibt hier sichtbar, auch nachdem das Einladungsbanner verschwunden ist.",
  sharedWithMeEmpty: "Mit diesem Konto wurde noch kein Partnerzugriff geteilt.",
  lastSeenLabel: "Zuletzt gesehen",
  lastSeenNever: "Noch nicht geöffnet.",
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
  errors: {
    notConnected: "Melde dich zuerst bei Ovumcy Cloud an.",
    invalidPartnerInvite: "Diese Partnereinladung ist ungültig.",
    partnerInviteNotFound: "Diese Partnereinladung wurde nicht gefunden.",
    partnerInviteExpired: "Diese Partnereinladung ist abgelaufen.",
    partnerInviteEmailMismatch:
      "Diese Einladung gehört zu einer anderen E-Mail-Adresse.",
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
    "Ovumcy crée un lien d’invitation privé depuis ton compte géré. Tu peux retirer l’accès en attente ou actif à tout moment.",
  inviteEmailLabel: "E-mail du partenaire",
  inviteEmailPlaceholder: "partner@example.com",
  accessLevelLabel: "Niveau d’accès",
  accessLevelSummary: "Résumé seulement",
  accessLevelFull: "Accès complet",
  issueInviteLabel: "Créer un lien d’invitation",
  inviteLinkTitle: "Lien d’invitation",
  inviteLinkHint:
    "Partage ou ouvre ce lien avec le partenaire. L’acceptation demande quand même sa propre connexion gérée.",
  pendingInvitesTitle: "Invitations en attente",
  pendingInvitesEmpty: "Aucune invitation en attente pour le moment.",
  activePartnersTitle: "Accès partenaires actifs",
  activePartnersEmpty: "Aucun accès partenaire actif pour le moment.",
  sharedWithMeTitle: "Accès partagé avec ce compte",
  sharedWithMeHint:
    "Ce compte géré dispose déjà d’un accès partenaire. Le niveau accordé reste visible ici même après la disparition de la bannière d’invitation.",
  sharedWithMeEmpty: "Aucun accès partenaire n’a encore été partagé avec ce compte.",
  lastSeenLabel: "Dernière ouverture",
  lastSeenNever: "Pas encore ouvert.",
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
  errors: {
    notConnected: "Connecte-toi d’abord à Ovumcy Cloud.",
    invalidPartnerInvite: "Cette invitation partenaire n’est pas valide.",
    partnerInviteNotFound: "Cette invitation partenaire est introuvable.",
    partnerInviteExpired: "Cette invitation partenaire a expiré.",
    partnerInviteEmailMismatch:
      "Cette invitation appartient à une autre adresse e-mail.",
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
    "Ovumcy создаёт приватную ссылку-приглашение из твоего managed-аккаунта. Ожидающий или активный доступ можно отозвать в любой момент.",
  inviteEmailLabel: "Email партнёра",
  inviteEmailPlaceholder: "partner@example.com",
  accessLevelLabel: "Уровень доступа",
  accessLevelSummary: "Только сводка",
  accessLevelFull: "Полный доступ",
  issueInviteLabel: "Создать ссылку-приглашение",
  inviteLinkTitle: "Ссылка-приглашение",
  inviteLinkHint:
    "Поделись этой ссылкой с партнёром или открой её. Для принятия всё равно нужен его собственный managed-вход.",
  pendingInvitesTitle: "Ожидающие приглашения",
  pendingInvitesEmpty: "Пока нет ожидающих приглашений.",
  activePartnersTitle: "Активный доступ партнёров",
  activePartnersEmpty: "Пока нет активного доступа партнёров.",
  sharedWithMeTitle: "Доступ, выданный этому аккаунту",
  sharedWithMeHint:
    "У этого managed-аккаунта уже есть партнёрский доступ. Выданный уровень доступа остаётся видимым здесь даже после исчезновения баннера приглашения.",
  sharedWithMeEmpty: "Этому аккаунту ещё не выдан партнёрский доступ.",
  lastSeenLabel: "Последний вход",
  lastSeenNever: "Ещё не открывалось.",
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
  errors: {
    notConnected: "Сначала войди в Ovumcy Cloud.",
    invalidPartnerInvite: "Это приглашение партнёра недействительно.",
    partnerInviteNotFound: "Это приглашение партнёра не найдено.",
    partnerInviteExpired: "Срок действия этого приглашения партнёра истёк.",
    partnerInviteEmailMismatch:
      "Это приглашение предназначено для другого email.",
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
    "Ovumcy crea un enlace privado de invitación desde tu cuenta managed. Puedes revocar el acceso pendiente o activo en cualquier momento.",
  inviteEmailLabel: "Correo de la pareja",
  inviteEmailPlaceholder: "partner@example.com",
  accessLevelLabel: "Nivel de acceso",
  accessLevelSummary: "Solo resumen",
  accessLevelFull: "Acceso completo",
  issueInviteLabel: "Crear enlace de invitación",
  inviteLinkTitle: "Enlace de invitación",
  inviteLinkHint:
    "Comparte o abre este enlace con la pareja. La aceptación igualmente requiere su propio inicio de sesión managed.",
  pendingInvitesTitle: "Invitaciones pendientes",
  pendingInvitesEmpty: "Todavía no hay invitaciones pendientes.",
  activePartnersTitle: "Accesos de pareja activos",
  activePartnersEmpty: "Todavía no hay acceso de pareja activo.",
  sharedWithMeTitle: "Acceso compartido con esta cuenta",
  sharedWithMeHint:
    "Esta cuenta managed ya tiene acceso de pareja. El nivel concedido sigue visible aquí incluso después de que desaparezca el banner de invitación.",
  sharedWithMeEmpty: "Todavía no se ha compartido acceso de pareja con esta cuenta.",
  lastSeenLabel: "Última visita",
  lastSeenNever: "Todavía no se abrió.",
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
  errors: {
    notConnected: "Primero inicia sesión en Ovumcy Cloud.",
    invalidPartnerInvite: "Esta invitación de pareja no es válida.",
    partnerInviteNotFound: "No se encontró esta invitación de pareja.",
    partnerInviteExpired: "Esta invitación de pareja ha caducado.",
    partnerInviteEmailMismatch:
      "Esta invitación pertenece a otra dirección de correo.",
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
