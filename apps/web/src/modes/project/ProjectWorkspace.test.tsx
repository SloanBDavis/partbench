import type { CadProject } from "@web-cad/cad-core";
import type {
  CadParameterSnapshot,
  ProjectExportReadinessQueryResponse,
  ProjectParameterEvaluationQueryResponse
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ProjectJsonSummary,
  ProjectJsonWorkflowState
} from "../../projectJson";
import { createInitialProjectOpfsCacheStatus } from "../../projectOpfsCache";
import { createProjectStorageCapabilityStatus } from "../../projectStorageCapabilities";
import type { ProjectPageId } from "../../workbench/types";
import {
  ProjectWorkspace,
  PROJECT_ACTION_UNAVAILABLE,
  type ProjectWorkspaceProps
} from "./ProjectWorkspace";
import { formatProjectHealthSummary } from "./projectHealthSummary";
import {
  createParameterEditForm,
  getCreateParameterIssue,
  getEditParameterIssue,
  getParameterExpressionStatus
} from "./projectParameterForms";

const summary: ProjectJsonSummary = {
  schemaVersion: "web-cad.project.v21",
  units: "mm",
  objectCount: 7,
  objectKindSummary: "2 authored features and 5 objects",
  sketchCount: 2,
  sketchEntityCount: 9,
  authoredFeatureCount: 2,
  namedReferenceCount: 1,
  transactionCount: 3,
  redoTransactionCount: 0
};

const widthParameter = {
  id: "parameter_width",
  name: "width",
  value: 24,
  description: "Overall width"
} satisfies CadParameterSnapshot;
const halfWidthParameter = {
  id: "parameter_half",
  name: "halfWidth",
  value: 12,
  expression: "width / 2"
} satisfies CadParameterSnapshot;
const parameters = [widthParameter, halfWidthParameter] as const;

const jsonWorkflow: ProjectJsonWorkflowState = {
  current: {
    summary,
    sourceLabel: "Current project",
    sourceDetail: "The open Partbench document."
  },
  draft: {
    source: {
      kind: "empty",
      label: "No JSON draft",
      detail: "Generate or load JSON to begin."
    },
    preview: { status: "empty" },
    schema: {
      status: "empty",
      label: "No JSON draft",
      detail: "Generate or load JSON to validate it."
    },
    validationIssues: []
  }
};
const currentProject = {
  schemaVersion: "web-cad.project.v21",
  document: {
    schemaVersion: "web-cad.document.v1",
    id: "project-workspace-test",
    name: "Project workspace test",
    units: "mm",
    objects: [],
    sketches: [],
    features: [],
    namedReferences: [],
    parameters: []
  },
  history: [],
  redoStack: []
} as unknown as CadProject;

