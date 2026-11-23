// Back-off for the partner projection PUT after `429 rate_limited` (managed
// caps it at 30/min per account) or a refusal of the body itself, which would
// repeat on every retry. Every push trigger (focus, app-active, saves)
// funnels through `syncManagedPartnerSharedProjections`, so one in-memory gate
// there is enough to stop a retry storm. A projection is a full snapshot, so a
// skipped push loses freshness only: the next trigger after the window uploads
// the latest state.
const DEFAULT_BACKOFF_SECONDS = 60;
const MAX_BACKOFF_SECONDS = 15 * 60;

let blockedUntilMs: number | null = null;

export function isManagedPartnerProjectionPushBackedOff(
  nowMs: number = Date.now(),
): boolean {
  if (blockedUntilMs === null) {
    return false;
  }
  // A clock moved backwards would otherwise pin the gate past the cap.
  if (nowMs >= blockedUntilMs || blockedUntilMs - nowMs > MAX_BACKOFF_SECONDS * 1000) {
    blockedUntilMs = null;
    return false;
  }
  return true;
}

export function backOffManagedPartnerProjectionPush(
  retryAfterSeconds: number | undefined,
  nowMs: number = Date.now(),
): void {
  const seconds = Math.min(
    Math.max(retryAfterSeconds ?? DEFAULT_BACKOFF_SECONDS, 1),
    MAX_BACKOFF_SECONDS,
  );
  blockedUntilMs = nowMs + seconds * 1000;
}

export function resetManagedPartnerProjectionPushBackoff(): void {
  blockedUntilMs = null;
}
