import { useEffect, useState } from "react";
import type {
  CadOp,
  CadParameterSnapshot,
  SketchConstraintEntry,
  SketchDimensionEntryCurrent,
  PreparedSketchCurveEditOp,
  SketchCurveEditProposal,
  SketchCurveEditReadinessQueryResponse,
  SketchProfileRegionCandidate,
  SketchProfileRegionCandidatesQuery,
  SketchProfileRegionValidateQueryResponse,
  SketchRegionsProfileRef,
  SketchEvaluationQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchPlane,
  SketchSolverStatusQueryResponse,
  SketchEntitySnapshot,
  SketchSnapshot,
  SketchAddRoundedRectangleOp,
  SketchAddSlotOp
} from "@web-cad/cad-protocol";
import type {
  SketchRegionCandidatesQueryResult,
  SketchRegionValidateQueryResult
} from "../../sketchRegionQueryClient";
import type { SketchCreateForm, SketchEntityForm } from "../../cadCommands";
import { useEscapeEditorContributor } from "../../actions/useEscapeEditorContributor";
import {
  entityToSketchEntityForm,
  getSketchEntityFormLabels,
  sketchEntityFormToEntity,
  validateSketchEntityForm
} from "../../sketchEntityForms";
import {
  createSketchEntityIntentSummary,
  formatSketchEvaluationStatus,
  formatSketchProfileValidity,
  formatSketchSolverStatus,
  getSketchEntityKindLabel,
  getSketchSolverStatusDisplay
} from "../../sketchPanelUi";
import {
  formatSketchEntityUsageLabel,
  getSketchEntityExtrudeUsages
} from "../../sketchEntityUsage";
import type { CadFeatureSummary } from "@web-cad/cad-protocol";
import type {
  UiActionAvailabilityProjection,
  UiActionId
} from "../../actions/actionRegistry";
import {
  SketchCurveEditPanel,
  type SketchCurveEditAsyncReadinessReader,
  type SketchCurveEditSessionControl
} from "./SketchCurveEditPanel";
import { SketchConveniencePanel } from "./SketchConveniencePanel";
import { SketchIntentEditor } from "./SketchIntentEditor";
import {
  SketchRegionSelectionPanel,
  type SketchRegionFeatureDraft
} from "./SketchRegionSelectionPanel";
import {
  CONSTRAINT_ACTION_KINDS,
  DIMENSION_ACTION_FAMILIES,
  dimensionEntryToDraftV19,
  dimensionTargetEntityIdsV19,
  getRequestedConstraintKind,
  getRequestedDimensionFamily,
  getConstraintCreationAvailabilityV19,
  getDimensionCreationAvailabilityV19
} from "./sketchIntentEditorModel";
import type { SketchConvenienceKind } from "./sketchConvenienceModel";
import type {
  SketchCurveEditKind,
  SketchCurveEditViewportChoice
} from "./sketchCurveEditModel";
import type { SketchRegionConsumerIntent } from "./sketchRegionSelectionModel";
import { useProgressiveSketchAnalysis } from "../../progressiveSketchAnalysisContext";
import { NumericInput } from "../../ui/NumericInput";
import {
  canNavigateSketchDockSectionV19,
  createEntityDraft,
  resolveActiveSketch,
  resolveSelectedSketchEntity,
  type SketchCreateEntityKind
} from "./sketchModeModel";
import "./sketchMode.css";

const ENTITY_WINDOW_SIZE = 12;

