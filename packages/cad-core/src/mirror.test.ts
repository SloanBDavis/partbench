import { describe, expect, it } from "vitest";
import type {
  ProjectStructureQueryResponse,
  ReferenceHealthQueryResponse,
  TransactionHistoryQueryResponse,
  CadBodySnapshot
} from "@web-cad/cad-protocol";
import {
  CadEngine,
  CAD_PROJECT_FORMAT_VERSION_V19,
  createEmptyTopologyIdentitySourceSnapshot,
  exportCadProject,
  importCadProject,
  type CadProject
} from "./index";

// Slice F — Mirror feature. Lifecycle contract (see docs/v15.md Slice F):
// the mirror seed body is consumed only when includeOriginal is true (the
// result union subsumes the seed, mirroring the linear/circular pattern
// family). When includeOriginal is false the result is the mirrored copy
// alone and the seed body survives as an independent active body.

function createSeedEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [1, 1],
      width: 4,
      height: 2
    },
    {
      op: "feature.extrude",
      id: "feat_seed",
      bodyId: "body_seed",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 3
    }
  ]);

  return engine;
}

function readStructure(engine: CadEngine): ProjectStructureQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure response.");
  }

  return response;
}

function readReferenceHealth(engine: CadEngine): ReferenceHealthQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "reference.health" }
  });

  if (!response.ok || response.query !== "reference.health") {
    throw new Error("Expected reference.health response.");
  }

  return response;
}

function readTransactionHistory(
  engine: CadEngine
): TransactionHistoryQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "transaction.history" }
  });

  if (!response.ok || response.query !== "transaction.history") {
    throw new Error("Expected transaction.history response.");
  }

  return response;
}

function bodyById(
  structure: ProjectStructureQueryResponse,
  bodyId: string
): CadBodySnapshot | undefined {
  return structure.bodies.find((body) => body.id === bodyId);
}

