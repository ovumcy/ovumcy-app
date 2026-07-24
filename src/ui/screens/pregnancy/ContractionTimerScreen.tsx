import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getContractionTimerCopy } from "../../../i18n/contraction-timer-copy";
import type { ContractionSession, PregnancyRecord } from "../../../models/pregnancy";
import { appStorage } from "../../../services/app-bootstrap-service";
import {
  buildContractionSessionHistoryViewData,
  buildContractionTimerViewData,
  createContractionSession,
  deleteContractionHistorySession,
  discardSession,
  formatMinSecLabel,
  resumeOrCreateSession,
  startContraction,
  stopContraction,
} from "../../../services/contraction-timer-service";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { openConfirmation } from "../../confirm/open-confirmation";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import { ContractionTimerFlowScreen } from "./ContractionTimerFlowScreen";

type ContractionTimerScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

type LoadStatus = "loading" | "ready";
type StatusState = { message: string; tone: "success" | "error" } | null;

// How often the screen's "live now" ticks while open. Drives both the
// elapsed-contraction display and the window-summary/5-1-1 recompute, so
// educationProminent decays a few minutes after contractions stop even with
// no new taps -- not just a stopwatch cosmetic.
const LIVE_TICK_MS = 1000;

export function ContractionTimerScreen({
  storage = appStorage,
  now,
}: ContractionTimerScreenProps) {
  const { colors, language } = useAppPreferences();
  const router = useRouter();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [liveNow, setLiveNow] = useState(() => effectiveNow);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [activePregnancy, setActivePregnancy] = useState<PregnancyRecord | null>(null);
  const [session, setSession] = useState<ContractionSession>(() =>
    createContractionSession(effectiveNow),
  );
  const [pastSessions, setPastSessions] = useState<ContractionSession[]>([]);
  const [activeContractionStartedAt, setActiveContractionStartedAt] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const copy = getContractionTimerCopy(language);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const [pregnancy, resumedSession, allSessions] = await Promise.all([
        storage.readActivePregnancy(),
        resumeOrCreateSession(storage, effectiveNow),
        storage.listContractionSessions(),
      ]);
      if (!isMounted) {
        return;
      }
      setActivePregnancy(pregnancy);
      setSession(resumedSession);
      setPastSessions(allSessions.filter((entry) => entry.id !== resumedSession.id));
      setLoadStatus("ready");
    })();

    return () => {
      isMounted = false;
    };
  }, [storage, effectiveNow]);

  useEffect(() => {
    if (loadStatus !== "ready" || activePregnancy?.status !== "active") {
      return;
    }

    const interval = setInterval(() => {
      setLiveNow(new Date());
    }, LIVE_TICK_MS);

    return () => clearInterval(interval);
  }, [loadStatus, activePregnancy]);

  const viewData = useMemo(
    () => buildContractionTimerViewData(activePregnancy, session, liveNow, language),
    [activePregnancy, session, liveNow, language],
  );

  const historyViewData = useMemo(
    () => buildContractionSessionHistoryViewData(pastSessions, session.id, language),
    [pastSessions, session, language],
  );

  async function refreshHistory(activeSessionId: string) {
    const all = await storage.listContractionSessions();
    setPastSessions(all.filter((entry) => entry.id !== activeSessionId));
  }

  function handleToggle() {
    if (isSaving) {
      return;
    }
    if (activeContractionStartedAt === null) {
      setActiveContractionStartedAt(startContraction(new Date()));
      return;
    }
    void handleStop(activeContractionStartedAt);
  }

  // The in-progress contraction's start instant rides in as an argument from
  // the toggle that already checked it, keeping this free of a re-check.
  async function handleStop(contractionStartedAt: string) {
    setIsSaving(true);
    setStatus(null);

    const result = await stopContraction(
      storage,
      session,
      contractionStartedAt,
      new Date(),
    );
    if (!result.ok) {
      setStatus({ message: copy.counter.saveFailedStatus, tone: "error" });
      setIsSaving(false);
      return;
    }

    setSession(result.session);
    setActiveContractionStartedAt(null);
    if (result.rolledOver) {
      await refreshHistory(result.session.id);
    }
    setIsSaving(false);
  }

  async function handleFinish() {
    const nextSession = createContractionSession(new Date());
    setSession(nextSession);
    setActiveContractionStartedAt(null);
    setStatus(null);
    await refreshHistory(nextSession.id);
  }

  async function handleDiscard() {
    const confirmed = await openConfirmation(
      `${copy.counter.discardConfirm.title}\n\n${copy.counter.discardConfirm.body}`,
      copy.counter.discardConfirm.confirm,
      copy.counter.discardConfirm.cancel,
    );
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    const result = await discardSession(storage, session);
    const nextSession = createContractionSession(new Date());
    setSession(nextSession);
    setActiveContractionStartedAt(null);
    setStatus(result.ok ? null : { message: copy.counter.discardFailedStatus, tone: "error" });
    await refreshHistory(nextSession.id);
    setIsSaving(false);
  }

  async function handleDeleteHistorySession(id: string) {
    const confirmed = await openConfirmation(
      `${copy.history.deleteConfirm.title}\n\n${copy.history.deleteConfirm.body}`,
      copy.history.deleteConfirm.confirm,
      copy.history.deleteConfirm.cancel,
    );
    if (!confirmed) {
      return;
    }

    const result = await deleteContractionHistorySession(storage, id);
    if (!result.ok) {
      setStatus({ message: copy.history.deleteFailedStatus, tone: "error" });
      return;
    }
    await refreshHistory(session.id);
    setStatus(null);
  }

  if (loadStatus === "loading") {
    return (
      <ScreenScaffold
        description={copy.counter.subtitle}
        eyebrow={copy.counter.title}
        title={copy.counter.title}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  const elapsedSeconds =
    activeContractionStartedAt !== null
      ? Math.max(
          0,
          Math.floor(
            (liveNow.getTime() - new Date(activeContractionStartedAt).getTime()) / 1000,
          ),
        )
      : 0;

  return (
    <ContractionTimerFlowScreen
      elapsedValue={formatMinSecLabel(elapsedSeconds)}
      historyViewData={historyViewData}
      isSaving={isSaving}
      isTiming={activeContractionStartedAt !== null}
      language={language}
      onBirthPress={() => router.push("/pregnancy-end?reason=birth")}
      onDeleteHistorySession={handleDeleteHistorySession}
      onDiscard={handleDiscard}
      onFinish={handleFinish}
      onToggle={handleToggle}
      statusMessage={status?.message ?? ""}
      statusTone={status?.tone}
      viewData={viewData}
    />
  );
}