export interface SketchModeDockProps {
  readonly disabled: boolean;
  readonly sketches: readonly SketchSnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly features?: readonly CadFeatureSummary[];
  readonly dimensionsBySketchId: ReadonlyMap<
    string,
    readonly SketchDimensionEntryCurrent[]
  >;
  readonly units?: string;
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
  readonly curveEditSourceAuthorityKey: string | number;
  readonly arcToolActiveSketchId?: string;
  readonly initialActionId?: UiActionId;
  readonly curveEditViewportChoice?: SketchCurveEditViewportChoice;
  readonly curveEditViewportHoverChoice?: SketchCurveEditViewportChoice;
  readonly curveEditKeyboardSuspended?: boolean;
  readonly regionCandidates?: readonly SketchProfileRegionCandidate[];
  readonly selectedRegionCandidateKeys?: readonly string[];
  readonly hoveredRegionCandidateKey?: string;
  readonly regionConsumer?: SketchRegionConsumerIntent;
  readonly regionTargetBodies?: readonly {
    readonly id: string;
    readonly label: string;
  }[];
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
  readonly onReadCurveEditReadiness?: (
    proposal: SketchCurveEditProposal
  ) => SketchCurveEditReadinessQueryResponse;
  readonly onReadCurveEditReadinessAsync?: SketchCurveEditAsyncReadinessReader;
  readonly onApplyCurveEdit: (
    operation: PreparedSketchCurveEditOp
  ) => boolean | Promise<boolean>;
  readonly onApplySketchConvenience: (
    operation: SketchAddSlotOp | SketchAddRoundedRectangleOp
  ) => boolean | Promise<boolean>;
  readonly onQueryRegionCandidates?: (
    query: SketchProfileRegionCandidatesQuery,
    signal: AbortSignal
  ) => Promise<SketchRegionCandidatesQueryResult>;
  readonly onValidateRegionProfile?: (
    profile: SketchRegionsProfileRef,
    signal: AbortSignal
  ) => Promise<SketchRegionValidateQueryResult>;
  readonly onRegionCandidatesChange?: (
    candidates: readonly SketchProfileRegionCandidate[]
  ) => void;
  readonly onToggleRegionCandidate?: (candidateKey: string) => void;
  readonly onHoverRegionCandidate?: (candidateKey: string | undefined) => void;
  readonly onRegionConsumerChange?: (
    consumer: SketchRegionConsumerIntent
  ) => void;
  readonly onApplyRegionSelectionReady?: (
    profile: SketchRegionsProfileRef,
    response: SketchProfileRegionValidateQueryResponse,
    featureDraft: SketchRegionFeatureDraft
  ) => boolean | Promise<boolean>;
  readonly onCancelCurveEdit: (restoreFocus?: boolean) => void;
  readonly onRequestCurveEditEscape?: (dirty: boolean) => void;
  readonly onCurveEditChoiceRejected?: (message: string) => void;
  readonly onClearCurveEditHoverPreview?: () => void;
  readonly onCurveEditDirtyChange?: (dirty: boolean) => void;
  readonly onCurveEditSessionControlChange?: (
    control: SketchCurveEditSessionControl | undefined
  ) => void;
  readonly onApplySketchIntentOps: (
    ops: readonly CadOp[]
  ) => boolean | Promise<boolean>;
  readonly onIntentActionAvailabilityChange?: (
    availability: UiActionAvailabilityProjection
  ) => void;
  readonly onFinish: () => void;
}

type DockSection = "geometry" | "constraints" | "status";

