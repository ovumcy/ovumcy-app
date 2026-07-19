import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../../models/day-log";
import type { DayLogRecord } from "../../../models/day-log";
import { useDayLogAutosave } from "./use-day-log-autosave";

type HookProps = Parameters<typeof useDayLogAutosave>[0];

const labels = {
  saveFailedLabel: "Save failed",
  savedLabel: "Saved",
  savingLabel: "Saving",
};

function buildRecord(overrides: Partial<DayLogRecord> = {}): DayLogRecord {
  return { ...createEmptyDayLogRecord("2026-03-14"), ...overrides };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderAutosave(initialProps: HookProps) {
  return renderHook((props: HookProps) => useDayLogAutosave(props), {
    initialProps,
  });
}

describe("useDayLogAutosave", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not schedule a save while labels have not loaded yet, or while there is no active record", () => {
    const onPersist = jest.fn();
    const { rerender } = renderAutosave({
      debounceMs: 5,
      draftVersion: 0,
      labels: null,
      onPersist,
      record: buildRecord(),
    });

    // The screen is still loading (no labels yet) — an edit landing before
    // that must never schedule a persist call.
    rerender({
      debounceMs: 5,
      draftVersion: 1,
      labels: null,
      onPersist,
      record: buildRecord({ mood: 3 }),
    });
    expect(onPersist).not.toHaveBeenCalled();

    // Labels are ready but there is no record to save (e.g. between screens).
    rerender({
      debounceMs: 5,
      draftVersion: 2,
      labels,
      onPersist,
      record: null,
    });
    expect(onPersist).not.toHaveBeenCalled();
  });

  it("debounces an edit, reports saving then saved status, and persists the latest draft", async () => {
    const savedRecord = buildRecord({ mood: 4 });
    const onPersist = jest.fn().mockResolvedValue({ ok: true, record: savedRecord });
    const onSaved = jest.fn();
    const { result, rerender } = renderAutosave({
      debounceMs: 5,
      draftVersion: 0,
      labels,
      onPersist,
      onSaved,
      record: buildRecord(),
    });

    rerender({
      debounceMs: 5,
      draftVersion: 1,
      labels,
      onPersist,
      onSaved,
      record: savedRecord,
    });

    await waitFor(() => expect(result.current.status?.tone).toBe("info"));
    expect(result.current.status?.message).toBe(labels.savingLabel);

    await waitFor(() => expect(result.current.status?.tone).toBe("success"));
    expect(result.current.status?.message).toBe(labels.savedLabel);
    expect(onPersist).toHaveBeenCalledWith(savedRecord);
    expect(onSaved).toHaveBeenCalledWith(savedRecord);
    expect(result.current.hasSaveError).toBe(false);
    expect(result.current.isAutosaving).toBe(false);
  });

  it("surfaces a save-failed error status, then clears it once a later save succeeds", async () => {
    const onPersist = jest
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, record: buildRecord({ mood: 6 }) });
    const { result, rerender } = renderAutosave({
      debounceMs: 5,
      draftVersion: 0,
      labels,
      onPersist,
      record: buildRecord(),
    });

    rerender({
      debounceMs: 5,
      draftVersion: 1,
      labels,
      onPersist,
      record: buildRecord({ mood: 1 }),
    });

    await waitFor(() => expect(result.current.hasSaveError).toBe(true));
    expect(result.current.status).toEqual({
      message: labels.saveFailedLabel,
      tone: "error",
    });

    rerender({
      debounceMs: 5,
      draftVersion: 2,
      labels,
      onPersist,
      record: buildRecord({ mood: 6 }),
    });

    // Scheduling the new draft optimistically clears the error flag right
    // away (no stale error banner while a fresh save is in flight); wait for
    // the save to actually settle before asserting the final status.
    await waitFor(() => expect(result.current.status?.tone).toBe("success"));
    expect(result.current.status).toEqual({
      message: labels.savedLabel,
      tone: "success",
    });
    expect(result.current.hasSaveError).toBe(false);
  });

  it("coalesces a save requested while a save is already in flight, without dropping the newer edit", async () => {
    const first = createDeferred<{ ok: true; record: DayLogRecord } | { ok: false }>();
    const onPersist = jest
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(async (record: DayLogRecord) => ({ ok: true, record }));
    const onSaved = jest.fn();

    const { result, rerender } = renderAutosave({
      debounceMs: 100000,
      draftVersion: 0,
      labels,
      onPersist,
      onSaved,
      record: buildRecord(),
    });

    rerender({
      debounceMs: 100000,
      draftVersion: 1,
      labels,
      onPersist,
      onSaved,
      record: buildRecord({ mood: 2 }),
    });

    act(() => {
      void result.current.saveNow();
    });
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onPersist).toHaveBeenCalledWith(buildRecord({ mood: 2 }));

    // A second, newer edit is explicitly saved while the first save is still
    // awaiting `first` — it must queue instead of firing a second concurrent
    // persist call.
    rerender({
      debounceMs: 100000,
      draftVersion: 2,
      labels,
      onPersist,
      onSaved,
      record: buildRecord({ mood: 5 }),
    });

    act(() => {
      void result.current.saveNow();
    });
    expect(onPersist).toHaveBeenCalledTimes(1);

    first.resolve({ ok: true, record: buildRecord({ mood: 2 }) });

    // The queued draft (the newer edit) flushes right after, so it is never
    // lost, and only the FINAL save reports success.
    await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(2));
    expect(onPersist).toHaveBeenLastCalledWith(buildRecord({ mood: 5 }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith(buildRecord({ mood: 5 }));
    expect(result.current.hasSaveError).toBe(false);
  });

  it("resetAutosave cancels a pending scheduled save and clears status/error state", () => {
    jest.useFakeTimers();

    const onPersist = jest.fn().mockResolvedValue({ ok: true, record: buildRecord() });
    const { result, rerender } = renderAutosave({
      debounceMs: 50,
      draftVersion: 0,
      labels,
      onPersist,
      record: buildRecord(),
    });

    rerender({
      debounceMs: 50,
      draftVersion: 1,
      labels,
      onPersist,
      record: buildRecord({ mood: 3 }),
    });
    expect(result.current.status?.tone).toBe("info");

    act(() => {
      result.current.resetAutosave(1);
    });
    expect(result.current.status).toBeNull();
    expect(result.current.hasSaveError).toBe(false);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // The pending timer was cancelled by reset, so the debounced save from
    // before the reset must never fire (used before delete / manual cycle
    // start so a stale queued autosave can't resurrect cleared data).
    expect(onPersist).not.toHaveBeenCalled();
  });

  it("flushPendingDraft and saveNow are no-ops when there is no active record", async () => {
    const onPersist = jest.fn();
    const { result } = renderAutosave({
      debounceMs: 5,
      draftVersion: 0,
      labels,
      onPersist,
      record: null,
    });

    await act(async () => {
      await result.current.flushPendingDraft();
    });
    await act(async () => {
      await result.current.saveNow();
    });

    expect(onPersist).not.toHaveBeenCalled();
  });

  it("saveNow flushes immediately without waiting for the debounce window", async () => {
    const savedRecord = buildRecord({ mood: 9 });
    const onPersist = jest.fn().mockResolvedValue({ ok: true, record: savedRecord });
    const { result, rerender } = renderAutosave({
      debounceMs: 100000,
      draftVersion: 0,
      labels,
      onPersist,
      record: buildRecord(),
    });

    rerender({
      debounceMs: 100000,
      draftVersion: 1,
      labels,
      onPersist,
      record: savedRecord,
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onPersist).toHaveBeenCalledWith(savedRecord);
    expect(result.current.status).toEqual({
      message: labels.savedLabel,
      tone: "success",
    });
  });
});
