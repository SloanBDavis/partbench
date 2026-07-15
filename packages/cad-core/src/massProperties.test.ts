import { describe, expect, it } from "vitest";
import type { CadBodyDerivedExactMetadataSnapshot } from "@web-cad/cad-protocol";
import { CadEngine } from "./index";

function createExtrudeEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch",
      id: "profile",
      center: [0, 0],
      width: 4,
      height: 2
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feature",
    bodyId: "body",
    sketchId: "sketch",
    entityId: "profile",
    depth: 3
  });
  return engine;
}

function createMetadata(
  engine: CadEngine,
  overrides: Partial<CadBodyDerivedExactMetadataSnapshot> = {}
): CadBodyDerivedExactMetadataSnapshot {
  const topology = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "body" }
  });
  if (!topology.ok || topology.query !== "body.topology") {
    throw new Error("Expected body topology.");
  }
  return {
    bodyId: "body",
    sourceIdentitySignature: topology.topology.sourceIdentity.signature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      volume: 24,
      surfaceArea: 52,
      centroid: [0, 0, 1.5],
      momentsOfInertia: {
        xx: 10,
        yy: 20,
        zz: 30,
        xy: 1,
        xz: 2,
        yz: 3
      },
      principalMoments: [8, 20, 32],
      diagnostics: []
    },
    ...overrides
  };
}

describe("body.massProperties", () => {
  it("projects exact metadata for active pattern result bodies", () => {
    const engine = createExtrudeEngine();
    engine.apply({
      op: "feature.linearPattern",
      id: "pattern",
      bodyId: "pattern_body",
      seedBodyId: "body",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 6,
      instanceCount: 3
    });
    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "pattern_body" }
    });
    if (!topology.ok || topology.query !== "body.topology") {
      throw new Error("Expected pattern topology identity.");
    }
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.massProperties",
        bodyId: "pattern_body",
        derivedExactMetadata: {
          bodyId: "pattern_body",
          sourceIdentitySignature: topology.topology.sourceIdentity.signature,
          status: "ready",
          metadata: {
            source: "kernel-derived",
            confidence: "kernel-derived",
            volume: 72,
            surfaceArea: 156,
            centroid: [6, 0, 1.5],
            diagnostics: []
          }
        }
      }
    });
    expect(response).toMatchObject({
      ok: true,
      massProperties: { bodyId: "pattern_body", volume: 72, mass: 72 }
    });
  });

  it("projects kernel-derived metadata and applies density to mass and inertia", () => {
    const engine = createExtrudeEngine();
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.massProperties",
        bodyId: "body",
        density: 2.5,
        derivedExactMetadata: createMetadata(engine)
      }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "body.massProperties",
      massProperties: {
        bodyId: "body",
        units: "mm",
        density: 2.5,
        volume: 24,
        surfaceArea: 52,
        centerOfMass: [0, 0, 1.5],
        mass: 60,
        momentsOfInertia: {
          xx: 25,
          yy: 50,
          zz: 75,
          xy: 2.5,
          xz: 5,
          yz: 7.5
        },
        principalMoments: [20, 50, 80],
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      }
    });

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body",
          derivedExactMetadata: createMetadata(engine)
        }
      })
    ).toMatchObject({
      ok: true,
      massProperties: { density: 1, volume: 24, mass: 24 }
    });
  });

  it("reports missing, stale, invalid-density, and consumed states", () => {
    const engine = createExtrudeEngine();
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "body.massProperties", bodyId: "body" }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "MASS_PROPERTIES_UNAVAILABLE" }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body",
          derivedExactMetadata: createMetadata(engine, {
            sourceIdentitySignature: "stale"
          })
        }
      })
    ).toMatchObject({ ok: false, error: { code: "MASS_PROPERTIES_STALE" } });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "body.massProperties", bodyId: "body", density: 0 }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "MASS_PROPERTIES_INVALID_DENSITY" }
    });

    engine.apply({
      op: "feature.extrude",
      id: "cut",
      bodyId: "cut_body",
      targetBodyId: "body",
      sketchId: "sketch",
      entityId: "profile",
      depth: 1,
      operationMode: "cut"
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body",
          derivedExactMetadata: createMetadata(engine)
        }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "MASS_PROPERTIES_BODY_CONSUMED" }
    });
  });
});
