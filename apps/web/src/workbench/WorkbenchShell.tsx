import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { Icon } from "../ui/Icon";
import { WORKBENCH_LAYOUT } from "../styles/tokens";
import type { WorkbenchMode } from "./types";
import { DockDivider } from "./DockDivider";
import {
  resolveWorkbenchLayout,
  type DockLayoutState,
  type DockSide
} from "./workbenchLayout";
import "../styles/shell.css";

export interface WorkbenchShellProps {
  readonly mode: WorkbenchMode;
  readonly viewportWidth?: number;
  readonly leftDockWidth: number;
  readonly rightDockWidth: number;
  readonly leftDockCollapsed: boolean;
  readonly rightDockCollapsed: boolean;
  readonly activeEditor?: boolean;
  /** Project details are selected; Project otherwise suppresses the right dock. */
  readonly projectDetailsOpen?: boolean;
  readonly openDrawer?: DockSide;
  readonly onOpenDrawerChange?: (side: DockSide | undefined) => void;
  readonly onDockCollapsedChange: (side: DockSide, collapsed: boolean) => void;
  readonly onDockWidthChange: (side: DockSide, width: number) => void;
  readonly header: ReactNode;
  readonly ribbon: ReactNode;
  readonly leftDock: ReactNode;
  readonly viewport: ReactNode;
  readonly projectWorkspace: ReactNode;
  readonly rightDock: ReactNode;
  readonly statusBar: ReactNode;
  readonly leftDockLabel?: string;
  readonly rightDockLabel?: string;
}

type ShellStyle = CSSProperties & {
  readonly "--pb-current-left-dock-width": string;
  readonly "--pb-current-right-dock-width": string;
};

/** Stable six-region shell. Every slot remains mounted across mode/layout changes. */
export function WorkbenchShell({
  mode,
  viewportWidth: viewportWidthProp,
  leftDockWidth,
  rightDockWidth,
  leftDockCollapsed,
  rightDockCollapsed,
  activeEditor = false,
  projectDetailsOpen = false,
  openDrawer: controlledOpenDrawer,
  onOpenDrawerChange,
  onDockCollapsedChange,
  onDockWidthChange,
  header,
  ribbon,
  leftDock,
  viewport,
  projectWorkspace,
  rightDock,
  statusBar,
  leftDockLabel = mode === "project" ? "Project navigation" : "Document tree",
  rightDockLabel = activeEditor ? "Feature editor" : "Inspector"
}: WorkbenchShellProps) {
  const measuredWidth = useViewportWidth(viewportWidthProp);
  const [uncontrolledDrawer, setUncontrolledDrawer] = useState<
    DockSide | undefined
  >();
  const openDrawer = controlledOpenDrawer ?? uncontrolledDrawer;
  const previousEditorRef = useRef(activeEditor);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);

  const setOpenDrawer = useCallback(
    (side: DockSide | undefined, opener?: HTMLElement) => {
      if (opener) drawerOpenerRef.current = opener;
      if (controlledOpenDrawer === undefined) setUncontrolledDrawer(side);
      onOpenDrawerChange?.(side);
    },
    [controlledOpenDrawer, onOpenDrawerChange]
  );

  useEffect(() => {
    if (
      activeEditor &&
      !previousEditorRef.current &&
      measuredWidth < WORKBENCH_LAYOUT.inlineDocksBreakpoint
    ) {
      setOpenDrawer("right");
    }
    previousEditorRef.current = activeEditor;
  }, [activeEditor, measuredWidth, setOpenDrawer]);

  const rightDockSuppressed = mode === "project" && !projectDetailsOpen;
  const layout = resolveWorkbenchLayout({
    viewportWidth: measuredWidth,
    leftDockWidth,
    rightDockWidth,
    leftDockCollapsed,
    rightDockCollapsed: rightDockCollapsed || rightDockSuppressed,
    openDrawer,
    activeEditor
  });
  const shellStyle: ShellStyle = {
    "--pb-current-left-dock-width": `${leftDockWidth}px`,
    "--pb-current-right-dock-width": `${rightDockWidth}px`
  };

  const toggleDock = (side: DockSide, opener: HTMLElement) => {
    const state = layout[side];
    const collapsed = side === "left" ? leftDockCollapsed : rightDockCollapsed;
    if (state.placement === "drawer") {
      if (state.visible) {
        setOpenDrawer(undefined);
        opener.focus();
      } else {
        if (collapsed) onDockCollapsedChange(side, false);
        setOpenDrawer(side, opener);
      }
      return;
    }
    onDockCollapsedChange(side, state.visible);
  };

  const closeDrawer = () => {
    setOpenDrawer(undefined);
    requestAnimationFrameSafe(() => drawerOpenerRef.current?.focus());
  };

  return (
    <div className="pb-workbench-shell" style={shellStyle} data-mode={mode}>
      <div className="pb-workbench-shell__header">{header}</div>
      <div className="pb-workbench-shell__ribbon">{ribbon}</div>

      <div className="pb-workbench-shell__main">
        <button
          className="pb-dock-toggle pb-dock-toggle--left"
          type="button"
          aria-label={
            layout.left.visible
              ? `Close ${leftDockLabel}`
              : `Open ${leftDockLabel}`
          }
          aria-expanded={layout.left.visible}
          onClick={(event) => toggleDock("left", event.currentTarget)}
        >
          <Icon name={layout.left.visible ? "chevron-down" : "chevron-right"} />
          <span className="pb-visually-hidden">{leftDockLabel}</span>
        </button>

        <DockRegion
          side="left"
          label={leftDockLabel}
          state={layout.left}
          onCloseDrawer={closeDrawer}
          restoreFocus={() => drawerOpenerRef.current?.focus()}
        >
          {leftDock}
        </DockRegion>
        {layout.left.placement === "inline" && layout.left.visible ? (
          <DockDivider
            side="left"
            value={leftDockWidth}
            min={WORKBENCH_LAYOUT.leftDock.min}
            max={WORKBENCH_LAYOUT.leftDock.max}
            onResize={(width) => onDockWidthChange("left", width)}
          />
        ) : null}

        <main
          className="pb-workbench-shell__workspace"
          aria-label="Workbench workspace"
        >
          <section
            className="pb-workbench-shell__viewport"
            aria-label="CAD viewport"
            hidden={mode === "project"}
            aria-hidden={mode === "project" || undefined}
          >
            {viewport}
          </section>
          <section
            className="pb-workbench-shell__project"
            aria-label="Project workspace"
            hidden={mode !== "project"}
            aria-hidden={mode !== "project" || undefined}
          >
            {projectWorkspace}
          </section>
        </main>

        {layout.right.placement === "inline" && layout.right.visible ? (
          <DockDivider
            side="right"
            value={rightDockWidth}
            min={WORKBENCH_LAYOUT.rightDock.min}
            max={WORKBENCH_LAYOUT.rightDock.max}
            onResize={(width) => onDockWidthChange("right", width)}
          />
        ) : null}
        <DockRegion
          side="right"
          label={rightDockLabel}
          state={layout.right}
          onCloseDrawer={closeDrawer}
          restoreFocus={() => drawerOpenerRef.current?.focus()}
        >
          {rightDock}
        </DockRegion>

        <button
          className="pb-dock-toggle pb-dock-toggle--right"
          type="button"
          aria-label={
            layout.right.visible
              ? `Close ${rightDockLabel}`
              : `Open ${rightDockLabel}`
          }
          aria-expanded={layout.right.visible}
          hidden={rightDockSuppressed}
          onClick={(event) => toggleDock("right", event.currentTarget)}
        >
          <Icon
            name={layout.right.visible ? "chevron-down" : "chevron-right"}
          />
          <span className="pb-visually-hidden">{rightDockLabel}</span>
        </button>

        {layout.activeDrawer ? (
          <button
            className="pb-drawer-scrim"
            type="button"
            aria-label={`Close ${layout.activeDrawer === "left" ? leftDockLabel : rightDockLabel}`}
            onClick={closeDrawer}
          />
        ) : null}
      </div>

      <div className="pb-workbench-shell__status">{statusBar}</div>
    </div>
  );
}

