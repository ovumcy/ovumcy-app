import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { SymptomID } from "../../models/symptom";
import type { SymptomDraftValues } from "../../services/symptom-policy";
import type { SettingsViewData } from "../../services/settings-view-service";
import { buildSettingsSymptomsState } from "../../services/settings-view-service";
import { AppButton } from "./AppButton";
import { FeatureCard } from "./FeatureCard";
import { StatusBanner } from "./StatusBanner";
import { colors, spacing } from "../theme/tokens";

type SettingsSymptomsSectionProps = {
  createDraft: SymptomDraftValues;
  createErrorMessage: string;
  createStatusMessage: string;
  onArchive: (symptomID: SymptomID) => void | Promise<void>;
  onCreate: () => void | Promise<void>;
  onCreateDraftChange: (updates: Partial<SymptomDraftValues>) => void;
  onRestore: (symptomID: SymptomID) => void | Promise<void>;
  onRowDraftChange: (
    symptomID: SymptomID,
    updates: Partial<SymptomDraftValues>,
  ) => void;
  onUpdate: (symptomID: SymptomID) => void | Promise<void>;
  rowDrafts: Record<string, SymptomDraftValues>;
  rowErrorMessages: Record<string, string>;
  rowStatusMessages: Record<string, string>;
  viewData: SettingsViewData["symptoms"];
  visibleState: ReturnType<typeof buildSettingsSymptomsState>;
};

export function SettingsSymptomsSection({
  createDraft,
  createErrorMessage,
  createStatusMessage,
  onArchive,
  onCreate,
  onCreateDraftChange,
  onRestore,
  onRowDraftChange,
  onUpdate,
  rowDrafts,
  rowErrorMessages,
  rowStatusMessages,
  viewData,
  visibleState,
}: SettingsSymptomsSectionProps) {
  return (
    <FeatureCard
      description={viewData.subtitle}
      testID="settings-symptoms-section"
      title={viewData.title}
    >
      <View style={styles.stack}>
        <SymptomEditorCard
          actionLabel={viewData.addLabel}
          draft={createDraft}
          errorMessage={createErrorMessage}
          hint={viewData.nameHint}
          iconLabel={viewData.iconLabel}
          iconOptions={viewData.iconOptions}
          nameLabel={viewData.nameLabel}
          namePlaceholder={viewData.namePlaceholder}
          onAction={onCreate}
          onDraftChange={onCreateDraftChange}
          statusMessage={createStatusMessage}
          testIDPrefix="settings-symptom-create"
          title={viewData.activeItem}
        />

        {visibleState.active.length > 0 ? (
          <View style={styles.stack}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{viewData.activeHeading}</Text>
              <Text style={styles.groupHint}>{viewData.activeHint}</Text>
            </View>
            {visibleState.active.map((record) => (
              <SymptomEditorCard
                key={record.id}
                actionLabel={viewData.saveLabel}
                draft={rowDrafts[record.id] ?? { label: record.label, icon: record.icon }}
                errorMessage={rowErrorMessages[record.id] ?? ""}
                hint={viewData.nameHint}
                iconLabel={viewData.iconLabel}
                iconOptions={viewData.iconOptions}
                label={record.label}
                nameLabel={viewData.nameLabel}
                namePlaceholder={viewData.namePlaceholder}
                onAction={() => onUpdate(record.id)}
                onDraftChange={(updates) => onRowDraftChange(record.id, updates)}
                statusMessage={rowStatusMessages[record.id] ?? ""}
                testIDPrefix={`settings-symptom-${record.id}`}
                title={viewData.activeItem}
              >
                <AppButton
                  label={viewData.hideLabel}
                  onPress={() => onArchive(record.id)}
                  testID={`settings-symptom-archive-${record.id}`}
                  variant="secondary"
                />
              </SymptomEditorCard>
            ))}
          </View>
        ) : visibleState.archived.length > 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.groupTitle}>{viewData.activeHeading}</Text>
            <Text style={styles.groupHint}>{viewData.emptyActive}</Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.groupHint}>{viewData.empty}</Text>
          </View>
        )}

        {visibleState.archived.length > 0 ? (
          <View style={styles.stack}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{viewData.archivedHeading}</Text>
              <Text style={styles.groupHint}>{viewData.archivedHint}</Text>
            </View>
            {visibleState.archived.map((record) => (
              <SymptomEditorCard
                key={record.id}
                actionLabel={viewData.saveLabel}
                archivedBadge={viewData.archivedBadge}
                draft={rowDrafts[record.id] ?? { label: record.label, icon: record.icon }}
                errorMessage={rowErrorMessages[record.id] ?? ""}
                hint={viewData.nameHint}
                iconLabel={viewData.iconLabel}
                iconOptions={viewData.iconOptions}
                isArchived
                label={record.label}
                nameLabel={viewData.nameLabel}
                namePlaceholder={viewData.namePlaceholder}
                onAction={() => onUpdate(record.id)}
                onDraftChange={(updates) => onRowDraftChange(record.id, updates)}
                statusMessage={rowStatusMessages[record.id] ?? ""}
                testIDPrefix={`settings-symptom-${record.id}`}
                title={viewData.archivedItem}
              >
                <AppButton
                  label={viewData.restoreLabel}
                  onPress={() => onRestore(record.id)}
                  testID={`settings-symptom-restore-${record.id}`}
                  variant="secondary"
                />
              </SymptomEditorCard>
            ))}
          </View>
        ) : null}
      </View>
    </FeatureCard>
  );
}