describe("ProjectWorkspace", () => {
  it("renders a human-readable overview and both supported unit update methods", () => {
    const markup = renderPage("overview");

    expect(markup).toContain("Document overview");
    expect(markup).toContain("bracket.wcad");
    expect(markup).toContain("Model health");
    expect(markup).toContain("Relabel values");
    expect(markup).toContain("Convert size");
    expect(markup).not.toContain("schemaVersion");
    expect(markup).not.toContain("sourceIdentity");
  });

  it("makes .wcad the primary file workflow and keeps JSON under Advanced Interchange", () => {
    const markup = renderPage("files");

    expect(markup).toContain("Open .wcad");
    expect(markup).toContain("Save</span>");
    expect(markup).toContain("Save as");
    expect(markup).toContain("Import STEP");
    expect(markup).toContain("Advanced Interchange");
    expect(markup).toContain("Import JSON");
    expect(markup).toContain("Project JSON draft");
    expect(markup).toContain("<textarea");
  });

  it("keeps blocked file actions focusable with actionable reasons", () => {
    const markup = renderPage("files", {
      storageCapabilities: createProjectStorageCapabilityStatus({})
    });

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.openWcad);
    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.save);
    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.saveAs);
    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.importStep);
    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.downloadJson);
    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.loadJson);
    const saveButton = markup.match(
      /<button[^>]*title="This browser cannot save directly to a file\. Use Save As to download a copy\."[^>]*>/
    )?.[0];
    expect(saveButton).toBeDefined();
    expect(saveButton).not.toContain('disabled=""');
  });

  it("explains empty history undo and redo without removing them from tab order", () => {
    const markup = renderPage("history", { canUndo: false, canRedo: false });

    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.undo);
    expect(markup).toContain(PROJECT_ACTION_UNAVAILABLE.redo);
    expect(markup).toContain('aria-disabled="true"');
    const undoButton = markup.match(
      /<button[^>]*title="There is nothing to undo\."[^>]*>/
    )?.[0];
    expect(undoButton).toBeDefined();
    expect(undoButton).not.toContain('disabled=""');
  });

  it("shows the session-only Agent approval modes without adding chat UI", () => {
    const markup = renderPage("agent");

    expect(markup).toContain("Local session");
    expect(markup).toContain("Disconnected");
    expect(markup).toContain("Manual approval");
    expect(markup).toContain("Approve all");
    expect(markup).toContain("No commit awaiting approval");
    expect(markup).not.toContain("chat");
  });

  it("renders parameter values, expressions, descriptions, and accessible row actions", () => {
    const markup = renderPage("parameters", {
      parameterEvaluation: createEvaluation(),
      parameterUsageCounts: { parameter_width: 1 }
    });

    expect(markup).toContain("Project parameters");
    expect(markup).toContain("Overall width");
    expect(markup).toContain("width / 2");
    expect(markup).toContain("Evaluation valid");
    expect(markup).toContain("Used by 1 driving dimension");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*Delete/s);
  });

  it("renders empty history and export states without inventing readiness", () => {
    expect(renderPage("history")).toContain("No changes yet");
    expect(renderPage("export")).toContain("Export readiness unavailable");
  });

  it("renders the ordered, accessible all-or-nothing STEP workflow", () => {
    const readiness = createExportReadiness();
    const idle = renderPage("export", {
      exportReadiness: readiness,
      selectedBodyId: "body-b"
    });

    expect(idle).toContain("Named STEP AP242DIS");
    expect(idle).toContain("all-or-nothing");
    expect(idle).toContain("Export all bodies");
    expect(idle).toContain("Export selected body");
    expect(idle).toContain("Export chosen bodies");
    expect(idle.match(/type="checkbox"/g)).toHaveLength(2);
    expect(idle).toContain("Move Body A earlier");
    expect(idle).toContain("Move Body B later");

    const running = renderPage("export", {
      exportReadiness: readiness,
      exactStepExportJob: {
        status: "running",
        phase: "building",
        completedBodyCount: 1,
        totalBodyCount: 2,
        message: "Built 1 of 2 exact body artifacts.",
        diagnostics: []
      }
    });
    expect(running).toContain("<progress");
    expect(running).toContain('aria-live="polite"');
    expect(running).toContain("Cancel export");

    const failed = renderPage("export", {
      exportReadiness: readiness,
      exactStepExportJob: {
        status: "failed",
        completedBodyCount: 1,
        totalBodyCount: 2,
        message: "STEP export failed because the project changed.",
        diagnostics: [
          {
            code: "EXPORT_SOURCE_CHANGED",
            message: "Source identity changed."
          }
        ]
      }
    });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Retry export");
    expect(failed).toContain("Technical diagnostics");
    expect(failed).toContain("EXPORT_SOURCE_CHANGED");
  });
});

describe("project health summary", () => {
  it("separates ordinary sketch design freedom from actionable issues", () => {
    expect(
      formatProjectHealthSummary({
        status: "under-defined",
        issueCount: 2
      } as ProjectWorkspaceProps["health"])
    ).toBe("2 design notes");
    expect(
      formatProjectHealthSummary({
        status: "missing-source",
        issueCount: 1
      } as ProjectWorkspaceProps["health"])
    ).toBe("1 issue");
  });
});

describe("project parameter editor model", () => {
  it("creates an edit draft from the selected source parameter", () => {
    expect(createParameterEditForm(halfWidthParameter)).toEqual({
      name: "halfWidth",
      value: 12,
      expression: "width / 2",
      description: ""
    });
  });

  it("validates names and finite literal values while accepting expression drafts", () => {
    expect(
      getCreateParameterIssue({ id: "", name: " ", value: 1, description: "" })
    ).toBe("Enter a parameter name.");
    expect(
      getCreateParameterIssue({
        id: "",
        name: "width",
        value: Number.NaN,
        description: ""
      })
    ).toBe("Enter a finite value.");
    expect(
      getEditParameterIssue({
        name: "halfWidth",
        value: Number.NaN,
        expression: "width / 2",
        description: ""
      })
    ).toBeUndefined();
  });

  it("reports literal, valid, and circular expression states from query truth", () => {
    const evaluation = createEvaluation();
    const halfWidthNode = evaluation.nodes.find(
      (node) => node.parameterId === halfWidthParameter.id
    );
    if (!halfWidthNode) {
      throw new Error("Expected half-width evaluation node.");
    }

    expect(getParameterExpressionStatus(widthParameter, evaluation)).toBe(
      "Literal"
    );
    expect(getParameterExpressionStatus(halfWidthParameter, evaluation)).toBe(
      "Valid"
    );
    expect(
      getParameterExpressionStatus(halfWidthParameter, {
        ...evaluation,
        status: "circular",
        nodes: [
          {
            ...halfWidthNode,
            diagnostics: [
              {
                code: "PARAMETER_CIRCULAR_REFERENCE",
                message: "Circular reference",
                parameterId: "parameter_half"
              }
            ]
          }
        ]
      })
    ).toBe("Circular reference");
  });
});

