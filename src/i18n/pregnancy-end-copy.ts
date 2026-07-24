import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// Copy for ending a pregnancy: the prominent "I gave birth" happy
// path, the quiet loss / "other" paths, hard-deletion of pregnancy data, and
// the two dashboard CTAs. Tone rules (SECURITY.md medical-safety invariant +
// the design brief): the loss/other copy is neutral, warm, and brief — ONE
// respectful acknowledgment, then practical — with NO exclamation marks and no
// euphemism-heavy phrasing; the birth path may be warm ("Congratulations").
// The delete copy states the irreversible consequence plainly. en + ru are
// primary and reviewed against the tone invariant; de/fr/es/it are best-effort
// translations pending a native-speaker review before public launch.


const pregnancyEndCopyEn = {
  eyebrow: "Pregnancy",
  title: "Pregnancy tracking",
  subtitle:
    "Record how your pregnancy ended, or manage your pregnancy data. Your entries stay on this device.",
  choice: {
    title: "What would you like to do?",
    birthLabel: "I gave birth",
    birthHint: "Record the birth and switch back to cycle tracking.",
    lossLabel: "I experienced a loss",
    lossHint: "Switch back to cycle tracking, quietly.",
    otherLabel: "Something else",
    otherHint: "End pregnancy tracking for another reason.",
    backCta: "Not now",
  },
  birth: {
    title: "Congratulations",
    congratulations:
      "Congratulations on your new arrival. When you're ready, you can switch Ovumcy back to cycle tracking.",
    // Multiples: plural variants used only when the ACTIVE record's
    // fetusCount >= 2 -- see PregnancyEndFlowScreen's isMultiples prop. Loss
    // and "other" copy is never plural-aware (kept untouched).
    congratulationsPlural:
      "Congratulations on your new arrivals. When you're ready, you can switch Ovumcy back to cycle tracking.",
    modeQuestion: "How was your baby born?",
    modeQuestionPlural: "How were your babies born?",
    modeHint: "This is optional — you can skip it.",
    modeOptions: {
      vaginal: "Vaginal birth",
      cesarean: "Cesarean (C-section)",
      skip: "Prefer not to say",
    },
    confirmCta: "Finish pregnancy tracking",
    backCta: "Back",
    dialog: {
      title: "Finish pregnancy tracking?",
      body: "Ovumcy will switch back to cycle tracking. Your pregnancy entries stay saved on this device.",
      confirm: "Finish",
      cancel: "Keep tracking",
    },
  },
  loss: {
    title: "Ending pregnancy tracking",
    acknowledgment: "We're sorry you're going through this.",
    body: "Ovumcy will switch back to cycle tracking. Your entries stay saved on this device, and nothing is shared. You can remove this pregnancy's data whenever you like.",
    confirmCta: "Continue",
    backCta: "Not now",
    dialog: {
      title: "Switch back to cycle tracking?",
      body: "Ovumcy will stop pregnancy tracking and return to your cycle. You can do this later instead.",
      confirm: "Switch back",
      cancel: "Not now",
    },
  },
  other: {
    title: "Ending pregnancy tracking",
    acknowledgment: "You can end pregnancy tracking here, at your own pace.",
    body: "Ovumcy will switch back to cycle tracking. Your entries stay saved on this device. You can remove this pregnancy's data whenever you like.",
    confirmCta: "Continue",
    backCta: "Not now",
    dialog: {
      title: "Switch back to cycle tracking?",
      body: "Ovumcy will stop pregnancy tracking and return to your cycle. You can do this later instead.",
      confirm: "Switch back",
      cancel: "Not now",
    },
  },
  manage: {
    title: "Manage pregnancy tracking",
    noActiveBody:
      "You don't have an active pregnancy in Ovumcy. You can remove your saved pregnancy data below.",
    emptyBody: "You don't have any pregnancy data in Ovumcy.",
    backCta: "Back",
  },
  // Update due date: clinician re-dating, offered only while a
  // pregnancy is active. Basis labels, the date field, and the live preview
  // reuse pregnancy-copy.ts's wizard catalog verbatim -- only these three
  // strings are new. Success-free by design: no celebratory copy, matching
  // startPregnancy/endPregnancy's own direct navigation on success.
  updateDueDate: {
    rowLabel: "Update due date",
    stepTitle: "Update your due date",
    confirmCta: "Save due date",
  },
  delete: {
    cta: "Delete pregnancy data",
    title: "Delete pregnancy data",
    body: "This permanently removes all pregnancy records, kick counts, and contraction sessions from this device. Your cycle history and day logs are not affected. This can't be undone.",
    deviceAuthPrompt: "Confirm it's you to delete pregnancy data",
    dialog: {
      title: "Delete all pregnancy data?",
      body: "This permanently deletes every pregnancy record, kick count, and contraction session on this device. This can't be undone.",
      confirm: "Delete",
      cancel: "Cancel",
    },
    status: {
      deviceAuthUnavailable:
        "Device authentication isn't available, so this can't continue.",
      deviceAuthFailed: "We couldn't verify it's you. Please try again.",
      failed: "We couldn't delete this just now. Please try again.",
    },
  },
  status: {
    endFailed: "We couldn't update this just now. Please try again.",
  },
  dashboard: {
    birthCta: "I gave birth",
    manageCta: "Manage pregnancy tracking",
  },
} as const;

