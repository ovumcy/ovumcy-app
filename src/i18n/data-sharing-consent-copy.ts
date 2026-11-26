import type { InterfaceLanguage } from "../models/profile";

export type DataSharingConsentCopy = {
  titles: {
    managedSync: string;
    selfHostedSync: string;
    partnerShare: string;
  };
  intro: {
    sync: string;
    partnerShare: string;
  };
  leavesHeading: string;
  syncItems: {
    backup: string;
    device: string;
    key: string;
    login: string;
  };
  partnerItems: {
    summary: string;
    full: string;
    never: string;
  };
  recipient: {
    managedSync: string;
    selfHostedSync: string;
    partnerShare: string;
  };
  encryption: string;
  withdrawal: {
    sync: string;
    partnerShare: string;
  };
  withdrawControl: {
    title: string;
    givenHeading: string;
    purposes: {
      managedSync: string;
      selfHostedSync: string;
      partnerShare: string;
    };
    stops: string;
    keeps: string;
    revokesPartners: string;
    confirmRevoke: string;
    confirmRevokeLabel: string;
    withdrawLabel: string;
    withdrawn: string;
    failed: string;
    withdrawnAndRevoked: string;
    revokeFailed: string;
  };
  legalBasis: string;
  policyLinkLabel: string;
  policyUnavailable: string;
  agreeLabel: string;
  declineLabel: string;
};

const consentCopyEn: DataSharingConsentCopy = {
  titles: {
    managedSync: "Turn on encrypted sync with Ovumcy Cloud?",
    selfHostedSync: "Turn on encrypted sync with your server?",
    partnerShare: "Share your cycle with a partner?",
  },
  intro: {
    sync: "Sync sends your health data off this device. Nothing is sent until you agree.",
    partnerShare:
      "Partner sharing sends a reduced copy of your cycle data off this device for the person you invite. Nothing is sent until you agree.",
  },
  leavesHeading: "What leaves this device",
  syncItems: {
    backup:
      "An encrypted backup of everything you log, with its size, checksum and version",
    device: "This device's ID and the label you give it",
    key: "Your data key, itself encrypted under your recovery phrase, and a short fingerprint of the phrase",
    login: "Your login; the server keeps only a hash of your password",
  },
  partnerItems: {
    summary: "Summary level: only a cycle summary computed on your device: current cycle day, next-period estimate, average and last cycle length, average period length, number of logged days, plus your age group and cycle settings; no day-by-day entries",
    full: "Full level: your age group, cycle settings and last period start, plus day-by-day entries: period days, flow, mood, ovulation tests, cycle factors, symptoms and notes, and also sexual activity, temperature and cervical mucus unless you hide them or turn their tracking off",
    never:
      "Never shared: pregnancy tests, pregnancy, postpartum and screening data, weight, blood pressure and your crisis-support contact",
  },
  recipient: {
    managedSync:
      "Ovumcy Cloud stores it. We see technical details, never your health data.",
    selfHostedSync:
      "The self-hosted server you set up stores it. Its operator sees technical details, never your health data.",
    partnerShare:
      "Only the person who opens your invite can read it. Ovumcy Cloud stores the copy but cannot read it.",
  },
  encryption:
    "It is end-to-end encrypted on this device before it is sent. Your recovery phrase never leaves the device, so the server cannot decrypt it.",
  withdrawal: {
    sync: "You can withdraw this consent at any time on this screen, or by disconnecting sync or deleting your account.",
    partnerShare:
      "You can withdraw this consent at any time on this screen, or by revoking the partner or deleting your account. Revoking deletes their copy from the server; anything they already downloaded may stay on their device.",
  },
  withdrawControl: {
    title: "Data-sharing consent",
    givenHeading: "You agreed to:",
    purposes: {
      managedSync: "Encrypted sync with Ovumcy Cloud",
      selfHostedSync: "Encrypted sync with your server",
      partnerShare: "Sharing your cycle with a partner",
    },
    stops:
      "Withdrawing it stops new backups and partner updates from leaving this device. A backup, sign-in, recovery or partner invite asks for your consent again first.",
    keeps:
      "Withdrawing does not delete your account or the backup already on the server: they stay until you disconnect sync or delete your account.",
    revokesPartners:
      "If a partner can read your cycle, their access is revoked too, after a confirm: their copy is deleted from the server; anything they already downloaded may stay on their device.",
    confirmRevoke:
      "Withdraw consent and revoke access for these partners? Their copy is deleted from the server.",
    confirmRevokeLabel: "Withdraw and revoke",
    withdrawLabel: "Withdraw consent",
    withdrawn: "Consent withdrawn. Nothing more is sent until you agree again.",
    failed: "Could not withdraw the consent. Try again.",
    withdrawnAndRevoked:
      "Consent withdrawn and partner access revoked. Nothing more is sent until you agree again.",
    revokeFailed:
      "Consent withdrawn, so nothing more is sent. Access could not be revoked for every partner: a partner still listed under “Active partner access” can read the last copy until you revoke them there.",
  },
  legalBasis: "Legal basis: your explicit consent (GDPR Art. 9(2)(a)).",
  policyLinkLabel: "Read the privacy policy",
  policyUnavailable: "Could not open a browser. The policy is at",
  agreeLabel: "I agree",
  declineLabel: "Not now",
};

