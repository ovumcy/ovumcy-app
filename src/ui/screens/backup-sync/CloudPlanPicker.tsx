import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type {
  CloudSubscriptionBasePlanId,
  StoreSubscriptionPlan,
} from "../../../billing/store-contract";
import { getCloudPlanCopy } from "../../../i18n/cloud-plan-copy";
import {
  loadCloudSubscriptionPlans,
  purchaseCloudSubscription,
} from "../../../services/cloud-subscription-service";
import { AppButton } from "../../components/AppButton";
import { StatusBanner } from "../../components/StatusBanner";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type CloudPlanPickerProps = {
  disabled?: boolean;
  // A completed sheet grants nothing here: the caller re-reads the billing
  // snapshot, the only premium authority.
  onPurchaseCompleted: () => void | Promise<void>;
};

type Feedback = { tone: "info" | "error"; message: string } | null;

export function CloudPlanPicker({
  disabled = false,
  onPurchaseCompleted,
}: CloudPlanPickerProps) {
  const { language } = useAppPreferences();
  const styles = useThemedStyles(createStyles);
  const copy = getCloudPlanCopy(language);
  const [plans, setPlans] = useState<readonly StoreSubscriptionPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let active = true;
    void loadCloudSubscriptionPlans().then((loaded) => {
      if (active) {
        setPlans(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (plans.length === 0) {
    return null;
  }

  async function handlePurchase(basePlanId: CloudSubscriptionBasePlanId) {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await purchaseCloudSubscription(basePlanId);
      if (result === "completed") {
        setFeedback({ tone: "info", message: copy.purchaseCompleted });
        await onPurchaseCompleted();
      } else if (result === "unavailable") {
        setFeedback({ tone: "error", message: copy.purchaseUnavailable });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container} testID="settings-sync-cloud-plan-picker">
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      {plans.map((plan) => (
        <AppButton
          disabled={disabled || busy}
          key={plan.basePlanId}
          label={
            plan.basePlanId === "monthly"
              ? copy.monthlyLabel(plan.displayPrice)
              : copy.yearlyLabel(plan.displayPrice)
          }
          onPress={() => handlePurchase(plan.basePlanId)}
          testID={`settings-sync-cloud-plan-${plan.basePlanId}`}
          variant={plan.basePlanId === "yearly" ? "primary" : "secondary"}
        />
      ))}
      {plans.some((plan) => plan.freeTrial) ? (
        <Text style={styles.note} testID="settings-sync-cloud-plan-trial">{copy.freeTrialNote}</Text>
      ) : null}
      {feedback ? (
        <StatusBanner
          message={feedback.message}
          testID="settings-sync-cloud-plan-feedback"
          tone={feedback.tone}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    note: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