type PregnancyEndCopy = WidenLiteral<typeof pregnancyEndCopyEn>;

const pregnancyEndCopyRu: PregnancyEndCopy = {
  eyebrow: "Беременность",
  title: "Отслеживание беременности",
  subtitle:
    "Отметьте, как завершилась беременность, или управляйте данными о ней. Ваши записи остаются на этом устройстве.",
  choice: {
    title: "Что вы хотите сделать?",
    birthLabel: "Я родила",
    birthHint: "Отметить рождение и вернуться к отслеживанию цикла.",
    lossLabel: "Я потеряла беременность",
    lossHint: "Тихо вернуться к отслеживанию цикла.",
    otherLabel: "Другое",
    otherHint: "Завершить отслеживание беременности по другой причине.",
    backCta: "Не сейчас",
  },
  birth: {
    title: "Поздравляем",
    congratulations:
      "Поздравляем с рождением малыша. Когда будете готовы, можно вернуть Ovumcy к отслеживанию цикла.",
    congratulationsPlural:
      "Поздравляем с рождением малышей. Когда будете готовы, можно вернуть Ovumcy к отслеживанию цикла.",
    modeQuestion: "Как прошли роды?",
    modeQuestionPlural: "Как появились на свет малыши?",
    modeHint: "Это необязательно — можно пропустить.",
    modeOptions: {
      vaginal: "Естественные роды",
      cesarean: "Кесарево сечение",
      skip: "Не указывать",
    },
    confirmCta: "Завершить отслеживание беременности",
    backCta: "Назад",
    dialog: {
      title: "Завершить отслеживание беременности?",
      body: "Ovumcy вернётся к отслеживанию цикла. Ваши записи о беременности останутся на этом устройстве.",
      confirm: "Завершить",
      cancel: "Продолжить отслеживание",
    },
  },
  loss: {
    title: "Завершение отслеживания беременности",
    acknowledgment: "Нам жаль, что вам приходится через это проходить.",
    body: "Ovumcy вернётся к отслеживанию цикла. Ваши записи останутся на этом устройстве, и ничего не передаётся. Данные об этой беременности можно удалить в любой момент.",
    confirmCta: "Продолжить",
    backCta: "Не сейчас",
    dialog: {
      title: "Вернуться к отслеживанию цикла?",
      body: "Ovumcy остановит отслеживание беременности и вернётся к вашему циклу. Это можно сделать и позже.",
      confirm: "Вернуться к циклу",
      cancel: "Не сейчас",
    },
  },
  other: {
    title: "Завершение отслеживания беременности",
    acknowledgment:
      "Вы можете завершить отслеживание беременности здесь, в удобном для вас темпе.",
    body: "Ovumcy вернётся к отслеживанию цикла. Ваши записи останутся на этом устройстве. Данные об этой беременности можно удалить в любой момент.",
    confirmCta: "Продолжить",
    backCta: "Не сейчас",
    dialog: {
      title: "Вернуться к отслеживанию цикла?",
      body: "Ovumcy остановит отслеживание беременности и вернётся к вашему циклу. Это можно сделать и позже.",
      confirm: "Вернуться к циклу",
      cancel: "Не сейчас",
    },
  },
  manage: {
    title: "Управление отслеживанием беременности",
    noActiveBody:
      "Сейчас в Ovumcy нет активной беременности. Вы можете удалить сохранённые данные о беременности ниже.",
    emptyBody: "В Ovumcy нет данных о беременности.",
    backCta: "Назад",
  },
  updateDueDate: {
    rowLabel: "Обновить дату родов",
    stepTitle: "Обновление даты родов",
    confirmCta: "Сохранить дату родов",
  },
  delete: {
    cta: "Удалить данные о беременности",
    title: "Удалить данные о беременности",
    body: "Это безвозвратно удалит все записи о беременности, подсчёты шевелений и сессии схваток с этого устройства. История цикла и дневник дней не затрагиваются. Отменить нельзя.",
    deviceAuthPrompt:
      "Подтвердите, что это вы, чтобы удалить данные о беременности",
    dialog: {
      title: "Удалить все данные о беременности?",
      body: "Это безвозвратно удалит все записи о беременности, подсчёты шевелений и сессии схваток на этом устройстве. Отменить нельзя.",
      confirm: "Удалить",
      cancel: "Отмена",
    },
    status: {
      deviceAuthUnavailable:
        "Аутентификация устройства недоступна, поэтому действие нельзя продолжить.",
      deviceAuthFailed:
        "Не удалось подтвердить, что это вы. Попробуйте снова.",
      failed: "Не удалось удалить сейчас. Попробуйте снова.",
    },
  },
  status: {
    endFailed: "Не удалось обновить сейчас. Попробуйте снова.",
  },
  dashboard: {
    birthCta: "Я родила",
    manageCta: "Управление отслеживанием беременности",
  },
};

