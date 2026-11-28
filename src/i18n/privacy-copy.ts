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
    storePurchase: PrivacyNoticeSectionCopy;
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
      body: "Ovumcy contains no analytics, no advertising components, and no hidden telemetry. Ovumcy reports nothing about how you use the app, and your health data is never sold or shared for advertising. One third-party component is disclosed separately: Google Play's billing, described under “Buying through Google Play”.",
    },
    leavesDevice: {
      title: "When data leaves this device",
      body: "Only through an optional feature you turn on yourself, and only after this device has encrypted it. Encrypted backup and sync uploads records the server cannot read. An Ovumcy Cloud account holds your login, two-factor settings, subscription state, and partner invitations — never readable health data. Partner sharing creates an encrypted extract for the person you invite, at the access level you choose, and you can revoke it at any time.",
    },
    storePurchase: {
      title: "Buying through Google Play",
      body: "Pregnancy mode is bought through Google Play. To show the price and to complete or restore a purchase, Google's billing component runs inside the app. It starts only when the app needs to know whether pregnancy mode is unlocked — after you log a positive pregnancy test, or on Android when you open pregnancy mode or its purchase screen, or end a pregnancy with a birth or open pregnancy settings in the weeks after one, when the app checks whether postpartum tracking can start. If you never do, it never runs. It is Google's code: it exchanges purchase details with Google Play and may send Google technical diagnostics about its own operation. Ovumcy passes it none of your health data and keeps no record of the purchase itself.",
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
      body: "Ovumcy is source-available under the PolyForm Noncommercial License 1.0.0. For privacy questions or requests, write to contact@ovumcy.com.",
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
      body: "Ovumcy enthält keine Analyse-Werkzeuge, keine Werbekomponenten und keine verdeckte Telemetrie. Ovumcy meldet nichts über Ihre Nutzung der App, und Ihre Gesundheitsdaten werden niemals verkauft oder für Werbung weitergegeben. Eine Komponente eines Drittanbieters wird gesondert offengelegt: die Abrechnung von Google Play, beschrieben unter „Kauf über Google Play“.",
    },
    leavesDevice: {
      title: "Wann Daten dieses Gerät verlassen",
      body: "Nur über eine optionale Funktion, die Sie selbst einschalten, und erst nachdem dieses Gerät die Daten verschlüsselt hat. Verschlüsselte Sicherung und Synchronisierung lädt Einträge hoch, die der Server nicht lesen kann. Ein Ovumcy-Cloud-Konto enthält Ihren Login, die Zwei-Faktor-Einstellungen, den Abostatus und Partner-Einladungen — nie lesbare Gesundheitsdaten. Die Partnerfreigabe erzeugt einen verschlüsselten Auszug für die eingeladene Person, auf der von Ihnen gewählten Zugriffsstufe, und Sie können sie jederzeit widerrufen.",
    },
    storePurchase: {
      title: "Kauf über Google Play",
      body: "Der Schwangerschaftsmodus wird über Google Play gekauft. Um den Preis anzuzeigen und einen Kauf abzuschließen oder wiederherzustellen, läuft in der App die Abrechnungskomponente von Google. Sie startet nur, wenn die App wissen muss, ob der Schwangerschaftsmodus freigeschaltet ist — nachdem Sie einen positiven Schwangerschaftstest eingetragen haben oder wenn Sie auf Android den Schwangerschaftsmodus oder dessen Kaufbildschirm öffnen oder eine Schwangerschaft mit einer Geburt beenden bzw. in den Wochen danach die Schwangerschaftseinstellungen öffnen, wenn die App prüft, ob das Wochenbett-Tracking starten kann. Tun Sie das nie, läuft sie nie. Es ist Code von Google: Er tauscht Kaufdaten mit Google Play aus und kann technische Diagnosedaten über seinen eigenen Betrieb an Google senden. Ovumcy übergibt ihm keine Ihrer Gesundheitsdaten und speichert selbst nichts über den Kauf.",
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
      body: "Der Quellcode von Ovumcy ist unter der PolyForm Noncommercial License 1.0.0 einsehbar. Bei Fragen oder Anliegen zum Datenschutz schreiben Sie an contact@ovumcy.com.",
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
      body: "Ovumcy ne contient ni outils d'analyse, ni composants publicitaires, ni télémétrie cachée. Ovumcy ne transmet rien de votre utilisation de l'application, et vos données de santé ne sont jamais vendues ni partagées à des fins publicitaires. Un composant tiers est présenté à part : la facturation de Google Play, décrite dans « Achat via Google Play ».",
    },
    leavesDevice: {
      title: "Quand des données quittent cet appareil",
      body: "Uniquement via une fonction optionnelle que vous activez vous-même, et seulement après chiffrement par cet appareil. La sauvegarde et la synchronisation chiffrées envoient des enregistrements que le serveur ne peut pas lire. Un compte Ovumcy Cloud contient votre identifiant, vos réglages de double authentification, l'état de votre abonnement et les invitations de partenaire — jamais de données de santé lisibles. Le partage avec un partenaire crée un extrait chiffré pour la personne invitée, au niveau d'accès que vous choisissez, et vous pouvez le révoquer à tout moment.",
    },
    storePurchase: {
      title: "Achat via Google Play",
      body: "Le mode grossesse s'achète via Google Play. Pour afficher le prix et finaliser ou restaurer un achat, le composant de facturation de Google s'exécute dans l'application. Il ne démarre que lorsque l'application doit savoir si le mode grossesse est débloqué — après l'enregistrement d'un test de grossesse positif, ou sur Android quand vous ouvrez le mode grossesse ou son écran d'achat, ou terminez une grossesse par une naissance ou ouvrez les réglages de grossesse dans les semaines qui suivent, quand l'application vérifie si le suivi post-partum peut commencer. Si vous ne le faites jamais, il ne s'exécute jamais. C'est du code de Google : il échange les détails de l'achat avec Google Play et peut envoyer à Google des diagnostics techniques sur son propre fonctionnement. Ovumcy ne lui transmet aucune de vos données de santé et ne conserve elle-même aucune trace de l'achat.",
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
      body: "Le code source d'Ovumcy est disponible sous la licence PolyForm Noncommercial 1.0.0. Pour toute question ou demande relative à la confidentialité, écrivez à contact@ovumcy.com.",
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
      body: "В Ovumcy нет аналитики, рекламных компонентов и скрытой телеметрии. Ovumcy никуда не отправляет сведений о том, как вы пользуетесь приложением, а данные о здоровье никогда не продаются и не передаются для рекламы. Один сторонний компонент описан отдельно: платёжный компонент Google Play — см. раздел «Покупка через Google Play».",
    },
    leavesDevice: {
      title: "Когда данные покидают устройство",
      body: "Только через дополнительную функцию, которую вы включаете сами, и только после того, как устройство их зашифрует. Зашифрованные резервная копия и синхронизация выгружают записи, которые сервер прочитать не может. Аккаунт Ovumcy Cloud хранит логин, настройки двухфакторной защиты, состояние подписки и приглашения партнёра — но никогда читаемые данные о здоровье. Доступ для партнёра создаёт зашифрованную выборку для приглашённого человека на выбранном вами уровне доступа, и его можно отозвать в любой момент.",
    },
    storePurchase: {
      title: "Покупка через Google Play",
      body: "Режим беременности покупается через Google Play. Чтобы показать цену, провести или восстановить покупку, внутри приложения работает платёжный компонент Google. Он запускается только когда приложению нужно узнать, разблокирован ли режим беременности: после отметки положительного теста на беременность, а на Android — при открытии режима беременности или экрана покупки либо при завершении беременности родами и при открытии настроек беременности в первые недели после них, когда приложение проверяет, можно ли начать отслеживание послеродового периода. Если вы этого не делаете, он не запускается. Это код Google: он обменивается с Google Play данными о покупке и может отправлять в Google техническую диагностику собственной работы. Ovumcy не передаёт ему данных о здоровье и сама не хранит сведений о покупке.",
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
      body: "Исходный код Ovumcy открыт для просмотра и распространяется под лицензией PolyForm Noncommercial License 1.0.0. По вопросам конфиденциальности пишите на contact@ovumcy.com.",
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
      body: "Ovumcy no incluye analítica, ni componentes publicitarios, ni telemetría oculta. Ovumcy no envía a ninguna parte nada sobre cómo usas la aplicación, y tus datos de salud nunca se venden ni se comparten con fines publicitarios. Un componente de terceros se describe aparte: la facturación de Google Play, en «Compra a través de Google Play».",
    },
    leavesDevice: {
      title: "Cuándo salen datos de este dispositivo",
      body: "Solo mediante una función opcional que actives tú, y solo después de que este dispositivo los cifre. La copia de seguridad y la sincronización cifradas suben registros que el servidor no puede leer. Una cuenta de Ovumcy Cloud guarda tu acceso, la configuración de doble factor, el estado de la suscripción y las invitaciones de pareja, nunca datos de salud legibles. El acceso para tu pareja crea un extracto cifrado para la persona que invitas, con el nivel de acceso que elijas, y puedes revocarlo cuando quieras.",
    },
    storePurchase: {
      title: "Compra a través de Google Play",
      body: "El modo embarazo se compra a través de Google Play. Para mostrar el precio y completar o restaurar una compra, el componente de facturación de Google se ejecuta dentro de la aplicación. Solo se inicia cuando la aplicación necesita saber si el modo embarazo está desbloqueado: después de registrar una prueba de embarazo positiva, o en Android al abrir el modo embarazo o su pantalla de compra, o al finalizar un embarazo con un parto o abrir los ajustes del embarazo en las semanas siguientes, cuando la aplicación comprueba si puede empezar el seguimiento posparto. Si nunca lo haces, nunca se ejecuta. Es código de Google: intercambia los datos de la compra con Google Play y puede enviar a Google diagnósticos técnicos sobre su propio funcionamiento. Ovumcy no le entrega ninguno de tus datos de salud ni guarda por su cuenta ningún registro de la compra.",
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
      body: "El código fuente de Ovumcy está disponible bajo la licencia PolyForm Noncommercial 1.0.0. Para preguntas o solicitudes sobre privacidad, escribe a contact@ovumcy.com.",
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
      body: "Ovumcy non contiene strumenti di analisi, componenti pubblicitari o telemetria nascosta. Ovumcy non invia altrove nulla di come usi l'app e i tuoi dati sanitari non sono mai venduti né condivisi a fini pubblicitari. Un componente di terze parti è descritto a parte: la fatturazione di Google Play, in «Acquisto tramite Google Play».",
    },
    leavesDevice: {
      title: "Quando i dati lasciano questo dispositivo",
      body: "Solo tramite una funzione opzionale che attivi tu e solo dopo che questo dispositivo li ha cifrati. Backup e sincronizzazione cifrati caricano dati che il server non può leggere. Un account Ovumcy Cloud contiene le credenziali, le impostazioni a due fattori, lo stato dell'abbonamento e gli inviti per il partner, mai dati sanitari leggibili. La condivisione con il partner crea un estratto cifrato per la persona che inviti, al livello di accesso che scegli, e puoi revocarla in qualsiasi momento.",
    },
    storePurchase: {
      title: "Acquisto tramite Google Play",
      body: "La modalità gravidanza si acquista tramite Google Play. Per mostrare il prezzo e completare o ripristinare un acquisto, il componente di fatturazione di Google viene eseguito all'interno dell'app. Si avvia solo quando l'app deve sapere se la modalità gravidanza è sbloccata: dopo aver registrato un test di gravidanza positivo, oppure su Android quando apri la modalità gravidanza o la sua schermata di acquisto, o concludi una gravidanza con un parto o apri le impostazioni della gravidanza nelle settimane successive, quando l'app verifica se può iniziare il monitoraggio post-partum. Se non lo fai mai, non viene mai eseguito. È codice di Google: scambia i dati dell'acquisto con Google Play e può inviare a Google diagnostica tecnica sul proprio funzionamento. Ovumcy non gli passa nessuno dei tuoi dati sanitari e non conserva alcuna traccia dell'acquisto.",
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
      body: "Il codice sorgente di Ovumcy è disponibile con licenza PolyForm Noncommercial 1.0.0. Per domande o richieste sulla privacy scrivi a contact@ovumcy.com.",
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
