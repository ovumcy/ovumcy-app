import type { InterfaceLanguage } from "../models/profile";
import { resolveCopyLanguage } from "./runtime";
import { ruDayWord } from "./ru-plural";

const partnerCopyEn = {
  title: "Partner access",
  subtitle:
    "Invite a partner by link, choose the access level, and revoke access quickly when needed.",
  planLocked:
    "Partner access is a premium Ovumcy Cloud feature for the owner account that creates the invite.",
  ownerTitle: "Invite a partner",
  ownerHint:
    "Ovumcy issues a private invite link from your Ovumcy Cloud account. The partner signs in on their own device and accepts the link in app.",
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
    "Open or share this link with the partner. Acceptance still requires their own Ovumcy Cloud sign-in.",
  pendingInvitesTitle: "Pending invites",
  pendingInvitesEmpty: "No pending invites yet.",
  pendingInviteLabel: "Invite link pending",
  activePartnersTitle: "Active partner access",
  activePartnersEmpty: "No active partner access yet.",
  activePartnerLabel: "Partner access",
  sharedWithMeTitle: "Access shared with this account",
  sharedWithMeHint:
    "This Ovumcy Cloud account already has partner access. The granted access level stays visible here even after the invite banner is gone.",
  sharedWithMeEmpty: "No partner access has been shared with this account.",
  sharedGrantLabel: "Shared cycle view",
  lastSeenLabel: "Last seen",
  lastSeenNever: "Not opened yet.",
  openSharedViewLabel: "Open shared view",
  revokeInviteLabel: "Revoke invite",
  revokeGrantLabel: "Revoke access",
  acceptTitle: "Accept partner invite",
  acceptReadyHint:
    "This link is ready to be accepted on the currently signed-in Ovumcy Cloud account.",
  acceptSignInHint:
    "Sign in to your Ovumcy Cloud account first, then accept this partner invite on this device.",
  acceptActionLabel: "Accept invite",
  acceptChoiceHint:
    "Accept this invite as a guest on this device, or sign in to your Ovumcy Cloud account first.",
  acceptAsGuestActionLabel: "Accept as guest",
  acceptSignInActionLabel: "Sign in to accept",
  statusInviteIssued: "Partner invite link created.",
  statusInviteAccepted: "Partner invite accepted on this device.",
  statusInviteRevoked: "Pending partner invite revoked.",
  statusGrantRevoked: "Partner access revoked.",
  sharedViewTitle: "Shared cycle view",
  sharedViewSubtitle:
    "This read-only view is available only through Ovumcy Cloud partner sharing.",
  sharedViewBackLabel: "Back to partner access",
  sharedViewLoadingTitle: "Loading shared view",
  sharedViewLoadingSubtitle:
    "Decrypting the shared partner view on this device.",
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
  sharedViewStaleNotice:
    "Shared data may be out of date — predictions hidden.",
  sharedViewHistoryQualifier: "Showing the last 90 days.",
  errors: {
    notConnected: "Sign in to Ovumcy Cloud first.",
    invalidPartnerInvite: "This partner invite is not valid.",
    partnerInviteNotFound: "This partner invite could not be found.",
    partnerInviteExpired: "This partner invite has expired.",
    partnerAccessUnavailable:
      "Partner access is not available for this Ovumcy Cloud account right now.",
    partnerAccessNotFound: "This partner access record could not be found.",
    networkFailed: "Unable to reach Ovumcy Cloud right now.",
    generic: "Unable to update partner access right now. Please try again.",
  },
  premiumEyebrowLabel: "Premium",
  premiumLockTitle: "Partner invitations",
  guestUpgrade: {
    ctaLabel: "Keep your access",
    ctaHint:
      "Add an email and password so this shared access keeps working even after this device's guest session expires.",
    formTitle: "Keep your access",
    formHint:
      "This turns your guest access into a normal Ovumcy Cloud account. You'll get a one-time recovery code — save it somewhere safe.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
    submitLabel: "Keep access",
    cancelLabel: "Cancel",
    deviceAuthPrompt:
      "Confirm with device security to keep access to this shared account.",
    successMessage:
      "Your access is saved. Save the recovery code below — it won't be shown again.",
    alreadyUpgradedMessage: "This account has already been upgraded.",
    revealTitle: "Save your recovery code",
    revealHint:
      "Shown only once. Use it if you ever forget this account's password.",
    revealConfirmLabel: "I have saved it",
    nudgeMessage: (days: number) =>
      `Your guest access expires in ${days} ${days === 1 ? "day" : "days"} — keep it before then.`,
    errors: {
      emailRequired: "Email is required.",
      passwordRequired: "Password is required.",
      passwordTooShort: "Password must be at least 12 characters.",
      invalidRegistrationInput: "Use a valid email and a stronger password.",
      emailTaken:
        "This email is already registered. Try a different email or sign in on another device instead.",
      unauthorized: "This session has expired. Ask the owner for a new invite link.",
      rateLimited: "Too many attempts. Please wait a moment before trying again.",
      deviceAuthUnavailable:
        "Set up a device passcode or biometrics before keeping this shared access.",
      deviceAuthFailed: "Unable to confirm device security right now. Please try again.",
      generic: "Unable to save your access right now. Please try again.",
    },
  },
} as const;

