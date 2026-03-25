import { spacing } from "../theme/tokens";

export function resolveBottomContentPadding(bottomInset: number) {
  return Math.max(bottomInset + 24, spacing.xl + 8);
}
