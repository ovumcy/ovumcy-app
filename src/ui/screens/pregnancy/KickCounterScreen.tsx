import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getKickCounterCopy } from "../../../i18n/kick-counter-copy";
import { MAX_KICK_COUNT, type PregnancyRecord } from "../../../models/pregnancy";
import type { ProfileRecord } from "../../../models/profile";
import { appStorage } from "../../../services/app-bootstrap-service";
import {
  buildKickCounterViewData,
  deleteKickCountSession,
  finishKickCountSession,
} from "../../../services/kick-counter-service";
import { formatLocalDate } from "../../../services/profile-settings-policy";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { openConfirmation } from "../../confirm/open-confirmation";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import { KickCounterFlowScreen } from "./KickCounterFlowScreen";

type KickCounterScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

type LoadStatus = "loading" | "ready";
type SessionPhase = "idle" | "counting";
type StatusState = { message: string; tone: "success" | "error" } | null;

const ELAPSED_TICK_MS = 1000;

export function KickCounterScreen({
  storage = appStorage,
  now,
}: KickCounterScreenProps) {
  const { colors, language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [activePregnancy, setActivePregnancy] = useState<PregnancyRecord | null>(
    null,
  );
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [sessions, setSessions] = useState<
    Awaited<ReturnType<LocalAppStorage["listKickSessions"]>>
  >([]);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("idle");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const copy = getKickCounterCopy(language);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const [pregnancy, profileRecord] = await Promise.all([
        storage.readActivePregnancy(),
        storage.readProfileRecord(),
      ]);
      const sessionsResult = pregnancy
        ? await storage.listKickSessions(pregnancy.startedAt)
        : [];
      if (!isMounted) {
        return;
      }
      setActivePregnancy(pregnancy);
      setProfile(profileRecord);
      setSessions(sessionsResult);
      setLoadStatus("ready");
    })();

    return () => {
      isMounted = false;
    };
  }, [storage]);

  useEffect(() => {
    if (sessionPhase !== "counting" || !startedAt) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt.getTime());
    }, ELAPSED_TICK_MS);

    return () => clearInterval(interval);
  }, [sessionPhase, startedAt]);

  const viewData = useMemo(
    () =>
      buildKickCounterViewData(
        activePregnancy,
        formatLocalDate(effectiveNow),
        sessions,
        language,
      ),
    [activePregnancy, effectiveNow, language, sessions],
  );

  async function refreshSessions() {
    if (!activePregnancy) {
      setSessions([]);
      return;
    }
    setSessions(await storage.listKickSessions(activePregnancy.startedAt));
  }

  function resetSession() {
    setSessionPhase("idle");
    setStartedAt(null);
    setTapCount(0);
    setElapsedMs(0);
  }

  function handleTap() {
    if (sessionPhase === "idle") {
      setStartedAt(new Date());
      setElapsedMs(0);
      setTapCount(1);
      setSessionPhase("counting");
      return;
    }

    setTapCount((current) => Math.min(current + 1, MAX_KICK_COUNT));
  }

  async function handleFinish() {
    if (sessionPhase !== "counting" || !startedAt || tapCount === 0) {
      return;
    }

    setIsSaving(true);
    setStatus(null);

    const result = await finishKickCountSession(
      storage,
      { startedAt, kickCount: tapCount },
      new Date(),
    );
    if (!result.ok) {
      setStatus({ message: copy.counter.saveFailedStatus, tone: "error" });
      setIsSaving(false);
      return;
    }

    resetSession();
    await refreshSessions();
    setStatus({ message: copy.counter.savedStatus, tone: "success" });
    setIsSaving(false);
  }

  async function handleDiscard() {
    if (sessionPhase !== "counting") {
      return;
    }

    const confirmed = await openConfirmation(
      `${copy.counter.discardConfirm.title}\n\n${copy.counter.discardConfirm.body}`,
      copy.counter.discardConfirm.confirm,
      copy.counter.discardConfirm.cancel,
    );
    if (!confirmed) {
      return;
    }

    resetSession();
    setStatus(null);
  }

  async function handleDeleteSession(id: string) {
    const confirmed = await openConfirmation(
      `${copy.history.deleteConfirm.title}\n\n${copy.history.deleteConfirm.body}`,
      copy.history.deleteConfirm.confirm,
      copy.history.deleteConfirm.cancel,
    );
    if (!confirmed) {
      return;
    }

    const result = await deleteKickCountSession(storage, id);
    if (!result.ok) {
      setStatus({ message: copy.history.deleteFailedStatus, tone: "error" });
      return;
    }

    await refreshSessions();
    setStatus(null);
  }

  async function handleReminderToggle(value: boolean) {
    if (!profile) {
      return;
    }

    const nextProfile: ProfileRecord = {
      ...profile,
      kickCountReminderEnabled: value,
    };
    setProfile(nextProfile);
    await storage.writeProfileRecord(nextProfile);
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

  return (
    <KickCounterFlowScreen
      elapsedMinutes={Math.floor(elapsedMs / 60000)}
      isSaving={isSaving}
      language={language}
      onDeleteSession={handleDeleteSession}
      onDiscard={handleDiscard}
      onFinish={handleFinish}
      onReminderToggle={handleReminderToggle}
      onTap={handleTap}
      reminderEnabled={profile?.kickCountReminderEnabled === true}
      sessionPhase={sessionPhase}
      statusMessage={status?.message ?? ""}
      statusTone={status?.tone}
      tapCount={tapCount}
      viewData={viewData}
    />
  );
}