const partnerCopyDe = {
  title: "Partnerzugriff",
  subtitle:
    "Partner per Link einladen, Zugriffslevel wählen und den Zugriff bei Bedarf schnell widerrufen.",
  planLocked:
    "Partnerzugriff ist eine Premium-Funktion des Ovumcy-Cloud-Kontos, das die Einladung erstellt.",
  ownerTitle: "Partner einladen",
  ownerHint:
    "Ovumcy erstellt einen privaten Einladungslink aus Ihrem Ovumcy-Cloud-Konto. Der Partner meldet sich auf seinem eigenen Gerät an und nimmt den Link in der App an.",
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
    "Diesen Link mit dem Partner teilen oder öffnen. Die Annahme erfordert trotzdem eine eigene Anmeldung bei Ovumcy Cloud.",
  pendingInvitesTitle: "Ausstehende Einladungen",
  pendingInvitesEmpty: "Noch keine ausstehenden Einladungen.",
  pendingInviteLabel: "Einladungslink ausstehend",
  activePartnersTitle: "Aktive Partnerzugriffe",
  activePartnersEmpty: "Noch kein aktiver Partnerzugriff.",
  activePartnerLabel: "Partnerzugriff",
  sharedWithMeTitle: "Mit diesem Konto geteilter Zugriff",
  sharedWithMeHint:
    "Dieses Ovumcy-Cloud-Konto hat bereits Partnerzugriff. Das gewährte Zugriffslevel bleibt hier sichtbar, auch nachdem das Einladungsbanner verschwunden ist.",
  sharedWithMeEmpty: "Mit diesem Konto wurde noch kein Partnerzugriff geteilt.",
  sharedGrantLabel: "Geteilte Zyklusansicht",
  lastSeenLabel: "Zuletzt gesehen",
  lastSeenNever: "Noch nicht geöffnet.",
  openSharedViewLabel: "Geteilte Ansicht öffnen",
  revokeInviteLabel: "Einladung widerrufen",
  revokeGrantLabel: "Zugriff widerrufen",
  acceptTitle: "Partnereinladung annehmen",
  acceptReadyHint:
    "Dieser Link kann mit dem aktuell angemeldeten Ovumcy-Cloud-Konto angenommen werden.",
  acceptSignInHint:
    "Melden Sie sich zuerst bei Ihrem Ovumcy-Cloud-Konto an und nehmen Sie dann diese Partnereinladung auf diesem Gerät an.",
  acceptActionLabel: "Einladung annehmen",
  acceptChoiceHint:
    "Nimm diese Einladung als Gast auf diesem Gerät an oder melde dich zuerst bei deinem Ovumcy-Cloud-Konto an.",
  acceptAsGuestActionLabel: "Als Gast annehmen",
  acceptSignInActionLabel: "Zum Annehmen anmelden",
  statusInviteIssued: "Partner-Einladungslink erstellt.",
  statusInviteAccepted: "Partnereinladung auf diesem Gerät angenommen.",
  statusInviteRevoked: "Ausstehende Partnereinladung widerrufen.",
  statusGrantRevoked: "Partnerzugriff widerrufen.",
  sharedViewTitle: "Geteilte Zyklusansicht",
  sharedViewSubtitle:
    "Diese schreibgeschützte Ansicht ist nur über den Partnerzugriff in Ovumcy Cloud verfügbar.",
  sharedViewBackLabel: "Zurück zum Partnerzugriff",
  sharedViewLoadingTitle: "Geteilte Ansicht wird geladen",
  sharedViewLoadingSubtitle:
    "Die geteilte Partneransicht wird auf diesem Gerät entschlüsselt.",
  sharedViewNotReady:
    "Die Besitzerin oder der Besitzer hat für diesen Zugriff noch keine geteilten Daten hochgeladen.",
  sharedViewLocked:
    "Diese geteilte Ansicht kann auf diesem Gerät nicht geöffnet werden, weil der Einladungsschlüssel fehlt.",
  sharedViewSummaryHint:
    "Zusammenfassender Zugriff behält die leichtere Übersicht ohne detaillierte Tageshistorie.",
  sharedViewFullHint:
    "Voller Zugriff enthält die geteilte Übersicht und die detaillierte Tageshistorie, die von der Besitzerin oder dem Besitzer freigegeben wurde.",
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
  sharedViewStaleNotice:
    "Die geteilten Daten sind möglicherweise veraltet — Vorhersagen ausgeblendet.",
  sharedViewHistoryQualifier: "Zeigt die letzten 90 Tage.",
  errors: {
    notConnected: "Melden Sie sich zuerst bei Ovumcy Cloud an.",
    invalidPartnerInvite: "Diese Partnereinladung ist ungültig.",
    partnerInviteNotFound: "Diese Partnereinladung wurde nicht gefunden.",
    partnerInviteExpired: "Diese Partnereinladung ist abgelaufen.",
    partnerAccessUnavailable:
      "Partnerzugriff ist für dieses Ovumcy-Cloud-Konto gerade nicht verfügbar.",
    partnerAccessNotFound: "Dieser Partnerzugriff wurde nicht gefunden.",
    networkFailed: "Ovumcy Cloud ist gerade nicht erreichbar.",
    generic: "Partnerzugriff konnte gerade nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
  },
  premiumEyebrowLabel: "Premium",
  premiumLockTitle: "Partner-Einladungen",
  guestUpgrade: {
    ctaLabel: "Zugriff sichern",
    ctaHint:
      "Fügen Sie eine E-Mail-Adresse und ein Passwort hinzu, damit dieser geteilte Zugriff auch nach Ablauf der Gastsitzung auf diesem Gerät weiter funktioniert.",
    formTitle: "Zugriff sichern",
    formHint:
      "Dadurch wird Ihr Gastzugriff in ein normales Ovumcy-Cloud-Konto umgewandelt. Sie erhalten einen einmaligen Wiederherstellungscode — bewahren Sie ihn sicher auf.",
    emailLabel: "E-Mail",
    emailPlaceholder: "sie@example.com",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Passwort eingeben",
    submitLabel: "Zugriff sichern",
    cancelLabel: "Abbrechen",
    deviceAuthPrompt:
      "Bestätigen Sie mit der Gerätesicherheit, um diesen geteilten Zugriff zu sichern.",
    successMessage:
      "Ihr Zugriff ist gesichert. Speichern Sie den Wiederherstellungscode unten — er wird nicht erneut angezeigt.",
    alreadyUpgradedMessage: "Dieses Konto wurde bereits aktualisiert.",
    revealTitle: "Wiederherstellungscode speichern",
    revealHint:
      "Wird nur einmal angezeigt. Verwenden Sie ihn, falls Sie das Passwort dieses Kontos vergessen.",
    revealConfirmLabel: "Ich habe ihn gespeichert",
    nudgeMessage: (days: number) =>
      `Ihr Gastzugriff läuft in ${days} ${days === 1 ? "Tag" : "Tagen"} ab — sichern Sie ihn vorher.`,
    errors: {
      emailRequired: "E-Mail ist erforderlich.",
      passwordRequired: "Passwort ist erforderlich.",
      passwordTooShort: "Das Passwort muss mindestens 12 Zeichen lang sein.",
      invalidRegistrationInput:
        "Verwenden Sie eine gültige E-Mail-Adresse und ein stärkeres Passwort.",
      emailTaken:
        "Diese E-Mail-Adresse ist bereits registriert. Verwenden Sie eine andere E-Mail-Adresse oder melden Sie sich stattdessen auf einem anderen Gerät an.",
      unauthorized:
        "Diese Sitzung ist abgelaufen. Bitten Sie den Besitzer um einen neuen Einladungslink.",
      rateLimited:
        "Zu viele Versuche. Bitte warten Sie einen Moment, bevor Sie es erneut versuchen.",
      deviceAuthUnavailable:
        "Richten Sie auf diesem Gerät zuerst einen Code oder Biometrie ein, bevor Sie diesen geteilten Zugriff sichern.",
      deviceAuthFailed:
        "Der Geräteschutz konnte gerade nicht bestätigt werden. Bitte versuchen Sie es erneut.",
      generic:
        "Ihr Zugriff konnte gerade nicht gesichert werden. Bitte versuchen Sie es erneut.",
    },
  },
} as const;

