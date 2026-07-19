export interface SelectionCollectorTarget<Value> {
  /** Exact source/query-returned value. Presentation never reconstructs it. */
  readonly value: Value;
  readonly label: string;
  readonly kind: string;
}

export interface SelectionCollectorState<Value> {
  readonly targets: readonly SelectionCollectorTarget<Value>[];
  readonly collecting: boolean;
  readonly rejectedReason?: string;
}

export type SelectionCollectorAction<Value> =
  | { readonly type: "collection-started" }
  | { readonly type: "collection-stopped" }
  | {
      readonly type: "target-added";
      readonly target: SelectionCollectorTarget<Value>;
    }
  | { readonly type: "target-rejected"; readonly reason: string }
  | { readonly type: "target-removed"; readonly targetKey: string }
  | { readonly type: "cleared" };

export function createSelectionCollectorState<Value>(
  targets: readonly SelectionCollectorTarget<Value>[] = []
): SelectionCollectorState<Value> {
  return { targets, collecting: false };
}

export function selectionCollectorReducer<Value>(
  state: SelectionCollectorState<Value>,
  action: SelectionCollectorAction<Value>,
  getTargetKey: (value: Value) => string
): SelectionCollectorState<Value> {
  switch (action.type) {
    case "collection-started":
      return { ...state, collecting: true, rejectedReason: undefined };
    case "collection-stopped":
      return { ...state, collecting: false, rejectedReason: undefined };
    case "target-added":
      if (
        state.targets.some(
          (target) =>
            getTargetKey(target.value) === getTargetKey(action.target.value)
        )
      ) {
        return {
          ...state,
          rejectedReason: `${action.target.label} is already selected.`
        };
      }
      return {
        ...state,
        targets: [...state.targets, action.target],
        rejectedReason: undefined
      };
    case "target-rejected":
      return { ...state, rejectedReason: action.reason };
    case "target-removed":
      return {
        ...state,
        targets: state.targets.filter(
          (target) => getTargetKey(target.value) !== action.targetKey
        ),
        rejectedReason: undefined
      };
    case "cleared":
      return { ...state, targets: [], rejectedReason: undefined };
  }
}

export function addSelectionCollectorTarget<Value>(
  state: SelectionCollectorState<Value>,
  target: SelectionCollectorTarget<Value>,
  getTargetKey: (value: Value) => string
): SelectionCollectorState<Value> {
  return selectionCollectorReducer(
    state,
    {
      type: "target-added",
      target
    },
    getTargetKey
  );
}
