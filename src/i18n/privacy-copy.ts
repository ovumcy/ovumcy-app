import type { InterfaceLanguage } from "../models/profile";

export type PrivacyNoticeSectionCopy = {
  title: string;
  body: string;
};

export type PrivacyNoticeCopy = {
  title: string;
  subtitle: string;
  backLabel: string;
  revisionLabel: string;
  sections: {
    onDevice: PrivacyNoticeSectionCopy;
    noTracking: PrivacyNoticeSectionCopy;
    leavesDevice: PrivacyNoticeSectionCopy;
    exports: PrivacyNoticeSectionCopy;
    rights: PrivacyNoticeSectionCopy;
    retention: PrivacyNoticeSectionCopy;
    predictions: PrivacyNoticeSectionCopy;
    contact: PrivacyNoticeSectionCopy;
  };
  policyLink: {
    title: string;
    hint: string;
    actionLabel: string;
    unavailable: string;
  };
};

const privacyCopyEn: PrivacyNoticeCopy = {
  title: "Privacy notice",
  subtitle:
    "What Ovumcy stores, what never leaves this device, and the choices you control.",
  backLabel: "Back",
  revisionLabel: "Last updated",
  sections: {
    onDevice: {
      title: "Your data stays on this device",
      body: "Cycle history, daily logs, symptoms, and your profile are stored in an encrypted database on this device. The encryption key lives in the device secure store and never leaves it. Tracking, predictions, statistics, and export work with no account and no network connection.",
    },
    noTracking: {
      title: "No tracking, no ads, no profiling",
      body: "Ovumcy contains no analytics, no advertising components, and no hidden telemetry. Nothing about how you use the app is reported anywhere, and your health data is never sold or shared for advertising.",
    },
    leavesDevice: {
      title: "When data leaves this device",
      body: "Only through an optional feature you turn on yourself, and only after this device has encrypted it. Encrypted backup and sync uploads records the server cannot read. An Ovumcy Cloud account holds your login, two-factor settings, subscription state, and partner invitations — never readable health data. Partner sharing creates an encrypted extract for the person you invite, at the access level you choose, and you can revoke it at any time.",
    },
    exports: {
      title: "Exports and files you create",
      body: "CSV, JSON, and doctor-PDF exports are written to a temporary area, handed to the app you pick, and deleted afterwards. Once a file leaves Ovumcy through sharing or saving, it is outside the app's protection — treat it like any other medical document.",
    },
    rights: {
      title: "Your rights",
      body: "You can review and correct every record in the app, export your data in machine-readable CSV or JSON, erase all local data, and delete an Ovumcy Cloud account together with its server-side data. Under the GDPR these are the rights of access, rectification, portability, restriction, and erasure. For anything the in-app controls cannot do, contact us.",
    },
    retention: {
      title: "How long data is kept",
      body: "Local records are kept until you delete them — Ovumcy never removes them on a schedule. If you use Ovumcy Cloud, deleting your account erases the server-side data, and when a subscription lapses the encrypted server copy is purged after a limited retention period.",
    },
    predictions: {
      title: "Predictions",
      body: "Predictions are statistics calculated on this device from the days you logged. They are estimates, never medical advice and never a method of contraception, and they are not used to make automated decisions about you.",
    },
    contact: {
      title: "Who is responsible",
      body: "Ovumcy is developed in the open and released under the AGPL v3. For privacy questions or requests, write to contact@ovumcy.com.",
    },
  },
  policyLink: {
    title: "Full privacy policy",
    hint: "The complete policy is published on the website.",
    actionLabel: "Open ovumcy.com/privacy",
    unavailable:
      "This device cannot open the link right now. Visit ovumcy.com/privacy in a browser.",
  },
};

