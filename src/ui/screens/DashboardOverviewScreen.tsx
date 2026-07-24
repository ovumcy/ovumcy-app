import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DayLogRecord } from "../../models/day-log";
import type { ManualCycleStartViewData } from "../../services/manual-cycle-start-service";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import type {
  DashboardViewData,
  PregnancyEntryCardViewData,
} from "../../services/dashboard-view-service";
import type { PregnancyDashboardViewData } from "../../services/pregnancy-mode-service";
import type {
  PostpartumCycleReturnOfferViewData,
  PostpartumDashboardViewData,
} from "../../services/postpartum-mode-service";
import type { CrisisSupportViewData } from "../../i18n/crisis-copy";
import { AppButton } from "../components/AppButton";
import { CrisisSupportCard } from "../components/CrisisSupportCard";
import {
  DayLogEditorCard,
  type DayLogEditorSectionKey,
} from "../components/DayLogEditorCard";
import { FeatureCard } from "../components/FeatureCard";
import { InsightSummaryCard } from "../components/InsightSummaryCard";
import { ManualCycleStartAction } from "../components/ManualCycleStartAction";
import { PredictionDisclaimer } from "../components/PredictionDisclaimer";
import { PregnancyDisclaimer } from "../components/PregnancyDisclaimer";
import { PremiumLockCard } from "../components/PremiumLockCard";
import { AppScreenSurface } from "../components/AppScreenSurface";
import { resolveBottomContentPadding } from "../layout/bottom-content-padding";
import type { AppThemeColors } from "../theme/tokens";
import { fontScale, spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { DashboardCycleHero } from "./dashboard/DashboardCycleHero";

type DashboardQuickActionKey = "period" | "mood" | "symptom";

type DashboardOverviewScreenProps = {
  bleedingSafetyHint: string | null;
  entryExists: boolean;
  editorViewData: DayLogEditorViewData;
  isSaving: boolean;
  onDelete: () => void | Promise<void>;
  onManualCycleStart?: (() => void | Promise<void>) | undefined;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onSave: () => void | Promise<void>;
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "error" | "info" | "success" | undefined;
  viewData: DashboardViewData;
  manualCycleStart?: ManualCycleStartViewData | null;
  showsSaveAction?: boolean;
  onStartPregnancyPress?: (() => void) | undefined;
  onPremiumCTAPress?: (() => void) | undefined;
  onBirthPress?: (() => void) | undefined;
  onManagePregnancyPress?: (() => void) | undefined;
  onManagePostpartumPress?: (() => void) | undefined;
  // Cycle-return offer: accepting ends postpartum tracking with
  // reason "cycle_returned" (confirm dialog + service call + refresh owned by
  // the container). `isAcceptingCycleReturn` disables the accept/keep row
  // while that's in flight, mirroring PregnancyEndScreen's isEndingPostpartum
  // guard.
  onAcceptCycleReturn?:
    | ((offer: PostpartumCycleReturnOfferViewData) => void | Promise<void>)
    | undefined;
  isAcceptingCycleReturn?: boolean;
  onStartScreeningPress?: (() => void) | undefined;
  onOpenScreeningHistoryPress?: (() => void) | undefined;
  onKickCounterPress?: (() => void) | undefined;
  onContractionTimerPress?: (() => void) | undefined;
  // Crisis-support. `crisisSupport` is built by the container from the
  // owner's profile contact; `onSaveCrisisContact` persists an inline edit. Both
  // feed the postpartum support-resources row. NEVER premium-gated.
  crisisSupport?: CrisisSupportViewData | undefined;
  onSaveCrisisContact?:
    | ((contact: { name: string; phone: string }) => void | Promise<void>)
    | undefined;
};

export function DashboardOverviewScreen({
  bleedingSafetyHint,
  entryExists,
  editorViewData,
  isSaving,
  onDelete,
  onManualCycleStart,
  onPatch,
  onSave,
  record,
  statusMessage,
  statusTone,
  viewData,
  manualCycleStart,
  showsSaveAction = true,
  onStartPregnancyPress,
  onPremiumCTAPress,
  onBirthPress,
  onManagePregnancyPress,
  onManagePostpartumPress,
  onAcceptCycleReturn,
  isAcceptingCycleReturn = false,
  onStartScreeningPress,
  onOpenScreeningHistoryPress,
  onKickCounterPress,
  onContractionTimerPress,
  crisisSupport,
  onSaveCrisisContact,
}: DashboardOverviewScreenProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const editorCardOffsetRef = useRef(0);
  const quickActionFrameRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionOffsetsRef = useRef<
    Partial<Record<DayLogEditorSectionKey, number>>
  >({});
  const [activeQuickAction, setActiveQuickAction] = useState<DashboardQuickActionKey | null>(
    null,
  );
  const [highlightedSection, setHighlightedSection] = useState<DayLogEditorSectionKey | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (quickActionFrameRef.current !== null) {
        cancelAnimationFrame(quickActionFrameRef.current);
        quickActionFrameRef.current = null;
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, []);

  function scrollToSection(key: DayLogEditorSectionKey) {
    const offset = sectionOffsetsRef.current[key];
    if (offset === undefined) {
      return;
    }

    scrollViewRef.current?.scrollTo({
      animated: true,
      y: Math.max(offset - 156, 0),
    });
  }

  function highlightSection(
    key: DayLogEditorSectionKey,
    action: DashboardQuickActionKey,
  ) {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    setActiveQuickAction(action);
    setHighlightedSection(key);
    highlightTimeoutRef.current = setTimeout(() => {
      setActiveQuickAction((current) => (current === action ? null : current));
      setHighlightedSection((current) => (current === key ? null : current));
      highlightTimeoutRef.current = null;
    }, 1500);
  }

  function handleQuickAction(action: DashboardQuickActionKey) {
    switch (action) {
      case "period":
        onPatch({ isPeriod: !record.isPeriod });
        highlightSection("period", action);
        if (quickActionFrameRef.current !== null) {
          cancelAnimationFrame(quickActionFrameRef.current);
        }
        quickActionFrameRef.current = requestAnimationFrame(() => {
          scrollToSection("period");
          quickActionFrameRef.current = null;
        });
        break;
      case "mood":
        highlightSection("mood", action);
        scrollToSection("mood");
        break;
      case "symptom":
        highlightSection("symptoms", action);
        scrollToSection("symptoms");
        break;
    }
  }

  const isPregnancyMode =
    viewData.mode === "pregnancy" && Boolean(viewData.pregnancyDashboard);

  return (
    <AppScreenSurface>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: resolveBottomContentPadding(insets.bottom) },
        ]}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          {isPregnancyMode && viewData.pregnancyDashboard ? (
            <DashboardPregnancyMode
              onBirthPress={onBirthPress}
              onContractionTimerPress={onContractionTimerPress}
              onKickCounterPress={onKickCounterPress}
              onManagePress={onManagePregnancyPress}
              viewData={viewData.pregnancyDashboard}
            />
          ) : (
          <>
          {viewData.mode === "postpartum" && viewData.postpartumDashboard ? (
            <DashboardPostpartumMode
              crisisSupport={crisisSupport}
              isAcceptingCycleReturn={isAcceptingCycleReturn}
              onAcceptCycleReturn={onAcceptCycleReturn}
              onManagePress={onManagePostpartumPress}
              onSaveCrisisContact={onSaveCrisisContact}
              onStartScreeningPress={onStartScreeningPress}
              onOpenScreeningHistoryPress={onOpenScreeningHistoryPress}
              viewData={viewData.postpartumDashboard}
            />
          ) : null}

          {viewData.postpartumStaleCard ? (
            <FeatureCard
              testID="dashboard-postpartum-stale-card"
              title={viewData.postpartumStaleCard.title}
            >
              <Text style={styles.helperText}>
                {viewData.postpartumStaleCard.body}
              </Text>
              <AppButton
                label={viewData.postpartumStaleCard.ctaLabel}
                onPress={onManagePostpartumPress ?? (() => {})}
                testID="dashboard-postpartum-stale-card-cta"
              />
            </FeatureCard>
          ) : null}

          <DashboardCycleHero viewData={viewData.cycleHero} />

          {viewData.predictionExplanation ? (
            <Text style={styles.helperText} testID="dashboard-prediction-explanation">
              {viewData.predictionExplanation}
            </Text>
          ) : null}

          <PredictionDisclaimer
            testID="dashboard-prediction-disclaimer"
            text={viewData.predictionDisclaimer}
          />

          {viewData.pregnancyEntryCard ? (
            <PregnancyEntryCard
              onPremiumCTAPress={onPremiumCTAPress}
              onStartPress={onStartPregnancyPress}
              viewData={viewData.pregnancyEntryCard}
            />
          ) : null}

          {viewData.staleCard ? (
            <FeatureCard
              testID="dashboard-pregnancy-stale-card"
              title={viewData.staleCard.title}
            >
              <Text style={styles.helperText}>{viewData.staleCard.body}</Text>
              <AppButton
                label={viewData.staleCard.ctaLabel}
                onPress={onManagePregnancyPress ?? (() => {})}
                testID="dashboard-pregnancy-stale-card-cta"
              />
            </FeatureCard>
          ) : null}

          {viewData.advancedFertilitySummary ? (
            <InsightSummaryCard
              testID="dashboard-advanced-fertility-summary"
              viewData={viewData.advancedFertilitySummary}
            />
          ) : null}

          <View style={styles.quickActionsBlock}>
            <Text
              accessibilityRole="header"
              style={styles.quickActionsTitle}
              testID="dashboard-quick-actions-title"
            >
              {viewData.quickActionsTitle}
            </Text>
            <View style={styles.quickActions}>
              <QuickActionButton
                active={record.isPeriod}
                icon="🩸"
                label={viewData.quickActions.period}
                onPress={() => handleQuickAction("period")}
                testID="dashboard-quick-action-period"
              />
              <QuickActionButton
                active={activeQuickAction === "mood"}
                icon="😊"
                label={viewData.quickActions.mood}
                onPress={() => handleQuickAction("mood")}
                testID="dashboard-quick-action-mood"
              />
              <QuickActionButton
                active={activeQuickAction === "symptom"}
                icon="💊"
                label={viewData.quickActions.symptom}
                onPress={() => handleQuickAction("symptom")}
                testID="dashboard-quick-action-symptom"
              />
            </View>
          </View>

          <View
            onLayout={(event) => {
              editorCardOffsetRef.current = event.nativeEvent.layout.y;
            }}
          >
            <DayLogEditorCard
              bleedingSafetyHint={bleedingSafetyHint}
              entryExists={entryExists}
              highlightedSection={highlightedSection}
              isSaving={isSaving}
              onDelete={onDelete}
              onPatch={onPatch}
              onSave={onSave}
              onSectionLayout={(key, y) => {
                sectionOffsetsRef.current[key] = editorCardOffsetRef.current + y;
              }}
              record={record}
              showsSaveAction={showsSaveAction}
              statusMessage={statusMessage}
              statusTone={statusTone}
              viewData={{
                ...editorViewData,
                title: viewData.journal.title,
                subtitle: viewData.journal.dateLabel,
                dateLabel: "",
              }}
            />
          </View>

          {manualCycleStart && onManualCycleStart ? (
            <ManualCycleStartAction
              disabled={isSaving}
              onPress={onManualCycleStart}
              testID="dashboard-manual-cycle-start-button"
              viewData={manualCycleStart}
            />
          ) : null}
          </>
          )}
        </View>
      </ScrollView>
    </AppScreenSurface>
  );
}

