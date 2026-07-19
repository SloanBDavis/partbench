import { clampDockWidth, WORKBENCH_LAYOUT } from "../styles/tokens";
import type {
  ActiveEditorIdentity,
  ProjectPageId,
  SelectionFilter,
  WorkbenchMode,
  WorkbenchNavigationIntent,
  WorkbenchUiState
} from "../workbench/types";

export type DirtyNavigationResolution = "discard" | "applied" | "stay";

export type WorkbenchUiAction =
  | {
      readonly type: "request-navigation";
      readonly intent: WorkbenchNavigationIntent;
    }
  | {
      readonly type: "resolve-navigation";
      readonly resolution: DirtyNavigationResolution;
    }
  | { readonly type: "navigation-apply-failed" }
  | {
      readonly type: "set-editor";
      readonly editor?: ActiveEditorIdentity;
    }
  | { readonly type: "set-editor-dirty"; readonly dirty: boolean }
  | { readonly type: "set-active-tool"; readonly actionId?: string }
  | { readonly type: "set-selection-filter"; readonly filter: SelectionFilter }
  | { readonly type: "set-project-page"; readonly page: ProjectPageId }
  | {
      readonly type: "set-command-search-open";
      readonly open: boolean;
    }
  | {
      readonly type: "set-dock-collapsed";
      readonly side: "left" | "right";
      readonly collapsed: boolean;
    }
  | {
      readonly type: "set-dock-width";
      readonly side: "left" | "right";
      readonly width: number;
    }
  | {
      readonly type: "restore-dock-preferences";
      readonly leftDockCollapsed: boolean;
      readonly rightDockCollapsed: boolean;
      readonly leftDockWidth: number;
      readonly rightDockWidth: number;
    };

export const DEFAULT_WORKBENCH_UI_STATE: WorkbenchUiState = {
  mode: "solid",
  activeEditorDirty: false,
  selectionFilter: "body",
  leftDockCollapsed: false,
  rightDockCollapsed: false,
  leftDockWidth: WORKBENCH_LAYOUT.leftDock.default,
  rightDockWidth: WORKBENCH_LAYOUT.rightDock.default,
  commandSearchOpen: false
};

export function createInitialWorkbenchUiState(
  overrides: Partial<WorkbenchUiState> = {}
): WorkbenchUiState {
  const state = { ...DEFAULT_WORKBENCH_UI_STATE, ...overrides };

  return {
    ...state,
    leftDockWidth: clampDockWidth("left", state.leftDockWidth),
    rightDockWidth: clampDockWidth("right", state.rightDockWidth),
    activeEditorDirty: state.activeEditor ? state.activeEditorDirty : false,
    navigationIntent: state.activeEditorDirty
      ? state.navigationIntent
      : undefined
  };
}

export function workbenchReducer(
  state: WorkbenchUiState,
  action: WorkbenchUiAction
): WorkbenchUiState {
  switch (action.type) {
    case "request-navigation":
      if (!navigationChangesWorkbench(state, action.intent)) {
        return state;
      }
      if (shouldPromptForDirtyNavigation(state, action.intent)) {
        return state.navigationIntent
          ? state
          : { ...state, navigationIntent: action.intent };
      }
      return applyNavigationIntent(state, action.intent);
    case "resolve-navigation": {
      if (!state.navigationIntent) {
        return state;
      }
      if (action.resolution === "stay") {
        return { ...state, navigationIntent: undefined };
      }
      const cleanState = {
        ...state,
        activeEditorDirty: false,
        navigationIntent: undefined
      };
      return applyNavigationIntent(cleanState, state.navigationIntent);
    }
    case "navigation-apply-failed":
      return state.navigationIntent
        ? { ...state, navigationIntent: undefined }
        : state;
    case "set-editor":
      return {
        ...state,
        activeEditor: action.editor,
        activeEditorDirty: false,
        navigationIntent: undefined
      };
    case "set-editor-dirty":
      if (!state.activeEditor || state.activeEditorDirty === action.dirty) {
        return state;
      }
      return {
        ...state,
        activeEditorDirty: action.dirty,
        navigationIntent: action.dirty ? state.navigationIntent : undefined
      };
    case "set-active-tool":
      return { ...state, activeTool: action.actionId };
    case "set-selection-filter":
      return { ...state, selectionFilter: action.filter };
    case "set-project-page":
      return { ...state, projectPage: action.page };
    case "set-command-search-open":
      return { ...state, commandSearchOpen: action.open };
    case "set-dock-collapsed":
      return action.side === "left"
        ? { ...state, leftDockCollapsed: action.collapsed }
        : { ...state, rightDockCollapsed: action.collapsed };
    case "set-dock-width":
      return action.side === "left"
        ? { ...state, leftDockWidth: clampDockWidth("left", action.width) }
        : { ...state, rightDockWidth: clampDockWidth("right", action.width) };
    case "restore-dock-preferences":
      return {
        ...state,
        leftDockCollapsed: action.leftDockCollapsed,
        rightDockCollapsed: action.rightDockCollapsed,
        leftDockWidth: clampDockWidth("left", action.leftDockWidth),
        rightDockWidth: clampDockWidth("right", action.rightDockWidth)
      };
  }
}

