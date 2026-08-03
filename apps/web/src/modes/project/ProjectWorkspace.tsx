import type { CadProject, CadTransactionHistoryEntry } from "@web-cad/cad-core";
import type { CadAgentCommitProposal } from "@web-cad/agent-adapter";
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
import { useEffect, useMemo, useRef, useState } from "react";
import type { ParameterCreateForm, ParameterEditForm } from "../../cadCommands";
import {
  createProjectJsonWorkflowState,
  type ProjectJsonDraftSource,
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
import type { ProjectExactStepExportJobState } from "../../projectExactStepExport";
import {
  approveLocalAgentProposal,
  rejectLocalAgentProposal,
  setLocalAgentApprovalMode,
  useLocalAgentSession
} from "../../localAgentSessionStore";
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
import { NumericInput } from "../../ui/NumericInput";
import type { ProjectPageId } from "../../workbench/types";
import { formatProjectHealthSummary } from "./projectHealthSummary";
import {
  createParameterEditForm,
  getCreateParameterIssue,
  getEditParameterIssue,
  getParameterExpressionStatus
} from "./projectParameterForms";
import "./projectWorkspace.css";

const EMPTY_PARAMETER_USAGE: Readonly<Record<string, number>> = {};

/** Blocked-state copy for Project file/history/export actions (aria-disabled). */
export const PROJECT_ACTION_UNAVAILABLE = {
  openWcad: "This browser cannot open .wcad files.",
  save: "This browser cannot save directly to a file. Use Save As to download a copy.",
  saveAs: "This browser cannot download a .wcad project file.",
  importStep: "This browser cannot import STEP files.",
  downloadJson: "This browser cannot download JSON files.",
  loadJson: "This browser cannot load JSON files from disk.",
  downloadStep: "Exact STEP export is not available for the current model.",
  downloadGlb: "Visualization export needs ready display geometry.",
  undo: "There is nothing to undo.",
  redo: "There is nothing to redo."
} as const;

export interface ProjectWorkspaceProps {
  readonly page: ProjectPageId;
  readonly disabled: boolean;
  readonly documentName: string;
  readonly units: DocumentUnits;
  readonly currentProject: CadProject;
  readonly summary?: ProjectJsonSummary;
  readonly projectFile?: ProjectFileWorkflowState;
  readonly storageCapabilities: ProjectStorageCapabilityStatus;
  readonly health?: ProjectHealthQueryResponse;
  readonly topologyIdentityReadiness?: ProjectTopologyIdentityReadinessQueryResponse;
  readonly importReadiness?: ProjectImportReadinessQueryResponse;
  readonly exportReadiness?: ProjectExportReadinessQueryResponse;
  readonly selectedBodyId?: string;
  readonly exactStepExportJob: ProjectExactStepExportJobState;
  readonly visualizationExport?: ProjectVisualizationExportDisplayStatus;
  readonly jsonDraft: string;
  readonly jsonDraftSource: ProjectJsonDraftSource;
  readonly jsonWorkflow?: ProjectJsonWorkflowState;
  readonly opfsCacheStatus: ProjectOpfsCacheStatus;
  readonly parameters: readonly CadParameterSnapshot[];
  readonly parameterEvaluation?: ProjectParameterEvaluationQueryResponse;
  readonly parameterUsageCounts?: Readonly<Record<string, number>>;
  readonly transactions: readonly CadTransactionHistoryEntry[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly message?: string;
  readonly messageTone?: "info" | "error";
  /** Surfaces blocked-action reasons when aria-disabled controls are activated. */
  readonly onUnavailableActivate?: (reason: string) => void;
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
  readonly onDownloadStep: (bodyIds?: readonly string[]) => void;
  readonly onCancelStep: () => void;
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
  "jsonWorkflow" | "projectFile" | "summary"
> & {
  readonly jsonWorkflow: ProjectJsonWorkflowState;
  readonly projectFile: ProjectFileWorkflowState;
  readonly summary: ProjectJsonSummary;
};

export function ProjectWorkspace({
  page,
  disabled,
  documentName,
  units,
  currentProject,
  summary: suppliedSummary,
  projectFile = createInitialProjectFileWorkflowState(),
  storageCapabilities,
  health,
  topologyIdentityReadiness,
  importReadiness,
  exportReadiness,
  selectedBodyId,
  exactStepExportJob,
  visualizationExport,
  jsonDraft,
  jsonDraftSource,
  jsonWorkflow: suppliedJsonWorkflow,
  opfsCacheStatus,
  parameters,
  parameterEvaluation,
  parameterUsageCounts = EMPTY_PARAMETER_USAGE,
  transactions,
  canUndo,
  canRedo,
  message,
  messageTone = "info",
  onUnavailableActivate,
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
  onCancelStep,
  onDownloadVisualization,
  onUpdateUnits,
  onCreateParameter,
  onEditParameter,
  onDeleteParameter,
  onUndo,
  onRedo
}: ProjectWorkspaceProps) {
  const jsonWorkflow = useMemo(
    () =>
      suppliedJsonWorkflow ??
      createProjectJsonWorkflowState({
        currentProject,
        draftJson: jsonDraft,
        draftSource: jsonDraftSource
      }),
    [currentProject, jsonDraft, jsonDraftSource, suppliedJsonWorkflow]
  );
  const summary = suppliedSummary ?? jsonWorkflow.current.summary;

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
          onUnavailableActivate={onUnavailableActivate}
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
          onUnavailableActivate={onUnavailableActivate}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      ) : page === "agent" ? (
        <ProjectAgent disabled={disabled} />
      ) : (
        <ProjectExport
          key={exportReadiness?.bodies.map((body) => body.bodyId).join("\0")}
          disabled={disabled}
          readiness={exportReadiness}
          selectedBodyId={selectedBodyId}
          job={exactStepExportJob}
          visualization={visualizationExport}
          onUnavailableActivate={onUnavailableActivate}
          onDownloadStep={onDownloadStep}
          onCancelStep={onCancelStep}
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

function ProjectAgent({ disabled }: { readonly disabled: boolean }) {
  const agent = useLocalAgentSession();
  const proposalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (agent.proposal) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      proposalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [agent.proposal]);

  return (
    <>
      <ProjectPageHeading
        page="agent"
        eyebrow="Project"
        title="Agent"
        detail="Review commands from the authenticated local Partbench agent session."
      />
      <div className="pb-project-card-grid">
        <ProjectCard
          title="Local session"
          status={agent.connected ? "Connected" : "Disconnected"}
        >
          <p className="pb-project-card-detail">
            {agent.connected
              ? "The local relay is connected to this browser tab and its current project."
              : "Start Partbench from the local MCP server to connect an agent session."}
          </p>
          {agent.diagnostic ? (
            <p
              className="pb-project-blocked-reason"
              role={agent.connected ? "status" : "alert"}
            >
              {agent.diagnostic.message} ({agent.diagnostic.code})
            </p>
          ) : null}
        </ProjectCard>
        <ProjectCard title="Approval mode" status="Session only">
          <fieldset className="pb-project-agent-modes">
            <legend>Agent commit approval</legend>
            <label>
              <input
                type="radio"
                name="agent-approval-mode"
                value="manualApproval"
                checked={agent.approvalMode === "manualApproval"}
                disabled={
                  disabled ||
                  !agent.connected ||
                  Boolean(agent.proposal) ||
                  agent.approving
                }
                onChange={() => setLocalAgentApprovalMode("manualApproval")}
              />
              <span>
                <strong>Manual approval</strong>
                Review every proposed commit before it changes the project.
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="agent-approval-mode"
                value="approveAll"
                checked={agent.approvalMode === "approveAll"}
                disabled={
                  disabled ||
                  !agent.connected ||
                  Boolean(agent.proposal) ||
                  agent.approving
                }
                onChange={() => {
                  if (
                    window.confirm(
                      "Approve every valid agent commit for this browser session?"
                    )
                  ) {
                    setLocalAgentApprovalMode("approveAll");
                  }
                }}
              />
              <span>
                <strong>Approve all</strong>
                Commit valid agent batches immediately for this session.
              </span>
            </label>
          </fieldset>
        </ProjectCard>
      </div>
      {agent.proposal ? (
        <div
          ref={proposalRef}
          className="pb-project-agent-proposal"
          tabIndex={-1}
          aria-labelledby="pb-agent-proposal-heading"
        >
          <div className="pb-project-card-heading">
            <h2 id="pb-agent-proposal-heading">Commit proposal</h2>
            <span>{agent.proposal.review.operationCount} operations</span>
          </div>
          <p className="pb-project-card-detail">
            {formatAgentEntityChanges(agent.proposal)}
          </p>
          <ol className="pb-project-agent-operations">
            {agent.proposal.review.operations.map((operation) => (
              <li key={`${operation.index}:${operation.op}`}>
                <strong>{operation.label}</strong>
                {operation.destructive ? <span>Destructive</span> : null}
              </li>
            ))}
          </ol>
          {agent.proposal.warnings.length > 0 ||
          agent.proposal.review.hints.length > 0 ? (
            <AgentNoticeList
              title="Warnings and review notes"
              notices={[
                ...agent.proposal.warnings,
                ...agent.proposal.review.hints.map((notice) => notice.message)
              ]}
            />
          ) : null}
          {agent.proposal.review.blockers.length > 0 ? (
            <AgentNoticeList
              title="Blockers"
              notices={agent.proposal.review.blockers.map(
                (notice) => notice.message
              )}
            />
          ) : null}
          <details className="pb-project-advanced pb-project-advanced--compact">
            <summary>Technical details</summary>
            <pre>
              {JSON.stringify(
                {
                  requestId: agent.proposal.requestId,
                  sourceIdentity: agent.proposal.sourceIdentity,
                  actor: agent.proposal.actor,
                  audit: agent.proposal.audit,
                  reviewAudit: agent.proposal.review.audit,
                  semanticDiff: agent.proposal.semanticDiff
                },
                null,
                2
              )}
            </pre>
          </details>
          <div className="pb-project-form-actions">
            <Button
              disabled={disabled || !agent.connected || agent.approving}
              onClick={rejectLocalAgentProposal}
            >
              Reject
            </Button>
            <Button
              tone="primary"
              disabled={
                disabled ||
                !agent.connected ||
                agent.approving ||
                agent.proposal.review.blockers.length > 0
              }
              onClick={approveLocalAgentProposal}
            >
              {agent.approving ? "Approving…" : "Approve"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="pb-project-empty-state">
          <h2>No commit awaiting approval</h2>
          <p>
            Agent queries and dry runs remain available while this page is open.
          </p>
        </div>
      )}
    </>
  );
}

function AgentNoticeList({
  title,
  notices
}: {
  readonly title: string;
  readonly notices: readonly string[];
}) {
  return (
    <section className="pb-project-agent-notices">
      <h3>{title}</h3>
      <ul>
        {notices.map((notice, index) => (
          <li key={`${index}:${notice}`}>{notice}</li>
        ))}
      </ul>
    </section>
  );
}

function formatAgentEntityChanges(proposal: CadAgentCommitProposal): string {
  const counts = Object.values(proposal.review.entityChanges).reduce(
    (total, count) => ({
      created: total.created + count.created,
      modified: total.modified + count.modified,
      deleted: total.deleted + count.deleted
    }),
    { created: 0, modified: 0, deleted: 0 }
  );
  return `${counts.created} created, ${counts.modified} modified, ${counts.deleted} deleted.`;
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
  const healthLabel = formatProjectHealthSummary(health);
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
  onUnavailableActivate,
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
  | "onUnavailableActivate"
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
  const openWcadReason = canOpenWcad
    ? undefined
    : PROJECT_ACTION_UNAVAILABLE.openWcad;
  const saveReason = canSave ? undefined : PROJECT_ACTION_UNAVAILABLE.save;
  const saveAsReason = canSave ? undefined : PROJECT_ACTION_UNAVAILABLE.saveAs;
  const importStepReason = canOpenStep
    ? undefined
    : PROJECT_ACTION_UNAVAILABLE.importStep;
  const downloadJsonReason = storageCapabilities.jsonDownloadAvailable
    ? undefined
    : PROJECT_ACTION_UNAVAILABLE.downloadJson;
  const loadJsonReason = storageCapabilities.jsonUploadAvailable
    ? undefined
    : PROJECT_ACTION_UNAVAILABLE.loadJson;

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
              disabled={disabled}
              unavailableReason={openWcadReason}
              onUnavailableActivate={onUnavailableActivate}
              onClick={() => void openWcad()}
            >
              Open .wcad
            </Button>
            <Button
              tone="primary"
              disabled={disabled}
              unavailableReason={saveReason}
              onUnavailableActivate={onUnavailableActivate}
              onClick={onSave}
            >
              Save
            </Button>
            <Button
              disabled={disabled}
              unavailableReason={saveAsReason}
              onUnavailableActivate={onUnavailableActivate}
              onClick={onSaveAs}
            >
              Save as
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
            disabled={disabled}
            unavailableReason={importStepReason}
            onUnavailableActivate={onUnavailableActivate}
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
              disabled={disabled}
              unavailableReason={downloadJsonReason}
              onUnavailableActivate={onUnavailableActivate}
              onClick={onDownloadJson}
            >
              Download JSON
            </Button>
            <Button
              disabled={disabled}
              unavailableReason={loadJsonReason}
              onUnavailableActivate={onUnavailableActivate}
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
          <NumericInput
            className="pb-field pb-numeric"
            value={value}
            disabled={disabled || expressionDriven}
            required={!expressionDriven}
            onValueChange={onValueChange}
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
  onUnavailableActivate,
  onUndo,
  onRedo
}: Pick<
  ProjectWorkspaceProps,
  | "disabled"
  | "transactions"
  | "canUndo"
  | "canRedo"
  | "onUnavailableActivate"
  | "onUndo"
  | "onRedo"
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
            <Button
              disabled={disabled}
              unavailableReason={
                canUndo ? undefined : PROJECT_ACTION_UNAVAILABLE.undo
              }
              onUnavailableActivate={onUnavailableActivate}
              onClick={onUndo}
            >
              Undo
            </Button>
            <Button
              disabled={disabled}
              unavailableReason={
                canRedo ? undefined : PROJECT_ACTION_UNAVAILABLE.redo
              }
              onUnavailableActivate={onUnavailableActivate}
              onClick={onRedo}
            >
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
  selectedBodyId,
  job,
  visualization,
  onUnavailableActivate,
  onDownloadStep,
  onCancelStep,
  onDownloadVisualization
}: {
  readonly disabled: boolean;
  readonly readiness?: ProjectExportReadinessQueryResponse;
  readonly selectedBodyId?: string;
  readonly job: ProjectExactStepExportJobState;
  readonly visualization?: ProjectVisualizationExportDisplayStatus;
  readonly onUnavailableActivate?: (reason: string) => void;
  readonly onDownloadStep: (bodyIds?: readonly string[]) => void;
  readonly onCancelStep: () => void;
  readonly onDownloadVisualization: () => void;
}) {
  const display = readiness
    ? createProjectExportReadinessDisplay(readiness, visualization)
    : undefined;
  const step = display?.formatRows.find((row) => row.id === "step");
  const visualizationRow = display?.formatRows.find((row) => row.id === "glb");
  const canExportStep = Boolean(readiness?.canExportFiles);
  const canExportGlb =
    visualization?.status === "supported" && visualization.available;
  const [chosenBodyIds, setChosenBodyIds] = useState<readonly string[]>(
    () => readiness?.bodies.map((body) => body.bodyId) ?? []
  );
  const actionRowRef = useRef<HTMLDivElement>(null);
  const previousJobStatus = useRef(job.status);
  const running = job.status === "running";
  const bodiesById = new Map(
    readiness?.bodies.map((body) => [body.bodyId, body] as const)
  );
  const orderedBodies = [
    ...chosenBodyIds.flatMap((bodyId) => {
      const body = bodiesById.get(bodyId);
      return body ? [body] : [];
    }),
    ...(readiness?.bodies.filter(
      (body) => !chosenBodyIds.includes(body.bodyId)
    ) ?? [])
  ];
  const selectedBodyAvailable = Boolean(
    selectedBodyId && bodiesById.has(selectedBodyId)
  );
  const readySubset = readiness?.readySubset;
  const mixedReadySubset =
    readySubset && readySubset.excludedBodies.length > 0
      ? readySubset
      : undefined;

  useEffect(() => {
    if (previousJobStatus.current === "running" && job.status !== "running") {
      queueMicrotask(() =>
        actionRowRef.current
          ?.querySelector<HTMLButtonElement>("button")
          ?.focus()
      );
    }
    previousJobStatus.current = job.status;
  }, [job.status]);

  useEffect(() => {
    if (!running) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancelStep();
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [onCancelStep, running]);

  function toggleChosenBody(bodyId: string) {
    setChosenBodyIds((current) =>
      current.includes(bodyId)
        ? current.filter((candidate) => candidate !== bodyId)
        : [...current, bodyId]
    );
  }

  function moveChosenBody(bodyId: string, offset: -1 | 1) {
    setChosenBodyIds((current) => {
      const index = current.indexOf(bodyId);
      const destination = index + offset;
      if (index < 0 || destination < 0 || destination >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  }
  const downloadStepReason = canExportStep
    ? undefined
    : PROJECT_ACTION_UNAVAILABLE.downloadStep;
  const downloadGlbReason = canExportGlb
    ? undefined
    : PROJECT_ACTION_UNAVAILABLE.downloadGlb;

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
              Named STEP AP242DIS · {readiness?.units} · project body names ·
              chosen order preserved.
            </p>
            <p className="pb-project-card-detail">
              STEP export is all-or-nothing: every requested body must be ready.
              Remove blocked bodies from the chooser to re-plan an explicit
              subset.
            </p>
            {step?.status !== "supported" ? (
              <p className="pb-project-blocked-reason">{step?.limitation}</p>
            ) : null}
            <div className="pb-project-action-row" ref={actionRowRef}>
              <Button
                tone="primary"
                disabled={disabled || running}
                unavailableReason={downloadStepReason}
                onUnavailableActivate={onUnavailableActivate}
                onClick={() => onDownloadStep()}
              >
                Export all bodies
              </Button>
              <Button
                disabled={disabled || running}
                unavailableReason={
                  selectedBodyAvailable
                    ? undefined
                    : "Select an active semantic body before exporting it."
                }
                onUnavailableActivate={onUnavailableActivate}
                onClick={() =>
                  selectedBodyId && onDownloadStep([selectedBodyId])
                }
              >
                Export selected body
              </Button>
              <Button
                disabled={disabled || running}
                unavailableReason={
                  chosenBodyIds.length > 0
                    ? undefined
                    : "Choose at least one body before exporting the subset."
                }
                onUnavailableActivate={onUnavailableActivate}
                onClick={() => onDownloadStep(chosenBodyIds)}
              >
                Export chosen bodies
              </Button>
              {mixedReadySubset ? (
                <Button
                  disabled={disabled || running}
                  onClick={() =>
                    onDownloadStep(mixedReadySubset.orderedBodyIds)
                  }
                >
                  Export {mixedReadySubset.includedBodies.length} ready bod
                  {mixedReadySubset.includedBodies.length === 1 ? "y" : "ies"}
                </Button>
              ) : null}
            </div>
            {mixedReadySubset ? (
              <section
                className="pb-project-export-subset-review"
                aria-labelledby="pb-project-ready-subset-heading"
              >
                <h3 id="pb-project-ready-subset-heading">
                  Explicit ready subset
                </h3>
                <p>
                  Named STEP AP242DIS · {readiness.units} · names preserved ·
                  all-or-nothing for the included bodies.
                </p>
                <p>
                  Included in canonical order:{" "}
                  {mixedReadySubset.includedBodies
                    .map((body) => `${body.bodyName} (${body.bodyId})`)
                    .join(" → ")}
                </p>
                <ul>
                  {mixedReadySubset.excludedBodies.map((body) => (
                    <li key={body.bodyId}>
                      Excluded {body.bodyName} ({body.bodyId}):{" "}
                      {body.diagnostics[0]?.message ??
                        "The current exact result is not ready."}
                    </li>
                  ))}
                </ul>
                <a href="#pb-project-ordered-body-chooser">
                  Choose a different ordered subset
                </a>
              </section>
            ) : null}
            <fieldset
              id="pb-project-ordered-body-chooser"
              className="pb-project-export-chooser"
              disabled={disabled || running}
            >
              <legend>Ordered body chooser</legend>
              <p>
                {chosenBodyIds.length === 0
                  ? "No bodies chosen."
                  : `${chosenBodyIds.length} chosen: ${chosenBodyIds
                      .map(
                        (bodyId) => bodiesById.get(bodyId)?.bodyName ?? bodyId
                      )
                      .join(" → ")}`}
              </p>
              <ol className="pb-project-export-body-list">
                {orderedBodies.map((body) => {
                  const chosenIndex = chosenBodyIds.indexOf(body.bodyId);
                  const chosen = chosenIndex >= 0;
                  return (
                    <li key={body.bodyId}>
                      <label>
                        <input
                          type="checkbox"
                          checked={chosen}
                          onChange={() => toggleChosenBody(body.bodyId)}
                        />
                        <span>
                          {chosen ? `${chosenIndex + 1}. ` : ""}
                          {body.bodyName ?? body.bodyId}
                        </span>
                      </label>
                      <span>{getExportReadinessStatusLabel(body.status)}</span>
                      <div className="pb-project-table-actions">
                        <Button
                          density="dense"
                          disabled={!chosen || chosenIndex === 0}
                          aria-label={`Move ${body.bodyName ?? body.bodyId} earlier`}
                          onClick={() => moveChosenBody(body.bodyId, -1)}
                        >
                          Earlier
                        </Button>
                        <Button
                          density="dense"
                          disabled={
                            !chosen || chosenIndex === chosenBodyIds.length - 1
                          }
                          aria-label={`Move ${body.bodyName ?? body.bodyId} later`}
                          onClick={() => moveChosenBody(body.bodyId, 1)}
                        >
                          Later
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </fieldset>
            {running ? (
              <div
                className="pb-project-export-progress"
                role="status"
                aria-live="polite"
              >
                <progress
                  max={Math.max(1, job.totalBodyCount)}
                  value={job.completedBodyCount}
                />
                <p>{job.message}</p>
                <Button tone="danger" onClick={onCancelStep}>
                  Cancel export
                </Button>
              </div>
            ) : job.status !== "idle" ? (
              <div
                className="pb-project-export-result"
                role={job.status === "failed" ? "alert" : "status"}
                aria-live={job.status === "failed" ? "assertive" : "polite"}
              >
                <p>{job.message}</p>
                {job.status === "failed" || job.status === "cancelled" ? (
                  <Button onClick={() => onDownloadStep(job.requestedBodyIds)}>
                    Retry export
                  </Button>
                ) : null}
                {job.diagnostics.length > 0 ? (
                  <details>
                    <summary>Technical diagnostics</summary>
                    <ul>
                      {job.diagnostics.map((diagnostic, index) => (
                        <li
                          key={`${diagnostic.code}-${diagnostic.bodyId ?? index}`}
                        >
                          <code>{diagnostic.code}</code>: {diagnostic.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
            {readiness?.diagnostics.length ? (
              <details className="pb-project-advanced pb-project-advanced--compact">
                <summary>Readiness diagnostics</summary>
                <ul>
                  {readiness?.diagnostics.map((diagnostic, index) => (
                    <li
                      key={`${diagnostic.code}-${diagnostic.bodyId ?? index}`}
                    >
                      <code>{diagnostic.code}</code>: {diagnostic.message}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
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
              disabled={disabled}
              unavailableReason={downloadGlbReason}
              onUnavailableActivate={onUnavailableActivate}
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
                {readiness?.bodies.find((body) => body.bodyId === row.id)
                  ?.diagnostics.length ? (
                  <details>
                    <summary>Technical diagnostics</summary>
                    <ul>
                      {readiness?.bodies
                        .find((body) => body.bodyId === row.id)
                        ?.diagnostics.map((diagnostic, index) => (
                          <li key={`${diagnostic.code}-${index}`}>
                            <code>{diagnostic.code}</code>: {diagnostic.message}
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
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
