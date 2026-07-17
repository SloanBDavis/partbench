import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V19,
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  createEmptyTopologyIdentitySourceSnapshot,
  exportCadProject,
  exportCadProjectWcad,
  importCadProject,
  parseCadProjectJson,
  resolveMirrorPlaneFrame,
  type CadProject
} from "./index";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;

type MutableFixtureRecord = Record<string, unknown>;

function requireFixtureRecord(
  value: unknown,
  label: string
): MutableFixtureRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object fixture.`);
  }
  return value as MutableFixtureRecord;
}

function requireFixtureRecords(
  value: unknown,
  label: string
): MutableFixtureRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array fixture.`);
  }
  return value.map((entry, index) =>
    requireFixtureRecord(entry, `${label}[${index}]`)
  );
}

function cloneFixtureRecord(
  value: unknown,
  label: string
): MutableFixtureRecord {
  return requireFixtureRecord(JSON.parse(JSON.stringify(value)), label);
}

function findFixtureFeature(
  project: MutableFixtureRecord,
  featureId: string
): MutableFixtureRecord {
  const document = requireFixtureRecord(project.document, "project.document");
  const feature = requireFixtureRecords(
    document.features,
    "project.document.features"
  ).find((candidate) => candidate.id === featureId);
  if (!feature) throw new Error(`Missing feature fixture: ${featureId}.`);
  return feature;
}

function omitFixtureFields(
  value: object,
  fields: readonly string[]
): MutableFixtureRecord {
  const copy = { ...(value as unknown as MutableFixtureRecord) };
  for (const field of fields) delete copy[field];
  return copy;
}

function createSeedEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 2,
      height: 2
    },
    {
      op: "feature.extrude",
      id: "feat_seed",
      bodyId: "body_seed",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 2
    }
  ]);
  return engine;
}

