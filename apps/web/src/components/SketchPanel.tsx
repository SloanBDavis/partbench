import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CadParameterSnapshot,
  CadFeatureSummary,
  SketchConstraintEntry,
  SketchConstraintKind,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchEvaluationQueryResponse,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchPlane,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type {
  FeatureExtrudeForm,
  ParameterCreateForm,
  ParameterEditForm,
  SketchConstraintForm,
  SketchDimensionForm,
  SketchCreateForm,
  SketchEntityForm
} from "../cadCommands";
import {
  formatSketchEntityUsageLabel,
  getSketchEntityExtrudeUsages
} from "../sketchEntityUsage";
import { formatSketchAttachmentLabel } from "../generatedReferenceUi";
import type { SketchDisplayStatus } from "../sketchDisplayFrames";
import {
  chooseSketchEntitySelection,
  chooseSketchPanelSelection,
  createAvailableSketchConstraintKindOptions,
  createAvailableSketchDimensionTargetOptions,
  formatSketchDimensionEffectiveValue,
  getAddOperationStatus,
  getCutOperationStatus,
  getDefaultSketchEntityKind,
  createParameterBindingOptions,
  formatSketchEvaluationIssue,
  formatSketchEvaluationStatus,
  formatSketchConstraintStatus,
  formatSketchDimensionStatus,
  formatSketchDimensionValueSource,
  getSketchConstraintKindLabel,
  getSketchConstraintStatusDisplay,
  getSketchDimensionStatusDisplay,
  getSketchEvaluationStatusDisplay,
  getParameterDimensionUsageCount,
  getSketchDimensionTargetLabel,
  getSketchEntityOptionLabel,
  isExtrudableSketchEntity,
  sketchDimensionTargetsEqual,
  type BooleanTargetBodyOption
} from "../sketchPanelUi";
import {
  defaultSketchEntityForm,
  entityToSketchEntityForm,
  formatSketchEntity,
  getSketchEntityFormLabels,
  sketchEntityFormToEntity,
  validateSketchEntityForm
} from "../sketchEntityForms";

type OrientationSketchConstraintKind = Extract<
  SketchConstraintKind,
  "horizontal" | "vertical"
>;

export interface SketchPanelProps {
  readonly disabled: boolean;
  readonly sketches: readonly SketchSnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly sketchDimensionsBySketchId: ReadonlyMap<
    string,
    readonly SketchDimensionEntry[]
  >;
  readonly sketchEvaluationsBySketchId: ReadonlyMap<
    string,
    SketchEvaluationQueryResponse
  >;
  readonly displayStatuses?: ReadonlyMap<string, SketchDisplayStatus>;
  readonly addTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly cutTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly focusedSketchId?: string;
  readonly features: readonly CadFeatureSummary[];
  readonly onCreateSketch: (form: SketchCreateForm) => void;
  readonly onCreateParameter: (form: ParameterCreateForm) => void;
  readonly onApplyParameterEdit: (
    parameter: CadParameterSnapshot,
    form: ParameterEditForm
  ) => void;
  readonly onDeleteParameter: (parameterId: string) => void;
  readonly onRenameSketch: (sketchId: string, name: string) => void;
  readonly onDeleteSketch: (sketchId: string) => void;
  readonly onAddEntity: (
    sketchId: string,
    kind: SketchEntityKind,
    form: SketchEntityForm
  ) => void;
  readonly onUpdateEntity: (
    sketchId: string,
    entity: SketchEntitySnapshot
  ) => void;
  readonly onDeleteEntity: (sketchId: string, entityId: string) => void;
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
  readonly onExtrudeEntity: (
    sketchId: string,
    entityId: string,
    form: FeatureExtrudeForm
  ) => void;
}

const defaultCreateForm: SketchCreateForm = {
  id: "",
  name: "Sketch 1",
  plane: "XY"
};

const defaultParameterCreateForm: ParameterCreateForm = {
  id: "",
  name: "Length",
  value: 10,
  description: ""
};

const defaultSketchDimensionForm: SketchDimensionForm = {
  id: "",
  name: "Dimension",
  valueSourceType: "literal",
  value: 1,
  parameterId: ""
};

const defaultSketchConstraintForm: SketchConstraintForm = {
  id: "",
  name: "Horizontal",
  kind: "horizontal"
};

const defaultExtrudeForm: FeatureExtrudeForm = {
  id: "",
  bodyId: "",
  name: "",
  depth: 1,
  side: "positive",
  operationMode: "newBody"
};

