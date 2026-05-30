import {
  requestConfirmation,
  requestConfirmationOutcome,
  type ConfirmationOutcome,
} from "./confirmation-bridge";

export function openConfirmation(
  message: string,
  acceptLabel: string,
  cancelLabel = "Cancel",
): Promise<boolean> {
  return requestConfirmation(message, acceptLabel, cancelLabel);
}

/**
 * Three-way "leave with unsaved changes" prompt.
 * - accept  → user chose the save action (saveLabel)
 * - reject  → user chose to discard (discardLabel)
 * - dismiss → user backed out (keepEditingLabel button, hardware back, or
 *   tapping outside) and should stay on the screen with changes intact.
 */
export function openLeaveConfirmation(
  message: string,
  saveLabel: string,
  discardLabel: string,
  keepEditingLabel: string,
): Promise<ConfirmationOutcome> {
  return requestConfirmationOutcome(
    message,
    saveLabel,
    discardLabel,
    keepEditingLabel,
  );
}