const privacyCopyDe: PrivacyNoticeCopy = {
  title: "Datenschutzhinweis",
  subtitle:
    "Was Ovumcy speichert, was dieses Gerät nie verlässt und worüber Sie entscheiden.",
  backLabel: "Zurück",
  revisionLabel: "Zuletzt aktualisiert",
  sections: {
    onDevice: {
      title: "Ihre Daten bleiben auf diesem Gerät",
      body: "Zyklusverlauf, Tageseinträge, Symptome und Ihr Profil liegen in einer verschlüsselten Datenbank auf diesem Gerät. Der Schlüssel liegt im sicheren Speicher des Geräts und verlässt ihn nie. Tracking, Prognosen, Statistiken und Export funktionieren ohne Konto und ohne Netzverbindung.",
    },
    noTracking: {
      title: "Kein Tracking, keine Werbung, kein Profiling",
      body: "Ovumcy enthält keine Analyse-Werkzeuge, keine Werbekomponenten und keine verdeckte Telemetrie. Ihre Nutzung der App wird nirgendwohin gemeldet, und Ihre Gesundheitsdaten werden niemals verkauft oder für Werbung weitergegeben.",
    },
    leavesDevice: {
      title: "Wann Daten dieses Gerät verlassen",
      body: "Nur über eine optionale Funktion, die Sie selbst einschalten, und erst nachdem dieses Gerät die Daten verschlüsselt hat. Verschlüsselte Sicherung und Synchronisierung lädt Einträge hoch, die der Server nicht lesen kann. Ein Ovumcy-Cloud-Konto enthält Ihren Login, die Zwei-Faktor-Einstellungen, den Abostatus und Partner-Einladungen — nie lesbare Gesundheitsdaten. Die Partnerfreigabe erzeugt einen verschlüsselten Auszug für die eingeladene Person, auf der von Ihnen gewählten Zugriffsstufe, und Sie können sie jederzeit widerrufen.",
    },
    exports: {
      title: "Exporte und erzeugte Dateien",
      body: "CSV-, JSON- und Arzt-PDF-Exporte werden in einen temporären Bereich geschrieben, an die von Ihnen gewählte App übergeben und danach gelöscht. Sobald eine Datei Ovumcy durch Teilen oder Speichern verlässt, liegt sie außerhalb des Schutzes der App — behandeln Sie sie wie jedes andere medizinische Dokument.",
    },
    rights: {
      title: "Ihre Rechte",
      body: "Sie können jeden Eintrag in der App einsehen und korrigieren, Ihre Daten maschinenlesbar als CSV oder JSON exportieren, alle lokalen Daten löschen und ein Ovumcy-Cloud-Konto samt serverseitiger Daten entfernen. Nach der DSGVO sind das die Rechte auf Auskunft, Berichtigung, Datenübertragbarkeit, Einschränkung und Löschung. Für alles, was die Bedienelemente in der App nicht abdecken, schreiben Sie uns.",
    },
    retention: {
      title: "Wie lange Daten gespeichert bleiben",
      body: "Lokale Einträge bleiben, bis Sie sie löschen — Ovumcy entfernt sie nie automatisch nach Zeitplan. Wenn Sie Ovumcy Cloud nutzen, löscht das Entfernen Ihres Kontos die serverseitigen Daten; läuft ein Abo aus, wird die verschlüsselte Serverkopie nach einer begrenzten Aufbewahrungsfrist gelöscht.",
    },
    predictions: {
      title: "Prognosen",
      body: "Prognosen sind Statistiken, die auf diesem Gerät aus Ihren erfassten Tagen berechnet werden. Sie sind Schätzungen, keine medizinische Beratung und keine Verhütungsmethode, und sie dienen nicht dazu, automatisierte Entscheidungen über Sie zu treffen.",
    },
    contact: {
      title: "Wer verantwortlich ist",
      body: "Ovumcy wird offen entwickelt und unter der AGPL v3 veröffentlicht. Bei Fragen oder Anliegen zum Datenschutz schreiben Sie an contact@ovumcy.com.",
    },
  },
  policyLink: {
    title: "Vollständige Datenschutzerklärung",
    hint: "Die vollständige Erklärung ist auf der Website veröffentlicht.",
    actionLabel: "ovumcy.com/privacy öffnen",
    unavailable:
      "Dieses Gerät kann den Link gerade nicht öffnen. Rufen Sie ovumcy.com/privacy im Browser auf.",
  },
};