describe("feature.mirror", () => {
  it("creates an independent mirror body and keeps the seed active when includeOriginal is false", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "YZ",
        includeOriginal: false
      }
    ]);

    const feature = engine.getDocument().features.get("feat_mirror");
    expect(feature).toMatchObject({
      kind: "mirror",
      seedBodyId: "body_seed",
      mirrorPlane: "YZ",
      includeOriginal: false,
      bodyId: "body_mirror"
    });

    const structure = readStructure(engine);
    const seed = bodyById(structure, "body_seed");
    const mirror = bodyById(structure, "body_mirror");

    // Seed survives: no consuming feature marks it consumed.
    expect(seed).toBeDefined();
    expect(seed).not.toHaveProperty("consumedByFeatureId");
    expect(mirror).toMatchObject({
      id: "body_mirror",
      source: expect.objectContaining({
        type: "mirrorFeature",
        featureId: "feat_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "YZ",
        includeOriginal: false
      })
    });
    expect(mirror).not.toHaveProperty("consumedByFeatureId");
  });

  it("consumes the seed body into the union result when includeOriginal is true", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "XY",
        includeOriginal: true
      }
    ]);

    const structure = readStructure(engine);
    const seed = bodyById(structure, "body_seed");
    const mirror = bodyById(structure, "body_mirror");

    // Result union subsumes the seed, so the seed is consumed by the mirror.
    expect(seed).toMatchObject({ consumedByFeatureId: "feat_mirror" });
    expect(mirror).toMatchObject({
      id: "body_mirror",
      source: expect.objectContaining({
        type: "mirrorFeature",
        includeOriginal: true
      })
    });
    expect(mirror).not.toHaveProperty("consumedByFeatureId");
  });

  it("edits the mirror plane through feature.updateMirror", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "XY",
        includeOriginal: false
      },
      {
        op: "feature.updateMirror",
        id: "feat_mirror",
        mirrorPlane: "XZ"
      }
    ]);

    expect(engine.getDocument().features.get("feat_mirror")).toMatchObject({
      kind: "mirror",
      mirrorPlane: "XZ",
      includeOriginal: false
    });
  });

  it("consumes the seed when includeOriginal is toggled on, and releases it when toggled off", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "YZ",
        includeOriginal: false
      }
    ]);

    expect(bodyById(readStructure(engine), "body_seed")).not.toHaveProperty(
      "consumedByFeatureId"
    );

    engine.applyBatch([
      { op: "feature.updateMirror", id: "feat_mirror", includeOriginal: true }
    ]);

    expect(bodyById(readStructure(engine), "body_seed")).toMatchObject({
      consumedByFeatureId: "feat_mirror"
    });

    engine.applyBatch([
      { op: "feature.updateMirror", id: "feat_mirror", includeOriginal: false }
    ]);

    // Toggling includeOriginal back off releases the seed: it is active again.
    expect(bodyById(readStructure(engine), "body_seed")).not.toHaveProperty(
      "consumedByFeatureId"
    );
  });

  it("rejects a mirror whose seed body is already consumed by another feature", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror_1",
        bodyId: "body_mirror_1",
        seedBodyId: "body_seed",
        mirrorPlane: "XY",
        includeOriginal: true
      }
    ]);

    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.mirror",
            id: "feat_mirror_2",
            bodyId: "body_mirror_2",
            seedBodyId: "body_seed",
            mirrorPlane: "XZ",
            includeOriginal: false
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: {
        code: "MIRROR_SEED_BODY_CONSUMED",
        op: "feature.mirror",
        bodyId: "body_seed"
      }
    });
  });

  it("allows two non-consuming mirrors to share an active seed body", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror_1",
        bodyId: "body_mirror_1",
        seedBodyId: "body_seed",
        mirrorPlane: "XY",
        includeOriginal: false
      },
      {
        op: "feature.mirror",
        id: "feat_mirror_2",
        bodyId: "body_mirror_2",
        seedBodyId: "body_seed",
        mirrorPlane: "YZ",
        includeOriginal: false
      }
    ]);

    const structure = readStructure(engine);
    expect(bodyById(structure, "body_seed")).not.toHaveProperty(
      "consumedByFeatureId"
    );
    expect(bodyById(structure, "body_mirror_1")).toBeDefined();
    expect(bodyById(structure, "body_mirror_2")).toBeDefined();
  });

  it("rejects an invalid mirror plane", () => {
    const engine = createSeedEngine();

    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.mirror",
            seedBodyId: "body_seed",
            // @ts-expect-error invalid mirror plane literal
            mirrorPlane: "AB",
            includeOriginal: false
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_FEATURE", op: "feature.mirror" }
    });
  });

  it("rejects a mirror whose seed body does not exist", () => {
    const engine = createSeedEngine();

    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.mirror",
            seedBodyId: "body_missing",
            mirrorPlane: "XY",
            includeOriginal: false
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "BODY_NOT_FOUND", op: "feature.mirror" }
    });
  });

  it("reports the seed references as active when the seed survives (includeOriginal false)", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "YZ",
        includeOriginal: false
      }
    ]);

    const health = readReferenceHealth(engine);
    expect(health.ok).toBe(true);

    const seedEntries = health.referenceHealth.filter(
      (entry) => entry.bodyId === "body_seed"
    );
    expect(seedEntries.length).toBeGreaterThan(0);
    expect(seedEntries.every((entry) => entry.status === "active")).toBe(true);
  });

  it("reports the seed references as consumed when the union subsumes the seed (includeOriginal true)", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "YZ",
        includeOriginal: true
      }
    ]);

    const health = readReferenceHealth(engine);
    expect(health.ok).toBe(true);

    const seedEntries = health.referenceHealth.filter(
      (entry) => entry.bodyId === "body_seed"
    );
    expect(seedEntries.length).toBeGreaterThan(0);
    expect(seedEntries.every((entry) => entry.status === "consumed")).toBe(
      true
    );
  });

  it("summarizes mirror create and update operations in transaction history", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "XZ",
        includeOriginal: true
      },
      { op: "feature.updateMirror", id: "feat_mirror", mirrorPlane: "YZ" }
    ]);

    const history = readTransactionHistory(engine);
    const labels = history.transactions.flatMap((transaction) =>
      transaction.ops.map((operation) => operation.label)
    );

    expect(labels.some((label) => /Create mirror feature/.test(label))).toBe(
      true
    );
    expect(labels.some((label) => /Update mirror feature/.test(label))).toBe(
      true
    );
  });

  it("round-trips a mirror feature through V19 project export and import", () => {
    const engine = createSeedEngine();

    engine.applyBatch([
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_seed",
        mirrorPlane: "XZ",
        includeOriginal: true
      }
    ]);

    const project = exportCadProject(engine);
    // A mirror feature is a V19 source record.
    expect(project.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V19);

    // V19 documents carry a topology identity source contract; the mirror
    // itself creates no checkpoints, so supply an empty identity for re-import.
    const importable = {
      ...project,
      document: {
        ...project.document,
        topologyIdentity: createEmptyTopologyIdentitySourceSnapshot()
      },
      history: [],
      redoStack: []
    } as CadProject;

    const reimported = importCadProject(importable);
    expect(reimported.getDocument().features.get("feat_mirror")).toMatchObject({
      kind: "mirror",
      seedBodyId: "body_seed",
      mirrorPlane: "XZ",
      includeOriginal: true,
      bodyId: "body_mirror"
    });
  });
});
