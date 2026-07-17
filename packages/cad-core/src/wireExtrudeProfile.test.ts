import { describe, expect, it } from "vitest";
import type {
  CadBatch,
  CadBatchResponse,
  ProjectDependencyGraphQueryResponse,
  ProjectStructureQueryResponse
} from "@web-cad/cad-protocol";

import {
  CAD_PROJECT_FORMAT_VERSION_V21,
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  importCadProjectJson
} from "./index";

const clockwiseProfile = {
  kind: "wire" as const,
  sketchId: "sketch_wire",
  segments: [
    { entityId: "line_d", orientation: "reverse" as const },
    { entityId: "line_c", orientation: "reverse" as const },
    { entityId: "line_b", orientation: "reverse" as const },
    { entityId: "line_a", orientation: "reverse" as const }
  ]
};

const counterclockwiseProfile = {
  kind: "wire" as const,
  sketchId: "sketch_wire",
  segments: [
    { entityId: "line_a", orientation: "forward" as const },
    { entityId: "line_b", orientation: "forward" as const },
    { entityId: "line_c", orientation: "forward" as const },
    { entityId: "line_d", orientation: "forward" as const }
  ]
};

function createWireEngine(): CadEngine {
  const engine = new CadEngine();
  engine.apply({
    op: "sketch.create",
    id: "sketch_wire",
    name: "Wire",
    plane: "XY"
  });
  engine.applyBatch([
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_a",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_b",
      start: [4, 0],
      end: [4, 3]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_c",
      start: [4, 3],
      end: [0, 3]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_d",
      start: [0, 3],
      end: [0, 0]
    }
  ]);
  return engine;
}

function query<T>(
  engine: CadEngine,
  queryName: "project.structure" | "project.dependencyGraph"
): T {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: queryName }
  });
  if (!response.ok) throw new Error(response.error.message);
  return response as T;
}

