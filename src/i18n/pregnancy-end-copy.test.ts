import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import { getPostpartumCopy } from "./postpartum-copy";
import { getPregnancyEndCopy } from "./pregnancy-end-copy";

describe("pregnancy end copy: neutral birth ending", () => {
  it("never promises a return to cycle tracking on the birth step in any locale", () => {
    const cycleReturn =
      /cycle tracking|cycle view|цикл|Zyklus|cycle\b|ciclo/i;
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      const birth = getPregnancyEndCopy(language).birth;
      expect(getPregnancyEndCopy(language).choice.birthHint).not.toMatch(
        cycleReturn,
      );
      expect(birth.congratulations).not.toMatch(cycleReturn);
      expect(birth.congratulationsPlural).not.toMatch(cycleReturn);
      expect(birth.dialog.body).not.toMatch(cycleReturn);
    }
  });

  it("keeps the English birth wording neutral", () => {
    const copy = getPregnancyEndCopy("en");
    expect(copy.choice.birthHint).toBe(
      "Record the birth and end pregnancy tracking.",
    );
    expect(copy.birth.dialog.body).toBe(
      "Ovumcy will end pregnancy tracking. Your pregnancy entries stay saved on this device.",
    );
  });

  it("pins the translated birth wording", () => {
    expect(getPregnancyEndCopy("ru").birth.dialog.body).toBe(
      "Ovumcy завершит отслеживание беременности. Ваши записи о беременности останутся на этом устройстве.",
    );
    expect(getPregnancyEndCopy("de").birth.dialog.body).toBe(
      "Ovumcy beendet das Schwangerschafts-Tracking. Ihre Schwangerschaftseinträge bleiben auf diesem Gerät gespeichert.",
    );
    expect(getPregnancyEndCopy("fr").birth.dialog.body).toBe(
      "Ovumcy mettra fin au suivi de grossesse. Vos entrées de grossesse restent enregistrées sur cet appareil.",
    );
    expect(getPregnancyEndCopy("es").birth.dialog.body).toBe(
      "Ovumcy terminará el seguimiento del embarazo. Tus entradas del embarazo se mantienen guardadas en este dispositivo.",
    );
    expect(getPregnancyEndCopy("it").birth.dialog.body).toBe(
      "Ovumcy terminerà il monitoraggio della gravidanza. Le tue voci sulla gravidanza restano salvate su questo dispositivo.",
    );
  });

  it("gives the hub row a title and description in every locale", () => {
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      const manage = getPregnancyEndCopy(language).manage;
      expect(manage.hubTitle.trim()).not.toBe("");
      expect(manage.hubDescription.trim()).not.toBe("");
    }
  });

  it("ends the postpartum dialog without the dangling 'later' sentence", () => {
    const later =
      /later|позже|später|plus tard|más tarde|più tardi/i;
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      expect(getPostpartumCopy(language).manage.endDialog.body).not.toMatch(
        later,
      );
    }
  });
});
