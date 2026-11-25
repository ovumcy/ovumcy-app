import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { DataSharingConsentViewData } from "../../../services/data-sharing-consent-service";
import { openPrivacyPolicy } from "../../../services/privacy-notice-service";
import { AppButton } from "../../components/AppButton";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type DataSharingConsentDialogProps = {
  consent: DataSharingConsentViewData | null;
  onAnswer: (accepted: boolean) => void;
};

/**
 * Explicit consent before health data first leaves the device. Only the agree
 * button answers true; Back, the decline button and anything else answer
 * false, and the caller then sends nothing.
 */
export function DataSharingConsentDialog({
  consent,
  onAnswer,
}: DataSharingConsentDialogProps) {
  const styles = useThemedStyles(createStyles);
  const [policyUnavailable, setPolicyUnavailable] = useState(false);

  async function handleOpenPolicy() {
    const opened = await openPrivacyPolicy();
    setPolicyUnavailable(!opened);
  }

  function answer(accepted: boolean) {
    setPolicyUnavailable(false);
    onAnswer(accepted);
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => answer(false)}
      transparent
      visible={consent !== null}
    >
      <View style={styles.backdrop}>
        {consent ? (
          <View
            accessibilityViewIsModal
            style={styles.dialog}
            testID="data-sharing-consent-dialog"
          >
            <ScrollView contentContainerStyle={styles.content}>
              <Text accessibilityRole="header" style={styles.title}>
                {consent.title}
              </Text>
              <Text style={styles.body}>{consent.intro}</Text>
              <Text style={styles.heading}>{consent.leavesHeading}</Text>
              {consent.items.map((item) => (
                <Text key={item} style={styles.item}>
                  {`• ${item}`}
                </Text>
              ))}
              {consent.excluded ? (
                <Text style={styles.body}>{consent.excluded}</Text>
              ) : null}
              <Text style={styles.body}>{consent.recipient}</Text>
              <Text style={styles.body}>{consent.encryption}</Text>
              <Text style={styles.body}>{consent.withdrawal}</Text>
              <Text style={styles.muted}>{consent.legalBasis}</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  void handleOpenPolicy();
                }}
                testID="data-sharing-consent-policy-link"
              >
                <Text style={styles.link}>{consent.policyLinkLabel}</Text>
              </Pressable>
              {policyUnavailable ? (
                <Text selectable style={styles.muted}>
                  {`${consent.policyUnavailable} ${consent.policyURL}`}
                </Text>
              ) : null}
            </ScrollView>
            <View style={styles.actions}>
              <AppButton
                label={consent.declineLabel}
                onPress={() => answer(false)}
                testID="data-sharing-consent-decline"
                variant="secondary"
              />
              <AppButton
                label={consent.agreeLabel}
                onPress={() => answer(true)}
                testID="data-sharing-consent-agree"
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    backdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
    },
    dialog: {
      backgroundColor: colors.surface,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.md,
      maxHeight: "100%",
      maxWidth: 480,
      padding: spacing.lg,
      shadowColor: colors.shadowStrong,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.32,
      shadowRadius: 24,
      width: "100%",
    },
    content: {
      gap: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 24,
    },
    heading: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 22,
      marginTop: spacing.xs,
    },
    body: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    item: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      paddingLeft: spacing.xs,
    },
    muted: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    link: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
      textDecorationLine: "underline",
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
    },
  });
