import { describe, expect, it } from "vitest";
import type {
  BodyId,
  CadBodyDerivedExactMetadataSnapshot,
  ProjectExactExportQuery,
  ProjectExactExportQueryResponse,
  ProjectExportReadinessQueryResponse
} from "@web-cad/cad-protocol";
import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject
} from "./index";

function createPrimitiveProject(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "scene.createBox",
      id: "z",
      name: "  Bracket Ω  ",
      dimensions: { width: 1, height: 2, depth: 3 }
    },
    {
      op: "scene.createSphere",
      id: "a",
      name: "Bracket Ω",
      dimensions: { radius: 2 }
    },
    {
      op: "scene.createCylinder",
      id: "n",
      dimensions: { radius: 1, height: 4 }
    }
  ]);
  return engine;
}

function exactMetadata(
  engine: CadEngine,
  bodyId: BodyId
): CadBodyDerivedExactMetadataSnapshot {
  const topology = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });
  if (!topology.ok || topology.query !== "body.topology") {
    throw new Error(`Expected topology for ${bodyId}.`);
  }
  return {
    bodyId,
    sourceIdentitySignature: topology.topology.sourceIdentity.signature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      bounds: {
        min: [0, 0, 0],
        max: [1, 1, 1],
        size: [1, 1, 1],
        center: [0.5, 0.5, 0.5]
      },
      volume: 1,
      surfaceArea: 6,
      centroid: [0.5, 0.5, 0.5],
      topologyCounts: {
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      },
      diagnostics: []
    }
  };
}

function readiness(
  engine: CadEngine,
  derivedExactMetadata: readonly CadBodyDerivedExactMetadataSnapshot[] = []
): ProjectExportReadinessQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.exportReadiness", derivedExactMetadata }
  });
  if (!response.ok || response.query !== "project.exportReadiness") {
    throw new Error("Expected export readiness response.");
  }
  return response;
}

function exact(
  engine: CadEngine,
  input: Omit<ProjectExactExportQuery, "query" | "format"> = {}
): ProjectExactExportQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.exportExact",
      format: "step",
      ...input
    }
  });
  if (!response.ok || response.query !== "project.exportExact") {
    throw new Error("Expected exact export response.");
  }
  return response;
}

describe("V21 exact export planning", () => {
  it("orders Export all canonically and binds names and source identity", () => {
    const engine = createPrimitiveProject();
    const first = readiness(engine);
    const second = readiness(engine);

    expect(first.plan).toMatchObject({
      format: "step",
      schema: "AP242DIS",
      orderedBodyIds: ["body:a", "body:n", "body:z"],
      allOrNothing: true,
      bodies: [
        { bodyId: "body:a", bodyName: "Bracket Ω", status: "blocked" },
        { bodyId: "body:n", bodyName: "body:n", status: "blocked" },
        { bodyId: "body:z", bodyName: "Bracket Ω", status: "blocked" }
      ]
    });
    expect(first.currentExactResults?.map((result) => result.status)).toEqual([
      "pending",
      "pending",
      "pending"
    ]);
    const health = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(health).toMatchObject({
      ok: true,
      query: "project.health",
      exactBodyCount: 3,
      exactReadyBodyCount: 0,
      exactPendingBodyCount: 3,
      currentExactResults: [
        { sourceType: "primitiveFeature", status: "pending" },
        { sourceType: "primitiveFeature", status: "pending" },
        { sourceType: "primitiveFeature", status: "pending" }
      ]
    });
    expect(first.plan?.planIdentity).toBe(second.plan?.planIdentity);

    engine.apply({ op: "scene.renameObject", id: "z", name: "Changed" });
    expect(readiness(engine).plan?.planIdentity).not.toBe(
      first.plan?.planIdentity
    );
  });

  it("preserves explicit order and lets a ready subset ignore blocked bodies", () => {
    const engine = createPrimitiveProject();
    const ready = [
      exactMetadata(engine, "body:z"),
      exactMetadata(engine, "body:a")
    ];
    const sourceIdentity = createCadProjectSourceIdentity(
      exportCadProject(engine)
    );

    expect(exact(engine, { derivedExactMetadata: [ready[1]!] })).toMatchObject({
      canExportFile: false,
      exportableBodyCount: 0
    });
    const subset = exact(engine, {
      bodyIds: ["body:z", "body:a"],
      sourceIdentity,
      derivedExactMetadata: ready
    });
    expect(subset).toMatchObject({
      status: "supported",
      canExportFile: true,
      exportableBodyCount: 2,
      requestedBodyIds: ["body:z", "body:a"],
      plan: {
        orderedBodyIds: ["body:z", "body:a"],
        bodies: [{ status: "ready" }, { status: "ready" }]
      }
    });
  });

  it("blocks duplicate, missing, and consumed explicit selections", () => {
    const engine = createPrimitiveProject();
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body:a", "body:a"]
        }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_QUERY" }
    });
    expect(exact(engine, { bodyIds: ["body:missing"] })).toMatchObject({
      canExportFile: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "EXPORT_BODY_SELECTION_INVALID" })
      ])
    });

    const consumed = new CadEngine();
    consumed.applyBatch([
      {
        op: "sketch.create",
        id: "target_sketch",
        name: "Target",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "target_sketch",
        id: "target_profile",
        center: [0, 0],
        width: 4,
        height: 3
      },
      {
        op: "feature.extrude",
        id: "target_feature",
        bodyId: "target_body",
        sketchId: "target_sketch",
        entityId: "target_profile",
        depth: 2
      },
      {
        op: "sketch.create",
        id: "hole_sketch",
        name: "Hole",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "hole_sketch",
        id: "hole_profile",
        center: [0, 0],
        radius: 0.5
      },
      {
        op: "feature.hole",
        id: "hole_feature",
        bodyId: "hole_body",
        targetBodyId: "target_body",
        sketchId: "hole_sketch",
        circleEntityId: "hole_profile",
        depthMode: "throughAll",
        direction: "positive"
      }
    ]);
    expect(exact(consumed, { bodyIds: ["target_body"] })).toMatchObject({
      canExportFile: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "EXPORT_BODY_NOT_ACTIVE" })
      ])
    });
  });

  it("keeps plans and current evidence free of private execution state", () => {
    const serialized = JSON.stringify(readiness(createPrimitiveProject()));
    expect(serialized).not.toMatch(
      /bytesBase64|brepBytes|stepBytes|fileHandle|localPath|opfsPath|rendererId|meshId|occtHandle|workerId|cacheId|cacheKey/
    );
  });
});