type SymptomEditorCardProps = {
  actionLabel: string;
  archivedBadge?: string;
  children?: ReactNode;
  draft: SymptomDraftValues;
  errorMessage: string;
  hint: string;
  iconLabel: string;
  iconOptions: { value: string; label: string }[];
  isArchived?: boolean;
  label?: string;
  nameLabel: string;
  namePlaceholder: string;
  onAction: () => void | Promise<void>;
  onDraftChange: (updates: Partial<SymptomDraftValues>) => void;
  statusMessage: string;
  testIDPrefix: string;
  title: string;
};

function SymptomEditorCard({
  actionLabel,
  archivedBadge,
  children,
  draft,
  errorMessage,
  hint,
  iconLabel,
  iconOptions,
  isArchived = false,
  label = "",
  nameLabel,
  namePlaceholder,
  onAction,
  onDraftChange,
  statusMessage,
  testIDPrefix,
  title,
}: SymptomEditorCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>
            {draft.icon} {label || draft.label || namePlaceholder}
          </Text>
          <Text style={styles.cardSubtitle}>{title}</Text>
        </View>
        {isArchived && archivedBadge ? (
          <Text style={styles.archivedBadge}>{archivedBadge}</Text>
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{nameLabel}</Text>
        <TextInput
          autoCapitalize="sentences"
          autoCorrect={false}
          onChangeText={(value) => onDraftChange({ label: value })}
          placeholder={namePlaceholder}
          style={styles.input}
          testID={`${testIDPrefix}-name-input`}
          value={draft.label}
        />
        <Text style={styles.helperText}>{hint}</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{iconLabel}</Text>
        <View style={styles.iconRow}>
          {iconOptions.map((option) => {
            const isSelected = draft.icon === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onDraftChange({ icon: option.value })}
                style={[
                  styles.iconOption,
                  isSelected ? styles.iconOptionSelected : null,
                ]}
                testID={`${testIDPrefix}-icon-${option.value}`}
              >
                <Text style={styles.iconOptionText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {errorMessage ? (
        <StatusBanner
          message={errorMessage}
          tone="error"
          testID={`${testIDPrefix}-error-banner`}
        />
      ) : null}
      {statusMessage ? (
        <StatusBanner
          message={statusMessage}
          tone="success"
          testID={`${testIDPrefix}-status-banner`}
        />
      ) : null}

      <View style={styles.actions}>
        <AppButton
          label={actionLabel}
          onPress={onAction}
          testID={`${testIDPrefix}-action-button`}
          variant="secondary"
        />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  groupHeader: {
    gap: spacing.xs,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  groupHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  cardTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  archivedBadge: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: "700",
  },
  formGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  iconOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconOptionSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  iconOptionText: {
    fontSize: 18,
  },
  actions: {
    gap: spacing.sm,
  },
});
