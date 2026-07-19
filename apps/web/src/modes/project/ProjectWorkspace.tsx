import type { CadTransactionHistoryEntry } from "@web-cad/cad-core";
import type {
  CadParameterSnapshot,
  DocumentUnits,
  DocumentUnitUpdateMode,
  ProjectExportReadinessQueryResponse,
  ProjectHealthQueryResponse,
  ProjectImportReadinessQueryResponse,
  ProjectParameterEvaluationQueryResponse,
  ProjectTopologyIdentityReadinessQueryResponse
} from "@web-cad/cad-protocol";
import { useRef, useState } from "react";
import type { ParameterCreateForm, ParameterEditForm } from "../../cadCommands";
import type {
  ProjectJsonSummary,
  ProjectJsonWorkflowState
} from "../../projectJson";
import {
  getProjectOpfsCacheHealthLabel,
  getProjectOpfsCacheStatusLabel,
  type ProjectOpfsCacheStatus
} from "../../projectOpfsCache";
import {
  createProjectExportReadinessDisplay,
  getExportReadinessStatusLabel,
  type ProjectVisualizationExportDisplayStatus
} from "../../projectExportReadiness";
import type { ProjectStorageCapabilityStatus } from "../../projectStorageCapabilities";
import { createProjectTopologyIdentityDisplay } from "../../projectTopologyIdentityStatus";
import {
  createInitialProjectFileWorkflowState,
  getProjectFileDirectSaveLabel,
  getProjectFileDirtyLabel,
  getProjectFileNameLabel,
  getProjectFileStorageModeLabel,
  type ProjectFileWorkflowState
} from "../../projectWcadWorkflow";
import {
  formatTransactionDiffSummary,
  formatTransactionOps,
  formatTransactionStatus
} from "../../transactionHistoryDisplay";
import { Button } from "../../ui/Button";
import type { ProjectPageId } from "../../workbench/types";
import "./projectWorkspace.css";

const EMPTY_PARAMETER_USAGE: Readonly<Record<string, number>> = {};

