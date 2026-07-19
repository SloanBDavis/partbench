import { useEffect, useMemo, useState } from "react";
import type {
  CadParameterSnapshot,
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchEvaluationQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchPlane,
  SketchSolverStatusQueryResponse,
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type {
  SketchConstraintForm,
  SketchCreateForm,
  SketchDimensionForm,
  SketchEntityForm
} from "../../cadCommands";
import {
  entityToSketchEntityForm,
  getSketchEntityFormLabels,
  sketchEntityFormToEntity,
  validateSketchEntityForm
} from "../../sketchEntityForms";
import { createSketchConstraintInferenceCandidates } from "../../sketchConstraintInference";
import {
  createAvailableCoincidentPointTargetOptions,
  createAvailableFixedPointTargetOptions,
  createAvailableMidpointTargetOptions,
  createAvailableParallelLineTargetOptions,
  createAvailableSketchConstraintKindOptions,
  createAvailableSketchDimensionTargetOptions,
  createSketchEntityIntentSummary,
  createSketchPointTargetOptionsForEntity,
  formatSketchConstraintStatus,
  formatSketchDimensionEffectiveValue,
  formatSketchDimensionStatus,
  formatSketchDimensionValueSource,
  formatSketchEvaluationStatus,
  formatSketchProfileValidity,
  formatSketchSolverStatus,
  getSketchConstraintKindLabel,
  getSketchDimensionTargetLabel,
  getSketchEntityKindLabel,
  getSketchSolverStatusDisplay,
  type SketchLineTargetOption
} from "../../sketchPanelUi";
import {
  formatSketchEntityUsageLabel,
  getSketchEntityExtrudeUsages
} from "../../sketchEntityUsage";
import type { CadFeatureSummary } from "@web-cad/cad-protocol";
import type { UiActionId } from "../../actions/actionRegistry";
import {
  DEFAULT_SKETCH_CONSTRAINT_FORM,
  constraintToRenameDraft,
  createDimensionDraft,
  createEntityDraft,
  dimensionTargetKey,
  dimensionToDraft,
  isLinePairConstraintKind,
  resolveActiveSketch,
  resolveSelectedSketchEntity,
  type SketchCreateEntityKind
} from "./sketchModeModel";
import "./sketchMode.css";

export interface SketchModeDockProps {
  readonly disabled: boolean;
  readonly sketches: readonly SketchSnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly features?: readonly CadFeatureSummary[];
  readonly dimensionsBySketchId: ReadonlyMap<
    string,
    readonly SketchDimensionEntry[]
  >;
  readonly evaluationsBySketchId: ReadonlyMap<
    string,
    SketchEvaluationQueryResponse
  >;
  readonly solverStatusesBySketchId: ReadonlyMap<
    string,
    SketchSolverStatusQueryResponse
  >;
  readonly pathCandidatesBySketchId?: ReadonlyMap<
    string,
    SketchPathCandidatesQueryResponse
  >;
  readonly activeSketchId?: string;
  readonly selectedEntityId?: string;
  readonly arcToolActiveSketchId?: string;
  readonly initialActionId?: UiActionId;
  readonly onSelectSketch: (sketchId: string) => void;
  readonly onSelectEntity: (sketchId: string, entityId: string) => void;
  readonly onCreateSketch: (form: SketchCreateForm) => void;
  readonly onAddEntity: (
    sketchId: string,
    kind: SketchCreateEntityKind,
    form: SketchEntityForm
  ) => void;
  readonly onUpdateEntity: (
    sketchId: string,
    entity: SketchEntitySnapshot
  ) => void;
  readonly onDeleteEntity: (sketchId: string, entityId: string) => void;
  readonly onSetEntityConstruction: (
    sketchId: string,
    entityId: string,
    construction: boolean
  ) => void;
  readonly onStartThreePointArcTool: (sketchId: string) => void;
  readonly onCancelGesture: () => void;
  readonly onCreateDimension: (
    sketchId: string,
    entityId: string,
    target: SketchDimensionTarget,
    form: SketchDimensionForm
  ) => void;
  readonly onApplyDimensionEdit: (
    dimension: SketchDimensionEntry,
    form: SketchDimensionForm
  ) => void;
  readonly onDeleteDimension: (dimensionId: string) => void;
  readonly onCreateConstraint: (
    sketchId: string,
    entityId: string,
    form: SketchConstraintForm
  ) => void;
  readonly onApplyConstraintEdit: (
    constraint: SketchConstraintEntry,
    form: SketchConstraintForm
  ) => void;
  readonly onDeleteConstraint: (constraintId: string) => void;
  readonly onFinish: () => void;
}

type DockSection = "geometry" | "constraints" | "status";
type EntityDraft = {
  readonly mode: "create" | "edit";
  readonly kind: SketchEntitySnapshot["kind"];
  readonly entityId?: string;
  readonly form: SketchEntityForm;
};
type DimensionDraft =
  | {
      readonly mode: "create";
      readonly target: SketchDimensionTarget;
      readonly form: SketchDimensionForm;
    }
  | {
      readonly mode: "edit";
      readonly dimensionId: string;
      readonly form: SketchDimensionForm;
    };
type ConstraintDraft =
  | { readonly mode: "create"; readonly form: SketchConstraintForm }
  | {
      readonly mode: "rename";
      readonly constraintId: string;
      readonly form: SketchConstraintForm;
    };

const DEFAULT_CREATE_SKETCH: SketchCreateForm = {
  id: "",
  name: "Sketch 1",
  plane: "XY"
};

const ENTITY_TOOLS: readonly {
  readonly kind: SketchCreateEntityKind;
  readonly label: string;
}[] = [
  { kind: "point", label: "Point" },
  { kind: "line", label: "Line" },
  { kind: "rectangle", label: "Rectangle" },
  { kind: "circle", label: "Circle" }
];

export function SketchModeDock(props: SketchModeDockProps) {
  const {
    disabled,
    sketches,
    parameters,
    features = [],
    dimensionsBySketchId,
    evaluationsBySketchId,
    solverStatusesBySketchId,
    pathCandidatesBySketchId,
    activeSketchId,
    selectedEntityId,
    arcToolActiveSketchId,
    initialActionId,
    onSelectSketch,
    onSelectEntity,
    onCreateSketch,
    onAddEntity,
    onUpdateEntity,
    onDeleteEntity,
    onSetEntityConstruction,
    onStartThreePointArcTool,
    onCancelGesture,
    onCreateDimension,
    onApplyDimensionEdit,
    onDeleteDimension,
    onCreateConstraint,
    onApplyConstraintEdit,
    onDeleteConstraint,
    onFinish
  } = props;
  const activeSketch = resolveActiveSketch(sketches, activeSketchId);
  const selectedEntity = resolveSelectedSketchEntity(
    activeSketch,
    selectedEntityId
  );
  const dimensions = activeSketch
    ? (dimensionsBySketchId.get(activeSketch.id) ?? [])
    : [];
  const evaluation = activeSketch
    ? evaluationsBySketchId.get(activeSketch.id)
    : undefined;
  const constraints = evaluation?.constraints ?? [];
  const solverStatus = activeSketch
    ? solverStatusesBySketchId.get(activeSketch.id)
    : undefined;
  const pathCandidates = activeSketch
    ? pathCandidatesBySketchId?.get(activeSketch.id)
    : undefined;
  const entityDimensions = selectedEntity
    ? dimensions.filter((item) => item.entityId === selectedEntity.id)
    : [];
  const entityConstraints = selectedEntity
    ? constraints.filter((item) =>
        constraintIncludesEntity(item, selectedEntity.id)
      )
    : [];
  const requestedEntityKind = getRequestedEntityKind(initialActionId);
  const requestedDimensionRole = getRequestedDimensionRole(initialActionId);
  const requestedDimension = createAvailableSketchDimensionTargetOptions(
    selectedEntity,
    entityDimensions
  ).find((option) => option.target.role === requestedDimensionRole);
  const requestedConstraintKind = getRequestedConstraintKind(initialActionId);
  const [section, setSection] = useState<DockSection>(() =>
    requestedDimension || requestedConstraintKind ? "constraints" : "geometry"
  );
  const [constructionForNew, setConstructionForNew] = useState(false);
  const [entityDraft, setEntityDraft] = useState<EntityDraft | undefined>(() =>
    requestedEntityKind
      ? {
          mode: "create",
          kind: requestedEntityKind,
          form: createEntityDraft(requestedEntityKind, false)
        }
      : undefined
  );
  const [dimensionDraft, setDimensionDraft] = useState<
    DimensionDraft | undefined
  >(() =>
    requestedDimension
      ? {
          mode: "create",
          ...createDimensionDraft(
            requestedDimension.label,
            requestedDimension.target,
            requestedDimension.currentValue
          )
        }
      : undefined
  );
  const [constraintDraft, setConstraintDraft] = useState<
    ConstraintDraft | undefined
  >(() =>
    requestedConstraintKind
      ? {
          mode: "create",
          form: {
            ...DEFAULT_SKETCH_CONSTRAINT_FORM,
            name: getSketchConstraintKindLabel(requestedConstraintKind),
            kind: requestedConstraintKind
          }
        }
      : undefined
  );
  const [createSketchDraft, setCreateSketchDraft] = useState<SketchCreateForm>(
    DEFAULT_CREATE_SKETCH
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (arcToolActiveSketchId) onCancelGesture();
      setEntityDraft(undefined);
      setDimensionDraft(undefined);
      setConstraintDraft(undefined);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [arcToolActiveSketchId, onCancelGesture]);

  if (!activeSketch) {
    return (
      <aside className="pb-sketch-dock" aria-label="Sketch editor">
        <DockHeader
          title="Create sketch"
          detail="Choose a standard sketch plane."
        />
        <form
          className="pb-sketch-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateSketch(createSketchDraft);
          }}
        >
          <TextField
            label="Name"
            value={createSketchDraft.name}
            disabled={disabled}
            onChange={(name) =>
              setCreateSketchDraft({ ...createSketchDraft, name })
            }
          />
          <label className="pb-sketch-field">
            <span>Plane</span>
            <select
              className="pb-field"
              value={createSketchDraft.plane}
              disabled={disabled}
              onChange={(event) =>
                setCreateSketchDraft({
                  ...createSketchDraft,
                  plane: event.currentTarget.value as SketchPlane
                })
              }
            >
              <option value="XY">Top · XY</option>
              <option value="XZ">Front · XZ</option>
              <option value="YZ">Right · YZ</option>
            </select>
          </label>
          <details>
            <summary>Advanced</summary>
            <TextField
              label="Optional sketch ID"
              value={createSketchDraft.id}
              disabled={disabled}
              onChange={(id) =>
                setCreateSketchDraft({ ...createSketchDraft, id })
              }
            />
          </details>
          <DraftButtons
            disabled={disabled || createSketchDraft.name.trim().length === 0}
            applyLabel="Create sketch"
            onApply={() => onCreateSketch(createSketchDraft)}
            onCancel={() => setCreateSketchDraft(DEFAULT_CREATE_SKETCH)}
          />
        </form>
      </aside>
    );
  }

  return (
    <aside className="pb-sketch-dock" aria-label="Sketch editor">
      <DockHeader
        title={activeSketch.name}
        detail={`${activeSketch.plane} plane · ${activeSketch.entities.length} ${activeSketch.entities.length === 1 ? "entity" : "entities"}`}
      />
      {sketches.length > 1 ? (
        <label className="pb-sketch-field pb-sketch-picker">
          <span>Active sketch</span>
          <select
            className="pb-field"
            value={activeSketch.id}
            disabled={disabled}
            onChange={(event) => onSelectSketch(event.currentTarget.value)}
          >
            {sketches.map((sketch) => (
              <option key={sketch.id} value={sketch.id}>
                {sketch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <nav className="pb-sketch-tabs" aria-label="Sketch inspector sections">
        {(["geometry", "constraints", "status"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={section === item ? "page" : undefined}
            onClick={() => setSection(item)}
          >
            {item === "geometry"
              ? "Geometry"
              : item === "constraints"
                ? "Intent"
                : "Status"}
          </button>
        ))}
      </nav>

      <div className="pb-sketch-dock__scroll">
        {section === "geometry" ? (
          <GeometrySection
            disabled={disabled}
            sketch={activeSketch}
            selectedEntity={selectedEntity}
            dimensions={entityDimensions}
            constraints={entityConstraints}
            features={features}
            arcActive={arcToolActiveSketchId === activeSketch.id}
            constructionForNew={constructionForNew}
            draft={entityDraft}
            onConstructionForNewChange={setConstructionForNew}
            onDraftChange={setEntityDraft}
            onSelectEntity={(entityId) =>
              onSelectEntity(activeSketch.id, entityId)
            }
            onAdd={(kind, form) => onAddEntity(activeSketch.id, kind, form)}
            onUpdate={(entity) => onUpdateEntity(activeSketch.id, entity)}
            onDelete={(entityId) => onDeleteEntity(activeSketch.id, entityId)}
            onSetConstruction={(entityId, construction) =>
              onSetEntityConstruction(activeSketch.id, entityId, construction)
            }
            onStartArc={() => onStartThreePointArcTool(activeSketch.id)}
            onCancelArc={onCancelGesture}
          />
        ) : null}
        {section === "constraints" ? (
          <IntentSection
            disabled={disabled}
            sketch={activeSketch}
            entity={selectedEntity}
            parameters={parameters}
            dimensions={entityDimensions}
            constraints={entityConstraints}
            allConstraints={constraints}
            dimensionDraft={dimensionDraft}
            constraintDraft={constraintDraft}
            onDimensionDraftChange={setDimensionDraft}
            onConstraintDraftChange={setConstraintDraft}
            onCreateDimension={onCreateDimension}
            onApplyDimensionEdit={onApplyDimensionEdit}
            onDeleteDimension={onDeleteDimension}
            onCreateConstraint={onCreateConstraint}
            onApplyConstraintEdit={onApplyConstraintEdit}
            onDeleteConstraint={onDeleteConstraint}
          />
        ) : null}
        {section === "status" ? (
          <StatusSection
            evaluation={evaluation}
            solverStatus={solverStatus}
            pathCandidates={pathCandidates}
          />
        ) : null}
      </div>
      <footer className="pb-sketch-dock__footer">
        <p>
          Finish exits Sketch mode. Committed geometry remains in the document.
        </p>
        <button
          type="button"
          className="pb-button pb-button--primary"
          disabled={disabled}
          onClick={onFinish}
        >
          Finish Sketch
        </button>
      </footer>
    </aside>
  );
}

function getRequestedEntityKind(
  actionId: UiActionId | undefined
): SketchCreateEntityKind | undefined {
  switch (actionId) {
    case "sketch.point":
      return "point";
    case "sketch.line":
      return "line";
    case "sketch.rectangle":
      return "rectangle";
    case "sketch.circle":
      return "circle";
    default:
      return undefined;
  }
}

function getRequestedDimensionRole(
  actionId: UiActionId | undefined
): SketchDimensionTarget["role"] | undefined {
  switch (actionId) {
    case "sketch.rectangle-width":
      return "width";
    case "sketch.rectangle-height":
      return "height";
    case "sketch.line-length":
      return "length";
    case "sketch.radius":
      return "radius";
    case "sketch.arc-sweep":
      return "sweep";
    default:
      return undefined;
  }
}

function getRequestedConstraintKind(
  actionId: UiActionId | undefined
): SketchConstraintForm["kind"] | undefined {
  switch (actionId) {
    case "sketch.horizontal":
      return "horizontal";
    case "sketch.vertical":
      return "vertical";
    case "sketch.fixed":
      return "fixed";
    case "sketch.coincident":
      return "coincident";
    case "sketch.midpoint":
      return "midpoint";
    case "sketch.parallel":
      return "parallel";
    case "sketch.perpendicular":
      return "perpendicular";
    default:
      return undefined;
  }
}

function GeometrySection({
  disabled,
  sketch,
  selectedEntity,
  dimensions,
  constraints,
  features,
  arcActive,
  constructionForNew,
  draft,
  onConstructionForNewChange,
  onDraftChange,
  onSelectEntity,
  onAdd,
  onUpdate,
  onDelete,
  onSetConstruction,
  onStartArc,
  onCancelArc
}: {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly selectedEntity: SketchEntitySnapshot | undefined;
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly features: readonly CadFeatureSummary[];
  readonly arcActive: boolean;
  readonly constructionForNew: boolean;
  readonly draft: EntityDraft | undefined;
  readonly onConstructionForNewChange: (value: boolean) => void;
  readonly onDraftChange: (draft: EntityDraft | undefined) => void;
  readonly onSelectEntity: (entityId: string) => void;
  readonly onAdd: (
    kind: SketchCreateEntityKind,
    form: SketchEntityForm
  ) => void;
  readonly onUpdate: (entity: SketchEntitySnapshot) => void;
  readonly onDelete: (entityId: string) => void;
  readonly onSetConstruction: (entityId: string, construction: boolean) => void;
  readonly onStartArc: () => void;
  readonly onCancelArc: () => void;
}) {
  const validation = draft
    ? validateSketchEntityForm(draft.kind, draft.form)
    : undefined;
  const intent = selectedEntity
    ? createSketchEntityIntentSummary(
        selectedEntity.id,
        dimensions,
        constraints
      )
    : undefined;
  const usage = selectedEntity
    ? formatSketchEntityUsageLabel(
        getSketchEntityExtrudeUsages(features, sketch.id, selectedEntity.id)
      ) || "Not used by an authored feature"
    : undefined;

  function applyDraft() {
    if (!draft || !validation?.ok) return;
    if (draft.mode === "create" && draft.kind !== "arc") {
      onAdd(draft.kind, draft.form);
    } else if (draft.mode === "edit" && draft.entityId) {
      onUpdate(
        sketchEntityFormToEntity(draft.entityId, draft.kind, draft.form)
      );
    }
    onDraftChange(undefined);
  }

  return (
    <div className="pb-sketch-stack">
      <section
        className="pb-sketch-section"
        aria-labelledby="sketch-create-heading"
      >
        <div className="pb-sketch-section__heading">
          <h3 id="sketch-create-heading">Create geometry</h3>
          <label className="pb-sketch-check">
            <input
              type="checkbox"
              checked={constructionForNew}
              disabled={disabled}
              onChange={(event) =>
                onConstructionForNewChange(event.currentTarget.checked)
              }
            />
            Construction
          </label>
        </div>
        <div className="pb-sketch-tool-grid">
          {ENTITY_TOOLS.map((tool) => (
            <button
              key={tool.kind}
              type="button"
              className="pb-button pb-button--dense"
              disabled={disabled}
              onClick={() =>
                onDraftChange({
                  mode: "create",
                  kind: tool.kind,
                  form: createEntityDraft(tool.kind, constructionForNew)
                })
              }
            >
              {tool.label}
            </button>
          ))}
          <button
            type="button"
            className="pb-button pb-button--dense"
            aria-pressed={arcActive}
            disabled={disabled}
            onClick={arcActive ? onCancelArc : onStartArc}
          >
            {arcActive ? "Cancel Arc" : "Three-point Arc"}
          </button>
        </div>
        {arcActive ? (
          <p className="pb-sketch-callout" role="status">
            Click start, a point on the arc, then end. Press Escape to cancel
            without mutation.
          </p>
        ) : null}
      </section>

      {draft ? (
        <EntityDraftForm
          draft={draft}
          disabled={disabled}
          validationMessage={
            validation && !validation.ok ? validation.message : undefined
          }
          onChange={(form) => onDraftChange({ ...draft, form })}
          onApply={applyDraft}
          onCancel={() => onDraftChange(undefined)}
        />
      ) : null}

      <section
        className="pb-sketch-section"
        aria-labelledby="sketch-entities-heading"
      >
        <div className="pb-sketch-section__heading">
          <h3 id="sketch-entities-heading">Entities</h3>
          <span>{sketch.entities.length}</span>
        </div>
        {sketch.entities.length === 0 ? (
          <p className="pb-sketch-empty">
            Choose a geometry tool to begin this sketch.
          </p>
        ) : (
          <div
            className="pb-sketch-list"
            role="listbox"
            aria-label="Sketch entities"
          >
            {sketch.entities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                role="option"
                aria-selected={entity.id === selectedEntity?.id}
                onClick={() => onSelectEntity(entity.id)}
              >
                <span>
                  <strong>{getSketchEntityKindLabel(entity.kind)}</strong>
                  <small>{entity.id}</small>
                </span>
                {entity.construction ? <em>Construction</em> : null}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedEntity ? (
        <section
          className="pb-sketch-section"
          aria-labelledby="entity-properties-heading"
        >
          <div className="pb-sketch-section__heading">
            <div>
              <p className="pb-sketch-eyebrow">Selected entity</p>
              <h3 id="entity-properties-heading">
                {getSketchEntityKindLabel(selectedEntity.kind)}
              </h3>
            </div>
            <span>{selectedEntity.id}</span>
          </div>
          <dl className="pb-sketch-facts">
            <div>
              <dt>Intent</dt>
              <dd>{intent?.label}</dd>
            </div>
            <div>
              <dt>Downstream</dt>
              <dd>{usage}</dd>
            </div>
          </dl>
          <label className="pb-sketch-check pb-sketch-check--boxed">
            <input
              type="checkbox"
              checked={selectedEntity.construction}
              disabled={disabled}
              onChange={(event) =>
                onSetConstruction(
                  selectedEntity.id,
                  event.currentTarget.checked
                )
              }
            />
            Construction geometry
          </label>
          <div className="pb-sketch-actions">
            <button
              type="button"
              className="pb-button"
              disabled={disabled}
              onClick={() =>
                onDraftChange({
                  mode: "edit",
                  entityId: selectedEntity.id,
                  kind: selectedEntity.kind,
                  form: entityToSketchEntityForm(selectedEntity)
                })
              }
            >
              Edit properties
            </button>
            <button
              type="button"
              className="pb-button pb-button--danger"
              disabled={disabled}
              onClick={() => onDelete(selectedEntity.id)}
            >
              Delete
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EntityDraftForm({
  draft,
  disabled,
  validationMessage,
  onChange,
  onApply,
  onCancel
}: {
  readonly draft: EntityDraft;
  readonly disabled: boolean;
  readonly validationMessage?: string;
  readonly onChange: (form: SketchEntityForm) => void;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}) {
  const labels = getSketchEntityFormLabels(draft.kind);
  const fields: readonly [keyof SketchEntityForm, string | undefined][] = [
    ["x", labels.x],
    ["y", labels.y],
    ["x2", labels.x2],
    ["y2", labels.y2],
    ["width", labels.width],
    ["height", labels.height],
    ["radius", labels.radius],
    ["startAngleDegrees", labels.startAngleDegrees],
    ["sweepAngleDegrees", labels.sweepAngleDegrees]
  ];
  return (
    <section
      className="pb-sketch-section pb-sketch-draft"
      aria-label={`${draft.mode === "create" ? "Create" : "Edit"} ${getSketchEntityKindLabel(draft.kind)}`}
    >
      <div className="pb-sketch-section__heading">
        <h3>
          {draft.mode === "create" ? "New" : "Edit"}{" "}
          {getSketchEntityKindLabel(draft.kind)}
        </h3>
        <span>Draft</span>
      </div>
      <div className="pb-sketch-field-grid">
        {fields.map(([key, label]) =>
          label ? (
            <NumberField
              key={key}
              label={label}
              value={draft.form[key] as number}
              disabled={disabled}
              onChange={(value) => onChange({ ...draft.form, [key]: value })}
            />
          ) : null
        )}
      </div>
      {validationMessage ? (
        <p className="pb-field-error" role="alert">
          {validationMessage}
        </p>
      ) : null}
      <DraftButtons
        disabled={disabled || Boolean(validationMessage)}
        applyLabel="Apply"
        onApply={onApply}
        onCancel={onCancel}
      />
    </section>
  );
}

function IntentSection({
  disabled,
  sketch,
  entity,
  parameters,
  dimensions,
  constraints,
  allConstraints,
  dimensionDraft,
  constraintDraft,
  onDimensionDraftChange,
  onConstraintDraftChange,
  onCreateDimension,
  onApplyDimensionEdit,
  onDeleteDimension,
  onCreateConstraint,
  onApplyConstraintEdit,
  onDeleteConstraint
}: {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly entity: SketchEntitySnapshot | undefined;
  readonly parameters: readonly CadParameterSnapshot[];
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly allConstraints: readonly SketchConstraintEntry[];
  readonly dimensionDraft: DimensionDraft | undefined;
  readonly constraintDraft: ConstraintDraft | undefined;
  readonly onDimensionDraftChange: (draft: DimensionDraft | undefined) => void;
  readonly onConstraintDraftChange: (
    draft: ConstraintDraft | undefined
  ) => void;
  readonly onCreateDimension: SketchModeDockProps["onCreateDimension"];
  readonly onApplyDimensionEdit: SketchModeDockProps["onApplyDimensionEdit"];
  readonly onDeleteDimension: (id: string) => void;
  readonly onCreateConstraint: SketchModeDockProps["onCreateConstraint"];
  readonly onApplyConstraintEdit: SketchModeDockProps["onApplyConstraintEdit"];
  readonly onDeleteConstraint: (id: string) => void;
}) {
  if (!entity) {
    return (
      <p className="pb-sketch-empty">
        Select a sketch entity to inspect its dimensions and constraints.
      </p>
    );
  }
  return (
    <div className="pb-sketch-stack">
      <DimensionSection
        disabled={disabled}
        sketch={sketch}
        entity={entity}
        parameters={parameters}
        dimensions={dimensions}
        draft={dimensionDraft}
        onDraftChange={onDimensionDraftChange}
        onCreate={onCreateDimension}
        onApply={onApplyDimensionEdit}
        onDelete={onDeleteDimension}
      />
      <ConstraintSection
        disabled={disabled}
        sketch={sketch}
        entity={entity}
        constraints={constraints}
        allConstraints={allConstraints}
        draft={constraintDraft}
        onDraftChange={onConstraintDraftChange}
        onCreate={onCreateConstraint}
        onApply={onApplyConstraintEdit}
        onDelete={onDeleteConstraint}
      />
    </div>
  );
}

function DimensionSection({
  disabled,
  sketch,
  entity,
  parameters,
  dimensions,
  draft,
  onDraftChange,
  onCreate,
  onApply,
  onDelete
}: {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly entity: SketchEntitySnapshot;
  readonly parameters: readonly CadParameterSnapshot[];
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly draft: DimensionDraft | undefined;
  readonly onDraftChange: (draft: DimensionDraft | undefined) => void;
  readonly onCreate: SketchModeDockProps["onCreateDimension"];
  readonly onApply: SketchModeDockProps["onApplyDimensionEdit"];
  readonly onDelete: (id: string) => void;
}) {
  const available = createAvailableSketchDimensionTargetOptions(
    entity,
    dimensions
  );
  const editedDimension =
    draft?.mode === "edit"
      ? dimensions.find((item) => item.id === draft.dimensionId)
      : undefined;
  const effectiveDraftForm = draft
    ? {
        ...draft.form,
        parameterId:
          draft.form.valueSourceType === "parameter"
            ? draft.form.parameterId || parameters[0]?.id || ""
            : draft.form.parameterId
      }
    : undefined;
  function submit() {
    if (!draft || !effectiveDraftForm) return;
    if (draft.mode === "create")
      onCreate(sketch.id, entity.id, draft.target, effectiveDraftForm);
    else if (editedDimension) onApply(editedDimension, effectiveDraftForm);
    onDraftChange(undefined);
  }
  return (
    <section className="pb-sketch-section" aria-labelledby="dimensions-heading">
      <div className="pb-sketch-section__heading">
        <h3 id="dimensions-heading">Dimensions</h3>
        <span>{dimensions.length}</span>
      </div>
      <div className="pb-sketch-records">
        {dimensions.map((dimension) => (
          <article key={dimension.id}>
            <div>
              <strong>
                {dimension.name} ·{" "}
                {getSketchDimensionTargetLabel(dimension.target)}
              </strong>
              <small>
                {formatSketchDimensionValueSource(dimension, parameters)} ·{" "}
                {formatSketchDimensionEffectiveValue(dimension)}
              </small>
            </div>
            <p>{formatSketchDimensionStatus(dimension)}</p>
            <div className="pb-sketch-record-actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onDraftChange({
                    mode: "edit",
                    dimensionId: dimension.id,
                    form: dimensionToDraft(dimension)
                  })
                }
              >
                Edit
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDelete(dimension.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      {!draft && available.length > 0 ? (
        <div className="pb-sketch-actions">
          {available.map((option) => (
            <button
              key={dimensionTargetKey(option.target)}
              type="button"
              className="pb-button pb-button--dense"
              disabled={disabled}
              onClick={() =>
                onDraftChange({
                  mode: "create",
                  ...createDimensionDraft(
                    option.label,
                    option.target,
                    option.currentValue
                  )
                })
              }
            >
              Add {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {draft ? (
        <div className="pb-sketch-draft">
          <TextField
            label="Name"
            value={effectiveDraftForm?.name ?? ""}
            disabled={disabled}
            onChange={(name) =>
              onDimensionDraftChange(onDraftChange, draft, {
                ...draft.form,
                name
              })
            }
          />
          <label className="pb-sketch-field">
            <span>Value source</span>
            <select
              className="pb-field"
              value={effectiveDraftForm?.valueSourceType}
              disabled={disabled}
              onChange={(event) =>
                onDimensionDraftChange(onDraftChange, draft, {
                  ...draft.form,
                  valueSourceType: event.currentTarget
                    .value as SketchDimensionForm["valueSourceType"]
                })
              }
            >
              <option value="literal">Literal</option>
              <option value="parameter" disabled={parameters.length === 0}>
                Parameter
              </option>
            </select>
          </label>
          {effectiveDraftForm?.valueSourceType === "literal" ? (
            <NumberField
              label="Value"
              value={effectiveDraftForm.value}
              disabled={disabled}
              onChange={(value) =>
                onDimensionDraftChange(onDraftChange, draft, {
                  ...draft.form,
                  value
                })
              }
            />
          ) : (
            <label className="pb-sketch-field">
              <span>Parameter</span>
              <select
                className="pb-field"
                value={effectiveDraftForm?.parameterId ?? ""}
                disabled={disabled || parameters.length === 0}
                onChange={(event) =>
                  onDimensionDraftChange(onDraftChange, draft, {
                    ...draft.form,
                    parameterId: event.currentTarget.value
                  })
                }
              >
                {parameters.map((parameter) => (
                  <option key={parameter.id} value={parameter.id}>
                    {parameter.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <DraftButtons
            disabled={
              disabled ||
              (draft.form.valueSourceType === "parameter" &&
                parameters.length === 0)
            }
            applyLabel="Apply"
            onApply={submit}
            onCancel={() => onDraftChange(undefined)}
          />
        </div>
      ) : null}
      {dimensions.length === 0 && available.length === 0 ? (
        <p className="pb-sketch-empty">
          This entity has no supported dimension targets.
        </p>
      ) : null}
    </section>
  );
}

function ConstraintSection({
  disabled,
  sketch,
  entity,
  constraints,
  allConstraints,
  draft,
  onDraftChange,
  onCreate,
  onApply,
  onDelete
}: {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly entity: SketchEntitySnapshot;
  readonly constraints: readonly SketchConstraintEntry[];
  readonly allConstraints: readonly SketchConstraintEntry[];
  readonly draft: ConstraintDraft | undefined;
  readonly onDraftChange: (draft: ConstraintDraft | undefined) => void;
  readonly onCreate: SketchModeDockProps["onCreateConstraint"];
  readonly onApply: SketchModeDockProps["onApplyConstraintEdit"];
  readonly onDelete: (id: string) => void;
}) {
  const availableKinds = createAvailableSketchConstraintKindOptions(
    entity,
    allConstraints,
    sketch.entities
  );
  const inference = createSketchConstraintInferenceCandidates({
    entity,
    sketchEntities: sketch.entities,
    constraints: allConstraints
  });
  const editedConstraint =
    draft?.mode === "rename"
      ? constraints.find((item) => item.id === draft.constraintId)
      : undefined;
  const effective = useMemo(
    () =>
      draft?.mode === "create"
        ? createEffectiveConstraintForm(
            draft.form,
            entity,
            sketch.entities,
            allConstraints
          )
        : draft?.form,
    [draft, entity, sketch.entities, allConstraints]
  );
  function submit() {
    if (!draft || !effective) return;
    if (draft.mode === "create") onCreate(sketch.id, entity.id, effective);
    else if (editedConstraint) onApply(editedConstraint, effective);
    onDraftChange(undefined);
  }
  return (
    <section
      className="pb-sketch-section"
      aria-labelledby="constraints-heading"
    >
      <div className="pb-sketch-section__heading">
        <h3 id="constraints-heading">Constraints</h3>
        <span>{constraints.length}</span>
      </div>
      <div className="pb-sketch-records">
        {constraints.map((constraint) => (
          <article key={constraint.id}>
            <div>
              <strong>
                {constraint.name} ·{" "}
                {getSketchConstraintKindLabel(constraint.kind)}
              </strong>
              <small>{formatSketchConstraintStatus(constraint)}</small>
            </div>
            <div className="pb-sketch-record-actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onDraftChange({
                    mode: "rename",
                    constraintId: constraint.id,
                    form: constraintToRenameDraft(constraint)
                  })
                }
              >
                Rename
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDelete(constraint.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      {!draft && availableKinds.length > 0 ? (
        <button
          type="button"
          className="pb-button"
          disabled={disabled}
          onClick={() =>
            onDraftChange({
              mode: "create",
              form: {
                ...DEFAULT_SKETCH_CONSTRAINT_FORM,
                kind: availableKinds[0]!.kind,
                name: availableKinds[0]!.label
              }
            })
          }
        >
          Add constraint
        </button>
      ) : null}
      {!draft && inference.length > 0 ? (
        <div
          className="pb-sketch-inference"
          aria-label="Constraint inference candidates"
        >
          <p>Conservative suggestions</p>
          {inference.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              disabled={disabled}
              onClick={() => onCreate(sketch.id, entity.id, candidate.form)}
            >
              <strong>{candidate.label}</strong>
              <span>{candidate.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
      {draft ? (
        <div className="pb-sketch-draft">
          {draft.mode === "create" ? (
            <label className="pb-sketch-field">
              <span>Constraint</span>
              <select
                className="pb-field"
                value={effective?.kind}
                disabled={disabled}
                onChange={(event) => {
                  const kind = event.currentTarget
                    .value as SketchConstraintForm["kind"];
                  onDraftChange({
                    ...draft,
                    form: {
                      ...draft.form,
                      kind,
                      name: getSketchConstraintKindLabel(kind)
                    }
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
          ) : (
            <p className="pb-sketch-callout">
              Loaded constraint structure is read-only in V18. Its name can
              still be changed.
            </p>
          )}
          <TextField
            label="Name"
            value={draft.form.name}
            disabled={disabled}
            onChange={(name) =>
              onDraftChange({ ...draft, form: { ...draft.form, name } })
            }
          />
          {draft.mode === "create" && effective ? (
            <ConstraintTargetFields
              disabled={disabled}
              form={effective}
              entity={entity}
              entities={sketch.entities}
              constraints={allConstraints}
              onChange={(form) => onDraftChange({ ...draft, form })}
            />
          ) : null}
          <DraftButtons
            disabled={
              disabled ||
              (draft.mode === "rename"
                ? draft.form.name.trim().length === 0
                : !constraintDraftIsSubmittable(
                    effective,
                    entity,
                    sketch.entities,
                    allConstraints
                  ))
            }
            applyLabel={draft.mode === "rename" ? "Apply name" : "Apply"}
            onApply={submit}
            onCancel={() => onDraftChange(undefined)}
          />
        </div>
      ) : null}
    </section>
  );
}

function ConstraintTargetFields({
  disabled,
  form,
  entity,
  entities,
  constraints,
  onChange
}: {
  readonly disabled: boolean;
  readonly form: SketchConstraintForm;
  readonly entity: SketchEntitySnapshot;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly onChange: (form: SketchConstraintForm) => void;
}) {
  const primary =
    form.kind === "fixed"
      ? createAvailableFixedPointTargetOptions(entity, constraints)
      : createSketchPointTargetOptionsForEntity(entity);
  const selectedPrimary =
    primary.find((item) => item.target.role === form.targetRole) ?? primary[0];
  const secondary =
    form.kind === "midpoint"
      ? createAvailableMidpointTargetOptions(entity, entities, constraints)
      : createAvailableCoincidentPointTargetOptions(
          selectedPrimary?.target,
          entities,
          constraints
        );
  const lines: readonly SketchLineTargetOption[] =
    createAvailableParallelLineTargetOptions(entity, entities, constraints);
  if (form.kind === "horizontal" || form.kind === "vertical") return null;
  if (form.kind === "parallel" || form.kind === "perpendicular") {
    return (
      <label className="pb-sketch-field">
        <span>Other line</span>
        <select
          className="pb-field"
          value={form.secondaryEntityId || lines[0]?.entityId || ""}
          disabled={disabled || lines.length === 0}
          onChange={(event) =>
            onChange({ ...form, secondaryEntityId: event.currentTarget.value })
          }
        >
          {lines.map((item) => (
            <option key={item.entityId} value={item.entityId}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="pb-sketch-field-grid">
      <label className="pb-sketch-field">
        <span>{form.kind === "midpoint" ? "Line endpoint" : "Point"}</span>
        <select
          className="pb-field"
          value={form.targetRole}
          disabled={disabled || primary.length === 0}
          onChange={(event) =>
            onChange({
              ...form,
              targetRole: event.currentTarget
                .value as SketchConstraintForm["targetRole"]
            })
          }
        >
          {primary.map((item) => (
            <option
              key={`${item.target.entityId}:${item.target.role}`}
              value={item.target.role}
            >
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {form.kind === "fixed" ? (
        <label className="pb-sketch-field">
          <span>Position</span>
          <select
            className="pb-field"
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
            <option value="current">Current point</option>
            <option value="custom">Custom coordinate</option>
          </select>
        </label>
      ) : form.kind === "coincident" || form.kind === "midpoint" ? (
        <label className="pb-sketch-field">
          <span>
            {form.kind === "midpoint" ? "Point at midpoint" : "Coincident with"}
          </span>
          <select
            className="pb-field"
            value={`${form.secondaryEntityId}:${form.secondaryTargetRole}`}
            disabled={disabled || secondary.length === 0}
            onChange={(event) => {
              const item = secondary.find(
                (option) =>
                  `${option.target.entityId}:${option.target.role}` ===
                  event.currentTarget.value
              );
              if (item)
                onChange({
                  ...form,
                  secondaryEntityId: item.target.entityId,
                  secondaryTargetRole: item.target.role
                });
            }}
          >
            {secondary.map((item) => (
              <option
                key={`${item.target.entityId}:${item.target.role}`}
                value={`${item.target.entityId}:${item.target.role}`}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {form.kind === "fixed" && form.coordinateMode === "custom" ? (
        <>
          <NumberField
            label="X"
            value={form.coordinateX}
            disabled={disabled}
            onChange={(coordinateX) => onChange({ ...form, coordinateX })}
          />
          <NumberField
            label="Y"
            value={form.coordinateY}
            disabled={disabled}
            onChange={(coordinateY) => onChange({ ...form, coordinateY })}
          />
        </>
      ) : null}
    </div>
  );
}

function createEffectiveConstraintForm(
  form: SketchConstraintForm,
  entity: SketchEntitySnapshot,
  entities: readonly SketchEntitySnapshot[],
  constraints: readonly SketchConstraintEntry[]
): SketchConstraintForm {
  const primary =
    form.kind === "fixed"
      ? createAvailableFixedPointTargetOptions(entity, constraints)
      : createSketchPointTargetOptionsForEntity(entity);
  const selectedPrimary =
    primary.find((item) => item.target.role === form.targetRole) ?? primary[0];
  const secondary =
    form.kind === "midpoint"
      ? createAvailableMidpointTargetOptions(entity, entities, constraints)
      : createAvailableCoincidentPointTargetOptions(
          selectedPrimary?.target,
          entities,
          constraints
        );
  const selectedSecondary =
    secondary.find(
      (item) =>
        item.target.entityId === form.secondaryEntityId &&
        item.target.role === form.secondaryTargetRole
    ) ?? secondary[0];
  const lines = createAvailableParallelLineTargetOptions(
    entity,
    entities,
    constraints
  );
  const selectedLine =
    lines.find((item) => item.entityId === form.secondaryEntityId) ?? lines[0];
  return {
    ...form,
    targetRole: selectedPrimary?.target.role ?? form.targetRole,
    coordinateX:
      form.coordinateMode === "current"
        ? (selectedPrimary?.coordinate?.[0] ?? form.coordinateX)
        : form.coordinateX,
    coordinateY:
      form.coordinateMode === "current"
        ? (selectedPrimary?.coordinate?.[1] ?? form.coordinateY)
        : form.coordinateY,
    secondaryEntityId: isLinePairConstraintKind(form.kind)
      ? (selectedLine?.entityId ?? "")
      : (selectedSecondary?.target.entityId ?? ""),
    secondaryTargetRole:
      selectedSecondary?.target.role ?? form.secondaryTargetRole
  };
}

function constraintDraftIsSubmittable(
  form: SketchConstraintForm | undefined,
  entity: SketchEntitySnapshot,
  entities: readonly SketchEntitySnapshot[],
  constraints: readonly SketchConstraintEntry[]
): boolean {
  if (!form || form.name.trim().length === 0) return false;
  if (form.kind === "horizontal" || form.kind === "vertical")
    return entity.kind === "line";
  if (form.kind === "parallel" || form.kind === "perpendicular")
    return (
      createAvailableParallelLineTargetOptions(entity, entities, constraints)
        .length > 0
    );
  if (form.kind === "fixed")
    return (
      createAvailableFixedPointTargetOptions(entity, constraints).length > 0
    );
  const primaryOptions = createSketchPointTargetOptionsForEntity(entity);
  const primary =
    primaryOptions.find((item) => item.target.role === form.targetRole)
      ?.target ?? primaryOptions[0]?.target;
  if (form.kind === "coincident")
    return (
      createAvailableCoincidentPointTargetOptions(
        primary,
        entities,
        constraints
      ).length > 0
    );
  if (form.kind === "midpoint")
    return (
      createAvailableMidpointTargetOptions(entity, entities, constraints)
        .length > 0
    );
  return false;
}

function StatusSection({
  evaluation,
  solverStatus,
  pathCandidates
}: {
  readonly evaluation: SketchEvaluationQueryResponse | undefined;
  readonly solverStatus: SketchSolverStatusQueryResponse | undefined;
  readonly pathCandidates: SketchPathCandidatesQueryResponse | undefined;
}) {
  const degreesOfFreedom = solverStatus?.entities.reduce(
    (sum, entity) => sum + entity.degreesOfFreedom,
    0
  );
  const solverDisplay = getSketchSolverStatusDisplay(solverStatus);
  return (
    <div className="pb-sketch-stack">
      <section className="pb-sketch-section">
        <div className="pb-sketch-section__heading">
          <h3>Solver</h3>
          <HealthBadge tone={solverDisplay.tone} label={solverDisplay.label} />
        </div>
        <p>{formatSketchSolverStatus(solverStatus)}</p>
        <dl className="pb-sketch-facts">
          <div>
            <dt>Degrees of freedom</dt>
            <dd>{degreesOfFreedom ?? "Not proven"}</dd>
          </div>
          <div>
            <dt>Evaluation</dt>
            <dd>{formatSketchEvaluationStatus(evaluation)}</dd>
          </div>
        </dl>
      </section>
      <section className="pb-sketch-section">
        <div className="pb-sketch-section__heading">
          <h3>Profile candidates</h3>
          <span>
            {solverStatus?.profileValidity.validProfileCount ?? 0}/
            {solverStatus?.profileValidity.profileCount ?? 0}
          </span>
        </div>
        <p>
          {solverStatus
            ? formatSketchProfileValidity(solverStatus)
            : "Profile health unavailable."}
        </p>
      </section>
      <section className="pb-sketch-section">
        <div className="pb-sketch-section__heading">
          <h3>Path candidates</h3>
          <span>{pathCandidates?.candidateCount ?? 0}</span>
        </div>
        <p>
          {pathCandidates
            ? `${pathCandidates.candidateCount} ready ${pathCandidates.candidateCount === 1 ? "path" : "paths"}; ${pathCandidates.rejectedComponentCount} rejected.`
            : "Path candidate health is not available for this sketch."}
        </p>
      </section>
      {solverStatus && solverStatus.diagnostics.length > 0 ? (
        <details className="pb-sketch-diagnostics">
          <summary>Solver diagnostics ({solverStatus.diagnosticCount})</summary>
          <ul>
            {solverStatus.diagnostics.map((item, index) => (
              <li key={`${item.code}-${index}`}>{item.message}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function DockHeader({
  title,
  detail
}: {
  readonly title: string;
  readonly detail: string;
}) {
  return (
    <header className="pb-sketch-dock__header">
      <p className="pb-sketch-eyebrow">Sketch mode</p>
      <h2>{title}</h2>
      <p>{detail}</p>
    </header>
  );
}

function HealthBadge({
  tone,
  label
}: {
  readonly tone: "healthy" | "warning" | "error";
  readonly label: string;
}) {
  return (
    <span className={`pb-sketch-health pb-sketch-health--${tone}`}>
      {label}
    </span>
  );
}

function TextField({
  label,
  value,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
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
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <input
        className="pb-field pb-numeric"
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

function DraftButtons({
  disabled,
  applyLabel,
  onApply,
  onCancel
}: {
  readonly disabled: boolean;
  readonly applyLabel: string;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="pb-sketch-actions">
      <button
        type="button"
        className="pb-button pb-button--primary"
        disabled={disabled}
        onClick={onApply}
      >
        {applyLabel}
      </button>
      <button type="button" className="pb-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function onDimensionDraftChange(
  setDraft: (draft: DimensionDraft | undefined) => void,
  draft: DimensionDraft,
  form: SketchDimensionForm
) {
  setDraft({ ...draft, form });
}

function constraintIncludesEntity(
  constraint: SketchConstraintEntry,
  entityId: string
): boolean {
  if (constraint.kind === "fixed")
    return constraint.target.entityId === entityId;
  if (constraint.kind === "coincident")
    return (
      constraint.primaryTarget.entityId === entityId ||
      constraint.secondaryTarget.entityId === entityId
    );
  if (constraint.kind === "midpoint")
    return (
      constraint.lineEntityId === entityId ||
      constraint.target.entityId === entityId
    );
  if (constraint.kind === "parallel" || constraint.kind === "perpendicular")
    return (
      constraint.primaryLineEntityId === entityId ||
      constraint.secondaryLineEntityId === entityId
    );
  return constraint.entityId === entityId;
}
