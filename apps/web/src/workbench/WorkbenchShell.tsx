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
  findDrawerInitialFocus,
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
  readonly activeEditorKey?: string;
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

export function WorkbenchShell({
  mode,
  viewportWidth: viewportWidthProp,
  leftDockWidth,
  rightDockWidth,
  leftDockCollapsed,
  rightDockCollapsed,
  activeEditor = false,
  activeEditorKey,
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
  const [editorDrawerDismissed, setEditorDrawerDismissed] = useState(false);
  const openDrawer = controlledOpenDrawer ?? uncontrolledDrawer;
  const editorKey: string | true | undefined = activeEditor
    ? (activeEditorKey ?? true)
    : undefined;
  const previousEditorRef = useRef(editorKey);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  const rightToggleRef = useRef<HTMLButtonElement>(null);

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
      shouldOpenEditorDrawer(
        previousEditorRef.current,
        editorKey,
        measuredWidth
      )
    ) {
      setEditorDrawerDismissed(false);
      setOpenDrawer("right");
    }
    previousEditorRef.current = editorKey;
  }, [editorKey, measuredWidth, setOpenDrawer]);

  const rightDockSuppressed = mode === "project" && !projectDetailsOpen;
  const layout = resolveWorkbenchLayout({
    viewportWidth: measuredWidth,
    leftDockWidth,
    rightDockWidth,
    leftDockCollapsed,
    rightDockCollapsed: rightDockCollapsed || rightDockSuppressed,
    openDrawer,
    activeEditor: activeEditor && !editorDrawerDismissed
  });
  const shellStyle: ShellStyle = {
    "--pb-current-left-dock-width": `${leftDockWidth}px`,
    "--pb-current-right-dock-width": `${rightDockWidth}px`
  };
  const drawerModal = Boolean(layout.activeDrawer);
  const leftToggleBlocked = layout.leftDrawerBlockedByEditor;
  const rightToggleBlocked =
    layout.rightDrawerForcedByEditor || rightDockSuppressed;
  const leftToggleTitle = leftToggleBlocked
    ? "Close the feature editor to open the document tree"
    : undefined;
  const rightToggleTitle = layout.rightDrawerForcedByEditor
    ? "Close the feature editor to dismiss this drawer"
    : undefined;

  const toggleDock = (side: DockSide, opener: HTMLElement) => {
    const state = layout[side];
    if (side === "left" && leftToggleBlocked) return;
    if (side === "right" && layout.rightDrawerForcedByEditor) return;
    if (state.placement === "drawer") {
      if (state.visible) {
        setOpenDrawer(undefined);
        opener.focus();
      } else {
        // Never write breakpoint/drawer opens into the persisted collapse
        // preference — openDrawer alone drives drawer visibility.
        setOpenDrawer(side, opener);
      }
      return;
    }
    onDockCollapsedChange(side, state.visible);
  };

  const closeDrawer = () => {
    if (layout.activeDrawer === "right" && activeEditor)
      setEditorDrawerDismissed(true);
    setOpenDrawer(undefined);
    requestAnimationFrameSafe(() =>
      (drawerOpenerRef.current ?? rightToggleRef.current)?.focus()
    );
  };

  return (
    <div className="pb-workbench-shell" style={shellStyle} data-mode={mode}>
      <div className="pb-workbench-shell__header" {...inertProps(drawerModal)}>
        {header}
      </div>
      <div className="pb-workbench-shell__ribbon" {...inertProps(drawerModal)}>
        {ribbon}
      </div>

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
          aria-disabled={leftToggleBlocked || undefined}
          title={leftToggleTitle}
          disabled={leftToggleBlocked}
          {...inertProps(drawerModal)}
          onClick={(event) => toggleDock("left", event.currentTarget)}
        >
          <Icon name={layout.left.visible ? "chevron-down" : "chevron-right"} />
          <span className="pb-visually-hidden">{leftDockLabel}</span>
        </button>

        <DockRegion
          side="left"
          label={leftDockLabel}
          state={layout.left}
          inertOutside={drawerModal && layout.activeDrawer !== "left"}
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
          {...inertProps(drawerModal)}
        >
          <section
            className="pb-workbench-shell__viewport"
            hidden={mode === "project"}
          >
            {viewport}
          </section>
          <section
            className="pb-workbench-shell__project"
            hidden={mode !== "project"}
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
          inertOutside={drawerModal && layout.activeDrawer !== "right"}
          onCloseDrawer={closeDrawer}
          restoreFocus={() => drawerOpenerRef.current?.focus()}
        >
          {rightDock}
        </DockRegion>

        <button
          ref={rightToggleRef}
          className="pb-dock-toggle pb-dock-toggle--right"
          type="button"
          aria-label={
            layout.right.visible
              ? `Close ${rightDockLabel}`
              : `Open ${rightDockLabel}`
          }
          aria-expanded={layout.right.visible}
          aria-disabled={rightToggleBlocked || undefined}
          title={rightToggleTitle}
          hidden={rightDockSuppressed}
          disabled={layout.rightDrawerForcedByEditor}
          {...inertProps(drawerModal)}
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

      <div className="pb-workbench-shell__status" {...inertProps(drawerModal)}>
        {statusBar}
      </div>
    </div>
  );
}

function DockRegion({
  side,
  label,
  state,
  inertOutside = false,
  onCloseDrawer,
  restoreFocus,
  children
}: {
  readonly side: DockSide;
  readonly label: string;
  readonly state: DockLayoutState;
  readonly inertOutside?: boolean;
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
        const initial = findDrawerInitialFocus(regionRef.current);
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
      {...inertProps(inertOutside)}
    >
      {drawer && state.visible ? (
        <button
          className="pb-dock__drawer-close"
          type="button"
          aria-label={`Close ${label}`}
          onClick={onCloseDrawer}
        >
          <Icon name="close" />
        </button>
      ) : null}
      {children}
    </aside>
  );
}

function inertProps(active: boolean): { readonly inert?: true } {
  return active ? { inert: true } : {};
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

export function shouldOpenEditorDrawer(
  previousEditorKey: string | true | undefined,
  editorKey: string | true | undefined,
  viewportWidth: number
): boolean {
  return (
    editorKey !== undefined &&
    editorKey !== previousEditorKey &&
    viewportWidth < WORKBENCH_LAYOUT.inlineDocksBreakpoint
  );
}
