import type { WorkbenchNavigationIntent } from "../../workbench/types";

const CURVE_EDIT_TRANSIENT_FOCUS_SELECTOR = [
  '[role="dialog"][aria-labelledby="curve-edit-navigation-title"]',
  '[aria-label="Trim sketch geometry"]',
  '[aria-label="Extend sketch geometry"]',
  '[aria-label="Split sketch geometry"]',
  '[aria-label="Explode rectangle sketch geometry"]',
  '[aria-label="Offset sketch geometry"]',
  '[aria-label="Create Slot"]',
  '[aria-label="Create Rounded Rectangle"]'
].join(", ");

interface CurveEditNavigationFocusElement {
  readonly isConnected: boolean;
  closest(selector: string): unknown;
}

export class CurveEditNavigationResolutionGate {
  #pending = false;

  get pending(): boolean {
    return this.#pending;
  }

  async run(action: () => void | Promise<void>): Promise<boolean> {
    if (this.#pending) return false;
    this.#pending = true;
    try {
      await action();
      return true;
    } finally {
      this.#pending = false;
    }
  }
}

export function handleCurveEditNavigationGuardEscape(
  event: Pick<Event, "preventDefault" | "stopPropagation"> & {
    readonly key: string;
  },
  pending: boolean,
  onStay: () => void
): boolean {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  event.stopPropagation();
  if (!pending) onStay();
  return true;
}

export function getCurveEditDiscardFocusTarget<T>(
  intent: WorkbenchNavigationIntent,
  curveEditOpener: T | null,
  navigationTrigger: T | null,
  editorReturnFocusTarget: T | null = null
): T | null {
  return intent.kind === "close-editor"
    ? (curveEditOpener ?? editorReturnFocusTarget)
    : (navigationTrigger ?? curveEditOpener ?? editorReturnFocusTarget);
}

export function shouldRestoreResolvedCurveEditNavigationFocus({
  activeElement,
  body,
  documentElement
}: {
  readonly activeElement: CurveEditNavigationFocusElement | null;
  readonly body: CurveEditNavigationFocusElement;
  readonly documentElement: CurveEditNavigationFocusElement;
}): boolean {
  return (
    !activeElement ||
    !activeElement.isConnected ||
    activeElement === body ||
    activeElement === documentElement ||
    Boolean(activeElement.closest(CURVE_EDIT_TRANSIENT_FOCUS_SELECTOR))
  );
}

export function getWrappedDialogFocusIndex(
  currentIndex: number,
  focusableCount: number,
  shiftKey: boolean
): number | undefined {
  if (focusableCount === 0) return undefined;
  if (currentIndex < 0) return shiftKey ? focusableCount - 1 : 0;
  if (shiftKey && currentIndex === 0) return focusableCount - 1;
  if (!shiftKey && currentIndex === focusableCount - 1) return 0;
  return undefined;
}
