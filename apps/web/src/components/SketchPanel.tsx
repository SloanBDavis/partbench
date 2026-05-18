import { useMemo, useState } from "react";
import type {
  CadFeatureSummary,
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
  chooseSketchPanelSelection,
  getDefaultSketchEntityKind
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
  side: "positive"
};

export function SketchPanel({
  disabled,
  sketches,
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
  const [createForm, setCreateForm] =
    useState<SketchCreateForm>(defaultCreateForm);
  const [entityForm, setEntityForm] = useState<SketchEntityForm>(
    defaultSketchEntityForm
  );
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
  const [extrudeEntityId, setExtrudeEntityId] = useState<string | undefined>();
  const [extrudeForm, setExtrudeForm] =
    useState<FeatureExtrudeForm>(defaultExtrudeForm);
  const extrudableEntities =
    selectedSketch?.entities.filter(
      (entity) => entity.kind === "rectangle" || entity.kind === "circle"
    ) ?? [];
  const effectiveExtrudeEntityId =
    extrudeEntityId &&
    extrudableEntities.some((entity) => entity.id === extrudeEntityId)
      ? extrudeEntityId
      : extrudableEntities[0]?.id;

  function editEntity(entity: SketchEntitySnapshot) {
    setEditingEntityId(entity.id);
    setEntityKind(entity.kind);
    setEntityForm(entityToSketchEntityForm(entity));
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

    onAddEntity(selectedSketch.id, entityKind, entityForm);
  }

  return (
    <section className="sketch-panel" aria-label="Sketches">
      <div className="section-heading">
        <h2>Sketches</h2>
        <span>{sketches.length}</span>
      </div>

      <div className="field-grid two">
        <label>
          Name
          <input
            type="text"
            value={createForm.name}
            disabled={disabled}
            onChange={(event) =>
              setCreateForm({ ...createForm, name: event.currentTarget.value })
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => onCreateSketch(createForm)}
      >
        Create sketch
      </button>

      {sketches.length === 0 ? (
        <p className="empty-state compact">No sketches</p>
      ) : (
        <div className="sketch-layout">
          <ul className="compact-list">
            {sketches.map((sketch) => (
              <li key={sketch.id}>
                <button
                  type="button"
                  className={
                    sketch.id === effectiveSelectedSketchId ? "selected" : ""
                  }
                  disabled={disabled}
                  onClick={() => {
                    setSelectedSketchId(sketch.id);
                    setEntityKind(getDefaultSketchEntityKind(sketch));
                  }}
                >
                  <span>{sketch.name}</span>
                  <small>
                    {sketch.plane} / {sketch.entities.length} entities
                    {sketch.attachment
                      ? ` / ${formatSketchAttachmentLabel(sketch.attachment)}`
                      : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>

          {selectedSketch && (
            <div className="sketch-detail">
              <div className="field-grid two">
                <label>
                  Rename
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
                <label>
                  Selected
                  <input type="text" value={selectedSketch.id} readOnly />
                </label>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRenameSketch(selectedSketch.id, renameValue)}
                >
                  Rename
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
                    <div>
                      <dt>Stable ID</dt>
                      <dd>{selectedSketch.attachment.faceStableId}</dd>
                    </div>
                    <div>
                      <dt>Source feature</dt>
                      <dd>{selectedSketch.attachment.sourceFeatureId}</dd>
                    </div>
                  </dl>
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

              <EntityEditor
                disabled={disabled}
                editingEntityId={editingEntityId}
                entityForm={entityForm}
                entityKind={entityKind}
                usageLabel={formatSketchEntityUsageLabel(editingEntityUsages)}
                validation={entityFormValidation}
                onCancelEdit={() => setEditingEntityId(undefined)}
                onEntityFormChange={setEntityForm}
                onEntityKindChange={setEntityKind}
                onSave={saveEntity}
              />

              <ul className="entity-list">
                {selectedSketch.entities.map((entity) => {
                  const usages = getSketchEntityExtrudeUsages(
                    features,
                    selectedSketch.id,
                    entity.id
                  );
                  const usageLabel = formatSketchEntityUsageLabel(usages);

                  return (
                    <li key={entity.id}>
                      <code>{entity.id}</code>
                      <span>{formatSketchEntity(entity)}</span>
                      {usageLabel && (
                        <small className="entity-usage">{usageLabel}</small>
                      )}
                      <div className="button-row compact">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => editEntity(entity)}
                        >
                          {usageLabel ? "Edit source" : "Edit"}
                        </button>
                        {(entity.kind === "rectangle" ||
                          entity.kind === "circle") && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => setExtrudeEntityId(entity.id)}
                          >
                            Use for extrude
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger"
                          disabled={disabled}
                          onClick={() =>
                            onDeleteEntity(selectedSketch.id, entity.id)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {extrudableEntities.length > 0 && (
                <section className="entity-editor" aria-label="Extrude feature">
                  <div className="field-grid two">
                    <label>
                      Profile
                      <select
                        value={effectiveExtrudeEntityId}
                        disabled={disabled}
                        onChange={(event) =>
                          setExtrudeEntityId(event.currentTarget.value)
                        }
                      >
                        {extrudableEntities.map((entity) => (
                          <option key={entity.id} value={entity.id}>
                            {entity.id} / {entity.kind}
                          </option>
                        ))}
                      </select>
                    </label>
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
                  <button
                    type="button"
                    disabled={disabled || !effectiveExtrudeEntityId}
                    onClick={() =>
                      effectiveExtrudeEntityId &&
                      onExtrudeEntity(
                        selectedSketch.id,
                        effectiveExtrudeEntityId,
                        extrudeForm
                      )
                    }
                  >
                    Create extrude
                  </button>
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
        <label>
          Optional ID
          <input
            type="text"
            value={entityForm.id}
            disabled={disabled || Boolean(editingEntityId)}
            onChange={(event) =>
              onEntityFormChange({
                ...entityForm,
                id: event.currentTarget.value
              })
            }
          />
        </label>
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
        {editingEntityId && (
          <button type="button" disabled={disabled} onClick={onCancelEdit}>
            Cancel edit
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
