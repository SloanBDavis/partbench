export type WorkbenchMode = "project" | "solid" | "sketch" | "inspect";

export type SelectionFilter = "body" | "face" | "edge";

export type ProjectPageId =
  | "overview"
  | "files"
  | "parameters"
  | "history"
  | "agent"
  | "export";

export type FeatureEditorKind =
  | "primitive"
  | "transform"
  | "sketch-create"
  | "sketch-edit"
  | "sketch-curve-edit"
  | "extrude"
  | "revolve"
  | "sweep"
  | "loft"
  | "hole"
  | "fillet"
  | "chamfer"
  | "shell"
  | "linear-pattern"
  | "circular-pattern"
  | "mirror"
  | "named-reference"
  | "named-reference-repair";

export interface ActiveEditorIdentity {
  readonly kind: FeatureEditorKind;
  readonly sourceId?: string;
}

export type WorkbenchNavigationIntent =
  | {
      readonly kind: "mode";
      readonly mode: WorkbenchMode;
    }
  | {
      readonly kind: "project-page";
      readonly page: ProjectPageId;
    }
  | {
      readonly kind: "editor";
      readonly editor: ActiveEditorIdentity;
      readonly mode?: WorkbenchMode;
      readonly originatingActionId?: string;
    }
  | { readonly kind: "close-editor" }
  | {
      readonly kind: "document-action";
      readonly action: "new" | "open" | "undo" | "redo";
    }
  | {
      readonly kind: "command-search-action";
      readonly actionId: string;
      readonly mode: WorkbenchMode;
      readonly closesEditor?: boolean;
    }
  | {
      readonly kind: "sketch-selection";
      readonly sketchId: string;
      readonly entityId?: string;
    };

export interface WorkbenchUiState {
  readonly mode: WorkbenchMode;
  readonly activeTool?: string;
  readonly activeEditor?: ActiveEditorIdentity;
  readonly activeEditorDirty: boolean;
  readonly navigationIntent?: WorkbenchNavigationIntent;
  readonly projectPage?: ProjectPageId;
  readonly selectionFilter: SelectionFilter;
  readonly leftDockCollapsed: boolean;
  readonly rightDockCollapsed: boolean;
  readonly leftDockWidth: number;
  readonly rightDockWidth: number;
  readonly commandSearchOpen: boolean;
}
