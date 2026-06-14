import { CadEngine, exportCadProjectJson } from "@web-cad/cad-core";
import type {
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createViewportCommandTargetSummary,
  createViewportInteractionDiagnosticsFromCandidates,
  resolveViewportHitCandidateSelection
} from "./viewportInteractionContract";

describe("viewport interaction contract helpers", () => {
  it("maps a body hit candidate to a selection.referenceCandidates query", () => {
    const semanticHint = {
      type: "body",
      bodyId: "body_rect",
      rendererHitId: "renderer-hit:semantic-smuggle",
      selectionBufferHitId: "selection-buffer:semantic-smuggle"
    } as unknown as CadSelectionReferenceInput;
    const resolution = resolveViewportHitCandidateSelection({
      hitCandidate: {
        displayEntityKind: "body",
        rendererHitId: "renderer-hit:body:42",
        selectionBufferHitId: "selection-buffer:body:42",
        semanticHint
      },
      requiredOperation: "feature.selectReference"
    });

    expect(resolution).toEqual({
      status: "resolved",
      selection: { type: "body", bodyId: "body_rect" },
      query: {
        query: "selection.referenceCandidates",
        selection: { type: "body", bodyId: "body_rect" },
        requiredOperation: "feature.selectReference"
      },
      diagnostics: []
    });
    expect(JSON.stringify(resolution)).not.toContain("renderer-hit");
    expect(JSON.stringify(resolution)).not.toContain("selection-buffer");
  });

  it("maps generated face and edge hints without leaking renderer-private IDs", () => {
    const faceResolution = resolveViewportHitCandidateSelection({
      hitCandidate: {
        displayEntityKind: "face",
        rendererHitId: "renderer-hit:face:17",
        selectionBufferHitId: "selection-buffer:face:17",
        semanticHint: {
          type: "generatedReference",
          bodyId: "body_rect",
          stableId: "generated:face:body_rect:endCap",
          expectedKind: "face"
        }
      },
      requiredOperation: "feature.attachSketchPlane"
    });
    const edgeResolution = resolveViewportHitCandidateSelection({
      hitCandidate: {
        displayEntityKind: "edge",
        rendererHitId: "mesh-triangle:edge:99",
        semanticHint: {
          type: "generatedReference",
          bodyId: "body_rect",
          stableId: "generated:edge:body_rect:end:uMin",
          expectedKind: "edge"
        }
      },
      requiredOperation: "feature.chamfer"
    });

    expect(faceResolution.query).toEqual({
      query: "selection.referenceCandidates",
      selection: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId: "generated:face:body_rect:endCap",
        expectedKind: "face"
      },
      requiredOperation: "feature.attachSketchPlane"
    });
    expect(edgeResolution.query).toEqual({
      query: "selection.referenceCandidates",
      selection: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId: "generated:edge:body_rect:end:uMin",
        expectedKind: "edge"
      },
      requiredOperation: "feature.chamfer"
    });

    const publicJson = JSON.stringify([faceResolution, edgeResolution]);

    expect(publicJson).not.toContain("renderer-hit");
    expect(publicJson).not.toContain("selection-buffer");
    expect(publicJson).not.toContain("mesh-triangle");
  });

  it("maps named-reference hints through the same semantic query path", () => {
    const resolution = resolveViewportHitCandidateSelection({
      hitCandidate: {
        displayEntityKind: "face",
        rendererHitId: "renderer-hit:named-face",
        semanticHint: { type: "namedReference", name: "Mounting face" }
      }
    });

    expect(resolution).toEqual({
      status: "resolved",
      selection: { type: "namedReference", name: "Mounting face" },
      query: {
        query: "selection.referenceCandidates",
        selection: { type: "namedReference", name: "Mounting face" }
      },
      diagnostics: []
    });
    expect(JSON.stringify(resolution)).not.toContain("renderer-hit");
  });

  it.each([
    ["missing hit target", undefined, "missing", "VIEWPORT_MISSING_HIT_TARGET"],
    [
      "renderer-only hit",
      {
        displayEntityKind: "face",
        rendererHitId: "renderer-hit:face-only"
      },
      "renderer-only",
      "VIEWPORT_RENDERER_ONLY_TARGET"
    ],
    [
      "unsupported sketch entity",
      {
        displayEntityKind: "sketchEntity",
        rendererHitId: "renderer-hit:sketch"
      },
      "unsupported",
      "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY"
    ],
    [
      "future assembly context",
      {
        displayEntityKind: "body",
        instancePath: ["root", "instance-a"],
        semanticHint: { type: "body", bodyId: "body_rect" }
      },
      "assembly-unsupported",
      "VIEWPORT_ASSEMBLY_INSTANCE_UNSUPPORTED"
    ],
    [
      "ambiguous body hint on face display hit",
      {
        displayEntityKind: "face",
        semanticHint: { type: "body", bodyId: "body_rect" }
      },
      "ambiguous",
      "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE"
    ],
    [
      "generated kind mismatch",
      {
        displayEntityKind: "edge",
        semanticHint: {
          type: "generatedReference",
          bodyId: "body_rect",
          stableId: "generated:face:body_rect:endCap",
          expectedKind: "face"
        }
      },
      "unsupported",
      "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY"
    ]
  ] as const)(
    "returns structured diagnostics for %s",
    (_label, hitCandidate, status, code) => {
      const resolution = resolveViewportHitCandidateSelection({
        hitCandidate
      });

      expect(resolution.status).toBe(status);
      expect(resolution.query).toBeUndefined();
      expect(resolution.diagnostics).toMatchObject([{ code, status }]);
      expect(JSON.stringify(resolution)).not.toContain("renderer-hit");
    }
  );

  it.each([
    ["missing", "MISSING_SELECTION_TARGET", "VIEWPORT_MISSING_HIT_TARGET"],
    ["stale", "STALE_SELECTION_REFERENCE", "VIEWPORT_STALE_SEMANTIC_HINT"],
    [
      "ambiguous",
      "AMBIGUOUS_SELECTION_TOPOLOGY",
      "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE"
    ],
    [
      "unsupported",
      "UNSUPPORTED_SELECTION_TARGET",
      "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY"
    ],
    [
      "non-commandable",
      "NON_COMMANDABLE_SELECTION_TARGET",
      "VIEWPORT_NON_COMMANDABLE_TARGET"
    ],
    ["consumed", "CONSUMED_SELECTION_BODY", "VIEWPORT_CONSUMED_TARGET"]
  ] as const)(
    "maps %s selection.referenceCandidates diagnostics to viewport diagnostics",
    (status, selectionIssueCode, viewportCode) => {
      const diagnostics = createViewportInteractionDiagnosticsFromCandidates(
        createCandidateResponse({
          status,
          issue: {
            code: selectionIssueCode,
            status,
            message: `${status} CAD target`,
            bodyId: "body_rect"
          }
        })
      );

      expect(diagnostics).toEqual([
        {
          code: viewportCode,
          status,
          message: `${status} CAD target`
        }
      ]);
    }
  );

  it("creates public command target summaries from cad-core candidate responses", () => {
    const response = createCandidateResponse({ status: "resolved" });
    const summary = createViewportCommandTargetSummary(response);

    expect(summary).toEqual({
      selection: { type: "body", bodyId: "body_rect" },
      status: "resolved",
      commandable: true,
      target: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId: "generated:face:body_rect:endCap",
        kind: "face"
      },
      label: "End cap",
      commandOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference"
      ],
      diagnostics: []
    });

    const publicSummary = JSON.stringify(summary);

    expect(publicSummary).not.toContain("renderer-hit");
    expect(publicSummary).not.toContain("selection-buffer");
    expect(publicSummary).not.toContain("mesh-triangle");
    expect(publicSummary).not.toContain("occt-shape");
    expect(publicSummary).not.toContain("gpu-buffer");
    expect(publicSummary).not.toContain("pixel");
    expect(publicSummary).not.toContain("opfs");
    expect(publicSummary).not.toContain("fileHandle");
  });

  it("keeps viewport interaction resolution out of project source and schema", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_rect",
        bodyId: "body_rect",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 3
      }
    ]);

    const before = exportCadProjectJson(engine);

    resolveViewportHitCandidateSelection({
      hitCandidate: {
        displayEntityKind: "face",
        rendererHitId: "renderer-hit:face:17",
        selectionBufferHitId: "selection-buffer:face:17",
        semanticHint: {
          type: "generatedReference",
          bodyId: "body_rect",
          stableId: "generated:face:body_rect:endCap",
          expectedKind: "face"
        }
      }
    });

    expect(exportCadProjectJson(engine)).toBe(before);
    expect(before).toContain("web-cad.project.v16");
    expect(before).not.toContain("web-cad.project.v17");
    expect(before).not.toContain("viewport");
    expect(before).not.toContain("renderer-hit");
    expect(before).not.toContain("selection-buffer");
  });
});