const EMPTY_DIMENSIONS: readonly SketchDimensionEntryCurrent[] = [];
const EMPTY_CONSTRAINTS: readonly SketchConstraintEntry[] = [];
export type EntityDraft = {
  readonly mode: "create" | "edit";
  readonly kind: SketchEntitySnapshot["kind"];
  readonly entityId?: string;
  readonly form: SketchEntityForm;
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

function createSketchIntentAvailabilityProjectionV19(
  sketch: SketchSnapshot | undefined,
  selectedEntityId: string | undefined,
  dimensions: readonly SketchDimensionEntryCurrent[],
  constraints: readonly SketchConstraintEntry[]
): UiActionAvailabilityProjection {
  if (!sketch) return {};
  return Object.fromEntries([
    ...DIMENSION_ACTION_FAMILIES.map(([actionId, family]) => [
      actionId,
      getDimensionCreationAvailabilityV19(
        family,
        sketch.entities,
        selectedEntityId,
        dimensions
      )
    ]),
    ...CONSTRAINT_ACTION_KINDS.map(([actionId, kind]) => [
      actionId,
      getConstraintCreationAvailabilityV19(
        kind,
        sketch.entities,
        selectedEntityId,
        constraints
      )
    ])
  ]) as UiActionAvailabilityProjection;
}

export function SketchModeDock(props: SketchModeDockProps) {
  const {
    disabled,
    sketches,
    parameters,
    units = "mm",
    features = [],
    dimensionsBySketchId,
    evaluationsBySketchId,
    solverStatusesBySketchId,
    pathCandidatesBySketchId,
    activeSketchId,
    selectedEntityId,
    curveEditSourceAuthorityKey,
    arcToolActiveSketchId,
    initialActionId,
    curveEditViewportChoice,
    curveEditViewportHoverChoice,
    curveEditKeyboardSuspended,
    regionCandidates = [],
    selectedRegionCandidateKeys = [],
    hoveredRegionCandidateKey,
    regionConsumer = "extrude-new-body",
    regionTargetBodies = [],
    onSelectSketch,
    onSelectEntity,
    onCreateSketch,
    onAddEntity,
    onUpdateEntity,
    onDeleteEntity,
    onSetEntityConstruction,
    onStartThreePointArcTool,
    onCancelGesture,
    onReadCurveEditReadiness,
    onReadCurveEditReadinessAsync,
    onApplyCurveEdit,
    onApplySketchConvenience,
    onQueryRegionCandidates,
    onValidateRegionProfile,
    onRegionCandidatesChange,
    onToggleRegionCandidate,
    onHoverRegionCandidate,
    onRegionConsumerChange,
    onApplyRegionSelectionReady,
    onCancelCurveEdit,
    onRequestCurveEditEscape,
    onCurveEditChoiceRejected,
    onClearCurveEditHoverPreview,
    onCurveEditDirtyChange,
    onCurveEditSessionControlChange,
    onApplySketchIntentOps,
    onIntentActionAvailabilityChange,
    onFinish
  } = props;
  const activeSketch = resolveActiveSketch(sketches, activeSketchId);
  const selectedEntity = resolveSelectedSketchEntity(
    activeSketch,
    selectedEntityId
  );
  const dimensions = activeSketch
    ? (dimensionsBySketchId.get(activeSketch.id) ?? EMPTY_DIMENSIONS)
    : EMPTY_DIMENSIONS;
  const evaluation = activeSketch
    ? evaluationsBySketchId.get(activeSketch.id)
    : undefined;
  const constraints = evaluation?.constraints ?? EMPTY_CONSTRAINTS;
  const solverStatus = activeSketch
    ? solverStatusesBySketchId.get(activeSketch.id)
    : undefined;
  const pathCandidates = activeSketch
    ? pathCandidatesBySketchId?.get(activeSketch.id)
    : undefined;
  const entityDimensions = selectedEntity
    ? dimensions.filter((item) =>
        dimensionTargetEntityIdsV19(
          dimensionEntryToDraftV19(item).target
        ).includes(selectedEntity.id)
      )
    : [];
  const entityConstraints = selectedEntity
    ? constraints.filter((item) =>
        constraintIncludesEntity(item, selectedEntity.id)
      )
    : [];
  const requestedEntityKind = getRequestedEntityKind(initialActionId);
  const requestedDimension = getRequestedDimensionFamily(initialActionId);
  const requestedConstraintKind = getRequestedConstraintKind(initialActionId);
  const requestedCurveEditKind = getRequestedCurveEditKind(initialActionId);
  const requestedConvenienceKind = getRequestedConvenienceKind(initialActionId);
  const requestedRegionSelection = initialActionId === "sketch.regions";
  useEffect(() => {
    onIntentActionAvailabilityChange?.(
      createSketchIntentAvailabilityProjectionV19(
        activeSketch,
        selectedEntityId,
        dimensions,
        constraints
      )
    );
    return () => onIntentActionAvailabilityChange?.({});
  }, [
    activeSketch,
    constraints,
    dimensions,
    onIntentActionAvailabilityChange,
    selectedEntityId
  ]);
  const [section, setSection] = useState<DockSection>(() =>
    requestedDimension || requestedConstraintKind ? "constraints" : "geometry"
  );
  const [intentSessionActive, setIntentSessionActive] = useState(
    () =>
      requestedDimension !== undefined || requestedConstraintKind !== undefined
  );
  const [constructionForNew, setConstructionForNew] = useState(false);
  const [entityDraft, setEntityDraft] = useState<EntityDraft | undefined>(() =>
    requestedEntityKind
      ? {
          mode: "create",
          kind: requestedEntityKind,
          form: createEntityDraft(false)
        }
      : undefined
  );
  const [createSketchDraft, setCreateSketchDraft] = useState<SketchCreateForm>(
    DEFAULT_CREATE_SKETCH
  );

  const curveEditPanelOpen = Boolean(
    requestedRegionSelection ||
    requestedCurveEditKind ||
    requestedConvenienceKind ||
    intentSessionActive
  );

  useEscapeEditorContributor({
    id: "sketch-mode-dock-entity-draft",
    suspended: Boolean(curveEditKeyboardSuspended) || curveEditPanelOpen,
    state: entityDraft ? "clean" : "none",
    onCancelClean: () => setEntityDraft(undefined),
    onRequestDirtyGuard: () => setEntityDraft(undefined)
  });

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
            disabled={
              !canNavigateSketchDockSectionV19(item, intentSessionActive)
            }
            onClick={() => {
              if (canNavigateSketchDockSectionV19(item, intentSessionActive))
                setSection(item);
            }}
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
        {requestedRegionSelection &&
        onQueryRegionCandidates &&
        onValidateRegionProfile &&
        onRegionCandidatesChange &&
        onToggleRegionCandidate &&
        onHoverRegionCandidate &&
        onRegionConsumerChange &&
        onApplyRegionSelectionReady ? (
          <SketchRegionSelectionPanel
            disabled={disabled}
            sketch={activeSketch}
            sourceAuthorityKey={curveEditSourceAuthorityKey}
            candidates={regionCandidates}
            selectedCandidateKeys={selectedRegionCandidateKeys}
            hoveredCandidateKey={hoveredRegionCandidateKey}
            consumer={regionConsumer}
            targetBodies={regionTargetBodies}
            keyboardSuspended={curveEditKeyboardSuspended}
            queryCandidates={onQueryRegionCandidates}
            validateProfile={onValidateRegionProfile}
            onCandidatesChange={onRegionCandidatesChange}
            onToggleCandidate={onToggleRegionCandidate}
            onHoverCandidate={onHoverRegionCandidate}
            onConsumerChange={onRegionConsumerChange}
            onApplyReady={onApplyRegionSelectionReady}
            onCancel={onCancelCurveEdit}
            onRequestEscape={onRequestCurveEditEscape}
            onDirtyChange={onCurveEditDirtyChange}
            onSessionControlChange={onCurveEditSessionControlChange}
          />
        ) : null}
        {requestedCurveEditKind ? (
          <SketchCurveEditPanel
            disabled={disabled}
            kind={requestedCurveEditKind}
            sketch={activeSketch}
            selectedEntityId={selectedEntityId}
            sourceAuthorityKey={curveEditSourceAuthorityKey}
            viewportChoice={curveEditViewportChoice}
            viewportHoverChoice={curveEditViewportHoverChoice}
            keyboardSuspended={curveEditKeyboardSuspended}
            readReadiness={onReadCurveEditReadiness}
            readReadinessAsync={onReadCurveEditReadinessAsync}
            onSelectEntity={(entityId) =>
              onSelectEntity(activeSketch.id, entityId)
            }
            onApply={onApplyCurveEdit}
            onCancel={onCancelCurveEdit}
            onRequestEscape={onRequestCurveEditEscape}
            onChoiceRejected={onCurveEditChoiceRejected}
            onClearHoverPreview={onClearCurveEditHoverPreview}
            onDirtyChange={onCurveEditDirtyChange}
            onSessionControlChange={onCurveEditSessionControlChange}
          />
        ) : null}
        {requestedConvenienceKind ? (
          <SketchConveniencePanel
            disabled={disabled}
            kind={requestedConvenienceKind}
            sketchId={activeSketch.id}
            keyboardSuspended={curveEditKeyboardSuspended}
            onApply={onApplySketchConvenience}
            onCancel={onCancelCurveEdit}
            onRequestEscape={onRequestCurveEditEscape}
            onDirtyChange={onCurveEditDirtyChange}
            onSessionControlChange={onCurveEditSessionControlChange}
          />
        ) : null}
        {!requestedRegionSelection &&
        !requestedCurveEditKind &&
        !requestedConvenienceKind &&
        section === "geometry" ? (
          <GeometrySection
            disabled={disabled || requestedCurveEditKind !== undefined}
            sketch={activeSketch}
            selectedEntity={selectedEntity}
            dimensions={entityDimensions}
            constraints={entityConstraints}
            features={features}
            arcActive={arcToolActiveSketchId === activeSketch.id}
            constructionForNew={constructionForNew}
            repeatCreateKind={requestedEntityKind}
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
        {!requestedRegionSelection &&
        !requestedCurveEditKind &&
        !requestedConvenienceKind &&
        section === "constraints" ? (
          <SketchIntentEditor
            disabled={disabled || requestedCurveEditKind !== undefined}
            sketch={activeSketch}
            selectedEntityId={selectedEntity?.id}
            parameters={parameters}
            dimensions={dimensions}
            constraints={constraints}
            units={units}
            initialDimensionFamily={requestedDimension}
            initialConstraintKind={requestedConstraintKind}
            keyboardSuspended={curveEditKeyboardSuspended}
            onApplyOps={onApplySketchIntentOps}
            onCancel={onCancelCurveEdit}
            onRequestEscape={onRequestCurveEditEscape}
            onDirtyChange={onCurveEditDirtyChange}
            onSessionActiveChange={setIntentSessionActive}
            onSessionControlChange={onCurveEditSessionControlChange}
          />
        ) : null}
        {!requestedRegionSelection &&
        !requestedCurveEditKind &&
        !requestedConvenienceKind &&
        section === "status" ? (
          <ProgressiveStatusSection
            sketchId={activeSketch.id}
            fallbackEvaluation={evaluation}
            fallbackSolverStatus={solverStatus}
            fallbackPathCandidates={pathCandidates}
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

function getRequestedCurveEditKind(
  actionId: UiActionId | undefined
): SketchCurveEditKind | undefined {
  switch (actionId) {
    case "sketch.trim":
      return "trim";
    case "sketch.extend":
      return "extend";
    case "sketch.split":
      return "split";
    case "sketch.explode-rectangle":
      return "explodeRectangle";
    case "sketch.offset":
      return "offset";
    default:
      return undefined;
  }
}

function getRequestedConvenienceKind(
  actionId: UiActionId | undefined
): SketchConvenienceKind | undefined {
  switch (actionId) {
    case "sketch.slot":
      return "slot";
    case "sketch.rounded-rectangle":
      return "roundedRectangle";
    default:
      return undefined;
  }
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

function GeometrySection({
  disabled,
  sketch,
  selectedEntity,
  dimensions,
  constraints,
  features,
  arcActive,
  constructionForNew,
  repeatCreateKind,
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
  readonly dimensions: readonly SketchDimensionEntryCurrent[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly features: readonly CadFeatureSummary[];
  readonly arcActive: boolean;
  readonly constructionForNew: boolean;
  readonly repeatCreateKind: SketchCreateEntityKind | undefined;
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
  const selectedEntityIndex = selectedEntity
    ? sketch.entities.findIndex((entity) => entity.id === selectedEntity.id)
    : -1;
  const selectedEntityWindowStart =
    selectedEntityIndex >= 0
      ? Math.floor(selectedEntityIndex / ENTITY_WINDOW_SIZE) *
        ENTITY_WINDOW_SIZE
      : 0;
  const entityWindowAuthorityKey = `${sketch.id}\u0000${
    selectedEntity?.id ?? ""
  }`;
  const [entityWindow, setEntityWindow] = useState(() => ({
    authorityKey: entityWindowAuthorityKey,
    start: selectedEntityWindowStart
  }));
  const entityWindowStart =
    entityWindow.authorityKey === entityWindowAuthorityKey
      ? entityWindow.start
      : selectedEntityWindowStart;
  function updateEntityWindowStart(update: (current: number) => number) {
    setEntityWindow({
      authorityKey: entityWindowAuthorityKey,
      start: update(entityWindowStart)
    });
  }
  const visibleEntities = sketch.entities.slice(
    entityWindowStart,
    entityWindowStart + ENTITY_WINDOW_SIZE
  );
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
    onDraftChange(
      nextEntityDraftAfterApply(draft, repeatCreateKind, constructionForNew)
    );
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
                  form: createEntityDraft(constructionForNew)
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
            data-total-entity-count={sketch.entities.length}
          >
            {visibleEntities.map((entity) => (
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
        {sketch.entities.length > ENTITY_WINDOW_SIZE ? (
          <div
            className="pb-sketch-list-window"
            aria-label="Sketch entity rows"
          >
            <button
              type="button"
              className="pb-button"
              disabled={entityWindowStart === 0}
              onClick={() =>
                updateEntityWindowStart((current) =>
                  Math.max(0, current - ENTITY_WINDOW_SIZE)
                )
              }
            >
              Previous
            </button>
            <span>
              {entityWindowStart + 1}–
              {Math.min(
                entityWindowStart + ENTITY_WINDOW_SIZE,
                sketch.entities.length
              )}{" "}
              of {sketch.entities.length}
            </span>
            <button
              type="button"
              className="pb-button"
              disabled={
                entityWindowStart + ENTITY_WINDOW_SIZE >= sketch.entities.length
              }
              onClick={() =>
                updateEntityWindowStart((current) =>
                  Math.min(
                    Math.floor(
                      (sketch.entities.length - 1) / ENTITY_WINDOW_SIZE
                    ) * ENTITY_WINDOW_SIZE,
                    current + ENTITY_WINDOW_SIZE
                  )
                )
              }
            >
              Next
            </button>
          </div>
        ) : null}
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

export function nextEntityDraftAfterApply(
  draft: EntityDraft,
  repeatCreateKind: SketchCreateEntityKind | undefined,
  construction: boolean
): EntityDraft | undefined {
  return draft.mode === "create" && repeatCreateKind === draft.kind
    ? {
        mode: "create",
        kind: draft.kind,
        form: createEntityDraft(construction)
      }
    : undefined;
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

function ProgressiveStatusSection({
  sketchId,
  fallbackEvaluation,
  fallbackSolverStatus,
  fallbackPathCandidates
}: {
  readonly sketchId: string;
  readonly fallbackEvaluation: SketchEvaluationQueryResponse | undefined;
  readonly fallbackSolverStatus: SketchSolverStatusQueryResponse | undefined;
  readonly fallbackPathCandidates:
    | SketchPathCandidatesQueryResponse
    | undefined;
}) {
  const analysis = useProgressiveSketchAnalysis();
  return (
    <StatusSection
      evaluation={
        analysis.evaluationsBySketchId.get(sketchId) ?? fallbackEvaluation
      }
      solverStatus={
        analysis.solverStatusesBySketchId.get(sketchId) ?? fallbackSolverStatus
      }
      pathCandidates={
        analysis.pathCandidatesBySketchId.get(sketchId) ??
        fallbackPathCandidates
      }
    />
  );
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
      <NumericInput
        className="pb-field pb-numeric"
        step="0.1"
        value={value}
        disabled={disabled}
        onValueChange={onChange}
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