export function SketchPanel({
  disabled,
  sketches,
  parameters,
  sketchDimensionsBySketchId,
  sketchEvaluationsBySketchId,
  addTargetBodies = [],
  cutTargetBodies = [],
  displayStatuses,
  focusedSketchId,
  features,
  onCreateSketch,
  onCreateParameter,
  onApplyParameterEdit,
  onDeleteParameter,
  onRenameSketch,
  onDeleteSketch,
  onAddEntity,
  onUpdateEntity,
  onDeleteEntity,
  onCreateDimension,
  onApplyDimensionEdit,
  onDeleteDimension,
  onCreateConstraint,
  onApplyConstraintEdit,
  onDeleteConstraint,
  onExtrudeEntity
}: SketchPanelProps) {
  const [selectedSketchId, setSelectedSketchId] = useState<string | undefined>(
    sketches[0]?.id
  );
  const [selectedEntityId, setSelectedEntityId] = useState<
    SketchEntityId | undefined
  >();
  const [createForm, setCreateForm] =
    useState<SketchCreateForm>(defaultCreateForm);
  const [parameterCreateForm, setParameterCreateForm] =
    useState<ParameterCreateForm>(defaultParameterCreateForm);
  const [selectedParameterId, setSelectedParameterId] = useState<
    string | undefined
  >(parameters[0]?.id);
  const [parameterEditDraft, setParameterEditDraft] = useState<
    | {
        readonly parameterId: string;
        readonly form: ParameterEditForm;
      }
    | undefined
  >();
  const [entityForm, setEntityForm] = useState<SketchEntityForm>(
    defaultSketchEntityForm
  );
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const pendingEntitySelection = useRef<
    | {
        readonly sketchId: string;
        readonly previousCount: number;
      }
    | undefined
  >(undefined);
  const [entityKind, setEntityKind] = useState<SketchEntityKind>(() =>
    getDefaultSketchEntityKind(
      sketches.find((sketch) => sketch.id === focusedSketchId) ?? sketches[0]
    )
  );
  const effectiveSelectedSketchId = chooseSketchPanelSelection(
    sketches,
    selectedSketchId,
    focusedSketchId
  );
  const selectedSketch = useMemo(
    () => sketches.find((sketch) => sketch.id === effectiveSelectedSketchId),
    [effectiveSelectedSketchId, sketches]
  );
  const selectedSketchDisplayStatus = selectedSketch
    ? displayStatuses?.get(selectedSketch.id)
    : undefined;
  const selectedSketchEvaluation = selectedSketch
    ? sketchEvaluationsBySketchId.get(selectedSketch.id)
    : undefined;
  const selectedSketchDimensions = useMemo(() => {
    if (!selectedSketch) {
      return [];
    }

    return (
      selectedSketchEvaluation?.dimensions ??
      sketchDimensionsBySketchId.get(selectedSketch.id) ??
      []
    );
  }, [selectedSketch, selectedSketchEvaluation, sketchDimensionsBySketchId]);
  const effectiveSelectedEntityId = chooseSketchEntitySelection(
    selectedSketch?.entities ?? [],
    selectedEntityId
  );
  const selectedEntity = selectedSketch?.entities.find(
    (entity) => entity.id === effectiveSelectedEntityId
  );
  const selectedEntityDimensions = useMemo(
    () =>
      selectedEntity
        ? selectedSketchDimensions.filter(
            (dimension) => dimension.entityId === selectedEntity.id
          )
        : [],
    [selectedEntity, selectedSketchDimensions]
  );
  const selectedSketchConstraints = useMemo(
    () => selectedSketchEvaluation?.constraints ?? [],
    [selectedSketchEvaluation]
  );
  const selectedEntityConstraints = useMemo(
    () =>
      selectedEntity
        ? selectedSketchConstraints.filter(
            (constraint) =>
              constraint.entityId === selectedEntity.id &&
              (constraint.kind === "horizontal" ||
                constraint.kind === "vertical")
          )
        : [],
    [selectedEntity, selectedSketchConstraints]
  );
  const parameterBindingOptions = createParameterBindingOptions(parameters);
  const parameterUsageCounts = useMemo(
    () =>
      new Map(
        parameters.map((parameter) => [
          parameter.id,
          getParameterDimensionUsageCount(
            parameter.id,
            [...sketchDimensionsBySketchId.values()].flat()
          )
        ])
      ),
    [parameters, sketchDimensionsBySketchId]
  );
  const selectedParameter =
    parameters.find((parameter) => parameter.id === selectedParameterId) ??
    parameters[0];
  const parameterEditForm =
    selectedParameter &&
    parameterEditDraft?.parameterId === selectedParameter.id
      ? parameterEditDraft.form
      : parameterToEditForm(selectedParameter);
  const availableDimensionTargets = useMemo(
    () =>
      createAvailableSketchDimensionTargetOptions(
        selectedEntity,
        selectedEntityDimensions
      ),
    [selectedEntity, selectedEntityDimensions]
  );
  const [dimensionCreateTarget, setDimensionCreateTarget] = useState<
    SketchDimensionTarget | undefined
  >();
  const [dimensionCreateForm, setDimensionCreateForm] =
    useState<SketchDimensionForm>(defaultSketchDimensionForm);
  const [selectedDimensionId, setSelectedDimensionId] = useState<
    string | undefined
  >();
  const selectedDimension =
    selectedEntityDimensions.find(
      (dimension) => dimension.id === selectedDimensionId
    ) ?? selectedEntityDimensions[0];
  const [dimensionEditDraft, setDimensionEditDraft] = useState<
    | {
        readonly dimensionId: string;
        readonly form: SketchDimensionForm;
      }
    | undefined
  >();
  const selectedCreateTargetOption =
    availableDimensionTargets.find((option) =>
      sketchDimensionTargetsEqual(option.target, dimensionCreateTarget)
    ) ?? availableDimensionTargets[0];
  const effectiveDimensionCreateTarget = selectedCreateTargetOption?.target;
  const effectiveDimensionCreateForm: SketchDimensionForm = {
    ...dimensionCreateForm,
    name:
      dimensionCreateTarget && selectedCreateTargetOption
        ? dimensionCreateForm.name
        : (selectedCreateTargetOption?.label ?? "Dimension"),
    value:
      dimensionCreateTarget && selectedCreateTargetOption
        ? dimensionCreateForm.value
        : (selectedCreateTargetOption?.currentValue ?? 1),
    parameterId:
      dimensionCreateForm.parameterId &&
      parameters.some((item) => item.id === dimensionCreateForm.parameterId)
        ? dimensionCreateForm.parameterId
        : (parameters[0]?.id ?? "")
  };
  const dimensionEditForm =
    selectedDimension &&
    dimensionEditDraft?.dimensionId === selectedDimension.id
      ? dimensionEditDraft.form
      : sketchDimensionToForm(selectedDimension);
  const availableConstraintKinds = useMemo(
    () =>
      createAvailableSketchConstraintKindOptions(
        selectedEntity,
        selectedEntityConstraints
      ),
    [selectedEntity, selectedEntityConstraints]
  );
  const [constraintCreateForm, setConstraintCreateForm] =
    useState<SketchConstraintForm>(defaultSketchConstraintForm);
  const [selectedConstraintId, setSelectedConstraintId] = useState<
    string | undefined
  >();
  const selectedConstraint =
    selectedEntityConstraints.find(
      (constraint) => constraint.id === selectedConstraintId
    ) ?? selectedEntityConstraints[0];
  const [constraintEditDraft, setConstraintEditDraft] = useState<
    | {
        readonly constraintId: string;
        readonly form: SketchConstraintForm;
      }
    | undefined
  >();
  const selectedCreateConstraintKind =
    availableConstraintKinds.find(
      (option) => option.kind === constraintCreateForm.kind
    )?.kind ?? availableConstraintKinds[0]?.kind;
  const effectiveConstraintCreateForm: SketchConstraintForm = {
    ...constraintCreateForm,
    kind: selectedCreateConstraintKind ?? constraintCreateForm.kind,
    name:
      selectedCreateConstraintKind &&
      constraintCreateForm.kind === selectedCreateConstraintKind
        ? constraintCreateForm.name
        : selectedCreateConstraintKind
          ? getSketchConstraintKindLabel(selectedCreateConstraintKind)
          : constraintCreateForm.name
  };
  const constraintEditForm =
    selectedConstraint &&
    constraintEditDraft?.constraintId === selectedConstraint.id
      ? constraintEditDraft.form
      : sketchConstraintToForm(selectedConstraint);
  const selectedEntityUsages =
    selectedSketch && selectedEntity
      ? getSketchEntityExtrudeUsages(
          features,
          selectedSketch.id,
          selectedEntity.id
        )
      : [];
  const selectedEntityUsageLabel =
    formatSketchEntityUsageLabel(selectedEntityUsages);
  const [editingEntityId, setEditingEntityId] = useState<string | undefined>();
  const editingEntity = selectedSketch?.entities.find(
    (entity) => entity.id === editingEntityId
  );
  const editingEntityUsages =
    selectedSketch && editingEntity
      ? getSketchEntityExtrudeUsages(
          features,
          selectedSketch.id,
          editingEntity.id
        )
      : [];
  const entityFormValidation = validateSketchEntityForm(entityKind, entityForm);
  const [renameDraft, setRenameDraft] = useState<{
    readonly sketchId: string;
    readonly name: string;
  }>();
  const renameValue =
    selectedSketch && renameDraft?.sketchId === selectedSketch.id
      ? renameDraft.name
      : (selectedSketch?.name ?? "");
  const [extrudeForm, setExtrudeForm] =
    useState<FeatureExtrudeForm>(defaultExtrudeForm);
  const selectedExtrudeEntity = isExtrudableSketchEntity(selectedEntity)
    ? selectedEntity
    : undefined;
  const addStatus = getAddOperationStatus(
    selectedExtrudeEntity,
    addTargetBodies
  );
  const cutStatus = getCutOperationStatus(
    selectedExtrudeEntity,
    cutTargetBodies
  );
  const canCreateAdd = addStatus.available;
  const canCreateCut = cutStatus.available;
  const activeTargetBodies =
    extrudeForm.operationMode === "add" ? addTargetBodies : cutTargetBodies;
  const selectedBooleanTarget = activeTargetBodies.find(
    (body) => body.bodyId === extrudeForm.targetBodyId
  );
  const booleanStatus =
    extrudeForm.operationMode === "add" ? addStatus : cutStatus;
  const canCreateBoolean =
    extrudeForm.operationMode === "add" ? canCreateAdd : canCreateCut;
  const shouldShowEntityEditor =
    Boolean(editingEntityId) ||
    isAddingEntity ||
    selectedSketch?.entities.length === 0;
  const shouldShowInlineAddEntityEditor =
    isAddingEntity && !editingEntityId && selectedSketch?.entities.length !== 0;
  const shouldShowStandaloneEntityEditor =
    Boolean(editingEntityId) || selectedSketch?.entities.length === 0;

  useEffect(() => {
    const pending = pendingEntitySelection.current;

    if (!pending || !selectedSketch || selectedSketch.id !== pending.sketchId) {
      return;
    }

    if (selectedSketch.entities.length > pending.previousCount) {
      setSelectedEntityId(
        selectedSketch.entities[selectedSketch.entities.length - 1]?.id
      );
      pendingEntitySelection.current = undefined;
    }
  }, [selectedSketch]);

  function editEntity(entity: SketchEntitySnapshot) {
    setSelectedEntityId(entity.id);
    setEditingEntityId(entity.id);
    setIsAddingEntity(false);
    setEntityKind(entity.kind);
    setEntityForm(entityToSketchEntityForm(entity));
  }

  function addEntity() {
    setEditingEntityId(undefined);
    setIsAddingEntity(true);
    setEntityKind(getDefaultSketchEntityKind(selectedSketch));
    setEntityForm(defaultSketchEntityForm);
  }

  function saveEntity() {
    if (!selectedSketch) {
      return;
    }

    if (!entityFormValidation.ok) {
      return;
    }

    if (editingEntityId) {
      onUpdateEntity(
        selectedSketch.id,
        sketchEntityFormToEntity(editingEntityId, entityKind, entityForm)
      );
      setEditingEntityId(undefined);
      return;
    }

    pendingEntitySelection.current = {
      sketchId: selectedSketch.id,
      previousCount: selectedSketch.entities.length
    };
    onAddEntity(selectedSketch.id, entityKind, entityForm);
    setIsAddingEntity(false);
  }

  function createDimension() {
    if (!selectedSketch || !selectedEntity || !effectiveDimensionCreateTarget) {
      return;
    }

    onCreateDimension(
      selectedSketch.id,
      selectedEntity.id,
      effectiveDimensionCreateTarget,
      effectiveDimensionCreateForm
    );
  }

  function createConstraint() {
    if (!selectedSketch || !selectedEntity || !selectedCreateConstraintKind) {
      return;
    }

    onCreateConstraint(
      selectedSketch.id,
      selectedEntity.id,
      effectiveConstraintCreateForm
    );
  }

  function applyParameterEdit() {
    if (!selectedParameter) {
      return;
    }

    onApplyParameterEdit(selectedParameter, parameterEditForm);
  }

  function applyDimensionEdit() {
    if (!selectedDimension) {
      return;
    }

    onApplyDimensionEdit(selectedDimension, dimensionEditForm);
  }

  function applyConstraintEdit() {
    if (!selectedConstraint) {
      return;
    }

    onApplyConstraintEdit(selectedConstraint, constraintEditForm);
  }

  return (
    <section className="sketch-panel" aria-label="Sketches">
      <div className="section-heading">
        <h2>Sketches</h2>
        <span>{sketches.length}</span>
      </div>

      <details className="workflow-section" open={sketches.length === 0}>
        <summary>New sketch</summary>
        <div className="field-grid two">
          <label>
            Name
            <input
              type="text"
              value={createForm.name}
              disabled={disabled}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  name: event.currentTarget.value
                })
              }
            />
          </label>
          <label>
            Plane
            <select
              value={createForm.plane}
              disabled={disabled}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  plane: event.currentTarget.value as SketchPlane
                })
              }
            >
              <option value="XY">XY</option>
              <option value="XZ">XZ</option>
              <option value="YZ">YZ</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCreateSketch(createForm)}
          >
            Create sketch
          </button>
        </div>
        <details className="advanced-options">
          <summary>Advanced sketch options</summary>
          <label>
            Optional ID
            <input
              type="text"
              value={createForm.id}
              disabled={disabled}
              onChange={(event) =>
                setCreateForm({ ...createForm, id: event.currentTarget.value })
              }
            />
          </label>
        </details>
      </details>

      <ParameterControls
        disabled={disabled}
        parameters={parameters}
        selectedParameter={selectedParameter}
        selectedParameterId={selectedParameter?.id}
        createForm={parameterCreateForm}
        editForm={parameterEditForm}
        usageCounts={parameterUsageCounts}
        onCreateFormChange={setParameterCreateForm}
        onEditFormChange={(form) =>
          selectedParameter &&
          setParameterEditDraft({ parameterId: selectedParameter.id, form })
        }
        onSelectParameter={(parameterId) => {
          setSelectedParameterId(parameterId);
          setParameterEditDraft(undefined);
        }}
        onCreateParameter={() => onCreateParameter(parameterCreateForm)}
        onApplyParameterEdit={applyParameterEdit}
        onDeleteParameter={onDeleteParameter}
      />

      {sketches.length === 0 ? (
        <p className="empty-state compact">No sketches</p>
      ) : (
        <div className="sketch-layout">
          <label>
            Active sketch
            <select
              value={effectiveSelectedSketchId ?? ""}
              disabled={disabled}
              onChange={(event) => {
                const nextSketch = sketches.find(
                  (sketch) => sketch.id === event.currentTarget.value
                );

                setSelectedSketchId(event.currentTarget.value);
                setSelectedEntityId(undefined);
                setEditingEntityId(undefined);
                setIsAddingEntity(false);
                setEntityKind(getDefaultSketchEntityKind(nextSketch));
              }}
            >
              {sketches.map((sketch) => (
                <option key={sketch.id} value={sketch.id}>
                  {sketch.name} / {sketch.plane} / {sketch.entities.length}
                </option>
              ))}
            </select>
          </label>

          {selectedSketch && (
            <div className="sketch-detail">
              <div className="field-grid two">
                <label>
                  Name
                  <input
                    type="text"
                    value={renameValue}
                    disabled={disabled}
                    onChange={(event) =>
                      setRenameDraft({
                        sketchId: selectedSketch.id,
                        name: event.currentTarget.value
                      })
                    }
                  />
                </label>
                <div className="readonly-field">
                  <span>Plane</span>
                  <strong>{selectedSketch.plane}</strong>
                </div>
              </div>
              <details className="advanced-options compact">
                <summary>Sketch ID</summary>
                <code>{selectedSketch.id}</code>
              </details>
              <div className="button-row">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRenameSketch(selectedSketch.id, renameValue)}
                >
                  Save name
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={disabled}
                  onClick={() => onDeleteSketch(selectedSketch.id)}
                >
                  Delete sketch
                </button>
              </div>
              {selectedSketch.attachment && (
                <section
                  className="sketch-attachment"
                  aria-label="Sketch attachment"
                >
                  <div className="command-card-heading">
                    <h3>Attachment</h3>
                  </div>
                  <dl>
                    <div>
                      <dt>Face</dt>
                      <dd>
                        {formatSketchAttachmentLabel(selectedSketch.attachment)}
                      </dd>
                    </div>
                  </dl>
                  <details className="advanced-options compact">
                    <summary>Attachment IDs</summary>
                    <dl>
                      <div>
                        <dt>Stable ID</dt>
                        <dd>{selectedSketch.attachment.faceStableId}</dd>
                      </div>
                      <div>
                        <dt>Source feature</dt>
                        <dd>{selectedSketch.attachment.sourceFeatureId}</dd>
                      </div>
                    </dl>
                  </details>
                  {selectedSketchDisplayStatus?.kind === "attached" && (
                    <p className="project-message">
                      {selectedSketchDisplayStatus.message}
                    </p>
                  )}
                  {selectedSketchDisplayStatus?.kind === "unresolved" && (
                    <p className="error-text">
                      {selectedSketchDisplayStatus.message}
                    </p>
                  )}
                </section>
              )}

              <SketchEvaluationSummary evaluation={selectedSketchEvaluation} />

              {selectedSketch.entities.length > 0 && (
                <section className="entity-picker" aria-label="Sketch entities">
                  <div className="command-card-heading">
                    <h3>Selected entity</h3>
                    <span>{selectedSketch.entities.length}</span>
                  </div>
                  <div className="entity-picker-row">
                    <label>
                      Entity
                      <select
                        value={effectiveSelectedEntityId ?? ""}
                        disabled={disabled}
                        onChange={(event) => {
                          setSelectedEntityId(event.currentTarget.value);
                          setEditingEntityId(undefined);
                          setIsAddingEntity(false);
                        }}
                      >
                        {selectedSketch.entities.map((entity) => (
                          <option key={entity.id} value={entity.id}>
                            {getSketchEntityOptionLabel(entity)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={addEntity}
                    >
                      Add
                    </button>
                  </div>
                  {shouldShowInlineAddEntityEditor && (
                    <EntityEditor
                      disabled={disabled}
                      canCancel
                      editingEntityId={editingEntityId}
                      entityForm={entityForm}
                      entityKind={entityKind}
                      usageLabel={formatSketchEntityUsageLabel(
                        editingEntityUsages
                      )}
                      validation={entityFormValidation}
                      onCancelEdit={() => {
                        setEditingEntityId(undefined);
                        setIsAddingEntity(false);
                      }}
                      onEntityFormChange={setEntityForm}
                      onEntityKindChange={setEntityKind}
                      onSave={saveEntity}
                    />
                  )}
                  {selectedEntity && (
                    <div className="entity-summary">
                      <code>{selectedEntity.id}</code>
                      <span>{formatSketchEntity(selectedEntity)}</span>
                      {selectedEntityUsageLabel && (
                        <small className="entity-usage">
                          {selectedEntityUsageLabel}
                        </small>
                      )}
                      <div className="button-row compact">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => editEntity(selectedEntity)}
                        >
                          {selectedEntityUsageLabel ? "Edit source" : "Edit"}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={disabled}
                          onClick={() =>
                            onDeleteEntity(selectedSketch.id, selectedEntity.id)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedEntity && (
                    <SketchDimensionControls
                      disabled={disabled}
                      dimensions={selectedEntityDimensions}
                      availableTargets={availableDimensionTargets}
                      createTarget={effectiveDimensionCreateTarget}
                      createForm={effectiveDimensionCreateForm}
                      selectedDimension={selectedDimension}
                      selectedDimensionId={selectedDimension?.id}
                      editForm={dimensionEditForm}
                      parameterBindingOptions={parameterBindingOptions}
                      parameters={parameters}
                      onCreateTargetChange={setDimensionCreateTarget}
                      onCreateFormChange={(form) => {
                        if (
                          effectiveDimensionCreateTarget &&
                          !dimensionCreateTarget
                        ) {
                          setDimensionCreateTarget(
                            effectiveDimensionCreateTarget
                          );
                        }

                        setDimensionCreateForm(form);
                      }}
                      onSelectDimension={(dimensionId) => {
                        setSelectedDimensionId(dimensionId);
                        setDimensionEditDraft(undefined);
                      }}
                      onEditFormChange={(form) =>
                        selectedDimension &&
                        setDimensionEditDraft({
                          dimensionId: selectedDimension.id,
                          form
                        })
                      }
                      onCreateDimension={createDimension}
                      onApplyDimensionEdit={applyDimensionEdit}
                      onDeleteDimension={onDeleteDimension}
                    />
                  )}
                  {selectedEntity &&
                    (selectedEntity.kind === "line" ||
                      selectedEntityConstraints.length > 0) && (
                      <SketchConstraintControls
                        disabled={disabled}
                        constraints={selectedEntityConstraints}
                        availableKinds={availableConstraintKinds}
                        createForm={effectiveConstraintCreateForm}
                        selectedConstraint={selectedConstraint}
                        selectedConstraintId={selectedConstraint?.id}
                        editForm={constraintEditForm}
                        onCreateFormChange={setConstraintCreateForm}
                        onSelectConstraint={(constraintId) => {
                          setSelectedConstraintId(constraintId);
                          setConstraintEditDraft(undefined);
                        }}
                        onEditFormChange={(form) =>
                          selectedConstraint &&
                          setConstraintEditDraft({
                            constraintId: selectedConstraint.id,
                            form
                          })
                        }
                        onCreateConstraint={createConstraint}
                        onApplyConstraintEdit={applyConstraintEdit}
                        onDeleteConstraint={onDeleteConstraint}
                      />
                    )}
                </section>
              )}

              {shouldShowEntityEditor && shouldShowStandaloneEntityEditor && (
                <EntityEditor
                  disabled={disabled}
                  canCancel={selectedSketch.entities.length > 0}
                  editingEntityId={editingEntityId}
                  entityForm={entityForm}
                  entityKind={entityKind}
                  usageLabel={formatSketchEntityUsageLabel(editingEntityUsages)}
                  validation={entityFormValidation}
                  onCancelEdit={() => {
                    setEditingEntityId(undefined);
                    setIsAddingEntity(false);
                  }}
                  onEntityFormChange={setEntityForm}
                  onEntityKindChange={setEntityKind}
                  onSave={saveEntity}
                />
              )}

              {!shouldShowEntityEditor &&
                selectedSketch.entities.length === 0 && (
                  <p className="empty-state compact">No sketch entities</p>
                )}

              {selectedSketch.entities.length > 0 && (
                <section className="entity-editor" aria-label="Extrude feature">
                  <div className="command-card-heading">
                    <h3>Extrude selected entity</h3>
                  </div>
                  {selectedExtrudeEntity ? (
                    <>
                      <div className="readonly-field">
                        <span>Profile</span>
                        <strong>
                          {getSketchEntityOptionLabel(selectedExtrudeEntity)}
                        </strong>
                      </div>
                      <div className="field-grid two">
                        <NumberField
                          disabled={disabled}
                          label="Depth"
                          value={extrudeForm.depth}
                          onChange={(depth) =>
                            setExtrudeForm({ ...extrudeForm, depth })
                          }
                        />
                        <label>
                          Side
                          <select
                            value={extrudeForm.side}
                            disabled={disabled}
                            onChange={(event) =>
                              setExtrudeForm({
                                ...extrudeForm,
                                side: event.currentTarget
                                  .value as FeatureExtrudeForm["side"]
                              })
                            }
                          >
                            <option value="positive">Positive</option>
                            <option value="negative">Negative</option>
                            <option value="symmetric">Symmetric</option>
                          </select>
                        </label>
                      </div>
                      <div className="field-grid two">
                        <label>
                          Operation
                          <select
                            value={extrudeForm.operationMode}
                            disabled={disabled}
                            onChange={(event) => {
                              const operationMode = event.currentTarget
                                .value as FeatureExtrudeForm["operationMode"];

                              setExtrudeForm({
                                ...extrudeForm,
                                operationMode,
                                targetBodyId:
                                  operationMode === "add"
                                    ? addTargetBodies.some(
                                        (body) =>
                                          body.bodyId ===
                                          extrudeForm.targetBodyId
                                      )
                                      ? extrudeForm.targetBodyId
                                      : addTargetBodies[0]?.bodyId
                                    : operationMode === "cut"
                                      ? cutTargetBodies.some(
                                          (body) =>
                                            body.bodyId ===
                                            extrudeForm.targetBodyId
                                        )
                                        ? extrudeForm.targetBodyId
                                        : cutTargetBodies[0]?.bodyId
                                      : undefined
                              });
                            }}
                          >
                            <option value="newBody">New body</option>
                            <option value="add" disabled={!canCreateAdd}>
                              Add to body
                            </option>
                            <option value="cut" disabled={!canCreateCut}>
                              Cut body
                            </option>
                          </select>
                        </label>
                        {extrudeForm.operationMode === "add" ||
                        extrudeForm.operationMode === "cut" ? (
                          <label>
                            Target body
                            <select
                              value={extrudeForm.targetBodyId ?? ""}
                              disabled={disabled || !canCreateBoolean}
                              onChange={(event) =>
                                setExtrudeForm({
                                  ...extrudeForm,
                                  targetBodyId: event.currentTarget.value
                                })
                              }
                            >
                              {activeTargetBodies.map((body) => (
                                <option key={body.bodyId} value={body.bodyId}>
                                  {body.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <div className="readonly-field">
                            <span>Target</span>
                            <strong>Creates standalone body</strong>
                          </div>
                        )}
                      </div>
                      {(extrudeForm.operationMode === "add" ||
                        extrudeForm.operationMode === "cut") &&
                        selectedBooleanTarget && (
                          <div className="readonly-field">
                            <span>
                              {extrudeForm.operationMode === "add"
                                ? "Add target"
                                : "Cut target"}
                            </span>
                            <strong>{selectedBooleanTarget.detail}</strong>
                          </div>
                        )}
                      {((extrudeForm.operationMode === "add" &&
                        (!addStatus.available || selectedBooleanTarget)) ||
                        (extrudeForm.operationMode === "cut" &&
                          (!cutStatus.available || selectedBooleanTarget)) ||
                        (!addStatus.available && !cutStatus.available)) && (
                        <p className="project-message compact">
                          {extrudeForm.operationMode === "add" &&
                          selectedBooleanTarget
                            ? "Creates an add/fuse result body. The target stays in structure as consumed."
                            : extrudeForm.operationMode === "cut" &&
                                selectedBooleanTarget
                              ? "Creates a cut result body. The target stays in structure as consumed."
                              : booleanStatus.message}
                        </p>
                      )}
                      <details className="advanced-options">
                        <summary>Advanced extrude options</summary>
                        <div className="field-grid two">
                          <label>
                            Optional feature ID
                            <input
                              type="text"
                              value={extrudeForm.id}
                              disabled={disabled}
                              onChange={(event) =>
                                setExtrudeForm({
                                  ...extrudeForm,
                                  id: event.currentTarget.value
                                })
                              }
                            />
                          </label>
                          <label>
                            Optional body ID
                            <input
                              type="text"
                              value={extrudeForm.bodyId}
                              disabled={disabled}
                              onChange={(event) =>
                                setExtrudeForm({
                                  ...extrudeForm,
                                  bodyId: event.currentTarget.value
                                })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Optional name
                          <input
                            type="text"
                            value={extrudeForm.name}
                            disabled={disabled}
                            onChange={(event) =>
                              setExtrudeForm({
                                ...extrudeForm,
                                name: event.currentTarget.value
                              })
                            }
                          />
                        </label>
                      </details>
                      <button
                        type="button"
                        disabled={
                          disabled ||
                          ((extrudeForm.operationMode === "add" ||
                            extrudeForm.operationMode === "cut") &&
                            !canCreateBoolean)
                        }
                        onClick={() =>
                          onExtrudeEntity(
                            selectedSketch.id,
                            selectedExtrudeEntity.id,
                            extrudeForm
                          )
                        }
                      >
                        Create extrude
                      </button>
                    </>
                  ) : (
                    <p className="empty-state compact">
                      Select a rectangle or circle to extrude.
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SketchEvaluationSummary({
  evaluation
}: {
  readonly evaluation: SketchEvaluationQueryResponse | undefined;
}) {
  const statusDisplay = getSketchEvaluationStatusDisplay(evaluation);
  const issues = evaluation?.issues.slice(0, 3) ?? [];

  return (
    <section className="entity-editor" aria-label="Sketch evaluation">
      <div className="command-card-heading">
        <h3>Evaluation</h3>
        <span
          className={`health-text health-${statusDisplay.tone}`}
          title={statusDisplay.detail}
        >
          {statusDisplay.label}
        </span>
      </div>
      <dl className="compact-definition-list">
        <div>
          <dt>Dimensions</dt>
          <dd>{evaluation?.dimensionCount ?? 0}</dd>
        </div>
        <div>
          <dt>Constraints</dt>
          <dd>{evaluation?.constraintCount ?? 0}</dd>
        </div>
        <div>
          <dt>Driven entities</dt>
          <dd>{evaluation?.drivenEntityCount ?? 0}</dd>
        </div>
      </dl>
      <p
        className={
          statusDisplay.tone === "error"
            ? "error-text compact"
            : "project-message compact"
        }
      >
        {formatSketchEvaluationStatus(evaluation)}
      </p>
      {issues.length > 0 && (
        <ul className="dimension-issue-list">
          {issues.map((issue) => (
            <li key={`${issue.code}:${formatSketchEvaluationIssue(issue)}`}>
              {formatSketchEvaluationIssue(issue)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ParameterControls({
  disabled,
  parameters,
  selectedParameter,
  selectedParameterId,
  createForm,
  editForm,
  usageCounts,
  onCreateFormChange,
  onEditFormChange,
  onSelectParameter,
  onCreateParameter,
  onApplyParameterEdit,
  onDeleteParameter
}: {
  readonly disabled: boolean;
  readonly parameters: readonly CadParameterSnapshot[];
  readonly selectedParameter: CadParameterSnapshot | undefined;
  readonly selectedParameterId: string | undefined;
  readonly createForm: ParameterCreateForm;
  readonly editForm: ParameterEditForm;
  readonly usageCounts: ReadonlyMap<string, number>;
  readonly onCreateFormChange: (form: ParameterCreateForm) => void;
  readonly onEditFormChange: (form: ParameterEditForm) => void;
  readonly onSelectParameter: (parameterId: string | undefined) => void;
  readonly onCreateParameter: () => void;
  readonly onApplyParameterEdit: () => void;
  readonly onDeleteParameter: (parameterId: string) => void;
}) {
  const selectedUsageCount = selectedParameter
    ? (usageCounts.get(selectedParameter.id) ?? 0)
    : 0;

  return (
    <details className="workflow-section">
      <summary>Parameters ({parameters.length})</summary>
      <div className="field-grid two">
        <label>
          Name
          <input
            type="text"
            value={createForm.name}
            disabled={disabled}
            onChange={(event) =>
              onCreateFormChange({
                ...createForm,
                name: event.currentTarget.value
              })
            }
          />
        </label>
        <NumberField
          disabled={disabled}
          label="Value"
          value={createForm.value}
          onChange={(value) => onCreateFormChange({ ...createForm, value })}
        />
      </div>
      <details className="advanced-options compact">
        <summary>Parameter details</summary>
        <div className="field-grid two">
          <label>
            Optional ID
            <input
              type="text"
              value={createForm.id}
              disabled={disabled}
              onChange={(event) =>
                onCreateFormChange({
                  ...createForm,
                  id: event.currentTarget.value
                })
              }
            />
          </label>
          <label>
            Description
            <input
              type="text"
              value={createForm.description}
              disabled={disabled}
              onChange={(event) =>
                onCreateFormChange({
                  ...createForm,
                  description: event.currentTarget.value
                })
              }
            />
          </label>
        </div>
      </details>
      <div className="button-row">
        <button type="button" disabled={disabled} onClick={onCreateParameter}>
          Create parameter
        </button>
      </div>

      {parameters.length === 0 ? (
        <p className="empty-state compact">No parameters</p>
      ) : (
        <div className="parameter-editor">
          <label>
            Edit parameter
            <select
              value={selectedParameterId ?? ""}
              disabled={disabled}
              onChange={(event) => onSelectParameter(event.currentTarget.value)}
            >
              {parameters.map((parameter) => (
                <option key={parameter.id} value={parameter.id}>
                  {parameter.name} / {parameter.value}
                </option>
              ))}
            </select>
          </label>
          {selectedParameter && (
            <>
              <div className="field-grid two">
                <label>
                  Name
                  <input
                    type="text"
                    value={editForm.name}
                    disabled={disabled}
                    onChange={(event) =>
                      onEditFormChange({
                        ...editForm,
                        name: event.currentTarget.value
                      })
                    }
                  />
                </label>
                <NumberField
                  disabled={disabled}
                  label="Value"
                  value={editForm.value}
                  onChange={(value) => onEditFormChange({ ...editForm, value })}
                />
              </div>
              <details className="advanced-options compact">
                <summary>Description</summary>
                <input
                  type="text"
                  value={editForm.description}
                  disabled={disabled}
                  onChange={(event) =>
                    onEditFormChange({
                      ...editForm,
                      description: event.currentTarget.value
                    })
                  }
                />
              </details>
              {selectedUsageCount > 0 && (
                <p className="project-message compact">
                  Used by {selectedUsageCount} driving dimension
                  {selectedUsageCount === 1 ? "" : "s"}.
                </p>
              )}
              <div className="button-row compact">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onApplyParameterEdit}
                >
                  Apply parameter
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={disabled || selectedUsageCount > 0}
                  onClick={() => onDeleteParameter(selectedParameter.id)}
                >
                  Delete unused
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </details>
  );
}

function SketchDimensionControls({
  disabled,
  dimensions,
  availableTargets,
  createTarget,
  createForm,
  selectedDimension,
  selectedDimensionId,
  editForm,
  parameterBindingOptions,
  parameters,
  onCreateTargetChange,
  onCreateFormChange,
  onSelectDimension,
  onEditFormChange,
  onCreateDimension,
  onApplyDimensionEdit,
  onDeleteDimension
}: {
  readonly disabled: boolean;
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly availableTargets: readonly {
    readonly target: SketchDimensionTarget;
    readonly label: string;
    readonly currentValue: number;
  }[];
  readonly createTarget: SketchDimensionTarget | undefined;
  readonly createForm: SketchDimensionForm;
  readonly selectedDimension: SketchDimensionEntry | undefined;
  readonly selectedDimensionId: string | undefined;
  readonly editForm: SketchDimensionForm;
  readonly parameterBindingOptions: readonly {
    readonly parameterId: string;
    readonly label: string;
  }[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly onCreateTargetChange: (target: SketchDimensionTarget) => void;
  readonly onCreateFormChange: (form: SketchDimensionForm) => void;
  readonly onSelectDimension: (dimensionId: string | undefined) => void;
  readonly onEditFormChange: (form: SketchDimensionForm) => void;
  readonly onCreateDimension: () => void;
  readonly onApplyDimensionEdit: () => void;
  readonly onDeleteDimension: (dimensionId: string) => void;
}) {
  const supportsDimensions =
    availableTargets.length > 0 || dimensions.length > 0;

  if (!supportsDimensions) {
    return (
      <section className="entity-editor" aria-label="Driving dimensions">
        <div className="command-card-heading">
          <h3>Driving dimensions</h3>
        </div>
        <p className="empty-state compact">
          This entity has no supported driving dimension targets.
        </p>
      </section>
    );
  }

  return (
    <section className="entity-editor" aria-label="Driving dimensions">
      <div className="command-card-heading">
        <h3>Driving dimensions</h3>
        <span>{dimensions.length}</span>
      </div>

      {dimensions.length > 0 && (
        <div className="dimension-status-list" aria-label="Dimension status">
          {dimensions.map((dimension) => {
            const statusDisplay = getSketchDimensionStatusDisplay(dimension);

            return (
              <div key={dimension.id} className="dimension-status-row">
                <div>
                  <strong>
                    {dimension.name} ·{" "}
                    {getSketchDimensionTargetLabel(dimension.target)}
                  </strong>
                  <span>
                    {formatSketchDimensionValueSource(dimension, parameters)} ·{" "}
                    {formatSketchDimensionEffectiveValue(dimension)}
                  </span>
                </div>
                <span
                  className={`health-text health-${statusDisplay.tone}`}
                  title={statusDisplay.detail}
                >
                  {statusDisplay.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {availableTargets.length > 0 ? (
        <div className="dimension-create-row">
          <div className="field-grid two">
            <label>
              Target
              <select
                value={targetToValue(createTarget)}
                disabled={disabled}
                onChange={(event) => {
                  const next = availableTargets.find(
                    (option) =>
                      targetToValue(option.target) === event.currentTarget.value
                  );

                  if (next) {
                    onCreateTargetChange(next.target);
                    onCreateFormChange({
                      ...createForm,
                      name: next.label,
                      value: next.currentValue
                    });
                  }
                }}
              >
                {availableTargets.map((option) => (
                  <option
                    key={targetToValue(option.target)}
                    value={targetToValue(option.target)}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <DimensionValueSourceFields
              disabled={disabled}
              form={createForm}
              parameterBindingOptions={parameterBindingOptions}
              onChange={onCreateFormChange}
            />
          </div>
          <details className="advanced-options compact">
            <summary>Dimension details</summary>
            <div className="field-grid two">
              <label>
                Name
                <input
                  type="text"
                  value={createForm.name}
                  disabled={disabled}
                  onChange={(event) =>
                    onCreateFormChange({
                      ...createForm,
                      name: event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Optional ID
                <input
                  type="text"
                  value={createForm.id}
                  disabled={disabled}
                  onChange={(event) =>
                    onCreateFormChange({
                      ...createForm,
                      id: event.currentTarget.value
                    })
                  }
                />
              </label>
            </div>
          </details>
          <div className="button-row compact">
            <button
              type="button"
              disabled={
                disabled ||
                !createTarget ||
                (createForm.valueSourceType === "parameter" &&
                  parameterBindingOptions.length === 0)
              }
              onClick={onCreateDimension}
            >
              Create dimension
            </button>
          </div>
        </div>
      ) : (
        <p className="project-message compact">
          Supported targets for this entity already have driving dimensions.
        </p>
      )}

      {dimensions.length > 0 && (
        <div className="dimension-editor">
          <label>
            Edit dimension
            <select
              value={selectedDimensionId ?? ""}
              disabled={disabled}
              onChange={(event) => onSelectDimension(event.currentTarget.value)}
            >
              {dimensions.map((dimension) => (
                <option key={dimension.id} value={dimension.id}>
                  {dimension.name} /{" "}
                  {getSketchDimensionTargetLabel(dimension.target)}
                </option>
              ))}
            </select>
          </label>
          {selectedDimension && (
            <>
              <div className="readonly-field">
                <span>Current</span>
                <strong>
                  {getSketchDimensionTargetLabel(selectedDimension.target)} /{" "}
                  {formatSketchDimensionValueSource(
                    selectedDimension,
                    parameters
                  )}
                </strong>
              </div>
              <div className="readonly-field">
                <span>Evaluated</span>
                <strong>
                  {formatSketchDimensionEffectiveValue(selectedDimension)}
                </strong>
              </div>
              <p
                className={
                  selectedDimension.status === "healthy"
                    ? "project-message compact"
                    : "error-text"
                }
              >
                {formatSketchDimensionStatus(selectedDimension)}
              </p>
              <div className="field-grid two">
                <label>
                  Name
                  <input
                    type="text"
                    value={editForm.name}
                    disabled={disabled}
                    onChange={(event) =>
                      onEditFormChange({
                        ...editForm,
                        name: event.currentTarget.value
                      })
                    }
                  />
                </label>
                <DimensionValueSourceFields
                  disabled={disabled}
                  form={editForm}
                  parameterBindingOptions={parameterBindingOptions}
                  onChange={onEditFormChange}
                />
              </div>
              <div className="button-row compact">
                <button
                  type="button"
                  disabled={
                    disabled ||
                    (editForm.valueSourceType === "parameter" &&
                      parameterBindingOptions.length === 0)
                  }
                  onClick={onApplyDimensionEdit}
                >
                  Apply dimension
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={disabled}
                  onClick={() => onDeleteDimension(selectedDimension.id)}
                >
                  Delete dimension
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SketchConstraintControls({
  disabled,
  constraints,
  availableKinds,
  createForm,
  selectedConstraint,
  selectedConstraintId,
  editForm,
  onCreateFormChange,
  onSelectConstraint,
  onEditFormChange,
  onCreateConstraint,
  onApplyConstraintEdit,
  onDeleteConstraint
}: {
  readonly disabled: boolean;
  readonly constraints: readonly SketchConstraintEntry[];
  readonly availableKinds: readonly {
    readonly kind: SketchConstraintKind;
    readonly label: string;
  }[];
  readonly createForm: SketchConstraintForm;
  readonly selectedConstraint: SketchConstraintEntry | undefined;
  readonly selectedConstraintId: string | undefined;
  readonly editForm: SketchConstraintForm;
  readonly onCreateFormChange: (form: SketchConstraintForm) => void;
  readonly onSelectConstraint: (constraintId: string | undefined) => void;
  readonly onEditFormChange: (form: SketchConstraintForm) => void;
  readonly onCreateConstraint: () => void;
  readonly onApplyConstraintEdit: () => void;
  readonly onDeleteConstraint: (constraintId: string) => void;
}) {
  const supportsConstraints =
    availableKinds.length > 0 || constraints.length > 0;

  if (!supportsConstraints) {
    return (
      <section className="entity-editor" aria-label="Line constraints">
        <div className="command-card-heading">
          <h3>Line constraints</h3>
        </div>
        <p className="empty-state compact">
          Select a line to add horizontal or vertical constraints.
        </p>
      </section>
    );
  }

  return (
    <section className="entity-editor" aria-label="Line constraints">
      <div className="command-card-heading">
        <h3>Line constraints</h3>
        <span>{constraints.length}</span>
      </div>

      {constraints.length > 0 && (
        <div className="dimension-status-list" aria-label="Constraint status">
          {constraints.map((constraint) => {
            const statusDisplay = getSketchConstraintStatusDisplay(constraint);

            return (
              <div key={constraint.id} className="dimension-status-row">
                <div>
                  <strong>
                    {constraint.name} ·{" "}
                    {getSketchConstraintKindLabel(constraint.kind)}
                  </strong>
                  <span>{formatSketchConstraintStatus(constraint)}</span>
                </div>
                <span
                  className={`health-text health-${statusDisplay.tone}`}
                  title={statusDisplay.detail}
                >
                  {statusDisplay.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {availableKinds.length > 0 ? (
        <div className="dimension-create-row">
          <div className="field-grid two">
            <label>
              Constraint
              <select
                value={createForm.kind}
                disabled={disabled}
                onChange={(event) => {
                  const kind = event.currentTarget
                    .value as OrientationSketchConstraintKind;

                  onCreateFormChange({
                    ...createForm,
                    kind,
                    name: getSketchConstraintKindLabel(kind)
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
            <label>
              Name
              <input
                type="text"
                value={createForm.name}
                disabled={disabled}
                onChange={(event) =>
                  onCreateFormChange({
                    ...createForm,
                    name: event.currentTarget.value
                  })
                }
              />
            </label>
          </div>
          <details className="advanced-options compact">
            <summary>Constraint ID</summary>
            <input
              type="text"
              value={createForm.id}
              disabled={disabled}
              onChange={(event) =>
                onCreateFormChange({
                  ...createForm,
                  id: event.currentTarget.value
                })
              }
            />
          </details>
          <div className="button-row compact">
            <button
              type="button"
              disabled={disabled || availableKinds.length === 0}
              onClick={onCreateConstraint}
            >
              Create constraint
            </button>
          </div>
        </div>
      ) : (
        <p className="project-message compact">
          This line already has an orientation constraint.
        </p>
      )}

      {constraints.length > 0 && (
        <div className="dimension-editor">
          <label>
            Edit constraint
            <select
              value={selectedConstraintId ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onSelectConstraint(event.currentTarget.value)
              }
            >
              {constraints.map((constraint) => (
                <option key={constraint.id} value={constraint.id}>
                  {constraint.name} /{" "}
                  {getSketchConstraintKindLabel(constraint.kind)}
                </option>
              ))}
            </select>
          </label>
          {selectedConstraint && (
            <>
              <div className="readonly-field">
                <span>Kind</span>
                <strong>
                  {getSketchConstraintKindLabel(selectedConstraint.kind)}
                </strong>
              </div>
              <p
                className={
                  selectedConstraint.status === "healthy"
                    ? "project-message compact"
                    : "error-text"
                }
              >
                {formatSketchConstraintStatus(selectedConstraint)}
              </p>
              <label>
                Name
                <input
                  type="text"
                  value={editForm.name}
                  disabled={disabled}
                  onChange={(event) =>
                    onEditFormChange({
                      ...editForm,
                      name: event.currentTarget.value
                    })
                  }
                />
              </label>
              <div className="button-row compact">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onApplyConstraintEdit}
                >
                  Apply constraint
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={disabled}
                  onClick={() => onDeleteConstraint(selectedConstraint.id)}
                >
                  Delete constraint
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function DimensionValueSourceFields({
  disabled,
  form,
  parameterBindingOptions,
  onChange
}: {
  readonly disabled: boolean;
  readonly form: SketchDimensionForm;
  readonly parameterBindingOptions: readonly {
    readonly parameterId: string;
    readonly label: string;
  }[];
  readonly onChange: (form: SketchDimensionForm) => void;
}) {
  return (
    <div className="dimension-value-source">
      <label>
        Source
        <select
          value={form.valueSourceType}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...form,
              valueSourceType: event.currentTarget
                .value as SketchDimensionForm["valueSourceType"],
              parameterId:
                event.currentTarget.value === "parameter"
                  ? form.parameterId ||
                    parameterBindingOptions[0]?.parameterId ||
                    ""
                  : form.parameterId
            })
          }
        >
          <option value="literal">Literal</option>
          <option
            value="parameter"
            disabled={parameterBindingOptions.length === 0}
          >
            Parameter
          </option>
        </select>
      </label>
      {form.valueSourceType === "parameter" ? (
        <label>
          Parameter
          <select
            value={form.parameterId}
            disabled={disabled || parameterBindingOptions.length === 0}
            onChange={(event) =>
              onChange({ ...form, parameterId: event.currentTarget.value })
            }
          >
            {parameterBindingOptions.map((option) => (
              <option key={option.parameterId} value={option.parameterId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <NumberField
          disabled={disabled}
          label="Value"
          value={form.value}
          onChange={(value) => onChange({ ...form, value })}
        />
      )}
    </div>
  );
}

function EntityEditor({
  disabled,
  canCancel,
  editingEntityId,
  entityForm,
  entityKind,
  usageLabel,
  validation,
  onCancelEdit,
  onEntityFormChange,
  onEntityKindChange,
  onSave
}: {
  readonly disabled: boolean;
  readonly canCancel: boolean;
  readonly editingEntityId: string | undefined;
  readonly entityForm: SketchEntityForm;
  readonly entityKind: SketchEntityKind;
  readonly usageLabel?: string;
  readonly validation: ReturnType<typeof validateSketchEntityForm>;
  readonly onCancelEdit: () => void;
  readonly onEntityFormChange: (form: SketchEntityForm) => void;
  readonly onEntityKindChange: (kind: SketchEntityKind) => void;
  readonly onSave: () => void;
}) {
  const labels = getSketchEntityFormLabels(entityKind);

  return (
    <section className="entity-editor" aria-label="Sketch entity editor">
      <div className="command-card-heading">
        <h3>{editingEntityId ? "Edit sketch entity" : "Add sketch entity"}</h3>
      </div>
      {usageLabel && (
        <p className="project-message">
          {usageLabel}. Updating this source profile rebuilds dependent body
          display, measurements, extents, and generated references.
        </p>
      )}
      <div className="field-grid two">
        <label>
          Entity
          <select
            value={entityKind}
            disabled={disabled || Boolean(editingEntityId)}
            onChange={(event) =>
              onEntityKindChange(event.currentTarget.value as SketchEntityKind)
            }
          >
            <option value="point">Point</option>
            <option value="line">Line</option>
            <option value="rectangle">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
        </label>
        {editingEntityId ? (
          <div className="readonly-field">
            <span>Editing</span>
            <strong>{editingEntityId}</strong>
          </div>
        ) : (
          <details className="advanced-options inline">
            <summary>Optional ID</summary>
            <input
              type="text"
              value={entityForm.id}
              disabled={disabled}
              onChange={(event) =>
                onEntityFormChange({
                  ...entityForm,
                  id: event.currentTarget.value
                })
              }
            />
          </details>
        )}
      </div>
      <div className="field-grid four">
        <NumberField
          disabled={disabled}
          label={labels.x}
          value={entityForm.x}
          onChange={(x) => onEntityFormChange({ ...entityForm, x })}
        />
        <NumberField
          disabled={disabled}
          label={labels.y}
          value={entityForm.y}
          onChange={(y) => onEntityFormChange({ ...entityForm, y })}
        />
        {entityKind === "line" && (
          <>
            <NumberField
              disabled={disabled}
              label={labels.x2 ?? "End X"}
              value={entityForm.x2}
              onChange={(x2) => onEntityFormChange({ ...entityForm, x2 })}
            />
            <NumberField
              disabled={disabled}
              label={labels.y2 ?? "End Y"}
              value={entityForm.y2}
              onChange={(y2) => onEntityFormChange({ ...entityForm, y2 })}
            />
          </>
        )}
        {entityKind === "rectangle" && (
          <>
            <NumberField
              disabled={disabled}
              label={labels.width ?? "Width"}
              value={entityForm.width}
              onChange={(width) => onEntityFormChange({ ...entityForm, width })}
            />
            <NumberField
              disabled={disabled}
              label={labels.height ?? "Height"}
              value={entityForm.height}
              onChange={(height) =>
                onEntityFormChange({ ...entityForm, height })
              }
            />
          </>
        )}
        {entityKind === "circle" && (
          <NumberField
            disabled={disabled}
            label={labels.radius ?? "Radius"}
            value={entityForm.radius}
            onChange={(radius) => onEntityFormChange({ ...entityForm, radius })}
          />
        )}
      </div>
      {!validation.ok && <p className="error-text">{validation.message}</p>}
      <div className="button-row">
        <button
          type="button"
          disabled={disabled || !validation.ok}
          onClick={onSave}
        >
          {editingEntityId ? "Update entity" : "Add entity"}
        </button>
        {canCancel && (
          <button type="button" disabled={disabled} onClick={onCancelEdit}>
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

function parameterToEditForm(
  parameter: CadParameterSnapshot | undefined
): ParameterEditForm {
  return {
    name: parameter?.name ?? "",
    value: parameter?.value ?? 1,
    description: parameter?.description ?? ""
  };
}

function sketchDimensionToForm(
  dimension: SketchDimensionEntry | undefined
): SketchDimensionForm {
  if (!dimension) {
    return defaultSketchDimensionForm;
  }

  return {
    id: "",
    name: dimension.name,
    valueSourceType: dimension.valueSource.type,
    value:
      dimension.valueSource.type === "literal"
        ? dimension.valueSource.value
        : (dimension.effectiveValue ?? 1),
    parameterId:
      dimension.valueSource.type === "parameter"
        ? dimension.valueSource.parameterId
        : ""
  };
}

function sketchConstraintToForm(
  constraint: SketchConstraintEntry | undefined
): SketchConstraintForm {
  if (
    !constraint ||
    (constraint.kind !== "horizontal" && constraint.kind !== "vertical")
  ) {
    return defaultSketchConstraintForm;
  }

  return {
    id: "",
    name: constraint.name,
    kind: constraint.kind
  };
}

function targetToValue(target: SketchDimensionTarget | undefined): string {
  return target ? `${target.entityKind}:${target.role}` : "";
}

function NumberField({
  disabled,
  label,
  value,
  onChange
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}