const privacyCopyFr: PrivacyNoticeCopy = {
  title: "Avis de confidentialité",
  subtitle:
    "Ce qu'Ovumcy enregistre, ce qui ne quitte jamais cet appareil et ce que vous contrôlez.",
  backLabel: "Retour",
  revisionLabel: "Dernière mise à jour",
  sections: {
    onDevice: {
      title: "Vos données restent sur cet appareil",
      body: "L'historique des cycles, les journaux quotidiens, les symptômes et votre profil sont stockés dans une base de données chiffrée sur cet appareil. La clé de chiffrement réside dans le stockage sécurisé de l'appareil et n'en sort jamais. Le suivi, les prévisions, les statistiques et l'export fonctionnent sans compte ni connexion réseau.",
    },
    noTracking: {
      title: "Aucun pistage, aucune publicité, aucun profilage",
      body: "Ovumcy ne contient ni outils d'analyse, ni composants publicitaires, ni télémétrie cachée. Rien de votre utilisation de l'application n'est transmis, et vos données de santé ne sont jamais vendues ni partagées à des fins publicitaires.",
    },
    leavesDevice: {
      title: "Quand des données quittent cet appareil",
      body: "Uniquement via une fonction optionnelle que vous activez vous-même, et seulement après chiffrement par cet appareil. La sauvegarde et la synchronisation chiffrées envoient des enregistrements que le serveur ne peut pas lire. Un compte Ovumcy Cloud contient votre identifiant, vos réglages de double authentification, l'état de votre abonnement et les invitations de partenaire — jamais de données de santé lisibles. Le partage avec un partenaire crée un extrait chiffré pour la personne invitée, au niveau d'accès que vous choisissez, et vous pouvez le révoquer à tout moment.",
    },
    exports: {
      title: "Exports et fichiers que vous créez",
      body: "Les exports CSV, JSON et le PDF pour le médecin sont écrits dans un espace temporaire, transmis à l'application que vous choisissez, puis supprimés. Dès qu'un fichier quitte Ovumcy par partage ou enregistrement, il échappe à la protection de l'application — traitez-le comme tout autre document médical.",
    },
    rights: {
      title: "Vos droits",
      body: "Vous pouvez consulter et corriger chaque enregistrement dans l'application, exporter vos données en CSV ou JSON lisibles par machine, effacer toutes les données locales et supprimer un compte Ovumcy Cloud avec ses données côté serveur. Le RGPD y correspond par les droits d'accès, de rectification, de portabilité, de limitation et d'effacement. Pour tout ce que les commandes de l'application ne permettent pas, écrivez-nous.",
    },
    retention: {
      title: "Durée de conservation",
      body: "Les enregistrements locaux sont conservés jusqu'à ce que vous les supprimiez — Ovumcy ne les efface jamais selon un calendrier. Avec Ovumcy Cloud, la suppression de votre compte efface les données côté serveur, et lorsqu'un abonnement expire, la copie chiffrée sur le serveur est purgée après une durée de conservation limitée.",
    },
    predictions: {
      title: "Prévisions",
      body: "Les prévisions sont des statistiques calculées sur cet appareil à partir des jours que vous avez enregistrés. Ce sont des estimations, jamais un avis médical ni une méthode de contraception, et elles ne servent pas à prendre des décisions automatisées à votre sujet.",
    },
    contact: {
      title: "Qui est responsable",
      body: "Ovumcy est développé ouvertement et publié sous licence AGPL v3. Pour toute question ou demande relative à la confidentialité, écrivez à contact@ovumcy.com.",
    },
  },
  policyLink: {
    title: "Politique de confidentialité complète",
    hint: "La politique complète est publiée sur le site web.",
    actionLabel: "Ouvrir ovumcy.com/privacy",
    unavailable:
      "Cet appareil ne peut pas ouvrir le lien pour le moment. Consultez ovumcy.com/privacy dans un navigateur.",
  },
};

