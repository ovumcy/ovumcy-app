import type { LocalAppStorage } from "../storage/local/storage-contract";

export const CLEAR_LOCAL_DATA_CONFIRMATION = "CLEAR";

export function isClearLocalDataConfirmationValid(value: string): boolean {
  return value.trim().toUpperCase() === CLEAR_LOCAL_DATA_CONFIRMATION;
}

export async function clearAllLocalSettingsData(
  storage: LocalAppStorage,
): Promise<
  | {
      ok: true;
    }
  | {
      ok: false;
      errorCode: "generic";
    }
> {
  try {
    await storage.clearAllLocalData();
    return { ok: true };
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }
}
