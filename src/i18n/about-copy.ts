import type { InterfaceLanguage } from "../models/profile";
import { resolveCopyLanguage } from "./runtime";

type AboutSectionCopy = {
  title: string;
  body: string;
};

export type AboutCopy = {
  title: string;
  subtitle: string;
  backLabel: string;
  hubRow: {
    title: string;
    description: string;
  };
  version: {
    title: string;
    /** `%s` is replaced with the app version. */
    value: string;
    unknown: string;
    hint: string;
  };
  license: AboutSectionCopy;
  fonts: AboutSectionCopy & {
    licenseTextTitle: string;
  };
  components: AboutSectionCopy;
};

const aboutCopyEn: AboutCopy = {
  title: "About Ovumcy",
  subtitle: "Version, licence, and the third-party work this app includes.",
  backLabel: "Back",
  hubRow: {
    title: "About Ovumcy",
    description: "Version, licence and third-party notices",
  },
  version: {
    title: "Version",
    value: "Ovumcy %s",
    unknown: "Ovumcy (version unavailable)",
    hint: "Mention the version when you write to contact@ovumcy.com about a problem.",
  },
  license: {
    title: "Licence",
    body: "Ovumcy is source-available under the PolyForm Noncommercial License 1.0.0: you may use, study, change and share it for any noncommercial purpose. The source code and the full licence text are at github.com/ovumcy/ovumcy-app.",
  },
  fonts: {
    title: "Font in the doctor PDF",
    body: "The doctor PDF is set in DejaVu Sans Condensed. Fonts © 2003 Bitstream, Inc.; glyphs imported from Arev © 2006 Tavmjong Bah; DejaVu changes are in the public domain. Bitstream Vera is a trademark of Bitstream, Inc. Used unmodified under the licence below.",
    licenseTextTitle: "Font licence (original English text)",
  },
  components: {
    title: "Open-source components",
    body: "Ovumcy is built with React Native, Expo and other open-source packages, each under its own licence (mostly MIT, Apache 2.0 and BSD). Attributions those licences require are listed in NOTICE.md in the source repository.",
  },
};

const aboutCopyDe: AboutCopy = {
  title: "Über Ovumcy",
  subtitle: "Version, Lizenz und die Werke Dritter, die diese App enthält.",
  backLabel: "Zurück",
  hubRow: {
    title: "Über Ovumcy",
    description: "Version, Lizenz und Hinweise zu Drittanbietern",
  },
  version: {
    title: "Version",
    value: "Ovumcy %s",
    unknown: "Ovumcy (Version nicht verfügbar)",
    hint: "Nennen Sie die Version, wenn Sie wegen eines Problems an contact@ovumcy.com schreiben.",
  },
  license: {
    title: "Lizenz",
    body: "Der Quellcode von Ovumcy ist unter der PolyForm Noncommercial License 1.0.0 verfügbar: Sie dürfen die App für jeden nicht kommerziellen Zweck nutzen, untersuchen, ändern und weitergeben. Quellcode und vollständiger Lizenztext: github.com/ovumcy/ovumcy-app.",
  },
  fonts: {
    title: "Schrift im Arzt-PDF",
    body: "Das Arzt-PDF ist in DejaVu Sans Condensed gesetzt. Schriften © 2003 Bitstream, Inc.; aus Arev übernommene Glyphen © 2006 Tavmjong Bah; die Änderungen von DejaVu sind gemeinfrei. Bitstream Vera ist eine Marke von Bitstream, Inc. Unverändert verwendet unter der folgenden Lizenz.",
    licenseTextTitle: "Schriftlizenz (englischer Originaltext)",
  },
  components: {
    title: "Open-Source-Komponenten",
    body: "Ovumcy ist mit React Native, Expo und weiteren Open-Source-Paketen gebaut, jedes unter seiner eigenen Lizenz (überwiegend MIT, Apache 2.0 und BSD). Die von diesen Lizenzen verlangten Hinweise stehen in NOTICE.md im Quellcode-Repository.",
  },
};

const aboutCopyFr: AboutCopy = {
  title: "À propos d'Ovumcy",
  subtitle: "Version, licence et œuvres de tiers incluses dans cette application.",
  backLabel: "Retour",
  hubRow: {
    title: "À propos d'Ovumcy",
    description: "Version, licence et mentions de tiers",
  },
  version: {
    title: "Version",
    value: "Ovumcy %s",
    unknown: "Ovumcy (version indisponible)",
    hint: "Indiquez la version lorsque vous écrivez à contact@ovumcy.com au sujet d'un problème.",
  },
  license: {
    title: "Licence",
    body: "Le code source d'Ovumcy est disponible sous la licence PolyForm Noncommercial 1.0.0 : vous pouvez l'utiliser, l'étudier, le modifier et le partager à toute fin non commerciale. Code source et texte complet de la licence : github.com/ovumcy/ovumcy-app.",
  },
  fonts: {
    title: "Police du PDF pour le médecin",
    body: "Le PDF pour le médecin est composé en DejaVu Sans Condensed. Polices © 2003 Bitstream, Inc. ; glyphes repris d'Arev © 2006 Tavmjong Bah ; les modifications de DejaVu sont dans le domaine public. Bitstream Vera est une marque de Bitstream, Inc. Utilisée sans modification sous la licence ci-dessous.",
    licenseTextTitle: "Licence de la police (texte original en anglais)",
  },
  components: {
    title: "Composants open source",
    body: "Ovumcy est construit avec React Native, Expo et d'autres paquets open source, chacun sous sa propre licence (surtout MIT, Apache 2.0 et BSD). Les mentions exigées par ces licences figurent dans NOTICE.md, dans le dépôt du code source.",
  },
};

