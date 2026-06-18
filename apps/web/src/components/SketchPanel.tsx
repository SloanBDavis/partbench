import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CadParameterSnapshot,
  CadFeatureSummary,
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchEvaluationQueryResponse,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchPointTargetRole,
  SketchPlane,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type {
  FeatureExtrudeForm,
  FeatureHoleForm,
  FeatureRevolveForm,
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
  chooseInitialSketchPanelSelection,
  chooseSketchPanelSelection,
  createAvailableCoincidentPointTargetOptions,
  createAvailableFixedPointTargetOptions,
  createAvailableMidpointTargetOptions,
  createAvailableParallelLineTargetOptions,
  createAvailableSketchConstraintKindOptions,
  createAvailableSketchDimensionTargetOptions,
  createSketchEntityListItems,
  createRevolveAxisOptions,
  createSketchPointTargetOptionsForEntity,
  formatSketchDimensionEffectiveValue,
  getAddOperationStatus,
  getCutOperationStatus,
  getHoleOperationStatus,
  getDefaultSketchEntityKind,
  getDefaultSketchPointTargetRole,
  getRevolveOperationStatus,
  createParameterBindingOptions,
  formatSketchEvaluationIssue,
  formatSketchEvaluationStatus,
  formatSketchConstraintStatus,
  formatSketchPointCoordinate,
  formatSketchDimensionStatus,
  formatSketchDimensionValueSource,
  getSketchConstraintKindLabel,
  getSketchConstraintStatusDisplay,
  getSketchDimensionStatusDisplay,
  getSketchEvaluationStatusDisplay,
  getParameterDimensionUsageCount,
  getSketchDimensionTargetLabel,
  getSketchEntityOptionLabel,
  isSketchConstraintRelatedToEntity,
  isExtrudableSketchEntity,
  isHoleSketchEntity,
  isRevolvableSketchEntity,
  sketchDimensionTargetsEqual,
  type BooleanTargetBodyOption,
  type SketchLineTargetOption,
  type SketchPanelSelectionContext
} from "../sketchPanelUi";
import {
  defaultSketchEntityForm,
  entityToSketchEntityForm,
  formatSketchEntity,
  getSketchEntityFormLabels,
  sketchEntityFormToEntity,
  validateSketchEntityForm
} from "../sketchEntityForms";

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
  readonly holeTargetBodies?: readonly BooleanTargetBodyOption[];
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
  readonly onRevolveEntity: (
    sketchId: string,
    entityId: string,
    form: FeatureRevolveForm
  ) => void;
  readonly onHoleEntity: (
    sketchId: string,
    circleEntityId: string,
    form: FeatureHoleForm
  ) => void;
  readonly onSelectionContextChange?: (
    context: SketchPanelSelectionContext | undefined
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
  depthMode: "blind",
  depth: 1,
  direction: "positive"
};