const consentCopyRu: DataSharingConsentCopy = {
  titles: {
    managedSync: "Включить зашифрованную синхронизацию с Ovumcy Cloud?",
    selfHostedSync: "Включить зашифрованную синхронизацию с вашим сервером?",
    partnerShare: "Поделиться циклом с партнёром?",
  },
  intro: {
    sync: "Синхронизация отправляет ваши данные о здоровье за пределы этого устройства. Ничего не отправляется, пока вы не согласитесь.",
    partnerShare:
      "Доступ для партнёра отправляет сокращённую копию данных о цикле для человека, которого вы пригласите. Ничего не отправляется, пока вы не согласитесь.",
  },
  leavesHeading: "Что покидает устройство",
  syncItems: {
    backup:
      "Зашифрованная резервная копия всех ваших записей с её размером, контрольной суммой и версией",
    device: "Идентификатор этого устройства и название, которое вы ему дали",
    key: "Ваш ключ данных, зашифрованный фразой восстановления, и короткий отпечаток этой фразы",
    login: "Ваш логин; сервер хранит только хеш пароля",
  },
  partnerItems: {
    summary:
      "Краткий уровень: только сводка цикла, посчитанная на устройстве: текущий день цикла, прогноз следующих месячных, средняя и последняя длина цикла, средняя длина месячных, число отмеченных дней, а также возрастная группа и настройки цикла; без записей по дням",
    full: "Полный уровень: возрастная группа, настройки цикла и начало последних месячных, а также записи по дням: дни месячных, выделения, настроение, тесты на овуляцию, факторы цикла, симптомы и заметки, а ещё сексуальная активность, температура и цервикальная слизь, если вы их не скрыли и не выключили их отслеживание",
    never:
      "Никогда не передаются: тесты на беременность, данные о беременности, послеродовом периоде и скринингах, вес, давление и ваш контакт для экстренной поддержки",
  },
  recipient: {
    managedSync:
      "Хранится в Ovumcy Cloud. Мы видим технические сведения, но не ваши данные о здоровье.",
    selfHostedSync:
      "Хранится на вашем собственном сервере. Его оператор видит технические сведения, но не ваши данные о здоровье.",
    partnerShare:
      "Прочитать копию может только тот, кто откроет ваше приглашение. Ovumcy Cloud хранит её, но прочитать не может.",
  },
  encryption:
    "Данные шифруются сквозным шифрованием на этом устройстве до отправки. Фраза восстановления никогда не покидает устройство, поэтому сервер не может их расшифровать.",
  withdrawal: {
    sync: "Вы можете отозвать согласие в любой момент на этом экране, а также отключив синхронизацию или удалив аккаунт.",
    partnerShare:
      "Вы можете отозвать согласие в любой момент на этом экране, а также отозвав доступ партнёра или удалив аккаунт. Отзыв доступа удаляет его копию с сервера; уже загруженное может остаться на его устройстве.",
  },
  withdrawControl: {
    title: "Согласие на передачу данных",
    givenHeading: "Вы дали согласие на:",
    purposes: {
      managedSync: "зашифрованную синхронизацию с Ovumcy Cloud",
      selfHostedSync: "зашифрованную синхронизацию с вашим сервером",
      partnerShare: "доступ партнёра к вашему циклу",
    },
    stops:
      "После отзыва новые резервные копии и обновления для партнёра перестают покидать это устройство. Резервная копия, вход, восстановление доступа или приглашение партнёра сначала снова спросят согласие.",
    keeps:
      "Отзыв не удаляет аккаунт и резервную копию на сервере: они остаются, пока вы не отключите синхронизацию или не удалите аккаунт.",
    revokesPartners:
      "Если у партнёра есть доступ к вашему циклу, он тоже отзывается после подтверждения: копия удаляется с сервера; уже загруженное может остаться на его устройстве.",
    confirmRevoke:
      "Отозвать согласие и доступ этих партнёров? Их копия будет удалена с сервера.",
    confirmRevokeLabel: "Отозвать согласие и доступ",
    withdrawLabel: "Отозвать согласие",
    withdrawn: "Согласие отозвано. Ничего не отправляется, пока вы снова не согласитесь.",
    failed: "Не удалось отозвать согласие. Попробуйте ещё раз.",
    withdrawnAndRevoked:
      "Согласие и доступ партнёров отозваны. Ничего не отправляется, пока вы снова не согласитесь.",
    revokeFailed:
      "Согласие отозвано, новые данные не отправляются. Доступ удалось отозвать не у всех партнёров: партнёр, который остался в списке «Активный доступ партнёров», может читать последнюю копию, пока вы не отзовёте его доступ там.",
  },
  legalBasis: "Правовое основание: ваше явное согласие (GDPR, ст. 9(2)(a)).",
  policyLinkLabel: "Политика конфиденциальности",
  policyUnavailable: "Не удалось открыть браузер. Политика находится по адресу",
  agreeLabel: "Даю согласие",
  declineLabel: "Не сейчас",
};

