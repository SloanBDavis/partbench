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

describe("V17 V21 storage and migration", () => {
  it("applies V21-compatible V20 defaults while preserving minimum V20 export", () => {
    const v20 = createSweepProject();
    expect(v20.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);

    const parsed = parseCadProjectJson(JSON.stringify(v20));
    const restored = importCadProject(parsed);
    expect(restored.getDocument().sketches.get("profile")?.entities.get("circle"))
      .not.toHaveProperty("construction");

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
      exportCadProject(importCadProject(parseCadProjectJson(JSON.stringify(project))))
        .schemaVersion;

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
