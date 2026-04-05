import { useCallback, useEffect, useRef, useState } from "react";

import type { DayLogRecord } from "../../../models/day-log";

export const DAY_LOG_AUTOSAVE_DEBOUNCE_MS = 700;

type AutosaveDraft = {
  record: DayLogRecord;
  version: number;
};

type AutosaveLabels = {
  saveFailedLabel: string;
  savedLabel: string;
  savingLabel: string;
};

type PersistDayLogDraft = (
  record: DayLogRecord,
) => Promise<{ ok: true; record: DayLogRecord } | { ok: false }>;

type UseDayLogAutosaveOptions = {
  debounceMs?: number;
  draftVersion: number;
  labels: AutosaveLabels | null;
  onPersist: PersistDayLogDraft;
  onSaved?: ((record: DayLogRecord) => Promise<void> | void) | undefined;
  record: DayLogRecord | null;
};

type AutosaveStatusState = {
  message: string;
  tone: "error" | "info" | "success";
} | null;

export function useDayLogAutosave({
  debounceMs = DAY_LOG_AUTOSAVE_DEBOUNCE_MS,
  draftVersion,
  labels,
  onPersist,
  onSaved,
  record,
}: UseDayLogAutosaveOptions) {
  const [hasSaveError, setHasSaveError] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [status, setStatus] = useState<AutosaveStatusState>(null);
  const isMountedRef = useRef(true);
  const isSavingRef = useRef(false);
  const lastSavedVersionRef = useRef(draftVersion);
  const latestDraftVersionRef = useRef(draftVersion);
  const latestLabelsRef = useRef(labels);
  const latestPersistRef = useRef(onPersist);
  const latestRecordRef = useRef(record);
  const latestSavedCallbackRef = useRef(onSaved);
  const pendingDraftRef = useRef<AutosaveDraft | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestDraftVersionRef.current = draftVersion;
  }, [draftVersion]);

  useEffect(() => {
    latestLabelsRef.current = labels;
  }, [labels]);

  useEffect(() => {
    latestPersistRef.current = onPersist;
  }, [onPersist]);

  useEffect(() => {
    latestSavedCallbackRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    latestRecordRef.current = record;
  }, [record]);

  const flushDraft = useCallback(async (draft: AutosaveDraft) => {
    const activeLabels = latestLabelsRef.current;
    if (!activeLabels || draft.version <= lastSavedVersionRef.current) {
      return;
    }

    if (isSavingRef.current) {
      pendingDraftRef.current = draft;
      return;
    }

    isSavingRef.current = true;
    if (isMountedRef.current) {
      setIsAutosaving(true);
      setStatus({
        message: activeLabels.savingLabel,
        tone: "info",
      });
    }

    try {
      const result = await latestPersistRef.current(draft.record);
      if (!isMountedRef.current) {
        return;
      }

      if (!result.ok) {
        setHasSaveError(true);
        setStatus({
          message: activeLabels.saveFailedLabel,
          tone: "error",
        });
        return;
      }

      lastSavedVersionRef.current = draft.version;
      setHasSaveError(false);

      if (latestDraftVersionRef.current === draft.version) {
        await latestSavedCallbackRef.current?.(result.record);
        if (!isMountedRef.current) {
          return;
        }

        setStatus({
          message: activeLabels.savedLabel,
          tone: "success",
        });
      }
    } finally {
      isSavingRef.current = false;
      if (isMountedRef.current) {
        setIsAutosaving(false);
      }

      const pendingDraft = pendingDraftRef.current;
      pendingDraftRef.current = null;
      if (pendingDraft && pendingDraft.version > lastSavedVersionRef.current) {
        void flushDraft(pendingDraft);
      }
    }
  }, []);

  const scheduleDraft = useCallback((draft: AutosaveDraft) => {
    const activeLabels = latestLabelsRef.current;
    if (!activeLabels) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setHasSaveError(false);
    setStatus({
      message: activeLabels.savingLabel,
      tone: "info",
    });
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      void flushDraft(draft);
    }, debounceMs);
  }, [debounceMs, flushDraft]);

  useEffect(() => {
    if (!record || !latestLabelsRef.current) {
      return;
    }

    if (draftVersion <= lastSavedVersionRef.current) {
      return;
    }

    scheduleDraft({
      record,
      version: draftVersion,
    });
  }, [draftVersion, record, scheduleDraft]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      pendingDraftRef.current = null;
    };
  }, []);

  function resetAutosave(version = latestDraftVersionRef.current) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingDraftRef.current = null;
    lastSavedVersionRef.current = version;
    setHasSaveError(false);
    setStatus(null);
  }

  const flushPendingDraft = useCallback(async () => {
    const currentRecord = latestRecordRef.current;
    if (!currentRecord) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    pendingDraftRef.current = null;
    await flushDraft({
      record: currentRecord,
      version: latestDraftVersionRef.current,
    });
  }, [flushDraft]);

  async function saveNow() {
    const currentRecord = latestRecordRef.current;
    if (!currentRecord) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await flushDraft({
      record: currentRecord,
      version: latestDraftVersionRef.current,
    });
  }

  return {
    hasSaveError,
    isAutosaving,
    flushPendingDraft,
    resetAutosave,
    saveNow,
    status,
  };
}
