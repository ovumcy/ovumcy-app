import { StyleSheet, Text, View } from "react-native";

import type { ManualCycleStartViewData } from "../../services/manual-cycle-start-service";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { AppButton } from "./AppButton";

type ManualCycleStartActionProps = {
  disabled?: boolean;
  onPress: () => void | Promise<void>;
  testID?: string;
  viewData: ManualCycleStartViewData;
};

export function ManualCycleStartAction({
  disabled = false,
  onPress,
  testID,
  viewData,
}: ManualCycleStartActionProps) {
  const styles = useThemedStyles(createStyles);
  const notices = [
    viewData.notices.future,
    viewData.notices.suggestion,
    viewData.notices.implantation,
  ].filter((message): message is string => Boolean(message));

  const buttonProps = testID ? { testID } : {};

  return (
    <View style={styles.container}>
      <AppButton
        disabled={disabled}
        label={viewData.buttonLabel}
        onPress={onPress}
        variant={viewData.isActive ? "primary" : "secondary"}
        {...buttonProps}
      />
      {notices.length > 0 ? (
        <View style={styles.noticeGroup}>
          {notices.map((message) => (
            <Text key={message} style={styles.noticeText}>
              {message}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    noticeGroup: {
      gap: spacing.xs,
    },
    noticeText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
  });
