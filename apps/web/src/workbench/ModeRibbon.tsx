import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import type {
  ProjectedUiAction,
  UiActionAvailability
} from "../actions/actionRegistry";
import { Icon } from "../ui/Icon";
import type { WorkbenchMode } from "./types";
import {
  chooseVisibleRibbonGroupIds,
  getActionIcon,
  projectRibbonGroups,
  type RibbonGroupProjection
} from "./modeRibbonModel";
import "../styles/ribbon.css";

const MODES: readonly WorkbenchMode[] = [
  "project",
  "solid",
  "sketch",
  "inspect"
];

export interface ModeRibbonProps {
  readonly mode: WorkbenchMode;
  readonly actions: readonly ProjectedUiAction[];
  readonly activeActionId?: string;
  readonly onModeChange: (mode: WorkbenchMode) => void;
  readonly onInvokeAction: (action: ProjectedUiAction) => void;
  readonly onExplainUnavailable?: (
    action: ProjectedUiAction,
    availability: Exclude<UiActionAvailability, { readonly status: "ready" }>
  ) => void;
  /** Deterministic override used by visual harnesses; normal layout measures itself. */
  readonly availableGroupWidth?: number;
}

/** Labeled, mode-aware toolbar projected exclusively from the UI action registry. */
export function ModeRibbon({
  mode,
  actions,
  activeActionId,
  onModeChange,
  onInvokeAction,
  onExplainUnavailable,
  availableGroupWidth
}: ModeRibbonProps) {
  const groups = useMemo(
    () => projectRibbonGroups(mode, actions),
    [mode, actions]
  );
  const [visibleGroupIds, setVisibleGroupIds] = useState<ReadonlySet<string>>(
    () => new Set(groups.map((group) => group.id))
  );
  const [rovingId, setRovingId] = useState(`mode-${mode}`);
  const rootRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const measuringRef = useRef<HTMLDivElement>(null);
  const effectiveRovingId =
    !activeActionId && !rovingId.startsWith("mode-")
      ? `mode-${mode}`
      : rovingId;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measuring = measuringRef.current;
    if (!root || !measuring) return;

    const measure = () => {
      const widths: Record<string, number> = {};
      for (const element of measuring.querySelectorAll<HTMLElement>(
        "[data-ribbon-group-id]"
      )) {
        const id = element.dataset.ribbonGroupId;
        if (id)
          widths[id] = Math.ceil(element.getBoundingClientRect().width) + 1;
      }
      const reserved =
        (modeRef.current?.getBoundingClientRect().width ?? 132) + 24;
      const available =
        availableGroupWidth ??
        Math.max(0, root.getBoundingClientRect().width - reserved);
      setVisibleGroupIds(
        chooseVisibleRibbonGroupIds(groups, widths, available)
      );
    };

    measure();
    if (
      availableGroupWidth !== undefined ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [availableGroupWidth, groups]);

  useEffect(() => {
    const current = rootRef.current?.querySelector<HTMLElement>(
      `[data-ribbon-roving-id="${escapeSelector(effectiveRovingId)}"]`
    );
    if (!current || current.hidden) setRovingId(`mode-${mode}`);
  }, [effectiveRovingId, mode, visibleGroupIds]);

  const overflowGroups = groups.filter(
    (group) => !visibleGroupIds.has(group.id)
  );

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const elements = [
      ...(groupsRef.current?.querySelectorAll<HTMLElement>(
        "[data-ribbon-roving-id]:not([hidden]):not([disabled])"
      ) ?? [])
    ];
    if (elements.length === 0) return;
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      elements.indexOf(document.activeElement as HTMLElement)
    );
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? elements.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % elements.length
            : (currentIndex - 1 + elements.length) % elements.length;
    const next = elements[nextIndex];
    setRovingId(next.dataset.ribbonRovingId ?? `mode-${mode}`);
    next.focus();
  };

  return (
    <div
      ref={rootRef}
      className="pb-mode-ribbon"
      role="toolbar"
      aria-label={`${format(mode)} tools`}
      aria-orientation="horizontal"
      onKeyDown={handleToolbarKeyDown}
    >
      <div ref={groupsRef} className="pb-mode-ribbon__contents">
        <div
          ref={modeRef}
          className="pb-mode-selector"
          role="tablist"
          aria-label="Workbench mode"
        >
          {MODES.map((candidate) => (
            <button
              key={candidate}
              className="pb-mode-selector__button"
              type="button"
              role="tab"
              aria-selected={candidate === mode}
              data-ribbon-roving-id={`mode-${candidate}`}
              tabIndex={effectiveRovingId === `mode-${candidate}` ? 0 : -1}
              onFocus={() => setRovingId(`mode-${candidate}`)}
              onClick={() => onModeChange(candidate)}
            >
              <Icon name={candidate} size={20} />
              <span>{format(candidate)}</span>
            </button>
          ))}
        </div>

        <div className="pb-mode-ribbon__groups">
          {groups.map((group) => (
            <RibbonGroup
              key={group.id}
              group={group}
              hidden={!visibleGroupIds.has(group.id)}
              activeActionId={activeActionId}
              rovingId={effectiveRovingId}
              onRovingChange={setRovingId}
              onInvokeAction={onInvokeAction}
              onExplainUnavailable={onExplainUnavailable}
            />
          ))}
        </div>

        {overflowGroups.length > 0 ? (
          <details className="pb-ribbon-overflow">
            <summary
              data-ribbon-roving-id="ribbon-more"
              tabIndex={effectiveRovingId === "ribbon-more" ? 0 : -1}
              onFocus={() => setRovingId("ribbon-more")}
            >
              <Icon name="more" size={20} />
              <span>More</span>
            </summary>
            <div
              className="pb-ribbon-overflow__menu"
              role="menu"
              aria-label="More tools"
            >
              {overflowGroups.map((group) => (
                <section
                  key={group.id}
                  className="pb-ribbon-overflow__group"
                  aria-label={group.label}
                >
                  <h3>{group.label}</h3>
                  {group.actions.map((action) => (
                    <RibbonActionButton
                      key={action.definition.id}
                      action={action}
                      active={action.definition.id === activeActionId}
                      menuItem
                      onInvokeAction={onInvokeAction}
                      onExplainUnavailable={onExplainUnavailable}
                    />
                  ))}
                </section>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <div
        ref={measuringRef}
        className="pb-mode-ribbon__measure"
        aria-hidden="true"
      >
        {groups.map((group) => (
          <RibbonGroup
            key={group.id}
            group={group}
            dataGroupId={group.id}
            activeActionId={activeActionId}
            rovingId=""
            onRovingChange={() => undefined}
            onInvokeAction={() => undefined}
          />
        ))}
      </div>
    </div>
  );
}

function RibbonGroup({
  group,
  hidden = false,
  dataGroupId,
  activeActionId,
  rovingId,
  onRovingChange,
  onInvokeAction,
  onExplainUnavailable
}: {
  readonly group: RibbonGroupProjection;
  readonly hidden?: boolean;
  readonly dataGroupId?: string;
  readonly activeActionId?: string;
  readonly rovingId: string;
  readonly onRovingChange: (id: string) => void;
  readonly onInvokeAction: (action: ProjectedUiAction) => void;
  readonly onExplainUnavailable?: ModeRibbonProps["onExplainUnavailable"];
}) {
  return (
    <section
      className="pb-ribbon-group"
      hidden={hidden}
      data-ribbon-group-id={dataGroupId}
      aria-label={group.label}
    >
      <div className="pb-ribbon-group__actions">
        {group.actions.map((action) => {
          const id = `action-${action.definition.id}`;
          return (
            <RibbonActionButton
              key={action.definition.id}
              action={action}
              active={action.definition.id === activeActionId}
              tabIndex={rovingId === id ? 0 : -1}
              rovingId={id}
              onFocus={() => onRovingChange(id)}
              onInvokeAction={onInvokeAction}
              onExplainUnavailable={onExplainUnavailable}
            />
          );
        })}
      </div>
      <h2>{group.label}</h2>
    </section>
  );
}

function RibbonActionButton({
  action,
  active,
  menuItem = false,
  tabIndex,
  rovingId,
  onFocus,
  onInvokeAction,
  onExplainUnavailable
}: {
  readonly action: ProjectedUiAction;
  readonly active: boolean;
  readonly menuItem?: boolean;
  readonly tabIndex?: number;
  readonly rovingId?: string;
  readonly onFocus?: () => void;
  readonly onInvokeAction: (action: ProjectedUiAction) => void;
  readonly onExplainUnavailable?: ModeRibbonProps["onExplainUnavailable"];
}) {
  const blocked = action.availability.status === "blocked";
  const needsSelection = action.availability.status === "needs-selection";
  const reason =
    blocked || needsSelection ? action.availability.message : undefined;
  const invoke = () => {
    if (action.pending) return;
    if (blocked) {
      onExplainUnavailable?.(action, action.availability);
      return;
    }
    onInvokeAction(action);
  };

  return (
    <button
      className="pb-ribbon-action"
      type="button"
      role={menuItem ? "menuitem" : undefined}
      disabled={action.pending}
      aria-disabled={blocked || undefined}
      aria-busy={action.pending || undefined}
      aria-pressed={active || undefined}
      data-availability={action.availability.status}
      aria-keyshortcuts={action.definition.shortcut}
      title={reason ?? action.definition.shortcut ?? action.definition.label}
      tabIndex={menuItem ? undefined : tabIndex}
      data-ribbon-roving-id={rovingId}
      onFocus={onFocus}
      onClick={invoke}
    >
      <Icon name={getActionIcon(action.definition.id)} size={20} />
      <span>{action.definition.label}</span>
    </button>
  );
}

function format(mode: WorkbenchMode): string {
  return mode[0].toUpperCase() + mode.slice(1);
}

function escapeSelector(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
}
