export interface ViewportKeyboardEventLike {
  readonly key: string;
  readonly defaultPrevented?: boolean;
  readonly target?: EventTarget | null;
}

interface KeyboardTargetLike {
  readonly tagName?: unknown;
  readonly isContentEditable?: unknown;
  readonly getAttribute?: (name: string) => string | null;
  readonly closest?: (selector: string) => unknown;
}

const EDITABLE_TAG_NAMES = new Set(["input", "select", "textarea"]);
const EDITABLE_ROLES = new Set(["combobox", "searchbox", "textbox"]);
const EDITABLE_SELECTOR =
  "input, select, textarea, [contenteditable='true'], [contenteditable='plaintext-only'], [role='combobox'], [role='searchbox'], [role='textbox']";

export function shouldCancelViewportTransientState(
  event: ViewportKeyboardEventLike
): boolean {
  return (
    event.key === "Escape" &&
    !event.defaultPrevented &&
    !isEditableKeyboardTarget(event.target)
  );
}

export function isEditableKeyboardTarget(
  target: EventTarget | null | undefined
): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const candidate = target as KeyboardTargetLike;
  const tagName =
    typeof candidate.tagName === "string"
      ? candidate.tagName.toLowerCase()
      : undefined;

  if (tagName && EDITABLE_TAG_NAMES.has(tagName)) {
    return true;
  }

  if (candidate.isContentEditable === true) {
    return true;
  }

  if (typeof candidate.getAttribute === "function") {
    const role = candidate.getAttribute("role")?.toLowerCase();
    const contentEditable = candidate
      .getAttribute("contenteditable")
      ?.toLowerCase();

    if (
      (role && EDITABLE_ROLES.has(role)) ||
      contentEditable === "true" ||
      contentEditable === "plaintext-only"
    ) {
      return true;
    }
  }

  if (typeof candidate.closest === "function") {
    return Boolean(candidate.closest(EDITABLE_SELECTOR));
  }

  return false;
}