const pregnancyEndCopyDe: PregnancyEndCopy = {
  eyebrow: "Schwangerschaft",
  title: "Schwangerschafts-Tracking",
  subtitle:
    "Halten Sie fest, wie Ihre Schwangerschaft geendet hat, oder verwalten Sie Ihre Schwangerschaftsdaten. Ihre Einträge bleiben auf diesem Gerät.",
  choice: {
    title: "Was möchten Sie tun?",
    birthLabel: "Ich habe entbunden",
    birthHint: "Die Geburt festhalten und zum Zyklus-Tracking zurückkehren.",
    lossLabel: "Ich habe mein Kind verloren",
    lossHint: "Still zum Zyklus-Tracking zurückkehren.",
    otherLabel: "Etwas anderes",
    otherHint:
      "Das Schwangerschafts-Tracking aus einem anderen Grund beenden.",
    backCta: "Jetzt nicht",
  },
  birth: {
    title: "Herzlichen Glückwunsch",
    congratulations:
      "Herzlichen Glückwunsch zu Ihrem Nachwuchs. Wenn Sie bereit sind, können Sie Ovumcy zum Zyklus-Tracking zurückstellen.",
    congratulationsPlural:
      "Herzlichen Glückwunsch zu Ihren Neugeborenen. Wenn Sie bereit sind, können Sie Ovumcy zum Zyklus-Tracking zurückstellen.",
    modeQuestion: "Wie kam Ihr Baby zur Welt?",
    modeQuestionPlural: "Wie kamen Ihre Babys zur Welt?",
    modeHint: "Das ist optional — Sie können es überspringen.",
    modeOptions: {
      vaginal: "Vaginale Geburt",
      cesarean: "Kaiserschnitt",
      skip: "Keine Angabe",
    },
    confirmCta: "Schwangerschafts-Tracking beenden",
    backCta: "Zurück",
    dialog: {
      title: "Schwangerschafts-Tracking beenden?",
      body: "Ovumcy wechselt zurück zum Zyklus-Tracking. Ihre Schwangerschaftseinträge bleiben auf diesem Gerät gespeichert.",
      confirm: "Beenden",
      cancel: "Weiter verfolgen",
    },
  },
  loss: {
    title: "Schwangerschafts-Tracking beenden",
    acknowledgment: "Es tut uns leid, dass Sie das durchmachen müssen.",
    body: "Ovumcy wechselt zurück zum Zyklus-Tracking. Ihre Einträge bleiben auf diesem Gerät gespeichert und nichts wird geteilt. Sie können die Daten dieser Schwangerschaft jederzeit entfernen.",
    confirmCta: "Weiter",
    backCta: "Jetzt nicht",
    dialog: {
      title: "Zum Zyklus-Tracking zurückkehren?",
      body: "Ovumcy beendet das Schwangerschafts-Tracking und kehrt zu Ihrem Zyklus zurück. Sie können das auch später tun.",
      confirm: "Zurückwechseln",
      cancel: "Jetzt nicht",
    },
  },
  other: {
    title: "Schwangerschafts-Tracking beenden",
    acknowledgment:
      "Sie können das Schwangerschafts-Tracking hier beenden, in Ihrem eigenen Tempo.",
    body: "Ovumcy wechselt zurück zum Zyklus-Tracking. Ihre Einträge bleiben auf diesem Gerät gespeichert. Sie können die Daten dieser Schwangerschaft jederzeit entfernen.",
    confirmCta: "Weiter",
    backCta: "Jetzt nicht",
    dialog: {
      title: "Zum Zyklus-Tracking zurückkehren?",
      body: "Ovumcy beendet das Schwangerschafts-Tracking und kehrt zu Ihrem Zyklus zurück. Sie können das auch später tun.",
      confirm: "Zurückwechseln",
      cancel: "Jetzt nicht",
    },
  },
  manage: {
    title: "Schwangerschafts-Tracking verwalten",
    noActiveBody:
      "Sie haben keine aktive Schwangerschaft in Ovumcy. Sie können Ihre gespeicherten Schwangerschaftsdaten unten entfernen.",
    emptyBody: "Sie haben keine Schwangerschaftsdaten in Ovumcy.",
    backCta: "Zurück",
  },
  updateDueDate: {
    rowLabel: "Termin aktualisieren",
    stepTitle: "Ihren Termin aktualisieren",
    confirmCta: "Termin speichern",
  },
  delete: {
    cta: "Schwangerschaftsdaten löschen",
    title: "Schwangerschaftsdaten löschen",
    body: "Damit werden alle Schwangerschaftseinträge, Tritt-Zählungen und Wehen-Sitzungen dauerhaft von diesem Gerät entfernt. Ihr Zyklusverlauf und Ihre Tageseinträge sind nicht betroffen. Das kann nicht rückgängig gemacht werden.",
    deviceAuthPrompt:
      "Bestätigen Sie, dass Sie es sind, um Schwangerschaftsdaten zu löschen",
    dialog: {
      title: "Alle Schwangerschaftsdaten löschen?",
      body: "Damit werden alle Schwangerschaftseinträge, Tritt-Zählungen und Wehen-Sitzungen auf diesem Gerät dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.",
      confirm: "Löschen",
      cancel: "Abbrechen",
    },
    status: {
      deviceAuthUnavailable:
        "Die Geräteauthentifizierung ist nicht verfügbar, daher kann dies nicht fortgesetzt werden.",
      deviceAuthFailed:
        "Wir konnten nicht bestätigen, dass Sie es sind. Bitte versuchen Sie es erneut.",
      failed:
        "Wir konnten das gerade nicht löschen. Bitte versuchen Sie es erneut.",
    },
  },
  status: {
    endFailed:
      "Wir konnten das gerade nicht aktualisieren. Bitte versuchen Sie es erneut.",
  },
  dashboard: {
    birthCta: "Ich habe entbunden",
    manageCta: "Schwangerschafts-Tracking verwalten",
  },
};

