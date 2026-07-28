import { describe, expect, it } from "vitest";
import type {
  SketchProfileRegionCandidate,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import {
  createSelectedSketchRegionsProfile,
  createSketchEntitySemanticNames,
  formatSketchRegionCandidateName,
  normalizeSketchRegionSelectionForConsumer,
  updateSketchRegionSelection
} from "./sketchRegionSelectionModel";

const sketch: SketchSnapshot = {
  id: "sketch_1",
  name: "Plate",
  plane: "XY",
  entities: [
    {
      id: "outer",
      kind: "circle",
      center: [0, 0],
      radius: 10,
      construction: false
    },
    {
      id: "hole",
      kind: "circle",
      center: [0, 0],
      radius: 4,
      construction: false
    },
    {
      id: "island",
      kind: "circle",
      center: [0, 0],
      radius: 2,
      construction: false
    }
  ]
};

describe("sketch region selection model", () => {
  it("keeps exactly one region for one-region consumers", () => {
    const candidates = [candidate("outer", ["hole"]), candidate("hole")];
    expect(
      updateSketchRegionSelection(
        candidates,
        ["candidate_outer"],
        "candidate_hole",
        "extrude-new-body"
      )
    ).toEqual({
      ok: true,
      selectedCandidateKeys: ["candidate_hole"]
    });
    expect(
      normalizeSketchRegionSelectionForConsumer(
        ["candidate_outer", "candidate_hole"],
        "revolve-new-body"
      )
    ).toEqual(["candidate_outer"]);
  });

  it("rejects combined cells that share a whole-loop boundary", () => {
    const candidates = [candidate("outer", ["hole"]), candidate("hole")];
    const update = updateSketchRegionSelection(
      candidates,
      ["candidate_outer"],
      "candidate_hole",
      "extrude-add-cut"
    );
    expect(update.ok).toBe(false);
    expect(update.message).toContain("share a loop boundary");
    expect(update.selectedCandidateKeys).toEqual(["candidate_outer"]);
  });

  it("combines disjoint cells and builds explicit source refs in query order", () => {
    const candidates = [candidate("outer"), candidate("island")];
    const update = updateSketchRegionSelection(
      candidates,
      ["candidate_island"],
      "candidate_outer",
      "extrude-add-cut"
    );
    expect(update.ok).toBe(true);
    expect(
      createSelectedSketchRegionsProfile(
        sketch.id,
        candidates,
        update.selectedCandidateKeys
      )
    ).toEqual({
      kind: "regions",
      sketchId: "sketch_1",
      regions: [
        { outer: { kind: "entity", entityId: "outer" }, holes: [] },
        { outer: { kind: "entity", entityId: "island" }, holes: [] }
      ]
    });
  });

  it("does not select invalid discovery evidence", () => {
    const blocked = { ...candidate("outer"), status: "invalid" as const };
    expect(
      updateSketchRegionSelection(
        [blocked],
        [],
        blocked.candidateKey,
        "extrude-add-cut"
      )
    ).toMatchObject({ ok: false, selectedCandidateKeys: [] });
  });

  it("formats keyboard collector labels from semantic entity kinds", () => {
    expect(
      formatSketchRegionCandidateName(
        candidate("outer", ["hole"]),
        createSketchEntitySemanticNames(sketch)
      )
    ).toEqual({
      outer: "Circle 1",
      holes: ["Circle 2"]
    });
  });
});

function candidate(
  outer: string,
  holes: readonly string[] = []
): SketchProfileRegionCandidate {
  return {
    candidateKey: `candidate_${outer}`,
    region: {
      outer: { kind: "entity", entityId: outer },
      holes: holes.map((entityId) => ({ kind: "entity", entityId }))
    },
    outerLoopKey: `loop_${outer}`,
    holeLoopKeys: holes.map((id) => `loop_${id}`),
    outerEntityIds: [outer],
    holeEntityIds: holes.map((id) => [id]),
    signedArea: 100,
    materialArea: 80,
    containmentDepth: 0,
    status: "valid",
    diagnostics: []
  };
}