function DockRegion({
  side,
  label,
  state,
  onCloseDrawer,
  restoreFocus,
  children
}: {
  readonly side: DockSide;
  readonly label: string;
  readonly state: DockLayoutState;
  readonly onCloseDrawer: () => void;
  readonly restoreFocus: () => void;
  readonly children: ReactNode;
}) {
  const regionRef = useRef<HTMLElement>(null);
  const wasVisibleRef = useRef(state.visible);

  useEffect(() => {
    if (
      state.placement === "drawer" &&
      state.visible &&
      !wasVisibleRef.current
    ) {
      requestAnimationFrameSafe(() => {
        const initial = regionRef.current?.querySelector<HTMLElement>(
          "[data-drawer-initial-focus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
        );
        (initial ?? regionRef.current)?.focus();
      });
    }
    if (
      state.placement === "drawer" &&
      !state.visible &&
      wasVisibleRef.current
    ) {
      restoreFocus();
    }
    wasVisibleRef.current = state.visible;
  }, [restoreFocus, state.placement, state.visible]);

  const trapDrawerFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (state.placement !== "drawer" || !state.visible) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCloseDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...(regionRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      ) ?? [])
    ].filter((element) => !element.hidden);
    if (focusable.length === 0) {
      event.preventDefault();
      regionRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const drawer = state.placement === "drawer";
  return (
    <aside
      ref={regionRef}
      className={`pb-dock pb-dock--${side} pb-dock--${state.placement}`}
      aria-label={label}
      aria-hidden={!state.visible || undefined}
      aria-modal={drawer && state.visible ? true : undefined}
      role={drawer && state.visible ? "dialog" : "complementary"}
      tabIndex={drawer && state.visible ? -1 : undefined}
      hidden={!state.visible}
      data-hidden-for-viewport={state.hiddenForViewport || undefined}
      onKeyDown={trapDrawerFocus}
    >
      {children}
    </aside>
  );
}

function useViewportWidth(override: number | undefined): number {
  const [width, setWidth] = useState(
    () => override ?? (typeof window === "undefined" ? 1536 : window.innerWidth)
  );
  useEffect(() => {
    if (override !== undefined || typeof window === "undefined") return;
    const update = () => setWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [override]);
  return override ?? width;
}

function requestAnimationFrameSafe(callback: () => void): void {
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(callback);
  else callback();
}
