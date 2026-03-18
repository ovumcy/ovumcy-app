import { StyleSheet, Text, View } from "react-native";

import type { SettingsViewData } from "../../services/settings-view-service";
import { FeatureCard } from "./FeatureCard";
import { colors, spacing } from "../theme/tokens";

type SettingsStatusSectionProps = {
  title: string;
  description: string;
  rows: {
    label: string;
    value: string;
  }[];
  hint?: string;
  testID?: string;
};

export function SettingsStatusSection({
  title,
  description,
  rows,
  hint,
  testID,
}: SettingsStatusSectionProps) {
  return (
    <FeatureCard description={description} title={title}>
      <View style={styles.stack} testID={testID}>
        {rows.map((row) => (
          <View key={row.label} style={styles.panel}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </FeatureCard>
  );
}

export function buildInterfaceStatusRows(
  viewData: SettingsViewData["interface"],
): SettingsStatusSectionProps["rows"] {
  return [
    {
      label: viewData.languageLabel,
      value: viewData.languageValue,
    },
    {
      label: viewData.themeLabel,
      value: viewData.themeValue,
    },
  ];
}

export function buildAccountStatusRows(
  viewData: SettingsViewData["account"],
): SettingsStatusSectionProps["rows"] {
  return [
    {
      label: viewData.statusLabel,
      value: viewData.statusValue,
    },
  ];
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  panel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  value: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