describe("V17 composite wire extrude newBody", () => {
  it("normalizes clockwise source before storage and reports the exact input diff", () => {
    const engine = createWireEngine();
    const result = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.extrude",
          id: "feature_wire",
          bodyId: "body_wire",
          profile: clockwiseProfile,
          depth: 5,
          side: "symmetric",
          operationMode: "newBody"
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(engine.getDocument().features.get("feature_wire")).toMatchObject({
      profile: counterclockwiseProfile,
      depth: 5,
      side: "symmetric"
    });
    expect(result.semanticDiff.features?.inputReferences).toEqual([
      {
        featureId: "feature_wire",
        inputKind: "profile",
        after: counterclockwiseProfile,
        profileOrientationNormalized: true,
        affectedSketchIds: ["sketch_wire"],
        affectedEntityIds: ["line_a", "line_b", "line_c", "line_d"]
      }
    ]);

    const structure = query<ProjectStructureQueryResponse>(
      engine,
      "project.structure"
    );
    expect(structure.features).toContainEqual(
      expect.objectContaining({
        id: "feature_wire",
        profile: counterclockwiseProfile
      })
    );
    const featureSummary = structure.features.find(
      (feature) => feature.id === "feature_wire"
    );
    expect(featureSummary).not.toHaveProperty("entityId");
    expect(featureSummary).not.toHaveProperty("profileKind");
    expect(structure.bodies).toContainEqual(
      expect.objectContaining({
        id: "body_wire",
        source: expect.objectContaining({
          profile: counterclockwiseProfile
        })
      })
    );
    const bodySummary = structure.bodies.find(
      (body) => body.id === "body_wire"
    );
    expect(bodySummary?.source).not.toHaveProperty("entityId");
    expect(bodySummary?.source).not.toHaveProperty("profileKind");
  });

  it("keeps dry-run deterministic and blocks composite add without consuming ids", () => {
    const engine = createWireEngine();
    const before = engine.createSnapshot();
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [{ op: "feature.extrude", profile: clockwiseProfile, depth: 2 }]
    });
    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      semanticDiff: {
        features: {
          created: [{ id: "feat_1" }],
          bodiesCreated: [{ id: "body_1" }]
        }
      }
    });
    expect(engine.createSnapshot()).toEqual(before);

    const blocked = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.extrude",
          profile: counterclockwiseProfile,
          depth: 2,
          operationMode: "add",
          targetBodyId: "missing"
        }
      ]
    });
    expect(blocked).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_FEATURE_OPERATION" }
    });
    expect(engine.createSnapshot()).toEqual(before);
  });

  it("updates normalized source atomically and round-trips V21 JSON/history", () => {
    const engine = createWireEngine();
    engine.apply({
      op: "feature.extrude",
      id: "feature_wire",
      bodyId: "body_wire",
      profile: counterclockwiseProfile,
      depth: 2,
      side: "positive",
      operationMode: "newBody"
    });
    const update = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateExtrude",
          id: "feature_wire",
          profile: clockwiseProfile,
          depth: 7,
          side: "negative"
        }
      ]
    });
    expect(update).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          inputReferences: [
            {
              before: counterclockwiseProfile,
              after: counterclockwiseProfile,
              profileOrientationNormalized: true
            }
          ]
        }
      }
    });
    expect(engine.undo()).not.toBeNull();
    expect(engine.getDocument().features.get("feature_wire")).toMatchObject({
      depth: 2,
      side: "positive",
      profile: counterclockwiseProfile
    });
    expect(engine.redo()).not.toBeNull();
    expect(engine.getDocument().features.get("feature_wire")).toMatchObject({
      depth: 7,
      side: "negative",
      profile: counterclockwiseProfile
    });

    const project = exportCadProject(engine);
    expect(project.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V21);
    const reopened = importCadProjectJson(exportCadProjectJson(engine));
    expect(reopened.createSnapshot()).toEqual(engine.createSnapshot());
    expect(reopened.getTransactions()).toEqual(engine.getTransactions());

    const graph = query<ProjectDependencyGraphQueryResponse>(
      reopened,
      "project.dependencyGraph"
    );
    const sourceEdges = graph.edges.filter(
      (edge) =>
        edge.sourceFeatureId === "feature_wire" &&
        edge.from.startsWith("sketch-entity:sketch_wire:")
    );
    expect(sourceEdges.map((edge) => edge.from.split(":").at(-1))).toEqual([
      "line_a",
      "line_b",
      "line_c",
      "line_d"
    ]);
  });

  it("retains authored source when a later sketch edit makes the wire invalid", () => {
    const engine = createWireEngine();
    engine.apply({
      op: "feature.extrude",
      id: "feature_wire",
      bodyId: "body_wire",
      profile: counterclockwiseProfile,
      depth: 2
    });

    const edit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.updateEntity",
          sketchId: "sketch_wire",
          entity: {
            id: "line_b",
            kind: "line",
            start: [4, 0],
            end: [5, 3],
            construction: false
          }
        }
      ]
    });
    expect(edit.ok).toBe(true);
    expect(engine.getDocument().features.get("feature_wire")).toMatchObject({
      profile: counterclockwiseProfile
    });
    const health = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(health).toMatchObject({
      ok: true,
      status: "unsupported"
    });
  });

  it("reports symmetric wire/entity profile transitions with exact affected sources", () => {
    const engine = createWireEngine();
    engine.apply({
      op: "sketch.addRectangle",
      sketchId: "sketch_wire",
      id: "rectangle",
      center: [2, 1.5],
      width: 2,
      height: 1
    });
    engine.apply({
      op: "feature.extrude",
      id: "feature_wire",
      bodyId: "body_wire",
      profile: counterclockwiseProfile,
      depth: 2
    });

    const entityProfile = {
      kind: "entity" as const,
      sketchId: "sketch_wire",
      entityId: "rectangle"
    };
    const toEntity = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateExtrude",
          id: "feature_wire",
          profile: entityProfile
        }
      ]
    });
    expect(toEntity).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          inputReferences: [
            {
              before: counterclockwiseProfile,
              after: entityProfile,
              affectedSketchIds: ["sketch_wire"],
              affectedEntityIds: [
                "line_a",
                "line_b",
                "line_c",
                "line_d",
                "rectangle"
              ]
            }
          ]
        }
      }
    });

    const toWire = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateExtrude",
          id: "feature_wire",
          profile: clockwiseProfile
        }
      ]
    });
    expect(toWire).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          inputReferences: [
            {
              before: entityProfile,
              after: counterclockwiseProfile,
              profileOrientationNormalized: true,
              affectedSketchIds: ["sketch_wire"],
              affectedEntityIds: [
                "rectangle",
                "line_a",
                "line_b",
                "line_c",
                "line_d"
              ]
            }
          ]
        }
      }
    });
    expect(engine.undo()?.transaction.diff.features?.inputReferences).toEqual(
      toWire.ok ? toWire.semanticDiff.features?.inputReferences : undefined
    );
    expect(engine.redo()?.transaction.diff.features?.inputReferences).toEqual(
      toWire.ok ? toWire.semanticDiff.features?.inputReferences : undefined
    );
  });

  it("dry-runs proposed composite profile retargets through feature.editability", () => {
    const engine = createWireEngine();
    engine.apply({
      op: "feature.extrude",
      id: "feature_wire",
      bodyId: "body_wire",
      profile: counterclockwiseProfile,
      depth: 2
    });

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_wire",
          proposedEdit: { kind: "extrude", profile: clockwiseProfile }
        }
      })
    ).toMatchObject({
      ok: true,
      status: "editable",
      dryRun: {
        status: "valid",
        willMutateDocument: false,
        commitOperation: "feature.updateExtrude"
      }
    });

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_wire",
          proposedEdit: {
            kind: "extrude",
            profile: {
              ...counterclockwiseProfile,
              segments: counterclockwiseProfile.segments.slice(0, 3)
            }
          }
        }
      })
    ).toMatchObject({
      ok: true,
      dryRun: {
        status: "blocked",
        diagnostics: [
          expect.objectContaining({
            code: "FEATURE_EDIT_INVALID_PROPOSAL",
            fieldPath: "profile"
          })
        ]
      }
    });
  });

  it("returns typed blocker errors and rejects mismatched input-reference history", () => {
    const engine = createWireEngine();
    const openProfile = {
      ...counterclockwiseProfile,
      segments: counterclockwiseProfile.segments.slice(0, 3)
    };
    const batch: CadBatch = {
      version: "cadops.v1",
      mode: "commit",
      ops: [{ op: "feature.extrude", profile: openProfile, depth: 2 }]
    };
    expect(engine.validateBatch(batch)).toMatchObject({
      ok: false,
      errors: [{ code: "SKETCH_PROFILE_OPEN" }]
    });
    const response: CadBatchResponse = engine.executeBatch(batch);
    expect(response).toMatchObject({
      ok: false,
      error: { code: "SKETCH_PROFILE_OPEN" }
    });

    engine.apply({
      op: "feature.extrude",
      id: "feature_wire",
      bodyId: "body_wire",
      profile: counterclockwiseProfile,
      depth: 2
    });
    const project = structuredClone(exportCadProject(engine));
    const inputReference = project.history.at(-1)?.diff.features
      ?.inputReferences?.[0] as { inputKind: string } | undefined;
    expect(inputReference).toBeDefined();
    inputReference!.inputKind = "path";
    expect(() => importCadProjectJson(JSON.stringify(project))).toThrow(
      /Transaction diff must be a valid semantic diff/
    );
  });
});
