import { describe, expect, it } from "vitest";

import {
  CAD_PROJECT_FORMAT_VERSION_V18,
  CAD_PROJECT_FORMAT_VERSION_V20,
  CAD_PROJECT_FORMAT_VERSION_V21,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  CadEngine,
  CadProjectImportError,
  createCadProjectSourceIdentity,
  createEmptyTopologyIdentitySourceSnapshot,
  createWcadV2CheckpointEntryPaths,
  encodeWcadCanonicalCbor,
  exportCadProject,
  exportCadProjectToWcad,
  importCadProject,
  parseCadProjectJson,
  readCadProjectWcad,
  type CadProject
} from "./index";

const textEncoder = new TextEncoder();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyProject(): CadProject {
  return exportCadProject(new CadEngine());
}

function createLegacyCorpusProject(version: number): CadProject {
  const engine = new CadEngine();
  engine.apply({
    op: "scene.createBox",
    id: "legacy_box",
    name: `V${version} source box`,
    dimensions: { width: 1, height: 2, depth: 3 }
  });
  const exported = exportCadProject(engine);
  const current = exported as unknown as {
    document: Record<string, unknown>;
  };
  const source = current.document;
  const document: Record<string, unknown> = {
    units: source.units,
    objects: source.objects,
    nextObjectNumber: source.nextObjectNumber
  };

  if (version >= 2) {
    Object.assign(document, {
      sketches: [],
      nextSketchNumber: 1,
      nextSketchEntityNumber: 1
    });
  }
  if (version >= 3) {
    Object.assign(document, {
      features: [],
      nextFeatureNumber: 1,
      nextBodyNumber: 1
    });
  }
  if (version >= 5) {
    Object.assign(document, { namedReferences: [] });
  }
  if (version >= 7) {
    Object.assign(document, {
      parameters: [],
      sketchDimensions: [],
      nextParameterNumber: 1,
      nextSketchDimensionNumber: 1
    });
  }
  if (version >= 8) {
    Object.assign(document, {
      sketchConstraints: [],
      nextSketchConstraintNumber: 1
    });
  }

  return {
    schemaVersion: `web-cad.project.v${version}`,
    document,
    history: exported.history,
    redoStack: []
  } as unknown as CadProject;
}

function entity(
  id: string,
  kind: "line" | "rectangle" | "circle",
  values: Record<string, unknown>
): Record<string, unknown> {
  return { id, kind, ...values, construction: false };
}

function sketch(
  id: string,
  entities: readonly Record<string, unknown>[],
  plane: "XY" | "XZ" | "YZ" = "XY"
): Record<string, unknown> {
  return { id, name: id, plane, entities };
}

function createNormalizedV21Project(): CadProject {
  const empty = createEmptyProject();
  return {
    ...empty,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
    document: {
      ...empty.document,
      sketches: [
        sketch("profiles", [
          entity("rect", "rectangle", {
            center: [0, 0],
            width: 4,
            height: 3
          }),
          entity("circle_a", "circle", { center: [0, 0], radius: 1 }),
          entity("circle_b", "circle", { center: [2, 0], radius: 1 }),
          entity("circle_c", "circle", { center: [4, 0], radius: 1 }),
          entity("circle_d", "circle", { center: [6, 0], radius: 1 }),
          entity("axis", "line", { start: [0, -3], end: [0, 3] })
        ]) as never,
        sketch(
          "path",
          [entity("path_1", "line", { start: [0, 0], end: [0, 5] })],
          "XZ"
        ) as never,
        sketch("loft_a", [
          entity("loft_rect_a", "rectangle", {
            center: [0, 0],
            width: 2,
            height: 2
          })
        ]) as never,
        sketch("loft_b", [
          entity("loft_rect_b", "rectangle", {
            center: [0, 0],
            width: 3,
            height: 3
          })
        ]) as never
      ],
      sketchConstraints: [
        {
          id: "concentric_1",
          name: "Concentric circles",
          sketchId: "profiles",
          entityId: "circle_b",
          kind: "concentric",
          primaryTarget: { entityId: "circle_a", entityKind: "circle" },
          secondaryTarget: { entityId: "circle_b", entityKind: "circle" }
        },
        {
          id: "equal_radius_1",
          name: "Equal circle radii",
          sketchId: "profiles",
          entityId: "circle_d",
          kind: "equalRadius",
          primaryTarget: { entityId: "circle_c", entityKind: "circle" },
          secondaryTarget: { entityId: "circle_d", entityKind: "circle" }
        }
      ] as never,
      features: [
        {
          id: "extrude_1",
          kind: "extrude",
          profile: { kind: "entity", sketchId: "profiles", entityId: "rect" },
          operationMode: "newBody",
          depth: 4,
          side: "positive",
          bodyId: "body_extrude"
        },
        {
          id: "revolve_1",
          kind: "revolve",
          profile: {
            kind: "entity",
            sketchId: "profiles",
            entityId: "circle_a"
          },
          axis: { type: "sketchLine", sketchId: "profiles", entityId: "axis" },
          angleDegrees: 180,
          operationMode: "newBody",
          bodyId: "body_revolve"
        },
        {
          id: "sweep_1",
          kind: "sweep",
          profile: {
            kind: "entity",
            sketchId: "profiles",
            entityId: "circle_b"
          },
          path: {
            kind: "entity",
            sketchId: "path",
            entityId: "path_1",
            orientation: "forward"
          },
          bodyId: "body_sweep"
        },
        {
          id: "loft_1",
          kind: "loft",
          sections: [
            {
              profile: {
                kind: "entity",
                sketchId: "loft_a",
                entityId: "loft_rect_a"
              }
            },
            {
              profile: {
                kind: "entity",
                sketchId: "loft_b",
                entityId: "loft_rect_b"
              }
            }
          ],
          bodyId: "body_loft"
        }
      ] as never
    }
  };
}

