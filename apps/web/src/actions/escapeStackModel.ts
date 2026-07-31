/**
 * Deterministic Escape cancellation order from docs/v18.md:
 * 1. transient popover
 * 2. overlay drawer
 * 3. viewport gesture
 * 4. measurement second-target capture
 * 5. command search
 * 6. clean editor / dirty editor prompt
 * 7. clear selection
 */

export const ESCAPE_RUNGS = [
  "transient-popover",
  "overlay-drawer",
  "viewport-gesture",
  "measurement-second-target",
  "command-search",
  "editor",
  "selection"
] as const;

export type EscapeRung = (typeof ESCAPE_RUNGS)[number];

export type EscapeEditorState = "none" | "clean" | "dirty";

export interface EscapeStackSnapshot {
  readonly transientPopover: boolean;
  readonly overlayDrawer: boolean;
  readonly viewportGesture: boolean;
  readonly measurementSecondTarget: boolean;
  readonly commandSearch: boolean;
  readonly editor: EscapeEditorState;
  readonly selection: boolean;
}

/** Return the first Escape rung that should consume the key for this snapshot. */
export function resolveEscapeRung(
  snapshot: EscapeStackSnapshot
): EscapeRung | undefined {
  if (snapshot.transientPopover) return "transient-popover";
  if (snapshot.overlayDrawer) return "overlay-drawer";
  if (snapshot.viewportGesture) return "viewport-gesture";
  if (snapshot.measurementSecondTarget) return "measurement-second-target";
  if (snapshot.commandSearch) return "command-search";
  if (snapshot.editor !== "none") return "editor";
  if (snapshot.selection) return "selection";
  return undefined;
}

export interface EscapeEditorContributor {
  readonly id: string;
  /** When true, this contributor must not participate (e.g. navigation guard open). */
  readonly suspended?: () => boolean;
  readonly getState: () => EscapeEditorState;
  readonly cancelClean: () => void;
  readonly requestDirtyGuard: () => void;
}

const editorContributors = new Map<string, EscapeEditorContributor>();

export function registerEscapeEditorContributor(
  contributor: EscapeEditorContributor
): () => void {
  editorContributors.set(contributor.id, contributor);
  return () => {
    if (editorContributors.get(contributor.id) === contributor) {
      editorContributors.delete(contributor.id);
    }
  };
}

export function listEscapeEditorContributors(): readonly EscapeEditorContributor[] {
  return [...editorContributors.values()];
}

/** Merge registered editor contributors into a single editor rung state. */
export function resolveContributedEscapeEditorState(
  contributors: readonly EscapeEditorContributor[] = listEscapeEditorContributors()
): {
  readonly state: EscapeEditorState;
  readonly cancelClean: () => void;
  readonly requestDirtyGuard: () => void;
} {
  const active = contributors.filter(
    (contributor) => !contributor.suspended?.()
  );
  let dirty: EscapeEditorContributor | undefined;
  let clean: EscapeEditorContributor | undefined;

  for (const contributor of active) {
    const state = contributor.getState();
    if (state === "dirty" && !dirty) dirty = contributor;
    if (state === "clean" && !clean) clean = contributor;
  }

  if (dirty) {
    return {
      state: "dirty",
      cancelClean: dirty.cancelClean,
      requestDirtyGuard: dirty.requestDirtyGuard
    };
  }
  if (clean) {
    return {
      state: "clean",
      cancelClean: clean.cancelClean,
      requestDirtyGuard: clean.requestDirtyGuard
    };
  }
  return {
    state: "none",
    cancelClean: () => undefined,
    requestDirtyGuard: () => undefined
  };
}

/** Close known workbench transient popovers via the DOM (tree menu, ribbon overflow). */
export function closeTransientPopoversInDocument(
  doc: Document = document
): boolean {
  let closed = false;

  const overflow = doc.querySelector("details.pb-ribbon-overflow[open]");
  if (overflow instanceof HTMLDetailsElement) {
    overflow.open = false;
    closed = true;
  }

  const treeMenu = doc.querySelector(".pb-tree-menu");
  if (treeMenu) {
    // DocumentTreeDock closes on capture-phase pointerdown outside the menu wrap.
    doc.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
    );
    closed = true;
  }

  const contextMore = doc.querySelector(".pb-context-strip__more");
  if (contextMore) {
    const toggle = doc.querySelector<HTMLButtonElement>(
      '.pb-context-strip__actions [aria-expanded="true"]'
    );
    toggle?.click();
    closed = true;
  }

  const navigationGuard = doc.querySelector(
    '[role="dialog"][aria-labelledby="curve-edit-navigation-title"]'
  );
  if (navigationGuard) {
    // Guard owns Escape via its own handler; report as present so callers can defer.
    closed = true;
  }

  return closed;
}

/** Selectors for the transient popovers that occupy Escape rung 1. */
export const TRANSIENT_POPOVER_SELECTORS = [
  "details.pb-ribbon-overflow[open]",
  ".pb-tree-menu",
  ".pb-context-strip__more",
  '[role="dialog"][aria-labelledby="curve-edit-navigation-title"]'
] as const;

/**
 * Structural subset of `Document` needed to detect a transient popover, so the
 * rung-1 predicate stays testable without a DOM environment.
 */
export interface TransientPopoverQuery {
  querySelector(selectors: string): unknown;
}

export function hasTransientPopoverInDocument(
  doc: TransientPopoverQuery = document
): boolean {
  return TRANSIENT_POPOVER_SELECTORS.some((selector) =>
    Boolean(doc.querySelector(selector))
  );
}