const pregnancyEndCopyFr: PregnancyEndCopy = {
  eyebrow: "Grossesse",
  title: "Suivi de grossesse",
  subtitle:
    "Indiquez comment votre grossesse s'est terminée, ou gérez vos données de grossesse. Vos entrées restent sur cet appareil.",
  choice: {
    title: "Que souhaitez-vous faire ?",
    birthLabel: "J'ai accouché",
    birthHint: "Enregistrer la naissance et revenir au suivi du cycle.",
    lossLabel: "J'ai vécu une perte",
    lossHint: "Revenir discrètement au suivi du cycle.",
    otherLabel: "Autre chose",
    otherHint: "Terminer le suivi de grossesse pour une autre raison.",
    backCta: "Pas maintenant",
  },
  birth: {
    title: "Félicitations",
    congratulations:
      "Félicitations pour l'arrivée de votre bébé. Quand vous serez prête, vous pourrez revenir au suivi du cycle dans Ovumcy.",
    congratulationsPlural:
      "Félicitations pour l'arrivée de vos bébés. Quand vous serez prête, vous pourrez revenir au suivi du cycle dans Ovumcy.",
    modeQuestion: "Comment votre bébé est-il né ?",
    modeQuestionPlural: "Comment vos bébés sont-ils nés ?",
    modeHint: "C'est facultatif — vous pouvez passer cette étape.",
    modeOptions: {
      vaginal: "Accouchement par voie basse",
      cesarean: "Césarienne",
      skip: "Préfère ne pas répondre",
    },
    confirmCta: "Terminer le suivi de grossesse",
    backCta: "Retour",
    dialog: {
      title: "Terminer le suivi de grossesse ?",
      body: "Ovumcy reviendra au suivi du cycle. Vos entrées de grossesse restent enregistrées sur cet appareil.",
      confirm: "Terminer",
      cancel: "Continuer le suivi",
    },
  },
  loss: {
    title: "Fin du suivi de grossesse",
    acknowledgment: "Nous sommes désolés pour ce que vous traversez.",
    body: "Ovumcy reviendra au suivi du cycle. Vos entrées restent enregistrées sur cet appareil et rien n'est partagé. Vous pouvez supprimer les données de cette grossesse quand vous le souhaitez.",
    confirmCta: "Continuer",
    backCta: "Pas maintenant",
    dialog: {
      title: "Revenir au suivi du cycle ?",
      body: "Ovumcy arrêtera le suivi de grossesse et reviendra à votre cycle. Vous pouvez aussi le faire plus tard.",
      confirm: "Revenir au cycle",
      cancel: "Pas maintenant",
    },
  },
  other: {
    title: "Fin du suivi de grossesse",
    acknowledgment:
      "Vous pouvez terminer le suivi de grossesse ici, à votre rythme.",
    body: "Ovumcy reviendra au suivi du cycle. Vos entrées restent enregistrées sur cet appareil. Vous pouvez supprimer les données de cette grossesse quand vous le souhaitez.",
    confirmCta: "Continuer",
    backCta: "Pas maintenant",
    dialog: {
      title: "Revenir au suivi du cycle ?",
      body: "Ovumcy arrêtera le suivi de grossesse et reviendra à votre cycle. Vous pouvez aussi le faire plus tard.",
      confirm: "Revenir au cycle",
      cancel: "Pas maintenant",
    },
  },
  manage: {
    title: "Gérer le suivi de grossesse",
    noActiveBody:
      "Vous n'avez pas de grossesse active dans Ovumcy. Vous pouvez supprimer vos données de grossesse enregistrées ci-dessous.",
    emptyBody: "Vous n'avez aucune donnée de grossesse dans Ovumcy.",
    backCta: "Retour",
  },
  updateDueDate: {
    rowLabel: "Mettre à jour la date prévue",
    stepTitle: "Mettre à jour votre date prévue",
    confirmCta: "Enregistrer la date",
  },
  delete: {
    cta: "Supprimer les données de grossesse",
    title: "Supprimer les données de grossesse",
    body: "Cela supprime définitivement toutes les données de grossesse, comptages de mouvements et séances de contractions de cet appareil. Votre historique de cycle et vos journaux quotidiens ne sont pas affectés. Cette action est irréversible.",
    deviceAuthPrompt:
      "Confirmez votre identité pour supprimer les données de grossesse",
    dialog: {
      title: "Supprimer toutes les données de grossesse ?",
      body: "Cela supprime définitivement chaque donnée de grossesse, comptage de mouvements et séance de contractions sur cet appareil. Cette action est irréversible.",
      confirm: "Supprimer",
      cancel: "Annuler",
    },
    status: {
      deviceAuthUnavailable:
        "L'authentification de l'appareil n'est pas disponible, cette action ne peut pas continuer.",
      deviceAuthFailed:
        "Nous n'avons pas pu vérifier votre identité. Veuillez réessayer.",
      failed:
        "Nous n'avons pas pu supprimer pour le moment. Veuillez réessayer.",
    },
  },
  status: {
    endFailed:
      "Nous n'avons pas pu mettre à jour pour le moment. Veuillez réessayer.",
  },
  dashboard: {
    birthCta: "J'ai accouché",
    manageCta: "Gérer le suivi de grossesse",
  },
};