export function shouldPromptForDirtyNavigation(
  state: WorkbenchUiState,
  intent: WorkbenchNavigationIntent
): boolean {
  return Boolean(
    state.activeEditor &&
    state.activeEditorDirty &&
    navigationChangesWorkbench(state, intent) &&
    navigationCanStaleDraft(intent)
  );
}

export function navigationCanStaleDraft(
  intent: WorkbenchNavigationIntent
): boolean {
  return !(
    intent.kind === "command-search-action" && intent.closesEditor === false
  );
}

export function getDirtyNavigationPrompt(intent: WorkbenchNavigationIntent): {
  readonly title: string;
  readonly message: string;
  readonly applyLabel: "Apply";
  readonly discardLabel: "Discard";
  readonly stayLabel: "Stay";
} {
  return {
    title: "Apply changes before leaving?",
    message: `This draft has unapplied changes. Apply or discard them before ${describeNavigationIntent(intent)}.`,
    applyLabel: "Apply",
    discardLabel: "Discard",
    stayLabel: "Stay"
  };
}

export function describeNavigationIntent(
  intent: WorkbenchNavigationIntent
): string {
  switch (intent.kind) {
    case "mode":
      return `switching to ${formatMode(intent.mode)} mode`;
    case "project-page":
      return `opening ${formatProjectPage(intent.page)}`;
    case "editor":
      return "opening another feature";
    case "close-editor":
      return "closing the editor";
    case "document-action":
      return intent.action === "new"
        ? "creating a new document"
        : intent.action === "open"
          ? "opening another document"
          : intent.action === "undo"
            ? "undoing the last change"
            : "redoing the next change";
    case "command-search-action":
      return "running the selected command";
  }
}

function navigationChangesWorkbench(
  state: WorkbenchUiState,
  intent: WorkbenchNavigationIntent
): boolean {
  switch (intent.kind) {
    case "mode":
      return intent.mode !== state.mode;
    case "project-page":
      return intent.page !== state.projectPage || state.mode !== "project";
    case "editor":
      return (
        (intent.mode !== undefined && intent.mode !== state.mode) ||
        !sameEditor(state.activeEditor, intent.editor)
      );
    case "close-editor":
      return state.activeEditor !== undefined;
    case "document-action":
      return true;
    case "command-search-action":
      return intent.mode !== state.mode || intent.actionId !== state.activeTool;
  }
}

function applyNavigationIntent(
  state: WorkbenchUiState,
  intent: WorkbenchNavigationIntent
): WorkbenchUiState {
  const base = { ...state, navigationIntent: undefined };
  switch (intent.kind) {
    case "mode":
      return {
        ...base,
        mode: intent.mode,
        activeTool: undefined,
        activeEditor: undefined,
        activeEditorDirty: false,
        projectPage:
          intent.mode === "project"
            ? (state.projectPage ?? "overview")
            : state.projectPage,
        commandSearchOpen: false
      };
    case "project-page":
      return {
        ...base,
        mode: "project",
        projectPage: intent.page,
        activeTool: undefined,
        activeEditor: undefined,
        activeEditorDirty: false,
        commandSearchOpen: false
      };
    case "editor":
      return {
        ...base,
        mode: intent.mode ?? state.mode,
        activeTool: intent.originatingActionId,
        activeEditor: intent.editor,
        activeEditorDirty: false,
        commandSearchOpen: false
      };
    case "close-editor":
      return {
        ...base,
        activeTool: undefined,
        activeEditor: undefined,
        activeEditorDirty: false
      };
    case "document-action":
      return {
        ...base,
        activeTool: undefined,
        activeEditor: undefined,
        activeEditorDirty: false,
        commandSearchOpen: false
      };
    case "command-search-action":
      return {
        ...base,
        mode: intent.mode,
        activeTool: intent.actionId,
        activeEditor:
          intent.closesEditor === false ? state.activeEditor : undefined,
        activeEditorDirty:
          intent.closesEditor === false ? state.activeEditorDirty : false,
        projectPage:
          intent.mode === "project"
            ? (state.projectPage ?? "overview")
            : state.projectPage,
        commandSearchOpen: false
      };
  }
}

function sameEditor(
  current: ActiveEditorIdentity | undefined,
  next: ActiveEditorIdentity
): boolean {
  return current?.kind === next.kind && current.sourceId === next.sourceId;
}

function formatMode(mode: WorkbenchMode): string {
  return mode[0].toUpperCase() + mode.slice(1);
}

function formatProjectPage(page: ProjectPageId): string {
  return page[0].toUpperCase() + page.slice(1);
}
