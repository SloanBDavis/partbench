import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadReferenceHealthEntry,
  CurrentSketchConstraintKind,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse,
  SketchDimensionTarget,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchPointTargetRole,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { useState } from "react";
import type {
  FeatureEdgeFinishForm,
  FeatureExtrudeForm,
  FeatureHoleForm,
  FeatureRevolveForm,
  SketchConstraintForm,
  SketchCreateForm,
  SketchCreateOnFaceForm,
  SketchDimensionForm,
  SketchEntityForm
} from "../cadCommands";
import {
  SELECTED_EDGE_FINISH_REFERENCE_VALUE,
  buildEdgeFinishForm,
  createEdgeFinishReferenceOptions,
  selectEdgeFinishReferenceOption
} from "../edgeFinishUi";
import {
  buildSketchOnFaceForm,
  createSketchOnFaceDefaultName,
  formatGeneratedReferenceKind,
  formatGeneratedReferenceOperationLabels,
  formatSketchOnFaceAvailability,
  getSketchAttachableFaces
} from "../generatedReferenceUi";
import {
  createSelectedGeneratedReference,
  createSelectionReferenceCandidateSummaries,
  formatSelectionReferenceIssue,
  formatSelectionReferenceOperationLabel,
  formatSelectionReferenceStatus
} from "../generatedReferenceSelection";
import {
  createNamedReferenceRepairUiState,
  formatNamedReferenceRepairHealthStatus
} from "../namedReferenceRepairUi";
import { getExtrudeTargetFields } from "../modelingPanelExtrudeTargets";
import type {
  ModelingActionDescriptor,
  ModelingSelectionContext
} from "../modelingActions";
import {
  entityToSketchEntityForm,
  formatSketchEntity,
  getDefaultSketchEntityFormForSketch,
  getSketchEntityFormLabels,
  sketchEntityFormToEntity,
  validateSketchEntityForm
} from "../sketchEntityForms";
import {
  createAvailableCoincidentPointTargetOptions,
  createAvailableFixedPointTargetOptions,
  createAvailableMidpointTargetOptions,
  createAvailableParallelLineTargetOptions,
  createRevolveAxisOptions,
  createSketchPointTargetOptionsForEntity,
  formatSketchConstraintStatus,
  formatSketchDimensionStatus,
  formatSketchProfileValidity,
  formatSketchSolverDiagnostic,
  formatSketchSolverStatus,
  getAddOperationStatus,
  getCutOperationStatus,
  getHoleTargetGuidance,
  getHoleOperationStatus,
  getExtrudeSideForOperationMode,
  getRevolveOperationStatus,
  getSketchConstraintKindLabel,
  getSketchDimensionTargetLabel,
  getSketchSolverStatusDisplay,
  type BooleanTargetBodyOption
} from "../sketchPanelUi";

export interface ModelingActionsPanelProps {
  readonly actions: readonly ModelingActionDescriptor[];
  readonly addTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly context: ModelingSelectionContext;
  readonly cutTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly disabled?: boolean;
  readonly holeTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly namedReferences?: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly selectedNamedReferenceName?: string;
  readonly sketches?: readonly SketchSnapshot[];
  readonly onAddEntity?: (
    sketchId: string,
    kind: SketchEntityKind,
    form: SketchEntityForm
  ) => void;
  readonly onCreateConstraint?: (
    sketchId: string,
    entityId: string,
    form: SketchConstraintForm
  ) => void;
  readonly onCreateDimension?: (
    sketchId: string,
    entityId: string,
    target: SketchDimensionTarget,
    form: SketchDimensionForm
  ) => void;
  readonly onCreateEdgeFinish?: (
    operation: "chamfer" | "fillet",
    form: FeatureEdgeFinishForm
  ) => void;
  readonly onCreateSideHoleSketch?: (
    form: SketchCreateForm,
    targetBodyId: string
  ) => void;
  readonly onCreateSketch?: (form: SketchCreateForm) => void;
  readonly onCreateSketchOnFace?: (form: SketchCreateOnFaceForm) => void;
  readonly onExtrudeEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureExtrudeForm
  ) => void;
  readonly onHoleEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureHoleForm
  ) => void;
  readonly onNameGeneratedReference?: (
    name: string,
    target: ReturnType<typeof createSelectedGeneratedReference>
  ) => void;
  readonly onRepairNamedReference?: (
    name: string,
    target: ReturnType<typeof createSelectedGeneratedReference>
  ) => void;
  readonly onSelectBody?: (bodyId: string) => void;
  readonly onDeleteFeature?: (featureId: string) => void;
  readonly onDeleteEntity?: (sketchId: string, entityId: string) => void;
  readonly onRevolveEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureRevolveForm
  ) => void;
  readonly onDeleteSketch?: (sketchId: string) => void;
  readonly onRenameSketch?: (sketchId: string, name: string) => void;
  readonly onSelectSketch?: (sketchId: string, entityId?: string) => void;
  readonly onUpdateEntity?: (
    sketchId: string,
    entity: SketchEntitySnapshot
  ) => void;
}

interface ModelingSelectionSummary {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail?: string;
}

const defaultCreateSketchForm: SketchCreateForm = {
  id: "",
  name: "Sketch 1",
  plane: "XY"
};

const defaultDimensionForm: SketchDimensionForm = {
  id: "",
  name: "",
  valueSourceType: "literal",
  value: 1,
  parameterId: ""
};

const defaultConstraintForm: SketchConstraintForm = {
  id: "",
  name: "",
  kind: "horizontal",
  targetRole: "start",
  coordinateMode: "current",
  coordinateX: 0,
  coordinateY: 0,
  secondaryEntityId: "",
  secondaryTargetRole: "position"
};

const defaultExtrudeForm: FeatureExtrudeForm = {
  id: "",
  bodyId: "",
  name: "",
  depth: 1,
  side: "positive",
  operationMode: "newBody"
};

const defaultRevolveForm: FeatureRevolveForm = {
  id: "",
  bodyId: "",
  name: "",
  axisEntityId: "",
  angleDegrees: 360
};

const defaultHoleForm: FeatureHoleForm = {
  id: "",
  bodyId: "",
  targetBodyId: "",
  name: "",
  depthMode: "throughAll",
  depth: 1,
  direction: "positive"
};

const defaultEdgeFinishForm = {
  id: "",
  bodyId: "",
  name: "",
  distance: 0.2,
  radius: 0.2
};

