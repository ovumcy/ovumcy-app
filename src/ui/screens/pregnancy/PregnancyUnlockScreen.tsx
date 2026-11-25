import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import {
  loadPregnancyUnlockOffer,
  purchasePregnancyModule,
  restorePregnancyModulePurchase,
  type PregnancyPurchaseResult,
  type PregnancyRestoreResult,
  type PregnancyUnlockOffer,
} from "../../../services/pregnancy-purchase-service";
import { AppButton } from "../../components/AppButton";
import { FeatureCard } from "../../components/FeatureCard";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { StatusBanner } from "../../components/StatusBanner";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

// The one-time purchase screen for the pregnancy module. It is the only door
// a locked pregnancy surface may open: nothing here reads a plan, a session or
// the billing snapshot, and nothing routes to the subscription screen.
type PregnancyUnlockScreenProps = {
  loadOffer?: () => Promise<PregnancyUnlockOffer>;
  purchase?: () => Promise<PregnancyPurchaseResult>;
  restore?: () => Promise<PregnancyRestoreResult>;
};

type Notice = "cancelled" | "restore_not_found" | null;

export function PregnancyUnlockScreen({
  loadOffer = loadPregnancyUnlockOffer,
  purchase = purchasePregnancyModule,
  restore = restorePregnancyModulePurchase,
}: PregnancyUnlockScreenProps) {
  const router = useRouter();
  const { colors, language } = useAppPreferences();
  const styles = useThemedStyles(createStyles);
  const copy = getPregnancyCopy(language);
  const [offer, setOffer] = useState<PregnancyUnlockOffer | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isMounted = useRef(true);

  const reloadOffer = useCallback(async () => {
    setNotice(null);
    setOffer(null);
    const next = await loadOffer();
    if (isMounted.current) {
      setOffer(next);
    }
  }, [loadOffer]);

  useEffect(() => {
    isMounted.current = true;
    void reloadOffer();

    return () => {
      isMounted.current = false;
    };
  }, [reloadOffer]);

  async function handleBuy() {
    setIsBusy(true);
    setNotice(null);
    const result = await purchase();
    if (!isMounted.current) {
      return;
    }
    setIsBusy(false);
    if (result === "cancelled") {
      setNotice("cancelled");
      return;
    }
    setOffer({ status: result });
  }

  async function handleRestore() {
    setIsBusy(true);
    setNotice(null);
    const result = await restore();
    if (!isMounted.current) {
      return;
    }
    setIsBusy(false);
    if (result === "not_found") {
      setNotice("restore_not_found");
      return;
    }
    setOffer({ status: result });
  }

  const restoreButton = (
    <AppButton
      disabled={isBusy}
      label={copy.unlock.restoreCta}
      onPress={handleRestore}
      testID="pregnancy-unlock-restore-button"
      variant="secondary"
    />
  );

  return (
    <ScreenScaffold
      description={copy.unlock.subtitle}
      eyebrow={copy.entryCard.eyebrow}
      title={copy.unlock.title}
    >
      {offer === null ? (
        <View style={styles.loading} testID="pregnancy-unlock-loading">
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : null}

      {offer?.status === "available" ? (
        <FeatureCard testID="pregnancy-unlock-offer">
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{copy.unlock.priceLabel}</Text>
            <Text style={styles.priceValue} testID="pregnancy-unlock-price">
              {offer.displayPrice}
            </Text>
          </View>
          <Text style={styles.bodyText}>{copy.unlock.dataNote}</Text>
          {notice === "cancelled" ? (
            <StatusBanner
              message={copy.unlock.cancelledNotice}
              testID="pregnancy-unlock-cancelled"
              tone="info"
            />
          ) : null}
          {notice === "restore_not_found" ? (
            <StatusBanner
              message={copy.unlock.restoreNotFoundNotice}
              testID="pregnancy-unlock-restore-not-found"
              tone="info"
            />
          ) : null}
          <View style={styles.actions}>
            {restoreButton}
            <AppButton
              disabled={isBusy}
              label={copy.unlock.buyCta}
              onPress={handleBuy}
              testID="pregnancy-unlock-buy-button"
            />
          </View>
        </FeatureCard>
      ) : null}

      {offer?.status === "owned" ? (
        <FeatureCard
          description={copy.unlock.ownedBody}
          testID="pregnancy-unlock-owned"
          title={copy.unlock.ownedTitle}
        >
          <View style={styles.actions}>
            <AppButton
              label={copy.entryCard.unlockedCta}
              onPress={() => router.replace("/pregnancy-start")}
              testID="pregnancy-unlock-continue-button"
            />
          </View>
        </FeatureCard>
      ) : null}

      {offer?.status === "pending" ? (
        <FeatureCard
          description={copy.unlock.pendingBody}
          testID="pregnancy-unlock-pending"
          title={copy.unlock.pendingTitle}
        >
          <View style={styles.actions}>
            <AppButton
              disabled={isBusy}
              label={copy.unlock.checkAgainCta}
              onPress={reloadOffer}
              testID="pregnancy-unlock-check-again-button"
              variant="secondary"
            />
          </View>
        </FeatureCard>
      ) : null}

      {offer?.status === "unavailable" ? (
        <FeatureCard
          description={copy.unlock.unavailableBody}
          testID="pregnancy-unlock-unavailable"
          title={copy.unlock.unavailableTitle}
        >
          {notice === "restore_not_found" ? (
            <StatusBanner
              message={copy.unlock.restoreNotFoundNotice}
              testID="pregnancy-unlock-restore-not-found"
              tone="info"
            />
          ) : null}
          <View style={styles.actions}>
            {restoreButton}
            <AppButton
              disabled={isBusy}
              label={copy.unlock.retryCta}
              onPress={reloadOffer}
              testID="pregnancy-unlock-retry-button"
            />
          </View>
        </FeatureCard>
      ) : null}
    </ScreenScaffold>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    loading: {
      alignItems: "center",
      paddingVertical: 24,
    },
    priceRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    priceLabel: {
      color: colors.textMuted,
      flexShrink: 1,
      fontSize: 13,
    },
    priceValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "right",
    },
    bodyText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "flex-end",
      marginTop: spacing.xs,
    },
  });
