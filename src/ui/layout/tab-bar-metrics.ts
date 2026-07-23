import { fontScale } from "../theme/tokens";

/**
 * Bottom tab-bar geometry under OS font scaling.
 *
 * The tab bar is fixed-height chrome: one icon plus one short label inside a
 * 56pt band. React Navigation scales that label with the OS font size on
 * Android and web; on iOS 13+ it deliberately does not, using the system
 * large-content viewer (long-press magnifier) instead, which is Apple's own
 * guidance for tab bars. Where the label does scale, a large system font
 * pushes it into the icon and clips it against a constant band.
 *
 * So the band grows by the extra line height the label needs instead of the
 * label being pinned — capped at `fontScale.dense`, the same ceiling the
 * calendar grid and the stats chart use for fixed-geometry text, because the
 * tab bar has to keep four destinations reachable on the narrowest phone.
 */
export const TAB_BAR_BASE_CONTENT_HEIGHT = 56;

/** Matches `tabBarLabelStyle.lineHeight` in the tabs layout. */
export const TAB_BAR_LABEL_LINE_HEIGHT = 13;

export function resolveTabBarFontScale(osFontScale: number): number {
  if (!Number.isFinite(osFontScale) || osFontScale <= 1) {
    return 1;
  }

  return Math.min(osFontScale, fontScale.dense);
}

export function resolveTabBarContentHeight(
  osFontScale: number,
  labelScalesWithSystemFont: boolean,
): number {
  if (!labelScalesWithSystemFont) {
    return TAB_BAR_BASE_CONTENT_HEIGHT;
  }

  const scale = resolveTabBarFontScale(osFontScale);

  return (
    TAB_BAR_BASE_CONTENT_HEIGHT +
    Math.round(TAB_BAR_LABEL_LINE_HEIGHT * (scale - 1))
  );
}