const partnerCopyFr = {
  title: "Accès partenaire",
  subtitle:
    "Inviter un partenaire par lien, choisir le niveau d’accès et retirer rapidement l’accès si besoin.",
  planLocked:
    "L’accès partenaire est une fonction premium du compte Ovumcy Cloud qui crée l’invitation.",
  ownerTitle: "Inviter un partenaire",
  ownerHint:
    "Ovumcy crée un lien d’invitation privé depuis votre compte Ovumcy Cloud. Le partenaire se connecte sur son propre appareil et accepte le lien dans l’app.",
  accessLevelLabel: "Niveau d’accès",
  accessLevelSummary: "Résumé seulement",
  accessLevelFull: "Accès complet",
  accessLevelSummaryHint:
    "Partagez la vue récapitulative légère au lieu d’un historique détaillé jour par jour.",
  accessLevelFullHint:
    "Autorisez la vue partagée complète, y compris l’historique détaillé jour par jour lorsqu’il est disponible.",
  issueInviteLabel: "Créer un lien d’invitation",
  inviteLinkTitle: "Lien d’invitation",
  inviteLinkHint:
    "Partagez ou ouvrez ce lien avec le partenaire. L’acceptation demande quand même sa propre connexion à Ovumcy Cloud.",
  pendingInvitesTitle: "Invitations en attente",
  pendingInvitesEmpty: "Aucune invitation en attente pour le moment.",
  pendingInviteLabel: "Lien d’invitation en attente",
  activePartnersTitle: "Accès partenaires actifs",
  activePartnersEmpty: "Aucun accès partenaire actif pour le moment.",
  activePartnerLabel: "Accès partenaire",
  sharedWithMeTitle: "Accès partagé avec ce compte",
  sharedWithMeHint:
    "Ce compte Ovumcy Cloud dispose déjà d’un accès partenaire. Le niveau accordé reste visible ici même après la disparition de la bannière d’invitation.",
  sharedWithMeEmpty: "Aucun accès partenaire n’a encore été partagé avec ce compte.",
  sharedGrantLabel: "Vue de cycle partagée",
  lastSeenLabel: "Dernière ouverture",
  lastSeenNever: "Pas encore ouvert.",
  openSharedViewLabel: "Ouvrir la vue partagée",
  revokeInviteLabel: "Retirer l’invitation",
  revokeGrantLabel: "Retirer l’accès",
  acceptTitle: "Accepter l’invitation partenaire",
  acceptReadyHint:
    "Ce lien peut être accepté avec le compte Ovumcy Cloud actuellement connecté.",
  acceptSignInHint:
    "Connectez-vous d’abord à votre compte Ovumcy Cloud, puis acceptez cette invitation partenaire sur cet appareil.",
  acceptActionLabel: "Accepter l’invitation",
  acceptChoiceHint:
    "Acceptez cette invitation en tant qu’invité sur cet appareil, ou connectez-vous d’abord à votre compte Ovumcy Cloud.",
  acceptAsGuestActionLabel: "Accepter en tant qu’invité",
  acceptSignInActionLabel: "Se connecter pour accepter",
  statusInviteIssued: "Lien d’invitation partenaire créé.",
  statusInviteAccepted: "Invitation partenaire acceptée sur cet appareil.",
  statusInviteRevoked: "Invitation partenaire en attente retirée.",
  statusGrantRevoked: "Accès partenaire retiré.",
  sharedViewTitle: "Vue de cycle partagée",
  sharedViewSubtitle:
    "Cette vue en lecture seule est disponible uniquement via le partage partenaire Ovumcy Cloud.",
  sharedViewBackLabel: "Retour à l’accès partenaire",
  sharedViewLoadingTitle: "Chargement de la vue partagée",
  sharedViewLoadingSubtitle:
    "La vue partenaire partagée est déchiffrée sur cet appareil.",
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
  sharedViewStaleNotice:
    "Les données partagées sont peut-être obsolètes — prédictions masquées.",
  sharedViewHistoryQualifier: "Affiche les 90 derniers jours.",
  errors: {
    notConnected: "Connectez-vous d’abord à Ovumcy Cloud.",
    invalidPartnerInvite: "Cette invitation partenaire n’est pas valide.",
    partnerInviteNotFound: "Cette invitation partenaire est introuvable.",
    partnerInviteExpired: "Cette invitation partenaire a expiré.",
    partnerAccessUnavailable:
      "L’accès partenaire n’est pas disponible pour ce compte Ovumcy Cloud pour le moment.",
    partnerAccessNotFound: "Cet accès partenaire est introuvable.",
    networkFailed: "Impossible de joindre Ovumcy Cloud pour le moment.",
    generic: "Impossible de mettre à jour l’accès partenaire pour le moment. Réessayez.",
  },
  premiumEyebrowLabel: "Premium",
  premiumLockTitle: "Invitations partenaires",
  guestUpgrade: {
    ctaLabel: "Conserver votre accès",
    ctaHint:
      "Ajoutez un e-mail et un mot de passe pour que cet accès partagé continue de fonctionner même après l’expiration de la session invité sur cet appareil.",
    formTitle: "Conserver votre accès",
    formHint:
      "Cela transforme votre accès invité en compte Ovumcy Cloud normal. Vous recevrez un code de récupération à usage unique — conservez-le en lieu sûr.",
    emailLabel: "E-mail",
    emailPlaceholder: "vous@example.com",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Saisir le mot de passe",
    submitLabel: "Conserver l’accès",
    cancelLabel: "Annuler",
    deviceAuthPrompt:
      "Confirmez avec la sécurité de l’appareil pour conserver cet accès partagé.",
    successMessage:
      "Votre accès est enregistré. Sauvegardez le code de récupération ci-dessous — il ne sera plus affiché.",
    alreadyUpgradedMessage: "Ce compte a déjà été mis à niveau.",
    revealTitle: "Sauvegardez votre code de récupération",
    revealHint:
      "Affiché une seule fois. Utilisez-le si vous oubliez le mot de passe de ce compte.",
    revealConfirmLabel: "Je l’ai sauvegardé",
    nudgeMessage: (days: number) =>
      `Votre accès invité expire dans ${days} ${days === 1 ? "jour" : "jours"} — conservez-le avant.`,
    errors: {
      emailRequired: "L’e-mail est requis.",
      passwordRequired: "Le mot de passe est requis.",
      passwordTooShort: "Le mot de passe doit comporter au moins 12 caractères.",
      invalidRegistrationInput:
        "Utilisez un e-mail valide et un mot de passe plus robuste.",
      emailTaken:
        "Cet e-mail est déjà enregistré. Utilisez un autre e-mail ou connectez-vous plutôt sur un autre appareil.",
      unauthorized:
        "Cette session a expiré. Demandez un nouveau lien d’invitation au propriétaire.",
      rateLimited:
        "Trop de tentatives. Veuillez patienter un instant avant de réessayer.",
      deviceAuthUnavailable:
        "Configurez un code ou la biométrie sur cet appareil avant de conserver cet accès partagé.",
      deviceAuthFailed:
        "Impossible de confirmer la sécurité de l’appareil pour le moment. Réessayez.",
      generic: "Impossible d’enregistrer votre accès pour le moment. Réessayez.",
    },
  },
} as const;