const privacyCopyRu: PrivacyNoticeCopy = {
  title: "Уведомление о конфиденциальности",
  subtitle:
    "Что Ovumcy хранит, что никогда не покидает это устройство и чем управляете вы.",
  backLabel: "Назад",
  revisionLabel: "Обновлено",
  sections: {
    onDevice: {
      title: "Данные остаются на этом устройстве",
      body: "История циклов, дневные записи, симптомы и профиль хранятся в зашифрованной базе данных на этом устройстве. Ключ шифрования находится в защищённом хранилище устройства и никогда его не покидает. Ведение записей, прогнозы, статистика и экспорт работают без аккаунта и без подключения к сети.",
    },
    noTracking: {
      title: "Ни слежки, ни рекламы, ни профилирования",
      body: "В Ovumcy нет аналитики, рекламных компонентов и скрытой телеметрии. Ничего о том, как вы пользуетесь приложением, никуда не отправляется, а данные о здоровье никогда не продаются и не передаются для рекламы.",
    },
    leavesDevice: {
      title: "Когда данные покидают устройство",
      body: "Только через дополнительную функцию, которую вы включаете сами, и только после того, как устройство их зашифрует. Зашифрованные резервная копия и синхронизация выгружают записи, которые сервер прочитать не может. Аккаунт Ovumcy Cloud хранит логин, настройки двухфакторной защиты, состояние подписки и приглашения партнёра — но никогда читаемые данные о здоровье. Доступ для партнёра создаёт зашифрованную выборку для приглашённого человека на выбранном вами уровне доступа, и его можно отозвать в любой момент.",
    },
    exports: {
      title: "Экспорт и созданные файлы",
      body: "Экспорт в CSV, JSON и PDF для врача записывается во временную область, передаётся выбранному вами приложению и затем удаляется. Как только файл покидает Ovumcy через отправку или сохранение, он вне защиты приложения — обращайтесь с ним как с любым медицинским документом.",
    },
    rights: {
      title: "Ваши права",
      body: "Вы можете просмотреть и исправить любую запись в приложении, выгрузить данные в машиночитаемый CSV или JSON, стереть все локальные данные и удалить аккаунт Ovumcy Cloud вместе с серверными данными. По GDPR это права на доступ, исправление, переносимость, ограничение обработки и удаление. Если встроенных средств недостаточно, напишите нам.",
    },
    retention: {
      title: "Сколько хранятся данные",
      body: "Локальные записи хранятся, пока вы их не удалите, — Ovumcy не стирает их по расписанию. При использовании Ovumcy Cloud удаление аккаунта стирает серверные данные, а после окончания подписки зашифрованная серверная копия удаляется по истечении ограниченного срока хранения.",
    },
    predictions: {
      title: "Прогнозы",
      body: "Прогнозы — это статистика, рассчитанная на этом устройстве по вашим записям. Это оценки, а не медицинская рекомендация и не метод контрацепции, и они не используются для автоматических решений о вас.",
    },
    contact: {
      title: "Кто отвечает за обработку",
      body: "Ovumcy разрабатывается открыто и распространяется под лицензией AGPL v3. По вопросам конфиденциальности пишите на contact@ovumcy.com.",
    },
  },
  policyLink: {
    title: "Полная политика конфиденциальности",
    hint: "Полный текст политики опубликован на сайте.",
    actionLabel: "Открыть ovumcy.com/privacy",
    unavailable:
      "Это устройство сейчас не может открыть ссылку. Откройте ovumcy.com/privacy в браузере.",
  },
};

