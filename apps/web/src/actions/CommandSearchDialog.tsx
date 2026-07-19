import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import type {
  ProjectedUiAction,
  UiActionContext,
  UiActionInvocationResult,
  WorkbenchMode
} from "./actionRegistry";
import { searchUiActions } from "./commandSearch";
import {
  getNextCommandSearchResultIndex,
  invokeCommandSearchAction
} from "./commandSearchDialogModel";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/Button";
import { LiveRegion } from "../ui/LiveRegion";
import "./commandSearchDialog.css";

export interface CommandSearchDialogProps {
  /** Controlled by the workbench shortcut/router state (Ctrl/Cmd+K). */
  readonly open: boolean;
  /** The shared, already projected action list for the current document state. */
  readonly actions: readonly ProjectedUiAction[];
  /** The same memoized context used to produce `actions`. */
  readonly actionContext: UiActionContext;
  readonly currentMode?: WorkbenchMode;
  readonly onRequestClose: () => void;
  /** Overrides the built-in opener restoration when a shell owns focus routing. */
  readonly restoreFocus?: () => void;
  readonly onInitialFocus?: (input: HTMLInputElement) => void;
  readonly onActionInvoked?: (
    action: ProjectedUiAction,
    result: UiActionInvocationResult
  ) => void;
  readonly onInvocationError?: (
    action: ProjectedUiAction,
    error: unknown
  ) => void;
}

export function CommandSearchDialog({
  open,
  ...props
}: CommandSearchDialogProps) {
  return open ? <OpenCommandSearchDialog {...props} /> : null;
}

