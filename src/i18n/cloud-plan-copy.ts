import type { InterfaceLanguage } from "../models/profile";

export type CloudPlanCopy = {
  title: string;
  // `price` is the store's formatted string, inserted verbatim.
  monthlyLabel: (price: string) => string;
  yearlyLabel: (price: string) => string;
  freeTrialNote: string;
  purchaseCompleted: string;
  purchaseUnavailable: string;
};

const STRINGS: Record<InterfaceLanguage, CloudPlanCopy> = {
  en: {
    title: "Choose a plan",
    monthlyLabel: (price) => `Monthly: ${price}`,
    yearlyLabel: (price) => `Yearly: ${price}`,
    freeTrialNote:
      "Starts with a free trial. Google Play shows the trial length and the first charge date before you confirm.",
    purchaseCompleted:
      "Google Play has your purchase. Premium turns on once Ovumcy Cloud confirms it.",
    purchaseUnavailable:
      "Google Play is not available right now. Nothing was charged.",
  },
  ru: {
    title: "Выберите план",
    monthlyLabel: (price) => `На месяц: ${price}`,
    yearlyLabel: (price) => `На год: ${price}`,
    freeTrialNote:
      "Начинается с бесплатного пробного периода. Google Play покажет его длительность и дату первого списания до подтверждения.",
    purchaseCompleted:
      "Google Play принял покупку. Премиум включится, когда Ovumcy Cloud её подтвердит.",
    purchaseUnavailable:
      "Google Play сейчас недоступен. Деньги не списаны.",
  },
  es: {
    title: "Elige un plan",
    monthlyLabel: (price) => `Mensual: ${price}`,
    yearlyLabel: (price) => `Anual: ${price}`,
    freeTrialNote:
      "Empieza con una prueba gratuita. Google Play muestra la duración de la prueba y la fecha del primer cargo antes de que confirmes.",
    purchaseCompleted:
      "Google Play tiene tu compra. Premium se activará cuando Ovumcy Cloud la confirme.",
    purchaseUnavailable:
      "Google Play no está disponible ahora. No se ha cobrado nada.",
  },
  de: {
    title: "Tarif wählen",
    monthlyLabel: (price) => `Monatlich: ${price}`,
    yearlyLabel: (price) => `Jährlich: ${price}`,
    freeTrialNote:
      "Beginnt mit einem kostenlosen Testzeitraum. Google Play zeigt dessen Dauer und das Datum der ersten Abbuchung, bevor Sie bestätigen.",
    purchaseCompleted:
      "Google Play hat Ihren Kauf erhalten. Premium wird aktiv, sobald Ovumcy Cloud ihn bestätigt.",
    purchaseUnavailable:
      "Google Play ist gerade nicht erreichbar. Es wurde nichts abgebucht.",
  },
  fr: {
    title: "Choisir une formule",
    monthlyLabel: (price) => `Mensuel : ${price}`,
    yearlyLabel: (price) => `Annuel : ${price}`,
    freeTrialNote:
      "Commence par un essai gratuit. Google Play indique sa durée et la date du premier prélèvement avant que vous confirmiez.",
    purchaseCompleted:
      "Google Play a bien reçu votre achat. Premium s'active dès qu'Ovumcy Cloud le confirme.",
    purchaseUnavailable:
      "Google Play n'est pas disponible pour le moment. Rien n'a été prélevé.",
  },
  it: {
    title: "Scegli un piano",
    monthlyLabel: (price) => `Mensile: ${price}`,
    yearlyLabel: (price) => `Annuale: ${price}`,
    freeTrialNote:
      "Inizia con una prova gratuita. Google Play mostra la durata della prova e la data del primo addebito prima della conferma.",
    purchaseCompleted:
      "Google Play ha ricevuto il tuo acquisto. Premium si attiva quando Ovumcy Cloud lo conferma.",
    purchaseUnavailable:
      "Google Play non è disponibile al momento. Non è stato addebitato nulla.",
  },
};

export function getCloudPlanCopy(language: InterfaceLanguage): CloudPlanCopy {
  return STRINGS[language] ?? STRINGS.en;
}
