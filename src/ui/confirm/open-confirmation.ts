import { requestConfirmation } from "./confirmation-bridge";

export function openConfirmation(
  message: string,
  acceptLabel: string,
  cancelLabel = "Cancel",
): Promise<boolean> {
  return requestConfirmation(message, acceptLabel, cancelLabel);
}
