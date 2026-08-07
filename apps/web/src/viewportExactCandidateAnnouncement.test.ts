import type { SelectionReferenceCandidatesQueryResponse } from "@web-cad/cad-protocol";
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
      commandability: {
        status: "inspect-only" as const,
        text: "Inspect only: no saved face."
      }
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
      commandability: {
        status: "commandable" as const,
        text: "Ready: Mounting edge"
      }
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
    const candidate = bodyCandidate("body_rect");
    const commandability = createViewportExactCandidateCommandability(
      candidate,
      (bodyId) => {
        expect(bodyId).toBe("body_rect");
        return createResponse({ status: "resolved", commandable: true });
      }
    );

    expect(commandability).toEqual({
      status: "commandable",
      text: "Ready: End cap"
    });
  });

  it("never fabricates a readiness claim when the projection is absent or blocked", () => {
    const face = {
      ...bodyCandidate("body_rect"),
      entityKind: "face",
      localId: "face:1",
      entitySignature: "face-signature:1"
    } as RenderExactPickCandidate;
    const blocked = createViewportExactCandidateCommandability(
      bodyCandidate("body_rect"),
      () => createResponse({ status: "resolved", commandable: false })
    );
    const absent = createViewportExactCandidateCommandability(
      face,
      () => undefined
    );

    expect(blocked.status).toBe("inspect-only");
    expect(blocked.text).toContain("Inspect only");
    expect(absent.status).toBe("inspect-only");
    expect(absent.text).toContain("Inspect only");
    expect(absent.text).not.toContain("Ready");
    expect(absent.text).not.toContain("commandable");
  });

  it("labels inspect-only current-topology entities with an actionable reason", () => {
    const vertex = {
      ...bodyCandidate("body_rect"),
      entityKind: "vertex",
      localId: "vertex:1",
      entitySignature: "vertex-signature:1"
    } as RenderExactPickCandidate;
    const edge = {
      ...bodyCandidate("body_rect"),
      entityKind: "edge",
      localId: "edge:1",
      entitySignature: "edge-signature:1"
    } as RenderExactPickCandidate;

    const vertexCommandability = createViewportExactCandidateCommandability(
      vertex,
      () => undefined
    );
    const edgeCommandability = createViewportExactCandidateCommandability(
      edge,
      () => undefined
    );

    expect(vertexCommandability.status).toBe("inspect-only");
    expect(vertexCommandability.text).toContain("not saved modeling targets");
    expect(edgeCommandability.status).toBe("inspect-only");
    expect(edgeCommandability.text).toContain("No saved edge matches");
  });

  it("never leaks private renderer or source identity into visible copy", () => {
    const leakedCandidate = {
      bodyId: "body:snapshot-local",
      bodySourceIdentitySignature: "source:abc123",
      topologySignature: "topology:xyz",
      entityKind: "face",
      localId: "face:local:123",
      entitySignature: "entity:signature:456",
      depth: 1,
      distance: 1,
      occluded: false
    } as RenderExactPickCandidate;
    const input = {
      index: 0,
      count: 1,
      kindLabel: "Face",
      label: "Bracket",
      occluded: false,
      commandability: createViewportExactCandidateCommandability(
        leakedCandidate,
        () => undefined
      )
    };
    const row = formatViewportExactCandidateRow(input);
    const announcement = formatViewportExactCandidateAnnouncement(input);

    expect(row).not.toContain("snapshot-local");
    expect(row).not.toContain("local:123");
    expect(row).not.toContain("signature:456");
    expect(row).not.toContain("source:abc123");
    expect(announcement).not.toContain("snapshot-local");
    expect(announcement).not.toContain("topology:xyz");
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
