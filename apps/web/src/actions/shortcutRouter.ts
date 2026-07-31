import {
  expandShortcutDeclaration,
  resolveShortcutActionId,
  UI_ACTION_REGISTRY,
  type UiActionDefinition,
  type UiActionId,
  type WorkbenchMode
} from "./actionRegistry";
import { isEditableKeyboardTarget } from "../viewportKeyboard";

export interface ShortcutKeyboardEventLike {
  readonly key: string;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly defaultPrevented?: boolean;
  readonly target?: EventTarget | null;
}

const MODIFIER_SHORTCUT_PATTERN = /^(Ctrl\/Cmd|Ctrl|Cmd|Alt|Shift)\+/i;

/** True when the binding is a bare key (F, F2, Delete) rather than a chord. */
export function isSingleKeyShortcutToken(token: string): boolean {
  return !MODIFIER_SHORTCUT_PATTERN.test(token.trim());
}

/**
 * Map a keyboard event to registry shortcut tokens (e.g. `Ctrl/Cmd+K`, `Delete`).
 * Returns every token form that should be tried against {@link resolveShortcutActionId}.
 */
export function shortcutTokensFromKeyboardEvent(
  event: ShortcutKeyboardEventLike
): readonly string[] {
  if (event.altKey) return [];

  const ctrlOrCmd = Boolean(event.ctrlKey || event.metaKey);
  const key = event.key;
  const lower = key.toLowerCase();

  if (ctrlOrCmd) {
    if (lower === "k" && !event.shiftKey) return ["Ctrl/Cmd+K"];
    if (lower === "z") {
      return event.shiftKey ? ["Ctrl/Cmd+Shift+Z"] : ["Ctrl/Cmd+Z"];
    }
    if (lower === "y" && !event.shiftKey) return ["Ctrl+Y"];
    if (key === "Enter" && !event.shiftKey) return ["Ctrl/Cmd+Enter"];
    return [];
  }

  if (event.shiftKey) return [];

  if (key === "Escape") return ["Escape"];
  if (key === "Delete") return ["Delete"];
  if (key === "Backspace") return ["Backspace"];
  if (key === "F2") return ["F2"];
  if (key.length === 1 && /[a-z]/i.test(key)) return [key.toUpperCase()];
  if (/^F\d{1,2}$/i.test(key)) return [key.toUpperCase()];
  return [];
}

export interface ResolveShortcutRouterResult {
  readonly actionId: UiActionId;
  readonly token: string;
  readonly singleKey: boolean;
}

/**
 * Resolve a key event to at most one registry action for the active mode.
 * Single-key bindings except global Escape are suppressed in editable controls.
 */
export function resolveShortcutRouterAction(
  event: ShortcutKeyboardEventLike,
  mode: WorkbenchMode,
  registry: readonly UiActionDefinition[] = UI_ACTION_REGISTRY
): ResolveShortcutRouterResult | undefined {
  if (event.defaultPrevented) return undefined;

  const tokens = shortcutTokensFromKeyboardEvent(event);
  if (tokens.length === 0) return undefined;

  const editable = isEditableKeyboardTarget(event.target);

  for (const token of tokens) {
    const singleKey = isSingleKeyShortcutToken(token);
    if (singleKey && editable && token !== "Escape") continue;

    const actionId = resolveShortcutActionId(token, mode, registry);
    if (actionId) {
      return { actionId, token, singleKey };
    }
  }

  return undefined;
}

/** Build Help copy from registry shortcut metadata so it cannot drift from bindings. */
export function formatShortcutHelpNotice(
  registry: readonly UiActionDefinition[] = UI_ACTION_REGISTRY
): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const action of registry) {
    if (!action.shortcut) continue;
    for (const token of expandShortcutDeclaration(action.shortcut)) {
      const key = token.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(`${token} ${action.label}`);
    }
  }

  if (parts.length === 0) {
    return "No keyboard shortcuts are registered.";
  }

  return `Shortcuts: ${parts.join(", ")}.`;
}