describe("V16 protocol and V20 persistence", () => {
  it("normalizes linear pattern sugar and regenerates durable Mat4 instances", () => {
    const engine = createSeedEngine();
    engine.applyBatch([
      {
        op: "feature.linearPattern",
        id: "feat_pattern",
        bodyId: "body_pattern",
        seedBodyId: "body_seed",
        axis: "x",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 3,
        instanceCount: 3
      }
    ]);

    expect(engine.getDocument().features.get("feat_pattern")).toMatchObject({
      kind: "linearPattern",
      direction: { kind: "globalAxis", axis: "x" },
      instances: [
        { instanceIndex: 0, transform: IDENTITY },
        {
          instanceIndex: 1,
          transform: [1, 0, 0, 3, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          instanceIndex: 2,
          transform: [1, 0, 0, 6, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    });

    engine.apply({
      op: "feature.updateLinearPattern",
      id: "feat_pattern",
      spacing: 5,
      instanceCount: 2
    });
    expect(engine.getDocument().features.get("feat_pattern")).toMatchObject({
      instances: [
        { instanceIndex: 0, transform: IDENTITY },
        {
          instanceIndex: 1,
          transform: [1, 0, 0, 5, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    });
  });

  it("rejects disagreeing V15 sugar and V20 reference fields", () => {
    const linear = createSeedEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.linearPattern",
          seedBodyId: "body_seed",
          axis: "x",
          direction: { kind: "globalAxis", axis: "y" },
          spacing: 2,
          instanceCount: 2
        }
      ]
    });
    expect(linear).toMatchObject({
      ok: false,
      error: { code: "INVALID_FEATURE", op: "feature.linearPattern" }
    });

    const mirror = createSeedEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.mirror",
          seedBodyId: "body_seed",
          mirrorPlane: "XY",
          plane: { kind: "standardPlane", plane: "YZ", offset: 0 },
          includeOriginal: false
        }
      ]
    });
    expect(mirror).toMatchObject({
      ok: false,
      error: { code: "INVALID_FEATURE", op: "feature.mirror" }
    });
  });

  it("uses full-circle spacing for deterministic circular Mat4 instances", () => {
    const engine = createSeedEngine();
    engine.apply({
      op: "feature.circularPattern",
      id: "feat_pattern",
      bodyId: "body_pattern",
      seedBodyId: "body_seed",
      rotationAxis: { kind: "globalAxis", axis: "z" },
      totalAngleDegrees: 360,
      instanceCount: 4
    });

    const feature = engine.getDocument().features.get("feat_pattern");
    if (!feature || feature.kind !== "circularPattern") {
      throw new Error("Expected circular pattern feature.");
    }
    expect(feature.instances).toHaveLength(4);
    expect(feature.instances[0]).toEqual({
      instanceIndex: 0,
      transform: IDENTITY
    });
    expect(feature.instances[1]).toEqual({
      instanceIndex: 1,
      transform: [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    });
    expect(feature.instances[3]?.transform).not.toEqual(IDENTITY);
  });

  it("queries durable instances and reports metadata-backed multi-solid status", () => {
    const engine = createSeedEngine();
    engine.apply({
      op: "feature.linearPattern",
      id: "feat_pattern",
      bodyId: "body_pattern",
      seedBodyId: "body_seed",
      axis: "x",
      spacing: 4,
      instanceCount: 3
    });

    const unknown = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.patternInstances", bodyId: "body_pattern" }
    });
    expect(unknown).toMatchObject({
      ok: true,
      query: "body.patternInstances",
      featureId: "feat_pattern",
      patternKind: "linearPattern",
      instanceCount: 3,
      multiSolid: false,
      multiSolidStatus: "unknown",
      diagnostics: [{ code: "PATTERN_SOLID_COUNT_UNAVAILABLE" }]
    });

    const multiSolid = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.patternInstances",
        bodyId: "body_pattern",
        derivedExactMetadata: {
          bodyId: "body_pattern",
          sourceIdentitySignature: "pattern-source",
          status: "ready",
          metadata: {
            source: "kernel-derived",
            confidence: "kernel-derived",
            topologyCounts: {
              solidCount: 3,
              faceCount: 18,
              edgeCount: 36,
              vertexCount: 24
            },
            diagnostics: []
          }
        }
      }
    });
    expect(multiSolid).toMatchObject({
      ok: true,
      solidCount: 3,
      multiSolid: true,
      multiSolidStatus: "multi",
      diagnostics: [{ code: "PATTERN_MULTI_SOLID_RESULT" }]
    });
    if (!multiSolid.ok || multiSolid.query !== "body.patternInstances") {
      throw new Error("Expected pattern instance query response.");
    }
    expect(multiSolid.instances.map((instance) => instance.index)).toEqual([
      0, 1, 2
    ]);
  });

  it("resolves generated and named linear-edge frames for pattern transforms", () => {
    const linear = createSeedEngine();
    linear.apply({
      op: "feature.linearPattern",
      id: "feat_pattern",
      bodyId: "body_pattern",
      seedBodyId: "body_seed",
      direction: {
        kind: "generatedEdge",
        bodyId: "body_seed",
        stableId: "generated:edge:body_seed:start:uMin"
      },
      spacing: 4,
      instanceCount: 2
    });
    expect(linear.getDocument().features.get("feat_pattern")).toMatchObject({
      direction: {
        kind: "generatedEdge",
        bodyId: "body_seed",
        stableId: "generated:edge:body_seed:start:uMin"
      },
      instances: [
        { instanceIndex: 0, transform: IDENTITY },
        {
          instanceIndex: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 4, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    });

    const circular = createSeedEngine();
    circular.apply({
      op: "reference.nameGenerated",
      name: "Corner axis",
      bodyId: "body_seed",
      stableId: "generated:edge:body_seed:longitudinal:uMin:vMin"
    });
    circular.apply({
      op: "feature.circularPattern",
      id: "feat_pattern",
      bodyId: "body_pattern",
      seedBodyId: "body_seed",
      rotationAxis: { kind: "namedReference", name: "Corner axis" },
      totalAngleDegrees: 360,
      instanceCount: 4
    });
    const circularFeature = circular.getDocument().features.get("feat_pattern");
    expect(circularFeature).toMatchObject({
      rotationAxis: { kind: "namedReference", name: "Corner axis" }
    });
    if (!circularFeature || circularFeature.kind !== "circularPattern") {
      throw new Error("Expected circular pattern feature.");
    }
    expect(circularFeature.instances[1]?.transform).toEqual([
      0, -1, 0, -2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
    ]);
  });

  it("resolves offset named planar faces for mirror geometry", () => {
    const engine = createSeedEngine();
    engine.apply({
      op: "reference.nameGenerated",
      name: "Top plane",
      bodyId: "body_seed",
      stableId: "generated:face:body_seed:endCap"
    });
    engine.apply({
      op: "feature.mirror",
      id: "feat_mirror",
      bodyId: "body_mirror",
      seedBodyId: "body_seed",
      plane: { kind: "namedReference", name: "Top plane", offset: 1 },
      includeOriginal: false
    });

    expect(engine.getDocument().features.get("feat_mirror")).toMatchObject({
      plane: { kind: "namedReference", name: "Top plane", offset: 1 }
    });
    const resolved = resolveMirrorPlaneFrame(engine.getDocument(), {
      kind: "namedReference",
      name: "Top plane",
      offset: 1
    });
    expect(resolved).toEqual({
      ok: true,
      frame: { point: [0, 0, 3], normal: [0, 0, 1] }
    });
  });

  it("resolves active topology anchors and filters selection candidates by proof", () => {
    const engine = createSeedEngine();
    engine.applyBatch([
      {
        op: "topology.checkpoint.create",
        checkpointId: "checkpoint_seed",
        bodyId: "body_seed",
        sourceFeatureId: "feat_seed",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "1111111111111111111111111111111111111111111111111111111111111111"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: "anchor_edge",
        entityKind: "edge",
        bodyId: "body_seed",
        checkpointId: "checkpoint_seed",
        checkpointEntityId: "checkpoint-edge",
        sourceFeatureId: "feat_seed",
        stableId: "generated:edge:body_seed:start:uMin",
        sourceSemanticRole: "start:uMin"
      },
      {
        op: "feature.linearPattern",
        id: "feat_pattern",
        bodyId: "body_pattern",
        seedBodyId: "body_seed",
        direction: {
          kind: "topologyAnchor",
          bodyId: "body_seed",
          anchorId: "anchor_edge"
        },
        spacing: 2,
        instanceCount: 2
      }
    ]);
    expect(engine.getDocument().features.get("feat_pattern")).toMatchObject({
      direction: {
        kind: "topologyAnchor",
        bodyId: "body_seed",
        anchorId: "anchor_edge"
      }
    });

    const picker = createSeedEngine().executeQuery({
      version: "cadops.v1",
      query: {
        query: "selection.referenceCandidates",
        selection: {
          type: "generatedReference",
          bodyId: "body_seed",
          stableId: "generated:edge:body_seed:start:uMin",
          expectedKind: "edge"
        },
        requiredOperation: "feature.linearPatternDirection"
      }
    });
    expect(picker).toMatchObject({
      ok: true,
      status: "resolved",
      candidates: [
        expect.objectContaining({
          commandable: true,
          commandOperations: expect.arrayContaining([
            "feature.linearPatternDirection",
            "feature.circularPatternAxis"
          ])
        })
      ]
    });
  });

  it("returns structured diagnostics for stale, curved, and invalid reference inputs", () => {
    const stale = createSeedEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.linearPattern",
          seedBodyId: "body_seed",
          direction: { kind: "namedReference", name: "Missing edge" },
          spacing: 2,
          instanceCount: 2
        }
      ]
    });
    expect(stale).toMatchObject({
      ok: false,
      error: { code: "PATTERN_DIRECTION_UNRESOLVED" }
    });

    const curvedEngine = new CadEngine();
    curvedEngine.apply({
      op: "sketch.create",
      id: "sketch_circle",
      name: "Circle profile",
      plane: "XY"
    });
    curvedEngine.apply({
      op: "sketch.addCircle",
      sketchId: "sketch_circle",
      id: "circle_1",
      center: [0, 0],
      radius: 0.25
    });
    curvedEngine.apply({
      op: "feature.extrude",
      id: "feat_circle",
      bodyId: "body_circle",
      sketchId: "sketch_circle",
      entityId: "circle_1",
      depth: 1
    });
    const curved = curvedEngine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.circularPattern",
          seedBodyId: "body_circle",
          rotationAxis: {
            kind: "generatedEdge",
            bodyId: "body_circle",
            stableId: "generated:edge:body_circle:start:circular"
          },
          totalAngleDegrees: 360,
          instanceCount: 3
        }
      ]
    });
    expect(curved).toMatchObject({
      ok: false,
      error: { code: "PATTERN_AXIS_UNSUPPORTED" }
    });

    const invalidOffset = createSeedEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.mirror",
          seedBodyId: "body_seed",
          plane: { kind: "standardPlane", plane: "XY", offset: Infinity },
          includeOriginal: false
        }
      ]
    });
    expect(invalidOffset).toMatchObject({
      ok: false,
      error: { code: "MIRROR_OFFSET_INVALID", path: "$.ops[0].plane.offset" }
    });
  });

  it("migrates V19 pattern snapshots and saves only the V20 union shape", async () => {
    const engine = createSeedEngine();
    engine.apply({
      op: "feature.linearPattern",
      id: "feat_pattern",
      bodyId: "body_pattern",
      seedBodyId: "body_seed",
      axis: "y",
      spacing: 4,
      instanceCount: 3
    });
    const v20 = exportCadProject(engine);
    const legacyFeatures = v20.document.features.map((feature) => {
      if (feature.kind !== "linearPattern") {
        return feature;
      }
      const { direction, instances, ...legacy } = feature;
      void direction;
      void instances;
      return { ...legacy, axis: "y" as const };
    });
    const legacy = {
      ...v20,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V19,
      document: {
        ...v20.document,
        features: legacyFeatures,
        topologyIdentity: createEmptyTopologyIdentitySourceSnapshot()
      },
      history: [],
      redoStack: []
    } as unknown as CadProject;

    const restored = importCadProject(legacy);
    expect(restored.getDocument().features.get("feat_pattern")).toMatchObject({
      direction: { kind: "globalAxis", axis: "y" },
      instances: [
        { instanceIndex: 0, transform: IDENTITY },
        { instanceIndex: 1, transform: expect.any(Array) },
        { instanceIndex: 2, transform: expect.any(Array) }
      ]
    });

    const saved = exportCadProject(restored);
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    const savedPattern = saved.document.features.find(
      (feature) => feature.id === "feat_pattern"
    );
    expect(savedPattern).toMatchObject({
      kind: "linearPattern",
      direction: { kind: "globalAxis", axis: "y" },
      instances: expect.any(Array)
    });
    expect(savedPattern).not.toHaveProperty("axis");

    const packageResult = await exportCadProjectWcad(restored);
    expect(packageResult.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_UPGRADED_TO_V20",
        severity: "info",
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V20
      })
    );
  });

  it("imports parsed V19 linear, circular, and mirror sugar without revalidating normalized shapes", () => {
    const engine = createSeedEngine();
    engine.applyBatch([
      {
        op: "feature.linearPattern",
        id: "feat_linear",
        bodyId: "body_linear",
        seedBodyId: "body_seed",
        direction: { kind: "globalAxis", axis: "y" },
        spacing: 4,
        instanceCount: 3
      },
      {
        op: "feature.circularPattern",
        id: "feat_circular",
        bodyId: "body_circular",
        seedBodyId: "body_linear",
        rotationAxis: { kind: "globalAxis", axis: "z" },
        totalAngleDegrees: 270,
        instanceCount: 3
      },
      {
        op: "feature.mirror",
        id: "feat_mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_circular",
        plane: { kind: "standardPlane", plane: "XZ", offset: 0 },
        includeOriginal: true
      }
    ]);

    const v20 = exportCadProject(engine);
    const legacyFeatures = v20.document.features.map((feature) => {
      if (feature.kind === "linearPattern") {
        const base = omitFixtureFields(feature, ["direction", "instances"]);
        return { ...base, axis: "y" as const };
      }
      if (feature.kind === "circularPattern") {
        const base = omitFixtureFields(feature, ["instances"]);
        return { ...base, rotationAxis: "z" as const };
      }
      if (feature.kind === "mirror") {
        const base = omitFixtureFields(feature, ["plane"]);
        return { ...base, mirrorPlane: "XZ" as const };
      }
      return feature;
    });
    const rawV19 = {
      ...v20,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V19,
      document: {
        ...v20.document,
        features: legacyFeatures,
        topologyIdentity: createEmptyTopologyIdentitySourceSnapshot()
      },
      history: [],
      redoStack: []
    } as unknown as CadProject;

    const parsed = parseCadProjectJson(JSON.stringify(rawV19));
    expect(parsed.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(parsed.document.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "feat_linear",
          direction: { kind: "globalAxis", axis: "y" },
          instances: expect.any(Array)
        }),
        expect.objectContaining({
          id: "feat_circular",
          rotationAxis: { kind: "globalAxis", axis: "z" },
          instances: expect.any(Array)
        }),
        expect.objectContaining({
          id: "feat_mirror",
          plane: { kind: "standardPlane", plane: "XZ", offset: 0 }
        })
      ])
    );

    const restored = importCadProject(parsed);
    expect(restored.getDocument().features.get("feat_linear")).toMatchObject({
      direction: { kind: "globalAxis", axis: "y" }
    });
    expect(restored.getDocument().features.get("feat_circular")).toMatchObject({
      rotationAxis: { kind: "globalAxis", axis: "z" }
    });
    expect(restored.getDocument().features.get("feat_mirror")).toMatchObject({
      plane: { kind: "standardPlane", plane: "XZ", offset: 0 }
    });

    const cloned = JSON.parse(JSON.stringify(parsed)) as CadProject;
    expect(() => importCadProject(cloned)).not.toThrow();

    const renamed = {
      ...parsed,
      document: {
        ...parsed.document,
        features: parsed.document.features.map((feature) =>
          feature.id === "feat_linear"
            ? { ...feature, name: "Renamed linear pattern" }
            : feature
        )
      }
    } as CadProject;
    expect(
      importCadProject(renamed).getDocument().features.get("feat_linear")
    ).toMatchObject({ name: "Renamed linear pattern" });

    const invalidNormalized = cloneFixtureRecord(parsed, "parsed project");
    const invalidDirection = requireFixtureRecord(
      findFixtureFeature(invalidNormalized, "feat_linear").direction,
      "linear pattern direction"
    );
    invalidDirection.axis = "invalid";
    expect(() =>
      importCadProject(invalidNormalized as unknown as CadProject)
    ).toThrowError(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "INVALID_FEATURE",
            path: "$.document.features[1].direction"
          })
        ])
      })
    );

    const mixedCases = [
      {
        featureId: "feat_linear",
        field: "direction",
        value: { kind: "globalAxis", axis: "y" },
        path: "$.document.features[1].direction"
      },
      {
        featureId: "feat_circular",
        field: "instances",
        value: [
          { instanceIndex: 0, transform: IDENTITY },
          { instanceIndex: 1, transform: IDENTITY },
          { instanceIndex: 2, transform: IDENTITY }
        ],
        path: "$.document.features[2].instances"
      },
      {
        featureId: "feat_mirror",
        field: "plane",
        value: { kind: "standardPlane", plane: "XZ", offset: 0 },
        path: "$.document.features[3].plane"
      }
    ];
    for (const testCase of mixedCases) {
      const mixed = cloneFixtureRecord(rawV19, "raw V19 project");
      findFixtureFeature(mixed, testCase.featureId)[testCase.field] =
        testCase.value;
      expect(() => parseCadProjectJson(JSON.stringify(mixed))).toThrowError(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "INVALID_FEATURE",
              path: testCase.path
            })
          ])
        })
      );
    }
  });

  it("imports parsed V20 sweep and loft source through the normalized internal boundary", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "base", name: "Base", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "base",
        id: "base_circle",
        center: [0, 0],
        radius: 1
      },
      {
        op: "sketch.addRectangle",
        sketchId: "base",
        id: "pedestal_profile",
        center: [5, 0],
        width: 2,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_pedestal",
        bodyId: "body_pedestal",
        sketchId: "base",
        entityId: "pedestal_profile",
        depth: 5
      },
      {
        op: "sketch.createOnFace",
        id: "top",
        name: "Top",
        bodyId: "body_pedestal",
        faceStableId: "generated:face:body_pedestal:endCap"
      },
      {
        op: "sketch.addCircle",
        sketchId: "top",
        id: "top_circle",
        center: [0, 0],
        radius: 2
      },
      { op: "sketch.create", id: "path", name: "Path", plane: "XZ" },
      {
        op: "sketch.addLine",
        sketchId: "path",
        id: "path_line",
        start: [0, 0],
        end: [0, 5]
      },
      {
        op: "feature.sweep",
        id: "feat_sweep",
        bodyId: "body_sweep",
        profileSketchId: "base",
        profileEntityId: "base_circle",
        pathSketchId: "path",
        pathEntityIds: ["path_line"]
      },
      {
        op: "feature.loft",
        id: "feat_loft",
        bodyId: "body_loft",
        sections: [
          { sketchId: "base", entityId: "base_circle" },
          { sketchId: "top", entityId: "top_circle" }
        ]
      }
    ]);

    const source = exportCadProject(engine);
    expect(source.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    const restored = importCadProject(
      parseCadProjectJson(JSON.stringify(source))
    );
    expect(restored.getDocument().features.get("feat_sweep")).toMatchObject({
      profile: { kind: "entity", sketchId: "base", entityId: "base_circle" },
      path: {
        kind: "entity",
        sketchId: "path",
        entityId: "path_line",
        orientation: "forward"
      }
    });
    expect(restored.getDocument().features.get("feat_loft")).toMatchObject({
      sections: [
        {
          profile: {
            kind: "entity",
            sketchId: "base",
            entityId: "base_circle"
          }
        },
        {
          profile: {
            kind: "entity",
            sketchId: "top",
            entityId: "top_circle"
          }
        }
      ]
    });
  });
});
