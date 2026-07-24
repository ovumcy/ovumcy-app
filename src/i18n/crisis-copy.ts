import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// Crisis-support copy — the epic's hard-safety surface. Kept in its
// own small catalog (not folded into screening/postpartum) so the block stays
// importable by any hosting surface later. HARD RULE: crisis-support content is
// NEVER premium-gated and never depends on plan state — it renders wherever its
// host renders, including read-only lapse states. Nothing here reads billing.
//
// Tone: calm and direct, education register, NO exclamation marks (mirrors the
// screening/red-flag tone invariant). The fixed guidance is the same wherever
// the CrisisSupportCard appears; only a personal contact the owner sets varies.
// The personal contact strings are the owner's private safety data — they live
// only on-device (encrypted) and never leave it via this block.
//
// en + ru are primary and reviewed against the tone invariant; de/fr/es/it are
// best-effort translations pending a native-speaker review before public
// launch, same status as every other pregnancy/postpartum catalog.

const crisisCopyEn = {
  title: "If you need support now",
  guidance:
    "If you're having thoughts of harming yourself, or you feel you might be in danger, you deserve immediate support. Contact your midwife, doctor, or health visitor — or your local emergency services if you're in immediate danger.",
  // Plain-text display of a saved personal contact. The phone is shown as text
  // (the app has no tel: link-out primitive yet); tapping does not dial.
  contactLine: (name: string, phone: string) =>
    `Your support contact: ${name} — ${phone}`,
  editAffordance: "Add/change a personal support contact",
  privacyNote: "Stored only on this device, encrypted.",
  form: {
    nameLabel: "Name",
    namePlaceholder: "Their name",
    phoneLabel: "Phone",
    phonePlaceholder: "Phone number",
    save: "Save contact",
    cancel: "Cancel",
  },
  // The quiet "Support resources" row on the postpartum dashboard that expands
  // in place to reveal this block plus the mental-health red-flag context.
  supportResources: {
    rowLabel: "Support resources",
    expandLabel: "Show support resources",
    collapseLabel: "Hide support resources",
  },
} as const;

type CrisisCopy = WidenLiteral<typeof crisisCopyEn>;

const crisisCopyRu: CrisisCopy = {
  title: "Если вам нужна поддержка сейчас",
  guidance:
    "Если у вас есть мысли причинить себе вред или вы чувствуете, что можете быть в опасности, вы заслуживаете немедленной поддержки. Обратитесь к своей акушерке, врачу или патронажной сестре — или в местную экстренную службу, если вам угрожает непосредственная опасность.",
  contactLine: (name: string, phone: string) =>
    `Ваш контакт для поддержки: ${name} — ${phone}`,
  editAffordance: "Добавить или изменить личный контакт поддержки",
  privacyNote: "Хранится только на этом устройстве, в зашифрованном виде.",
  form: {
    nameLabel: "Имя",
    namePlaceholder: "Имя человека",
    phoneLabel: "Телефон",
    phonePlaceholder: "Номер телефона",
    save: "Сохранить контакт",
    cancel: "Отмена",
  },
  supportResources: {
    rowLabel: "Ресурсы поддержки",
    expandLabel: "Показать ресурсы поддержки",
    collapseLabel: "Скрыть ресурсы поддержки",
  },
};

const crisisCopyDe: CrisisCopy = {
  title: "Wenn Sie jetzt Unterstützung brauchen",
  guidance:
    "Wenn Sie Gedanken haben, sich etwas anzutun, oder das Gefühl haben, in Gefahr zu sein, verdienen Sie sofortige Unterstützung. Wenden Sie sich an Ihre Hebamme, Ihre Ärztin oder Ihren Arzt oder Ihre Nachsorgehebamme — oder an den örtlichen Notdienst, wenn Sie in unmittelbarer Gefahr sind.",
  contactLine: (name: string, phone: string) =>
    `Ihr Unterstützungskontakt: ${name} — ${phone}`,
  editAffordance: "Persönlichen Unterstützungskontakt hinzufügen oder ändern",
  privacyNote: "Nur auf diesem Gerät gespeichert, verschlüsselt.",
  form: {
    nameLabel: "Name",
    namePlaceholder: "Name der Person",
    phoneLabel: "Telefon",
    phonePlaceholder: "Telefonnummer",
    save: "Kontakt speichern",
    cancel: "Abbrechen",
  },
  supportResources: {
    rowLabel: "Unterstützungsangebote",
    expandLabel: "Unterstützungsangebote anzeigen",
    collapseLabel: "Unterstützungsangebote ausblenden",
  },
};