const consentCopyDe: DataSharingConsentCopy = {
  titles: {
    managedSync: "Verschlüsselte Synchronisierung mit Ovumcy Cloud einschalten?",
    selfHostedSync: "Verschlüsselte Synchronisierung mit Ihrem Server einschalten?",
    partnerShare: "Ihren Zyklus mit einer Partnerperson teilen?",
  },
  intro: {
    sync: "Die Synchronisierung sendet Ihre Gesundheitsdaten von diesem Gerät. Nichts wird gesendet, bevor Sie zustimmen.",
    partnerShare:
      "Die Partnerfreigabe sendet eine reduzierte Kopie Ihrer Zyklusdaten für die eingeladene Person von diesem Gerät. Nichts wird gesendet, bevor Sie zustimmen.",
  },
  leavesHeading: "Was dieses Gerät verlässt",
  syncItems: {
    backup:
      "Eine verschlüsselte Sicherung aller Einträge mit Größe, Prüfsumme und Version",
    device: "Die ID dieses Geräts und die Bezeichnung, die Sie ihm geben",
    key: "Ihr Datenschlüssel, verschlüsselt mit Ihrer Wiederherstellungsphrase, und ein kurzer Fingerabdruck der Phrase",
    login: "Ihr Login; der Server speichert nur einen Hash Ihres Passworts",
  },
  partnerItems: {
    summary:
      "Übersicht: nur eine auf Ihrem Gerät berechnete Zykluszusammenfassung: aktueller Zyklustag, Prognose der nächsten Periode, durchschnittliche und letzte Zykluslänge, durchschnittliche Periodenlänge, Anzahl der erfassten Tage sowie Ihre Altersgruppe und Zykluseinstellungen; keine tagesgenauen Einträge",
    full: "Vollständig: Ihre Altersgruppe, Zykluseinstellungen und der Beginn der letzten Periode sowie tagesgenaue Einträge: Periodentage, Blutungsstärke, Stimmung, Ovulationstests, Zyklusfaktoren, Symptome und Notizen, außerdem sexuelle Aktivität, Temperatur und Zervixschleim, sofern Sie sie nicht ausblenden oder deren Erfassung abschalten",
    never:
      "Nie geteilt: Schwangerschaftstests, Schwangerschafts-, Wochenbett- und Screening-Daten, Gewicht, Blutdruck und Ihr Krisenkontakt",
  },
  recipient: {
    managedSync:
      "Ovumcy Cloud speichert sie. Wir sehen technische Angaben, nie Ihre Gesundheitsdaten.",
    selfHostedSync:
      "Der selbst gehostete Server, den Sie eingerichtet haben, speichert sie. Sein Betreiber sieht technische Angaben, nie Ihre Gesundheitsdaten.",
    partnerShare:
      "Nur die Person, die Ihre Einladung öffnet, kann sie lesen. Ovumcy Cloud speichert die Kopie, kann sie aber nicht lesen.",
  },
  encryption:
    "Alles wird auf diesem Gerät Ende-zu-Ende verschlüsselt, bevor es gesendet wird. Ihre Wiederherstellungsphrase verlässt das Gerät nie, daher kann der Server nichts entschlüsseln.",
  withdrawal: {
    sync: "Sie können diese Einwilligung jederzeit auf diesem Bildschirm widerrufen, außerdem durch Trennen der Synchronisierung oder Löschen Ihres Kontos.",
    partnerShare:
      "Sie können diese Einwilligung jederzeit auf diesem Bildschirm widerrufen, außerdem durch Widerruf der Freigabe oder Löschen Ihres Kontos. Der Widerruf der Freigabe löscht die Kopie vom Server; bereits Heruntergeladenes kann auf dem Gerät der Person bleiben.",
  },
  withdrawControl: {
    title: "Einwilligung zur Datenweitergabe",
    givenHeading: "Sie haben eingewilligt in:",
    purposes: {
      managedSync: "Verschlüsselte Synchronisierung mit Ovumcy Cloud",
      selfHostedSync: "Verschlüsselte Synchronisierung mit Ihrem Server",
      partnerShare: "Teilen Ihres Zyklus mit einer Partnerperson",
    },
    stops:
      "Nach einem Widerruf verlassen keine neuen Sicherungen und keine Aktualisierungen für Ihre Partnerperson mehr dieses Gerät. Vor einer Sicherung, Anmeldung, Wiederherstellung oder Einladung werden Sie erneut um Ihre Einwilligung gebeten.",
    keeps:
      "Ein Widerruf löscht weder Ihr Konto noch die Sicherung auf dem Server: Beide bleiben bestehen, bis Sie die Synchronisierung trennen oder Ihr Konto löschen.",
    revokesPartners:
      "Hat eine Partnerperson Zugriff auf Ihren Zyklus, wird dieser nach einer Bestätigung ebenfalls widerrufen: Die Kopie wird vom Server gelöscht; bereits Heruntergeladenes kann auf ihrem Gerät bleiben.",
    confirmRevoke:
      "Einwilligung und Zugriff dieser Partnerpersonen widerrufen? Ihre Kopie wird vom Server gelöscht.",
    confirmRevokeLabel: "Einwilligung und Zugriff widerrufen",
    withdrawLabel: "Einwilligung widerrufen",
    withdrawn: "Einwilligung widerrufen. Es wird nichts mehr gesendet, bis Sie erneut zustimmen.",
    failed: "Die Einwilligung konnte nicht widerrufen werden. Bitte versuchen Sie es erneut.",
    withdrawnAndRevoked:
      "Einwilligung und Partnerzugriff widerrufen. Es wird nichts mehr gesendet, bis Sie erneut zustimmen.",
    revokeFailed:
      "Einwilligung widerrufen, es wird nichts mehr gesendet. Der Zugriff konnte nicht für alle Partnerpersonen widerrufen werden: Wer unter „Aktive Partnerzugriffe“ noch aufgeführt ist, kann die letzte Kopie lesen, bis Sie den Zugriff dort widerrufen.",
  },
  legalBasis: "Rechtsgrundlage: Ihre ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO).",
  policyLinkLabel: "Datenschutzerklärung lesen",
  policyUnavailable: "Der Browser konnte nicht geöffnet werden. Die Erklärung finden Sie unter",
  agreeLabel: "Ich stimme zu",
  declineLabel: "Nicht jetzt",
};

