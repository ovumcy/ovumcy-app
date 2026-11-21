import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { formatLocalDate } from "../../../services/profile-settings-policy";

// Slack past local midnight before the timer re-reads the clock, so a timer
// that fires a few milliseconds early still lands on the new civil date.
const MIDNIGHT_SLACK_MS = 1_000;

type UseLocalCivilNowOptions = {
  // An injected instant pins the civil date for the screen's lifetime.
  now?: Date | undefined;
  // Runs before the new date is committed, while the screen still renders the
  // previous one — the place to flush a draft so it is saved on its own date.
  onBeforeRollover?: ((previous: Date, next: Date) => Promise<void> | void) | undefined;
};

function msUntilNextLocalMidnight(from: Date): number {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - from.getTime()) + MIDNIGHT_SLACK_MS;
}

// The screen's "now", held stable within one local civil date and replaced
// when that date changes: on focus, on return to the foreground, and at local
// midnight while the screen stays open. A screen mounted yesterday must never
// file today's entry under yesterday or judge "future" against yesterday.
export function useLocalCivilNow({
  now,
  onBeforeRollover,
}: UseLocalCivilNowOptions = {}): Date {
  const isPinned = now !== undefined;
  const [current, setCurrent] = useState<Date>(() => now ?? new Date());
  const currentRef = useRef(current);
  const onBeforeRolloverRef = useRef(onBeforeRollover);
  const isMountedRef = useRef(true);

  useEffect(() => {
    onBeforeRolloverRef.current = onBeforeRollover;
  }, [onBeforeRollover]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkCivilDate = useCallback(async () => {
    if (isPinned) {
      return;
    }

    const candidate = new Date();
    const previous = currentRef.current;
    if (formatLocalDate(candidate) === formatLocalDate(previous)) {
      return;
    }

    // Claimed before the callback runs, so a focus and a foreground event
    // arriving together roll over once.
    currentRef.current = candidate;
    try {
      await onBeforeRolloverRef.current?.(previous, candidate);
    } catch {
      // A failed flush keeps its own autosave error state; the date still moves.
    } finally {
      if (isMountedRef.current) {
        setCurrent(candidate);
      }
    }
  }, [isPinned]);

  useFocusEffect(
    useCallback(() => {
      void checkCivilDate();
    }, [checkCivilDate]),
  );

  useEffect(() => {
    if (isPinned) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      timeout = setTimeout(() => {
        void checkCivilDate();
        arm();
      }, msUntilNextLocalMidnight(new Date()));
    };
    arm();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void checkCivilDate();
      }
    });

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      subscription.remove();
    };
  }, [checkCivilDate, isPinned]);

  return current;
}
