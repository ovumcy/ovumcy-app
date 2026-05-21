import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { AppButton } from "../components/AppButton";
import {
  type ConfirmationRequest,
  registerConfirmationListener,
} from "./confirmation-bridge";

type ConfirmDialogProviderProps = {
  children: ReactNode;
};

export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const styles = useThemedStyles(createStyles);
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const pendingRequestRef = useRef<ConfirmationRequest | null>(null);

  useEffect(
    () =>
      registerConfirmationListener((next) => {
        pendingRequestRef.current = next;
        setRequest(next);
      }),
    [],
  );

  const resolveWith = (value: boolean) => {
    const current = pendingRequestRef.current;
    if (!current) {
      return;
    }
    pendingRequestRef.current = null;
    current.resolve(value);
    setRequest(null);
  };

  return (
    <>
      {children}
      <Modal
        animationType="fade"
        onRequestClose={() => resolveWith(false)}
        transparent
        visible={request !== null}
      >
        <Pressable
          accessibilityLabel="dismiss-confirm-backdrop"
          onPress={() => resolveWith(false)}
          style={styles.backdrop}
          testID="confirm-dialog-backdrop"
        >
          <Pressable onPress={() => undefined} style={styles.dialog}>
            <Text style={styles.message} testID="confirm-dialog-message">
              {request?.message ?? ""}
            </Text>
            <View style={styles.actions}>
              <AppButton
                label={request?.cancelLabel ?? ""}
                onPress={() => resolveWith(false)}
                testID="confirm-dialog-cancel"
                variant="secondary"
              />
              <AppButton
                label={request?.acceptLabel ?? ""}
                onPress={() => resolveWith(true)}
                testID="confirm-dialog-accept"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    backdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    dialog: {
      backgroundColor: colors.surface,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.lg,
      maxWidth: 420,
      padding: spacing.lg,
      shadowColor: colors.shadowStrong,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.32,
      shadowRadius: 24,
      width: "100%",
    },
    message: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
    },
  });