export interface ProjectWorkspaceProps {
  readonly page: ProjectPageId;
  readonly disabled: boolean;
  readonly documentName: string;
  readonly units: DocumentUnits;
  readonly summary: ProjectJsonSummary;
  readonly projectFile?: ProjectFileWorkflowState;
  readonly storageCapabilities: ProjectStorageCapabilityStatus;
  readonly health?: ProjectHealthQueryResponse;
  readonly topologyIdentityReadiness?: ProjectTopologyIdentityReadinessQueryResponse;
  readonly importReadiness?: ProjectImportReadinessQueryResponse;
  readonly exportReadiness?: ProjectExportReadinessQueryResponse;
  readonly visualizationExport?: ProjectVisualizationExportDisplayStatus;
  readonly jsonDraft: string;
  readonly jsonWorkflow: ProjectJsonWorkflowState;
  readonly opfsCacheStatus: ProjectOpfsCacheStatus;
  readonly parameters: readonly CadParameterSnapshot[];
  readonly parameterEvaluation?: ProjectParameterEvaluationQueryResponse;
  readonly parameterUsageCounts?: Readonly<Record<string, number>>;
  readonly transactions: readonly CadTransactionHistoryEntry[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly message?: string;
  readonly messageTone?: "info" | "error";
  readonly onNew: () => void;
  readonly onOpenWcad: () => Promise<boolean>;
  readonly onOpenStep: () => Promise<boolean>;
  readonly onOpenWcadFileLoaded: (bytes: Uint8Array, fileName: string) => void;
  readonly onStepFileLoaded: (bytes: Uint8Array, fileName: string) => void;
  readonly onJsonFileLoaded: (text: string, fileName: string) => void;
  readonly onFileError: (message: string) => void;
  readonly onSave: () => void;
  readonly onSaveAs: () => void;
  readonly onPrepareJson: () => void;
  readonly onDownloadJson: () => void;
  readonly onJsonDraftChange: (value: string) => void;
  readonly onImportJson: () => void;
  readonly onRefreshOpfsCache: () => void;
  readonly onClearOpfsCache: () => void;
  readonly onDownloadStep: () => void;
  readonly onDownloadVisualization: () => void;
  readonly onUpdateUnits: (
    units: DocumentUnits,
    mode: DocumentUnitUpdateMode
  ) => void;
  readonly onCreateParameter: (form: ParameterCreateForm) => void;
  readonly onEditParameter: (
    parameter: CadParameterSnapshot,
    form: ParameterEditForm
  ) => void;
  readonly onDeleteParameter: (parameterId: string) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}

type ProjectWorkspacePropsWithFile = Omit<
  ProjectWorkspaceProps,
  "projectFile"
> & {
  readonly projectFile: ProjectFileWorkflowState;
};

export function ProjectWorkspace({
  page,
  disabled,
  documentName,
  units,
  summary,
  projectFile = createInitialProjectFileWorkflowState(),
  storageCapabilities,
  health,
  topologyIdentityReadiness,
  importReadiness,
  exportReadiness,
  visualizationExport,
  jsonDraft,
  jsonWorkflow,
  opfsCacheStatus,
  parameters,
  parameterEvaluation,
  parameterUsageCounts = EMPTY_PARAMETER_USAGE,
  transactions,
  canUndo,
  canRedo,
  message,
  messageTone = "info",
  onNew,
  onOpenWcad,
  onOpenStep,
  onOpenWcadFileLoaded,
  onStepFileLoaded,
  onJsonFileLoaded,
  onFileError,
  onSave,
  onSaveAs,
  onPrepareJson,
  onDownloadJson,
  onJsonDraftChange,
  onImportJson,
  onRefreshOpfsCache,
  onClearOpfsCache,
  onDownloadStep,
  onDownloadVisualization,
  onUpdateUnits,
  onCreateParameter,
  onEditParameter,
  onDeleteParameter,
  onUndo,
  onRedo
}: ProjectWorkspaceProps) {
  return (
    <section
      className="pb-project-mode-workspace"
      aria-labelledby={`pb-project-${page}-heading`}
    >
      {page === "overview" ? (
        <ProjectOverview
          key={units}
          disabled={disabled}
          documentName={documentName}
          units={units}
          summary={summary}
          projectFile={projectFile}
          health={health}
          topologyIdentityReadiness={topologyIdentityReadiness}
          exportReadiness={exportReadiness}
          onUpdateUnits={onUpdateUnits}
        />
      ) : page === "files" ? (
        <ProjectFiles
          disabled={disabled}
          projectFile={projectFile}
          storageCapabilities={storageCapabilities}
          importReadiness={importReadiness}
          jsonDraft={jsonDraft}
          jsonWorkflow={jsonWorkflow}
          opfsCacheStatus={opfsCacheStatus}
          onNew={onNew}
          onOpenWcad={onOpenWcad}
          onOpenStep={onOpenStep}
          onOpenWcadFileLoaded={onOpenWcadFileLoaded}
          onStepFileLoaded={onStepFileLoaded}
          onJsonFileLoaded={onJsonFileLoaded}
          onFileError={onFileError}
          onSave={onSave}
          onSaveAs={onSaveAs}
          onPrepareJson={onPrepareJson}
          onDownloadJson={onDownloadJson}
          onJsonDraftChange={onJsonDraftChange}
          onImportJson={onImportJson}
          onRefreshOpfsCache={onRefreshOpfsCache}
          onClearOpfsCache={onClearOpfsCache}
        />
      ) : page === "parameters" ? (
        <ProjectParameters
          disabled={disabled}
          parameters={parameters}
          evaluation={parameterEvaluation}
          usageCounts={parameterUsageCounts}
          onCreate={onCreateParameter}
          onEdit={onEditParameter}
          onDelete={onDeleteParameter}
        />
      ) : page === "history" ? (
        <ProjectHistory
          disabled={disabled}
          transactions={transactions}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      ) : (
        <ProjectExport
          disabled={disabled}
          readiness={exportReadiness}
          visualization={visualizationExport}
          onDownloadStep={onDownloadStep}
          onDownloadVisualization={onDownloadVisualization}
        />
      )}
      {message ? (
        <p
          className={`pb-project-message${
            messageTone === "error" ? " is-error" : ""
          }`}
          role={messageTone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

function ProjectOverview({
  disabled,
  documentName,
  units,
  summary,
  projectFile,
  health,
  topologyIdentityReadiness,
  exportReadiness,
  onUpdateUnits
}: Pick<
  ProjectWorkspacePropsWithFile,
  | "disabled"
  | "documentName"
  | "units"
  | "summary"
  | "projectFile"
  | "health"
  | "topologyIdentityReadiness"
  | "exportReadiness"
  | "onUpdateUnits"
>) {
  const [nextUnits, setNextUnits] = useState(units);
  const identity = topologyIdentityReadiness
    ? createProjectTopologyIdentityDisplay(topologyIdentityReadiness)
    : undefined;
  const healthLabel = health
    ? health.issueCount === 0
      ? "Healthy"
      : `${health.issueCount} ${health.issueCount === 1 ? "issue" : "issues"}`
    : "Not checked";
  const exportLabel = exportReadiness
    ? getExportReadinessStatusLabel(exportReadiness.status)
    : "Not checked";

  return (
    <>
      <ProjectPageHeading
        page="overview"
        eyebrow="Project"
        title="Document overview"
        detail="Review file state, model contents, units, and readiness in one place."
      />
      <div className="pb-project-card-grid pb-project-card-grid--overview">
        <ProjectCard
          title="Document"
          status={getProjectFileDirtyLabel(projectFile)}
        >
          <dl className="pb-project-definition-list">
            <DefinitionRow label="Name" value={documentName} />
            <DefinitionRow
              label="File"
              value={getProjectFileStorageModeLabel(projectFile.mode)}
            />
            <DefinitionRow label="Units" value={units} numeric />
          </dl>
        </ProjectCard>
        <ProjectCard title="Model" status={`${summary.objectCount} objects`}>
          <dl className="pb-project-metric-grid">
            <Metric label="Features" value={summary.authoredFeatureCount} />
            <Metric label="Sketches" value={summary.sketchCount} />
            <Metric label="Sketch entities" value={summary.sketchEntityCount} />
            <Metric
              label="Named references"
              value={summary.namedReferenceCount}
            />
          </dl>
        </ProjectCard>
        <ProjectCard title="Readiness" status={healthLabel}>
          <dl className="pb-project-definition-list">
            <DefinitionRow label="Model health" value={healthLabel} />
            <DefinitionRow label="Export" value={exportLabel} />
            <DefinitionRow
              label="Saved references"
              value={identity?.statusLabel ?? "Not checked"}
            />
          </dl>
          {identity ? (
            <p className="pb-project-card-detail">{identity.detail}</p>
          ) : null}
        </ProjectCard>
      </div>
      <ProjectCard
        title="Document units"
        status={`Current: ${units}`}
        className="pb-project-units-card"
      >
        <p className="pb-project-card-detail">
          Choose whether existing numbers keep their values or the model keeps
          its physical size.
        </p>
        <div className="pb-project-unit-controls">
          <label>
            New units
            <select
              className="pb-field"
              value={nextUnits}
              disabled={disabled}
              onChange={(event) =>
                setNextUnits(event.currentTarget.value as DocumentUnits)
              }
            >
              <option value="mm">Millimetres (mm)</option>
              <option value="cm">Centimetres (cm)</option>
              <option value="m">Metres (m)</option>
              <option value="in">Inches (in)</option>
            </select>
          </label>
          <div
            className="pb-project-unit-actions"
            aria-label="Unit update method"
          >
            <Button
              disabled={disabled || nextUnits === units}
              onClick={() => onUpdateUnits(nextUnits, "metadataOnly")}
            >
              Relabel values
            </Button>
            <Button
              disabled={disabled || nextUnits === units}
              onClick={() => onUpdateUnits(nextUnits, "preservePhysicalSize")}
            >
              Convert size
            </Button>
          </div>
        </div>
      </ProjectCard>
    </>
  );
}

function ProjectFiles({
  disabled,
  projectFile,
  storageCapabilities,
  importReadiness,
  onNew,
  onOpenWcad,
  onOpenStep,
  onOpenWcadFileLoaded,
  onStepFileLoaded,
  onJsonFileLoaded,
  onFileError,
  onSave,
  onSaveAs,
  onPrepareJson,
  onDownloadJson,
  jsonDraft,
  jsonWorkflow,
  opfsCacheStatus,
  onJsonDraftChange,
  onImportJson,
  onRefreshOpfsCache,
  onClearOpfsCache
}: Pick<
  ProjectWorkspacePropsWithFile,
  | "disabled"
  | "projectFile"
  | "storageCapabilities"
  | "importReadiness"
  | "onNew"
  | "onOpenWcad"
  | "onOpenStep"
  | "onOpenWcadFileLoaded"
  | "onStepFileLoaded"
  | "onJsonFileLoaded"
  | "onFileError"
  | "onSave"
  | "onSaveAs"
  | "onPrepareJson"
  | "onDownloadJson"
  | "jsonDraft"
  | "jsonWorkflow"
  | "opfsCacheStatus"
  | "onJsonDraftChange"
  | "onImportJson"
  | "onRefreshOpfsCache"
  | "onClearOpfsCache"
>) {
  const wcadInput = useRef<HTMLInputElement | null>(null);
  const stepInput = useRef<HTMLInputElement | null>(null);
  const jsonInput = useRef<HTMLInputElement | null>(null);
  const canOpenWcad =
    storageCapabilities.fileSystemAccessAvailable ||
    storageCapabilities.wcadUploadAvailable;
  const canSave =
    projectFile.mode === "wcadHandle" ||
    storageCapabilities.fileSystemAccessAvailable ||
    storageCapabilities.wcadDownloadAvailable;
  const canOpenStep =
    storageCapabilities.fileSystemAccessAvailable ||
    storageCapabilities.jsonUploadAvailable;

  async function openWcad(): Promise<void> {
    if (storageCapabilities.fileSystemAccessAvailable && (await onOpenWcad())) {
      return;
    }
    wcadInput.current?.click();
  }

  async function openStep(): Promise<void> {
    if (storageCapabilities.fileSystemAccessAvailable && (await onOpenStep())) {
      return;
    }
    stepInput.current?.click();
  }

  return (
    <>
      <ProjectPageHeading
        page="files"
        eyebrow="Project"
        title="Files"
        detail="Open, save, and exchange this project with supported local formats."
      />
      <div className="pb-project-card-grid">
        <ProjectCard
          title={getProjectFileNameLabel(projectFile)}
          status={getProjectFileDirtyLabel(projectFile)}
        >
          <p className="pb-project-card-detail">
            {projectFile.lastResult?.message ??
              "No project file operation yet."}
          </p>
          <div className="pb-project-action-row">
            <Button disabled={disabled} onClick={onNew}>
              New
            </Button>
            <Button
              disabled={disabled || !canOpenWcad}
              onClick={() => void openWcad()}
            >
              Open .wcad
            </Button>
            <Button
              tone="primary"
              disabled={disabled || !canSave}
              onClick={onSave}
            >
              Save
            </Button>
            <Button disabled={disabled || !canSave} onClick={onSaveAs}>
              Save As
            </Button>
          </div>
          <dl className="pb-project-definition-list">
            <DefinitionRow
              label="Storage"
              value={getProjectFileStorageModeLabel(projectFile.mode)}
            />
            <DefinitionRow
              label="Direct save"
              value={getProjectFileDirectSaveLabel(
                projectFile,
                storageCapabilities.fileSystemAccessAvailable
              )}
            />
          </dl>
        </ProjectCard>
        <ProjectCard
          title="STEP import"
          status={formatImportStatus(importReadiness?.status)}
        >
          <p className="pb-project-card-detail">
            {formatImportDetail(importReadiness)}
          </p>
          <Button
            disabled={disabled || !canOpenStep}
            onClick={() => void openStep()}
          >
            Import STEP
          </Button>
        </ProjectCard>
      </div>
      <details className="pb-project-advanced">
        <summary>Advanced Interchange</summary>
        <div className="pb-project-advanced__content">
          <p>
            JSON is a source interchange format. Use .wcad to preserve the full
            supported project package and saved shape evidence.
          </p>
          <div className="pb-project-action-row">
            <Button disabled={disabled} onClick={onPrepareJson}>
              Prepare JSON
            </Button>
            <Button
              disabled={disabled || !storageCapabilities.jsonDownloadAvailable}
              onClick={onDownloadJson}
            >
              Download JSON
            </Button>
            <Button
              disabled={disabled || !storageCapabilities.jsonUploadAvailable}
              onClick={() => jsonInput.current?.click()}
            >
              Load JSON
            </Button>
            <Button
              tone="primary"
              disabled={
                disabled || jsonWorkflow.draft.preview.status !== "valid"
              }
              onClick={onImportJson}
            >
              Import JSON
            </Button>
          </div>
          <p className="pb-project-card-detail" role="status">
            {jsonWorkflow.draft.schema.label}.{" "}
            {jsonWorkflow.draft.schema.detail}
          </p>
          <label className="pb-project-json-editor">
            <span>Project JSON draft</span>
            <textarea
              className="pb-field pb-numeric"
              value={jsonDraft}
              disabled={disabled}
              spellCheck={false}
              placeholder="Generate, load, or paste Partbench project JSON"
              onChange={(event) => onJsonDraftChange(event.currentTarget.value)}
            />
          </label>
          <details className="pb-project-advanced pb-project-advanced--compact">
            <summary>Local display cache</summary>
            <div className="pb-project-advanced__content">
              <dl className="pb-project-definition-list">
                <DefinitionRow
                  label="State"
                  value={getProjectOpfsCacheStatusLabel(opfsCacheStatus)}
                />
                <DefinitionRow
                  label="Entries"
                  value={`${opfsCacheStatus.entryCount} · ${getProjectOpfsCacheHealthLabel(opfsCacheStatus)}`}
                  numeric
                />
              </dl>
              <p className="pb-project-card-detail">
                Optional rebuildable viewport data. Clearing it does not change
                the project or its history.
              </p>
              <div className="pb-project-action-row">
                <Button disabled={disabled} onClick={onRefreshOpfsCache}>
                  Refresh cache
                </Button>
                <Button
                  tone="danger"
                  disabled={disabled || !opfsCacheStatus.available}
                  onClick={onClearOpfsCache}
                >
                  Clear cache
                </Button>
              </div>
            </div>
          </details>
        </div>
      </details>
      <input
        ref={wcadInput}
        className="pb-visually-hidden"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept="application/vnd.partbench.wcad,application/zip,.wcad"
        onChange={(event) => {
          void readBinaryFile(
            event.currentTarget.files?.[0],
            onOpenWcadFileLoaded,
            onFileError
          );
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={stepInput}
        className="pb-visually-hidden"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept=".step,.stp,model/step,application/step"
        onChange={(event) => {
          void readBinaryFile(
            event.currentTarget.files?.[0],
            onStepFileLoaded,
            onFileError
          );
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={jsonInput}
        className="pb-visually-hidden"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept="application/json,.json"
        onChange={(event) => {
          void readTextFile(
            event.currentTarget.files?.[0],
            onJsonFileLoaded,
            onFileError
          );
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}

function ProjectParameters({
  disabled,
  parameters,
  evaluation,
  usageCounts,
  onCreate,
  onEdit,
  onDelete
}: {
  readonly disabled: boolean;
  readonly parameters: readonly CadParameterSnapshot[];
  readonly evaluation?: ProjectParameterEvaluationQueryResponse;
  readonly usageCounts: Readonly<Record<string, number>>;
  readonly onCreate: (form: ParameterCreateForm) => void;
  readonly onEdit: (
    parameter: CadParameterSnapshot,
    form: ParameterEditForm
  ) => void;
  readonly onDelete: (parameterId: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<ParameterCreateForm>(
    createEmptyParameterForm
  );
  const [editingId, setEditingId] = useState<string>();
  const editingParameter = parameters.find((item) => item.id === editingId);
  const [editForm, setEditForm] = useState<ParameterEditForm>(() =>
    createParameterEditForm(undefined)
  );
  const createIssue = getCreateParameterIssue(createForm);
  const editIssue = getEditParameterIssue(editForm);

  function beginEdit(parameter: CadParameterSnapshot): void {
    setEditingId(parameter.id);
    setEditForm(createParameterEditForm(parameter));
    setCreating(false);
  }

  return (
    <>
      <ProjectPageHeading
        page="parameters"
        eyebrow="Project"
        title="Parameters"
        detail="Create reusable values and review expression evaluation before applying changes."
        actions={
          <Button
            tone="primary"
            disabled={disabled}
            onClick={() => {
              setCreating(true);
              setEditingId(undefined);
            }}
          >
            Add parameter
          </Button>
        }
      />
      <div className="pb-project-parameter-summary" role="status">
        <span>{parameters.length} parameters</span>
        <span>{evaluation?.expressionCount ?? 0} expressions</span>
        <span>
          {evaluation
            ? evaluation.status === "valid"
              ? "Evaluation valid"
              : `${evaluation.diagnosticCount} evaluation issues`
            : "Evaluation not checked"}
        </span>
      </div>
      {creating ? (
        <ParameterForm
          title="New parameter"
          name={createForm.name}
          value={createForm.value}
          description={createForm.description}
          disabled={disabled}
          issue={createIssue}
          onNameChange={(name) => setCreateForm({ ...createForm, name })}
          onValueChange={(value) => setCreateForm({ ...createForm, value })}
          onDescriptionChange={(description) =>
            setCreateForm({ ...createForm, description })
          }
          onApply={() => {
            if (!createIssue) {
              onCreate(createForm);
              setCreateForm(createEmptyParameterForm());
              setCreating(false);
            }
          }}
          onCancel={() => {
            setCreateForm(createEmptyParameterForm());
            setCreating(false);
          }}
        />
      ) : null}
      {editingParameter ? (
        <ParameterForm
          title={`Edit ${editingParameter.name}`}
          name={editForm.name}
          value={editForm.value}
          expression={editForm.expression}
          description={editForm.description}
          expressionStatus={getParameterExpressionStatus(
            editingParameter,
            evaluation
          )}
          disabled={disabled}
          issue={editIssue}
          onNameChange={(name) => setEditForm({ ...editForm, name })}
          onValueChange={(value) => setEditForm({ ...editForm, value })}
          onExpressionChange={(expression) =>
            setEditForm({ ...editForm, expression })
          }
          onDescriptionChange={(description) =>
            setEditForm({ ...editForm, description })
          }
          onApply={() => {
            if (!editIssue) {
              onEdit(editingParameter, editForm);
              setEditingId(undefined);
            }
          }}
          onCancel={() => setEditingId(undefined)}
        />
      ) : null}
      {parameters.length === 0 ? (
        <div className="pb-project-empty-state">
          <h2>No parameters yet</h2>
          <p>Add a named value to drive supported sketch dimensions.</p>
        </div>
      ) : (
        <div className="pb-project-table-wrap" tabIndex={0}>
          <table className="pb-project-table">
            <caption className="pb-visually-hidden">Project parameters</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Value</th>
                <th scope="col">Expression</th>
                <th scope="col">Status</th>
                <th scope="col">Description</th>
                <th scope="col">
                  <span className="pb-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((parameter) => {
                const usageCount = usageCounts[parameter.id] ?? 0;
                return (
                  <tr
                    key={parameter.id}
                    aria-selected={editingId === parameter.id}
                  >
                    <th scope="row">{parameter.name}</th>
                    <td className="pb-numeric">
                      {formatNumber(parameter.value)}
                    </td>
                    <td className="pb-numeric">
                      {parameter.expression || "Literal"}
                    </td>
                    <td>
                      {getParameterExpressionStatus(parameter, evaluation)}
                    </td>
                    <td>{parameter.description || "—"}</td>
                    <td>
                      <div className="pb-project-table-actions">
                        <Button
                          density="dense"
                          disabled={disabled}
                          onClick={() => beginEdit(parameter)}
                        >
                          Edit
                        </Button>
                        <Button
                          density="dense"
                          tone="danger"
                          disabled={disabled || usageCount > 0}
                          title={
                            usageCount > 0
                              ? `Used by ${usageCount} driving ${
                                  usageCount === 1 ? "dimension" : "dimensions"
                                }.`
                              : "Delete parameter"
                          }
                          onClick={() => onDelete(parameter.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ParameterForm({
  title,
  name,
  value,
  expression,
  description,
  expressionStatus,
  disabled,
  issue,
  onNameChange,
  onValueChange,
  onExpressionChange,
  onDescriptionChange,
  onApply,
  onCancel
}: {
  readonly title: string;
  readonly name: string;
  readonly value: number;
  readonly expression?: string;
  readonly description: string;
  readonly expressionStatus?: string;
  readonly disabled: boolean;
  readonly issue?: string;
  readonly onNameChange: (value: string) => void;
  readonly onValueChange: (value: number) => void;
  readonly onExpressionChange?: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}) {
  const expressionDriven = Boolean(expression?.trim());
  return (
    <form
      className="pb-project-parameter-form"
      aria-label={title}
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="pb-project-card-heading">
        <h2>{title}</h2>
        {expressionStatus ? <span>{expressionStatus}</span> : null}
      </div>
      <div className="pb-project-form-grid">
        <label>
          Name
          <input
            className="pb-field"
            value={name}
            disabled={disabled}
            required
            onChange={(event) => onNameChange(event.currentTarget.value)}
          />
        </label>
        <label>
          Value
          <input
            className="pb-field pb-numeric"
            type="number"
            value={Number.isFinite(value) ? value : ""}
            disabled={disabled || expressionDriven}
            required={!expressionDriven}
            onChange={(event) =>
              onValueChange(event.currentTarget.valueAsNumber)
            }
          />
        </label>
        {onExpressionChange ? (
          <label>
            Expression
            <input
              className="pb-field pb-numeric"
              value={expression}
              disabled={disabled}
              placeholder="width / 2"
              onChange={(event) =>
                onExpressionChange(event.currentTarget.value)
              }
            />
          </label>
        ) : null}
        <label className="pb-project-form-grid__wide">
          Description
          <input
            className="pb-field"
            value={description}
            disabled={disabled}
            placeholder="Optional"
            onChange={(event) => onDescriptionChange(event.currentTarget.value)}
          />
        </label>
      </div>
      {issue ? (
        <p className="pb-field-error" role="alert">
          {issue}
        </p>
      ) : null}
      <div className="pb-project-form-actions">
        <Button disabled={disabled} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          tone="primary"
          disabled={disabled || Boolean(issue)}
          type="submit"
        >
          Apply
        </Button>
      </div>
    </form>
  );
}

function ProjectHistory({
  disabled,
  transactions,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: Pick<
  ProjectWorkspaceProps,
  "disabled" | "transactions" | "canUndo" | "canRedo" | "onUndo" | "onRedo"
>) {
  return (
    <>
      <ProjectPageHeading
        page="history"
        eyebrow="Project"
        title="History"
        detail="Review source changes in transaction order."
        actions={
          <>
            <Button disabled={disabled || !canUndo} onClick={onUndo}>
              Undo
            </Button>
            <Button disabled={disabled || !canRedo} onClick={onRedo}>
              Redo
            </Button>
          </>
        }
      />
      {transactions.length === 0 ? (
        <div className="pb-project-empty-state">
          <h2>No changes yet</h2>
          <p>Committed modeling actions will appear here.</p>
        </div>
      ) : (
        <ol className="pb-project-history-list">
          {transactions.map((transaction, index) => (
            <li key={transaction.id} className="pb-project-history-item">
              <div className="pb-project-history-sequence" aria-hidden="true">
                {index + 1}
              </div>
              <div>
                <div className="pb-project-card-heading">
                  <h2>{formatTransactionOps(transaction.ops)}</h2>
                  <span>{formatTransactionStatus(transaction.status)}</span>
                </div>
                <p>{formatTransactionDiffSummary(transaction.diff)}</p>
                <p className="pb-project-card-detail">
                  {formatHistoryActor(transaction)}
                </p>
                <details className="pb-project-advanced pb-project-advanced--compact">
                  <summary>Technical diff</summary>
                  <pre>{JSON.stringify(transaction.diff, null, 2)}</pre>
                </details>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function ProjectExport({
  disabled,
  readiness,
  visualization,
  onDownloadStep,
  onDownloadVisualization
}: {
  readonly disabled: boolean;
  readonly readiness?: ProjectExportReadinessQueryResponse;
  readonly visualization?: ProjectVisualizationExportDisplayStatus;
  readonly onDownloadStep: () => void;
  readonly onDownloadVisualization: () => void;
}) {
  const display = readiness
    ? createProjectExportReadinessDisplay(readiness, visualization)
    : undefined;
  const step = display?.formatRows.find((row) => row.id === "step");
  const visualizationRow = display?.formatRows.find((row) => row.id === "glb");

  return (
    <>
      <ProjectPageHeading
        page="export"
        eyebrow="Project"
        title="Export"
        detail="Create an exact STEP file or a visualization mesh when the current model is ready."
      />
      {!display ? (
        <div className="pb-project-empty-state">
          <h2>Export readiness unavailable</h2>
          <p>
            Readiness will appear after the current document has been checked.
          </p>
        </div>
      ) : (
        <div className="pb-project-card-grid">
          <ProjectCard
            title="STEP"
            status={step?.statusLabel ?? display.statusLabel}
          >
            <p className="pb-project-card-detail">
              {step?.detail ??
                "Exact STEP export uses supported source bodies."}
            </p>
            {step?.status !== "supported" ? (
              <p className="pb-project-blocked-reason">{step?.limitation}</p>
            ) : null}
            <Button
              tone="primary"
              disabled={disabled || !readiness?.canExportFiles}
              onClick={onDownloadStep}
            >
              Download STEP
            </Button>
          </ProjectCard>
          <ProjectCard
            title="Visualization GLB"
            status={visualizationRow?.statusLabel ?? "Not ready"}
          >
            <p className="pb-project-card-detail">
              {visualizationRow?.detail ??
                "Visualization export needs ready display geometry."}
            </p>
            {visualizationRow?.status !== "supported" ? (
              <p className="pb-project-blocked-reason">
                {visualizationRow?.limitation ?? "No ready display geometry."}
              </p>
            ) : null}
            <Button
              disabled={
                disabled ||
                visualization?.status !== "supported" ||
                !visualization.available
              }
              onClick={onDownloadVisualization}
            >
              Download visualization GLB
            </Button>
          </ProjectCard>
        </div>
      )}
      {display?.bodyRows.length ? (
        <details className="pb-project-advanced">
          <summary>Body readiness ({display.bodyRows.length})</summary>
          <ul className="pb-project-readiness-list">
            {display.bodyRows.map((row) => (
              <li key={row.id}>
                <div className="pb-project-card-heading">
                  <strong>{row.label}</strong>
                  <span>{row.statusLabel}</span>
                </div>
                <p>{row.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function ProjectPageHeading({
  page,
  eyebrow,
  title,
  detail,
  actions
}: {
  readonly page: ProjectPageId;
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  readonly actions?: React.ReactNode;
}) {
  return (
    <header className="pb-project-page-heading">
      <div>
        <p>{eyebrow}</p>
        <h1 id={`pb-project-${page}-heading`}>{title}</h1>
        <span>{detail}</span>
      </div>
      {actions ? (
        <div className="pb-project-heading-actions">{actions}</div>
      ) : null}
    </header>
  );
}

function ProjectCard({
  title,
  status,
  className,
  children
}: {
  readonly title: string;
  readonly status?: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section
      className={["pb-project-card", className].filter(Boolean).join(" ")}
    >
      <div className="pb-project-card-heading">
        <h2>{title}</h2>
        {status ? <span>{status}</span> : null}
      </div>
      {children}
    </section>
  );
}

function DefinitionRow({
  label,
  value,
  numeric = false
}: {
  readonly label: string;
  readonly value: string;
  readonly numeric?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={numeric ? "pb-numeric" : undefined}>{value}</dd>
    </div>
  );
}

function Metric({
  label,
  value
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="pb-numeric">{value}</dd>
    </div>
  );
}

function createEmptyParameterForm(): ParameterCreateForm {
  return { id: "", name: "", value: 1, description: "" };
}

export function createParameterEditForm(
  parameter: CadParameterSnapshot | undefined
): ParameterEditForm {
  return {
    name: parameter?.name ?? "",
    value: parameter?.value ?? 1,
    expression: parameter?.expression ?? "",
    description: parameter?.description ?? ""
  };
}

export function getCreateParameterIssue(
  form: ParameterCreateForm
): string | undefined {
  if (!form.name.trim()) {
    return "Enter a parameter name.";
  }
  return Number.isFinite(form.value) ? undefined : "Enter a finite value.";
}

export function getEditParameterIssue(
  form: ParameterEditForm
): string | undefined {
  if (!form.name.trim()) {
    return "Enter a parameter name.";
  }
  return form.expression.trim() || Number.isFinite(form.value)
    ? undefined
    : "Enter a finite value or an expression.";
}

export function getParameterExpressionStatus(
  parameter: CadParameterSnapshot,
  evaluation: ProjectParameterEvaluationQueryResponse | undefined
): string {
  if (!parameter.expression) {
    return "Literal";
  }
  const node = evaluation?.nodes.find(
    (candidate) => candidate.parameterId === parameter.id
  );
  if (!node) {
    return "Not checked";
  }
  if (
    node.diagnostics.some(
      (item) => item.code === "PARAMETER_CIRCULAR_REFERENCE"
    )
  ) {
    return "Circular reference";
  }
  return node.diagnostics.length > 0 ? "Invalid" : "Valid";
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toPrecision(8).replace(/0+$/, "");
}

function formatHistoryActor(transaction: CadTransactionHistoryEntry): string {
  const actor = transaction.actor;
  if (!actor) return "Unknown actor";
  if (actor.name) return actor.name;
  if (actor.type === "human") return "Human action";
  if (actor.type === "agent") return "Agent action";
  if (actor.type === "script") return "Scripted action";
  return "System action";
}

function formatImportStatus(
  status: ProjectImportReadinessQueryResponse["status"] | undefined
): string {
  if (!status) return "Not checked";
  if (status === "supported") return "Ready";
  if (status === "deferred") return "Not ready yet";
  return "Unavailable";
}

function formatImportDetail(
  readiness: ProjectImportReadinessQueryResponse | undefined
): string {
  if (!readiness) {
    return "Import readiness will be checked before a STEP file is committed.";
  }
  if (readiness.status === "supported") {
    return `STEP import is ready. This project currently contains ${readiness.importedBodyCount} imported ${
      readiness.importedBodyCount === 1 ? "body" : "bodies"
    }.`;
  }
  return (
    readiness.diagnostics.find((item) => item.severity === "blocking")
      ?.message ?? "Select a STEP file to review import diagnostics."
  );
}

async function readBinaryFile(
  file: File | undefined,
  onLoaded: (bytes: Uint8Array, fileName: string) => void,
  onError: (message: string) => void
): Promise<void> {
  if (!file) return;
  try {
    onLoaded(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch {
    onError(`Could not read ${file.name}.`);
  }
}

async function readTextFile(
  file: File | undefined,
  onLoaded: (text: string, fileName: string) => void,
  onError: (message: string) => void
): Promise<void> {
  if (!file) return;
  try {
    onLoaded(await file.text(), file.name);
  } catch {
    onError(`Could not read ${file.name}.`);
  }
}
