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
    summary: "Summary level: period days, cycle starts and uncertainty markers only",
    full: "Full level: also flow, mood, ovulation tests, cycle factors, symptoms and notes, plus sexual activity, temperature and cervical mucus unless you hide them",
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
    sync: "You can withdraw this consent at any time by disconnecting sync or deleting your account.",
    partnerShare:
      "You can withdraw this consent at any time by revoking the partner or deleting your account. Revoking deletes their copy from the server; anything they already downloaded may stay on their device.",
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
      "Краткий уровень: только дни месячных, начала циклов и отметки неопределённости",
    full: "Полный уровень: также выделения, настроение, тесты на овуляцию, факторы цикла, симптомы и заметки, а ещё сексуальная активность, температура и цервикальная слизь, если вы их не скрыли",
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
    sync: "Вы можете отозвать согласие в любой момент: отключите синхронизацию или удалите аккаунт.",
    partnerShare:
      "Вы можете отозвать согласие в любой момент: отзовите доступ партнёра или удалите аккаунт. Отзыв удаляет его копию с сервера; уже загруженное может остаться на его устройстве.",
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
      "Übersicht: nur Periodentage, Zyklusbeginne und Unsicherheitsmarkierungen",
    full: "Vollständig: zusätzlich Blutungsstärke, Stimmung, Ovulationstests, Zyklusfaktoren, Symptome und Notizen sowie sexuelle Aktivität, Temperatur und Zervixschleim, sofern Sie sie nicht ausblenden",
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
    sync: "Sie können diese Einwilligung jederzeit widerrufen, indem Sie die Synchronisierung trennen oder Ihr Konto löschen.",
    partnerShare:
      "Sie können diese Einwilligung jederzeit widerrufen, indem Sie die Freigabe widerrufen oder Ihr Konto löschen. Der Widerruf löscht die Kopie vom Server; bereits Heruntergeladenes kann auf dem Gerät der Person bleiben.",
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
      "Niveau résumé : uniquement les jours de règles, les débuts de cycle et les marqueurs d'incertitude",
    full: "Niveau complet : aussi le flux, l'humeur, les tests d'ovulation, les facteurs de cycle, les symptômes et les notes, ainsi que l'activité sexuelle, la température et la glaire cervicale si vous ne les masquez pas",
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
    sync: "Vous pouvez retirer ce consentement à tout moment en déconnectant la synchronisation ou en supprimant votre compte.",
    partnerShare:
      "Vous pouvez retirer ce consentement à tout moment en révoquant le partage ou en supprimant votre compte. La révocation supprime sa copie du serveur ; ce qui a déjà été téléchargé peut rester sur son appareil.",
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
      "Nivel resumen: solo días de regla, inicios de ciclo y marcas de incertidumbre",
    full: "Nivel completo: además flujo, estado de ánimo, pruebas de ovulación, factores del ciclo, síntomas y notas, y también actividad sexual, temperatura y moco cervical si no los ocultas",
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
    sync: "Puedes retirar este consentimiento en cualquier momento desconectando la sincronización o eliminando tu cuenta.",
    partnerShare:
      "Puedes retirar este consentimiento en cualquier momento revocando el acceso o eliminando tu cuenta. Al revocarlo se borra su copia del servidor; lo que ya haya descargado puede quedar en su dispositivo.",
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
      "Livello riepilogo: solo giorni di mestruazione, inizi del ciclo e indicatori di incertezza",
    full: "Livello completo: anche flusso, umore, test di ovulazione, fattori del ciclo, sintomi e note, oltre ad attività sessuale, temperatura e muco cervicale se non li nascondi",
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
    sync: "Puoi revocare questo consenso in qualsiasi momento scollegando la sincronizzazione o eliminando l'account.",
    partnerShare:
      "Puoi revocare questo consenso in qualsiasi momento revocando l'accesso o eliminando l'account. La revoca cancella la sua copia dal server; ciò che ha già scaricato può restare sul suo dispositivo.",
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
  return DATA_SHARING_CONSENT_COPY[language] ?? consentCopyEn;
}