const privacyCopyEs: PrivacyNoticeCopy = {
  title: "Aviso de privacidad",
  subtitle:
    "Qué guarda Ovumcy, qué nunca sale de este dispositivo y qué decides tú.",
  backLabel: "Atrás",
  revisionLabel: "Última actualización",
  sections: {
    onDevice: {
      title: "Tus datos permanecen en este dispositivo",
      body: "El historial de ciclos, los registros diarios, los síntomas y tu perfil se guardan en una base de datos cifrada en este dispositivo. La clave de cifrado reside en el almacén seguro del dispositivo y nunca sale de él. El seguimiento, las predicciones, las estadísticas y la exportación funcionan sin cuenta y sin conexión a la red.",
    },
    noTracking: {
      title: "Sin rastreo, sin anuncios, sin perfilado",
      body: "Ovumcy no incluye analítica, ni componentes publicitarios, ni telemetría oculta. Nada sobre cómo usas la aplicación se envía a ninguna parte, y tus datos de salud nunca se venden ni se comparten con fines publicitarios.",
    },
    leavesDevice: {
      title: "Cuándo salen datos de este dispositivo",
      body: "Solo mediante una función opcional que actives tú, y solo después de que este dispositivo los cifre. La copia de seguridad y la sincronización cifradas suben registros que el servidor no puede leer. Una cuenta de Ovumcy Cloud guarda tu acceso, la configuración de doble factor, el estado de la suscripción y las invitaciones de pareja, nunca datos de salud legibles. El acceso para tu pareja crea un extracto cifrado para la persona que invitas, con el nivel de acceso que elijas, y puedes revocarlo cuando quieras.",
    },
    exports: {
      title: "Exportaciones y archivos que creas",
      body: "Las exportaciones en CSV, JSON y el PDF para el médico se escriben en un área temporal, se entregan a la aplicación que elijas y después se borran. En cuanto un archivo sale de Ovumcy al compartirlo o guardarlo, queda fuera de la protección de la aplicación: trátalo como cualquier otro documento médico.",
    },
    rights: {
      title: "Tus derechos",
      body: "Puedes consultar y corregir cada registro en la aplicación, exportar tus datos en CSV o JSON legibles por máquina, borrar todos los datos locales y eliminar una cuenta de Ovumcy Cloud junto con sus datos en el servidor. Según el RGPD, se corresponden con los derechos de acceso, rectificación, portabilidad, limitación y supresión. Para lo que los controles de la aplicación no puedan resolver, escríbenos.",
    },
    retention: {
      title: "Cuánto tiempo se conservan los datos",
      body: "Los registros locales se conservan hasta que tú los borres: Ovumcy nunca los elimina de forma programada. Si usas Ovumcy Cloud, eliminar tu cuenta borra los datos del servidor y, cuando caduca una suscripción, la copia cifrada del servidor se purga tras un período de conservación limitado.",
    },
    predictions: {
      title: "Predicciones",
      body: "Las predicciones son estadísticas calculadas en este dispositivo a partir de los días que registras. Son estimaciones, nunca consejo médico ni un método anticonceptivo, y no se usan para tomar decisiones automatizadas sobre ti.",
    },
    contact: {
      title: "Quién es responsable",
      body: "Ovumcy se desarrolla de forma abierta y se publica bajo la licencia AGPL v3. Para preguntas o solicitudes sobre privacidad, escribe a contact@ovumcy.com.",
    },
  },
  policyLink: {
    title: "Política de privacidad completa",
    hint: "La política completa está publicada en el sitio web.",
    actionLabel: "Abrir ovumcy.com/privacy",
    unavailable:
      "Este dispositivo no puede abrir el enlace ahora mismo. Visita ovumcy.com/privacy en un navegador.",
  },
};

