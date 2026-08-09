import type {
  CadCurrentTopologySelectionOutcome,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import type { RenderExactPickCandidate } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  createViewportExactCandidateCommandability,
  formatViewportExactCandidateAnnouncement,
  formatViewportExactCandidateRow
} from "./viewportExactCandidateAnnouncement";

describe("viewport exact candidate announcement", () => {
  it("reads index/count as human 1-based labels, not raw zero-based", () => {
    const input = {
      index: 2,
      count: 3,
      kindLabel: "Face",
      label: "Bracket",
      occluded: true,
      commandability: "Inspect only: no saved face."
    };
    const row = formatViewportExactCandidateRow(input);
    const announcement = formatViewportExactCandidateAnnouncement(input);

    expect(row).toContain("3 of 3");
    expect(row).not.toContain(`${2} of 3`);
    expect(announcement).toContain("Face 3 of 3, Bracket, occluded.");
    expect(announcement).not.toContain("Face 2 of 3");
  });

  it("announces kind, human label, index/count, and commandability", () => {
    const input = {
      index: 0,
      count: 1,
      kindLabel: "Edge",
      label: "Flange",
      occluded: false,
      commandability: "Ready: Mounting edge"
    };
    const announcement = formatViewportExactCandidateAnnouncement(input);

    expect(announcement).toBe(
      "Edge 1 of 1, Flange, visible. Ready: Mounting edge"
    );
    expect(announcement).toContain("Edge");
    expect(announcement).toContain("Flange");
    expect(announcement).toContain("1 of 1");
    expect(announcement).toContain("Ready: Mounting edge");
  });

  it("derives commandability for a body from the referenceCandidates projection only", () => {
    const commandability = createViewportExactCandidateCommandability(
      createResponse({ status: "resolved", commandable: true })
    );

    expect(commandability).toBe("Ready: End cap");
  });

  it.each([
    "existingGeneratedMatch",
    "existingAnchorMatch",
    "promotableGeneratedMatch"
  ] as const)("uses the public current-topology %s match", (outcome) => {
    const candidate = exactCandidate("face", "face:1");
    const commandability = createViewportExactCandidateCommandability(
      createCurrentTopologyResponse(candidate, outcome)
    );

    expect(commandability).toBe("Ready: Existing face");
  });

  it("keeps unmatched current topology inspect-only and never invents a target", () => {
    const candidate = exactCandidate("vertex", "vertex:1");
    const commandability = createViewportExactCandidateCommandability(
      createCurrentTopologyResponse(
        candidate,
        "inspectOnly",
        "Current topology entity is available for inspection only."
      )
    );

    expect(commandability).toContain("inspection only");
    expect(commandability).not.toContain("Ready");
  });

  it("never fabricates a readiness claim when the projection is absent or blocked", () => {
    const blocked = createViewportExactCandidateCommandability(
      createResponse({ status: "resolved", commandable: false })
    );
    const absent = createViewportExactCandidateCommandability(undefined);

    expect(blocked).toContain("Inspect only");
    expect(absent).toContain("Inspect only");
    expect(absent).not.toContain("Ready");
    expect(absent).not.toContain("commandable");
  });

  it("labels inspect-only current-topology entities with an actionable reason", () => {
    const vertex = exactCandidate("vertex", "vertex:1");
    const edge = exactCandidate("edge", "edge:1");

    const vertexCommandability = createViewportExactCandidateCommandability(
      createCurrentTopologyResponse(
        vertex,
        "inspectOnly",
        "Vertices are not saved modeling targets."
      )
    );
    const edgeCommandability = createViewportExactCandidateCommandability(
      createCurrentTopologyResponse(
        edge,
        "inspectOnly",
        "No saved edge matches this result."
      )
    );

    expect(vertexCommandability).toContain("not saved modeling targets");
    expect(edgeCommandability).toContain("No saved edge matches");
  });

  it("redacts query diagnostics in human announcements", () => {
    const candidate = exactCandidate("face", "face:1");
    const input = {
      index: 0,
      count: 1,
      kindLabel: "Face",
      label: "Bracket",
      occluded: false,
      commandability: createViewportExactCandidateCommandability(
        createCurrentTopologyResponse(
          candidate,
          "inspectOnly",
          "checkpoint-local:17 cannot be used as a modeling target."
        )
      )
    };

    const announcement = formatViewportExactCandidateAnnouncement(input);
    expect(announcement).not.toContain("checkpoint-local:17");
    expect(announcement).toContain("internal render target");
  });
});

function bodyCandidate(bodyId: string): RenderExactPickCandidate {
  return {
    bodyId,
    bodySourceIdentitySignature: "source",
    topologySignature: "topology",
    entityKind: "body",
    depth: 1,
    distance: 0,
    occluded: false
  };
}

function exactCandidate(
  entityKind: "face" | "edge" | "vertex",
  localId: string
): RenderExactPickCandidate & {
  readonly entityKind: "face" | "edge" | "vertex";
} {
  return {
    ...bodyCandidate("body_rect"),
    entityKind,
    localId,
    entitySignature: `${entityKind}-signature:1`
  };
}

function createCurrentTopologyResponse(
  candidate: RenderExactPickCandidate & {
    readonly entityKind: "face" | "edge" | "vertex";
  },
  outcome: CadCurrentTopologySelectionOutcome,
  diagnostic = ""
): SelectionReferenceCandidatesQueryResponse {
  const reference = {
    kind: "face",
    stableId: "generated:face:body_rect:current",
    label: "Existing face",
    eligibleOperations: ["feature.selectReference"] as const,
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "startCap",
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    }
  } as const;
  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    status: "resolved",
    candidateCount: diagnostic ? 0 : 1,
    candidates: diagnostic
      ? []
      : [
          {
            source: "bodySelection",
            target: {
              type: "generatedReference",
              bodyId: "body_rect",
              stableId: reference.stableId,
              kind: "face"
            },
            reference,
            commandable: true,
            commandOperations: ["feature.selectReference"],
            label: reference.label,
            issues: []
          }
        ],
    issueCount: 0,
    issues: [],
    currentTopology: {
      bodyId: "body_rect",
      entityKind: candidate.entityKind,
      outcome,
      diagnostics: diagnostic ? [{ message: diagnostic, code: outcome }] : []
    }
  };
}

function createResponse({
  status,
  commandable
}: {
  readonly status: SelectionReferenceCandidatesQueryResponse["status"];
  readonly commandable: boolean;
}): SelectionReferenceCandidatesQueryResponse {
  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: { type: "body", bodyId: "body_rect" },
    status,
    candidateCount: commandable ? 1 : 0,
    candidates: commandable
      ? [
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
              eligibleOperations: ["feature.selectReference"],
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
                depth: 2,
                surfaceType: "plane"
              }
            },
            commandable: true,
            commandOperations: ["feature.selectReference"],
            label: "End cap",
            issues: []
          }
        ]
      : [],
    issueCount: 0,
    issues: []
  };
}