const partnerCopyRu = {
  title: "Доступ партнёра",
  subtitle:
    "Приглашай партнёра по ссылке, выбирай уровень доступа и быстро отзови доступ при необходимости.",
  planLocked:
    "Доступ партнёра — это премиум-функция аккаунта Ovumcy Cloud, который создаёт приглашение.",
  ownerTitle: "Пригласить партнёра",
  ownerHint:
    "Ovumcy создаёт приватную ссылку-приглашение из твоего аккаунта Ovumcy Cloud. Партнёр входит на своём устройстве и принимает ссылку прямо в приложении.",
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
    "Поделись этой ссылкой с партнёром или открой её. Для принятия всё равно нужен его собственный вход в Ovumcy Cloud.",
  pendingInvitesTitle: "Ожидающие приглашения",
  pendingInvitesEmpty: "Пока нет ожидающих приглашений.",
  pendingInviteLabel: "Ссылка-приглашение ожидает принятия",
  activePartnersTitle: "Активный доступ партнёров",
  activePartnersEmpty: "Пока нет активного доступа партнёров.",
  activePartnerLabel: "Доступ партнёра",
  sharedWithMeTitle: "Доступ, выданный этому аккаунту",
  sharedWithMeHint:
    "У этого аккаунта Ovumcy Cloud уже есть партнёрский доступ. Выданный уровень доступа остаётся видимым здесь даже после исчезновения баннера приглашения.",
  sharedWithMeEmpty: "Этому аккаунту ещё не выдан партнёрский доступ.",
  sharedGrantLabel: "Общий просмотр цикла",
  lastSeenLabel: "Последний вход",
  lastSeenNever: "Ещё не открывалось.",
  openSharedViewLabel: "Открыть общий просмотр",
  revokeInviteLabel: "Отозвать приглашение",
  revokeGrantLabel: "Отозвать доступ",
  acceptTitle: "Принять приглашение партнёра",
  acceptReadyHint:
    "Эту ссылку можно принять в текущем вошедшем аккаунте Ovumcy Cloud.",
  acceptSignInHint:
    "Сначала войди в свой аккаунт Ovumcy Cloud, а потом прими это приглашение партнёра на этом устройстве.",
  acceptActionLabel: "Принять приглашение",
  acceptChoiceHint:
    "Прими это приглашение как гость на этом устройстве или сначала войди в свой аккаунт Ovumcy Cloud.",
  acceptAsGuestActionLabel: "Принять как гость",
  acceptSignInActionLabel: "Войти, чтобы принять",
  statusInviteIssued: "Ссылка-приглашение для партнёра создана.",
  statusInviteAccepted: "Приглашение партнёра принято на этом устройстве.",
  statusInviteRevoked: "Ожидающее приглашение партнёра отозвано.",
  statusGrantRevoked: "Доступ партнёра отозван.",
  sharedViewTitle: "Общий просмотр цикла",
  sharedViewSubtitle:
    "Этот просмотр только для чтения доступен только через партнёрский доступ Ovumcy Cloud.",
  sharedViewBackLabel: "Назад к доступу партнёра",
  sharedViewLoadingTitle: "Загружаем общий просмотр",
  sharedViewLoadingSubtitle:
    "Общие данные партнёра расшифровываются прямо на этом устройстве.",
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
  sharedViewStaleNotice:
    "Общие данные могут быть устаревшими — прогнозы скрыты.",
  sharedViewHistoryQualifier: "Показаны последние 90 дней.",
  errors: {
    notConnected: "Сначала войди в Ovumcy Cloud.",
    invalidPartnerInvite: "Это приглашение партнёра недействительно.",
    partnerInviteNotFound: "Это приглашение партнёра не найдено.",
    partnerInviteExpired: "Срок действия этого приглашения партнёра истёк.",
    partnerAccessUnavailable:
      "Доступ партнёра сейчас недоступен для этого аккаунта Ovumcy Cloud.",
    partnerAccessNotFound: "Эта запись доступа партнёра не найдена.",
    networkFailed: "Сейчас не удаётся связаться с Ovumcy Cloud.",
    generic: "Сейчас не удалось обновить доступ партнёра. Попробуй ещё раз.",
  },
  premiumEyebrowLabel: "Премиум",
  premiumLockTitle: "Приглашения партнёра",
  guestUpgrade: {
    ctaLabel: "Сохранить доступ",
    ctaHint:
      "Добавь email и пароль, чтобы этот общий доступ продолжал работать даже после истечения гостевой сессии на этом устройстве.",
    formTitle: "Сохранить доступ",
    formHint:
      "Это превратит твой гостевой доступ в обычный аккаунт Ovumcy Cloud. Ты получишь одноразовый код восстановления — сохрани его в надёжном месте.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Введите пароль",
    submitLabel: "Сохранить доступ",
    cancelLabel: "Отмена",
    deviceAuthPrompt:
      "Подтверди защитой устройства, чтобы сохранить этот общий доступ.",
    successMessage:
      "Доступ сохранён. Сохрани код восстановления ниже — он больше не будет показан.",
    alreadyUpgradedMessage: "Этот аккаунт уже был обновлён.",
    revealTitle: "Сохрани код восстановления",
    revealHint:
      "Показывается только один раз. Понадобится, если забудешь пароль этого аккаунта.",
    revealConfirmLabel: "Я сохранил(а)",
    nudgeMessage: (days: number) =>
      `Гостевой доступ истекает через ${days} ${ruDayWord(days)} — сохрани его заранее.`,
    errors: {
      emailRequired: "Укажите email.",
      passwordRequired: "Введите пароль.",
      passwordTooShort: "Пароль должен содержать не менее 12 символов.",
      invalidRegistrationInput: "Укажите корректный email и более надёжный пароль.",
      emailTaken:
        "Этот email уже зарегистрирован. Используй другой email или войди на другом устройстве.",
      unauthorized: "Сессия истекла. Попроси у владельца новую ссылку-приглашение.",
      rateLimited: "Слишком много попыток. Пожалуйста, подожди немного, прежде чем повторить.",
      deviceAuthUnavailable:
        "Перед сохранением этого общего доступа настройте код-пароль или биометрию на устройстве.",
      deviceAuthFailed: "Сейчас не удалось подтвердить защиту устройства. Попробуйте ещё раз.",
      generic: "Сейчас не удалось сохранить доступ. Попробуйте ещё раз.",
    },
  },
} as const;