export function SketchPanel({
  disabled,
  sketches,
  parameters,
  sketchDimensionsBySketchId,
  sketchEvaluationsBySketchId,
  addTargetBodies = [],
  cutTargetBodies = [],
  holeTargetBodies = [],
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
  onExtrudeEntity,
  onRevolveEntity,
  onHoleEntity,
  onSelectionContextChange
}: SketchPanelProps) {
  const [selectedSketchId, setSelectedSketchId] = useState<string | undefined>(
    chooseInitialSketchPanelSelection(sketches, focusedSketchId)
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
  const entityListItems = useMemo(
    () =>
      createSketchEntityListItems(
        selectedSketch?.entities ?? [],
        effectiveSelectedEntityId
      ),
    [effectiveSelectedEntityId, selectedSketch]
  );
  const entityUsageLabels = useMemo(
    () =>
      new Map(
        (selectedSketch?.entities ?? []).flatMap((entity) => {
          if (!selectedSketch) {
            return [];
          }

          const usageLabel = formatSketchEntityUsageLabel(
            getSketchEntityExtrudeUsages(features, selectedSketch.id, entity.id)
          );

          return usageLabel ? [[entity.id, usageLabel] as const] : [];
        })
      ),
    [features, selectedSketch]
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
        ? selectedSketchConstraints.filter((constraint) =>
            isSketchConstraintRelatedToEntity(constraint, selectedEntity.id)
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
        selectedSketchConstraints,
        selectedSketch?.entities ?? []
      ),
    [selectedEntity, selectedSketch, selectedSketchConstraints]
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
  const fixedPointTargetOptions = useMemo(
    () =>
      createAvailableFixedPointTargetOptions(
        selectedEntity,
        selectedSketchConstraints
      ),
    [selectedEntity, selectedSketchConstraints]
  );
  const primaryPointTargetOptions = useMemo(
    () => createSketchPointTargetOptionsForEntity(selectedEntity),
    [selectedEntity]
  );
  const selectedPrimaryTargetOptions =
    selectedCreateConstraintKind === "fixed"
      ? fixedPointTargetOptions
      : primaryPointTargetOptions;
  const selectedPrimaryTargetOption =
    selectedPrimaryTargetOptions.find(
      (option) => option.target.role === constraintCreateForm.targetRole
    ) ?? selectedPrimaryTargetOptions[0];
  const coincidentTargetOptions = useMemo(
    () =>
      createAvailableCoincidentPointTargetOptions(
        selectedPrimaryTargetOption?.target,
        selectedSketch?.entities ?? [],
        selectedSketchConstraints
      ),
    [selectedPrimaryTargetOption, selectedSketch, selectedSketchConstraints]
  );
  const midpointTargetOptions = useMemo(
    () =>
      createAvailableMidpointTargetOptions(
        selectedEntity,
        selectedSketch?.entities ?? [],
        selectedSketchConstraints
      ),
    [selectedEntity, selectedSketch, selectedSketchConstraints]
  );
  const parallelTargetOptions = useMemo(
    () =>
      createAvailableParallelLineTargetOptions(
        selectedEntity,
        selectedSketch?.entities ?? [],
        selectedSketchConstraints
      ),
    [selectedEntity, selectedSketch, selectedSketchConstraints]
  );
  const secondaryConstraintTargetOptions =
    selectedCreateConstraintKind === "midpoint"
      ? midpointTargetOptions
      : coincidentTargetOptions;
  const selectedSecondaryTargetOption =
    secondaryConstraintTargetOptions.find(
      (option) =>
        option.target.entityId === constraintCreateForm.secondaryEntityId &&
        option.target.role === constraintCreateForm.secondaryTargetRole
    ) ?? secondaryConstraintTargetOptions[0];
  const selectedParallelTargetOption =
    parallelTargetOptions.find(
      (option) => option.entityId === constraintCreateForm.secondaryEntityId
    ) ?? parallelTargetOptions[0];
  const effectiveConstraintCreateForm: SketchConstraintForm = {
    ...constraintCreateForm,
    kind: selectedCreateConstraintKind ?? constraintCreateForm.kind,
    targetRole:
      selectedPrimaryTargetOption?.target.role ??
      getDefaultSketchPointTargetRole(selectedEntity),
    coordinateX:
      selectedPrimaryTargetOption &&
      !selectedPrimaryTargetOptions.some(
        (option) => option.target.role === constraintCreateForm.targetRole
      )
        ? (selectedPrimaryTargetOption.coordinate?.[0] ?? 0)
        : constraintCreateForm.coordinateX,
    coordinateY:
      selectedPrimaryTargetOption &&
      !selectedPrimaryTargetOptions.some(
        (option) => option.target.role === constraintCreateForm.targetRole
      )
        ? (selectedPrimaryTargetOption.coordinate?.[1] ?? 0)
        : constraintCreateForm.coordinateY,
    secondaryEntityId: isLinePairConstraintKind(selectedCreateConstraintKind)
      ? (selectedParallelTargetOption?.entityId ??
        constraintCreateForm.secondaryEntityId)
      : (selectedSecondaryTargetOption?.target.entityId ??
        constraintCreateForm.secondaryEntityId),
    secondaryTargetRole:
      selectedSecondaryTargetOption?.target.role ??
      constraintCreateForm.secondaryTargetRole,
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
  const [revolveForm, setRevolveForm] =
    useState<FeatureRevolveForm>(defaultRevolveForm);
  const [holeForm, setHoleForm] = useState<FeatureHoleForm>(defaultHoleForm);
  const [featureCreateMode, setFeatureCreateMode] = useState<
    "extrude" | "revolve" | "hole"
  >("extrude");
  const selectedExtrudeEntity = isExtrudableSketchEntity(selectedEntity)
    ? selectedEntity
    : undefined;
  const selectedRevolveEntity = isRevolvableSketchEntity(selectedEntity)
    ? selectedEntity
    : undefined;
  const selectedHoleEntity = isHoleSketchEntity(selectedEntity)
    ? selectedEntity
    : undefined;
  const activeFeatureCreateMode =
    featureCreateMode === "hole" && !selectedHoleEntity
      ? "extrude"
      : featureCreateMode;
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
  const revolveAxisOptions = useMemo(
    () => createRevolveAxisOptions(selectedSketch),
    [selectedSketch]
  );
  const selectedSketchLineCount =
    selectedSketch?.entities.filter((entity) => entity.kind === "line")
      .length ?? 0;
  const selectedRevolveAxisOption =
    revolveAxisOptions.find(
      (option) => option.entityId === revolveForm.axisEntityId
    ) ?? revolveAxisOptions[0];
  const effectiveRevolveForm: FeatureRevolveForm = {
    ...revolveForm,
    axisEntityId:
      selectedRevolveAxisOption?.entityId ?? revolveForm.axisEntityId
  };
  const revolveStatus = getRevolveOperationStatus(
    selectedRevolveEntity,
    revolveAxisOptions,
    effectiveRevolveForm.angleDegrees,
    selectedSketchLineCount
  );
  const selectedHoleTarget =
    holeTargetBodies.find((body) => body.bodyId === holeForm.targetBodyId) ??
    holeTargetBodies[0];
  const effectiveHoleForm: FeatureHoleForm = {
    ...holeForm,
    targetBodyId: selectedHoleTarget?.bodyId ?? holeForm.targetBodyId
  };
  const holeStatus = getHoleOperationStatus(
    selectedEntity,
    holeTargetBodies,
    effectiveHoleForm,
    selectedSketchDisplayStatus
  );
  const shouldShowEntityEditor =
    Boolean(editingEntityId) ||
    isAddingEntity ||
    selectedSketch?.entities.length === 0;

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

  const selectedSketchContextId = selectedSketch?.id;
  useEffect(() => {
    onSelectionContextChange?.(
      selectedSketchContextId
        ? {
            sketchId: selectedSketchContextId,
            ...(effectiveSelectedEntityId
              ? { entityId: effectiveSelectedEntityId }
              : {})
          }
        : undefined
    );
  }, [
    effectiveSelectedEntityId,
    onSelectionContextChange,
    selectedSketchContextId
  ]);

  function editEntity(entity: SketchEntitySnapshot) {
    setSelectedEntityId(entity.id);
    setEditingEntityId(entity.id);
    setIsAddingEntity(false);
    setEntityKind(entity.kind);
    setEntityForm(entityToSketchEntityForm(entity));
  }

  function addEntity(kind?: SketchEntityKind) {
    setEditingEntityId(undefined);
    setIsAddingEntity(true);
    setEntityKind(kind ?? getDefaultSketchEntityKind(selectedSketch));
    setEntityForm(defaultSketchEntityForm);
  }

  function selectEntity(entityId: SketchEntityId) {
    setSelectedEntityId(entityId);
    setEditingEntityId(undefined);
    setIsAddingEntity(false);
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

    if (
      selectedCreateConstraintKind === "fixed" &&
      !selectedPrimaryTargetOption
    ) {
      return;
    }

    if (
      selectedCreateConstraintKind === "coincident" &&
      (!selectedPrimaryTargetOption || !selectedSecondaryTargetOption)
    ) {
      return;
    }

    if (
      selectedCreateConstraintKind === "midpoint" &&
      !selectedSecondaryTargetOption
    ) {
      return;
    }

    if (
      isLinePairConstraintKind(selectedCreateConstraintKind) &&
      !selectedParallelTargetOption
    ) {
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

              <section className="entity-picker" aria-label="Sketch entities">
                <div className="command-card-heading">
                  <h3>Entities</h3>
                  <span>{selectedSketch.entities.length}</span>
                </div>

                <div className="entity-picker-toolbar">
                  <div
                    className="segmented-control entity-add-control"
                    aria-label="Add sketch entity"
                  >
                    {(["point", "line", "rectangle", "circle"] as const).map(
                      (kind) => (
                        <button
                          key={kind}
                          type="button"
                          disabled={disabled}
                          onClick={() => addEntity(kind)}
                        >
                          {kind === "point"
                            ? "Point"
                            : kind === "line"
                              ? "Line"
                              : kind === "rectangle"
                                ? "Rectangle"
                                : "Circle"}
                        </button>
                      )
                    )}
                  </div>

                  {selectedSketch.entities.length > 0 && (
                    <details className="advanced-options compact entity-select-fallback">
                      <summary>Compact selector</summary>
                      <label>
                        Entity
                        <select
                          value={effectiveSelectedEntityId ?? ""}
                          disabled={disabled}
                          onChange={(event) =>
                            selectEntity(event.currentTarget.value)
                          }
                        >
                          {selectedSketch.entities.map((entity) => (
                            <option key={entity.id} value={entity.id}>
                              {getSketchEntityOptionLabel(entity)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </details>
                  )}
                </div>

                {entityListItems.length === 0 ? (
                  <p className="empty-state compact">No sketch entities</p>
                ) : (
                  <ul
                    className="entity-list entity-selection-list"
                    aria-label="Select sketch entity"
                  >
                    {entityListItems.map((item) => {
                      const usageLabel = entityUsageLabels.get(item.id);

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={item.selected ? "selected" : undefined}
                            disabled={disabled}
                            onClick={() => selectEntity(item.id)}
                          >
                            <span className="entity-row-title">
                              <strong>{item.kindLabel}</strong>
                              <code>{item.id}</code>
                            </span>
                            <small>{item.detail}</small>
                            {usageLabel && (
                              <small className="entity-usage">
                                {usageLabel}
                              </small>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {shouldShowEntityEditor && (
                  <EntityEditor
                    disabled={disabled}
                    canCancel={selectedSketch.entities.length > 0}
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

                {selectedEntity && !shouldShowEntityEditor && (
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
                {selectedEntity && !shouldShowEntityEditor && (
                  <SketchDimensionControls
                    key={`${selectedEntity.id}:dimensions`}
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
                  !shouldShowEntityEditor &&
                  (availableConstraintKinds.length > 0 ||
                    selectedEntityConstraints.length > 0) && (
                    <SketchConstraintControls
                      key={`${selectedEntity.id}:constraints`}
                      disabled={disabled}
                      constraints={selectedEntityConstraints}
                      availableKinds={availableConstraintKinds}
                      primaryTargetOptions={selectedPrimaryTargetOptions}
                      coincidentTargetOptions={coincidentTargetOptions}
                      midpointTargetOptions={midpointTargetOptions}
                      parallelTargetOptions={parallelTargetOptions}
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

              {selectedSketch.entities.length > 0 &&
                !shouldShowEntityEditor && (
                  <section
                    className="entity-editor"
                    aria-label="Create authored feature"
                  >
                    <div className="command-card-heading">
                      <h3>Actions for selected entity</h3>
                    </div>
                    {selectedExtrudeEntity ? (
                      <>
                        <div className="readonly-field">
                          <span>Profile</span>
                          <strong>
                            {getSketchEntityOptionLabel(selectedExtrudeEntity)}
                          </strong>
                        </div>
                        <div
                          className="segmented-control feature-mode-tabs"
                          aria-label="Feature action"
                        >
                          <button
                            type="button"
                            className={
                              activeFeatureCreateMode === "extrude"
                                ? "selected"
                                : undefined
                            }
                            disabled={disabled}
                            onClick={() => setFeatureCreateMode("extrude")}
                          >
                            Extrude
                          </button>
                          <button
                            type="button"
                            className={
                              activeFeatureCreateMode === "revolve"
                                ? "selected"
                                : undefined
                            }
                            disabled={disabled}
                            onClick={() => setFeatureCreateMode("revolve")}
                          >
                            Revolve
                          </button>
                          <button
                            type="button"
                            className={
                              activeFeatureCreateMode === "hole"
                                ? "selected"
                                : undefined
                            }
                            disabled={disabled || !selectedHoleEntity}
                            onClick={() => {
                              setFeatureCreateMode("hole");

                              if (
                                !holeTargetBodies.some(
                                  (body) =>
                                    body.bodyId === holeForm.targetBodyId
                                )
                              ) {
                                setHoleForm({
                                  ...holeForm,
                                  targetBodyId:
                                    holeTargetBodies[0]?.bodyId ?? ""
                                });
                              }
                            }}
                          >
                            Hole
                          </button>
                        </div>
                        {activeFeatureCreateMode === "hole" ? (
                          <>
                            <div className="field-grid two">
                              <label>
                                Target body
                                <select
                                  value={effectiveHoleForm.targetBodyId}
                                  disabled={
                                    disabled || holeTargetBodies.length === 0
                                  }
                                  onChange={(event) =>
                                    setHoleForm({
                                      ...holeForm,
                                      targetBodyId: event.currentTarget.value
                                    })
                                  }
                                >
                                  {holeTargetBodies.map((body) => (
                                    <option
                                      key={body.bodyId}
                                      value={body.bodyId}
                                    >
                                      {body.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Depth mode
                                <select
                                  value={holeForm.depthMode}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    setHoleForm({
                                      ...holeForm,
                                      depthMode: event.currentTarget
                                        .value as FeatureHoleForm["depthMode"]
                                    })
                                  }
                                >
                                  <option value="blind">Blind</option>
                                  <option value="throughAll">
                                    Through all
                                  </option>
                                </select>
                              </label>
                            </div>
                            <div className="field-grid two">
                              {effectiveHoleForm.depthMode === "blind" ? (
                                <NumberField
                                  disabled={disabled}
                                  label="Depth"
                                  value={holeForm.depth}
                                  onChange={(depth) =>
                                    setHoleForm({ ...holeForm, depth })
                                  }
                                />
                              ) : (
                                <div className="readonly-field">
                                  <span>Depth</span>
                                  <strong>Through all</strong>
                                </div>
                              )}
                              <label>
                                Direction
                                <select
                                  value={holeForm.direction}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    setHoleForm({
                                      ...holeForm,
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
                            {selectedHoleTarget ? (
                              <div className="readonly-field">
                                <span>Hole target</span>
                                <strong>{selectedHoleTarget.detail}</strong>
                              </div>
                            ) : null}
                            <p
                              className={
                                holeStatus.available
                                  ? "project-message compact"
                                  : "error-text compact"
                              }
                            >
                              {holeStatus.available && selectedHoleTarget
                                ? "Creates a hole result body. The target stays in structure as consumed."
                                : holeStatus.message}
                            </p>
                            <details className="advanced-options">
                              <summary>Advanced hole options</summary>
                              <div className="field-grid two">
                                <label>
                                  Optional feature ID
                                  <input
                                    type="text"
                                    value={holeForm.id}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      setHoleForm({
                                        ...holeForm,
                                        id: event.currentTarget.value
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Optional body ID
                                  <input
                                    type="text"
                                    value={holeForm.bodyId}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      setHoleForm({
                                        ...holeForm,
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
                                  value={holeForm.name}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    setHoleForm({
                                      ...holeForm,
                                      name: event.currentTarget.value
                                    })
                                  }
                                />
                              </label>
                            </details>
                            <button
                              type="button"
                              disabled={disabled || !holeStatus.available}
                              onClick={() =>
                                selectedHoleEntity &&
                                onHoleEntity(
                                  selectedSketch.id,
                                  selectedHoleEntity.id,
                                  effectiveHoleForm
                                )
                              }
                            >
                              Create hole
                            </button>
                          </>
                        ) : activeFeatureCreateMode === "revolve" ? (
                          <>
                            <div className="field-grid two">
                              <label>
                                Axis line
                                <select
                                  value={effectiveRevolveForm.axisEntityId}
                                  disabled={
                                    disabled || revolveAxisOptions.length === 0
                                  }
                                  onChange={(event) =>
                                    setRevolveForm({
                                      ...revolveForm,
                                      axisEntityId: event.currentTarget.value
                                    })
                                  }
                                >
                                  {revolveAxisOptions.map((axis) => (
                                    <option
                                      key={axis.entityId}
                                      value={axis.entityId}
                                    >
                                      {axis.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <NumberField
                                disabled={disabled}
                                label="Angle"
                                value={revolveForm.angleDegrees}
                                onChange={(angleDegrees) =>
                                  setRevolveForm({
                                    ...revolveForm,
                                    angleDegrees
                                  })
                                }
                              />
                            </div>
                            {selectedRevolveAxisOption ? (
                              <div className="readonly-field">
                                <span>Axis</span>
                                <strong>
                                  {selectedRevolveAxisOption.detail}
                                </strong>
                              </div>
                            ) : null}
                            <p className="project-message compact">
                              {revolveStatus.message}
                            </p>
                            <details className="advanced-options">
                              <summary>Advanced revolve options</summary>
                              <div className="field-grid two">
                                <label>
                                  Optional feature ID
                                  <input
                                    type="text"
                                    value={revolveForm.id}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      setRevolveForm({
                                        ...revolveForm,
                                        id: event.currentTarget.value
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Optional body ID
                                  <input
                                    type="text"
                                    value={revolveForm.bodyId}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      setRevolveForm({
                                        ...revolveForm,
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
                                  value={revolveForm.name}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    setRevolveForm({
                                      ...revolveForm,
                                      name: event.currentTarget.value
                                    })
                                  }
                                />
                              </label>
                            </details>
                            <button
                              type="button"
                              disabled={disabled || !revolveStatus.available}
                              onClick={() =>
                                onRevolveEntity(
                                  selectedSketch.id,
                                  selectedExtrudeEntity.id,
                                  effectiveRevolveForm
                                )
                              }
                            >
                              Create revolve
                            </button>
                          </>
                        ) : (
                          <>
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
                                      <option
                                        key={body.bodyId}
                                        value={body.bodyId}
                                      >
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
                                  <strong>
                                    {selectedBooleanTarget.detail}
                                  </strong>
                                </div>
                              )}
                            {((extrudeForm.operationMode === "add" &&
                              (!addStatus.available ||
                                selectedBooleanTarget)) ||
                              (extrudeForm.operationMode === "cut" &&
                                (!cutStatus.available ||
                                  selectedBooleanTarget)) ||
                              (!addStatus.available &&
                                !cutStatus.available)) && (
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
                        )}
                      </>
                    ) : (
                      <p className="empty-state compact">
                        Select a rectangle or circle to create an authored
                        feature.
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
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");

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
            const isSelected = dimension.id === selectedDimensionId;

            return (
              <button
                key={dimension.id}
                type="button"
                className={`dimension-status-row ${
                  isSelected ? "selected" : ""
                }`}
                disabled={disabled}
                onClick={() => onSelectDimension(dimension.id)}
              >
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
              </button>
            );
          })}
        </div>
      )}

      <div className="button-row compact contextual-action-row">
        {availableTargets.length > 0 && (
          <button
            type="button"
            className={mode === "create" ? "selected" : undefined}
            disabled={disabled}
            onClick={() => setMode(mode === "create" ? "idle" : "create")}
          >
            Add dimension
          </button>
        )}
        {selectedDimension && (
          <button
            type="button"
            className={mode === "edit" ? "selected" : undefined}
            disabled={disabled}
            onClick={() => setMode(mode === "edit" ? "idle" : "edit")}
          >
            Edit selected
          </button>
        )}
      </div>

      {availableTargets.length === 0 && (
        <p className="project-message compact">
          Supported targets for this entity already have driving dimensions.
        </p>
      )}

      {mode === "create" && availableTargets.length > 0 && (
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
      )}

      {mode === "edit" && selectedDimension && (
        <div className="dimension-editor">
          <div className="readonly-field">
            <span>Current</span>
            <strong>
              {getSketchDimensionTargetLabel(selectedDimension.target)} /{" "}
              {formatSketchDimensionValueSource(selectedDimension, parameters)}
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
        </div>
      )}
    </section>
  );
}

function SketchConstraintControls({
  disabled,
  constraints,
  availableKinds,
  primaryTargetOptions,
  coincidentTargetOptions,
  midpointTargetOptions,
  parallelTargetOptions,
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
    readonly kind: SketchConstraintForm["kind"];
    readonly label: string;
  }[];
  readonly primaryTargetOptions: readonly {
    readonly target: {
      readonly entityId: string;
      readonly role: SketchPointTargetRole;
    };
    readonly label: string;
    readonly coordinate?: readonly [number, number];
  }[];
  readonly coincidentTargetOptions: readonly {
    readonly target: {
      readonly entityId: string;
      readonly role: SketchPointTargetRole;
    };
    readonly label: string;
  }[];
  readonly midpointTargetOptions: readonly {
    readonly target: {
      readonly entityId: string;
      readonly role: SketchPointTargetRole;
    };
    readonly label: string;
  }[];
  readonly parallelTargetOptions: readonly SketchLineTargetOption[];
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
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");

  if (!supportsConstraints) {
    return (
      <section className="entity-editor" aria-label="Sketch constraints">
        <div className="command-card-heading">
          <h3>Constraints</h3>
        </div>
        <p className="empty-state compact">
          This entity has no supported constraint targets.
        </p>
      </section>
    );
  }

  return (
    <section className="entity-editor" aria-label="Sketch constraints">
      <div className="command-card-heading">
        <h3>Constraints</h3>
        <span>{constraints.length}</span>
      </div>

      {constraints.length > 0 && (
        <div className="dimension-status-list" aria-label="Constraint status">
          {constraints.map((constraint) => {
            const statusDisplay = getSketchConstraintStatusDisplay(constraint);
            const isSelected = constraint.id === selectedConstraintId;

            return (
              <button
                key={constraint.id}
                type="button"
                className={`dimension-status-row ${
                  isSelected ? "selected" : ""
                }`}
                disabled={disabled}
                onClick={() => onSelectConstraint(constraint.id)}
              >
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
              </button>
            );
          })}
        </div>
      )}

      <div className="button-row compact contextual-action-row">
        {availableKinds.length > 0 && (
          <button
            type="button"
            className={mode === "create" ? "selected" : undefined}
            disabled={disabled}
            onClick={() => setMode(mode === "create" ? "idle" : "create")}
          >
            Add constraint
          </button>
        )}
        {selectedConstraint && (
          <button
            type="button"
            className={mode === "edit" ? "selected" : undefined}
            disabled={disabled}
            onClick={() => setMode(mode === "edit" ? "idle" : "edit")}
          >
            Edit selected
          </button>
        )}
      </div>

      {availableKinds.length === 0 && (
        <p className="project-message compact">
          Supported constraint targets for this entity are already constrained.
        </p>
      )}

      {mode === "create" && availableKinds.length > 0 && (
        <div className="dimension-create-row">
          <div className="field-grid two">
            <label>
              Constraint
              <select
                value={createForm.kind}
                disabled={disabled}
                onChange={(event) => {
                  const kind = event.currentTarget
                    .value as SketchConstraintForm["kind"];

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
            <ConstraintTargetFields
              disabled={disabled}
              form={createForm}
              primaryTargetOptions={primaryTargetOptions}
              coincidentTargetOptions={coincidentTargetOptions}
              midpointTargetOptions={midpointTargetOptions}
              parallelTargetOptions={parallelTargetOptions}
              onChange={onCreateFormChange}
            />
          </div>
          <details className="advanced-options compact">
            <summary>Constraint details</summary>
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
                availableKinds.length === 0 ||
                (createForm.kind === "fixed" &&
                  primaryTargetOptions.length === 0) ||
                (createForm.kind === "coincident" &&
                  (primaryTargetOptions.length === 0 ||
                    coincidentTargetOptions.length === 0)) ||
                (createForm.kind === "midpoint" &&
                  midpointTargetOptions.length === 0) ||
                (isLinePairConstraintKind(createForm.kind) &&
                  parallelTargetOptions.length === 0)
              }
              onClick={onCreateConstraint}
            >
              Create constraint
            </button>
          </div>
        </div>
      )}

      {mode === "edit" && selectedConstraint && (
        <div className="dimension-editor">
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
        </div>
      )}
    </section>
  );
}

function ConstraintTargetFields({
  disabled,
  form,
  primaryTargetOptions,
  coincidentTargetOptions,
  midpointTargetOptions,
  parallelTargetOptions,
  onChange
}: {
  readonly disabled: boolean;
  readonly form: SketchConstraintForm;
  readonly primaryTargetOptions: readonly {
    readonly target: {
      readonly entityId: string;
      readonly role: SketchPointTargetRole;
    };
    readonly label: string;
    readonly coordinate?: readonly [number, number];
  }[];
  readonly coincidentTargetOptions: readonly {
    readonly target: {
      readonly entityId: string;
      readonly role: SketchPointTargetRole;
    };
    readonly label: string;
    readonly coordinate?: readonly [number, number];
  }[];
  readonly midpointTargetOptions: readonly {
    readonly target: {
      readonly entityId: string;
      readonly role: SketchPointTargetRole;
    };
    readonly label: string;
    readonly coordinate?: readonly [number, number];
  }[];
  readonly parallelTargetOptions: readonly SketchLineTargetOption[];
  readonly onChange: (form: SketchConstraintForm) => void;
}) {
  const selectedPrimaryOption =
    primaryTargetOptions.find(
      (option) => option.target.role === form.targetRole
    ) ?? primaryTargetOptions[0];
  const selectedSecondaryOption =
    coincidentTargetOptions.find(
      (option) =>
        option.target.entityId === form.secondaryEntityId &&
        option.target.role === form.secondaryTargetRole
    ) ?? coincidentTargetOptions[0];
  const selectedMidpointTargetOption =
    midpointTargetOptions.find(
      (option) =>
        option.target.entityId === form.secondaryEntityId &&
        option.target.role === form.secondaryTargetRole
    ) ?? midpointTargetOptions[0];
  const selectedParallelTargetOption =
    parallelTargetOptions.find(
      (option) => option.entityId === form.secondaryEntityId
    ) ?? parallelTargetOptions[0];

  if (form.kind === "horizontal" || form.kind === "vertical") {
    return (
      <div className="readonly-field">
        <span>Target</span>
        <strong>Selected line</strong>
      </div>
    );
  }

  if (form.kind === "fixed") {
    return (
      <div className="dimension-value-source">
        <label>
          Target
          <select
            value={pointTargetToValue(selectedPrimaryOption?.target)}
            disabled={disabled || primaryTargetOptions.length === 0}
            onChange={(event) => {
              const next = primaryTargetOptions.find(
                (option) =>
                  pointTargetToValue(option.target) ===
                  event.currentTarget.value
              );

              if (next) {
                onChange({
                  ...form,
                  targetRole: next.target.role,
                  coordinateX: next.coordinate?.[0] ?? form.coordinateX,
                  coordinateY: next.coordinate?.[1] ?? form.coordinateY
                });
              }
            }}
          >
            {primaryTargetOptions.map((option) => (
              <option
                key={pointTargetToValue(option.target)}
                value={pointTargetToValue(option.target)}
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
                  .value as SketchConstraintForm["coordinateMode"],
                coordinateX:
                  event.currentTarget.value === "custom"
                    ? (selectedPrimaryOption?.coordinate?.[0] ??
                      form.coordinateX)
                    : form.coordinateX,
                coordinateY:
                  event.currentTarget.value === "custom"
                    ? (selectedPrimaryOption?.coordinate?.[1] ??
                      form.coordinateY)
                    : form.coordinateY
              })
            }
          >
            <option value="current">Capture current</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {form.coordinateMode === "custom" ? (
          <>
            <NumberField
              disabled={disabled}
              label="Fixed X"
              value={form.coordinateX}
              onChange={(coordinateX) => onChange({ ...form, coordinateX })}
            />
            <NumberField
              disabled={disabled}
              label="Fixed Y"
              value={form.coordinateY}
              onChange={(coordinateY) => onChange({ ...form, coordinateY })}
            />
          </>
        ) : (
          <div className="readonly-field">
            <span>Current point</span>
            <strong>
              {formatSketchPointCoordinate(selectedPrimaryOption?.coordinate)}
            </strong>
          </div>
        )}
      </div>
    );
  }

  if (form.kind === "midpoint") {
    return (
      <div className="dimension-value-source">
        <div className="readonly-field">
          <span>Line</span>
          <strong>Selected line midpoint</strong>
        </div>
        <label>
          Target
          <select
            value={pointTargetToValue(selectedMidpointTargetOption?.target)}
            disabled={disabled || midpointTargetOptions.length === 0}
            onChange={(event) => {
              const next = midpointTargetOptions.find(
                (option) =>
                  pointTargetToValue(option.target) ===
                  event.currentTarget.value
              );

              if (next) {
                onChange({
                  ...form,
                  secondaryEntityId: next.target.entityId,
                  secondaryTargetRole: next.target.role
                });
              }
            }}
          >
            {midpointTargetOptions.map((option) => (
              <option
                key={pointTargetToValue(option.target)}
                value={pointTargetToValue(option.target)}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (isLinePairConstraintKind(form.kind)) {
    return (
      <div className="dimension-value-source">
        <div className="readonly-field">
          <span>Primary</span>
          <strong>Selected line</strong>
        </div>
        <label>
          {form.kind === "parallel" ? "Parallel to" : "Perpendicular to"}
          <select
            value={selectedParallelTargetOption?.entityId ?? ""}
            disabled={disabled || parallelTargetOptions.length === 0}
            onChange={(event) =>
              onChange({
                ...form,
                secondaryEntityId: event.currentTarget.value
              })
            }
          >
            {parallelTargetOptions.map((option) => (
              <option key={option.entityId} value={option.entityId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="dimension-value-source">
      <label>
        Primary
        <select
          value={pointTargetToValue(selectedPrimaryOption?.target)}
          disabled={disabled || primaryTargetOptions.length === 0}
          onChange={(event) => {
            const next = primaryTargetOptions.find(
              (option) =>
                pointTargetToValue(option.target) === event.currentTarget.value
            );

            if (next) {
              onChange({ ...form, targetRole: next.target.role });
            }
          }}
        >
          {primaryTargetOptions.map((option) => (
            <option
              key={pointTargetToValue(option.target)}
              value={pointTargetToValue(option.target)}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Coincident with
        <select
          value={pointTargetToValue(selectedSecondaryOption?.target)}
          disabled={disabled || coincidentTargetOptions.length === 0}
          onChange={(event) => {
            const next = coincidentTargetOptions.find(
              (option) =>
                pointTargetToValue(option.target) === event.currentTarget.value
            );

            if (next) {
              onChange({
                ...form,
                secondaryEntityId: next.target.entityId,
                secondaryTargetRole: next.target.role
              });
            }
          }}
        >
          {coincidentTargetOptions.map((option) => (
            <option
              key={pointTargetToValue(option.target)}
              value={pointTargetToValue(option.target)}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function isLinePairConstraintKind(
  kind: SketchConstraintForm["kind"] | undefined
): kind is "parallel" | "perpendicular" {
  return kind === "parallel" || kind === "perpendicular";
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
  if (!constraint) {
    return defaultSketchConstraintForm;
  }

  if (constraint.kind === "fixed") {
    return {
      ...defaultSketchConstraintForm,
      id: "",
      name: constraint.name,
      kind: "fixed",
      targetRole: constraint.target.role,
      coordinateMode: "custom",
      coordinateX: constraint.coordinate[0],
      coordinateY: constraint.coordinate[1]
    };
  }

  if (constraint.kind === "coincident") {
    return {
      ...defaultSketchConstraintForm,
      id: "",
      name: constraint.name,
      kind: "coincident",
      targetRole: constraint.primaryTarget.role,
      secondaryEntityId: constraint.secondaryTarget.entityId,
      secondaryTargetRole: constraint.secondaryTarget.role
    };
  }

  if (constraint.kind === "parallel" || constraint.kind === "perpendicular") {
    return {
      ...defaultSketchConstraintForm,
      id: "",
      name: constraint.name,
      kind: constraint.kind,
      secondaryEntityId: constraint.secondaryLineEntityId
    };
  }

  return {
    ...defaultSketchConstraintForm,
    name: constraint.name,
    kind: constraint.kind
  };
}

function targetToValue(target: SketchDimensionTarget | undefined): string {
  return target ? `${target.entityKind}:${target.role}` : "";
}

function pointTargetToValue(
  target:
    | { readonly entityId: string; readonly role: SketchPointTargetRole }
    | undefined
): string {
  return target ? `${target.entityId}:${target.role}` : "";
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