function renderPage(
  page: ProjectPageId,
  overrides: Partial<ProjectWorkspaceProps> = {}
): string {
  const props: ProjectWorkspaceProps = {
    page,
    disabled: false,
    documentName: "bracket.wcad",
    units: "mm",
    currentProject,
    summary,
    storageCapabilities: createProjectStorageCapabilityStatus(),
    jsonDraft: "",
    jsonDraftSource: { kind: "empty" },
    jsonWorkflow,
    opfsCacheStatus: createInitialProjectOpfsCacheStatus(false),
    parameters,
    transactions: [],
    canUndo: false,
    canRedo: false,
    onNew: () => undefined,
    onOpenWcad: async () => false,
    onOpenStep: async () => false,
    onOpenWcadFileLoaded: () => undefined,
    onStepFileLoaded: () => undefined,
    onJsonFileLoaded: () => undefined,
    onFileError: () => undefined,
    onSave: () => undefined,
    onSaveAs: () => undefined,
    onPrepareJson: () => undefined,
    onDownloadJson: () => undefined,
    onJsonDraftChange: () => undefined,
    onImportJson: () => undefined,
    onRefreshOpfsCache: () => undefined,
    onClearOpfsCache: () => undefined,
    exactStepExportJob: {
      status: "idle",
      completedBodyCount: 0,
      totalBodyCount: 0,
      diagnostics: []
    },
    onDownloadStep: () => undefined,
    onCancelStep: () => undefined,
    onDownloadVisualization: () => undefined,
    onUpdateUnits: () => undefined,
    onCreateParameter: () => undefined,
    onEditParameter: () => undefined,
    onDeleteParameter: () => undefined,
    onUndo: () => undefined,
    onRedo: () => undefined,
    ...overrides
  };

  return renderToStaticMarkup(createElement(ProjectWorkspace, props));
}

function createExportReadiness(): ProjectExportReadinessQueryResponse {
  const bodies = [
    {
      bodyId: "body-a",
      bodyName: "Body A",
      bodyKind: "solid" as const,
      featureId: "feature-a",
      partId: "part:default",
      sourceKind: "authoredExtrude" as const,
      sourceStatus: "supported" as const,
      status: "supported" as const,
      sourceBoundaryNote: "Authoritative project source.",
      derivedBoundaryNote: "Current exact result evidence.",
      formats: [],
      diagnostics: []
    },
    {
      bodyId: "body-b",
      bodyName: "Body B",
      bodyKind: "solid" as const,
      featureId: "feature-b",
      partId: "part:default",
      sourceKind: "authoredHole" as const,
      sourceStatus: "deferred" as const,
      status: "deferred" as const,
      sourceBoundaryNote: "Authoritative project source.",
      derivedBoundaryNote: "Current exact result evidence.",
      formats: [],
      diagnostics: [
        {
          code: "EXPORT_RESULT_BODY_DEFERRED" as const,
          status: "deferred" as const,
          message: "Body B is not ready yet."
        }
      ]
    }
  ];
  return {
    ok: true,
    query: "project.exportReadiness",
    cadOpsVersion: "cadops.v1",
    status: "supported",
    canExportFiles: true,
    units: "mm",
    sourceBoundaryNote: "Authoritative project source.",
    derivedBoundaryNote: "Current exact result evidence.",
    formatCount: 1,
    formats: [
      {
        format: "step",
        label: "STEP",
        exportKind: "exact",
        status: "supported",
        available: true,
        writerStatus: "available",
        fileExtensions: [".step", ".stp"],
        units: "mm",
        sourceBoundaryNote: "Authoritative project source.",
        derivedBoundaryNote: "Current exact result evidence.",
        candidateBodyCount: 2,
        sourceSupportedBodyCount: 1,
        deferredBodyCount: 1,
        unavailableBodyCount: 0,
        diagnostics: []
      }
    ],
    bodyCount: 2,
    sourceSupportedBodyCount: 1,
    deferredBodyCount: 1,
    unavailableBodyCount: 0,
    bodies,
    diagnosticCount: 1,
    diagnostics: bodies[1]!.diagnostics
  };
}

function createEvaluation(): ProjectParameterEvaluationQueryResponse {
  return {
    ok: true,
    query: "project.parameterEvaluation",
    cadOpsVersion: "cadops.v1",
    status: "valid",
    parameterCount: 2,
    expressionCount: 1,
    nodes: [
      {
        parameterId: "parameter_width",
        name: "width",
        value: 24,
        referenceNames: [],
        references: [],
        dependents: ["parameter_half"],
        diagnostics: []
      },
      {
        parameterId: "parameter_half",
        name: "halfWidth",
        value: 12,
        expression: "width / 2",
        referenceNames: ["width"],
        references: ["parameter_width"],
        dependents: [],
        diagnostics: []
      }
    ],
    evaluationOrder: ["parameter_width", "parameter_half"],
    cycleCount: 0,
    cycles: [],
    diagnosticCount: 0,
    diagnostics: [],
    sourceBoundaryNote: "Source parameters remain authoritative.",
    derivedBoundaryNote: "Evaluation is derived.",
    mutatesSource: false
  };
}