const aboutCopyRu: AboutCopy = {
  title: "Об Ovumcy",
  subtitle: "Версия, лицензия и сторонние материалы в этом приложении.",
  backLabel: "Назад",
  hubRow: {
    title: "Об Ovumcy",
    description: "Версия, лицензия и сторонние компоненты",
  },
  version: {
    title: "Версия",
    value: "Ovumcy %s",
    unknown: "Ovumcy (версия недоступна)",
    hint: "Укажите версию, когда пишете о проблеме на contact@ovumcy.com.",
  },
  license: {
    title: "Лицензия",
    body: "Исходный код Ovumcy открыт по лицензии PolyForm Noncommercial 1.0.0: приложение можно использовать, изучать, изменять и распространять в любых некоммерческих целях. Исходный код и полный текст лицензии: github.com/ovumcy/ovumcy-app.",
  },
  fonts: {
    title: "Шрифт в PDF для врача",
    body: "PDF для врача набран шрифтом DejaVu Sans Condensed. Шрифты © 2003 Bitstream, Inc.; глифы из Arev © 2006 Tavmjong Bah; изменения DejaVu переданы в общественное достояние. Bitstream Vera — товарный знак Bitstream, Inc. Используется без изменений по лицензии ниже.",
    licenseTextTitle: "Лицензия шрифта (оригинал на английском)",
  },
  components: {
    title: "Компоненты с открытым кодом",
    body: "Ovumcy построен на React Native, Expo и других пакетах с открытым кодом, у каждого своя лицензия (в основном MIT, Apache 2.0 и BSD). Уведомления, которых требуют эти лицензии, перечислены в NOTICE.md в репозитории исходного кода.",
  },
};

const aboutCopyEs: AboutCopy = {
  title: "Acerca de Ovumcy",
  subtitle: "Versión, licencia y el trabajo de terceros que incluye esta aplicación.",
  backLabel: "Atrás",
  hubRow: {
    title: "Acerca de Ovumcy",
    description: "Versión, licencia y avisos de terceros",
  },
  version: {
    title: "Versión",
    value: "Ovumcy %s",
    unknown: "Ovumcy (versión no disponible)",
    hint: "Indica la versión cuando escribas a contact@ovumcy.com por un problema.",
  },
  license: {
    title: "Licencia",
    body: "El código fuente de Ovumcy está disponible bajo la licencia PolyForm Noncommercial 1.0.0: puedes usarlo, estudiarlo, modificarlo y compartirlo con cualquier fin no comercial. Código fuente y texto completo de la licencia: github.com/ovumcy/ovumcy-app.",
  },
  fonts: {
    title: "Fuente del PDF para el médico",
    body: "El PDF para el médico usa la fuente DejaVu Sans Condensed. Fuentes © 2003 Bitstream, Inc.; glifos tomados de Arev © 2006 Tavmjong Bah; los cambios de DejaVu son de dominio público. Bitstream Vera es una marca de Bitstream, Inc. Se usa sin modificar bajo la licencia que sigue.",
    licenseTextTitle: "Licencia de la fuente (texto original en inglés)",
  },
  components: {
    title: "Componentes de código abierto",
    body: "Ovumcy está hecho con React Native, Expo y otros paquetes de código abierto, cada uno con su propia licencia (sobre todo MIT, Apache 2.0 y BSD). Los avisos que exigen esas licencias figuran en NOTICE.md, en el repositorio del código fuente.",
  },
};

const aboutCopyIt: AboutCopy = {
  title: "Informazioni su Ovumcy",
  subtitle: "Versione, licenza e opere di terzi incluse in questa app.",
  backLabel: "Indietro",
  hubRow: {
    title: "Informazioni su Ovumcy",
    description: "Versione, licenza e avvisi di terze parti",
  },
  version: {
    title: "Versione",
    value: "Ovumcy %s",
    unknown: "Ovumcy (versione non disponibile)",
    hint: "Indica la versione quando scrivi a contact@ovumcy.com per un problema.",
  },
  license: {
    title: "Licenza",
    body: "Il codice sorgente di Ovumcy è disponibile con licenza PolyForm Noncommercial 1.0.0: puoi usarlo, studiarlo, modificarlo e condividerlo per qualsiasi scopo non commerciale. Codice sorgente e testo completo della licenza: github.com/ovumcy/ovumcy-app.",
  },
  fonts: {
    title: "Carattere del PDF per il medico",
    body: "Il PDF per il medico è composto in DejaVu Sans Condensed. Caratteri © 2003 Bitstream, Inc.; glifi importati da Arev © 2006 Tavmjong Bah; le modifiche di DejaVu sono di pubblico dominio. Bitstream Vera è un marchio di Bitstream, Inc. Usato senza modifiche con la licenza riportata sotto.",
    licenseTextTitle: "Licenza del carattere (testo originale in inglese)",
  },
  components: {
    title: "Componenti open source",
    body: "Ovumcy è realizzata con React Native, Expo e altri pacchetti open source, ciascuno con la propria licenza (per lo più MIT, Apache 2.0 e BSD). Gli avvisi richiesti da queste licenze sono elencati in NOTICE.md nel repository del codice sorgente.",
  },
};

const ABOUT_COPY: Record<InterfaceLanguage, AboutCopy> = {
  en: aboutCopyEn,
  de: aboutCopyDe,
  fr: aboutCopyFr,
  ru: aboutCopyRu,
  es: aboutCopyEs,
  it: aboutCopyIt,
};

export function selectAboutCopy(language: string | null | undefined): AboutCopy {
  return ABOUT_COPY[resolveCopyLanguage(language)];
}
