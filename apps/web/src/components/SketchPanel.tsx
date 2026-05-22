import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CadFeatureSummary,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchPlane,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type {
  FeatureExtrudeForm,
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
  getAddOperationStatus,
  getCutOperationStatus,
  getDefaultSketchEntityKind,
  getSketchEntityOptionLabel,
  isExtrudableSketchEntity,
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

export interface SketchPanelProps {
  readonly disabled: boolean;
  readonly sketches: readonly SketchSnapshot[];
  readonly displayStatuses?: ReadonlyMap<string, SketchDisplayStatus>;
  readonly addTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly cutTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly focusedSketchId?: string;
  readonly features: readonly CadFeatureSummary[];
  readonly onCreateSketch: (form: SketchCreateForm) => void;
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
  addTargetBodies = [],
  cutTargetBodies = [],
  displayStatuses,
  focusedSketchId,
  features,
  onCreateSketch,
  onRenameSketch,
  onDeleteSketch,
  onAddEntity,
  onUpdateEntity,
  onDeleteEntity,
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
  const effectiveSelectedEntityId = chooseSketchEntitySelection(
    selectedSketch?.entities ?? [],
    selectedEntityId
  );
  const selectedEntity = selectedSketch?.entities.find(
    (entity) => entity.id === effectiveSelectedEntityId
  );
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
