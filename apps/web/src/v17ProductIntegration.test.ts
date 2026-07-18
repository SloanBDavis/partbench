import type {
  SketchPathCandidate,
  SketchPathCandidatesQueryResponse,
  SketchProfileCandidate,
  SketchProfileCandidatesQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  captureThreePointArcToolPoint,
  choosePathCandidate,
  chooseProfileCandidate,
  createThreePointArcToolSession,
  describeSketchPathEndpoints,
  formatCandidateDiagnostics,
  formatSketchPathMembership,
  getThreePointArcDefinition,
  getThreePointArcPreview,
  getThreePointArcToolStage,
  reverseSketchPath,
  updateThreePointArcToolHover
} from "./v17ProductIntegration";

describe("V17 product integration helpers", () => {
  it("preselects only a sole ready candidate and never guesses among multiples", () => {
    const first = profileCandidate("profile-a", "a");
    const second = profileCandidate("profile-b", "b");
    expect(chooseProfileCandidate(profileResponse([first]))).toMatchObject({
      selectedKey: "a",
      selected: first,
      requiresExplicitChoice: false
    });
    expect(chooseProfileCandidate(profileResponse([first, second]))).toEqual({
      selectedKey: undefined,
      selected: undefined,
      requiresExplicitChoice: true
    });
    expect(
      chooseProfileCandidate(profileResponse([first, second]), "b").selected
        ?.profile
    ).toEqual(second.profile);
  });

  it("reverses only submitted path traversal and exposes visible endpoints", () => {
    const sketch = pathSketch();
    const candidate = pathCandidate();
    const response = pathResponse([candidate]);
    const choice = choosePathCandidate(response);
    expect(choice.selected?.path).toEqual(candidate.path);
    const reversed = reverseSketchPath(candidate.path);
    expect(formatSketchPathMembership(reversed)).toBe(
      "1. arc (reverse) · 2. line (reverse)"
    );
    const forwardEndpoints = describeSketchPathEndpoints(sketch, candidate.path);
    const reverseEndpoints = describeSketchPathEndpoints(sketch, reversed);
    expect(forwardEndpoints?.start).toEqual([0, 0]);
    expect(forwardEndpoints?.end[0]).toBeCloseTo(2);
    expect(forwardEndpoints?.end[1]).toBeCloseTo(1);
    expect(reverseEndpoints?.start[0]).toBeCloseTo(2);
    expect(reverseEndpoints?.start[1]).toBeCloseTo(1);
    expect(reverseEndpoints?.end).toEqual([0, 0]);
    expect(candidate.path).toEqual(pathCandidate().path);
  });

  it("keeps three-point arc gestures session-only until a complete valid definition", () => {
    let session = createThreePointArcToolSession("sketch");
    expect(getThreePointArcToolStage(session)).toBe("start");
    session = captureThreePointArcToolPoint(session, [0, 0]);
    expect(getThreePointArcToolStage(session)).toBe("pointOnArc");
    session = updateThreePointArcToolHover(session, [1, 1]);
    expect(getThreePointArcDefinition(session)).toBeUndefined();
    session = captureThreePointArcToolPoint(session, [1, 1]);
    session = updateThreePointArcToolHover(session, [2, 0]);
    expect(getThreePointArcPreview(session)).toMatchObject({ ok: true });
    session = captureThreePointArcToolPoint(session, [2, 0]);
    expect(getThreePointArcToolStage(session)).toBe("complete");
    expect(getThreePointArcDefinition(session)).toEqual({
      kind: "threePoint",
      start: [0, 0],
      pointOnArc: [1, 1],
      end: [2, 0]
    });
  });

  it("formats actionable diagnostics next to blocked candidates", () => {
    expect(
      formatCandidateDiagnostics([
        {
          code: "SKETCH_PATH_JOIN_NOT_TANGENT",
          severity: "blocker",
          message: "Path join is not tangent.",
          joinIndex: 1,
          expected: "G1 tangent",
          received: "12 degrees"
        }
      ])
    ).toEqual([
      "Path join is not tangent. (join 2) Expected G1 tangent; received 12 degrees."
    ]);
  });
});

function profileCandidate(entityId: string, sortKey: string): SketchProfileCandidate {
  return {
    status: "ready", candidateIndex: 0, sortKey,
    profile: { kind: "entity", sketchId: "sketch", entityId },
    orientation: "counterclockwise", area: 1, signedArea: 1,
    bounds: { min: [0, 0], max: [1, 1] }, joinCount: 0, joins: [],
    intersectionStatus: "clear", dependencies: { sketchIds: ["sketch"], orderedEntityIds: [entityId] },
    diagnosticCount: 0, diagnostics: []
  };
}

function profileResponse(candidates: readonly SketchProfileCandidate[]): SketchProfileCandidatesQueryResponse {
  return { ok: true, query: "sketch.profileCandidates", cadOpsVersion: "cadops.v1",
    sketchId: "sketch", status: candidates.length ? "ready" : "blocked",
    candidateCount: candidates.length, candidates, rejectedComponentCount: 0,
    rejectedComponents: [], constructionExclusionCount: 0,
    constructionExclusions: [], diagnosticCount: 0, diagnostics: [] };
}

function pathCandidate(): SketchPathCandidate {
  return { status: "ready", candidateIndex: 0, sortKey: "path",
    path: { kind: "chain", sketchId: "path-sketch", segments: [
      { entityId: "line", orientation: "forward" },
      { entityId: "arc", orientation: "forward" }
    ] }, length: 3, bounds: { min: [0, 0], max: [2, 1] },
    connectionStatus: "connected", tangentStatus: "tangent",
    selfIntersectionStatus: "clear", joinCount: 1, joins: [],
    dependencies: { sketchIds: ["path-sketch"], orderedEntityIds: ["line", "arc"] },
    diagnosticCount: 0, diagnostics: [] };
}

function pathResponse(candidates: readonly SketchPathCandidate[]): SketchPathCandidatesQueryResponse {
  return { ok: true, query: "sketch.pathCandidates", cadOpsVersion: "cadops.v1",
    sketchId: "path-sketch", status: candidates.length ? "ready" : "blocked",
    candidateCount: candidates.length, candidates, rejectedComponentCount: 0,
    rejectedComponents: [], diagnosticCount: 0, diagnostics: [] };
}

function pathSketch(): SketchSnapshot {
  return { id: "path-sketch", name: "Path", plane: "XY", entities: [
    { id: "line", kind: "line", start: [0, 0], end: [1, 0], construction: false },
    { id: "arc", kind: "arc", center: [1, 1], radius: 1,
      startAngleDegrees: 270, sweepAngleDegrees: 90, construction: false }
  ] };
}