const consentCopyFr: DataSharingConsentCopy = {
  titles: {
    managedSync: "Activer la synchronisation chiffrée avec Ovumcy Cloud ?",
    selfHostedSync: "Activer la synchronisation chiffrée avec votre serveur ?",
    partnerShare: "Partager votre cycle avec un·e partenaire ?",
  },
  intro: {
    sync: "La synchronisation envoie vos données de santé hors de cet appareil. Rien n'est envoyé avant votre accord.",
    partnerShare:
      "Le partage envoie hors de cet appareil une copie réduite de vos données de cycle pour la personne que vous invitez. Rien n'est envoyé avant votre accord.",
  },
  leavesHeading: "Ce qui quitte cet appareil",
  syncItems: {
    backup:
      "Une sauvegarde chiffrée de tout ce que vous enregistrez, avec sa taille, sa somme de contrôle et sa version",
    device: "L'identifiant de cet appareil et le nom que vous lui donnez",
    key: "Votre clé de données, elle-même chiffrée par votre phrase de récupération, et une courte empreinte de cette phrase",
    login: "Votre identifiant ; le serveur ne conserve qu'un hachage de votre mot de passe",
  },
  partnerItems: {
    summary:
      "Niveau résumé : uniquement un résumé du cycle calculé sur votre appareil : jour actuel du cycle, estimation des prochaines règles, durée moyenne et dernière durée du cycle, durée moyenne des règles, nombre de jours renseignés, ainsi que votre tranche d'âge et vos réglages de cycle ; aucune saisie jour par jour",
    full: "Niveau complet : votre tranche d'âge, vos réglages de cycle et le début des dernières règles, plus les saisies jour par jour : jours de règles, flux, humeur, tests d'ovulation, facteurs de cycle, symptômes et notes, ainsi que l'activité sexuelle, la température et la glaire cervicale si vous ne les masquez pas et n'en désactivez pas le suivi",
    never:
      "Jamais partagés : tests de grossesse, données de grossesse, de post-partum et de dépistage, poids, tension artérielle et votre contact de soutien en cas de crise",
  },
  recipient: {
    managedSync:
      "Ovumcy Cloud la conserve. Nous voyons des détails techniques, jamais vos données de santé.",
    selfHostedSync:
      "Le serveur auto-hébergé que vous avez configuré la conserve. Son opérateur voit des détails techniques, jamais vos données de santé.",
    partnerShare:
      "Seule la personne qui ouvre votre invitation peut la lire. Ovumcy Cloud conserve la copie mais ne peut pas la lire.",
  },
  encryption:
    "Tout est chiffré de bout en bout sur cet appareil avant l'envoi. Votre phrase de récupération ne quitte jamais l'appareil : le serveur ne peut donc rien déchiffrer.",
  withdrawal: {
    sync: "Vous pouvez retirer ce consentement à tout moment sur cet écran, ou en déconnectant la synchronisation ou en supprimant votre compte.",
    partnerShare:
      "Vous pouvez retirer ce consentement à tout moment sur cet écran, ou en révoquant le partage ou en supprimant votre compte. La révocation supprime sa copie du serveur ; ce qui a déjà été téléchargé peut rester sur son appareil.",
  },
  withdrawControl: {
    title: "Consentement au partage des données",
    givenHeading: "Vous avez consenti à :",
    purposes: {
      managedSync: "La synchronisation chiffrée avec Ovumcy Cloud",
      selfHostedSync: "La synchronisation chiffrée avec votre serveur",
      partnerShare: "Le partage de votre cycle avec un·e partenaire",
    },
    stops:
      "Une fois le consentement retiré, les nouvelles sauvegardes et les mises à jour pour votre partenaire ne quittent plus cet appareil. Une sauvegarde, une connexion, une récupération ou une invitation vous redemandera d'abord votre consentement.",
    keeps:
      "Le retrait ne supprime ni votre compte ni la sauvegarde déjà présente sur le serveur : ils restent en place jusqu'à ce que vous déconnectiez la synchronisation ou supprimiez votre compte.",
    revokesPartners:
      "Si un partenaire a accès à votre cycle, cet accès est aussi révoqué après confirmation : sa copie est supprimée du serveur ; ce qu'il a déjà téléchargé peut rester sur son appareil.",
    confirmRevoke:
      "Retirer le consentement et révoquer l'accès de ces partenaires ? Leur copie sera supprimée du serveur.",
    confirmRevokeLabel: "Retirer et révoquer",
    withdrawLabel: "Retirer le consentement",
    withdrawn: "Consentement retiré. Rien d'autre n'est envoyé tant que vous n'acceptez pas à nouveau.",
    failed: "Impossible de retirer le consentement. Réessayez.",
    withdrawnAndRevoked:
      "Consentement retiré et accès des partenaires révoqué. Rien d'autre n'est envoyé tant que vous n'acceptez pas à nouveau.",
    revokeFailed:
      "Consentement retiré : plus rien n'est envoyé. L'accès n'a pas pu être révoqué pour tous les partenaires : un partenaire encore listé dans « Accès partenaires actifs » peut lire la dernière copie jusqu'à ce que vous y révoquiez son accès.",
  },
  legalBasis: "Base légale : votre consentement explicite (RGPD, art. 9, par. 2, a).",
  policyLinkLabel: "Lire la politique de confidentialité",
  policyUnavailable: "Impossible d'ouvrir un navigateur. La politique se trouve à l'adresse",
  agreeLabel: "J'accepte",
  declineLabel: "Pas maintenant",
};

