import { describe, expect, it, vi } from "vitest";
import { CadEngine } from "@web-cad/cad-core";
import type { CadGeneratedReference } from "@web-cad/cad-protocol";
import { ModelingReferenceQueryCache } from "./modelingReferenceQueries";

function references(engine: CadEngine, bodyId: string) {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.generatedReferences", bodyId }
  });
  if (!response.ok || response.query !== "body.generatedReferences")
    throw Error("Expected generated references");
  return response;
}
function reader(engine: CadEngine) {
  return vi.fn((reference: CadGeneratedReference) => {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "selection.referenceCandidates",
        selection: {
          type: "generatedReference",
          bodyId: reference.bodyId,
          stableId: reference.stableId,
          expectedKind: reference.kind
        }
      }
    });
    if (!response.ok || response.query !== "selection.referenceCandidates")
      throw Error("Expected candidates");
    return response;
  });
}

describe("modeling reference query demand", () => {
  it("does not fan out correspondence-only gear references into modeling reads", () => {
    const engine = new CadEngine();
    engine.apply({
      op: "feature.spurGear",
      id: "gear",
      bodyId: "gear_body",
      sketchId: "gear_profile",
      teeth: 40,
      module: 1.5,
      faceWidth: 10,
      boreDiameter: 8
    });
    const source = references(engine, "gear_body");
    expect(
      source.edgeCount + source.faceCount + source.vertexCount
    ).toBeGreaterThan(1000);
    const read = reader(engine);
    const cache = new ModelingReferenceQueryCache();
    expect(
      cache.read(engine.getSourceAuthorityEpoch(), source, read).size
    ).toBe(0);
    expect(
      cache.read(engine.getSourceAuthorityEpoch(), source, read, {
        kind: "face",
        operation: "feature.shell"
      }).size
    ).toBe(0);
    expect(read).not.toHaveBeenCalled();
    // Explicit inspection still asks the authority about the selected face.
    const selected = read(source.faces[0]!);
    expect(selected.candidates[0]?.reference).toMatchObject({
      stableId: source.faces[0]!.stableId
    });
    expect(selected.candidates[0]?.commandOperations).not.toContain(
      "feature.shell"
    );
  });

  it("checks eligible faces authoritatively once per document and invalidates after edits", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "profile", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        id: "rect",
        sketchId: "profile",
        center: [0, 0],
        width: 10,
        height: 10
      },
      {
        op: "feature.extrude",
        id: "extrude",
        bodyId: "body",
        sketchId: "profile",
        entityId: "rect",
        depth: 4
      }
    ]);
    const read = reader(engine);
    const cache = new ModelingReferenceQueryCache();
    const options = { kind: "face", operation: "feature.shell" } as const;
    const before = cache.read(
      engine.getSourceAuthorityEpoch(),
      references(engine, "body"),
      read,
      options
    );
    expect(before.size).toBe(6);
    expect(read).toHaveBeenCalledTimes(6);
    expect(
      [...before.values()].every((response) =>
        response.candidates.some((candidate) =>
          candidate.commandOperations.includes("feature.shell")
        )
      )
    ).toBe(true);
    const again = cache.read(
      engine.getSourceAuthorityEpoch(),
      references(engine, "body"),
      read,
      options
    );
    expect(again).toEqual(before);
    expect(read).toHaveBeenCalledTimes(6);
    engine.apply({ op: "feature.updateExtrude", id: "extrude", depth: 8 });
    cache.read(
      engine.getSourceAuthorityEpoch(),
      references(engine, "body"),
      read,
      options
    );
    expect(read).toHaveBeenCalledTimes(12);
    engine.undo();
    cache.read(
      engine.getSourceAuthorityEpoch(),
      references(engine, "body"),
      read,
      options
    );
    expect(read).toHaveBeenCalledTimes(18);
  });
});
