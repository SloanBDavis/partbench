import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CAD_PROJECT_FORMAT_VERSION_V21,
  CadEngine,
  CadProjectImportError,
  createCadProjectSourceIdentity,
  exportCadProject,
  exportCadProjectToWcad,
  importCadProject,
  parseCadProjectJson,
  readCadProjectWcad,
  type CadProject
} from "./index";

function createSweepProject(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "profile", name: "Profile", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "profile",
      id: "circle",
      center: [0, 0],
      radius: 1
    },
    { op: "sketch.create", id: "path", name: "Path", plane: "XZ" },
    {
      op: "sketch.addLine",
      sketchId: "path",
      id: "line",
      start: [0, 0],
      end: [0, 5]
    },
    {
      op: "feature.sweep",
      id: "sweep",
      bodyId: "body_sweep",
      profileSketchId: "profile",
      profileEntityId: "circle",
      pathSketchId: "path",
      pathEntityIds: ["line"]
    }
  ]);
  return { ...exportCadProject(engine), history: [], redoStack: [] };
}

function createV21ArcProject(): CadProject {
  const base = createSweepProject();
  const sketches = base.document.sketches.map((sketch) => ({
    ...sketch,
    entities: sketch.entities.map((entity) => ({
      ...entity,
      construction: false
    }))
  }));
  const path = sketches.find((sketch) => sketch.id === "path")!;
  path.entities.push({
    id: "arc",
    kind: "arc",
    center: [0, 0],
    radius: 5,
    startAngleDegrees: 350,
    sweepAngleDegrees: -90,
    construction: true
  } as never);
  return {
    ...base,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
    document: {
      ...base.document,
      sketches: sketches as never,
      features: [
        {
          id: "sweep",
          kind: "sweep",
          name: "Curved path",
          profile: { kind: "entity", sketchId: "profile", entityId: "circle" },
          path: {
            kind: "entity",
            sketchId: "path",
            entityId: "arc",
            orientation: "reverse"
          },
          bodyId: "body_sweep"
        }
      ] as never
    }
  };
}

function createV21BooleanChainProject(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "base_sketch", name: "Base", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "base_sketch",
      id: "base_profile",
      center: [0, 0],
      width: 10,
      height: 10
    },
    {
      op: "feature.extrude",
      id: "base_feature",
      bodyId: "base_body",
      sketchId: "base_sketch",
      entityId: "base_profile",
      depth: 5
    },
    { op: "sketch.create", id: "tool_sketch", name: "Tool", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "tool_sketch",
      id: "tool_profile",
      center: [0, 0],
      radius: 2
    },
    {
      op: "feature.extrude",
      id: "cut_feature",
      bodyId: "cut_body",
      sketchId: "tool_sketch",
      entityId: "tool_profile",
      depth: 5,
      operationMode: "cut",
      targetBodyId: "base_body"
    }
  ]);
  const project: any = exportCadProject(engine);
  project.schemaVersion = CAD_PROJECT_FORMAT_VERSION_V21;
  project.document.sketches = project.document.sketches.map((sketch: any) => ({
    ...sketch,
    entities: sketch.entities.map((entity: any) => ({
      ...entity,
      construction: false
    }))
  }));
  project.document.features = project.document.features.map((feature: any) => {
    const { sketchId, entityId, profileKind: _profileKind, ...base } = feature;
    return {
      ...base,
      profile: { kind: "entity", sketchId, entityId }
    };
  });
  return project;
}