function createOrderedWireAndChainProject(): CadProject {
  const project = clone(createNormalizedV21Project()) as any;
  project.document.sketches[1].entities.push(
    entity("path_2", "line", { start: [0, 5], end: [5, 5] })
  );
  project.document.features[0].profile = {
    kind: "wire",
    sketchId: "path",
    segments: [
      { entityId: "path_1", orientation: "forward" },
      { entityId: "path_2", orientation: "reverse" }
    ]
  };
  project.document.features[2].path = {
    kind: "chain",
    sketchId: "path",
    segments: [
      { entityId: "path_1", orientation: "forward" },
      { entityId: "path_2", orientation: "forward" }
    ]
  };
  return project;
}

function expectV21Issue(project: CadProject, path: string): void {
  try {
    parseCadProjectJson(JSON.stringify(project));
    throw new Error(`Expected V21 source rejection at ${path}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(CadProjectImportError);
    expect((error as CadProjectImportError).issues).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_V21_SOURCE_INVALID", path })
    );
  }
}

describe("V17 V21 storage proof", () => {
  it("preserves committed history, redo, and historical op payloads through JSON and WCAD", async () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      name: "Legacy V1 box",
      dimensions: { width: 1, height: 2, depth: 3 }
    });
    engine.apply({
      op: "sketch.create",
      id: "sketch_1",
      name: "V2 sketch",
      plane: "XY"
    });
    engine.apply({
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 4,
      height: 2
    });
    engine.undo();

    const legacy = exportCadProject(engine);
    const source: CadProject = {
      ...legacy,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
      document: {
        ...legacy.document,
        sketches: legacy.document.sketches.map((entry) => ({
          ...entry,
          entities: entry.entities.map((item) => ({
            ...item,
            construction: false
          }))
        })) as never
      }
    };
    const expectedOps = {
      history: source.history.map((transaction) => transaction.ops),
      redo: source.redoStack.map((transaction) => transaction.ops)
    };
    const json = parseCadProjectJson(JSON.stringify(source));

    expect(json.history).toHaveLength(2);
    expect(json.redoStack).toHaveLength(1);
    expect({
      history: json.history.map((transaction) => transaction.ops),
      redo: json.redoStack.map((transaction) => transaction.ops)
    }).toEqual(expectedOps);
    const jsonEngine = importCadProject(json);
    jsonEngine.redo();
    expect(
      jsonEngine.getDocument().sketches.get("sketch_1")?.entities.get("rect_1")
    ).toMatchObject({ kind: "rectangle", construction: false });

    const packed = await exportCadProjectToWcad(source);
    const read = await readCadProjectWcad(packed.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect({
      history: read.project.history.map((transaction) => transaction.ops),
      redo: read.project.redoStack.map((transaction) => transaction.ops)
    }).toEqual(expectedOps);
    const wcadEngine = importCadProject(read.project);
    wcadEngine.redo();
    expect(
      wcadEngine.getDocument().sketches.get("sketch_1")?.entities.get("rect_1")
    ).toMatchObject({ kind: "rectangle", construction: false });
  });

  it("emits byte-stable canonical document and command CBOR", async () => {
    expect([...encodeWcadCanonicalCbor({ z: 1, a: { y: 2, x: 3 } })]).toEqual([
      ...encodeWcadCanonicalCbor({ a: { x: 3, y: 2 }, z: 1 })
    ]);

    const source = createNormalizedV21Project();
    const first = await exportCadProjectToWcad(source);
    const second = await exportCadProjectToWcad(clone(source));
    expect([...first.documentBytes]).toEqual([...second.documentBytes]);
    expect([...first.commandsBytes]).toEqual([...second.commandsBytes]);
    expect(first.sourceIdentity).toEqual(second.sourceIdentity);
  });

  it("preserves V21 topology checkpoint bytes and source identities in WCAD v2", async () => {
    const source = clone(createNormalizedV21Project()) as any;
    const checkpointId = "checkpoint_v21";
    const paths = createWcadV2CheckpointEntryPaths(checkpointId);
    const placeholderIdentity = {
      algorithm: "partbench-source-v1",
      sha256: "1111111111111111111111111111111111111111111111111111111111111111"
    };
    source.document.topologyIdentity = {
      ...createEmptyTopologyIdentitySourceSnapshot(),
      checkpoints: [
        {
          checkpointId,
          bodyId: "body_extrude",
          sourceFeatureId: "extrude_1",
          sourceIdentity: placeholderIdentity,
          packageVersion: "partbench.wcad.v2",
          projectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
          brepEntryPath: paths.brep,
          topologyEntryPath: paths.topology,
          signatureEntryPath: paths.signature,
          status: "active",
          diagnostics: []
        }
      ]
    };
    const topology = {
      source: "kernel-derived",
      status: "ready",
      entityCounts: {
        bodyCount: 0,
        solidCount: 0,
        faceCount: 0,
        wireCount: 0,
        edgeCount: 0,
        vertexCount: 0,
        loopCount: 0,
        coedgeCount: 0,
        axisCount: 0
      },
      entityCount: 0,
      entities: [],
      unsupportedEntityKinds: [],
      adjacencyAvailable: true,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "v21_topology_signature",
      diagnostics: []
    };
    const payload = {
      checkpointId,
      bodyId: "body_extrude",
      sourceFeatureId: "extrude_1",
      kernel: {
        boundary: "geometry-kernel" as const,
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1" as const
      },
      tolerance: {
        linearTolerance: 0.001,
        angularToleranceDegrees: 0.01
      },
      brepBytes: textEncoder.encode("stable V21 B-rep bytes"),
      topologyBytes: encodeWcadCanonicalCbor(topology),
      signatureBytes: encodeWcadCanonicalCbor({
        checkpointId,
        signatureAlgorithm: topology.signatureAlgorithm,
        signature: topology.signature,
        entityCount: 0,
        entities: []
      })
    };
    const packed = await exportCadProjectToWcad(source, {
      topologyCheckpoints: [payload]
    });
    const read = await readCadProjectWcad(packed.bytes);

    if (!read.ok) {
      throw new Error(JSON.stringify(read.issues, null, 2));
    }
    expect(read.ok).toBe(true);
    expect(read.sourceIdentity).toEqual(packed.sourceIdentity);
    expect(read.project.document.topologyIdentity).toEqual(
      source.document.topologyIdentity
    );
    expect(read.checkpointPayloads).toHaveLength(1);
    expect(read.checkpointPayloads?.[0]?.manifestEntry.sourceIdentity).toEqual(
      packed.sourceIdentity
    );
    expect([...(read.checkpointPayloads?.[0]?.brepBytes ?? [])]).toEqual([
      ...payload.brepBytes
    ]);
    expect([...(read.checkpointPayloads?.[0]?.topologyBytes ?? [])]).toEqual([
      ...payload.topologyBytes
    ]);
    expect([...(read.checkpointPayloads?.[0]?.signatureBytes ?? [])]).toEqual([
      ...payload.signatureBytes
    ]);
  });

  it("imports the complete V1-V20 compatibility corpus through the current normalizer", () => {
    for (let version = 1; version <= 20; version += 1) {
      const parsed = parseCadProjectJson(
        JSON.stringify(createLegacyCorpusProject(version))
      );
      const expectedSchema =
        version <= 16
          ? CURRENT_CAD_PROJECT_FORMAT_VERSION
          : `web-cad.project.v${version}`;
      expect(parsed.schemaVersion, `V${version} normalized schema`).toBe(
        expectedSchema
      );
      const document = importCadProject(parsed).getDocument();
      expect(parsed.history[0]?.ops).toEqual([
        expect.objectContaining({
          op: "scene.createBox",
          id: "legacy_box",
          name: `V${version} source box`
        })
      ]);
      expect(document.objects.size, `V${version} objects`).toBe(1);
      expect(document.sketches.size, `V${version} sketches`).toBe(0);
      expect(document.features.size, `V${version} features`).toBe(0);
    }
  });

  it("hashes actual wire and chain segment order and orientation", () => {
    const source = createOrderedWireAndChainProject();
    const baseline = createCadProjectSourceIdentity(source).sha256;
    const variants = [
      (project: any) => project.document.features[0].profile.segments.reverse(),
      (project: any) => {
        project.document.features[0].profile.segments[0].orientation =
          "reverse";
      },
      (project: any) => project.document.features[2].path.segments.reverse(),
      (project: any) => {
        project.document.features[2].path.segments[1].orientation = "reverse";
      }
    ];

    for (const mutate of variants) {
      const changed = clone(source);
      mutate(changed);
      expect(createCadProjectSourceIdentity(changed).sha256).not.toBe(baseline);
    }
  });

  it("downgrades normalized nontriggers and circle-only radius constraints to V20", () => {
    const saved = exportCadProject(
      importCadProject(
        parseCadProjectJson(JSON.stringify(createNormalizedV21Project()))
      )
    ) as any;

    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(saved.document.features).toEqual([
      expect.objectContaining({
        kind: "extrude",
        sketchId: "profiles",
        entityId: "rect",
        profileKind: "rectangle"
      }),
      expect.objectContaining({
        kind: "revolve",
        sketchId: "profiles",
        entityId: "circle_a",
        profileKind: "circle"
      }),
      expect.objectContaining({
        kind: "sweep",
        profileSketchId: "profiles",
        profileEntityId: "circle_b",
        pathSketchId: "path",
        pathEntityIds: ["path_1"]
      }),
      expect.objectContaining({
        kind: "loft",
        sections: [
          { sketchId: "loft_a", entityId: "loft_rect_a" },
          { sketchId: "loft_b", entityId: "loft_rect_b" }
        ]
      })
    ]);
    for (const feature of saved.document.features) {
      expect(feature).not.toHaveProperty("profile");
      expect(feature).not.toHaveProperty("path");
    }
    expect(saved.document.sketchConstraints).toEqual([
      expect.objectContaining({
        kind: "concentric",
        primaryCircleEntityId: "circle_a",
        secondaryCircleEntityId: "circle_b"
      }),
      expect.objectContaining({
        kind: "equalRadius",
        primaryCircleEntityId: "circle_c",
        secondaryCircleEntityId: "circle_d"
      })
    ]);
    for (const constraint of saved.document.sketchConstraints) {
      expect(constraint).not.toHaveProperty("primaryTarget");
      expect(constraint).not.toHaveProperty("secondaryTarget");
    }
  });

  it("rejects mixed legacy and normalized fields for every consumer and radius target", () => {
    const cases: readonly [path: string, mutate: (project: any) => void][] = [
      [
        "$.document.features[0].sketchId",
        (p) => (p.document.features[0].sketchId = "profiles")
      ],
      [
        "$.document.features[1].entityId",
        (p) => (p.document.features[1].entityId = "circle_a")
      ],
      [
        "$.document.features[2].pathEntityIds",
        (p) => (p.document.features[2].pathEntityIds = ["path_1"])
      ],
      [
        "$.document.features[3].sections[0].sketchId",
        (p) => (p.document.features[3].sections[0].sketchId = "loft_a")
      ],
      [
        "$.document.sketchConstraints[0].primaryCircleEntityId",
        (p) =>
          (p.document.sketchConstraints[0].primaryCircleEntityId = "circle_a")
      ],
      [
        "$.document.sketchConstraints[1].secondaryCircleEntityId",
        (p) =>
          (p.document.sketchConstraints[1].secondaryCircleEntityId = "circle_d")
      ]
    ];

    for (const [path, mutate] of cases) {
      const mixed = clone(createNormalizedV21Project());
      mutate(mixed);
      expectV21Issue(mixed, path);
    }
  });
});