const consentCopyEs: DataSharingConsentCopy = {
  titles: {
    managedSync: "¿Activar la sincronización cifrada con Ovumcy Cloud?",
    selfHostedSync: "¿Activar la sincronización cifrada con tu servidor?",
    partnerShare: "¿Compartir tu ciclo con tu pareja?",
  },
  intro: {
    sync: "La sincronización envía tus datos de salud fuera de este dispositivo. No se envía nada hasta que aceptes.",
    partnerShare:
      "Compartir con tu pareja envía fuera de este dispositivo una copia reducida de tus datos del ciclo para la persona que invites. No se envía nada hasta que aceptes.",
  },
  leavesHeading: "Qué sale de este dispositivo",
  syncItems: {
    backup:
      "Una copia de seguridad cifrada de todo lo que registras, con su tamaño, suma de comprobación y versión",
    device: "El ID de este dispositivo y el nombre que le pongas",
    key: "Tu clave de datos, cifrada a su vez con tu frase de recuperación, y una huella corta de la frase",
    login: "Tu usuario; el servidor solo guarda un hash de tu contraseña",
  },
  partnerItems: {
    summary:
      "Nivel resumen: solo un resumen del ciclo calculado en tu dispositivo: día actual del ciclo, estimación de la próxima regla, duración media y última del ciclo, duración media de la regla, número de días registrados, además de tu grupo de edad y ajustes del ciclo; sin registros día a día",
    full: "Nivel completo: tu grupo de edad, ajustes del ciclo e inicio de la última regla, más los registros día a día: días de regla, flujo, estado de ánimo, pruebas de ovulación, factores del ciclo, síntomas y notas, y también actividad sexual, temperatura y moco cervical si no los ocultas ni desactivas su seguimiento",
    never:
      "Nunca se comparten: pruebas de embarazo, datos de embarazo, posparto y cribado, peso, tensión arterial y tu contacto de apoyo en crisis",
  },
  recipient: {
    managedSync:
      "Ovumcy Cloud la guarda. Vemos datos técnicos, nunca tus datos de salud.",
    selfHostedSync:
      "La guarda el servidor autoalojado que configuraste. Su operador ve datos técnicos, nunca tus datos de salud.",
    partnerShare:
      "Solo la persona que abra tu invitación puede leerla. Ovumcy Cloud guarda la copia, pero no puede leerla.",
  },
  encryption:
    "Todo se cifra de extremo a extremo en este dispositivo antes de enviarse. Tu frase de recuperación nunca sale del dispositivo, así que el servidor no puede descifrarlo.",
  withdrawal: {
    sync: "Puedes retirar este consentimiento en cualquier momento en esta pantalla, o desconectando la sincronización o eliminando tu cuenta.",
    partnerShare:
      "Puedes retirar este consentimiento en cualquier momento en esta pantalla, o revocando el acceso o eliminando tu cuenta. Al revocarlo se borra su copia del servidor; lo que ya haya descargado puede quedar en su dispositivo.",
  },
  withdrawControl: {
    title: "Consentimiento para compartir datos",
    givenHeading: "Diste tu consentimiento para:",
    purposes: {
      managedSync: "La sincronización cifrada con Ovumcy Cloud",
      selfHostedSync: "La sincronización cifrada con tu servidor",
      partnerShare: "Compartir tu ciclo con tu pareja",
    },
    stops:
      "Al retirarlo, las nuevas copias de seguridad y las actualizaciones para tu pareja dejan de salir de este dispositivo. Antes de una copia de seguridad, un inicio de sesión, una recuperación o una invitación, se te volverá a pedir el consentimiento.",
    keeps:
      "Retirarlo no borra tu cuenta ni la copia de seguridad que ya está en el servidor: se mantienen hasta que desconectes la sincronización o elimines tu cuenta.",
    revokesPartners:
      "Si una pareja tiene acceso a tu ciclo, también se revoca tras una confirmación: su copia se borra del servidor; lo que ya haya descargado puede quedar en su dispositivo.",
    confirmRevoke:
      "¿Retirar el consentimiento y revocar el acceso de estas parejas? Su copia se borrará del servidor.",
    confirmRevokeLabel: "Retirar y revocar",
    withdrawLabel: "Retirar el consentimiento",
    withdrawn: "Consentimiento retirado. No se envía nada más hasta que vuelvas a aceptar.",
    failed: "No se pudo retirar el consentimiento. Inténtalo de nuevo.",
    withdrawnAndRevoked:
      "Consentimiento retirado y acceso de pareja revocado. No se envía nada más hasta que vuelvas a aceptar.",
    revokeFailed:
      "Consentimiento retirado: ya no se envía nada. No se pudo revocar el acceso de todas las parejas: quien siga en «Accesos de pareja activos» puede leer la última copia hasta que revoques ahí su acceso.",
  },
  legalBasis: "Base jurídica: tu consentimiento explícito (RGPD, art. 9.2.a).",
  policyLinkLabel: "Leer la política de privacidad",
  policyUnavailable: "No se pudo abrir un navegador. La política está en",
  agreeLabel: "Acepto",
  declineLabel: "Ahora no",
};