function createCandidateResponse({
  issue,
  status
}: {
  readonly issue?: CadSelectionReferenceIssue;
  readonly status: SelectionReferenceCandidatesQueryResponse["status"];
}): SelectionReferenceCandidatesQueryResponse {
  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: { type: "body", bodyId: "body_rect" },
    status,
    candidateCount: issue ? 0 : 1,
    candidates: issue
      ? []
      : [
          {
            source: "bodySelection",
            target: {
              type: "generatedReference",
              bodyId: "body_rect",
              stableId: "generated:face:body_rect:endCap",
              kind: "face"
            },
            reference: {
              kind: "face",
              stableId: "generated:face:body_rect:endCap",
              label: "End cap",
              eligibleOperations: [
                "feature.attachSketchPlane",
                "feature.measureReference",
                "feature.selectReference"
              ],
              bodyId: "body_rect",
              ownerPartId: "part:default",
              sourceFeatureId: "feat_rect",
              sourceSketchId: "sketch_1",
              sourceSketchEntityId: "rect_1",
              role: "endCap",
              geometricSignature: {
                profileKind: "rectangle",
                sketchPlane: "XY",
                extrudeSide: "positive",
                depth: 3
              }
            },
            commandable: true,
            commandOperations: [
              "feature.attachSketchPlane",
              "feature.measureReference",
              "feature.selectReference"
            ],
            label: "End cap",
            issues: []
          }
        ],
    issueCount: issue ? 1 : 0,
    issues: issue ? [issue] : []
  };
}