function OpenCommandSearchDialog({
  actions,
  actionContext,
  currentMode,
  onRequestClose,
  restoreFocus,
  onInitialFocus,
  onActionInvoked,
  onInvocationError
}: Omit<CommandSearchDialogProps, "open">) {
  const titleId = useId();
  const descriptionId = useId();
  const listboxId = useId();
  const resultIdPrefix = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef(new Map<number, HTMLButtonElement>());
  const focusCallbacksRef = useRef({ restoreFocus, onInitialFocus });
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailAction, setDetailAction] = useState<ProjectedUiAction>();
  const [invokingIndex, setInvokingIndex] = useState<number>();
  const [announcement, setAnnouncement] = useState("");
  const results = useMemo(
    () => searchUiActions(actions, query),
    [actions, query]
  );

  useEffect(() => {
    focusCallbacksRef.current = { restoreFocus, onInitialFocus };
  }, [onInitialFocus, restoreFocus]);

  useEffect(() => {
    const opener =
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    const input = inputRef.current;
    input?.focus();
    if (input) focusCallbacksRef.current.onInitialFocus?.(input);

    return () => {
      if (focusCallbacksRef.current.restoreFocus) {
        focusCallbacksRef.current.restoreFocus();
      } else if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  const boundedActiveIndex =
    results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);

  useEffect(() => {
    if (boundedActiveIndex < 0) return;
    resultRefs.current
      .get(boundedActiveIndex)
      ?.scrollIntoView({ block: "nearest" });
  }, [boundedActiveIndex, results]);

  const activeResult =
    boundedActiveIndex >= 0 ? results[boundedActiveIndex] : undefined;
  const activeResultId = activeResult
    ? `${resultIdPrefix}-result-${boundedActiveIndex}`
    : undefined;

  const activate = async (action: ProjectedUiAction, index: number) => {
    setActiveIndex(index);
    if (invokingIndex !== undefined || action.pending) {
      setAnnouncement(`${action.definition.label} is pending.`);
      return;
    }

    if (action.availability.status !== "ready") {
      setDetailAction(action);
    }

    setInvokingIndex(index);
    try {
      const result = await invokeCommandSearchAction(action, actionContext);
      onActionInvoked?.(action, result);

      if (result.status === "started") {
        setAnnouncement(`${action.definition.label} started.`);
        onRequestClose();
      } else if (
        result.status === "unavailable" &&
        result.availability.status === "needs-selection"
      ) {
        setAnnouncement(result.availability.message);
        onRequestClose();
      } else if (result.status === "unavailable") {
        setAnnouncement(result.availability.message);
      } else {
        setAnnouncement(`${action.definition.label} is pending.`);
      }
    } catch (error) {
      setAnnouncement(`${action.definition.label} could not be started.`);
      onInvocationError?.(action, error);
    } finally {
      setInvokingIndex(undefined);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
      return;
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
      const nextIndex = getNextCommandSearchResultIndex(
        boundedActiveIndex,
        results.length,
        event.key
      );
      setActiveIndex(nextIndex);
      setDetailAction(undefined);
      return;
    }

    if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      void activate(activeResult, boundedActiveIndex);
      return;
    }

    if (event.key === "Tab") trapDialogFocus(event, dialogRef.current);
  };

  return (
    <div
      className="pb-command-search-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onRequestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="pb-command-search"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <header className="pb-command-search__header">
          <div>
            <h2 id={titleId}>Command search</h2>
            <p id={descriptionId}>Search available Partbench actions</p>
          </div>
          <IconButton
            icon="close"
            label="Close command search"
            density="dense"
            onClick={onRequestClose}
          />
        </header>

        <div className="pb-command-search__field">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            role="combobox"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-activedescendant={activeResultId}
            autoComplete="off"
            spellCheck="false"
            placeholder="Search commands, tools, or shortcuts…"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(0);
              setDetailAction(undefined);
            }}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="pb-command-search__summary" aria-live="polite">
          <span>
            {results.length === 0
              ? "No matching commands"
              : `${results.length} command${results.length === 1 ? "" : "s"}`}
          </span>
          <span>↑↓ navigate · Enter run</span>
        </div>

        <ul
          id={listboxId}
          className="pb-command-search__results"
          role="listbox"
          aria-label="Command results"
        >
          {results.map((action, index) => {
            const presentation = getActionPresentation(
              action,
              invokingIndex === index
            );
            const selected = index === boundedActiveIndex;
            return (
              <li key={action.definition.id} role="presentation">
                <button
                  ref={(element) => {
                    if (element) resultRefs.current.set(index, element);
                    else resultRefs.current.delete(index);
                  }}
                  id={`${resultIdPrefix}-result-${index}`}
                  className={`pb-command-search__result pb-command-search__result--${presentation.status}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  aria-disabled={presentation.disabled || undefined}
                  aria-busy={presentation.status === "pending" || undefined}
                  disabled={presentation.status === "pending"}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => void activate(action, index)}
                >
                  <span className="pb-command-search__result-main">
                    <span className="pb-command-search__result-title-row">
                      <strong>{action.definition.label}</strong>
                      <span className="pb-command-search__group">
                        {action.definition.group}
                      </span>
                    </span>
                    <span className="pb-command-search__aliases">
                      Also: {action.definition.aliases.join(", ")}
                    </span>
                    <span className="pb-command-search__modes">
                      {action.definition.modes.map((mode) => (
                        <span
                          key={mode}
                          className={
                            mode === currentMode
                              ? "pb-command-search__mode is-current"
                              : "pb-command-search__mode"
                          }
                        >
                          {formatMode(mode)}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="pb-command-search__result-meta">
                    {action.definition.shortcut ? (
                      <kbd>{action.definition.shortcut}</kbd>
                    ) : null}
                    <span className="pb-command-search__availability">
                      <Icon name={presentation.icon} size={16} />
                      {presentation.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {detailAction?.availability.status !== undefined &&
        detailAction.availability.status !== "ready" ? (
          <div
            className={`pb-command-search__detail pb-command-search__detail--${detailAction.availability.status}`}
            role={
              detailAction.availability.status === "blocked"
                ? "alert"
                : "status"
            }
          >
            <Icon
              name={
                detailAction.availability.status === "blocked"
                  ? "error"
                  : "warning"
              }
              size={20}
            />
            <div>
              <strong>
                {detailAction.availability.status === "blocked"
                  ? `${detailAction.definition.label} is blocked`
                  : `${detailAction.definition.label} needs a selection`}
              </strong>
              <p>{detailAction.availability.message}</p>
            </div>
          </div>
        ) : null}

        <LiveRegion
          urgency={
            detailAction?.availability.status === "blocked"
              ? "assertive"
              : "polite"
          }
          visuallyHidden
        >
          {announcement}
        </LiveRegion>
      </div>
    </div>
  );
}

function getActionPresentation(
  action: ProjectedUiAction,
  invoking: boolean
): {
  readonly status: "ready" | "needs-selection" | "blocked" | "pending";
  readonly label: string;
  readonly icon: "success" | "warning" | "error";
  readonly disabled: boolean;
} {
  if (action.pending || invoking) {
    return {
      status: "pending",
      label: "Pending",
      icon: "warning",
      disabled: true
    };
  }
  if (action.availability.status === "needs-selection") {
    return {
      status: "needs-selection",
      label: "Needs selection",
      icon: "warning",
      disabled: false
    };
  }
  if (action.availability.status === "blocked") {
    return {
      status: "blocked",
      label: "Blocked",
      icon: "error",
      disabled: true
    };
  }
  return { status: "ready", label: "Ready", icon: "success", disabled: false };
}

function trapDialogFocus(
  event: KeyboardEvent<HTMLDivElement>,
  dialog: HTMLDivElement | null
) {
  if (!dialog) return;
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ].filter(
    (element) =>
      !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function formatMode(mode: WorkbenchMode): string {
  return `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
}
