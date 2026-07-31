import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CadOp,
  CadParameterSnapshot,
  SketchConstraintEntry,
  SketchCurveConstraintTarget,
  SketchDimensionEntryCurrent,
  SketchDimensionTargetV22,
  SketchEntitySnapshot,
  SketchPointTargetV22,
  SketchRadiusCurveTarget,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import {
  applySketchIntentSessionV19,
  closeSketchIntentSessionV19,
  constraintEntryToDraftV19,
  constraintDefinitionEntityIdsV19,
  constraintDefinitionSummaryV19,
  constraintKindLabelV19,
  createAvailableConstraintKindOptionsV19,
  createAvailableDimensionFamilyOptionsV19,
  createCurveTargetOptionsV19,
  createDefaultConstraintDraftV19,
  createDefaultDimensionDraftV19,
  createLineTargetOptionsV19,
  createMidpointTargetOptionsV19,
  createPointTargetOptionsV19,
  createRadiusTargetOptionsV19,
  curveTargetKeyV19,
  dimensionEntryToDraftV19,
  dimensionFamilyLabelV19,
  dimensionTargetEntityIdsV19,
  dimensionTargetSummaryV19,
  dimensionTargetToFamilyV19,
  entityLabelV19,
  focusSketchIntentEditorV19,
  getConstraintCreationAvailabilityV19,
  getDimensionCreationAvailabilityV19,
  measureDimensionTargetV19,
  pointTargetKeyV19,
  registerSketchIntentSessionV19,
  validateConstraintDraftV19,
  validateDimensionDraftV19,
  type SketchConstraintCreateKindV19,
  type SketchConstraintDefinitionV19,
  type SketchConstraintDraftV19,
  type SketchDimensionDraftV19,
  type SketchDimensionFamilyV19
} from "./sketchIntentEditorModel";
import type { SketchCurveEditSessionControl } from "./SketchCurveEditPanel";
import { useEscapeEditorContributor } from "../../actions/useEscapeEditorContributor";
import { NumericInput as NativeNumericInput } from "../../ui/NumericInput";
import {
  buildCreateConstraintOpsV19,
  buildCreateDimensionOpsV19,
  buildDeleteConstraintOpV19,
  buildDeleteDimensionOpV19,
  buildEditConstraintOpsV19,
  buildEditDimensionOpsV19
} from "./sketchIntentEditorOps";