const crisisCopyFr: CrisisCopy = {
  title: "Si vous avez besoin de soutien maintenant",
  guidance:
    "Si vous avez des pensées de vous faire du mal, ou si vous sentez que vous pourriez être en danger, vous méritez un soutien immédiat. Contactez votre sage-femme, votre médecin ou votre professionnel de santé — ou les services d'urgence locaux si vous êtes en danger immédiat.",
  contactLine: (name: string, phone: string) =>
    `Votre contact de soutien : ${name} — ${phone}`,
  editAffordance: "Ajouter ou modifier un contact de soutien personnel",
  privacyNote: "Stocké uniquement sur cet appareil, chiffré.",
  form: {
    nameLabel: "Nom",
    namePlaceholder: "Son nom",
    phoneLabel: "Téléphone",
    phonePlaceholder: "Numéro de téléphone",
    save: "Enregistrer le contact",
    cancel: "Annuler",
  },
  supportResources: {
    rowLabel: "Ressources de soutien",
    expandLabel: "Afficher les ressources de soutien",
    collapseLabel: "Masquer les ressources de soutien",
  },
};

const crisisCopyEs: CrisisCopy = {
  title: "Si necesitas apoyo ahora",
  guidance:
    "Si tienes pensamientos de hacerte daño, o sientes que podrías estar en peligro, mereces apoyo inmediato. Contacta con tu matrona, tu médico o tu profesional de salud — o con los servicios de emergencia locales si estás en peligro inmediato.",
  contactLine: (name: string, phone: string) =>
    `Tu contacto de apoyo: ${name} — ${phone}`,
  editAffordance: "Añadir o cambiar un contacto de apoyo personal",
  privacyNote: "Se guarda solo en este dispositivo, cifrado.",
  form: {
    nameLabel: "Nombre",
    namePlaceholder: "Su nombre",
    phoneLabel: "Teléfono",
    phonePlaceholder: "Número de teléfono",
    save: "Guardar contacto",
    cancel: "Cancelar",
  },
  supportResources: {
    rowLabel: "Recursos de apoyo",
    expandLabel: "Mostrar recursos de apoyo",
    collapseLabel: "Ocultar recursos de apoyo",
  },
};

const crisisCopyIt: CrisisCopy = {
  title: "Se hai bisogno di supporto adesso",
  guidance:
    "Se hai pensieri di farti del male, o senti di poter essere in pericolo, meriti supporto immediato. Contatta la tua ostetrica, il tuo medico o il tuo professionista sanitario — o i servizi di emergenza locali se sei in pericolo immediato.",
  contactLine: (name: string, phone: string) =>
    `Il tuo contatto di supporto: ${name} — ${phone}`,
  editAffordance: "Aggiungi o modifica un contatto di supporto personale",
  privacyNote: "Salvato solo su questo dispositivo, cifrato.",
  form: {
    nameLabel: "Nome",
    namePlaceholder: "Il suo nome",
    phoneLabel: "Telefono",
    phonePlaceholder: "Numero di telefono",
    save: "Salva contatto",
    cancel: "Annulla",
  },
  supportResources: {
    rowLabel: "Risorse di supporto",
    expandLabel: "Mostra le risorse di supporto",
    collapseLabel: "Nascondi le risorse di supporto",
  },
};

const crisisCopyCatalog: Record<InterfaceLanguage, CrisisCopy> = {
  en: crisisCopyEn,
  ru: crisisCopyRu,
  es: crisisCopyEs,
  de: crisisCopyDe,
  fr: crisisCopyFr,
  it: crisisCopyIt,
};

export type { CrisisCopy };

export function getCrisisCopy(language: string | null | undefined) {
  return crisisCopyCatalog[resolveCopyLanguage(language)];
}

// Precomputed, presentational view-data for the shared CrisisSupportCard. The
// card is presentational (architecture invariant: no visibility derivation in
// UI) so the "is a contact set" decision and the display-line formatting are
// done here. Contact values are trimmed here for display only — the persisted
// normalization (trim + length cap) lives in profile-settings-policy and is
// applied by the profile-update path before a write.
export type CrisisSupportViewData = {
  title: string;
  guidance: string;
  // The formatted "Your support contact: {name} — {phone}" line, or null when
  // no complete personal contact is set (so the card just shows fixed guidance).
  contactDisplayLine: string | null;
  // Current saved values, used to prefill the inline edit fields.
  contactName: string;
  contactPhone: string;
  editAffordance: string;
  privacyNote: string;
  form: {
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    save: string;
    cancel: string;
  };
};

export function buildCrisisSupportViewData(
  language: string,
  contactName = "",
  contactPhone = "",
): CrisisSupportViewData {
  const copy = getCrisisCopy(language);
  const name = contactName.trim();
  const phone = contactPhone.trim();
  const hasContact = name.length > 0 && phone.length > 0;
  return {
    title: copy.title,
    guidance: copy.guidance,
    contactDisplayLine: hasContact ? copy.contactLine(name, phone) : null,
    contactName: name,
    contactPhone: phone,
    editAffordance: copy.editAffordance,
    privacyNote: copy.privacyNote,
    form: {
      nameLabel: copy.form.nameLabel,
      namePlaceholder: copy.form.namePlaceholder,
      phoneLabel: copy.form.phoneLabel,
      phonePlaceholder: copy.form.phonePlaceholder,
      save: copy.form.save,
      cancel: copy.form.cancel,
    },
  };
}
