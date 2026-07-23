import { WORKBENCH_LAYOUT } from "../styles/tokens";

export type DockSide = "left" | "right";
export type DockPlacement = "inline" | "drawer";

export interface WorkbenchLayoutInput {
  readonly viewportWidth: number;
  readonly leftDockWidth: number;
  readonly rightDockWidth: number;
  readonly leftDockCollapsed: boolean;
  readonly rightDockCollapsed: boolean;
  readonly openDrawer?: DockSide;
  readonly activeEditor: boolean;
}

export interface DockLayoutState {
  readonly placement: DockPlacement;
  readonly visible: boolean;
  readonly hiddenForViewport: boolean;
}

export interface WorkbenchLayoutResolution {
  readonly left: DockLayoutState;
  readonly right: DockLayoutState;
  readonly activeDrawer?: DockSide;
}

/** Pure responsive policy. It never rewrites persisted collapse preferences. */
export function resolveWorkbenchLayout({
  viewportWidth,
  leftDockWidth,
  rightDockWidth,
  leftDockCollapsed,
  rightDockCollapsed,
  openDrawer,
  activeEditor
}: WorkbenchLayoutInput): WorkbenchLayoutResolution {
  if (viewportWidth >= WORKBENCH_LAYOUT.inlineDocksBreakpoint) {
    let showLeft = !leftDockCollapsed;
    let showRight = activeEditor || !rightDockCollapsed;
    const dividerWidth = 8;
    const required = () =>
      (showLeft ? leftDockWidth + dividerWidth : 0) +
      (showRight ? rightDockWidth + dividerWidth : 0) +
      WORKBENCH_LAYOUT.minimumInlineViewportWidth;

    if (required() > viewportWidth && showLeft && showRight) {
      if (activeEditor) showLeft = false;
      else showRight = false;
    }
    if (required() > viewportWidth && showRight) showRight = false;
    if (required() > viewportWidth && showLeft) showLeft = false;

    return {
      left: {
        placement: "inline",
        visible: showLeft,
        hiddenForViewport: !leftDockCollapsed && !showLeft
      },
      right: {
        placement: "inline",
        visible: showRight,
        hiddenForViewport: !rightDockCollapsed && !showRight
      }
    };
  }

  if (viewportWidth >= WORKBENCH_LAYOUT.rightDrawerBreakpoint) {
    const showLeft = !leftDockCollapsed;
    const showRight =
      activeEditor || (openDrawer === "right" && !rightDockCollapsed);
    return {
      left: {
        placement: "inline",
        visible: showLeft,
        hiddenForViewport: false
      },
      right: {
        placement: "drawer",
        visible: showRight,
        hiddenForViewport: false
      },
      activeDrawer: showRight ? "right" : undefined
    };
  }

  const requestedDrawer =
    openDrawer === "left" && !leftDockCollapsed
      ? "left"
      : openDrawer === "right" && (activeEditor || !rightDockCollapsed)
        ? "right"
        : undefined;
  const activeDrawer = activeEditor ? "right" : requestedDrawer;

  return {
    left: {
      placement: "drawer",
      visible: activeDrawer === "left",
      hiddenForViewport: false
    },
    right: {
      placement: "drawer",
      visible: activeDrawer === "right",
      hiddenForViewport: false
    },
    activeDrawer
  };
}

export function getKeyboardDockResizeValue(
  value: number,
  key: string,
  shiftKey: boolean,
  min: number,
  max: number
): number | undefined {
  const step = shiftKey ? 32 : 8;
  const next =
    key === "ArrowLeft"
      ? value - step
      : key === "ArrowRight"
        ? value + step
        : key === "Home"
          ? min
          : key === "End"
            ? max
            : undefined;
  return next === undefined ? undefined : Math.min(max, Math.max(min, next));
}