export interface SketchIntentEditorProps {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly selectedEntityId?: string;
  readonly parameters: readonly CadParameterSnapshot[];
  readonly dimensions: readonly SketchDimensionEntryCurrent[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly units: string;
  readonly initialDimensionFamily?: SketchDimensionFamilyV19;
  readonly initialConstraintKind?: SketchConstraintCreateKindV19;
  readonly keyboardSuspended?: boolean;
  readonly onApplyOps: (ops: readonly CadOp[]) => boolean | Promise<boolean>;
  readonly onCancel?: (restoreFocus?: boolean) => void;
  readonly onRequestEscape?: (dirty: boolean) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly onSessionActiveChange?: (active: boolean) => void;
  readonly onSessionControlChange?: (
    control: SketchCurveEditSessionControl | undefined
  ) => void;
}

type DimensionSession =
  | { readonly mode: "create"; readonly draft: SketchDimensionDraftV19 }
  | {
      readonly mode: "edit";
      readonly dimension: SketchDimensionEntryCurrent;
      readonly draft: SketchDimensionDraftV19;
    };

type ConstraintSession =
  | { readonly mode: "create"; readonly draft: SketchConstraintDraftV19 }
  | {
      readonly mode: "edit";
      readonly constraint: SketchConstraintEntry;
      readonly draft: SketchConstraintDraftV19;
    };

export function SketchIntentEditor({
  disabled,
  sketch,
  selectedEntityId,
  parameters,
  dimensions,
  constraints,
  units,
  initialDimensionFamily,
  initialConstraintKind,
  keyboardSuspended = false,
  onApplyOps,
  onCancel,
  onRequestEscape,
  onDirtyChange,
  onSessionActiveChange,
  onSessionControlChange
}: SketchIntentEditorProps) {
  const [dimensionSession, setDimensionSession] = useState<
    DimensionSession | undefined
  >(() => {
    if (!initialDimensionFamily) return undefined;
    const draft = createDefaultDimensionDraftV19(
      sketch.entities,
      selectedEntityId,
      initialDimensionFamily,
      dimensions
    );
    return draft ? { mode: "create", draft } : undefined;
  });
  const [constraintSession, setConstraintSession] = useState<
    ConstraintSession | undefined
  >(() => {
    if (!initialConstraintKind || initialDimensionFamily) return undefined;
    const draft = createDefaultConstraintDraftV19(
      sketch.entities,
      selectedEntityId,
      initialConstraintKind,
      constraints
    );
    return draft ? { mode: "create", draft } : undefined;
  });
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [baseline, setBaseline] = useState(
    JSON.stringify(dimensionSession?.draft ?? constraintSession?.draft)
  );
  const applyRef = useRef<
    (options?: { readonly restoreFocusOnSuccess?: boolean }) => Promise<boolean>
  >(async () => false);
  const [applying, setApplying] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string>();
  const activeDraft = dimensionSession?.draft ?? constraintSession?.draft;
  const sessionActive = activeDraft !== undefined;
  const sessionValid = dimensionSession
    ? validateDimensionDraftV19(
        dimensionSession.draft,
        sketch.entities,
        parameters,
        dimensions,
        dimensionSession.mode === "edit"
          ? dimensionSession.dimension.id
          : undefined
      ).valid
    : constraintSession
      ? validateConstraintDraftV19(
          constraintSession.draft,
          sketch.entities,
          constraints,
          constraintSession.mode === "edit"
            ? constraintSession.constraint.id
            : undefined
        ).valid
      : false;
  const dirty =
    activeDraft !== undefined && JSON.stringify(activeDraft) !== baseline;
  const exactToolBlock = initialDimensionFamily
    ? getDimensionCreationAvailabilityV19(
        initialDimensionFamily,
        sketch.entities,
        selectedEntityId,
        dimensions
      )
    : initialConstraintKind
      ? getConstraintCreationAvailabilityV19(
          initialConstraintKind,
          sketch.entities,
          selectedEntityId,
          constraints
        )
      : undefined;
  const exactToolActive =
    exactToolBlock !== undefined && exactToolBlock.status !== "ready";

  const closeDraft = useCallback((restoreFocus = true) => {
    setDimensionSession(undefined);
    setConstraintSession(undefined);
    if (restoreFocus) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => restoreFocusRef.current?.focus())
      );
    }
  }, []);
  const finishSession = useCallback(
    (restoreFocus = true) =>
      closeSketchIntentSessionV19(
        () => closeDraft(restoreFocus),
        onCancel,
        restoreFocus
      ),
    [closeDraft, onCancel]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onSessionActiveChange?.(sessionActive || exactToolActive);
    return () => onSessionActiveChange?.(false);
  }, [exactToolActive, onSessionActiveChange, sessionActive]);

  useEffect(() => {
    return registerSketchIntentSessionV19(
      sessionActive,
      onSessionControlChange,
      {
        apply: (options) => applyRef.current(options),
        closeLocalDraft: () => closeDraft(false),
        getReturnFocusTarget: () => restoreFocusRef.current,
        canApply: sessionValid && !disabled && !applying,
        focus: () =>
          focusSketchIntentEditorV19(
            editorRef.current?.querySelector<HTMLElement>(
              "[data-drawer-initial-focus]"
            )
          )
      }
    );
  }, [
    applying,
    closeDraft,
    disabled,
    onSessionControlChange,
    sessionActive,
    sessionValid
  ]);

  useEscapeEditorContributor({
    id: "sketch-intent-editor",
    suspended: keyboardSuspended,
    state:
      dimensionSession || constraintSession
        ? dirty
          ? "dirty"
          : "clean"
        : "none",
    onCancelClean: () => finishSession(true),
    onRequestDirtyGuard: () =>
      onRequestEscape ? onRequestEscape(true) : closeDraft()
  });

  async function applyActive(
    options: { readonly restoreFocusOnSuccess?: boolean } = {}
  ): Promise<boolean> {
    if (disabled || applying) return false;
    let ops: readonly CadOp[] | undefined;
    if (dimensionSession) {
      const validation = validateDimensionDraftV19(
        dimensionSession.draft,
        sketch.entities,
        parameters,
        dimensions,
        dimensionSession.mode === "edit"
          ? dimensionSession.dimension.id
          : undefined
      );
      if (!validation.valid) return false;
      ops =
        dimensionSession.mode === "create"
          ? buildCreateDimensionOpsV19(sketch.id, dimensionSession.draft)
          : buildEditDimensionOpsV19(
              dimensionSession.dimension,
              dimensionSession.draft
            );
    } else if (constraintSession) {
      const validation = validateConstraintDraftV19(
        constraintSession.draft,
        sketch.entities,
        constraints,
        constraintSession.mode === "edit"
          ? constraintSession.constraint.id
          : undefined
      );
      if (!validation.valid) return false;
      ops =
        constraintSession.mode === "create"
          ? buildCreateConstraintOpsV19(sketch.id, constraintSession.draft)
          : buildEditConstraintOpsV19(
              constraintSession.constraint,
              constraintSession.draft,
              sketch.entities
            );
    }
    if (!ops) return false;
    setApplying(true);
    setRejectionMessage(undefined);
    try {
      const applied = await applySketchIntentSessionV19(ops, onApplyOps, () =>
        finishSession(options.restoreFocusOnSuccess ?? true)
      );
      if (!applied) {
        setRejectionMessage(
          "The model rejected this change. Review the targets and solver state, then try again."
        );
        return false;
      }
      return true;
    } finally {
      setApplying(false);
    }
  }
  useEffect(() => {
    applyRef.current = applyActive;
  });

  const selectedDimensions = selectedEntityId
    ? dimensions.filter((dimension) =>
        dimensionTargetEntityIdsV19(
          dimensionEntryToDraftV19(dimension).target
        ).includes(selectedEntityId)
      )
    : dimensions;
  const selectedConstraints = selectedEntityId
    ? constraints.filter((constraint) =>
        constraintDefinitionEntityIdsV19(
          constraintEntryToDraftV19(constraint, sketch.entities).definition
        ).includes(selectedEntityId)
      )
    : constraints;

  if (exactToolBlock && exactToolBlock.status !== "ready") {
    const label = initialDimensionFamily
      ? dimensionFamilyLabelV19(initialDimensionFamily)
      : constraintKindLabelV19(initialConstraintKind!);
    return (
      <div className="pb-sketch-stack" aria-label="Dimensions and constraints">
        <section
          className="pb-sketch-section"
          aria-label={`${label} unavailable`}
        >
          <h3>{label}</h3>
          <p className="pb-sketch-callout">{exactToolBlock.message}</p>
          <button
            type="button"
            className="pb-button"
            onClick={() => finishSession(true)}
          >
            Close {label}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      ref={editorRef}
      className="pb-sketch-stack"
      aria-label="Dimensions and constraints"
    >
      <section
        className="pb-sketch-section"
        aria-labelledby="v19-dimensions-heading"
      >
        <div className="pb-sketch-section__heading">
          <h3 id="v19-dimensions-heading">Dimensions</h3>
          <span>{selectedDimensions.length}</span>
        </div>
        <div className="pb-sketch-records">
          {selectedDimensions.map((dimension) => (
            <DimensionRecord
              key={dimension.id}
              dimension={dimension}
              entities={sketch.entities}
              parameters={parameters}
              units={units}
              disabled={disabled || sessionActive}
              onEdit={(opener) => {
                if (sessionActive) return;
                restoreFocusRef.current = opener;
                const session = {
                  mode: "edit",
                  dimension,
                  draft: dimensionEntryToDraftV19(dimension)
                } as const;
                setBaseline(JSON.stringify(session.draft));
                setDimensionSession(session);
              }}
              onDelete={() =>
                void onApplyOps([buildDeleteDimensionOpV19(dimension.id)])
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="pb-button"
          disabled={
            disabled ||
            sessionActive ||
            createAvailableDimensionFamilyOptionsV19(
              sketch.entities,
              dimensions
            ).length === 0
          }
          onClick={(event) => {
            if (sessionActive) return;
            const draft = createDefaultDimensionDraftV19(
              sketch.entities,
              selectedEntityId,
              undefined,
              dimensions
            );
            if (!draft) return;
            restoreFocusRef.current = event.currentTarget;
            setBaseline(JSON.stringify(draft));
            setDimensionSession({ mode: "create", draft });
          }}
        >
          Add dimension
        </button>
        {dimensionSession ? (
          <DimensionDraftEditor
            disabled={disabled}
            entities={sketch.entities}
            parameters={parameters}
            dimensions={dimensions}
            session={dimensionSession}
            units={units}
            onChange={setDimensionSession}
            applying={applying}
            rejectionMessage={rejectionMessage}
            onCancel={() => finishSession(true)}
            onApply={() => void applyRef.current()}
          />
        ) : null}
      </section>

      <section
        className="pb-sketch-section"
        aria-labelledby="v19-constraints-heading"
      >
        <div className="pb-sketch-section__heading">
          <h3 id="v19-constraints-heading">Constraints</h3>
          <span>{selectedConstraints.length}</span>
        </div>
        <div className="pb-sketch-records">
          {selectedConstraints.map((constraint) => (
            <ConstraintRecord
              key={constraint.id}
              constraint={constraint}
              entities={sketch.entities}
              disabled={disabled || sessionActive}
              onEdit={(opener) => {
                if (sessionActive) return;
                restoreFocusRef.current = opener;
                const session = {
                  mode: "edit",
                  constraint,
                  draft: constraintEntryToDraftV19(constraint, sketch.entities)
                } as const;
                setBaseline(JSON.stringify(session.draft));
                setConstraintSession(session);
              }}
              onDelete={() =>
                void onApplyOps([buildDeleteConstraintOpV19(constraint.id)])
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="pb-button"
          disabled={
            disabled ||
            sessionActive ||
            createAvailableConstraintKindOptionsV19(
              sketch.entities,
              constraints
            ).length === 0
          }
          onClick={(event) => {
            if (sessionActive) return;
            const draft = createDefaultConstraintDraftV19(
              sketch.entities,
              selectedEntityId,
              undefined,
              constraints
            );
            if (!draft) return;
            restoreFocusRef.current = event.currentTarget;
            setBaseline(JSON.stringify(draft));
            setConstraintSession({ mode: "create", draft });
          }}
        >
          Add constraint
        </button>
        {constraintSession ? (
          <ConstraintDraftEditor
            disabled={disabled}
            entities={sketch.entities}
            constraints={constraints}
            session={constraintSession}
            onChange={setConstraintSession}
            applying={applying}
            rejectionMessage={rejectionMessage}
            onCancel={() => finishSession(true)}
            onApply={() => void applyRef.current()}
          />
        ) : null}
      </section>
    </div>
  );
}

function DimensionRecord({
  dimension,
  entities,
  parameters,
  units,
  disabled,
  onEdit,
  onDelete
}: {
  readonly dimension: SketchDimensionEntryCurrent;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly units: string;
  readonly disabled: boolean;
  readonly onEdit: (opener: HTMLButtonElement) => void;
  readonly onDelete: () => void;
}) {
  const draft = dimensionEntryToDraftV19(dimension);
  const parameterId =
    dimension.valueSource.type === "parameter"
      ? dimension.valueSource.parameterId
      : undefined;
  const literalValue =
    dimension.valueSource.type === "literal"
      ? dimension.valueSource.value
      : undefined;
  const source =
    parameterId === undefined
      ? `${literalValue ?? "No value"}`
      : (parameters.find((parameter) => parameter.id === parameterId)?.name ??
        "Missing parameter");
  return (
    <article>
      <div>
        <strong>
          {dimension.name} ·{" "}
          {dimensionFamilyLabelV19(dimensionTargetToFamilyV19(draft.target))}
        </strong>
        <small>{dimensionTargetSummaryV19(draft.target, entities)}</small>
        <small>
          {source} · Evaluated{" "}
          {dimension.effectiveValue === undefined
            ? "unavailable"
            : `${dimension.effectiveValue} ${
                draft.target.kind === "lineAngle" ||
                (draft.target.kind === "entityScalar" &&
                  draft.target.role === "sweep")
                  ? "°"
                  : units
              }`}
        </small>
      </div>
      <IntentHealth
        status={dimension.status}
        issues={dimension.issues}
        healthyCopy="Solver healthy"
      />
      <div className="pb-sketch-record-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => onEdit(event.currentTarget)}
        >
          Edit
        </button>
        <button type="button" disabled={disabled} onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}

function ConstraintRecord({
  constraint,
  entities,
  disabled,
  onEdit,
  onDelete
}: {
  readonly constraint: SketchConstraintEntry;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly disabled: boolean;
  readonly onEdit: (opener: HTMLButtonElement) => void;
  readonly onDelete: () => void;
}) {
  return (
    <article>
      <div>
        <strong>
          {constraint.name} · {constraintKindLabelV19(constraint.kind)}
        </strong>
        <small>
          {constraintDefinitionSummaryV19(
            constraintEntryToDraftV19(constraint, entities).definition,
            entities
          )}
        </small>
      </div>
      <IntentHealth
        status={constraint.status}
        issues={constraint.issues}
        healthyCopy="Solver healthy"
      />
      <div className="pb-sketch-record-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => onEdit(event.currentTarget)}
        >
          Edit
        </button>
        <button type="button" disabled={disabled} onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}

function IntentHealth({
  status,
  issues,
  healthyCopy
}: {
  readonly status: string;
  readonly issues: readonly {
    readonly code: string;
    readonly message: string;
  }[];
  readonly healthyCopy: string;
}) {
  const issue = issues[0];
  return (
    <>
      <p>
        {status === "healthy"
          ? healthyCopy
          : intentIssueCopy(issue?.code, status)}
      </p>
      {issues.length > 0 ? (
        <details className="pb-sketch-diagnostics">
          <summary>Technical details</summary>
          <ul>
            {issues.map((item, index) => (
              <li key={`${item.code}:${index}`}>
                {item.code}: {item.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function intentIssueCopy(code: string | undefined, status: string): string {
  switch (code) {
    case "INCONSISTENT_CONSTRAINT":
    case "CONFLICTING_CONSTRAINT":
      return "This intent conflicts with another sketch relationship.";
    case "MISSING_PARAMETER":
      return "Choose an available parameter for this dimension.";
    case "SKETCH_DIMENSION_ANGLE_SENSE_INVALID":
      return "The measured angle crossed its selected direction branch.";
    case "MISSING_SKETCH_ENTITY":
    case "MISSING_SKETCH_DIMENSION_TARGET":
      return "One of this intent's geometry targets is no longer available.";
    default:
      return status === "healthy"
        ? "Solver healthy"
        : "The solver could not satisfy this sketch intent.";
  }
}

function DimensionDraftEditor({
  disabled,
  entities,
  parameters,
  dimensions,
  session,
  units,
  applying,
  rejectionMessage,
  onChange,
  onApply,
  onCancel
}: {
  readonly disabled: boolean;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly dimensions: readonly SketchDimensionEntryCurrent[];
  readonly session: DimensionSession;
  readonly units: string;
  readonly applying: boolean;
  readonly rejectionMessage?: string;
  readonly onChange: (session: DimensionSession) => void;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}) {
  const draft = session.draft;
  const validation = validateDimensionDraftV19(
    draft,
    entities,
    parameters,
    dimensions,
    session.mode === "edit" ? session.dimension.id : undefined
  );
  const update = (next: SketchDimensionDraftV19) =>
    onChange({ ...session, draft: next });
  const family = dimensionTargetToFamilyV19(draft.target);
  const unit =
    draft.target.kind === "lineAngle" ||
    (draft.target.kind === "entityScalar" && draft.target.role === "sweep")
      ? "degrees"
      : units;
  const currentValue = measureDimensionTargetV19(draft.target, entities);
  const messageId = `dimension-draft-${session.mode}-message`;
  const message = rejectionMessage ?? validation.message;
  return (
    <form
      className="pb-sketch-draft"
      aria-label={`${session.mode === "create" ? "Create" : "Edit"} dimension`}
      aria-describedby={messageId}
      onSubmit={(event) => {
        event.preventDefault();
        if (validation.valid && !disabled) onApply();
      }}
    >
      <TextInput
        label="Name"
        value={draft.name}
        disabled={disabled}
        initialFocus
        describedBy={messageId}
        invalid={!validation.valid}
        onChange={(name) => update({ ...draft, name })}
      />
      <label className="pb-sketch-field">
        <span>Measurement</span>
        <select
          className="pb-field"
          value={family}
          disabled={disabled}
          aria-describedby={messageId}
          aria-invalid={!validation.valid}
          onChange={(event) => {
            const nextFamily = event.currentTarget
              .value as SketchDimensionFamilyV19;
            const target = createDefaultDimensionDraftV19(
              entities,
              dimensionTargetEntityIdsV19(draft.target)[0],
              nextFamily,
              dimensions.filter(
                (dimension) =>
                  session.mode !== "edit" ||
                  dimension.id !== session.dimension.id
              )
            )?.target;
            if (!target) return;
            update({
              ...draft,
              name:
                session.mode === "create"
                  ? dimensionFamilyLabelV19(nextFamily)
                  : draft.name,
              target,
              valueSourceType:
                target.kind === "lineAngle" ? "literal" : draft.valueSourceType
            });
          }}
        >
          {createAvailableDimensionFamilyOptionsV19(
            entities,
            dimensions,
            session.mode === "edit" ? session.dimension.id : undefined
          ).map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <DimensionTargetFields
        target={draft.target}
        entities={entities}
        disabled={disabled}
        onChange={(target) =>
          update({
            ...draft,
            target,
            valueSourceType:
              target.kind === "lineAngle" ? "literal" : draft.valueSourceType
          })
        }
      />
      <label className="pb-sketch-field">
        <span>Value source</span>
        <select
          className="pb-field"
          value={draft.valueSourceType}
          disabled={disabled || draft.target.kind === "lineAngle"}
          aria-describedby={messageId}
          aria-invalid={!validation.valid}
          onChange={(event) =>
            update({
              ...draft,
              valueSourceType: event.currentTarget.value as
                | "literal"
                | "parameter",
              parameterId: draft.parameterId || parameters[0]?.id || ""
            })
          }
        >
          <option value="literal">Literal</option>
          {draft.target.kind !== "lineAngle" ? (
            <option value="parameter" disabled={parameters.length === 0}>
              Parameter
            </option>
          ) : null}
        </select>
      </label>
      {draft.valueSourceType === "literal" ? (
        <NumberInput
          label={`Value (${unit})`}
          value={draft.value}
          disabled={disabled}
          describedBy={messageId}
          invalid={!validation.valid}
          onChange={(value) => update({ ...draft, value })}
        />
      ) : (
        <label className="pb-sketch-field">
          <span>Parameter</span>
          <select
            className="pb-field"
            value={draft.parameterId}
            disabled={disabled || parameters.length === 0}
            aria-describedby={messageId}
            aria-invalid={!validation.valid}
            onChange={(event) =>
              update({ ...draft, parameterId: event.currentTarget.value })
            }
          >
            {parameters.map((parameter) => (
              <option key={parameter.id} value={parameter.id}>
                {parameter.name} = {parameter.value}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="pb-sketch-callout" role="status">
        Current geometry:{" "}
        {Number.isFinite(currentValue)
          ? `${currentValue} ${unit}`
          : "measurement unavailable"}{" "}
        ·{" "}
        {validation.valid
          ? "Local input checks passed"
          : "Local input needs attention"}
      </p>
      <DraftFooter
        id={messageId}
        disabled={disabled || applying || !validation.valid}
        message={message}
        onCancel={onCancel}
      />
    </form>
  );
}

function DimensionTargetFields({
  target,
  entities,
  disabled,
  onChange
}: {
  readonly target: SketchDimensionTargetV22;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly disabled: boolean;
  readonly onChange: (target: SketchDimensionTargetV22) => void;
}) {
  const pointOptions = createPointTargetOptionsV19(entities);
  const lineOptions = createLineTargetOptionsV19(entities);
  if (target.kind === "entityScalar") {
    const candidates = entities.filter((entity) => {
      if (target.entityKind === "rectangle") return entity.kind === "rectangle";
      if (target.entityKind === "line") return entity.kind === "line";
      if (target.role === "sweep") return entity.kind === "arc";
      return entity.kind === "circle" || entity.kind === "arc";
    });
    return (
      <EntitySelect
        label="Target"
        value={target.entityId}
        entities={candidates}
        disabled={disabled}
        onChange={(entity) =>
          onChange({
            ...target,
            entityId: entity.id,
            entityKind: entity.kind
          } as SketchDimensionTargetV22)
        }
      />
    );
  }
  if (target.kind === "pointPair") {
    return (
      <div className="pb-sketch-field-grid">
        <PointSelect
          label="First point"
          target={target.primary}
          options={pointOptions}
          disabled={disabled}
          onChange={(primary) => onChange({ ...target, primary })}
        />
        <PointSelect
          label="Second point"
          target={target.secondary}
          options={pointOptions}
          disabled={disabled}
          onChange={(secondary) => onChange({ ...target, secondary })}
        />
        {target.measurement !== "distance" ? (
          <label className="pb-sketch-field">
            <span>Direction</span>
            <select
              className="pb-field"
              value={target.direction}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...target,
                  direction: event.currentTarget.value as
                    | "positive"
                    | "negative"
                })
              }
            >
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </select>
          </label>
        ) : null}
      </div>
    );
  }
  if (target.kind === "pointLineDistance") {
    return (
      <div className="pb-sketch-field-grid">
        <PointSelect
          label="Point"
          target={target.point}
          options={pointOptions}
          disabled={disabled}
          onChange={(point) => onChange({ ...target, point })}
        />
        <StringSelect
          label="Line"
          value={target.lineEntityId}
          options={lineOptions}
          disabled={disabled}
          onChange={(lineEntityId) => onChange({ ...target, lineEntityId })}
        />
        <label className="pb-sketch-field">
          <span>Side</span>
          <select
            className="pb-field"
            value={target.side}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...target,
                side: event.currentTarget.value as "left" | "right"
              })
            }
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>
    );
  }
  return (
    <div className="pb-sketch-field-grid">
      <StringSelect
        label="First line"
        value={target.primaryLineEntityId}
        options={lineOptions}
        disabled={disabled}
        onChange={(primaryLineEntityId) =>
          onChange({ ...target, primaryLineEntityId })
        }
      />
      <StringSelect
        label="Second line"
        value={target.secondaryLineEntityId}
        options={lineOptions}
        disabled={disabled}
        onChange={(secondaryLineEntityId) =>
          onChange({ ...target, secondaryLineEntityId })
        }
      />
      <label className="pb-sketch-field">
        <span>Angle sense</span>
        <select
          className="pb-field"
          value={target.sense}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...target,
              sense: event.currentTarget.value as
                | "clockwise"
                | "counterclockwise"
            })
          }
        >
          <option value="counterclockwise">Counterclockwise</option>
          <option value="clockwise">Clockwise</option>
        </select>
      </label>
    </div>
  );
}

function ConstraintDraftEditor({
  disabled,
  entities,
  constraints,
  session,
  applying,
  rejectionMessage,
  onChange,
  onApply,
  onCancel
}: {
  readonly disabled: boolean;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly session: ConstraintSession;
  readonly applying: boolean;
  readonly rejectionMessage?: string;
  readonly onChange: (session: ConstraintSession) => void;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}) {
  const validation = validateConstraintDraftV19(
    session.draft,
    entities,
    constraints,
    session.mode === "edit" ? session.constraint.id : undefined
  );
  const messageId = `constraint-draft-${session.mode}-message`;
  const update = (draft: SketchConstraintDraftV19) =>
    onChange({ ...session, draft });
  return (
    <form
      className="pb-sketch-draft"
      aria-label={`${session.mode === "create" ? "Create" : "Edit"} constraint`}
      aria-describedby={messageId}
      onSubmit={(event) => {
        event.preventDefault();
        if (validation.valid && !disabled) onApply();
      }}
    >
      <TextInput
        label="Name"
        value={session.draft.name}
        disabled={disabled}
        initialFocus
        describedBy={messageId}
        invalid={!validation.valid}
        onChange={(name) => update({ ...session.draft, name })}
      />
      {session.mode === "create" ? (
        <label className="pb-sketch-field">
          <span>Constraint</span>
          <select
            className="pb-field"
            value={session.draft.definition.kind}
            disabled={disabled}
            aria-describedby={messageId}
            aria-invalid={!validation.valid}
            onChange={(event) => {
              const kind = event.currentTarget
                .value as SketchConstraintCreateKindV19;
              const definition = createDefaultConstraintDraftV19(
                entities,
                undefined,
                kind,
                constraints
              )?.definition;
              if (definition)
                update({
                  ...session.draft,
                  name: constraintKindLabelV19(kind),
                  definition
                });
            }}
          >
            {createAvailableConstraintKindOptionsV19(entities, constraints).map(
              (item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              )
            )}
          </select>
        </label>
      ) : session.draft.definition.kind === "angle" ? (
        <p className="pb-sketch-callout">
          Existing angle constraint · update only. Create new angular intent
          with a Line angle dimension.
        </p>
      ) : (
        <p className="pb-sketch-callout">
          {constraintKindLabelV19(session.draft.definition.kind)} · kind cannot
          change during structural update.
        </p>
      )}
      <ConstraintDefinitionFields
        definition={session.draft.definition}
        entities={entities}
        disabled={disabled}
        onChange={(definition) => update({ ...session.draft, definition })}
      />
      <DraftFooter
        id={messageId}
        disabled={disabled || applying || !validation.valid}
        message={rejectionMessage ?? validation.message}
        onCancel={onCancel}
      />
    </form>
  );
}

function ConstraintDefinitionFields({
  definition,
  entities,
  disabled,
  onChange
}: {
  readonly definition: SketchConstraintDefinitionV19;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly disabled: boolean;
  readonly onChange: (definition: SketchConstraintDefinitionV19) => void;
}) {
  const lines = createLineTargetOptionsV19(entities);
  const points = createPointTargetOptionsV19(entities);
  const midpointPoints = createMidpointTargetOptionsV19(entities);
  const curves = createCurveTargetOptionsV19(entities);
  const radiusCurves = createRadiusTargetOptionsV19(entities);
  switch (definition.kind) {
    case "horizontal":
    case "vertical":
      return (
        <StringSelect
          label="Line"
          value={definition.entityId}
          options={lines}
          disabled={disabled}
          onChange={(entityId) => onChange({ ...definition, entityId })}
        />
      );
    case "fixed":
      return (
        <div className="pb-sketch-field-grid">
          <PointSelect
            label="Point"
            target={definition.target}
            options={points}
            disabled={disabled}
            onChange={(target) => onChange({ ...definition, target })}
          />
          <NumberInput
            label="X"
            value={definition.coordinate[0]}
            disabled={disabled}
            onChange={(x) =>
              onChange({
                ...definition,
                coordinate: [x, definition.coordinate[1]]
              })
            }
          />
          <NumberInput
            label="Y"
            value={definition.coordinate[1]}
            disabled={disabled}
            onChange={(y) =>
              onChange({
                ...definition,
                coordinate: [definition.coordinate[0], y]
              })
            }
          />
        </div>
      );
    case "coincident":
      return (
        <PointPairFields
          primary={definition.primaryTarget}
          secondary={definition.secondaryTarget}
          options={points}
          disabled={disabled}
          onPrimary={(primaryTarget) =>
            onChange({ ...definition, primaryTarget })
          }
          onSecondary={(secondaryTarget) =>
            onChange({ ...definition, secondaryTarget })
          }
        />
      );
    case "midpoint":
      return (
        <div className="pb-sketch-field-grid">
          <StringSelect
            label="Line"
            value={definition.lineEntityId}
            options={lines}
            disabled={disabled}
            onChange={(lineEntityId) =>
              onChange({ ...definition, lineEntityId })
            }
          />
          <PointSelect
            label="Point at midpoint"
            target={definition.target}
            options={midpointPoints}
            disabled={disabled}
            onChange={(target) =>
              onChange({
                ...definition,
                target: target as typeof definition.target
              })
            }
          />
        </div>
      );
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle":
      return (
        <div className="pb-sketch-field-grid">
          <StringSelect
            label="First line"
            value={definition.primaryLineEntityId}
            options={lines}
            disabled={disabled}
            onChange={(primaryLineEntityId) =>
              onChange({ ...definition, primaryLineEntityId })
            }
          />
          <StringSelect
            label="Second line"
            value={definition.secondaryLineEntityId}
            options={lines}
            disabled={disabled}
            onChange={(secondaryLineEntityId) =>
              onChange({ ...definition, secondaryLineEntityId })
            }
          />
          {definition.kind === "angle" ? (
            <NumberInput
              label="Angle (degrees)"
              value={definition.angleDegrees}
              disabled={disabled}
              onChange={(angleDegrees) =>
                onChange({ ...definition, angleDegrees })
              }
            />
          ) : null}
        </div>
      );
    case "tangent":
      return (
        <CurvePairFields
          primary={definition.primaryTarget}
          secondary={definition.secondaryTarget}
          options={curves}
          disabled={disabled}
          onPrimary={(primaryTarget) =>
            onChange({
              ...definition,
              primaryTarget,
              secondaryTarget: definition.secondaryTarget
            } as typeof definition)
          }
          onSecondary={(secondaryTarget) =>
            onChange({
              ...definition,
              primaryTarget: definition.primaryTarget,
              secondaryTarget
            } as typeof definition)
          }
        />
      );
    case "concentric":
    case "equalRadius":
      return (
        <RadiusPairFields
          primary={definition.primaryTarget}
          secondary={definition.secondaryTarget}
          options={radiusCurves}
          disabled={disabled}
          onPrimary={(primaryTarget) =>
            onChange({ ...definition, primaryTarget })
          }
          onSecondary={(secondaryTarget) =>
            onChange({ ...definition, secondaryTarget })
          }
        />
      );
    case "symmetry":
      return (
        <div className="pb-sketch-field-grid">
          <PointPairFields
            primary={definition.primaryTarget}
            secondary={definition.secondaryTarget}
            options={points}
            disabled={disabled}
            onPrimary={(primaryTarget) =>
              onChange({ ...definition, primaryTarget })
            }
            onSecondary={(secondaryTarget) =>
              onChange({ ...definition, secondaryTarget })
            }
          />
          <StringSelect
            label="Symmetry line"
            value={definition.symmetryLineEntityId}
            options={lines}
            disabled={disabled}
            onChange={(symmetryLineEntityId) =>
              onChange({ ...definition, symmetryLineEntityId })
            }
          />
        </div>
      );
  }
}

function PointPairFields({
  primary,
  secondary,
  options,
  disabled,
  onPrimary,
  onSecondary
}: {
  readonly primary: SketchPointTargetV22;
  readonly secondary: SketchPointTargetV22;
  readonly options: ReturnType<typeof createPointTargetOptionsV19>;
  readonly disabled: boolean;
  readonly onPrimary: (target: SketchPointTargetV22) => void;
  readonly onSecondary: (target: SketchPointTargetV22) => void;
}) {
  return (
    <>
      <PointSelect
        label="First point"
        target={primary}
        options={options}
        disabled={disabled}
        onChange={onPrimary}
      />
      <PointSelect
        label="Second point"
        target={secondary}
        options={options}
        disabled={disabled}
        onChange={onSecondary}
      />
    </>
  );
}

function CurvePairFields({
  primary,
  secondary,
  options,
  disabled,
  onPrimary,
  onSecondary
}: {
  readonly primary: SketchCurveConstraintTarget;
  readonly secondary: SketchCurveConstraintTarget;
  readonly options: ReturnType<typeof createCurveTargetOptionsV19>;
  readonly disabled: boolean;
  readonly onPrimary: (target: SketchCurveConstraintTarget) => void;
  readonly onSecondary: (target: SketchCurveConstraintTarget) => void;
}) {
  return (
    <>
      <CurveSelect
        label="First curve"
        target={primary}
        options={options}
        disabled={disabled}
        onChange={onPrimary}
      />
      <CurveSelect
        label="Second curve"
        target={secondary}
        options={options}
        disabled={disabled}
        onChange={onSecondary}
      />
    </>
  );
}

function RadiusPairFields({
  primary,
  secondary,
  options,
  disabled,
  onPrimary,
  onSecondary
}: {
  readonly primary: SketchRadiusCurveTarget;
  readonly secondary: SketchRadiusCurveTarget;
  readonly options: ReturnType<typeof createRadiusTargetOptionsV19>;
  readonly disabled: boolean;
  readonly onPrimary: (target: SketchRadiusCurveTarget) => void;
  readonly onSecondary: (target: SketchRadiusCurveTarget) => void;
}) {
  return (
    <>
      <RadiusSelect
        label="First curve"
        target={primary}
        options={options}
        disabled={disabled}
        onChange={onPrimary}
      />
      <RadiusSelect
        label="Second curve"
        target={secondary}
        options={options}
        disabled={disabled}
        onChange={onSecondary}
      />
    </>
  );
}

function PointSelect({
  label,
  target,
  options,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly target: SketchPointTargetV22;
  readonly options: ReturnType<typeof createPointTargetOptionsV19>;
  readonly disabled: boolean;
  readonly onChange: (target: SketchPointTargetV22) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <select
        className="pb-field"
        value={pointTargetKeyV19(target)}
        disabled={disabled || options.length === 0}
        onChange={(event) => {
          const selected = options.find(
            ({ value }) =>
              pointTargetKeyV19(value) === event.currentTarget.value
          );
          if (selected) onChange(selected.value);
        }}
      >
        {options.map((item) => (
          <option
            key={pointTargetKeyV19(item.value)}
            value={pointTargetKeyV19(item.value)}
          >
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CurveSelect({
  label,
  target,
  options,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly target: SketchCurveConstraintTarget;
  readonly options: ReturnType<typeof createCurveTargetOptionsV19>;
  readonly disabled: boolean;
  readonly onChange: (target: SketchCurveConstraintTarget) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <select
        className="pb-field"
        value={curveTargetKeyV19(target)}
        disabled={disabled || options.length === 0}
        onChange={(event) => {
          const selected = options.find(
            ({ value }) =>
              curveTargetKeyV19(value) === event.currentTarget.value
          );
          if (selected) onChange(selected.value);
        }}
      >
        {options.map((item) => (
          <option
            key={curveTargetKeyV19(item.value)}
            value={curveTargetKeyV19(item.value)}
          >
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RadiusSelect({
  label,
  target,
  options,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly target: SketchRadiusCurveTarget;
  readonly options: ReturnType<typeof createRadiusTargetOptionsV19>;
  readonly disabled: boolean;
  readonly onChange: (target: SketchRadiusCurveTarget) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <select
        className="pb-field"
        value={curveTargetKeyV19(target)}
        disabled={disabled || options.length === 0}
        onChange={(event) => {
          const selected = options.find(
            ({ value }) =>
              curveTargetKeyV19(value) === event.currentTarget.value
          );
          if (selected) onChange(selected.value);
        }}
      >
        {options.map((item) => (
          <option
            key={curveTargetKeyV19(item.value)}
            value={curveTargetKeyV19(item.value)}
          >
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StringSelect({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <select
        className="pb-field"
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EntitySelect({
  label,
  value,
  entities,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly value: string;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly disabled: boolean;
  readonly onChange: (entity: SketchEntitySnapshot) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <select
        className="pb-field"
        value={value}
        disabled={disabled || entities.length === 0}
        onChange={(event) => {
          const entity = entities.find(
            (candidate) => candidate.id === event.currentTarget.value
          );
          if (entity) onChange(entity);
        }}
      >
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entityLabelV19(entity, entities)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  disabled,
  initialFocus,
  describedBy,
  invalid,
  onChange
}: {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly initialFocus?: boolean;
  readonly describedBy?: string;
  readonly invalid?: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <input
        className="pb-field"
        type="text"
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoFocus={initialFocus}
        data-drawer-initial-focus={initialFocus || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  disabled,
  describedBy,
  invalid,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly disabled: boolean;
  readonly describedBy?: string;
  readonly invalid?: boolean;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <NativeNumericInput
        className="pb-field pb-numeric"
        step="0.1"
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onValueChange={onChange}
      />
    </label>
  );
}

function DraftFooter({
  id,
  disabled,
  message,
  onCancel
}: {
  readonly id: string;
  readonly disabled: boolean;
  readonly message: string;
  readonly onCancel: () => void;
}) {
  return (
    <>
      <p
        id={id}
        className={disabled ? "pb-field-error" : "pb-sketch-callout"}
        role={disabled ? "alert" : "status"}
      >
        {message}
      </p>
      <div className="pb-sketch-actions">
        <button
          type="submit"
          className="pb-button pb-button--primary"
          disabled={disabled}
        >
          Apply
        </button>
        <button type="button" className="pb-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  );
}