const privacyCopyIt: PrivacyNoticeCopy = {
  title: "Informativa sulla privacy",
  subtitle:
    "Cosa conserva Ovumcy, cosa non lascia mai questo dispositivo e cosa decidi tu.",
  backLabel: "Indietro",
  revisionLabel: "Ultimo aggiornamento",
  sections: {
    onDevice: {
      title: "I tuoi dati restano su questo dispositivo",
      body: "Storico dei cicli, registrazioni giornaliere, sintomi e profilo sono conservati in un database cifrato su questo dispositivo. La chiave di cifratura risiede nell'archivio sicuro del dispositivo e non ne esce mai. Registrazione, previsioni, statistiche ed esportazione funzionano senza account e senza connessione di rete.",
    },
    noTracking: {
      title: "Nessun tracciamento, nessuna pubblicità, nessuna profilazione",
      body: "Ovumcy non contiene strumenti di analisi, componenti pubblicitari o telemetria nascosta. Nulla di come usi l'app viene inviato altrove e i tuoi dati sanitari non sono mai venduti né condivisi a fini pubblicitari.",
    },
    leavesDevice: {
      title: "Quando i dati lasciano questo dispositivo",
      body: "Solo tramite una funzione opzionale che attivi tu e solo dopo che questo dispositivo li ha cifrati. Backup e sincronizzazione cifrati caricano dati che il server non può leggere. Un account Ovumcy Cloud contiene le credenziali, le impostazioni a due fattori, lo stato dell'abbonamento e gli inviti per il partner, mai dati sanitari leggibili. La condivisione con il partner crea un estratto cifrato per la persona che inviti, al livello di accesso che scegli, e puoi revocarla in qualsiasi momento.",
    },
    exports: {
      title: "Esportazioni e file che crei",
      body: "Le esportazioni in CSV, JSON e il PDF per il medico vengono scritte in un'area temporanea, consegnate all'app che scegli e poi eliminate. Quando un file esce da Ovumcy tramite condivisione o salvataggio, non è più protetto dall'app: trattalo come qualsiasi altro documento medico.",
    },
    rights: {
      title: "I tuoi diritti",
      body: "Puoi consultare e correggere ogni registrazione nell'app, esportare i dati in CSV o JSON leggibili da una macchina, cancellare tutti i dati locali ed eliminare un account Ovumcy Cloud insieme ai dati sul server. Nel GDPR corrispondono ai diritti di accesso, rettifica, portabilità, limitazione e cancellazione. Per ciò che i comandi dell'app non coprono, scrivici.",
    },
    retention: {
      title: "Per quanto tempo restano i dati",
      body: "Le registrazioni locali restano finché non le elimini: Ovumcy non le rimuove mai in modo programmato. Con Ovumcy Cloud, l'eliminazione dell'account cancella i dati sul server e, alla scadenza di un abbonamento, la copia cifrata sul server viene rimossa dopo un periodo di conservazione limitato.",
    },
    predictions: {
      title: "Previsioni",
      body: "Le previsioni sono statistiche calcolate su questo dispositivo a partire dai giorni che registri. Sono stime, mai un parere medico né un metodo contraccettivo, e non vengono usate per decisioni automatizzate sul tuo conto.",
    },
    contact: {
      title: "Chi è responsabile",
      body: "Ovumcy è sviluppato in modo aperto e distribuito con licenza AGPL v3. Per domande o richieste sulla privacy scrivi a contact@ovumcy.com.",
    },
  },
  policyLink: {
    title: "Informativa sulla privacy completa",
    hint: "L'informativa completa è pubblicata sul sito web.",
    actionLabel: "Apri ovumcy.com/privacy",
    unavailable:
      "Questo dispositivo non riesce ad aprire il link in questo momento. Visita ovumcy.com/privacy da un browser.",
  },
};

const PRIVACY_NOTICE_COPY: Record<InterfaceLanguage, PrivacyNoticeCopy> = {
  en: privacyCopyEn,
  de: privacyCopyDe,
  fr: privacyCopyFr,
  ru: privacyCopyRu,
  es: privacyCopyEs,
  it: privacyCopyIt,
};

export function selectPrivacyNoticeCopy(
  language: InterfaceLanguage,
): PrivacyNoticeCopy {
  return PRIVACY_NOTICE_COPY[language] ?? privacyCopyEn;
}
