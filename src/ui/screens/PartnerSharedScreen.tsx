import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getDashboardCopy } from "../../i18n/dashboard-copy";
import { getDayLogCopy } from "../../i18n/day-log-copy";
import { getPartnerCopy } from "../../i18n/partner-copy";
import { getSettingsCopy } from "../../i18n/settings-copy";
import { loadManagedPartnerAccess } from "../../services/managed-partner-access-service";
import { loadManagedPartnerProjection } from "../../services/managed-partner-share-service";
import { buildPartnerSharedReadState } from "../../services/partner-shared-projection-service";
import {
  formatTemperatureValue,
  type TemperatureUnit,
} from "../../services/temperature-policy";
import type { PartnerShareSecretStore } from "../../security/partner-share-secret-store";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import { partnerShareSecretStore as defaultPartnerShareSecretStore } from "../../sync/app-partner-share-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
import { AppButton } from "../components/AppButton";
import { FeatureCard } from "../components/FeatureCard";
import { InlineBackButton } from "../components/InlineBackButton";
import { PredictionDisclaimer } from "../components/PredictionDisclaimer";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { StatusBanner } from "../components/StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { useAppPreferences } from "../providers/AppPreferencesProvider";

type PartnerSharedScreenProps = {
  now?: Date | undefined;
  partnerShareSecretStore?: PartnerShareSecretStore;
  syncSecretStore?: SyncSecretStore;
};

