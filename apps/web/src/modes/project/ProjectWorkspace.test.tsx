import type {
  CadParameterSnapshot,
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
    expect(markup).toContain("Save As");
    expect(markup).toContain("Import STEP");
    expect(markup).toContain("Advanced Interchange");
    expect(markup).toContain("Import JSON");
    expect(markup).toContain("Project JSON draft");
    expect(markup).toContain("<textarea");
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
    summary,
    storageCapabilities: createProjectStorageCapabilityStatus(),
    jsonDraft: "",
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
    onDownloadStep: () => undefined,
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