function QuickActionButton({
  active = false,
  icon,
  label,
  onPress,
  testID,
}: {
  active?: boolean;
  icon: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.quickActionButton, active ? styles.quickActionButtonActive : null]}
      testID={testID}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={[styles.quickActionLabel, active ? styles.quickActionLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

// Presentational pregnancy-mode surfaces. Both render purely from view-data —
// no gestational-age math, record reads, or pause checks (all decided in
// dashboard-view-service). PregnancyDisclaimer renders unconditionally here.
function DashboardPregnancyMode({
  viewData,
  onBirthPress,
  onContractionTimerPress,
  onKickCounterPress,
  onManagePress,
}: {
  viewData: PregnancyDashboardViewData;
  onBirthPress?: (() => void) | undefined;
  onContractionTimerPress?: (() => void) | undefined;
  onKickCounterPress?: (() => void) | undefined;
  onManagePress?: (() => void) | undefined;
}) {
  const styles = useThemedStyles(createStyles);
  const [isRedFlagsExpanded, setIsRedFlagsExpanded] = useState(false);
  const {
    hero,
    babyThisWeek,
    milestones,
    kickTeaser,
    multiplesCard,
    contractionTimer,
    todayMetrics,
    birthCta,
    manageCta,
    redFlags,
  } = viewData;

  return (
    <View style={styles.pregnancyStack} testID="dashboard-pregnancy-mode">
      <FeatureCard testID="dashboard-pregnancy-hero">
        <View
          accessible
          accessibilityLabel={`${hero.weekCaption}. ${hero.weekValueLabel}. ${hero.trimesterLabel}`}
          style={styles.pregnancyHeroRow}
        >
          <Text
            maxFontSizeMultiplier={fontScale.dense}
            style={styles.pregnancyWeekValue}
            testID="dashboard-pregnancy-week-value"
          >
            {hero.weekValueLabel}
          </Text>
          <View style={styles.pregnancyHeroMeta}>
            <Text style={styles.pregnancyWeekCaption}>{hero.weekCaption}</Text>
            <Text
              style={styles.pregnancyTrimester}
              testID="dashboard-pregnancy-trimester"
            >
              {hero.trimesterLabel}
            </Text>
          </View>
        </View>
        <View style={styles.pregnancyHeroDivider} />
        <View style={styles.pregnancyHeroFooter}>
          <Text style={styles.pregnancyMetaLabel}>{hero.eddCaption}</Text>
          <Text
            style={styles.pregnancyMetaValue}
            testID="dashboard-pregnancy-edd"
          >
            {hero.eddValueLabel}
          </Text>
          <Text style={styles.pregnancyDaysRemaining}>
            {hero.daysRemainingLabel}
          </Text>
        </View>
      </FeatureCard>

      {/* "Baby this week"(education-only): directly below the hero and
          above every other pregnancy card (multiples, contraction timer,
          milestones, ...) -- the task pinned this exact slot. Always rendered
          (babyThisWeek is an always-present view-data object, no `visible`
          gate); `multiplesNote` is the only conditionally-shown line. */}
      <FeatureCard testID="dashboard-pregnancy-baby-week" title={babyThisWeek.title}>
        <Text
          style={styles.helperText}
          testID="dashboard-pregnancy-baby-week-size"
        >
          {babyThisWeek.sizeLine}
        </Text>
        <Text
          style={styles.helperText}
          testID="dashboard-pregnancy-baby-week-development"
        >
          {babyThisWeek.developmentLine}
        </Text>
        {babyThisWeek.multiplesNote ? (
          <Text
            style={styles.helperText}
            testID="dashboard-pregnancy-baby-week-multiples-note"
          >
            {babyThisWeek.multiplesNote}
          </Text>
        ) : null}
      </FeatureCard>

      {multiplesCard.visible ? (
        <FeatureCard
          description={multiplesCard.body}
          testID="dashboard-pregnancy-multiples-card"
          title={multiplesCard.title}
        />
      ) : null}

      {contractionTimer.visible && contractionTimer.prominent ? (
        <Pressable
          accessibilityRole="button"
          onPress={onContractionTimerPress ?? (() => {})}
          testID="dashboard-pregnancy-contraction-timer"
        >
          <FeatureCard description={contractionTimer.body} title={contractionTimer.title} />
        </Pressable>
      ) : null}

      {birthCta.visible ? (
        <AppButton
          label={birthCta.label}
          onPress={onBirthPress ?? (() => {})}
          testID="dashboard-pregnancy-birth-cta"
        />
      ) : null}

      <PregnancyDisclaimer
        testID="dashboard-pregnancy-disclaimer"
        text={viewData.disclaimer}
      />

      <FeatureCard
        testID="dashboard-pregnancy-milestones"
        title={milestones.title}
      >
        {milestones.items.length > 0 ? (
          <View style={styles.pregnancyMilestoneList}>
            {milestones.items.map((item) => (
              <View
                key={item.id}
                style={styles.pregnancyMilestoneItem}
                testID={`dashboard-pregnancy-milestone-${item.id}`}
              >
                <Text style={styles.pregnancyMilestoneTitle}>{item.title}</Text>
                <Text style={styles.pregnancyMilestoneBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text
            style={styles.helperText}
            testID="dashboard-pregnancy-milestones-empty"
          >
            {milestones.emptyLabel}
          </Text>
        )}
      </FeatureCard>

      {kickTeaser.visible ? (
        <Pressable
          accessibilityRole="button"
          onPress={onKickCounterPress ?? (() => {})}
          testID="dashboard-pregnancy-kick-teaser"
        >
          <FeatureCard description={kickTeaser.body} title={kickTeaser.title} />
        </Pressable>
      ) : null}

      {contractionTimer.visible && !contractionTimer.prominent ? (
        <Pressable
          accessibilityRole="button"
          onPress={onContractionTimerPress ?? (() => {})}
          testID="dashboard-pregnancy-contraction-timer"
        >
          <FeatureCard description={contractionTimer.body} title={contractionTimer.title} />
        </Pressable>
      ) : null}

      <FeatureCard
        testID="dashboard-pregnancy-metrics"
        title={todayMetrics.title}
      >
        {todayMetrics.hasAny ? (
          <View style={styles.pregnancyMetricList}>
            {todayMetrics.weight ? (
              <View
                style={styles.pregnancyMetricRow}
                testID="dashboard-pregnancy-metric-weight"
              >
                <Text style={styles.pregnancyMetaLabel}>
                  {todayMetrics.weight.label}
                </Text>
                <Text style={styles.pregnancyMetaValue}>
                  {todayMetrics.weight.value}
                </Text>
              </View>
            ) : null}
            {todayMetrics.bloodPressure ? (
              <View
                style={styles.pregnancyMetricRow}
                testID="dashboard-pregnancy-metric-bp"
              >
                <Text style={styles.pregnancyMetaLabel}>
                  {todayMetrics.bloodPressure.label}
                </Text>
                <Text style={styles.pregnancyMetaValue}>
                  {todayMetrics.bloodPressure.value}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text
            style={styles.helperText}
            testID="dashboard-pregnancy-metrics-empty"
          >
            {todayMetrics.emptyLabel}
          </Text>
        )}
      </FeatureCard>

      <RedFlagsCard
        expanded={isRedFlagsExpanded}
        onToggle={() => setIsRedFlagsExpanded((current) => !current)}
        testIDPrefix="dashboard-pregnancy"
        viewData={redFlags}
      />

      <Pressable
        accessibilityRole="button"
        onPress={onManagePress ?? (() => {})}
        style={styles.pregnancyManageLink}
        testID="dashboard-pregnancy-manage-link"
      >
        <Text style={styles.pregnancyManageLinkLabel}>{manageCta.label}</Text>
      </Pressable>
    </View>
  );
}

// Presentational postpartum-mode block. Additive: it renders ABOVE the
// still-visible cycle journal/quick actions (bleeding/lochia logging matters
// postpartum), unlike the pregnancy block which replaces the cycle surface.
// Pure view-data — no week math, record reads, or pause checks (all decided in
// dashboard-view-service). PregnancyDisclaimer renders unconditionally here.
function DashboardPostpartumMode({
  viewData,
  onManagePress,
  onAcceptCycleReturn,
  isAcceptingCycleReturn,
  onStartScreeningPress,
  onOpenScreeningHistoryPress,
  crisisSupport,
  onSaveCrisisContact,
}: {
  viewData: PostpartumDashboardViewData;
  onManagePress?: (() => void) | undefined;
  onAcceptCycleReturn?:
    | ((offer: PostpartumCycleReturnOfferViewData) => void | Promise<void>)
    | undefined;
  // Required (no local default): the screen-level prop already defaults it.
  isAcceptingCycleReturn: boolean;
  onStartScreeningPress?: (() => void) | undefined;
  onOpenScreeningHistoryPress?: (() => void) | undefined;
  crisisSupport?: CrisisSupportViewData | undefined;
  onSaveCrisisContact?:
    | ((contact: { name: string; phone: string }) => void | Promise<void>)
    | undefined;
}) {
  const styles = useThemedStyles(createStyles);
  const [isRedFlagsExpanded, setIsRedFlagsExpanded] = useState(false);
  // Cycle-return offer: "Keep" dismisses for THIS SCREEN SESSION
  // only, held in local state and never persisted -- the same gentle-
  // persistent-nudge choice screening-service.buildScreeningOfferViewData
  // documents for its own offer card (cadence-truthful `visible` from the
  // service; a fresh mount / next visit re-shows the card while the
  // condition still holds).
  const [cycleReturnOfferDismissed, setCycleReturnOfferDismissed] =
    useState(false);
  const {
    hero,
    recoveryCard,
    lochiaCard,
    lamCard,
    cycleReturnOffer,
    manageCta,
    redFlags,
    screeningOffer,
    screeningHistory,
    supportResources,
  } = viewData;
  const cycleReturnOfferVisible =
    cycleReturnOffer.visible && !cycleReturnOfferDismissed;

  return (
    <View style={styles.pregnancyStack} testID="dashboard-postpartum-mode">
      <FeatureCard testID="dashboard-postpartum-hero">
        <View style={styles.pregnancyHeroRow}>
          <Text
            style={styles.pregnancyWeekValue}
            testID="dashboard-postpartum-week-value"
          >
            {hero.weeksLabel}
          </Text>
          <View style={styles.pregnancyHeroMeta}>
            <Text style={styles.pregnancyWeekCaption}>{hero.weekCaption}</Text>
            <Text
              style={styles.pregnancyTrimester}
              testID="dashboard-postpartum-phase"
            >
              {hero.phaseLabel}
            </Text>
          </View>
        </View>
      </FeatureCard>

      {/* Cycle-return offer: the most actionable card while
          visible (accepting leaves postpartum mode entirely), so it renders
          right after the hero and above the recovery content it would soon
          make moot. Visible when the day-log history shows a cycle start
          after the birth AND the owner hasn't dismissed it this session. */}
      {cycleReturnOfferVisible ? (
        <FeatureCard
          testID="dashboard-postpartum-cycle-return-offer"
          title={cycleReturnOffer.title}
        >
          <Text style={styles.helperText}>{cycleReturnOffer.body}</Text>
          <View style={styles.offerActionsRow}>
            <AppButton
              disabled={isAcceptingCycleReturn}
              label={cycleReturnOffer.keepCtaLabel}
              onPress={() => setCycleReturnOfferDismissed(true)}
              testID="dashboard-postpartum-cycle-return-offer-keep"
              variant="secondary"
            />
            <AppButton
              disabled={isAcceptingCycleReturn}
              label={cycleReturnOffer.acceptCtaLabel}
              onPress={() => onAcceptCycleReturn?.(cycleReturnOffer)}
              testID="dashboard-postpartum-cycle-return-offer-accept"
            />
          </View>
        </FeatureCard>
      ) : null}

      <FeatureCard
        description={recoveryCard.body}
        testID="dashboard-postpartum-recovery-card"
        title={recoveryCard.title}
      />

      <FeatureCard
        description={lochiaCard.body}
        testID="dashboard-postpartum-lochia-card"
        title={lochiaCard.title}
      />

      {/* LAM education card: compact, always present while
          postpartum is active and no new cycle start yet. Once a cycle start
          is detected the card is superseded by the cycle-return offer above
          (both keyed off the same hasNewCycleStart input) -- never both at
          once. Commonly-discussed education plus talk-to-your-care-team only;
          no feeding-data field backs this card (deferred, out of scope). */}
      {lamCard ? (
        <FeatureCard
          description={lamCard.body}
          testID="dashboard-postpartum-lam-card"
          title={lamCard.title}
        />
      ) : null}

      {/* EPDS mood-screening surfacing. Gentle offer card (cadence-driven
          visibility) + a "Last check-in" row when any response exists. Both are
          pure view-data from the postpartum service; the container owns the
          navigation into the screening flow / history. */}
      {screeningOffer.visible ? (
        <FeatureCard
          testID="dashboard-screening-offer"
          title={screeningOffer.title}
        >
          <Text style={styles.helperText}>{screeningOffer.body}</Text>
          <AppButton
            label={screeningOffer.ctaLabel}
            onPress={onStartScreeningPress ?? (() => {})}
            testID="dashboard-screening-offer-button"
          />
        </FeatureCard>
      ) : null}

      {screeningHistory ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenScreeningHistoryPress ?? (() => {})}
          style={styles.pregnancyManageLink}
          testID="dashboard-screening-history-link"
        >
          <Text style={styles.pregnancyManageLinkLabel}>
            {screeningHistory.label}
          </Text>
        </Pressable>
      ) : null}

      <PregnancyDisclaimer
        testID="dashboard-postpartum-disclaimer"
        text={viewData.disclaimer}
      />

      <RedFlagsCard
        expanded={isRedFlagsExpanded}
        onToggle={() => setIsRedFlagsExpanded((current) => !current)}
        testIDPrefix="dashboard-postpartum"
        viewData={redFlags}
      />

      {/* Standing "Support resources" row, quiet and near the manage link,
          expanding in place (RedFlagsCard precedent) to the crisis-support block
          + mental_health context. NEVER premium-gated: it renders whenever the
          postpartum dashboard renders, including read-only lapse states. */}
      {crisisSupport ? (
        <SupportResourcesSection
          crisisSupport={crisisSupport}
          onSaveCrisisContact={onSaveCrisisContact}
          viewData={supportResources}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onManagePress ?? (() => {})}
        style={styles.pregnancyManageLink}
        testID="dashboard-postpartum-manage-link"
      >
        <Text style={styles.pregnancyManageLinkLabel}>{manageCta.label}</Text>
      </Pressable>
    </View>
  );
}

// Quiet postpartum "Support resources" row. Expand-in-place, mirroring the
// RedFlagsCard toggle precedent — no new route. Reveals the mental_health
// context body plus the shared CrisisSupportCard. Purely presentational: local
// expand state only, no premium/plan read anywhere.
function SupportResourcesSection({
  viewData,
  crisisSupport,
  onSaveCrisisContact,
}: {
  viewData: PostpartumDashboardViewData["supportResources"];
  crisisSupport: CrisisSupportViewData;
  onSaveCrisisContact?:
    | ((contact: { name: string; phone: string }) => void | Promise<void>)
    | undefined;
}) {
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);

  return (
    <FeatureCard
      testID="dashboard-postpartum-support-resources"
      title={viewData.rowLabel}
    >
      <Pressable
        accessibilityLabel={
          expanded ? viewData.collapseLabel : viewData.expandLabel
        }
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.redFlagsToggle}
        testID="dashboard-postpartum-support-resources-toggle"
      >
        <Text style={styles.redFlagsToggleLabel}>
          {expanded ? viewData.collapseLabel : viewData.expandLabel}
        </Text>
        <Text style={styles.redFlagsToggleIcon}>{expanded ? "−" : "+"}</Text>
      </Pressable>
      {expanded ? (
        <View
          style={styles.redFlagsExpanded}
          testID="dashboard-postpartum-support-resources-expanded"
        >
          <Text style={styles.helperText}>{viewData.contextBody}</Text>
          <CrisisSupportCard
            onSaveContact={onSaveCrisisContact ?? (() => {})}
            testID="dashboard-postpartum-crisis-support"
            viewData={crisisSupport}
          />
        </View>
      ) : null}
    </FeatureCard>
  );
}

// Shared "when to contact your care team" education section,
// collapsed by default, rendered at the bottom of both the pregnancy and
// postpartum dashboards -- identical shape, different view-data per mode.
// Pure view-data + local expand/collapse state (not persisted): no GA math,
// no record reads, no highlighting, no interaction beyond expand/collapse.
function RedFlagsCard({
  expanded,
  onToggle,
  testIDPrefix,
  viewData,
}: {
  expanded: boolean;
  onToggle: () => void;
  testIDPrefix: string;
  viewData: {
    title: string;
    intro: string;
    expandLabel: string;
    collapseLabel: string;
    items: { id: string; title: string; body: string }[];
  };
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <FeatureCard testID={`${testIDPrefix}-red-flags`} title={viewData.title}>
      <Pressable
        accessibilityLabel={expanded ? viewData.collapseLabel : viewData.expandLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.redFlagsToggle}
        testID={`${testIDPrefix}-red-flags-toggle`}
      >
        <Text style={styles.redFlagsToggleLabel}>
          {expanded ? viewData.collapseLabel : viewData.expandLabel}
        </Text>
        <Text style={styles.redFlagsToggleIcon}>{expanded ? "−" : "+"}</Text>
      </Pressable>
      {expanded ? (
        <View
          style={styles.redFlagsExpanded}
          testID={`${testIDPrefix}-red-flags-expanded`}
        >
          <Text style={styles.helperText}>{viewData.intro}</Text>
          <View style={styles.pregnancyMilestoneList}>
            {viewData.items.map((item) => (
              <View
                key={item.id}
                style={styles.pregnancyMilestoneItem}
                testID={`${testIDPrefix}-red-flag-${item.id}`}
              >
                <Text style={styles.pregnancyMilestoneTitle}>{item.title}</Text>
                <Text style={styles.pregnancyMilestoneBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </FeatureCard>
  );
}

function PregnancyEntryCard({
  viewData,
  onStartPress,
  onPremiumCTAPress,
}: {
  viewData: PregnancyEntryCardViewData;
  onStartPress?: (() => void) | undefined;
  onPremiumCTAPress?: (() => void) | undefined;
}) {
  const styles = useThemedStyles(createStyles);

  if (viewData.variant === "premium_locked") {
    return (
      <PremiumLockCard
        ctaLabel={viewData.ctaLabel}
        description={viewData.description}
        eyebrowLabel={viewData.eyebrowLabel}
        onPress={onPremiumCTAPress ?? (() => {})}
        testID="dashboard-pregnancy-entry-card"
        title={viewData.title}
      />
    );
  }

  return (
    <FeatureCard testID="dashboard-pregnancy-entry-card">
      <Text
        style={styles.pregnancyEntryEyebrow}
        testID="dashboard-pregnancy-entry-card-eyebrow"
      >
        {viewData.eyebrowLabel}
      </Text>
      <Text style={styles.pregnancyEntryTitle}>{viewData.title}</Text>
      <Text style={styles.pregnancyEntryBody}>{viewData.description}</Text>
      <AppButton
        label={viewData.ctaLabel}
        onPress={onStartPress ?? (() => {})}
        testID="dashboard-pregnancy-entry-card-cta"
      />
    </FeatureCard>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "transparent",
    },
    pregnancyStack: {
      gap: spacing.md,
    },
    pregnancyHeroRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    pregnancyWeekValue: {
      color: colors.text,
      fontSize: 40,
      fontWeight: "800",
      lineHeight: 44,
    },
    pregnancyHeroMeta: {
      flex: 1,
      gap: 2,
    },
    pregnancyWeekCaption: {
      color: colors.textMuted,
      fontSize: 13,
    },
    pregnancyTrimester: {
      color: colors.accentStrong,
      fontSize: 15,
      fontWeight: "700",
    },
    pregnancyHeroDivider: {
      backgroundColor: colors.lineSoft,
      height: 1,
      marginVertical: spacing.xs,
    },
    pregnancyHeroFooter: {
      gap: 2,
    },
    pregnancyMetaLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    pregnancyMetaValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    pregnancyDaysRemaining: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    pregnancyMilestoneList: {
      gap: spacing.sm,
    },
    pregnancyMilestoneItem: {
      gap: 2,
    },
    pregnancyMilestoneTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    pregnancyMilestoneBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    pregnancyMetricList: {
      gap: spacing.sm,
    },
    pregnancyMetricRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    pregnancyManageLink: {
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    redFlagsToggle: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    redFlagsToggleLabel: {
      color: colors.accentStrong,
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "700",
    },
    redFlagsToggleIcon: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 16,
      marginLeft: spacing.sm,
      marginTop: -1,
    },
    redFlagsExpanded: {
      gap: spacing.sm,
    },
    pregnancyManageLinkLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    pregnancyEntryEyebrow: {
      color: colors.accentStrong,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    pregnancyEntryTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 24,
    },
    pregnancyEntryBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    screenContent: {
      paddingBottom: spacing.xl,
    },
    container: {
      alignSelf: "center",
      gap: spacing.md,
      maxWidth: 980,
      paddingHorizontal: 16,
      paddingTop: 16,
      width: "100%",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    // Cycle-return offer's accept/keep row, mirroring
    // PregnancyEndFlowScreen's actionsRow (decline/start postpartum offer).
    offerActionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
      marginTop: spacing.xs,
    },
    quickActionsBlock: {
      gap: spacing.xs,
    },
    quickActionsTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    quickActions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    quickActionButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 999,
      borderWidth: 1,
      overflow: "hidden",
      paddingHorizontal: 12,
      paddingVertical: 8,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.72,
      shadowRadius: 14,
    },
    quickActionButtonActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
    },
    quickActionIcon: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 18,
    },
    quickActionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
    quickActionLabelActive: {
      color: colors.accentStrong,
    },
  });
