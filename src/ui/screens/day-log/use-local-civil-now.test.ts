import { act, renderHook } from "@testing-library/react-native";
import React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { formatLocalDate } from "../../../services/profile-settings-policy";
import { useLocalCivilNow } from "./use-local-civil-now";

const mockUseEffect = React.useEffect;
const mockFocusEffects: (() => void)[] = [];

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockFocusEffects.push(effect as () => void);
    mockUseEffect(effect, [effect]);
  },
}));

let appStateHandler: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusEffects.length = 0;
  appStateHandler = null;
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, handler) => {
      appStateHandler = handler as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    })
    .mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Local-constructor instants, so the cases read the same in every device zone.
const lateEvening = new Date(2026, 5, 1, 23, 59, 30);
const nextMorning = new Date(2026, 5, 2, 7, 15, 0);

describe("useLocalCivilNow", () => {
  it("moves to the new civil date at local midnight while the screen stays open", async () => {
    jest.setSystemTime(lateEvening);
    const { result } = await renderHook(() => useLocalCivilNow());
    expect(formatLocalDate(result.current)).toBe("2026-06-01");

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(formatLocalDate(result.current)).toBe("2026-06-02");
  });

  it("keeps the same instant within one civil date", async () => {
    jest.setSystemTime(new Date(2026, 5, 1, 9, 0, 0));
    const { result } = await renderHook(() => useLocalCivilNow());
    const first = result.current;

    jest.setSystemTime(new Date(2026, 5, 1, 18, 0, 0));
    await act(async () => {
      appStateHandler?.("active");
    });

    expect(result.current).toBe(first);
  });

  it("re-reads the civil date when the app returns to the foreground", async () => {
    jest.setSystemTime(lateEvening);
    const { result } = await renderHook(() => useLocalCivilNow());

    jest.setSystemTime(nextMorning);
    await act(async () => {
      appStateHandler?.("background");
    });
    expect(formatLocalDate(result.current)).toBe("2026-06-01");

    await act(async () => {
      appStateHandler?.("active");
    });
    expect(formatLocalDate(result.current)).toBe("2026-06-02");
  });

  it("re-reads the civil date when the screen regains focus", async () => {
    jest.setSystemTime(lateEvening);
    const { result } = await renderHook(() => useLocalCivilNow());

    jest.setSystemTime(nextMorning);
    await act(async () => {
      mockFocusEffects.at(-1)?.();
    });

    expect(formatLocalDate(result.current)).toBe("2026-06-02");
  });

  it("runs the rollover callback with both dates before the new date is committed, once", async () => {
    jest.setSystemTime(lateEvening);
    const seen: string[] = [];
    const onBeforeRollover = jest.fn((previous: Date, next: Date) => {
      seen.push(formatLocalDate(previous), formatLocalDate(next));
    });
    const { result } = await renderHook(() => useLocalCivilNow({ onBeforeRollover }));

    jest.setSystemTime(nextMorning);
    await act(async () => {
      appStateHandler?.("active");
      mockFocusEffects.at(-1)?.();
    });

    expect(onBeforeRollover).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["2026-06-01", "2026-06-02"]);
    expect(formatLocalDate(result.current)).toBe("2026-06-02");
  });

  it("still moves the date when the rollover callback fails", async () => {
    jest.setSystemTime(lateEvening);
    const { result } = await renderHook(() =>
      useLocalCivilNow({
        onBeforeRollover: () => Promise.reject(new Error("flush failed")),
      }),
    );

    jest.setSystemTime(nextMorning);
    await act(async () => {
      appStateHandler?.("active");
    });

    expect(formatLocalDate(result.current)).toBe("2026-06-02");
  });

  it("keeps an injected instant for the screen's lifetime", async () => {
    const pinned = new Date(2026, 5, 1, 12, 0, 0);
    jest.setSystemTime(lateEvening);
    const { result } = await renderHook(() => useLocalCivilNow({ now: pinned }));

    jest.setSystemTime(nextMorning);
    await act(async () => {
      jest.advanceTimersByTime(24 * 60 * 60_000);
      mockFocusEffects.at(-1)?.();
    });

    expect(result.current).toBe(pinned);
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });
});