const pregnancyEndCopyEs: PregnancyEndCopy = {
  eyebrow: "Embarazo",
  title: "Seguimiento del embarazo",
  subtitle:
    "Indica cómo terminó tu embarazo o gestiona tus datos de embarazo. Tus entradas permanecen en este dispositivo.",
  choice: {
    title: "¿Qué te gustaría hacer?",
    birthLabel: "Di a luz",
    birthHint: "Registrar el nacimiento y volver al seguimiento del ciclo.",
    lossLabel: "Tuve una pérdida",
    lossHint: "Volver al seguimiento del ciclo, de forma discreta.",
    otherLabel: "Otra cosa",
    otherHint: "Terminar el seguimiento del embarazo por otro motivo.",
    backCta: "Ahora no",
  },
  birth: {
    title: "Enhorabuena",
    congratulations:
      "Enhorabuena por la llegada de tu bebé. Cuando quieras, puedes volver al seguimiento del ciclo en Ovumcy.",
    congratulationsPlural:
      "Enhorabuena por la llegada de tus bebés. Cuando quieras, puedes volver al seguimiento del ciclo en Ovumcy.",
    modeQuestion: "¿Cómo nació tu bebé?",
    modeQuestionPlural: "¿Cómo nacieron tus bebés?",
    modeHint: "Es opcional; puedes omitirlo.",
    modeOptions: {
      vaginal: "Parto vaginal",
      cesarean: "Cesárea",
      skip: "Prefiero no decirlo",
    },
    confirmCta: "Terminar el seguimiento del embarazo",
    backCta: "Atrás",
    dialog: {
      title: "¿Terminar el seguimiento del embarazo?",
      body: "Ovumcy volverá al seguimiento del ciclo. Tus entradas del embarazo se mantienen guardadas en este dispositivo.",
      confirm: "Terminar",
      cancel: "Seguir con el seguimiento",
    },
  },
  loss: {
    title: "Finalizar el seguimiento del embarazo",
    acknowledgment: "Sentimos lo que estás viviendo.",
    body: "Ovumcy volverá al seguimiento del ciclo. Tus entradas se mantienen guardadas en este dispositivo y no se comparte nada. Puedes eliminar los datos de este embarazo cuando quieras.",
    confirmCta: "Continuar",
    backCta: "Ahora no",
    dialog: {
      title: "¿Volver al seguimiento del ciclo?",
      body: "Ovumcy detendrá el seguimiento del embarazo y volverá a tu ciclo. También puedes hacerlo más tarde.",
      confirm: "Volver al ciclo",
      cancel: "Ahora no",
    },
  },
  other: {
    title: "Finalizar el seguimiento del embarazo",
    acknowledgment:
      "Puedes finalizar el seguimiento del embarazo aquí, a tu propio ritmo.",
    body: "Ovumcy volverá al seguimiento del ciclo. Tus entradas se mantienen guardadas en este dispositivo. Puedes eliminar los datos de este embarazo cuando quieras.",
    confirmCta: "Continuar",
    backCta: "Ahora no",
    dialog: {
      title: "¿Volver al seguimiento del ciclo?",
      body: "Ovumcy detendrá el seguimiento del embarazo y volverá a tu ciclo. También puedes hacerlo más tarde.",
      confirm: "Volver al ciclo",
      cancel: "Ahora no",
    },
  },
  manage: {
    title: "Gestionar el seguimiento del embarazo",
    noActiveBody:
      "No tienes un embarazo activo en Ovumcy. Puedes eliminar tus datos de embarazo guardados abajo.",
    emptyBody: "No tienes datos de embarazo en Ovumcy.",
    backCta: "Atrás",
  },
  updateDueDate: {
    rowLabel: "Actualizar fecha de parto",
    stepTitle: "Actualiza tu fecha de parto",
    confirmCta: "Guardar fecha",
  },
  delete: {
    cta: "Eliminar datos del embarazo",
    title: "Eliminar datos del embarazo",
    body: "Esto elimina de forma permanente todos los registros del embarazo, recuentos de pataditas y sesiones de contracciones de este dispositivo. Tu historial de ciclo y tus registros diarios no se ven afectados. No se puede deshacer.",
    deviceAuthPrompt:
      "Confirma que eres tú para eliminar los datos del embarazo",
    dialog: {
      title: "¿Eliminar todos los datos del embarazo?",
      body: "Esto elimina de forma permanente todos los registros del embarazo, recuentos de pataditas y sesiones de contracciones de este dispositivo. No se puede deshacer.",
      confirm: "Eliminar",
      cancel: "Cancelar",
    },
    status: {
      deviceAuthUnavailable:
        "La autenticación del dispositivo no está disponible, así que no se puede continuar.",
      deviceAuthFailed:
        "No pudimos verificar que eres tú. Inténtalo de nuevo.",
      failed: "No pudimos eliminarlo ahora mismo. Inténtalo de nuevo.",
    },
  },
  status: {
    endFailed: "No pudimos actualizarlo ahora mismo. Inténtalo de nuevo.",
  },
  dashboard: {
    birthCta: "Di a luz",
    manageCta: "Gestionar el seguimiento del embarazo",
  },
};

