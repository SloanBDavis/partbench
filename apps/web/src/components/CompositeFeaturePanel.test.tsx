import type {
  SketchPathCandidatesQueryResponse,
  SketchProfileCandidatesQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompositeFeaturePanel } from "./CompositeFeaturePanel";

describe("CompositeFeaturePanel", () => {
  it("shows exact ordered candidate membership and requires a choice for ambiguity", () => {
    const sketch: SketchSnapshot = {
      id: "profile-sketch",
      name: "Profile",
      plane: "XY",
      entities: []
    };
    const profileResponse: SketchProfileCandidatesQueryResponse = {
      ok: true,
      query: "sketch.profileCandidates",
      cadOpsVersion: "cadops.v1",
      sketchId: sketch.id,
      status: "ready",
      candidateCount: 2,
      candidates: ["a", "b"].map((suffix, candidateIndex) => ({
        status: "ready" as const,
        candidateIndex,
        sortKey: suffix,
        profile: {
          kind: "wire" as const,
          sketchId: sketch.id,
          segments: [
            { entityId: `line-${suffix}`, orientation: "forward" as const },
            { entityId: `arc-${suffix}`, orientation: "reverse" as const }
          ]
        },
        orientation: "counterclockwise" as const,
        area: 2,
        signedArea: 2,
        bounds: { min: [0, 0] as const, max: [2, 1] as const },
        joinCount: 2,
        joins: [],
        intersectionStatus: "clear" as const,
        dependencies: {
          sketchIds: [sketch.id],
          orderedEntityIds: [`line-${suffix}`, `arc-${suffix}`]
        },
        diagnosticCount: 0,
        diagnostics: []
      })),
      rejectedComponentCount: 0,
      rejectedComponents: [],
      constructionExclusionCount: 0,
      constructionExclusions: [],
      diagnosticCount: 0,
      diagnostics: []
    };
    const pathResponse: SketchPathCandidatesQueryResponse = {
      ok: true,
      query: "sketch.pathCandidates",
      cadOpsVersion: "cadops.v1",
      sketchId: sketch.id,
      status: "blocked",
      candidateCount: 0,
      candidates: [],
      rejectedComponentCount: 0,
      rejectedComponents: [],
      diagnosticCount: 0,
      diagnostics: []
    };
    const markup = renderToStaticMarkup(
      createElement(CompositeFeaturePanel, {
        sketches: [sketch],
        profileCandidatesBySketchId: new Map([[sketch.id, profileResponse]]),
        pathCandidatesBySketchId: new Map([[sketch.id, pathResponse]]),
        onCreateExtrude: () => undefined,
        onCreateRevolve: () => undefined,
        onCreateSweep: () => undefined
      })
    );

    expect(markup).toContain("Choose a profile");
    expect(markup).toContain("1. line-a (forward) · 2. arc-a (reverse)");
    expect(markup).toContain(
      "Choose an explicit query-returned profile candidate."
    );
    expect(markup).toContain('disabled=""');
  });
});