const consentCopyIt: DataSharingConsentCopy = {
  titles: {
    managedSync: "Attivare la sincronizzazione cifrata con Ovumcy Cloud?",
    selfHostedSync: "Attivare la sincronizzazione cifrata con il tuo server?",
    partnerShare: "Condividere il tuo ciclo con il partner?",
  },
  intro: {
    sync: "La sincronizzazione invia i tuoi dati sanitari fuori da questo dispositivo. Non viene inviato nulla finché non accetti.",
    partnerShare:
      "La condivisione invia fuori da questo dispositivo una copia ridotta dei dati del ciclo per la persona che inviti. Non viene inviato nulla finché non accetti.",
  },
  leavesHeading: "Cosa lascia questo dispositivo",
  syncItems: {
    backup:
      "Un backup cifrato di tutto ciò che registri, con dimensione, checksum e versione",
    device: "L'ID di questo dispositivo e il nome che gli assegni",
    key: "La tua chiave dei dati, a sua volta cifrata con la frase di recupero, e una breve impronta della frase",
    login: "Il tuo login; il server conserva solo un hash della password",
  },
  partnerItems: {
    summary:
      "Livello riepilogo: solo un riepilogo del ciclo calcolato sul tuo dispositivo: giorno attuale del ciclo, stima delle prossime mestruazioni, durata media e ultima del ciclo, durata media delle mestruazioni, numero di giorni registrati, oltre alla tua fascia d'età e alle impostazioni del ciclo; nessuna registrazione giorno per giorno",
    full: "Livello completo: la tua fascia d'età, le impostazioni del ciclo e l'inizio delle ultime mestruazioni, più le registrazioni giorno per giorno: giorni di mestruazione, flusso, umore, test di ovulazione, fattori del ciclo, sintomi e note, oltre ad attività sessuale, temperatura e muco cervicale se non li nascondi e non ne disattivi il monitoraggio",
    never:
      "Mai condivisi: test di gravidanza, dati su gravidanza, post-partum e screening, peso, pressione arteriosa e il tuo contatto di supporto in caso di crisi",
  },
  recipient: {
    managedSync:
      "Ovumcy Cloud lo conserva. Vediamo dettagli tecnici, mai i tuoi dati sanitari.",
    selfHostedSync:
      "Lo conserva il server self-hosted che hai configurato. Il suo gestore vede dettagli tecnici, mai i tuoi dati sanitari.",
    partnerShare:
      "Solo chi apre il tuo invito può leggerla. Ovumcy Cloud conserva la copia ma non può leggerla.",
  },
  encryption:
    "Tutto viene cifrato end-to-end su questo dispositivo prima dell'invio. La frase di recupero non lascia mai il dispositivo, quindi il server non può decifrare nulla.",
  withdrawal: {
    sync: "Puoi revocare questo consenso in qualsiasi momento da questa schermata, oppure scollegando la sincronizzazione o eliminando l'account.",
    partnerShare:
      "Puoi revocare questo consenso in qualsiasi momento da questa schermata, oppure revocando l'accesso o eliminando l'account. La revoca dell'accesso cancella la sua copia dal server; ciò che ha già scaricato può restare sul suo dispositivo.",
  },
  withdrawControl: {
    title: "Consenso alla condivisione dei dati",
    givenHeading: "Hai dato il consenso a:",
    purposes: {
      managedSync: "Sincronizzazione cifrata con Ovumcy Cloud",
      selfHostedSync: "Sincronizzazione cifrata con il tuo server",
      partnerShare: "Condivisione del tuo ciclo con il partner",
    },
    stops:
      "Dopo la revoca, i nuovi backup e gli aggiornamenti per il partner non lasciano più questo dispositivo. Prima di un backup, un accesso, un recupero o un invito, ti verrà chiesto di nuovo il consenso.",
    keeps:
      "La revoca non cancella l'account né il backup già sul server: restano finché non scolleghi la sincronizzazione o elimini l'account.",
    revokesPartners:
      "Se un partner ha accesso al tuo ciclo, anche questo accesso viene revocato dopo una conferma: la sua copia viene cancellata dal server; ciò che ha già scaricato può restare sul suo dispositivo.",
    confirmRevoke:
      "Revocare il consenso e l'accesso di questi partner? La loro copia verrà cancellata dal server.",
    confirmRevokeLabel: "Revoca consenso e accesso",
    withdrawLabel: "Revoca il consenso",
    withdrawn: "Consenso revocato. Non viene inviato altro finché non accetti di nuovo.",
    failed: "Impossibile revocare il consenso. Riprova.",
    withdrawnAndRevoked:
      "Consenso e accesso dei partner revocati. Non viene inviato altro finché non accetti di nuovo.",
    revokeFailed:
      "Consenso revocato: non viene inviato altro. Non è stato possibile revocare l'accesso di tutti i partner: chi è ancora elencato in «Accessi partner attivi» può leggere l'ultima copia finché non revochi lì il suo accesso.",
  },
  legalBasis: "Base giuridica: il tuo consenso esplicito (art. 9, par. 2, lett. a GDPR).",
  policyLinkLabel: "Leggi l'informativa sulla privacy",
  policyUnavailable: "Impossibile aprire un browser. L'informativa si trova all'indirizzo",
  agreeLabel: "Accetto",
  declineLabel: "Non ora",
};

const DATA_SHARING_CONSENT_COPY: Record<InterfaceLanguage, DataSharingConsentCopy> = {
  en: consentCopyEn,
  ru: consentCopyRu,
  de: consentCopyDe,
  fr: consentCopyFr,
  es: consentCopyEs,
  it: consentCopyIt,
};

export function selectDataSharingConsentCopy(
  language: InterfaceLanguage,
): DataSharingConsentCopy {
  return DATA_SHARING_CONSENT_COPY[language];
}