const pregnancyEndCopyIt: PregnancyEndCopy = {
  eyebrow: "Gravidanza",
  title: "Monitoraggio della gravidanza",
  subtitle:
    "Indica come è terminata la tua gravidanza o gestisci i tuoi dati sulla gravidanza. Le tue voci restano su questo dispositivo.",
  choice: {
    title: "Cosa vuoi fare?",
    birthLabel: "Ho partorito",
    birthHint: "Registrare la nascita e tornare al monitoraggio del ciclo.",
    lossLabel: "Ho avuto una perdita",
    lossHint: "Tornare al monitoraggio del ciclo, con discrezione.",
    otherLabel: "Qualcos'altro",
    otherHint:
      "Terminare il monitoraggio della gravidanza per un altro motivo.",
    backCta: "Non ora",
  },
  birth: {
    title: "Congratulazioni",
    congratulations:
      "Congratulazioni per l'arrivo del tuo bambino. Quando sei pronta, puoi riportare Ovumcy al monitoraggio del ciclo.",
    congratulationsPlural:
      "Congratulazioni per l'arrivo dei tuoi bambini. Quando sei pronta, puoi riportare Ovumcy al monitoraggio del ciclo.",
    modeQuestion: "Come è nato il tuo bambino?",
    modeQuestionPlural: "Come sono nati i tuoi bambini?",
    modeHint: "È facoltativo — puoi saltarlo.",
    modeOptions: {
      vaginal: "Parto vaginale",
      cesarean: "Cesareo",
      skip: "Preferisco non dirlo",
    },
    confirmCta: "Termina il monitoraggio della gravidanza",
    backCta: "Indietro",
    dialog: {
      title: "Terminare il monitoraggio della gravidanza?",
      body: "Ovumcy tornerà al monitoraggio del ciclo. Le tue voci sulla gravidanza restano salvate su questo dispositivo.",
      confirm: "Termina",
      cancel: "Continua a monitorare",
    },
  },
  loss: {
    title: "Termine del monitoraggio della gravidanza",
    acknowledgment: "Ci dispiace per quello che stai affrontando.",
    body: "Ovumcy tornerà al monitoraggio del ciclo. Le tue voci restano salvate su questo dispositivo e nulla viene condiviso. Puoi rimuovere i dati di questa gravidanza quando vuoi.",
    confirmCta: "Continua",
    backCta: "Non ora",
    dialog: {
      title: "Tornare al monitoraggio del ciclo?",
      body: "Ovumcy interromperà il monitoraggio della gravidanza e tornerà al tuo ciclo. Puoi farlo anche più tardi.",
      confirm: "Torna al ciclo",
      cancel: "Non ora",
    },
  },
  other: {
    title: "Termine del monitoraggio della gravidanza",
    acknowledgment:
      "Puoi terminare qui il monitoraggio della gravidanza, con i tuoi tempi.",
    body: "Ovumcy tornerà al monitoraggio del ciclo. Le tue voci restano salvate su questo dispositivo. Puoi rimuovere i dati di questa gravidanza quando vuoi.",
    confirmCta: "Continua",
    backCta: "Non ora",
    dialog: {
      title: "Tornare al monitoraggio del ciclo?",
      body: "Ovumcy interromperà il monitoraggio della gravidanza e tornerà al tuo ciclo. Puoi farlo anche più tardi.",
      confirm: "Torna al ciclo",
      cancel: "Non ora",
    },
  },
  manage: {
    title: "Gestisci il monitoraggio della gravidanza",
    noActiveBody:
      "Non hai una gravidanza attiva in Ovumcy. Puoi rimuovere i dati sulla gravidanza salvati qui sotto.",
    emptyBody: "Non hai dati sulla gravidanza in Ovumcy.",
    backCta: "Indietro",
  },
  updateDueDate: {
    rowLabel: "Aggiorna la data del parto",
    stepTitle: "Aggiorna la tua data del parto",
    confirmCta: "Salva la data",
  },
  delete: {
    cta: "Elimina i dati sulla gravidanza",
    title: "Elimina i dati sulla gravidanza",
    body: "Questo rimuove definitivamente tutti i record della gravidanza, i conteggi dei movimenti e le sessioni di contrazioni da questo dispositivo. La cronologia del ciclo e i diari giornalieri non sono interessati. Non può essere annullato.",
    deviceAuthPrompt:
      "Conferma che sei tu per eliminare i dati sulla gravidanza",
    dialog: {
      title: "Eliminare tutti i dati sulla gravidanza?",
      body: "Questo elimina definitivamente ogni record della gravidanza, conteggio dei movimenti e sessione di contrazioni su questo dispositivo. Non può essere annullato.",
      confirm: "Elimina",
      cancel: "Annulla",
    },
    status: {
      deviceAuthUnavailable:
        "L'autenticazione del dispositivo non è disponibile, quindi non è possibile continuare.",
      deviceAuthFailed:
        "Non siamo riusciti a verificare la tua identità. Riprova.",
      failed: "Non siamo riusciti a eliminare adesso. Riprova.",
    },
  },
  status: {
    endFailed: "Non siamo riusciti ad aggiornare adesso. Riprova.",
  },
  dashboard: {
    birthCta: "Ho partorito",
    manageCta: "Gestisci il monitoraggio della gravidanza",
  },
};

const pregnancyEndCopyCatalog: Record<InterfaceLanguage, PregnancyEndCopy> = {
  en: pregnancyEndCopyEn,
  ru: pregnancyEndCopyRu,
  es: pregnancyEndCopyEs,
  de: pregnancyEndCopyDe,
  fr: pregnancyEndCopyFr,
  it: pregnancyEndCopyIt,
};

export type { PregnancyEndCopy };

export function getPregnancyEndCopy(language: string | null | undefined) {
  return pregnancyEndCopyCatalog[resolveCopyLanguage(language)];
}