describe("V17 V21 storage and migration", () => {
  it("applies V21-compatible V20 defaults while preserving minimum V20 export", () => {
    const v20 = createSweepProject();
    expect(v20.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);

    const parsed = parseCadProjectJson(JSON.stringify(v20));
    const restored = importCadProject(parsed);
    expect(
      restored.getDocument().sketches.get("profile")?.entities.get("circle")
    ).toMatchObject({ construction: false });

    const saved = exportCadProject(restored);
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(saved.document.sketches[0]?.entities[0]).not.toHaveProperty(
      "construction"
    );
    expect(saved.document.features[0]).toMatchObject({
      profileSketchId: "profile",
      profileEntityId: "circle",
      pathSketchId: "path",
      pathEntityIds: ["line"]
    });
    expect(saved.document.features[0]).not.toHaveProperty("profile");
    expect(saved.document.features[0]).not.toHaveProperty("path");
  });

  it("round-trips canonical signed arcs and normalized refs through JSON and WCAD", async () => {
    const source = createV21ArcProject();
    const parsed = parseCadProjectJson(JSON.stringify(source));
    expect(parsed.document.sketches[1]?.entities[1]).toMatchObject({
      kind: "arc",
      startAngleDegrees: 350,
      sweepAngleDegrees: -90,
      construction: true
    });

    const saved = exportCadProject(importCadProject(parsed));
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V21);
    expect(saved.document.features[0]).not.toHaveProperty("pathEntityIds");

    const packed = await exportCadProjectToWcad(saved);
    expect(packed.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(packed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_UPGRADED_TO_V21" })
    );
    const read = await readCadProjectWcad(packed.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.project.document.features).toEqual(saved.document.features);
    expect(read.project.document.sketches[1]?.entities[1]).toMatchObject({
      sweepAngleDegrees: -90,
      construction: true
    });
    expect(read.sourceIdentity).toEqual(packed.sourceIdentity);
  });

  it("rejects noncanonical arcs and mixed V21 feature fields at exact paths", () => {
    const invalidArc = createV21ArcProject() as unknown as {
      document: { sketches: { entities: Record<string, unknown>[] }[] };
    };
    invalidArc.document.sketches[1]!.entities[1]!.startAngleDegrees = 360;
    expect(() => parseCadProjectJson(JSON.stringify(invalidArc))).toThrowError(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "SCHEMA_V21_SOURCE_INVALID",
            path: "$.document.sketches[1].entities[1].startAngleDegrees"
          })
        ])
      })
    );

    const mixed = createV21ArcProject() as unknown as {
      document: { features: Record<string, unknown>[] };
    };
    mixed.document.features[0]!.pathEntityIds = ["arc"];
    try {
      parseCadProjectJson(JSON.stringify(mixed));
      throw new Error("Expected mixed V21 feature fields to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(CadProjectImportError);
      expect((error as CadProjectImportError).issues).toContainEqual(
        expect.objectContaining({
          code: "SCHEMA_V21_SOURCE_INVALID",
          path: "$.document.features[0].pathEntityIds"
        })
      );
    }

    const extraFields = createV21ArcProject() as unknown as {
      document: {
        sketches: { entities: Record<string, unknown>[] }[];
        features: Record<string, unknown>[];
      };
    };
    extraFields.document.sketches[1]!.entities[1]!.end = [1, 2];
    (
      extraFields.document.features[0]!.path as Record<string, unknown>
    ).cachedLength = 5;
    expect(() => parseCadProjectJson(JSON.stringify(extraFields))).toThrowError(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: "$.document.sketches[1].entities[1].end"
          }),
          expect.objectContaining({
            path: "$.document.features[0].path.cachedLength"
          })
        ])
      })
    );
  });

  it("accepts V21 arc dimensions and normalized arc constraint targets", () => {
    const source = createV21ArcProject() as any;
    source.document.sketchDimensions = [
      {
        id: "arc_dimension",
        name: "Arc radius",
        sketchId: "path",
        entityId: "arc",
        target: { entityKind: "arc", role: "radius" },
        valueSource: { type: "literal", value: 5 }
      }
    ];
    source.document.sketchConstraints = [
      {
        id: "arc_fixed",
        name: "Arc center fixed",
        sketchId: "path",
        entityId: "arc",
        kind: "fixed",
        target: { entityId: "arc", entityKind: "arc", role: "center" },
        coordinate: [0, 0]
      },
      {
        id: "arc_coincident",
        name: "Arc and circle centers",
        sketchId: "path",
        entityId: "arc",
        kind: "coincident",
        primaryTarget: {
          entityId: "arc",
          entityKind: "arc",
          role: "center"
        },
        secondaryTarget: { entityId: "line", role: "start" }
      },
      {
        id: "arc_tangent",
        name: "Arc tangent",
        sketchId: "path",
        entityId: "line",
        kind: "tangent",
        primaryTarget: { entityId: "arc", entityKind: "arc" },
        secondaryTarget: { entityId: "line", entityKind: "line" }
      }
    ];

    expect(() => parseCadProjectJson(JSON.stringify(source))).not.toThrow();
  });

  it("round-trips positive and negative arc sweep dimensions from literals and parameters", () => {
    for (const sweepAngleDegrees of [-90, 90]) {
      for (const valueSource of [
        { type: "literal", value: 90 },
        { type: "parameter", parameterId: "sweep_parameter" }
      ]) {
        const source = createV21ArcProject() as any;
        source.document.sketches[1].entities[1].sweepAngleDegrees =
          sweepAngleDegrees;
        source.document.parameters = [
          { id: "sweep_parameter", name: "Sweep", value: 90 }
        ];
        source.document.sketchDimensions = [
          {
            id: `sweep_${sweepAngleDegrees}_${valueSource.type}`,
            name: "Arc sweep",
            sketchId: "path",
            entityId: "arc",
            target: { entityKind: "arc", role: "sweep" },
            valueSource
          }
        ];

        const parsed = parseCadProjectJson(JSON.stringify(source));
        const saved = exportCadProject(importCadProject(parsed));
        expect(saved.document.sketchDimensions).toEqual(
          source.document.sketchDimensions
        );
        expect(
          (saved.document.sketches[1]?.entities[1] as any).sweepAngleDegrees
        ).toBe(sweepAngleDegrees);
      }
    }
  });

  it("rejects resolved point and curve target discriminator mismatches at entityKind", () => {
    const cases = [
      {
        path: "$.document.sketchConstraints[0].target.entityKind",
        constraint: {
          id: "fixed_arc",
          name: "Fixed arc",
          sketchId: "path",
          entityId: "arc",
          kind: "fixed",
          target: { entityId: "arc", role: "center" },
          coordinate: [0, 0]
        }
      },
      {
        path: "$.document.sketchConstraints[0].primaryTarget.entityKind",
        constraint: {
          id: "coincident_line",
          name: "Coincident line",
          sketchId: "path",
          entityId: "line",
          kind: "coincident",
          primaryTarget: {
            entityId: "line",
            entityKind: "arc",
            role: "start"
          },
          secondaryTarget: {
            entityId: "arc",
            entityKind: "arc",
            role: "center"
          }
        }
      },
      {
        path: "$.document.sketchConstraints[0].secondaryTarget.entityKind",
        constraint: {
          id: "symmetry_arc",
          name: "Symmetry arc",
          sketchId: "path",
          entityId: "arc",
          kind: "symmetry",
          primaryTarget: { entityId: "line", role: "start" },
          secondaryTarget: { entityId: "arc", role: "center" },
          symmetryLineEntityId: "axis"
        },
        addAxis: true
      },
      {
        path: "$.document.sketchConstraints[0].primaryTarget.entityKind",
        constraint: {
          id: "tangent_arc",
          name: "Tangent arc",
          sketchId: "path",
          entityId: "line",
          kind: "tangent",
          primaryTarget: { entityId: "arc", entityKind: "line" },
          secondaryTarget: { entityId: "line", entityKind: "line" }
        }
      }
    ];

    for (const testCase of cases) {
      const source = createV21ArcProject() as any;
      if (testCase.addAxis) {
        source.document.sketches[1].entities.push({
          id: "axis",
          kind: "line",
          start: [-5, 0],
          end: [5, 0],
          construction: false
        });
      }
      source.document.sketchConstraints = [testCase.constraint];
      expect(() => parseCadProjectJson(JSON.stringify(source))).toThrowError(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ path: testCase.path })
          ])
        })
      );
    }
  });

  it("rejects noncanonical fields in every nested V21 target and revolve axis", () => {
    const nestedCases = [
      {
        path: "$.document.sketchDimensions[0].target.cached",
        apply(source: any) {
          source.document.sketchDimensions = [
            {
              id: "arc_radius",
              name: "Arc radius",
              sketchId: "path",
              entityId: "arc",
              target: { entityKind: "arc", role: "radius", cached: true },
              valueSource: { type: "literal", value: 5 }
            }
          ];
        }
      },
      {
        path: "$.document.sketchConstraints[0].target.cached",
        apply(source: any) {
          source.document.sketchConstraints = [
            {
              id: "fixed_arc",
              name: "Fixed arc",
              sketchId: "path",
              entityId: "arc",
              kind: "fixed",
              target: {
                entityId: "arc",
                entityKind: "arc",
                role: "center",
                cached: true
              },
              coordinate: [0, 0]
            }
          ];
        }
      },
      {
        path: "$.document.sketchConstraints[0].primaryTarget.cached",
        apply(source: any) {
          source.document.sketchConstraints = [
            {
              id: "tangent_arc",
              name: "Tangent arc",
              sketchId: "path",
              entityId: "line",
              kind: "tangent",
              primaryTarget: {
                entityId: "arc",
                entityKind: "arc",
                cached: true
              },
              secondaryTarget: { entityId: "line", entityKind: "line" }
            }
          ];
        }
      },
      {
        path: "$.document.sketchConstraints[0].primaryTarget.cached",
        apply(source: any) {
          source.document.sketchConstraints = [
            {
              id: "equal_radius",
              name: "Equal radius",
              sketchId: "path",
              entityId: "arc",
              kind: "equalRadius",
              primaryTarget: {
                entityId: "arc",
                entityKind: "arc",
                cached: true
              },
              secondaryTarget: { entityId: "circle", entityKind: "circle" }
            }
          ];
        }
      }
    ];

    for (const testCase of nestedCases) {
      const source = createV21ArcProject() as any;
      testCase.apply(source);
      expect(() => parseCadProjectJson(JSON.stringify(source))).toThrowError(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "SCHEMA_V21_SOURCE_INVALID",
              path: testCase.path
            })
          ])
        })
      );
    }

    const revolve = createV21BooleanChainProject() as any;
    revolve.document.sketches[0].entities.push({
      id: "axis",
      kind: "line",
      start: [0, -10],
      end: [0, 10],
      construction: false
    });
    revolve.document.features = [
      {
        id: "revolve",
        kind: "revolve",
        profile: {
          kind: "entity",
          sketchId: "base_sketch",
          entityId: "base_profile"
        },
        axis: {
          type: "sketchLine",
          sketchId: "base_sketch",
          entityId: "axis",
          cached: true
        },
        angleDegrees: 180,
        operationMode: "newBody",
        bodyId: "revolve_body"
      }
    ];
    expect(() => parseCadProjectJson(JSON.stringify(revolve))).toThrowError(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "SCHEMA_V21_SOURCE_INVALID",
            path: "$.document.features[0].axis.cached"
          })
        ])
      })
    );
  });

  it("validates upgraded normalized boolean chains instead of skipping them", () => {
    const source = createV21BooleanChainProject();
    expect(() => parseCadProjectJson(JSON.stringify(source))).not.toThrow();

    const dangling: any = JSON.parse(JSON.stringify(source));
    dangling.document.features[1].targetBodyId = "missing_body";
    expect(() => parseCadProjectJson(JSON.stringify(dangling))).toThrowError(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "INVALID_FEATURE",
            path: "$.document.features[1].targetBodyId"
          })
        ])
      })
    );
  });

  it("includes construction, sweep sign, segment order, and orientation in source identity", () => {
    const source = createV21ArcProject();
    const baseline = createCadProjectSourceIdentity(source).sha256;
    const variants = [
      (project: any) => {
        project.document.sketches[1].entities[1].construction = false;
      },
      (project: any) => {
        project.document.sketches[1].entities[1].sweepAngleDegrees = 90;
      },
      (project: any) => {
        project.document.features[0].path.orientation = "forward";
      }
    ];
    for (const mutate of variants) {
      const variant = JSON.parse(JSON.stringify(source));
      mutate(variant);
      expect(createCadProjectSourceIdentity(variant).sha256).not.toBe(baseline);
    }
  });

  it("selects V21 for each V17-only trigger and keeps normalized non-triggers at V20", () => {
    const createForwardLineSource = (): any => {
      const project: any = createV21ArcProject();
      project.document.sketches[1].entities =
        project.document.sketches[1].entities.filter(
          (entity: any) => entity.kind !== "arc"
        );
      project.document.features[0].path = {
        kind: "entity",
        sketchId: "path",
        entityId: "line",
        orientation: "forward"
      };
      return project;
    };
    const savedVersion = (project: CadProject) =>
      exportCadProject(
        importCadProject(parseCadProjectJson(JSON.stringify(project)))
      ).schemaVersion;

    expect(savedVersion(createForwardLineSource())).toBe(
      CAD_PROJECT_FORMAT_VERSION_V20
    );

    const construction = createForwardLineSource();
    construction.document.sketches[1].entities[0].construction = true;
    expect(savedVersion(construction)).toBe(CAD_PROJECT_FORMAT_VERSION_V21);

    const reverse = createForwardLineSource();
    reverse.document.features[0].path.orientation = "reverse";
    expect(savedVersion(reverse)).toBe(CAD_PROJECT_FORMAT_VERSION_V21);

    const arc = createV21ArcProject() as any;
    arc.document.sketches[1].entities[1].construction = false;
    arc.document.features[0].path.orientation = "forward";
    expect(savedVersion(arc)).toBe(CAD_PROJECT_FORMAT_VERSION_V21);

    const chain = createForwardLineSource();
    chain.document.sketches[1].entities.push({
      id: "line_2",
      kind: "line",
      start: [0, 5],
      end: [0, 10],
      construction: false
    });
    chain.document.features[0].path = {
      kind: "chain",
      sketchId: "path",
      segments: [
        { entityId: "line", orientation: "forward" },
        { entityId: "line_2", orientation: "forward" }
      ]
    };
    expect(savedVersion(chain)).toBe(CAD_PROJECT_FORMAT_VERSION_V21);

    const wire = createForwardLineSource();
    wire.document.features = [
      {
        id: "wire_extrude",
        kind: "extrude",
        profile: {
          kind: "wire",
          sketchId: "path",
          segments: [
            { entityId: "line", orientation: "forward" },
            { entityId: "line_2", orientation: "reverse" }
          ]
        },
        operationMode: "newBody",
        depth: 2,
        side: "positive",
        bodyId: "body_wire"
      }
    ];
    wire.document.sketches[1].entities.push({
      id: "line_2",
      kind: "line",
      start: [0, 5],
      end: [0, 0],
      construction: false
    });
    expect(savedVersion(wire)).toBe(CAD_PROJECT_FORMAT_VERSION_V21);
  });
});
