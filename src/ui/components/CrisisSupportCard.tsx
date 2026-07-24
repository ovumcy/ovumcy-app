import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CrisisSupportViewData } from "../../i18n/crisis-copy";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { AppButton } from "./AppButton";
import { AppTextInput } from "./AppTextInput";

// Shared, presentational crisis-support block — the epic's
// hard-safety surface.
//
// HARD RULE (do not weaken): this card is NEVER premium-gated and never reads
// plan/billing state. It renders wherever its host renders, including read-only
// lapse states. It imports no premium/entitlement code by design — the "no
// premium consultation" invariant is pinned by CrisisSupportCard.test.tsx.
//
// Fully driven by precomputed view-data (`buildCrisisSupportViewData`): the
// fixed guidance always shows; the personal-contact line shows only when
// `contactDisplayLine` is set (visibility decided in the builder, not here). The
// phone is plain text — the app has no tel: link-out primitive yet, so tapping
// does not dial (noted; a future link-out primitive can upgrade this in place).
// The inline edit persists through the host's profile-update path
// (`onSaveContact`); this component never touches storage directly.

export type CrisisSupportCardProps = {
  viewData: CrisisSupportViewData;
  onSaveContact: (contact: { name: string; phone: string }) => void | Promise<void>;
  testID?: string;
};

export function CrisisSupportCard({
  viewData,
  onSaveContact,
  testID = "crisis-support-card",
}: CrisisSupportCardProps) {
  const styles = useThemedStyles(createStyles);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(viewData.contactName);
  const [phone, setPhone] = useState(viewData.contactPhone);
  const [isSaving, setIsSaving] = useState(false);

  function handleOpenEdit() {
    // Seed the inputs from the currently-saved contact each time edit opens, so
    // a prior cancelled edit never leaks into the next one.
    setName(viewData.contactName);
    setPhone(viewData.contactPhone);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // Raw typed values — the host normalizes (trim + length cap) in the
      // profile policy layer before persisting.
      await onSaveContact({ name, phone });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title} testID={`${testID}-title`}>
        {viewData.title}
      </Text>
      <Text style={styles.guidance} testID={`${testID}-guidance`}>
        {viewData.guidance}
      </Text>

      {viewData.contactDisplayLine ? (
        <Text style={styles.contactLine} testID={`${testID}-contact`}>
          {viewData.contactDisplayLine}
        </Text>
      ) : null}

      {isEditing ? (
        <View style={styles.editBlock} testID={`${testID}-edit`}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{viewData.form.nameLabel}</Text>
            <AppTextInput
              onChangeText={setName}
              placeholder={viewData.form.namePlaceholder}
              style={styles.input}
              testID={`${testID}-name-input`}
              value={name}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{viewData.form.phoneLabel}</Text>
            <AppTextInput
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder={viewData.form.phonePlaceholder}
              style={styles.input}
              testID={`${testID}-phone-input`}
              value={phone}
            />
          </View>
          <Text style={styles.privacyNote} testID={`${testID}-privacy-note`}>
            {viewData.privacyNote}
          </Text>
          <View style={styles.actionsRow}>
            <AppButton
              label={viewData.form.cancel}
              onPress={handleCancel}
              testID={`${testID}-cancel-button`}
              variant="secondary"
            />
            <AppButton
              disabled={isSaving}
              label={viewData.form.save}
              onPress={handleSave}
              testID={`${testID}-save-button`}
            />
          </View>
        </View>
      ) : (
        <View style={styles.editAffordanceRow}>
          <AppButton
            label={viewData.editAffordance}
            onPress={handleOpenEdit}
            testID={`${testID}-edit-button`}
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    // Calm, visually distinct notice surface — deliberately the warm info tone,
    // NOT alarm-red. It should read as steady support, not an emergency siren.
    card: {
      backgroundColor: colors.statusInfoBg,
      borderColor: colors.statusInfoBorder,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.sm,
      padding: 18,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
    },
    guidance: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    contactLine: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
    },
    editAffordanceRow: {
      marginTop: spacing.xs,
    },
    editBlock: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    field: {
      gap: 4,
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.lineSoft,
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 15,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    privacyNote: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
    },
  });