const partnerCopyEs = {
  title: "Acceso de pareja",
  subtitle:
    "Invita a una pareja por enlace, elige el nivel de acceso y retira el acceso rápidamente si hace falta.",
  planLocked:
    "El acceso de pareja es una función premium de la cuenta de Ovumcy Cloud que crea la invitación.",
  ownerTitle: "Invitar a una pareja",
  ownerHint:
    "Ovumcy crea un enlace privado de invitación desde tu cuenta de Ovumcy Cloud. La pareja inicia sesión en su propio dispositivo y acepta el enlace dentro de la app.",
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
    "Comparte o abre este enlace con la pareja. La aceptación igualmente requiere su propio inicio de sesión en Ovumcy Cloud.",
  pendingInvitesTitle: "Invitaciones pendientes",
  pendingInvitesEmpty: "Todavía no hay invitaciones pendientes.",
  pendingInviteLabel: "Enlace de invitación pendiente",
  activePartnersTitle: "Accesos de pareja activos",
  activePartnersEmpty: "Todavía no hay acceso de pareja activo.",
  activePartnerLabel: "Acceso de pareja",
  sharedWithMeTitle: "Acceso compartido con esta cuenta",
  sharedWithMeHint:
    "Esta cuenta de Ovumcy Cloud ya tiene acceso de pareja. El nivel concedido sigue visible aquí incluso después de que desaparezca el banner de invitación.",
  sharedWithMeEmpty: "Todavía no se ha compartido acceso de pareja con esta cuenta.",
  sharedGrantLabel: "Vista compartida del ciclo",
  lastSeenLabel: "Última visita",
  lastSeenNever: "Todavía no se abrió.",
  openSharedViewLabel: "Abrir vista compartida",
  revokeInviteLabel: "Revocar invitación",
  revokeGrantLabel: "Revocar acceso",
  acceptTitle: "Aceptar invitación de pareja",
  acceptReadyHint:
    "Este enlace puede aceptarse con la cuenta de Ovumcy Cloud que ya inició sesión.",
  acceptSignInHint:
    "Primero inicia sesión en tu cuenta de Ovumcy Cloud y después acepta esta invitación de pareja en este dispositivo.",
  acceptActionLabel: "Aceptar invitación",
  acceptChoiceHint:
    "Acepta esta invitación como invitado en este dispositivo, o inicia sesión primero en tu cuenta de Ovumcy Cloud.",
  acceptAsGuestActionLabel: "Aceptar como invitado",
  acceptSignInActionLabel: "Iniciar sesión para aceptar",
  statusInviteIssued: "Se creó el enlace de invitación de pareja.",
  statusInviteAccepted: "La invitación de pareja se aceptó en este dispositivo.",
  statusInviteRevoked: "Se revocó la invitación de pareja pendiente.",
  statusGrantRevoked: "Se revocó el acceso de pareja.",
  sharedViewTitle: "Vista compartida del ciclo",
  sharedViewSubtitle:
    "Esta vista de solo lectura solo está disponible mediante el acceso de pareja de Ovumcy Cloud.",
  sharedViewBackLabel: "Volver al acceso de pareja",
  sharedViewLoadingTitle: "Cargando vista compartida",
  sharedViewLoadingSubtitle:
    "La vista compartida de la pareja se está descifrando en este dispositivo.",
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
  sharedViewStaleNotice:
    "Los datos compartidos pueden estar desactualizados — predicciones ocultas.",
  sharedViewHistoryQualifier: "Mostrando los últimos 90 días.",
  errors: {
    notConnected: "Primero inicia sesión en Ovumcy Cloud.",
    invalidPartnerInvite: "Esta invitación de pareja no es válida.",
    partnerInviteNotFound: "No se encontró esta invitación de pareja.",
    partnerInviteExpired: "Esta invitación de pareja ha caducado.",
    partnerAccessUnavailable:
      "El acceso de pareja no está disponible para esta cuenta de Ovumcy Cloud ahora mismo.",
    partnerAccessNotFound: "No se encontró este acceso de pareja.",
    networkFailed: "No se puede contactar con Ovumcy Cloud ahora mismo.",
    generic: "No se pudo actualizar el acceso de pareja ahora mismo. Inténtalo otra vez.",
  },
  premiumEyebrowLabel: "Premium",
  premiumLockTitle: "Invitaciones de pareja",
  guestUpgrade: {
    ctaLabel: "Conservar tu acceso",
    ctaHint:
      "Añade un correo y una contraseña para que este acceso compartido siga funcionando incluso después de que expire la sesión de invitado en este dispositivo.",
    formTitle: "Conservar tu acceso",
    formHint:
      "Esto convierte tu acceso de invitado en una cuenta normal de Ovumcy Cloud. Recibirás un código de recuperación de un solo uso — guárdalo en un lugar seguro.",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@example.com",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Introduce la contraseña",
    submitLabel: "Conservar acceso",
    cancelLabel: "Cancelar",
    deviceAuthPrompt:
      "Confirma con la seguridad del dispositivo para conservar este acceso compartido.",
    successMessage:
      "Tu acceso está guardado. Guarda el código de recuperación de abajo — no volverá a mostrarse.",
    alreadyUpgradedMessage: "Esta cuenta ya se ha actualizado.",
    revealTitle: "Guarda tu código de recuperación",
    revealHint:
      "Se muestra solo una vez. Úsalo si alguna vez olvidas la contraseña de esta cuenta.",
    revealConfirmLabel: "Lo he guardado",
    nudgeMessage: (days: number) =>
      `Tu acceso de invitado caduca en ${days} ${days === 1 ? "día" : "días"} — consérvalo antes de que ocurra.`,
    errors: {
      emailRequired: "El correo electrónico es obligatorio.",
      passwordRequired: "La contraseña es obligatoria.",
      passwordTooShort: "La contraseña debe tener al menos 12 caracteres.",
      invalidRegistrationInput: "Usa un correo válido y una contraseña más segura.",
      emailTaken:
        "Este correo ya está registrado. Prueba con otro correo o inicia sesión en otro dispositivo.",
      unauthorized:
        "Esta sesión ha caducado. Pide a la persona propietaria un nuevo enlace de invitación.",
      rateLimited: "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
      deviceAuthUnavailable:
        "Configura un código o biometría en este dispositivo antes de conservar este acceso compartido.",
      deviceAuthFailed:
        "No se pudo confirmar la seguridad del dispositivo ahora mismo. Inténtalo de nuevo.",
      generic: "No se pudo guardar tu acceso ahora mismo. Inténtalo de nuevo.",
    },
  },
} as const;

