export type FeatureEditorPhase =
  | "collecting"
  | "editing"
  | "validating"
  | "ready"
  | "blocked"
  | "applying"
  | "success"
  | "error";

export interface FeatureEditorIssue {
  readonly message: string;
  readonly fieldId?: string;
}

export type FeatureEditorValidation =
  | {
      readonly status: "collecting";
      readonly message: string;
      readonly issues?: readonly FeatureEditorIssue[];
    }
  | {
      readonly status: "blocked";
      readonly message: string;
      readonly issues?: readonly FeatureEditorIssue[];
    }
  | {
      readonly status: "ready";
      readonly message?: string;
      readonly issues?: readonly FeatureEditorIssue[];
    };

export interface FeatureEditorState<Draft> {
  /** The last source-backed value. It changes only after a successful apply. */
  readonly committed: Draft;
  /** UI-local values submitted only by an explicit Apply transition. */
  readonly draft: Draft;
  readonly dirty: boolean;
  readonly phase: FeatureEditorPhase;
  readonly committedValidation: FeatureEditorValidation;
  readonly validation: FeatureEditorValidation;
  readonly applyError?: string;
}

export type FeatureEditorAction<Draft> =
  | {
      readonly type: "draft-changed";
      readonly draft: Draft;
      readonly dirty: boolean;
      readonly validation: FeatureEditorValidation;
    }
  | { readonly type: "validation-started" }
  | {
      readonly type: "validation-finished";
      readonly validation: FeatureEditorValidation;
    }
  | { readonly type: "apply-started" }
  | { readonly type: "apply-succeeded" }
  | { readonly type: "apply-failed"; readonly message: string }
  | {
      readonly type: "source-replaced";
      readonly committed: Draft;
      readonly validation: FeatureEditorValidation;
    }
  | { readonly type: "cancelled" };

export interface FeatureEditorDraftPolicy<Draft> {
  readonly validate: (draft: Draft) => FeatureEditorValidation;
  readonly isEqual: (left: Draft, right: Draft) => boolean;
}

export function featureEditorPhaseFromValidation(
  validation: FeatureEditorValidation,
  dirty: boolean
): FeatureEditorPhase {
  if (validation.status === "collecting") {
    return "collecting";
  }
  if (validation.status === "blocked") {
    return "blocked";
  }
  return dirty ? "ready" : "editing";
}

export function createFeatureEditorState<Draft>(
  committed: Draft,
  validation: FeatureEditorValidation
): FeatureEditorState<Draft> {
  return {
    committed,
    draft: committed,
    dirty: false,
    phase: featureEditorPhaseFromValidation(validation, false),
    committedValidation: validation,
    validation
  };
}

export function createDraftChangedAction<Draft>(
  state: FeatureEditorState<Draft>,
  draft: Draft,
  policy: FeatureEditorDraftPolicy<Draft>
): FeatureEditorAction<Draft> {
  return {
    type: "draft-changed",
    draft,
    dirty: !policy.isEqual(state.committed, draft),
    validation: policy.validate(draft)
  };
}

export function canApplyFeatureEditor<Draft>(
  state: FeatureEditorState<Draft>
): boolean {
  return (
    state.dirty &&
    state.validation.status === "ready" &&
    state.phase !== "applying"
  );
}

export function featureEditorReducer<Draft>(
  state: FeatureEditorState<Draft>,
  action: FeatureEditorAction<Draft>
): FeatureEditorState<Draft> {
  switch (action.type) {
    case "draft-changed":
      if (state.phase === "applying") {
        return state;
      }
      return {
        ...state,
        draft: action.draft,
        dirty: action.dirty,
        phase: featureEditorPhaseFromValidation(
          action.validation,
          action.dirty
        ),
        validation: action.validation,
        applyError: undefined
      };
    case "validation-started":
      return state.phase === "applying"
        ? state
        : { ...state, phase: "validating", applyError: undefined };
    case "validation-finished":
      return state.phase === "applying"
        ? state
        : {
            ...state,
            phase: featureEditorPhaseFromValidation(
              action.validation,
              state.dirty
            ),
            validation: action.validation,
            applyError: undefined
          };
    case "apply-started":
      return canApplyFeatureEditor(state)
        ? { ...state, phase: "applying", applyError: undefined }
        : state;
    case "apply-succeeded":
      if (state.phase !== "applying") {
        return state;
      }
      return {
        ...state,
        committed: state.draft,
        dirty: false,
        phase: "success",
        committedValidation: state.validation,
        applyError: undefined
      };
    case "apply-failed":
      if (state.phase !== "applying") {
        return state;
      }
      return {
        ...state,
        phase: "error",
        applyError: action.message
      };
    case "source-replaced":
      return {
        committed: action.committed,
        draft: action.committed,
        dirty: false,
        phase: featureEditorPhaseFromValidation(action.validation, false),
        committedValidation: action.validation,
        validation: action.validation
      };
    case "cancelled":
      return {
        ...state,
        draft: state.committed,
        dirty: false,
        phase: featureEditorPhaseFromValidation(
          state.committedValidation,
          false
        ),
        validation: state.committedValidation,
        applyError: undefined
      };
  }
}
