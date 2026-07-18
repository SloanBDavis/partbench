import type {
  CadFeatureSummary,
  FeatureEditabilityQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchProfileCandidatesQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompositeFeatureEditor } from "./CompositeFeatureEditor";

describe("CompositeFeatureEditor", () => {
  it("shows current/proposed ordered sweep refs and adjacent proposal blockers", () => {
    const profileSketch = sketch("profile", [
      { id: "circle-current", kind: "circle", center: [0, 0], radius: 1, construction: false },
      { id: "circle-next", kind: "circle", center: [0, 0], radius: 0.5, construction: false }
    ]);
    const pathSketch = sketch("path", [
      { id: "line-current", kind: "line", start: [0, 0], end: [1, 0], construction: false },
      { id: "line-next", kind: "line", start: [2, 0], end: [3, 0], construction: false }
    ]);
    const feature = {
      id: "sweep",
      kind: "sweep",
      partId: "part",
      bodyId: "body",
      profile: { kind: "entity", sketchId: "profile", entityId: "circle-current" },
      path: { kind: "entity", sketchId: "path", entityId: "line-current", orientation: "reverse" },
      profileSketchId: "profile",
      profileEntityId: "circle-current",
      pathSketchId: "path",
      pathEntityIds: ["line-current"],
      source: {
        type: "sweepFeature",
        profile: { kind: "entity", sketchId: "profile", entityId: "circle-current" },
        path: { kind: "entity", sketchId: "path", entityId: "line-current", orientation: "reverse" },
        profileSketchId: "profile",
        profileEntityId: "circle-current",
        pathSketchId: "path",
        pathEntityIds: ["line-current"]
      }
    } as Extract<CadFeatureSummary, { readonly kind: "sweep" }>;
    const inspectProposal = vi.fn(() => blockedEditability(feature));
    const markup = renderToStaticMarkup(
      createElement(CompositeFeatureEditor, {
        feature,
        sketches: [profileSketch, pathSketch],
        profileCandidatesBySketchId: new Map([
          ["profile", profileCandidates("profile", "circle-next")]
        ]),
        pathCandidatesBySketchId: new Map([
          ["path", pathCandidates("path", "line-next")]
        ]),
        inspectProposal,
        onUpdateExtrudeProfile: () => undefined,
        onUpdateRevolveProfile: () => undefined,
        onUpdateSweepRefs: () => undefined
      })
    );

    expect(markup).toContain("Current profile");
    expect(markup).toContain("circle-current");
    expect(markup).toContain("Current path");
    expect(markup).toContain("line-current (reverse)");
    expect(markup).toContain("Direction: reverse");
    expect(markup).toContain("Proposed profile");
    expect(markup).toContain("circle-next");
    expect(markup).toContain("Proposed path");
    expect(markup).toContain("line-next (forward)");
    expect(markup).toContain("Direction: forward");
    expect(markup).toContain("Start (2.000, 0.000) → end (3.000, 0.000)");
    expect(markup).toContain("Path must be tangent. (proposedEdit.path)");
    expect(markup).toContain("Save source references");
    expect(inspectProposal).toHaveBeenCalledWith("sweep", {
      kind: "sweep",
      profile: { kind: "entity", sketchId: "profile", entityId: "circle-next" },
      path: { kind: "entity", sketchId: "path", entityId: "line-next", orientation: "forward" }
    });
  });

  it.each(["extrude", "revolve"] as const)(
    "retargets a composite %s only through an explicit candidate proposal",
    (kind) => {
      const profileSketch = sketch("profile", [
        { id: "circle-next", kind: "circle", center: [0, 0], radius: 1, construction: false }
      ]);
      const currentProfile = {
        kind: "wire" as const,
        sketchId: "profile",
        segments: [
          { entityId: "line-current", orientation: "forward" as const },
          { entityId: "arc-current", orientation: "reverse" as const }
        ]
      };
      const base = {
        id: kind,
        kind,
        partId: "part",
        bodyId: "body",
        sketchId: "profile",
        profile: currentProfile,
        operationMode: "newBody" as const,
        source: {
          type: kind === "extrude" ? "sketchEntity" : "sketchEntityWithAxis",
          sketchId: "profile",
          profile: currentProfile
        }
      };
      const feature = (kind === "extrude"
        ? { ...base, depth: 2, side: "positive" as const }
        : {
            ...base,
            angleDegrees: 180,
            axis: { type: "sketchLine" as const, sketchId: "profile", entityId: "axis" },
            source: {
              ...base.source,
              type: "sketchEntityWithAxis" as const,
              axis: { type: "sketchLine" as const, sketchId: "profile", entityId: "axis" }
            }
          }) as Extract<CadFeatureSummary, { readonly kind: typeof kind }>;
      const inspectProposal = vi.fn(() => blockedEditability(feature));
      const markup = renderToStaticMarkup(
        createElement(CompositeFeatureEditor, {
          feature,
          sketches: [profileSketch],
          profileCandidatesBySketchId: new Map([
            ["profile", profileCandidates("profile", "circle-next")]
          ]),
          pathCandidatesBySketchId: new Map(),
          inspectProposal,
          onUpdateExtrudeProfile: () => undefined,
          onUpdateRevolveProfile: () => undefined,
          onUpdateSweepRefs: () => undefined
        })
      );

      expect(markup).toContain("1. line-current (forward) · 2. arc-current (reverse)");
      expect(markup).toContain("Proposed profile");
      expect(markup).toContain("circle-next");
      expect(inspectProposal).toHaveBeenCalledWith(kind, {
        kind,
        profile: { kind: "entity", sketchId: "profile", entityId: "circle-next" }
      });
    }
  );
});