const partnerCopyIt = {
  title: "Accesso partner",
  subtitle:
    "Invita un partner tramite link, scegli il livello di accesso e revoca l'accesso rapidamente quando serve.",
  planLocked:
    "L'accesso partner è una funzione premium di Ovumcy Cloud per l'account proprietario che crea l'invito.",
  ownerTitle: "Invita un partner",
  ownerHint:
    "Ovumcy crea un link di invito privato dal tuo account Ovumcy Cloud. Il partner accede sul proprio dispositivo e accetta il link nell'app.",
  accessLevelLabel: "Livello di accesso",
  accessLevelSummary: "Solo riepilogo",
  accessLevelFull: "Accesso completo",
  accessLevelSummaryHint:
    "Condividi la vista di riepilogo più leggera invece della cronologia dettagliata giorno per giorno.",
  accessLevelFullHint:
    "Consenti la vista condivisa completa, inclusa la cronologia dettagliata giorno per giorno quando è disponibile.",
  issueInviteLabel: "Crea link di invito",
  inviteLinkTitle: "Link di invito",
  inviteLinkHint:
    "Apri o condividi questo link con il partner. L'accettazione richiede comunque il suo accesso a Ovumcy Cloud.",
  pendingInvitesTitle: "Inviti in sospeso",
  pendingInvitesEmpty: "Ancora nessun invito in sospeso.",
  pendingInviteLabel: "Link di invito in sospeso",
  activePartnersTitle: "Accessi partner attivi",
  activePartnersEmpty: "Ancora nessun accesso partner attivo.",
  activePartnerLabel: "Accesso partner",
  sharedWithMeTitle: "Accesso condiviso con questo account",
  sharedWithMeHint:
    "Questo account Ovumcy Cloud ha già un accesso partner. Il livello di accesso concesso resta visibile qui anche dopo la scomparsa del banner di invito.",
  sharedWithMeEmpty: "Nessun accesso partner è stato condiviso con questo account.",
  sharedGrantLabel: "Vista condivisa del ciclo",
  lastSeenLabel: "Ultimo accesso",
  lastSeenNever: "Non ancora aperto.",
  openSharedViewLabel: "Apri vista condivisa",
  revokeInviteLabel: "Revoca invito",
  revokeGrantLabel: "Revoca accesso",
  acceptTitle: "Accetta invito partner",
  acceptReadyHint:
    "Questo link è pronto per essere accettato con l'account Ovumcy Cloud attualmente connesso.",
  acceptSignInHint:
    "Accedi prima al tuo account Ovumcy Cloud, poi accetta questo invito partner su questo dispositivo.",
  acceptActionLabel: "Accetta invito",
  acceptChoiceHint:
    "Accetta questo invito come ospite su questo dispositivo, oppure accedi prima al tuo account Ovumcy Cloud.",
  acceptAsGuestActionLabel: "Accetta come ospite",
  acceptSignInActionLabel: "Accedi per accettare",
  statusInviteIssued: "Link di invito partner creato.",
  statusInviteAccepted: "Invito partner accettato su questo dispositivo.",
  statusInviteRevoked: "Invito partner in sospeso revocato.",
  statusGrantRevoked: "Accesso partner revocato.",
  sharedViewTitle: "Vista condivisa del ciclo",
  sharedViewSubtitle:
    "Questa vista di sola lettura è disponibile solo tramite la condivisione partner di Ovumcy Cloud.",
  sharedViewBackLabel: "Torna all'accesso partner",
  sharedViewLoadingTitle: "Caricamento della vista condivisa",
  sharedViewLoadingSubtitle:
    "La vista partner condivisa viene decifrata su questo dispositivo.",
  sharedViewNotReady:
    "Il proprietario non ha ancora caricato dati condivisi per questo accesso.",
  sharedViewLocked:
    "Questo dispositivo non può aprire la vista condivisa perché manca la chiave di invito.",
  sharedViewSummaryHint:
    "L'accesso di riepilogo mantiene la panoramica condivisa più leggera senza cronologia dettagliata giorno per giorno.",
  sharedViewFullHint:
    "L'accesso completo include il riepilogo condiviso e la cronologia dettagliata giorno per giorno che il proprietario ha consentito.",
  sharedViewGeneratedAtLabel: "Aggiornato",
  sharedViewMetricsTitle: "Riepilogo condiviso",
  sharedViewHistoryTitle: "Cronologia condivisa recente",
  sharedViewHistoryEmpty: "Nessuna cronologia condivisa giorno per giorno è ancora disponibile.",
  sharedViewCycleDayLabel: "Giorno del ciclo",
  sharedViewNextPeriodLabel: "Prossima finestra del ciclo",
  sharedViewLastCycleLabel: "Ultimo ciclo",
  sharedViewAverageCycleLabel: "Ciclo medio",
  sharedViewAveragePeriodLabel: "Durata media del ciclo mestruale",
  sharedViewLoggedDaysLabel: "Giorni registrati",
  sharedViewTopSymptomsLabel: "Sintomi principali",
  sharedViewStaleNotice:
    "I dati condivisi potrebbero essere obsoleti — previsioni nascoste.",
  sharedViewHistoryQualifier: "Mostra gli ultimi 90 giorni.",
  errors: {
    notConnected: "Accedi prima a Ovumcy Cloud.",
    invalidPartnerInvite: "Questo invito partner non è valido.",
    partnerInviteNotFound: "Impossibile trovare questo invito partner.",
    partnerInviteExpired: "Questo invito partner è scaduto.",
    partnerAccessUnavailable:
      "L'accesso partner non è al momento disponibile per questo account Ovumcy Cloud.",
    partnerAccessNotFound: "Impossibile trovare questo record di accesso partner.",
    networkFailed: "Impossibile raggiungere Ovumcy Cloud in questo momento.",
    generic: "Impossibile aggiornare l'accesso partner in questo momento. Riprova.",
  },
  premiumEyebrowLabel: "Premium",
  premiumLockTitle: "Inviti partner",
  guestUpgrade: {
    ctaLabel: "Mantieni il tuo accesso",
    ctaHint:
      "Aggiungi un'email e una password in modo che questo accesso condiviso continui a funzionare anche dopo la scadenza della sessione ospite su questo dispositivo.",
    formTitle: "Mantieni il tuo accesso",
    formHint:
      "Questo trasforma il tuo accesso ospite in un normale account Ovumcy Cloud. Riceverai un codice di recupero monouso — conservalo in un luogo sicuro.",
    emailLabel: "Email",
    emailPlaceholder: "tu@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Inserisci la password",
    submitLabel: "Mantieni l'accesso",
    cancelLabel: "Annulla",
    deviceAuthPrompt:
      "Conferma con la sicurezza del dispositivo per mantenere questo accesso condiviso.",
    successMessage:
      "Il tuo accesso è stato salvato. Salva il codice di recupero qui sotto — non verrà mostrato di nuovo.",
    alreadyUpgradedMessage: "Questo account è già stato aggiornato.",
    revealTitle: "Salva il tuo codice di recupero",
    revealHint:
      "Mostrato solo una volta. Usalo se dovessi dimenticare la password di questo account.",
    revealConfirmLabel: "L'ho salvato",
    nudgeMessage: (days: number) =>
      `Il tuo accesso ospite scade tra ${days} ${days === 1 ? "giorno" : "giorni"} — mantienilo prima che accada.`,
    errors: {
      emailRequired: "L'email è obbligatoria.",
      passwordRequired: "La password è obbligatoria.",
      passwordTooShort: "La password deve contenere almeno 12 caratteri.",
      invalidRegistrationInput: "Usa un'email valida e una password più sicura.",
      emailTaken:
        "Questa email è già registrata. Prova un'altra email oppure accedi da un altro dispositivo.",
      unauthorized: "Questa sessione è scaduta. Chiedi al proprietario un nuovo link di invito.",
      rateLimited: "Troppi tentativi. Attendi un momento prima di riprovare.",
      deviceAuthUnavailable:
        "Imposta un codice o la biometria su questo dispositivo prima di mantenere questo accesso condiviso.",
      deviceAuthFailed:
        "Impossibile confermare la sicurezza del dispositivo in questo momento. Riprova.",
      generic: "Impossibile salvare il tuo accesso in questo momento. Riprova.",
    },
  },
} as const;

const catalogs = {
  en: partnerCopyEn,
  de: partnerCopyDe,
  fr: partnerCopyFr,
  ru: partnerCopyRu,
  es: partnerCopyEs,
  it: partnerCopyIt,
} as const satisfies Record<InterfaceLanguage, unknown>;

export function getPartnerCopy(locale?: string) {
  return catalogs[resolveCopyLanguage(locale) as InterfaceLanguage] ?? partnerCopyEn;
}

export type PartnerCopy = ReturnType<typeof getPartnerCopy>;
