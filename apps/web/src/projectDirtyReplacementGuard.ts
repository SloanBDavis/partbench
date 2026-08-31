export type ProjectReplacementKind =
  | "new"
  | "open-wcad"
  | "import-json"
  | "restore";

export type ProjectReplacementResolution = "save" | "discard" | "cancel";

export type ProjectReplacementPhase =
  | { readonly kind: "none" }
  | {
      readonly kind: "editor-draft";
      readonly replacement: ProjectReplacementKind;
    }
  | {
      readonly kind: "project-dirty";
      readonly replacement: ProjectReplacementKind;
    }
  | {
      readonly kind: "recovery-discard-confirm";
    };

export interface ProjectReplacementGuardPrompt {
  readonly title: string;
  readonly message: string;
  readonly saveLabel: "Save";
  readonly discardLabel: "Discard";
  readonly cancelLabel: "Cancel";
}

export function shouldPromptProjectDirtyGuard(
  projectDirty: boolean,
  editorDirty: boolean
): "editor-draft" | "project-dirty" | "proceed" {
  if (editorDirty) {
    return "editor-draft";
  }
  if (projectDirty) {
    return "project-dirty";
  }
  return "proceed";
}

export function getProjectReplacementGuardPrompt(
  replacement: ProjectReplacementKind
): ProjectReplacementGuardPrompt {
  return {
    title: "Unsaved project changes",
    message: `This project has unsaved committed changes. Save, discard them, or cancel before ${describeReplacement(replacement)}.`,
    saveLabel: "Save",
    discardLabel: "Discard",
    cancelLabel: "Cancel"
  };
}

export function getRecoveryDiscardConfirmPrompt(): {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: "Discard recovery data";
  readonly cancelLabel: "Cancel";
} {
  return {
    title: "Discard recovered project?",
    message:
      "This removes the stored crash-recovery snapshot from this browser. The current document is not changed.",
    confirmLabel: "Discard recovery data",
    cancelLabel: "Cancel"
  };
}

export function describeReplacement(
  replacement: ProjectReplacementKind
): string {
  switch (replacement) {
    case "new":
      return "creating a new project";
    case "open-wcad":
      return "opening another project";
    case "import-json":
      return "importing JSON";
    case "restore":
      return "restoring the recovered project";
  }
}

export function documentActionForReplacement(
  replacement: ProjectReplacementKind
): "new" | "open" | "import-json" | "restore" {
  switch (replacement) {
    case "new":
      return "new";
    case "open-wcad":
      return "open";
    case "import-json":
      return "import-json";
    case "restore":
      return "restore";
  }
}

export function replacementFromDocumentAction(
  action: "new" | "open" | "import-json" | "restore" | "undo" | "redo"
): ProjectReplacementKind | undefined {
  switch (action) {
    case "new":
      return "new";
    case "open":
      return "open-wcad";
    case "import-json":
      return "import-json";
    case "restore":
      return "restore";
    default:
      return undefined;
  }
}

/**
 * Registers the browser unload warning only while the project is dirty.
 * The handler is synchronous and never starts a recovery write.
 */
export function bindDirtyProjectUnloadGuard(
  target:
    | Pick<Window, "addEventListener" | "removeEventListener">
    | undefined,
  dirty: boolean
): () => void {
  if (!target || !dirty) {
    return () => undefined;
  }
  const onBeforeUnload = (event: Event) => {
    event.preventDefault();
    if ("returnValue" in event) {
      (event as BeforeUnloadEvent).returnValue = "";
    }
  };
  target.addEventListener("beforeunload", onBeforeUnload);
  return () => {
    target.removeEventListener("beforeunload", onBeforeUnload);
  };
}