function sketch(id: string, entities: SketchSnapshot["entities"]): SketchSnapshot {
  return { id, name: id, plane: "XY", entities };
}

function profileCandidates(sketchId: string, entityId: string): SketchProfileCandidatesQueryResponse {
  return { ok: true, query: "sketch.profileCandidates", cadOpsVersion: "cadops.v1", sketchId,
    status: "ready", candidateCount: 1, candidates: [{ status: "ready", candidateIndex: 0,
      sortKey: entityId, profile: { kind: "entity", sketchId, entityId }, orientation: "counterclockwise",
      area: 1, signedArea: 1, bounds: { min: [0, 0], max: [1, 1] }, joinCount: 0, joins: [],
      intersectionStatus: "clear", dependencies: { sketchIds: [sketchId], orderedEntityIds: [entityId] },
      diagnosticCount: 0, diagnostics: [] }], rejectedComponentCount: 0, rejectedComponents: [],
    constructionExclusionCount: 0, constructionExclusions: [], diagnosticCount: 0, diagnostics: [] };
}

function pathCandidates(sketchId: string, entityId: string): SketchPathCandidatesQueryResponse {
  return { ok: true, query: "sketch.pathCandidates", cadOpsVersion: "cadops.v1", sketchId,
    status: "ready", candidateCount: 1, candidates: [{ status: "ready", candidateIndex: 0,
      sortKey: entityId, path: { kind: "entity", sketchId, entityId, orientation: "forward" },
      length: 1, bounds: { min: [2, 0], max: [3, 0] }, connectionStatus: "connected",
      tangentStatus: "tangent", selfIntersectionStatus: "clear", joinCount: 0, joins: [],
      dependencies: { sketchIds: [sketchId], orderedEntityIds: [entityId] }, diagnosticCount: 0,
      diagnostics: [] }], rejectedComponentCount: 0, rejectedComponents: [], diagnosticCount: 0,
    diagnostics: [] };
}

function blockedEditability(feature: CadFeatureSummary): FeatureEditabilityQueryResponse {
  return { ok: true, query: "feature.editability", cadOpsVersion: "cadops.v1", featureId: feature.id,
    status: "unsupported", feature, fieldCount: 0, fields: [], rebuildReadiness: {
      status: "blocked", commitDeferred: false, diagnosticCount: 0, diagnostics: []
    },
    dryRun: { status: "blocked", willMutateDocument: false, diagnosticCount: 0, diagnostics: [] },
    affected: { sketchIds: [], featureIds: [feature.id], bodyIds: [], generatedReferenceCount: 0,
      namedReferenceCount: 0 }, referenceChangeCount: 0,
    referenceChanges: [], diagnosticCount: 1, diagnostics: [{ code: "FEATURE_EDIT_INVALID_PROPOSAL",
      severity: "blocker", message: "Path must be tangent.", featureId: feature.id,
      fieldPath: "proposedEdit.path" }], sourceBoundaryNote: "source", derivedBoundaryNote: "derived",
    requiresProjectSchemaMigration: false };
}
