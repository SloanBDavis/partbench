import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { getDirtyNavigationPrompt } from "../../state/workbenchReducer";
import type { WorkbenchNavigationIntent } from "../../workbench/types";
import {
  CurveEditNavigationResolutionGate,
  getWrappedDialogFocusIndex,
  handleCurveEditNavigationGuardEscape
} from "./curveEditNavigationGuardModel";

export interface CurveEditNavigationGuardProps {
  readonly intent: WorkbenchNavigationIntent;
  readonly onApply: (
    navigationTrigger: HTMLElement | null
  ) => void | Promise<void>;
  readonly onDiscard: (navigationTrigger: HTMLElement | null) => void;
  readonly onStay: () => void;
}

export function CurveEditNavigationGuard({
  intent,
  onApply,
  onDiscard,
  onStay
}: CurveEditNavigationGuardProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const navigationTriggerRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );
  const mountedRef = useRef(true);
  const resolutionGateRef = useRef(new CurveEditNavigationResolutionGate());
  const [pending, setPending] = useState(false);
  const prompt = getDirtyNavigationPrompt(intent);

  useEffect(() => {
    mountedRef.current = true;
    const dialog = dialogRef.current;
    (
      dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
      getDialogFocusableElements(dialog)[0]
    )?.focus();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (handleCurveEditNavigationGuardEscape(event, pending, () => onStay())) {
      return;
    }
    if (event.key !== "Tab") {
      event.stopPropagation();
      return;
    }
    if (pending) {
      event.preventDefault();
      event.stopPropagation();
      dialogRef.current?.focus();
      return;
    }
    const focusable = getDialogFocusableElements(dialogRef.current);
    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement
    );
    const destination = getWrappedDialogFocusIndex(
      currentIndex,
      focusable.length,
      event.shiftKey
    );
    if (destination === undefined) return;
    event.preventDefault();
    focusable[destination]?.focus();
  }

  function apply() {
    if (resolutionGateRef.current.pending) return;
    setPending(true);
    void resolutionGateRef.current
      .run(() => onApply(navigationTriggerRef.current))
      .catch(() => false)
      .finally(() => {
        if (mountedRef.current) setPending(false);
      });
  }

  function discard() {
    if (!resolutionGateRef.current.pending) {
      onDiscard(navigationTriggerRef.current);
    }
  }

  function stay() {
    if (!resolutionGateRef.current.pending) onStay();
  }

  return (
    <div
      ref={dialogRef}
      className="pb-curve-edit-navigation-guard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="curve-edit-navigation-title"
      aria-busy={pending}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div>
        <h2 id="curve-edit-navigation-title">{prompt.title}</h2>
        <p>{prompt.message}</p>
        <div className="pb-sketch-actions">
          <button
            type="button"
            className="pb-button pb-button--primary"
            data-dialog-initial-focus=""
            disabled={pending}
            onClick={apply}
          >
            {prompt.applyLabel}
          </button>
          <button
            type="button"
            className="pb-button"
            disabled={pending}
            onClick={discard}
          >
            {prompt.discardLabel}
          </button>
          <button
            type="button"
            className="pb-button"
            disabled={pending}
            onClick={stay}
          >
            {prompt.stayLabel}
          </button>
        </div>
        <span role="status" aria-live="polite">
          {pending ? "Applying sketch edit…" : ""}
        </span>
      </div>
    </div>
  );
}

function getDialogFocusableElements(dialog: HTMLElement | null): HTMLElement[] {
  if (!dialog) return [];
  return [
    ...dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )
  ].filter((element) => !element.hidden);
}