export function ModelingActionsPanel({
  actions,
  addTargetBodies = [],
  context,
  cutTargetBodies = [],
  disabled = false,
  holeTargetBodies = [],
  namedReferences = [],
  namedReferenceHealthByName,
  selectedNamedReferenceName,
  sketches = [],
  onAddEntity,
  onCreateConstraint,
  onCreateDimension,
  onCreateEdgeFinish,
  onCreateSideHoleSketch,
  onCreateSketch,
  onCreateSketchOnFace,
  onExtrudeEntity,
  onHoleEntity,
  onNameGeneratedReference,
  onRepairNamedReference,
  onSelectBody,
  onDeleteFeature,
  onDeleteEntity,
  onDeleteSketch,
  onRenameSketch,
  onRevolveEntity,
  onSelectSketch,
  onUpdateEntity
}: ModelingActionsPanelProps) {
  const summary = formatModelingSelectionSummary(context, sketches.length);
  const [quickSketchForm, setQuickSketchForm] = useState(
    defaultCreateSketchForm
  );
  const activeSketch = getActiveSketchFromContext(context);
  const nextSketchName = createNextSketchName(sketches);
  const nextSketchId = createNextSketchId(sketches);
  const quickSketchSubmitForm: SketchCreateForm = {
    ...quickSketchForm,
    id: quickSketchForm.id || nextSketchId,
    name: nextSketchName
  };

  return (
    <section className="modeling-actions-panel" aria-label="Modeling context">
      <div className="modeling-actions-heading">
        <div>
          <h2>Context</h2>
          <small>{summary.eyebrow}</small>
        </div>
      </div>

      <div className="modeling-selection-summary">
        <strong>{summary.title}</strong>
        {summary.detail && <small>{summary.detail}</small>}
      </div>

      {(context.selectionKind === "sketch" ||
        context.selectionKind === "sketchEntity") && (
        <SketchSolverStatusCard context={context} />
      )}

      <SelectionReferenceContractCard context={context} />

      {onCreateSketch && (
        <div className="quick-sketch-create" aria-label="Create sketch">
          <div className="quick-sketch-planes" aria-label="Sketch plane">
            {(["XY", "XZ", "YZ"] as const).map((plane) => (
              <button
                key={plane}
                type="button"
                className={
                  quickSketchForm.plane === plane ? "selected" : undefined
                }
                disabled={disabled}
                onClick={() =>
                  setQuickSketchForm({ ...quickSketchForm, plane })
                }
              >
                {plane}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="quick-sketch-create-button"
            title={`Create ${nextSketchName}`}
            disabled={disabled}
            onClick={() => onCreateSketch(quickSketchSubmitForm)}
          >
            + Sketch
          </button>
        </div>
      )}

      {activeSketch && (onRenameSketch || onDeleteSketch) && (
        <ActiveSketchControls
          key={activeSketch.id}
          disabled={disabled}
          sketch={activeSketch}
          onDeleteSketch={onDeleteSketch}
          onRenameSketch={onRenameSketch}
        />
      )}

      {context.selectionKind === "none" && (
        <NoSelectionWorkbench
          disabled={disabled}
          sketches={sketches}
          onDeleteSketch={onDeleteSketch}
          onSelectSketch={onSelectSketch}
        />
      )}

      {context.selectionKind === "sketch" && (
        <SketchWorkbench
          disabled={disabled}
          sketch={context.sketch}
          sketches={sketches}
          onAddEntity={onAddEntity}
          onSelectSketch={onSelectSketch}
        />
      )}

      {context.selectionKind === "sketchEntity" && (
        <SketchEntityWorkbench
          key={`${context.sketch.id}:${context.entity.id}`}
          actions={actions}
          addTargetBodies={addTargetBodies}
          context={context}
          cutTargetBodies={cutTargetBodies}
          disabled={disabled}
          holeTargetBodies={holeTargetBodies}
          onCreateConstraint={onCreateConstraint}
          onCreateDimension={onCreateDimension}
          onDeleteEntity={onDeleteEntity}
          onExtrudeEntity={onExtrudeEntity}
          onHoleEntity={onHoleEntity}
          onRevolveEntity={onRevolveEntity}
          onUpdateEntity={onUpdateEntity}
        />
      )}

      {context.selectionKind === "body" && (
        <BodyWorkbench
          key={context.body.id}
          actions={actions}
          disabled={disabled}
          context={context}
          sketches={sketches}
          onCreateSketchOnFace={onCreateSketchOnFace}
          onDeleteFeature={onDeleteFeature}
          onSelectSketch={onSelectSketch}
        />
      )}

      {context.selectionKind === "generatedReference" && (
        <GeneratedReferenceWorkbench
          key={context.reference.stableId}
          actions={actions}
          context={context}
          disabled={disabled}
          namedReferences={namedReferences}
          namedReferenceHealthByName={namedReferenceHealthByName}
          selectedNamedReferenceName={selectedNamedReferenceName}
          onCreateEdgeFinish={onCreateEdgeFinish}
          onCreateSideHoleSketch={onCreateSideHoleSketch}
          onCreateSketchOnFace={onCreateSketchOnFace}
          onNameGeneratedReference={onNameGeneratedReference}
          onRepairNamedReference={onRepairNamedReference}
          onSelectBody={onSelectBody}
          onSelectSketch={onSelectSketch}
        />
      )}
    </section>
  );
}

function createNextSketchName(sketches: readonly SketchSnapshot[]): string {
  const usedNames = new Set(sketches.map((sketch) => sketch.name.trim()));
  let next = sketches.length + 1;

  while (usedNames.has(`Sketch ${next}`)) {
    next += 1;
  }

  return `Sketch ${next}`;
}

function createNextSketchId(sketches: readonly SketchSnapshot[]): string {
  const usedIds = new Set(sketches.map((sketch) => sketch.id.trim()));
  let next = sketches.length + 1;

  while (usedIds.has(`sketch_${next}`)) {
    next += 1;
  }

  return `sketch_${next}`;
}

function getActiveSketchFromContext(
  context: ModelingSelectionContext
): SketchSnapshot | undefined {
  if (context.selectionKind === "sketch") {
    return context.sketch;
  }

  if (context.selectionKind === "sketchEntity") {
    return context.sketch;
  }

  return undefined;
}

function SketchSolverStatusCard({
  context
}: {
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketch" | "sketchEntity" }
  >;
}) {
  const solverStatus = context.solverStatus;
  const display = getSketchSolverStatusDisplay(solverStatus);
  const primaryDiagnostic = solverStatus?.diagnostics.find(
    (diagnostic) => diagnostic.severity !== "info"
  );

  return (
    <section className="workbench-card compact sketch-status-card">
      <div className="workbench-card-heading">
        <h3>Sketch status</h3>
        <small
          className={`health-text health-${display.tone}`}
          title={display.detail}
        >
          {display.label}
        </small>
      </div>
      <dl className="compact-definition-list">
        <div>
          <dt>Dimensions</dt>
          <dd>{solverStatus?.dimensionCount ?? 0}</dd>
        </div>
        <div>
          <dt>Constraints</dt>
          <dd>{solverStatus?.constraintCount ?? 0}</dd>
        </div>
        <div>
          <dt>Profiles</dt>
          <dd>
            {solverStatus ? formatSketchProfileValidity(solverStatus) : "0/0"}
          </dd>
        </div>
      </dl>
      <p
        className={
          display.tone === "error"
            ? "error-text compact"
            : "project-message compact"
        }
      >
        {formatSketchSolverStatus(solverStatus)}
      </p>
      {primaryDiagnostic && (
        <p className="project-message compact">
          {formatSketchSolverDiagnostic(primaryDiagnostic)}
        </p>
      )}
    </section>
  );
}

function SelectionReferenceContractCard({
  context
}: {
  readonly context: ModelingSelectionContext;
}) {
  const response = getSelectionReferenceCandidatesFromContext(context);

  if (!response) {
    return null;
  }

  const summaries = createSelectionReferenceCandidateSummaries(response);
  const primary = summaries[0];
  const operations =
    primary?.commandOperations.map(formatSelectionReferenceOperationLabel) ??
    [];
  const issues =
    primary && primary.issues.length > 0
      ? primary.issues
      : response.issues.map(formatSelectionReferenceIssue);

  return (
    <section className="workbench-card compact reference-contract-card">
      <div className="workbench-card-heading">
        <h3>Reference status</h3>
        <small>{formatSelectionReferenceStatus(response.status)}</small>
      </div>
      {primary && (
        <small>
          {primary.title} /{" "}
          {operations.length > 0 ? operations.join(", ") : "No commands"}
        </small>
      )}
      {primary?.topologyDetail && <small>{primary.topologyDetail}</small>}
      {issues.length > 0 && <p className="error-text compact">{issues[0]}</p>}
    </section>
  );
}

function getSelectionReferenceCandidatesFromContext(
  context: ModelingSelectionContext
): SelectionReferenceCandidatesQueryResponse | undefined {
  if (
    context.selectionKind === "body" ||
    context.selectionKind === "generatedReference"
  ) {
    return context.selectionReferenceCandidates;
  }

  return undefined;
}

function ActiveSketchControls({
  disabled,
  sketch,
  onDeleteSketch,
  onRenameSketch
}: {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly onDeleteSketch?: (sketchId: string) => void;
  readonly onRenameSketch?: (sketchId: string, name: string) => void;
}) {
  const [name, setName] = useState(sketch.name);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const canRename = name.trim().length > 0 && name.trim() !== sketch.name;

  return (
    <section className="active-sketch-controls" aria-label="Active sketch">
      <label>
        <span>Active sketch</span>
        <input
          type="text"
          value={name}
          disabled={disabled || !onRenameSketch}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        disabled={disabled || !canRename || !onRenameSketch}
        onClick={() => {
          onRenameSketch?.(sketch.id, name);
          setDeleteArmed(false);
        }}
      >
        Rename
      </button>
      <button
        type="button"
        className={deleteArmed ? "danger armed" : "danger"}
        disabled={disabled || !onDeleteSketch}
        onClick={() => {
          if (!deleteArmed) {
            setDeleteArmed(true);
            return;
          }

          onDeleteSketch?.(sketch.id);
        }}
      >
        {deleteArmed ? "Confirm" : "Delete"}
      </button>
    </section>
  );
}

function NoSelectionWorkbench({
  disabled,
  sketches,
  onDeleteSketch,
  onSelectSketch
}: {
  readonly disabled: boolean;
  readonly sketches: readonly SketchSnapshot[];
  readonly onDeleteSketch?: (sketchId: string) => void;
  readonly onSelectSketch?: (sketchId: string, entityId?: string) => void;
}) {
  const [deleteArmedSketchId, setDeleteArmedSketchId] = useState<
    string | undefined
  >();

  if (sketches.length === 0) {
    return null;
  }

  return (
    <div className="workbench-surface">
      <section className="workbench-card">
        <div className="workbench-card-heading">
          <h3>Open sketch</h3>
          <small>{sketches.length}</small>
        </div>
        <ul className="workbench-compact-list">
          {sketches.map((sketch) => (
            <li key={sketch.id}>
              <div className="workbench-list-row">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectSketch?.(sketch.id)}
                >
                  <strong>{sketch.name}</strong>
                  <small>
                    {sketch.plane} / {sketch.entities.length} entities
                  </small>
                </button>
                <button
                  type="button"
                  className={
                    deleteArmedSketchId === sketch.id
                      ? "danger armed"
                      : "danger"
                  }
                  disabled={disabled || !onDeleteSketch}
                  onClick={() => {
                    if (deleteArmedSketchId !== sketch.id) {
                      setDeleteArmedSketchId(sketch.id);
                      return;
                    }

                    onDeleteSketch?.(sketch.id);
                  }}
                >
                  {deleteArmedSketchId === sketch.id ? "Confirm" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SketchWorkbench({
  disabled,
  sketch,
  sketches,
  onAddEntity,
  onSelectSketch
}: {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly sketches: readonly SketchSnapshot[];
  readonly onAddEntity?: (
    sketchId: string,
    kind: SketchEntityKind,
    form: SketchEntityForm
  ) => void;
  readonly onSelectSketch?: (sketchId: string, entityId?: string) => void;
}) {
  return (
    <div className="workbench-surface">
      <section className="workbench-card primary">
        <div className="workbench-card-heading">
          <h3>Sketch tools</h3>
          <small>{sketch.entities.length} existing</small>
        </div>
        <div className="workbench-command-grid">
          {(["point", "line", "rectangle", "circle"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              onClick={() =>
                onAddEntity?.(
                  sketch.id,
                  kind,
                  getDefaultSketchEntityFormForSketch(sketch, kind, sketches)
                )
              }
            >
              {formatSketchEntityKind(kind)}
            </button>
          ))}
        </div>
      </section>

      {sketch.entities.length > 0 && (
        <section className="workbench-card">
          <div className="workbench-card-heading">
            <h3>Entities</h3>
            <small>Select to edit or feature</small>
          </div>
          <ul className="workbench-compact-list">
            {sketch.entities.map((entity) => (
              <li key={entity.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectSketch?.(sketch.id, entity.id)}
                >
                  <strong>{formatSketchEntityKind(entity.kind)}</strong>
                  <small>{formatSketchEntity(entity)}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SketchEntityWorkbench({
  actions,
  addTargetBodies,
  context,
  cutTargetBodies,
  disabled,
  holeTargetBodies,
  onCreateConstraint,
  onCreateDimension,
  onDeleteEntity,
  onExtrudeEntity,
  onHoleEntity,
  onRevolveEntity,
  onUpdateEntity
}: {
  readonly actions: readonly ModelingActionDescriptor[];
  readonly addTargetBodies: readonly BooleanTargetBodyOption[];
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly cutTargetBodies: readonly BooleanTargetBodyOption[];
  readonly disabled: boolean;
  readonly holeTargetBodies: readonly BooleanTargetBodyOption[];
  readonly onCreateConstraint?: (
    sketchId: string,
    entityId: string,
    form: SketchConstraintForm
  ) => void;
  readonly onCreateDimension?: (
    sketchId: string,
    entityId: string,
    target: SketchDimensionTarget,
    form: SketchDimensionForm
  ) => void;
  readonly onDeleteEntity?: (sketchId: string, entityId: string) => void;
  readonly onExtrudeEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureExtrudeForm
  ) => void;
  readonly onHoleEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureHoleForm
  ) => void;
  readonly onRevolveEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureRevolveForm
  ) => void;
  readonly onUpdateEntity?: (
    sketchId: string,
    entity: SketchEntitySnapshot
  ) => void;
}) {
  const dimensionAction = actions.find(
    (action) => action.id === "sketch.dimension.add"
  );
  const constraintAction = actions.find(
    (action) => action.id === "sketch.constraint.add"
  );
  const extrudeAction = actions.find(
    (action) => action.id === "feature.extrude"
  );
  const revolveAction = actions.find(
    (action) => action.id === "feature.revolve"
  );
  const holeAction = actions.find((action) => action.id === "feature.hole");
  const axisAction = actions.find(
    (action) => action.id === "sketch.revolveAxis.use"
  );
  const effectiveHoleTargetBodies =
    holeTargetBodies.length > 0
      ? holeTargetBodies
      : (holeAction?.target?.holeTargets ?? []);

  return (
    <div className="workbench-surface">
      {context.entity.kind === "line" && (
        <AxisCandidateCard action={axisAction} context={context} />
      )}
      <FeatureCreateCard
        addTargetBodies={addTargetBodies}
        cutTargetBodies={cutTargetBodies}
        disabled={disabled}
        extrudeAction={extrudeAction}
        holeAction={holeAction}
        holeTargetBodies={effectiveHoleTargetBodies}
        revolveAction={revolveAction}
        context={context}
        onExtrudeEntity={onExtrudeEntity}
        onHoleEntity={onHoleEntity}
        onRevolveEntity={onRevolveEntity}
      />
      <SelectedEntityActions
        context={context}
        disabled={disabled}
        onDeleteEntity={onDeleteEntity}
      />
      <EntityEditCard
        context={context}
        disabled={disabled}
        onUpdateEntity={onUpdateEntity}
      />
      <DimensionCreateCard
        action={dimensionAction}
        context={context}
        disabled={disabled}
        onCreateDimension={onCreateDimension}
      />
      <ConstraintCreateCard
        action={constraintAction}
        context={context}
        disabled={disabled}
        onCreateConstraint={onCreateConstraint}
      />
    </div>
  );
}

function SelectedEntityActions({
  context,
  disabled,
  onDeleteEntity
}: {
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly disabled: boolean;
  readonly onDeleteEntity?: (sketchId: string, entityId: string) => void;
}) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const role = formatSketchEntityRole(context.entity.kind);

  return (
    <section className="workbench-card compact selected-entity-actions">
      <div className="workbench-card-heading">
        <h3>Selected {role}</h3>
        <small>{formatSketchEntity(context.entity)}</small>
      </div>
      <button
        type="button"
        className={deleteArmed ? "danger armed" : "danger"}
        disabled={disabled || !onDeleteEntity}
        onClick={() => {
          if (!deleteArmed) {
            setDeleteArmed(true);
            return;
          }

          onDeleteEntity?.(context.sketch.id, context.entity.id);
        }}
      >
        {deleteArmed ? "Confirm delete" : `Delete ${role}`}
      </button>
    </section>
  );
}

function AxisCandidateCard({
  action,
  context
}: {
  readonly action?: ModelingActionDescriptor;
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
}) {
  return (
    <section className="workbench-card compact">
      <div className="workbench-card-heading">
        <h3>Axis candidate</h3>
        <small>{formatSketchEntity(context.entity)}</small>
      </div>
      <small>
        {action?.available
          ? "Use this line as a revolve axis by selecting a rectangle or circle profile."
          : (action?.reason ?? "Line axes need non-zero length.")}
      </small>
    </section>
  );
}

function EntityEditCard({
  context,
  disabled,
  onUpdateEntity
}: {
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly disabled: boolean;
  readonly onUpdateEntity?: (
    sketchId: string,
    entity: SketchEntitySnapshot
  ) => void;
}) {
  const [form, setForm] = useState(() =>
    entityToSketchEntityForm(context.entity)
  );
  const validation = validateSketchEntityForm(context.entity.kind, form);
  const labels = getSketchEntityFormLabels(context.entity.kind);
  const nextEntity = sketchEntityFormToEntity(
    context.entity.id,
    context.entity.kind,
    form
  );

  return (
    <details className="workbench-card collapsible">
      <summary>
        <span>Edit {formatSketchEntityKind(context.entity.kind)}</span>
        <small>Shape values</small>
      </summary>
      <div className="field-grid two">
        <NumberInput
          disabled={disabled}
          label={labels.x}
          value={form.x}
          onChange={(x) => setForm({ ...form, x })}
        />
        <NumberInput
          disabled={disabled}
          label={labels.y}
          value={form.y}
          onChange={(y) => setForm({ ...form, y })}
        />
        {labels.x2 && (
          <NumberInput
            disabled={disabled}
            label={labels.x2}
            value={form.x2}
            onChange={(x2) => setForm({ ...form, x2 })}
          />
        )}
        {labels.y2 && (
          <NumberInput
            disabled={disabled}
            label={labels.y2}
            value={form.y2}
            onChange={(y2) => setForm({ ...form, y2 })}
          />
        )}
        {labels.width && (
          <NumberInput
            disabled={disabled}
            label={labels.width}
            value={form.width}
            onChange={(width) => setForm({ ...form, width })}
          />
        )}
        {labels.height && (
          <NumberInput
            disabled={disabled}
            label={labels.height}
            value={form.height}
            onChange={(height) => setForm({ ...form, height })}
          />
        )}
        {labels.radius && (
          <NumberInput
            disabled={disabled}
            label={labels.radius}
            value={form.radius}
            onChange={(radius) => setForm({ ...form, radius })}
          />
        )}
      </div>
      {!validation.ok && (
        <p className="error-text compact">{validation.message}</p>
      )}
      <button
        type="button"
        disabled={disabled || !validation.ok}
        onClick={() => {
          onUpdateEntity?.(context.sketch.id, nextEntity);
        }}
      >
        Apply entity
      </button>
    </details>
  );
}

function DimensionCreateCard({
  action,
  context,
  disabled,
  onCreateDimension
}: {
  readonly action?: ModelingActionDescriptor;
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly disabled: boolean;
  readonly onCreateDimension?: (
    sketchId: string,
    entityId: string,
    target: SketchDimensionTarget,
    form: SketchDimensionForm
  ) => void;
}) {
  const targets = action?.target?.dimensionTargets ?? [];
  const [targetIndex, setTargetIndex] = useState(0);
  const selectedTarget = targets[targetIndex] ?? targets[0];
  const [form, setForm] = useState<SketchDimensionForm>(() => ({
    ...defaultDimensionForm,
    value: targets[0]?.currentValue ?? 1,
    name: targets[0] ? targets[0].label : ""
  }));
  const effectiveForm = selectedTarget
    ? {
        ...form,
        name: form.name.trim() || selectedTarget.label
      }
    : form;

  return (
    <details className="workbench-card collapsible">
      <summary>
        <span>Driving dimensions</span>
        <small>{targets.length}</small>
      </summary>
      {targets.length === 0 ? (
        <p className="empty-state compact">
          {action?.reason ?? "No dimension targets for this entity."}
        </p>
      ) : (
        <>
          <div className="field-grid two">
            <label>
              Target
              <select
                value={targetIndex}
                disabled={disabled}
                onChange={(event) => {
                  const nextIndex = Number(event.currentTarget.value);
                  const nextTarget = targets[nextIndex] ?? targets[0];

                  setTargetIndex(nextIndex);
                  if (nextTarget) {
                    setForm({
                      ...form,
                      name: nextTarget.label,
                      value: nextTarget.currentValue
                    });
                  }
                }}
              >
                {targets.map((target, index) => (
                  <option key={target.label} value={index}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberInput
              disabled={disabled}
              label="Value"
              value={form.value}
              onChange={(value) => setForm({ ...form, value })}
            />
          </div>
          <TextInput
            disabled={disabled}
            label="Name"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
          />
          <button
            type="button"
            disabled={
              disabled || !selectedTarget || !Number.isFinite(form.value)
            }
            onClick={() =>
              selectedTarget &&
              onCreateDimension?.(
                context.sketch.id,
                context.entity.id,
                selectedTarget.target,
                effectiveForm
              )
            }
          >
            Add{" "}
            {selectedTarget
              ? getSketchDimensionTargetLabel(selectedTarget.target)
              : "dimension"}
          </button>
        </>
      )}
      {context.dimensions && context.dimensions.length > 0 && (
        <ul className="workbench-compact-list">
          {context.dimensions.map((dimension) => (
            <li key={dimension.id}>
              <div>
                <strong>{dimension.name}</strong>
                <small>{formatSketchDimensionStatus(dimension)}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function ConstraintCreateCard({
  action,
  context,
  disabled,
  onCreateConstraint
}: {
  readonly action?: ModelingActionDescriptor;
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly disabled: boolean;
  readonly onCreateConstraint?: (
    sketchId: string,
    entityId: string,
    form: SketchConstraintForm
  ) => void;
}) {
  const availableKinds = action?.target?.constraintKinds ?? [];
  const [kind, setKind] = useState<CurrentSketchConstraintKind>(
    availableKinds[0]?.kind ?? "horizontal"
  );
  const [form, setForm] = useState<SketchConstraintForm>(() => ({
    ...defaultConstraintForm,
    kind,
    name: getSketchConstraintKindLabel(kind)
  }));
  const effectiveForm = createEffectiveConstraintForm({
    context,
    form: { ...form, kind },
    kind
  });
  const availability = getConstraintAvailability(context, kind, effectiveForm);

  return (
    <details className="workbench-card collapsible">
      <summary>
        <span>Constraints</span>
        <small>{availableKinds.length}</small>
      </summary>
      {availableKinds.length === 0 ? (
        <p className="empty-state compact">
          {action?.reason ?? "No constraints available for this entity."}
        </p>
      ) : (
        <>
          <div className="field-grid two">
            <label>
              Type
              <select
                value={kind}
                disabled={disabled}
                onChange={(event) => {
                  const nextKind = event.currentTarget
                    .value as CurrentSketchConstraintKind;
                  setKind(nextKind);
                  setForm({
                    ...form,
                    kind: nextKind,
                    name: getSketchConstraintKindLabel(nextKind)
                  });
                }}
              >
                {availableKinds.map((option) => (
                  <option key={option.kind} value={option.kind}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <TextInput
              disabled={disabled}
              label="Name"
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
            />
          </div>
          <ConstraintTargetFields
            context={context}
            disabled={disabled}
            form={form}
            kind={kind}
            onChange={setForm}
          />
          {!availability.available && (
            <p className="error-text compact">{availability.message}</p>
          )}
          <button
            type="button"
            disabled={disabled || !availability.available}
            onClick={() =>
              onCreateConstraint?.(
                context.sketch.id,
                context.entity.id,
                effectiveForm
              )
            }
          >
            Add constraint
          </button>
        </>
      )}
      {context.constraints && context.constraints.length > 0 && (
        <ul className="workbench-compact-list">
          {context.constraints.map((constraint) => (
            <li key={constraint.id}>
              <div>
                <strong>{getSketchConstraintKindLabel(constraint.kind)}</strong>
                <small>{formatSketchConstraintStatus(constraint)}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function ConstraintTargetFields({
  context,
  disabled,
  form,
  kind,
  onChange
}: {
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly disabled: boolean;
  readonly form: SketchConstraintForm;
  readonly kind: CurrentSketchConstraintKind;
  readonly onChange: (form: SketchConstraintForm) => void;
}) {
  if (kind === "horizontal" || kind === "vertical") {
    return null;
  }

  const constraints = context.constraints ?? [];

  if (kind === "fixed") {
    const targetOptions = createAvailableFixedPointTargetOptions(
      context.entity,
      constraints
    );

    return (
      <div className="field-grid two">
        <label>
          Point
          <select
            value={form.targetRole}
            disabled={disabled || targetOptions.length === 0}
            onChange={(event) =>
              onChange({
                ...form,
                targetRole: event.currentTarget.value as SketchPointTargetRole
              })
            }
          >
            {targetOptions.map((option) => (
              <option
                key={`${option.target.entityId}:${option.target.role}`}
                value={option.target.role}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Coordinate
          <select
            value={form.coordinateMode}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                coordinateMode: event.currentTarget
                  .value as SketchConstraintForm["coordinateMode"]
              })
            }
          >
            <option value="current">Current</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>
    );
  }

  const primaryTargets = createSketchPointTargetOptionsForEntity(
    context.entity
  );
  const primaryTarget =
    primaryTargets.find((option) => option.target.role === form.targetRole) ??
    primaryTargets[0];

  if (kind === "coincident") {
    const secondaryTargets = createAvailableCoincidentPointTargetOptions(
      primaryTarget?.target,
      context.sketch.entities,
      constraints
    );

    return (
      <ConstraintSecondarySelect
        disabled={disabled}
        form={form}
        label="Make coincident with"
        options={secondaryTargets.map((option) => ({
          entityId: option.target.entityId,
          role: option.target.role,
          label: option.label
        }))}
        onChange={onChange}
      />
    );
  }

  if (kind === "midpoint") {
    const midpointTargets = createAvailableMidpointTargetOptions(
      context.entity,
      context.sketch.entities,
      constraints
    );

    return (
      <ConstraintSecondarySelect
        disabled={disabled}
        form={form}
        label="Point at midpoint"
        options={midpointTargets.map((option) => ({
          entityId: option.target.entityId,
          role: option.target.role,
          label: option.label
        }))}
        onChange={onChange}
      />
    );
  }

  if (kind === "parallel" || kind === "perpendicular") {
    const lineTargets = createAvailableParallelLineTargetOptions(
      context.entity,
      context.sketch.entities,
      constraints
    );

    return (
      <ConstraintSecondarySelect
        disabled={disabled}
        form={form}
        label="Line"
        options={lineTargets.map((option) => ({
          entityId: option.entityId,
          role: "position",
          label: option.label
        }))}
        onChange={onChange}
      />
    );
  }

  return null;
}

function ConstraintSecondarySelect({
  disabled,
  form,
  label,
  options,
  onChange
}: {
  readonly disabled: boolean;
  readonly form: SketchConstraintForm;
  readonly label: string;
  readonly options: readonly {
    readonly entityId: string;
    readonly role: SketchPointTargetRole;
    readonly label: string;
  }[];
  readonly onChange: (form: SketchConstraintForm) => void;
}) {
  const value = `${form.secondaryEntityId}:${form.secondaryTargetRole}`;

  return (
    <label>
      {label}
      <select
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(event) => {
          const [secondaryEntityId, secondaryTargetRole] =
            event.currentTarget.value.split(":");
          onChange({
            ...form,
            secondaryEntityId,
            secondaryTargetRole:
              (secondaryTargetRole as SketchPointTargetRole | undefined) ??
              "position"
          });
        }}
      >
        {options.map((option) => (
          <option
            key={`${option.entityId}:${option.role}`}
            value={`${option.entityId}:${option.role}`}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FeatureCreateCard({
  addTargetBodies,
  context,
  cutTargetBodies,
  disabled,
  extrudeAction,
  holeAction,
  holeTargetBodies,
  revolveAction,
  onExtrudeEntity,
  onHoleEntity,
  onRevolveEntity
}: {
  readonly addTargetBodies: readonly BooleanTargetBodyOption[];
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly cutTargetBodies: readonly BooleanTargetBodyOption[];
  readonly disabled: boolean;
  readonly extrudeAction?: ModelingActionDescriptor;
  readonly holeAction?: ModelingActionDescriptor;
  readonly holeTargetBodies: readonly BooleanTargetBodyOption[];
  readonly revolveAction?: ModelingActionDescriptor;
  readonly onExtrudeEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureExtrudeForm
  ) => void;
  readonly onHoleEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureHoleForm
  ) => void;
  readonly onRevolveEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureRevolveForm
  ) => void;
}) {
  const [mode, setMode] = useState<"extrude" | "revolve" | "hole">(() =>
    getInitialFeatureMode(context, holeTargetBodies)
  );
  const initialExtrudeOperationMode = getInitialExtrudeOperationMode(
    context,
    cutTargetBodies
  );

  return (
    <section className="workbench-card primary">
      <div className="workbench-card-heading">
        <h3>Create feature</h3>
        <small>{formatSketchEntityKind(context.entity.kind)}</small>
      </div>
      <div className="segmented-control feature-mode-tabs">
        <button
          type="button"
          className={mode === "extrude" ? "selected" : undefined}
          disabled={disabled}
          onClick={() => setMode("extrude")}
        >
          Extrude
        </button>
        <button
          type="button"
          className={mode === "revolve" ? "selected" : undefined}
          disabled={disabled}
          onClick={() => setMode("revolve")}
        >
          Revolve
        </button>
        <button
          type="button"
          className={mode === "hole" ? "selected" : undefined}
          disabled={disabled}
          onClick={() => setMode("hole")}
        >
          Hole
        </button>
      </div>
      {mode === "revolve" ? (
        <RevolveFeatureForm
          action={revolveAction}
          context={context}
          disabled={disabled}
          onRevolveEntity={onRevolveEntity}
        />
      ) : mode === "hole" ? (
        <HoleFeatureForm
          action={holeAction}
          context={context}
          disabled={disabled}
          holeTargetBodies={holeTargetBodies}
          onHoleEntity={onHoleEntity}
        />
      ) : (
        <ExtrudeFeatureForm
          action={extrudeAction}
          addTargetBodies={addTargetBodies}
          context={context}
          cutTargetBodies={cutTargetBodies}
          disabled={disabled}
          initialOperationMode={initialExtrudeOperationMode}
          onExtrudeEntity={onExtrudeEntity}
        />
      )}
    </section>
  );
}

function ExtrudeFeatureForm({
  action,
  addTargetBodies,
  context,
  cutTargetBodies,
  disabled,
  initialOperationMode,
  onExtrudeEntity
}: {
  readonly action?: ModelingActionDescriptor;
  readonly addTargetBodies: readonly BooleanTargetBodyOption[];
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly cutTargetBodies: readonly BooleanTargetBodyOption[];
  readonly disabled: boolean;
  readonly initialOperationMode: FeatureExtrudeForm["operationMode"];
  readonly onExtrudeEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureExtrudeForm
  ) => void;
}) {
  const initialTargetFields = getExtrudeTargetFields(
    initialOperationMode,
    addTargetBodies,
    cutTargetBodies
  );
  const [form, setForm] = useState<FeatureExtrudeForm>(() => ({
    ...defaultExtrudeForm,
    operationMode: initialOperationMode,
    side: getExtrudeSideForOperationMode(
      context.sketch,
      initialOperationMode,
      defaultExtrudeForm.side
    ),
    ...initialTargetFields
  }));
  const addStatus = getAddOperationStatus(context.entity, addTargetBodies);
  const cutStatus = getCutOperationStatus(context.entity, cutTargetBodies);
  const targetBodies =
    form.operationMode === "add" ? addTargetBodies : cutTargetBodies;
  const targetFields = getExtrudeTargetFields(
    form.operationMode,
    addTargetBodies,
    cutTargetBodies,
    form.targetBodyId
  );
  const targetBodyId = targetFields.targetBodyId;
  const selectedTargetBody = targetBodies.find(
    (body) => body.bodyId === targetBodyId
  );
  const effectiveForm: FeatureExtrudeForm = {
    ...form,
    ...targetFields
  };
  const operationStatus =
    form.operationMode === "add"
      ? addStatus
      : form.operationMode === "cut"
        ? cutStatus
        : undefined;
  const available =
    Boolean(action?.available) &&
    Number.isFinite(form.depth) &&
    form.depth > 0 &&
    (!operationStatus || operationStatus.available) &&
    (form.operationMode === "newBody" || Boolean(targetBodyId));

  return (
    <>
      {!action?.available && (
        <p className="error-text compact">
          {action?.reason ?? "This entity cannot be extruded."}
        </p>
      )}
      <div className="field-grid two">
        <NumberInput
          disabled={disabled}
          label="Depth"
          value={form.depth}
          onChange={(depth) => setForm({ ...form, depth })}
        />
        <label>
          Side
          <select
            value={form.side}
            disabled={disabled}
            onChange={(event) =>
              setForm({
                ...form,
                side: event.currentTarget.value as FeatureExtrudeForm["side"]
              })
            }
          >
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="symmetric">Symmetric</option>
          </select>
        </label>
        <label>
          Operation
          <select
            value={form.operationMode}
            disabled={disabled}
            onChange={(event) => {
              const operationMode = event.currentTarget
                .value as FeatureExtrudeForm["operationMode"];

              setForm({
                ...form,
                operationMode,
                side: getExtrudeSideForOperationMode(
                  context.sketch,
                  operationMode,
                  form.side
                ),
                ...getExtrudeTargetFields(
                  operationMode,
                  addTargetBodies,
                  cutTargetBodies
                )
              });
            }}
          >
            <option value="newBody">New body</option>
            <option value="add">Add to body ({addTargetBodies.length})</option>
            <option value="cut">Cut body ({cutTargetBodies.length})</option>
          </select>
        </label>
        {form.operationMode !== "newBody" && (
          <label>
            Target
            <select
              value={targetBodyId ?? ""}
              disabled={disabled || targetBodies.length === 0}
              onChange={(event) => {
                const targetBodyId = event.currentTarget.value;
                setForm({
                  ...form,
                  ...getExtrudeTargetFields(
                    form.operationMode,
                    addTargetBodies,
                    cutTargetBodies,
                    targetBodyId
                  )
                });
              }}
            >
              {targetBodies.map((body) => (
                <option key={body.bodyId} value={body.bodyId}>
                  {body.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {operationStatus && (
        <p
          className={
            operationStatus.available
              ? "form-hint compact"
              : "error-text compact"
          }
        >
          {operationStatus.message}
        </p>
      )}
      {selectedTargetBody && form.operationMode !== "newBody" && (
        <small className="form-hint">
          Target: {selectedTargetBody.label}.{" "}
          {form.operationMode === "add"
            ? "Add hides that target and creates a fused result body."
            : "Cut hides that target and creates a cut result body."}
        </small>
      )}
      {context.sketch.attachment && form.operationMode === "cut" && (
        <small className="form-hint">
          {form.side === "negative"
            ? "Negative cuts inward from the attached face."
            : "Positive points away from this face; use Negative to cut into the body."}
        </small>
      )}
      <button
        type="button"
        disabled={disabled || !available}
        onClick={() =>
          onExtrudeEntity?.(context.sketch.id, context.entity.id, effectiveForm)
        }
      >
        {formatExtrudeSubmitLabel(form.operationMode)}
      </button>
    </>
  );
}

function formatExtrudeSubmitLabel(
  operationMode: FeatureExtrudeForm["operationMode"]
): string {
  switch (operationMode) {
    case "add":
      return "Add to body";
    case "cut":
      return "Cut body";
    case "newBody":
      return "Create new body";
  }
}

function getInitialFeatureMode(
  context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >,
  holeTargetBodies: readonly BooleanTargetBodyOption[]
): "extrude" | "revolve" | "hole" {
  if (context.entity.kind === "circle" && holeTargetBodies.length > 0) {
    return "hole";
  }

  return "extrude";
}

function getInitialExtrudeOperationMode(
  context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >,
  cutTargetBodies: readonly BooleanTargetBodyOption[]
): FeatureExtrudeForm["operationMode"] {
  if (
    context.sketch.attachment &&
    context.entity.kind === "rectangle" &&
    cutTargetBodies.length > 0
  ) {
    return "cut";
  }

  return "newBody";
}

function RevolveFeatureForm({
  action,
  context,
  disabled,
  onRevolveEntity
}: {
  readonly action?: ModelingActionDescriptor;
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly disabled: boolean;
  readonly onRevolveEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureRevolveForm
  ) => void;
}) {
  const axisOptions =
    action?.target?.revolveAxes ?? createRevolveAxisOptions(context.sketch);
  const [form, setForm] = useState<FeatureRevolveForm>(() => ({
    ...defaultRevolveForm,
    axisEntityId: axisOptions[0]?.entityId ?? ""
  }));
  const effectiveForm = {
    ...form,
    axisEntityId: form.axisEntityId || axisOptions[0]?.entityId || ""
  };
  const status = getRevolveOperationStatus(
    context.entity,
    axisOptions,
    effectiveForm.angleDegrees,
    context.sketch.entities.filter((entity) => entity.kind === "line").length
  );

  return (
    <>
      <div className="field-grid two">
        <label>
          Axis
          <select
            value={effectiveForm.axisEntityId}
            disabled={disabled || axisOptions.length === 0}
            onChange={(event) =>
              setForm({ ...form, axisEntityId: event.currentTarget.value })
            }
          >
            {axisOptions.map((axis) => (
              <option key={axis.entityId} value={axis.entityId}>
                {axis.label}
              </option>
            ))}
          </select>
        </label>
        <NumberInput
          disabled={disabled}
          label="Angle"
          value={form.angleDegrees}
          onChange={(angleDegrees) => setForm({ ...form, angleDegrees })}
        />
      </div>
      {!status.available && (
        <p className="error-text compact">{status.message}</p>
      )}
      <button
        type="button"
        disabled={disabled || !status.available}
        onClick={() =>
          onRevolveEntity?.(context.sketch.id, context.entity.id, effectiveForm)
        }
      >
        Create revolve
      </button>
    </>
  );
}

function HoleFeatureForm({
  action,
  context,
  disabled,
  holeTargetBodies,
  onHoleEntity
}: {
  readonly action?: ModelingActionDescriptor;
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly disabled: boolean;
  readonly holeTargetBodies: readonly BooleanTargetBodyOption[];
  readonly onHoleEntity?: (
    sketchId: string,
    entityId: string,
    form: FeatureHoleForm
  ) => void;
}) {
  const [form, setForm] = useState<FeatureHoleForm>(() => ({
    ...defaultHoleForm,
    targetBodyId: holeTargetBodies[0]?.bodyId ?? "",
    targetTopologyAnchorId: holeTargetBodies[0]?.targetTopologyAnchorId
  }));
  const selectedTarget =
    holeTargetBodies.find((target) => target.bodyId === form.targetBodyId) ??
    holeTargetBodies[0];
  const effectiveForm = {
    ...form,
    targetBodyId: form.targetBodyId || selectedTarget?.bodyId || "",
    targetTopologyAnchorId: selectedTarget?.targetTopologyAnchorId
  };
  const status = getHoleOperationStatus(
    context.entity,
    holeTargetBodies,
    effectiveForm
  );
  const available = Boolean(action?.available) && status.available;
  const guidance = getHoleTargetGuidance(selectedTarget, context.sketch.plane);

  return (
    <>
      <div className="field-grid two">
        <label>
          Target
          <select
            value={effectiveForm.targetBodyId}
            disabled={disabled || holeTargetBodies.length === 0}
            onChange={(event) => {
              const target = holeTargetBodies.find(
                (option) => option.bodyId === event.currentTarget.value
              );

              setForm({
                ...form,
                targetBodyId: event.currentTarget.value,
                targetTopologyAnchorId: target?.targetTopologyAnchorId
              });
            }}
          >
            {holeTargetBodies.map((body) => (
              <option key={body.bodyId} value={body.bodyId}>
                {body.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Depth
          <select
            value={form.depthMode}
            disabled={disabled}
            onChange={(event) =>
              setForm({
                ...form,
                depthMode: event.currentTarget
                  .value as FeatureHoleForm["depthMode"]
              })
            }
          >
            <option value="throughAll">Through all</option>
            <option value="blind">Blind</option>
          </select>
        </label>
        {form.depthMode === "blind" && (
          <NumberInput
            disabled={disabled}
            label="Blind depth"
            value={form.depth}
            onChange={(depth) => setForm({ ...form, depth })}
          />
        )}
        <label>
          Direction
          <select
            value={form.direction}
            disabled={disabled}
            onChange={(event) =>
              setForm({
                ...form,
                direction: event.currentTarget
                  .value as FeatureHoleForm["direction"]
              })
            }
          >
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </label>
      </div>
      {!available && (
        <p className="error-text compact">{action?.reason ?? status.message}</p>
      )}
      {available && guidance && (
        <p className="project-message compact">{guidance}</p>
      )}
      <button
        type="button"
        disabled={disabled || !available}
        onClick={() =>
          onHoleEntity?.(context.sketch.id, context.entity.id, effectiveForm)
        }
      >
        Create hole
      </button>
    </>
  );
}

function BodyWorkbench({
  actions,
  context,
  disabled,
  sketches,
  onCreateSketchOnFace,
  onDeleteFeature,
  onSelectSketch
}: {
  readonly actions: readonly ModelingActionDescriptor[];
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "body" }
  >;
  readonly disabled: boolean;
  readonly sketches: readonly SketchSnapshot[];
  readonly onCreateSketchOnFace?: (form: SketchCreateOnFaceForm) => void;
  readonly onDeleteFeature?: (featureId: string) => void;
  readonly onSelectSketch?: (sketchId: string, entityId?: string) => void;
}) {
  const sketchAction = actions.find(
    (action) => action.id === "sketch.createOnFace"
  );
  const attachableFaces = getSketchAttachableFaces(
    context.generatedReferences?.faces ?? []
  );
  const eligibleFaceStableIds = new Set(
    sketchAction?.target?.eligibleFaceStableIds ??
      attachableFaces.map((face) => face.stableId)
  );
  const commandReadyAttachableFaces = attachableFaces.filter((face) =>
    eligibleFaceStableIds.has(face.stableId)
  );
  const [faceIndex, setFaceIndex] = useState(0);
  const selectedFace =
    commandReadyAttachableFaces[faceIndex] ?? commandReadyAttachableFaces[0];
  const [sketchDraft, setSketchDraft] = useState(() => ({
    id: createNextSketchId(sketches),
    name: selectedFace ? createSketchOnFaceDefaultName(selectedFace) : ""
  }));
  const sketchForm = selectedFace
    ? buildSketchOnFaceForm(context.body.id, selectedFace, sketchDraft)
    : undefined;
  const [deleteArmed, setDeleteArmed] = useState(false);
  const canDeleteFeature = canDeleteAuthoredFeature(context.feature);

  return (
    <div className="workbench-surface">
      <section className="workbench-card primary">
        <div className="workbench-card-heading">
          <h3>Body actions</h3>
          <small>
            {context.feature ? formatFeatureKind(context.feature) : "Body"}
          </small>
        </div>
        <div className="workbench-command-grid">
          <button
            type="button"
            disabled={!getSourceSketchId(context.feature)}
            onClick={() => {
              const sketchId = getSourceSketchId(context.feature);
              if (sketchId) {
                onSelectSketch?.(sketchId);
              }
            }}
          >
            Source sketch
          </button>
          <button
            type="button"
            disabled={!getSourceEntityId(context.feature)}
            onClick={() => {
              const sketchId = getSourceSketchId(context.feature);
              const entityId = getSourceEntityId(context.feature);
              if (sketchId && entityId) {
                onSelectSketch?.(sketchId, entityId);
              }
            }}
          >
            Source profile
          </button>
          {getSourceAxisEntityId(context.feature) && (
            <button
              type="button"
              disabled={!getSourceAxisEntityId(context.feature)}
              onClick={() => {
                const sketchId = getSourceSketchId(context.feature);
                const axisEntityId = getSourceAxisEntityId(context.feature);
                if (sketchId && axisEntityId) {
                  onSelectSketch?.(sketchId, axisEntityId);
                }
              }}
            >
              Source axis
            </button>
          )}
          <button
            type="button"
            className={deleteArmed ? "danger armed" : "danger"}
            disabled={disabled || !canDeleteFeature || !onDeleteFeature}
            title={
              canDeleteFeature
                ? "Delete this authored feature and its result body"
                : "Primitive bodies cannot be removed through feature delete"
            }
            onClick={() => {
              if (!context.feature || !canDeleteFeature) {
                return;
              }

              if (!deleteArmed) {
                setDeleteArmed(true);
                return;
              }

              onDeleteFeature?.(context.feature.id);
            }}
          >
            {deleteArmed ? "Confirm delete" : "Delete feature"}
          </button>
        </div>
        <div className="workbench-subheading">
          <strong>Sketch on face</strong>
          {commandReadyAttachableFaces.length > 0 && (
            <small>{commandReadyAttachableFaces.length} faces</small>
          )}
        </div>
        {commandReadyAttachableFaces.length > 0 && selectedFace ? (
          <>
            <div className="face-action-grid" aria-label="Sketch on face">
              {commandReadyAttachableFaces.map((face) => {
                const directForm = buildSketchOnFaceForm(
                  context.body.id,
                  face,
                  {
                    id: createNextSketchId(sketches),
                    name: createSketchOnFaceDefaultName(face)
                  }
                );

                return (
                  <button
                    key={face.stableId}
                    type="button"
                    disabled={
                      disabled || !sketchAction?.available || !directForm
                    }
                    title={formatSketchOnFaceAvailability(face)}
                    onClick={() => {
                      if (!directForm) {
                        return;
                      }

                      onCreateSketchOnFace?.(directForm);
                      if (directForm.id) {
                        onSelectSketch?.(directForm.id);
                      }
                    }}
                  >
                    {formatSketchOnFaceActionLabel(face)}
                  </button>
                );
              })}
            </div>
            <details className="advanced-options compact">
              <summary>Custom face/name</summary>
              <div className="field-grid two">
                <label>
                  Face
                  <select
                    value={faceIndex}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextIndex = Number(event.currentTarget.value);
                      const nextFace =
                        commandReadyAttachableFaces[nextIndex] ??
                        commandReadyAttachableFaces[0];

                      setFaceIndex(nextIndex);
                      if (nextFace) {
                        setSketchDraft({
                          id: createNextSketchId(sketches),
                          name: createSketchOnFaceDefaultName(nextFace)
                        });
                      }
                    }}
                  >
                    {commandReadyAttachableFaces.map((face, index) => (
                      <option key={face.stableId} value={index}>
                        {face.label}
                      </option>
                    ))}
                  </select>
                </label>
                <TextInput
                  disabled={disabled}
                  label="Sketch name"
                  value={sketchDraft.name}
                  onChange={(name) => setSketchDraft({ ...sketchDraft, name })}
                />
              </div>
              <button
                type="button"
                disabled={disabled || !sketchAction?.available || !sketchForm}
                onClick={() => {
                  if (!sketchForm) {
                    return;
                  }

                  onCreateSketchOnFace?.(sketchForm);
                  if (sketchForm.id) {
                    onSelectSketch?.(sketchForm.id);
                  }
                }}
              >
                Create named sketch
              </button>
            </details>
          </>
        ) : (
          <p className="empty-state compact">
            {sketchAction?.reason ?? "No eligible planar faces on this body."}
          </p>
        )}
      </section>
    </div>
  );
}

function formatSketchOnFaceActionLabel(
  face: CadGeneratedFaceReference
): string {
  return `Sketch ${formatGeneratedFaceShortLabel(face)}`;
}

function formatGeneratedFaceShortLabel(
  face: CadGeneratedFaceReference
): string {
  const label = face.label.trim();

  if (label.length > 0) {
    return label;
  }

  switch (face.role) {
    case "startCap":
      return "start cap";
    case "endCap":
      return "end cap";
    default:
      return face.role.replace(/([A-Z])/g, " $1").toLowerCase();
  }
}

function GeneratedReferenceWorkbench({
  actions,
  context,
  disabled,
  namedReferences,
  namedReferenceHealthByName,
  selectedNamedReferenceName,
  onCreateEdgeFinish,
  onCreateSideHoleSketch,
  onCreateSketchOnFace,
  onNameGeneratedReference,
  onRepairNamedReference,
  onSelectBody,
  onSelectSketch
}: {
  readonly actions: readonly ModelingActionDescriptor[];
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "generatedReference" }
  >;
  readonly disabled: boolean;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly selectedNamedReferenceName?: string;
  readonly onCreateEdgeFinish?: (
    operation: "chamfer" | "fillet",
    form: FeatureEdgeFinishForm
  ) => void;
  readonly onCreateSideHoleSketch?: (
    form: SketchCreateForm,
    targetBodyId: string
  ) => void;
  readonly onCreateSketchOnFace?: (form: SketchCreateOnFaceForm) => void;
  readonly onNameGeneratedReference?: (
    name: string,
    target: ReturnType<typeof createSelectedGeneratedReference>
  ) => void;
  readonly onRepairNamedReference?: (
    name: string,
    target: ReturnType<typeof createSelectedGeneratedReference>
  ) => void;
  readonly onSelectBody?: (bodyId: string) => void;
  readonly onSelectSketch?: (sketchId: string, entityId?: string) => void;
}) {
  const [name, setName] = useState(context.reference.label);
  const selectedReference = createSelectedGeneratedReference(context.reference);
  const nameAction = actions.find((action) => action.id === "reference.name");
  const hasEdgeFinishActions = actions.some(
    (action) =>
      action.id === "feature.chamfer" || action.id === "feature.fillet"
  );
  const canSaveName =
    name.trim().length > 0 && (nameAction ? nameAction.available : true);
  const repairReference = namedReferences.find(
    (reference) => reference.name === selectedNamedReferenceName
  );
  const repairState = createNamedReferenceRepairUiState({
    namedReferences: repairReference ? [repairReference] : [],
    namedReferenceHealthByName,
    selectedNamedReferenceName: repairReference?.name,
    selectedGeneratedReference: selectedReference,
    selectionReferenceCandidates: context.selectionReferenceCandidates
  });
  const repairDiagnostic =
    repairState.status === "none" ? undefined : repairState.diagnostics[0];

  return (
    <div className="workbench-surface">
      <section className="workbench-card primary">
        <div className="workbench-card-heading">
          <h3>Name reference</h3>
          <small>{context.reference.label}</small>
        </div>
        <button
          type="button"
          className="secondary-action"
          disabled={disabled || !onSelectBody}
          onClick={() => onSelectBody?.(context.reference.bodyId)}
        >
          Back to body
        </button>
        <small>
          {formatGeneratedReferenceOperationLabels(context.reference)}
        </small>
        <div className="field-grid two">
          <TextInput
            disabled={disabled}
            label="Reference name"
            value={name}
            onChange={setName}
          />
          <button
            type="button"
            disabled={disabled || !canSaveName}
            onClick={() =>
              onNameGeneratedReference?.(name.trim(), selectedReference)
            }
          >
            Save name
          </button>
        </div>
        {nameAction && !nameAction.available && (
          <p className="error-text compact">
            {nameAction.reason ?? "This reference cannot be named."}
          </p>
        )}
        {namedReferences.length > 0 && (
          <small>
            Existing:{" "}
            {namedReferences
              .filter(
                (reference) =>
                  reference.bodyId === context.reference.bodyId &&
                  reference.stableId === context.reference.stableId
              )
              .map((reference) => reference.name)
              .join(", ") || "none"}
          </small>
        )}
        {repairState.status !== "none" && (
          <div className="named-reference-repair">
            <div>
              <strong>Repair {repairState.reference.name}</strong>
              <small>
                {formatNamedReferenceRepairHealthStatus(
                  repairState.healthStatus
                )}
              </small>
              <small>{repairState.message}</small>
              {repairDiagnostic && (
                <small className="error-text compact">
                  {repairDiagnostic.code
                    ? `${repairDiagnostic.code}: ${repairDiagnostic.message}`
                    : repairDiagnostic.message}
                </small>
              )}
            </div>
            {repairState.status === "ready" && (
              <button
                type="button"
                disabled={disabled || !onRepairNamedReference}
                onClick={() =>
                  onRepairNamedReference?.(
                    repairState.reference.name,
                    repairState.target
                  )
                }
              >
                Repair name
              </button>
            )}
          </div>
        )}
      </section>
      {context.reference.kind === "face" && (
        <FaceReferenceWorkbench
          actions={actions}
          disabled={disabled}
          face={context.reference}
          onCreateSideHoleSketch={onCreateSideHoleSketch}
          onCreateSketchOnFace={onCreateSketchOnFace}
          onSelectSketch={onSelectSketch}
          topologyAnchorId={context.topologyAnchorId}
        />
      )}
      {context.reference.kind === "edge" && hasEdgeFinishActions && (
        <EdgeReferenceWorkbench
          actions={actions}
          body={context.body}
          disabled={disabled}
          edge={context.reference}
          namedReferences={namedReferences}
          onCreateEdgeFinish={onCreateEdgeFinish}
          selectionReferenceCandidates={context.selectionReferenceCandidates}
          topologyAnchorId={context.topologyAnchorId}
        />
      )}
    </div>
  );
}

function FaceReferenceWorkbench({
  actions,
  disabled,
  face,
  onCreateSketchOnFace,
  onCreateSideHoleSketch,
  onSelectSketch,
  topologyAnchorId
}: {
  readonly actions: readonly ModelingActionDescriptor[];
  readonly disabled: boolean;
  readonly face: CadGeneratedFaceReference;
  readonly onCreateSketchOnFace?: (form: SketchCreateOnFaceForm) => void;
  readonly onCreateSideHoleSketch?: (
    form: SketchCreateForm,
    targetBodyId: string
  ) => void;
  readonly onSelectSketch?: (sketchId: string, entityId?: string) => void;
  readonly topologyAnchorId?: string;
}) {
  const action = actions.find(
    (candidate) => candidate.id === "sketch.createOnFace"
  );
  const sideHoleAction = actions.find(
    (candidate) => candidate.id === "sketch.createSideHole"
  );
  const sideHolePlanes = sideHoleAction?.target?.sideHoleSketchPlanes ?? [];
  const [sideHolePlane, setSideHolePlane] = useState<SketchCreateForm["plane"]>(
    () => sideHolePlanes[0] ?? "XZ"
  );
  const [form, setForm] = useState(() => ({
    id: "",
    name: createSketchOnFaceDefaultName(face)
  }));
  const sketchForm = buildSketchOnFaceForm(
    face.bodyId,
    face,
    form,
    topologyAnchorId
  );

  return (
    <section className="workbench-card">
      <div className="workbench-card-heading">
        <h3>Attached sketch</h3>
        <small>Face plane</small>
      </div>
      <TextInput
        disabled={disabled}
        label="Sketch name"
        value={form.name}
        onChange={(name) => setForm({ ...form, name })}
      />
      {!action?.available && (
        <p className="error-text compact">
          {action?.reason ?? "This face cannot host a sketch."}
        </p>
      )}
      <button
        type="button"
        disabled={disabled || !action?.available || !sketchForm}
        onClick={() => {
          if (!sketchForm) {
            return;
          }

          onCreateSketchOnFace?.(sketchForm);
          if (sketchForm.id) {
            onSelectSketch?.(sketchForm.id);
          }
        }}
      >
        Create sketch on face
      </button>
      {sideHoleAction && (
        <div className="side-hole-starter">
          <div className="workbench-subheading">
            <strong>Side-hole sketch</strong>
            <small>World plane</small>
          </div>
          <div className="segmented-control compact">
            {sideHolePlanes.map((plane) => (
              <button
                key={plane}
                type="button"
                className={sideHolePlane === plane ? "selected" : undefined}
                disabled={disabled || !sideHoleAction.available}
                onClick={() => setSideHolePlane(plane)}
              >
                {plane}
              </button>
            ))}
          </div>
          {!sideHoleAction.available && (
            <p className="error-text compact">
              {sideHoleAction.reason ??
                "This circular target is not ready for a side-hole sketch."}
            </p>
          )}
          {sideHoleAction.available &&
            sideHoleAction.target?.holeTargetGuidance && (
              <p className="project-message compact">
                {sideHoleAction.target.holeTargetGuidance}
              </p>
            )}
          <button
            type="button"
            disabled={
              disabled ||
              !sideHoleAction.available ||
              !sideHoleAction.target?.preferredHoleTargetBodyId ||
              sideHolePlanes.length === 0
            }
            onClick={() => {
              const targetBodyId =
                sideHoleAction.target?.preferredHoleTargetBodyId;

              if (!targetBodyId) {
                return;
              }

              onCreateSideHoleSketch?.(
                {
                  id: "",
                  name: createSideHoleSketchDefaultName(face),
                  plane: sideHolePlane
                },
                targetBodyId
              );
            }}
          >
            Create {sideHolePlane} sketch
          </button>
        </div>
      )}
    </section>
  );
}

function createSideHoleSketchDefaultName(
  face: CadGeneratedFaceReference
): string {
  const label = formatGeneratedFaceShortLabel(face);

  return label ? `${label} side-hole sketch` : "Side-hole sketch";
}

function EdgeReferenceWorkbench({
  actions,
  body,
  disabled,
  edge,
  namedReferences,
  onCreateEdgeFinish,
  selectionReferenceCandidates,
  topologyAnchorId
}: {
  readonly actions: readonly ModelingActionDescriptor[];
  readonly body?: CadBodySnapshot;
  readonly disabled: boolean;
  readonly edge: Extract<CadGeneratedReference, { readonly kind: "edge" }>;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly onCreateEdgeFinish?: (
    operation: "chamfer" | "fillet",
    form: FeatureEdgeFinishForm
  ) => void;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly topologyAnchorId?: string;
}) {
  const [operation, setOperation] = useState<"chamfer" | "fillet">("chamfer");
  const [referenceValue, setReferenceValue] = useState(
    SELECTED_EDGE_FINISH_REFERENCE_VALUE
  );
  const [form, setForm] = useState(defaultEdgeFinishForm);
  const action = actions.find((candidate) =>
    operation === "chamfer"
      ? candidate.id === "feature.chamfer"
      : candidate.id === "feature.fillet"
  );
  const selectionState = {
    status: "selected",
    selection: {
      bodyId: edge.bodyId,
      stableId: edge.stableId,
      kind: edge.kind,
      ...(topologyAnchorId ? { topologyAnchorId } : {})
    },
    reference: edge,
    measurementRows: []
  } as const;
  const referenceOptions = createEdgeFinishReferenceOptions(
    selectionState,
    namedReferences,
    selectionReferenceCandidates
  );
  const referenceOption = selectEdgeFinishReferenceOption(
    referenceOptions,
    referenceValue
  );
  const edgeFinishForm = buildEdgeFinishForm({
    draft: {
      ...form,
      bodyId: form.bodyId,
      radius: form.radius,
      distance: form.distance
    },
    operation,
    referenceOption,
    targetBodyId: body?.id ?? edge.bodyId
  });

  return (
    <section className="workbench-card">
      <div className="workbench-card-heading">
        <h3>Edge finish</h3>
        <small>{edge.label}</small>
      </div>
      <div className="segmented-control feature-mode-tabs">
        <button
          type="button"
          className={operation === "chamfer" ? "selected" : undefined}
          disabled={disabled}
          onClick={() => setOperation("chamfer")}
        >
          Chamfer
        </button>
        <button
          type="button"
          className={operation === "fillet" ? "selected" : undefined}
          disabled={disabled}
          onClick={() => setOperation("fillet")}
        >
          Fillet
        </button>
      </div>
      {referenceOptions.length > 1 && (
        <label>
          Reference
          <select
            disabled={disabled}
            value={referenceOption?.value ?? referenceValue}
            onChange={(event) => setReferenceValue(event.currentTarget.value)}
          >
            {referenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.kind === "generated"
                  ? option.label
                  : `${option.label}${
                      option.status === "stale" ? " (stale)" : ""
                    }`}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="field-grid two">
        <NumberInput
          disabled={disabled}
          label={operation === "chamfer" ? "Distance" : "Radius"}
          value={operation === "chamfer" ? form.distance : form.radius}
          onChange={(value) =>
            setForm(
              operation === "chamfer"
                ? { ...form, distance: value }
                : { ...form, radius: value }
            )
          }
        />
        <TextInput
          disabled={disabled}
          label="Name"
          value={form.name}
          onChange={(name) => setForm({ ...form, name })}
        />
      </div>
      {!action?.available && (
        <p className="error-text compact">
          {action?.reason ?? "This edge finish is unavailable."}
        </p>
      )}
      <button
        type="button"
        disabled={disabled || !action?.available || !edgeFinishForm}
        onClick={() =>
          edgeFinishForm && onCreateEdgeFinish?.(operation, edgeFinishForm)
        }
      >
        Create {operation}
      </button>
    </section>
  );
}

function createEffectiveConstraintForm({
  context,
  form,
  kind
}: {
  readonly context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >;
  readonly form: SketchConstraintForm;
  readonly kind: CurrentSketchConstraintKind;
}): SketchConstraintForm {
  const primaryTarget =
    createSketchPointTargetOptionsForEntity(context.entity).find(
      (option) => option.target.role === form.targetRole
    ) ?? createSketchPointTargetOptionsForEntity(context.entity)[0];
  const constraints = context.constraints ?? [];

  if (kind === "horizontal" || kind === "vertical") {
    return {
      ...form,
      kind,
      name: form.name.trim() || getSketchConstraintKindLabel(kind)
    };
  }

  if (kind === "fixed") {
    return {
      ...form,
      kind,
      targetRole: primaryTarget?.target.role ?? form.targetRole,
      name: form.name.trim() || getSketchConstraintKindLabel(kind)
    };
  }

  const secondaryPointTarget =
    kind === "coincident"
      ? createAvailableCoincidentPointTargetOptions(
          primaryTarget?.target,
          context.sketch.entities,
          constraints
        )[0]?.target
      : kind === "midpoint"
        ? createAvailableMidpointTargetOptions(
            context.entity,
            context.sketch.entities,
            constraints
          )[0]?.target
        : undefined;
  const secondaryLineTarget =
    kind === "parallel" || kind === "perpendicular"
      ? createAvailableParallelLineTargetOptions(
          context.entity,
          context.sketch.entities,
          constraints
        )[0]
      : undefined;

  return {
    ...form,
    kind,
    targetRole: primaryTarget?.target.role ?? form.targetRole,
    secondaryEntityId:
      form.secondaryEntityId ||
      secondaryPointTarget?.entityId ||
      secondaryLineTarget?.entityId ||
      "",
    secondaryTargetRole:
      form.secondaryTargetRole || secondaryPointTarget?.role || "position",
    name: form.name.trim() || getSketchConstraintKindLabel(kind)
  };
}

function getConstraintAvailability(
  context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >,
  kind: CurrentSketchConstraintKind,
  form: SketchConstraintForm
): { readonly available: boolean; readonly message?: string } {
  if (kind === "horizontal" || kind === "vertical") {
    return { available: true };
  }

  if (kind === "fixed") {
    return createAvailableFixedPointTargetOptions(
      context.entity,
      context.constraints ?? []
    ).length > 0
      ? { available: true }
      : { available: false, message: "No available fixed point targets." };
  }

  if (!form.secondaryEntityId) {
    return { available: false, message: "Choose a second target." };
  }

  return { available: true };
}

function formatModelingSelectionSummary(
  context: ModelingSelectionContext,
  sketchCount: number
): ModelingSelectionSummary {
  switch (context.selectionKind) {
    case "none":
      return {
        eyebrow: sketchCount === 0 ? "Start model" : "No selection",
        title:
          sketchCount === 0
            ? "Create a source sketch"
            : "Pick from the model tree",
        detail:
          sketchCount === 0
            ? "Create the first sketch directly here."
            : "Select a sketch, entity, body, face, or edge."
      };
    case "sketch":
      return {
        eyebrow: "Sketch",
        title: context.sketch.name,
        detail: `${context.sketch.plane} plane / ${context.sketch.entities.length} entities`
      };
    case "sketchEntity":
      return {
        eyebrow: "Sketch entity",
        title: `${formatSketchEntityKind(context.entity.kind)} in ${context.sketch.name}`,
        detail: formatSketchEntity(context.entity)
      };
    case "body":
      return {
        eyebrow: "Body",
        title:
          context.body.name ??
          (context.feature && context.feature.kind !== "primitive"
            ? "Result body"
            : context.body.id),
        detail: context.feature
          ? formatFeatureBodySummary(context.feature)
          : "Generated body"
      };
    case "generatedReference":
      return {
        eyebrow: formatGeneratedReferenceKind(context.reference.kind),
        title: context.reference.label,
        detail:
          context.reference.description ??
          formatGeneratedReferenceKind(context.reference.kind)
      };
  }
}

function formatFeatureBodySummary(feature: CadFeatureSummary): string {
  if (feature.kind === "extrude") {
    return `Extrude ${formatExtrudeOperationModeLabel(feature.operationMode)} result`;
  }

  return `${formatFeatureKind(feature)} feature`;
}

function formatExtrudeOperationModeLabel(
  operationMode: Extract<
    CadFeatureSummary,
    { kind: "extrude" }
  >["operationMode"]
): string {
  switch (operationMode) {
    case "newBody":
      return "new body";
    case "cut":
      return "cut body";
    case "add":
      return "add to body";
  }
}

function formatFeatureKind(feature: CadFeatureSummary): string {
  switch (feature.kind) {
    case "extrude":
      return "Extrude";
    case "revolve":
      return "Revolve";
    case "hole":
      return "Hole";
    case "chamfer":
      return "Chamfer";
    case "fillet":
      return "Fillet";
    default:
      return feature.kind;
  }
}

function getSourceSketchId(
  feature: CadFeatureSummary | undefined
): string | undefined {
  if (!feature) {
    return undefined;
  }

  if (
    feature.kind === "extrude" ||
    feature.kind === "revolve" ||
    feature.kind === "hole"
  ) {
    return feature.sketchId;
  }

  return undefined;
}

function getSourceEntityId(
  feature: CadFeatureSummary | undefined
): string | undefined {
  if (!feature) {
    return undefined;
  }

  if (feature.kind === "extrude" || feature.kind === "revolve") {
    return feature.entityId;
  }

  if (feature.kind === "hole") {
    return feature.circleEntityId;
  }

  return undefined;
}

function getSourceAxisEntityId(
  feature: CadFeatureSummary | undefined
): string | undefined {
  if (feature?.kind !== "revolve") {
    return undefined;
  }

  return feature.axis.entityId;
}

function canDeleteAuthoredFeature(
  feature: CadFeatureSummary | undefined
): boolean {
  return Boolean(feature && feature.kind !== "primitive");
}

function formatSketchEntityKind(kind: SketchEntityKind): string {
  switch (kind) {
    case "point":
      return "Point";
    case "line":
      return "Line";
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
  }
}

function formatSketchEntityRole(kind: SketchEntityKind): string {
  switch (kind) {
    case "line":
      return "axis";
    case "rectangle":
    case "circle":
      return "profile";
    case "point":
      return "point";
  }
}

function NumberInput({
  disabled = false,
  label,
  onChange,
  value
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
        step="0.1"
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

function TextInput({
  disabled = false,
  label,
  onChange,
  value
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <label>
      {label}
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}
