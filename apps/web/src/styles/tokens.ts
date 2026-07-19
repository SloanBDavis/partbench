/** Numeric layout tokens shared by reducers, preferences, and CSS. */
export const WORKBENCH_LAYOUT = {
  leftDock: { default: 282, min: 220, max: 380 },
  rightDock: { default: 350, min: 300, max: 460 },
  minimumInlineViewportWidth: 480,
  minimumDesktopViewportHeight: 320,
  minimumNarrowViewportWidth: 320,
  minimumNarrowViewportHeight: 240,
  inlineDocksBreakpoint: 1200,
  rightDrawerBreakpoint: 960,
  headerMaxHeight: 48,
  ribbonMaxHeight: 108,
  statusMaxHeight: 40
} as const;

export function clampDockWidth(side: "left" | "right", width: number): number {
  const bounds =
    side === "left" ? WORKBENCH_LAYOUT.leftDock : WORKBENCH_LAYOUT.rightDock;
  const finiteWidth = Number.isFinite(width) ? width : bounds.default;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(finiteWidth)));
}