export function PartnerSharedScreen({
  now,
  partnerShareSecretStore = defaultPartnerShareSecretStore,
  syncSecretStore = defaultSyncSecretStore,
}: PartnerSharedScreenProps) {
  const router = useRouter();
  const { language, colors } = useAppPreferences();
  const styles = useThemedStyles(createStyles);
  const copy = getPartnerCopy(language);
  const dayLogCopy = getDayLogCopy(language);
  const dashboardCopy = getDashboardCopy(language);
  const settingsCopy = getSettingsCopy(language);
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [readState, setReadState] = useState<ReturnType<
    typeof buildPartnerSharedReadState
  > | null>(null);
  const params = useLocalSearchParams<{ grant_id?: string | string[] }>();

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function load() {
        setIsLoading(true);
        setErrorMessage("");
        setReadState(null);

        const grantID = Array.isArray(params.grant_id)
          ? params.grant_id[0] ?? ""
          : params.grant_id ?? "";
        const trimmedGrantID = String(grantID).trim();
        if (trimmedGrantID.length === 0) {
          if (isMounted) {
            setErrorMessage(copy.errors.partnerAccessNotFound);
            setIsLoading(false);
          }
          return;
        }

        const accessResult = await loadManagedPartnerAccess(syncSecretStore, "managed");
        if (!accessResult.ok) {
          if (isMounted) {
            setErrorMessage(resolveSharedViewErrorMessage(accessResult.errorCode, copy));
            setIsLoading(false);
          }
          return;
        }

        const grant =
          accessResult.value.sharedWithMe.find((item) => item.id === trimmedGrantID) ??
          accessResult.value.owned.grants.find((item) => item.id === trimmedGrantID) ??
          null;
        if (!grant) {
          if (isMounted) {
            setErrorMessage(copy.errors.partnerAccessNotFound);
            setIsLoading(false);
          }
          return;
        }

        const projectionResult = await loadManagedPartnerProjection(
          syncSecretStore,
          partnerShareSecretStore,
          "managed",
          grant,
        );
        if (!projectionResult.ok) {
          if (isMounted) {
            setErrorMessage(resolveSharedViewErrorMessage(projectionResult.errorCode, copy));
            setIsLoading(false);
          }
          return;
        }

        if (!isMounted) {
          return;
        }

        setReadState(buildPartnerSharedReadState(projectionResult.value, effectiveNow, language));
        setIsLoading(false);
      }

      void load();
      return () => {
        isMounted = false;
      };
    }, [copy, effectiveNow, language, params.grant_id, partnerShareSecretStore, syncSecretStore]),
  );

  if (isLoading) {
    return (
      <ScreenScaffold
        title={copy.sharedViewLoadingTitle}
        description={copy.sharedViewLoadingSubtitle}
        topAccessory={
          <InlineBackButton
            label={copy.sharedViewBackLabel}
            onPress={() => router.back()}
            testID="partner-shared-back-button"
          />
        }
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title={copy.sharedViewTitle}
      description={copy.sharedViewSubtitle}
      topAccessory={
        <InlineBackButton
          label={copy.sharedViewBackLabel}
          onPress={() => router.back()}
          testID="partner-shared-back-button"
        />
      }
      footer={
        <PredictionDisclaimer
          testID="partner-shared-prediction-disclaimer"
          text={dashboardCopy.predictionDisclaimer}
        />
      }
    >
      {errorMessage ? (
        <StatusBanner
          message={errorMessage}
          testID="partner-shared-error-banner"
          tone="error"
        />
      ) : null}

      {readState ? (
        <>
          {readState.isStale ? (
            <StatusBanner
              message={copy.sharedViewStaleNotice}
              testID="partner-shared-stale-banner"
              tone="info"
            />
          ) : null}

          <FeatureCard
            description={
              readState.accessLevel === "full"
                ? copy.sharedViewFullHint
                : copy.sharedViewSummaryHint
            }
            testID="partner-shared-summary-card"
            title={copy.sharedViewMetricsTitle}
          >
            {!readState.isStale ? (
              <View style={styles.metricGrid}>
                <MetricItem
                  label={copy.sharedViewCycleDayLabel}
                  value={
                    readState.cycleStatus.currentCycleDay === null
                      ? "—"
                      : String(readState.cycleStatus.currentCycleDay)
                  }
                />
                <MetricItem
                  label={copy.sharedViewNextPeriodLabel}
                  value={formatDateRange(
                    readState.cycleStatus.nextPeriodWindowStartDate,
                    readState.cycleStatus.nextPeriodWindowEndDate,
                    language,
                  )}
                />
              </View>
            ) : null}
            <View style={styles.metricGrid}>
              <MetricItem
                label={copy.sharedViewLastCycleLabel}
                value={formatMetricDays(
                  readState.summaryMetrics.lastCycleLength,
                  settingsCopy.common.daysShort,
                )}
              />
              <MetricItem
                label={copy.sharedViewAverageCycleLabel}
                value={formatMetricDays(
                  readState.summaryMetrics.averageCycleLength,
                  settingsCopy.common.daysShort,
                )}
              />
              <MetricItem
                label={copy.sharedViewAveragePeriodLabel}
                value={formatMetricDays(
                  readState.summaryMetrics.averagePeriodLength,
                  settingsCopy.common.daysShort,
                )}
              />
              <MetricItem
                label={copy.sharedViewLoggedDaysLabel}
                value={String(readState.summaryMetrics.totalLoggedDays)}
              />
            </View>
            <Text style={styles.helperText}>
              {copy.sharedViewGeneratedAtLabel}:{" "}
              {new Intl.DateTimeFormat(language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(readState.generatedAt))}
            </Text>
            {!readState.isStale ? (
              <Text style={styles.helperText}>
                {readState.cycleStatus.predictionExplanation}
              </Text>
            ) : null}
            <Text style={styles.helperText}>
              {copy.sharedViewTopSymptomsLabel}:{" "}
              {readState.summaryMetrics.topSymptoms.length > 0
                ? readState.summaryMetrics.topSymptoms.join(", ")
                : "—"}
            </Text>
          </FeatureCard>

          <FeatureCard
            description={
              readState.recentRows.length > 0
                ? copy.sharedViewHistoryQualifier
                : ""
            }
            testID="partner-shared-history-card"
            title={copy.sharedViewHistoryTitle}
          >
            {readState.recentRows.length === 0 ? (
              <Text style={styles.helperText}>{copy.sharedViewHistoryEmpty}</Text>
            ) : (
              <View style={styles.historyStack}>
                {readState.recentRows.map((row) => {
                  const historyDetailText = buildHistoryDetailText(
                    row,
                    language,
                    readState.temperatureUnit,
                  );

                  return (
                    <View
                      key={row.date}
                      style={styles.historyItem}
                      testID={`partner-shared-row-${row.date}`}
                    >
                      <Text style={styles.itemTitle}>{formatHistoryDate(row.date, language)}</Text>
                      {historyDetailText.length > 0 ? (
                        <Text style={styles.helperText}>{historyDetailText}</Text>
                      ) : null}
                      {row.symptomSummary ? (
                        <Text style={styles.helperText}>{row.symptomSummary}</Text>
                      ) : null}
                      {row.cycleFactors.length > 0 ? (
                        <Text style={styles.helperText}>
                          {row.cycleFactors
                            .map((factor) => resolveCycleFactorLabel(dayLogCopy, factor))
                            .join(", ")}
                        </Text>
                      ) : null}
                      {row.notes ? <Text style={styles.notes}>{row.notes}</Text> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </FeatureCard>
        </>
      ) : (
        <FeatureCard testID="partner-shared-empty-card" title={copy.sharedViewTitle}>
          <StatusBanner
            message={copy.sharedViewNotReady}
            testID="partner-shared-not-ready-banner"
          />
          <AppButton
            label={copy.sharedViewBackLabel}
            onPress={() => router.back()}
            testID="partner-shared-empty-back-button"
            variant="secondary"
          />
        </FeatureCard>
      )}
    </ScreenScaffold>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatMetricDays(value: number, daysShort: string): string {
  return value > 0 ? `${value} ${daysShort}` : "—";
}

function formatHistoryDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function buildHistoryDetailText(
  row: ReturnType<typeof buildPartnerSharedReadState>["recentRows"][number],
  locale: string,
  temperatureUnit: TemperatureUnit,
): string {
  const dayLogCopy = getDayLogCopy(locale);
  const flowLabel =
    row.flow.length > 0
      ? `${dayLogCopy.flow}: ${resolveDayLogOptionLabel(dayLogCopy.options.flow, row.flow)}`
      : "";
  const moodLabel =
    row.moodRating > 0 ? `${dayLogCopy.mood}: ${row.moodRating}/5` : "";
  const sexLabel =
    row.sexActivity.length > 0
      ? `${dayLogCopy.intimacy}: ${resolveDayLogOptionLabel(
          dayLogCopy.options.sexActivity,
          row.sexActivity,
        )}`
      : "";
  const bbtLabel =
    row.bbt > 0
      ? `${dayLogCopy.bbt}: ${formatTemperatureValue(row.bbt, temperatureUnit)} ${
          temperatureUnit === "f" ? "°F" : "°C"
        }`
      : "";
  const cervicalMucusLabel =
    row.cervicalMucus.length > 0
      ? `${dayLogCopy.cervicalMucus}: ${resolveDayLogOptionLabel(
          dayLogCopy.options.cervicalMucus,
          row.cervicalMucus,
        )}`
      : "";
  const lhTestLabel =
    row.lhTest.length > 0
      ? `${dayLogCopy.lhTest}: ${resolveDayLogOptionLabel(dayLogCopy.options.lhTest, row.lhTest)}`
      : "";

  return [
    row.period ? dayLogCopy.periodDay : "",
    flowLabel,
    moodLabel,
    sexLabel,
    bbtLabel,
    cervicalMucusLabel,
    lhTestLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

function resolveDayLogOptionLabel<
  TValue extends string | number,
  TOption extends { value: TValue; label: string },
>(options: readonly TOption[], value: string): string {
  return options.find((option) => String(option.value) === value)?.label ?? value;
}

function resolveCycleFactorLabel(
  dayLogCopy: ReturnType<typeof getDayLogCopy>,
  factor: string,
): string {
  const cycleFactorCatalog = dayLogCopy.options.cycleFactors as Record<
    string,
    { label: string }
  >;
  return cycleFactorCatalog[factor]?.label ?? factor;
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null,
  locale: string,
): string {
  if (!startDate && !endDate) {
    return "—";
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });
  const startLabel = startDate ? formatter.format(new Date(`${startDate}T00:00:00`)) : null;
  const endLabel = endDate ? formatter.format(new Date(`${endDate}T00:00:00`)) : null;
  if (startLabel && endLabel && startLabel !== endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel ?? endLabel ?? "—";
}

function resolveSharedViewErrorMessage(
  errorCode: string,
  copy: ReturnType<typeof getPartnerCopy>,
): string {
  switch (errorCode) {
    case "share_key_unavailable":
      return copy.sharedViewLocked;
    case "partner_projection_not_found":
      return copy.sharedViewNotReady;
    case "invalid_partner_projection":
      return copy.errors.generic;
    case "not_connected":
      return copy.errors.notConnected;
    default:
      return copy.errors.generic;
  }
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    historyItem: {
      borderColor: colors.lineSoft,
      borderRadius: 14,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    historyStack: {
      gap: spacing.sm,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    loadingWrap: {
      alignItems: "center",
      paddingVertical: 24,
    },
    metricGrid: {
      gap: spacing.sm,
    },
    metricItem: {
      gap: 2,
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    metricValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    notes: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 21,
    },
  });
