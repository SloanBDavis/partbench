import { describe, expect, it } from "vitest";

import {
  CAD_PROJECT_FORMAT_VERSION_V16,
  CAD_PROJECT_FORMAT_VERSION_V18,
  CAD_PROJECT_FORMAT_VERSION_V21,
  CAD_PROJECT_FORMAT_VERSION_V22,
  CadEngine,
  CadProjectImportError,
  createEmptyTopologyIdentitySourceSnapshot,
  createCadProjectSourceIdentity,
  createWcadV2CheckpointEntryPaths,
  exportCadProject,
  exportCadProjectJson,
  exportCadProjectToWcad,
  importCadProject,
  importCadProjectJson,
  parseCadProjectJson,
  readCadProjectWcad,
  type CadDocumentSnapshot,
  type CadProject
} from "./index";

type ProjectWithHistoryBaseline = CadProject & {
  readonly historyBaseline?: CadDocumentSnapshot;
};

const counters = [
  "nextObjectNumber",
  "nextSketchNumber",
  "nextSketchEntityNumber",
  "nextParameterNumber",
  "nextSketchDimensionNumber",
  "nextSketchConstraintNumber",
  "nextFeatureNumber",
  "nextBodyNumber"
] as const satisfies readonly (keyof CadDocumentSnapshot)[];

function historyBaselineOf(
  project: CadProject
): CadDocumentSnapshot | undefined {
  return (project as ProjectWithHistoryBaseline).historyBaseline;
}

function cloneProject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parameterValue(
  document: CadDocumentSnapshot,
  parameterId = "param_width"
): number | undefined {
  return document.parameters.find((parameter) => parameter.id === parameterId)
    ?.value;
}

function createHistorylessParameterProject(
  value: number,
  options: {
    readonly units?: "mm" | "cm";
    readonly gappedCounters?: boolean;
  } = {}
): CadProject {
  const engine = new CadEngine();
  engine.apply({
    op: "parameter.create",
    id: "param_width",
    name: "Width",
    value
  });
  if (options.units && options.units !== "mm") {
    engine.apply({
      op: "document.updateUnits",
      units: options.units
    });
  }

  const project = exportCadProject(engine);
  return {
    ...project,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V16,
    history: [],
    redoStack: [],
    document: {
      ...project.document,
      ...(options.gappedCounters
        ? {
            nextObjectNumber: 11,
            nextSketchNumber: 12,
            nextSketchEntityNumber: 13,
            nextParameterNumber: 14,
            nextSketchDimensionNumber: 15,
            nextSketchConstraintNumber: 16,
            nextFeatureNumber: 17,
            nextBodyNumber: 18
          }
        : {})
    }
  };
}

function createEditedParameterEngine(
  initialValue = 3,
  updatedValue = 11
): CadEngine {
  const engine = importCadProject(
    createHistorylessParameterProject(initialValue)
  );
  engine.apply({
    op: "parameter.update",
    id: "param_width",
    value: updatedValue
  });
  return engine;
}

function createGappedCounterSource(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "Counter source",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_1",
      center: [0, 0],
      radius: 2
    },
    {
      op: "parameter.create",
      id: "param_width",
      name: "Width",
      value: 5
    },
    {
      op: "document.updateUnits",
      units: "cm"
    }
  ]);
  const project = exportCadProject(engine);
  return {
    ...project,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V16,
    history: [],
    redoStack: [],
    document: {
      ...project.document,
      nextObjectNumber: 11,
      nextSketchNumber: 12,
      nextSketchEntityNumber: 13,
      nextParameterNumber: 14,
      nextSketchDimensionNumber: 15,
      nextSketchConstraintNumber: 16,
      nextFeatureNumber: 17,
      nextBodyNumber: 18
    }
  };
}

function createLegacyAngleProject(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "Legacy angle baseline",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [8, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_2",
      start: [0, 0],
      end: [0, 8]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_3",
      start: [0, 0],
      end: [6, 6]
    }
  ]);
  const base = exportCadProject(engine);
  return {
    ...base,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
    history: [],
    redoStack: [],
    document: {
      ...base.document,
      sketches: base.document.sketches.map((sketch) => ({
        ...sketch,
        entities: sketch.entities.map((entity) => ({
          ...entity,
          construction: entity.construction ?? false
        }))
      })),
      sketchConstraints: [
        {
          id: "legacy_angle",
          name: "Legacy angle",
          sketchId: "sketch_1",
          entityId: "line_2",
          kind: "angle",
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_2",
          angleDegrees: 90
        }
      ],
      nextSketchConstraintNumber: 2
    }
  };
}

function createHistorylessV22Project(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "V22 source",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_2",
      start: [0, 0],
      end: [0, 4]
    },
    {
      op: "sketch.dimension.create",
      id: "skdim_1",
      name: "Directed angle",
      sketchId: "sketch_1",
      target: {
        kind: "lineAngle",
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_2",
        sense: "counterclockwise"
      },
      value: 90
    }
  ]);
  const project = exportCadProject(engine);
  return {
    ...project,
    history: [],
    redoStack: []
  };
}

function expectImportIssue(
  candidate: unknown,
  expected: {
    readonly path: string;
    readonly code?: string;
  }
): void {
  try {
    importCadProject(candidate as CadProject);
  } catch (error) {
    expect(error).toBeInstanceOf(CadProjectImportError);
    if (!(error instanceof CadProjectImportError)) {
      return;
    }
    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expected.path,
          ...(expected.code ? { code: expected.code } : {})
        })
      ])
    );
    return;
  }
  throw new Error("Expected project import to fail.");
}

describe("V19 V22 authoritative history baseline", () => {
  it("converts the retained legacy-angle expected failure into durable update, rename, delete, undo, and redo", () => {
    const original = createLegacyAngleProject();
    const engine = importCadProject(original);

    engine.apply({
      op: "sketch.constraint.update",
      id: "legacy_angle",
      definition: {
        kind: "angle",
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_3",
        angleDegrees: 45
      }
    });
    engine.apply({
      op: "sketch.constraint.rename",
      id: "legacy_angle",
      name: "Updated legacy angle"
    });
    engine.apply({
      op: "sketch.constraint.delete",
      id: "legacy_angle"
    });

    const saved = exportCadProject(engine);
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    expect(historyBaselineOf(saved)?.sketchConstraints).toEqual(
      original.document.sketchConstraints
    );
    expect(saved.history).toHaveLength(3);

    const restored = importCadProject(saved);
    expect(restored.getDocument().sketchConstraints.has("legacy_angle")).toBe(
      false
    );

    restored.undo();
    expect(
      restored.getDocument().sketchConstraints.get("legacy_angle")
    ).toMatchObject({
      name: "Updated legacy angle",
      kind: "angle",
      angleDegrees: 45
    });
    restored.undo();
    expect(
      restored.getDocument().sketchConstraints.get("legacy_angle")
    ).toMatchObject({
      name: "Legacy angle",
      kind: "angle",
      angleDegrees: 45
    });
    restored.undo();
    expect(restored.createSnapshot()).toEqual(historyBaselineOf(saved));
    expect(
      restored.getDocument().sketchConstraints.get("legacy_angle")
    ).toMatchObject({
      name: "Legacy angle",
      kind: "angle",
      angleDegrees: 90
    });

    restored.redo();
    restored.redo();
    restored.redo();
    expect(restored.getDocument().sketchConstraints.has("legacy_angle")).toBe(
      false
    );
    expect(exportCadProject(restored)).toEqual(saved);
  });

  it("retains the otherwise-lost prior value for ordinary parameter overwrites", () => {
    const fromThree = exportCadProject(createEditedParameterEngine(3, 11));
    const fromSeven = exportCadProject(createEditedParameterEngine(7, 11));

    expect(fromThree.document).toEqual(fromSeven.document);
    expect(fromThree.history).toEqual(fromSeven.history);
    expect(parameterValue(historyBaselineOf(fromThree)!)).toBe(3);
    expect(parameterValue(historyBaselineOf(fromSeven)!)).toBe(7);

    const restoredThree = importCadProject(fromThree);
    const restoredSeven = importCadProject(fromSeven);
    restoredThree.undo();
    restoredSeven.undo();
    expect(parameterValue(restoredThree.createSnapshot())).toBe(3);
    expect(parameterValue(restoredSeven.createSnapshot())).toBe(7);
    restoredThree.redo();
    restoredSeven.redo();
    expect(parameterValue(restoredThree.createSnapshot())).toBe(11);
    expect(parameterValue(restoredSeven.createSnapshot())).toBe(11);
  });

  it("round-trips an ordinary non-V19 edit made to a historyless V21 source", () => {
    const source = createLegacyAngleProject();
    const engine = importCadProject(source);
    engine.apply({
      op: "document.updateUnits",
      units: "cm"
    });

    const saved = exportCadProject(engine);
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    expect(historyBaselineOf(saved)?.units).toBe("mm");
    expect(saved.document.units).toBe("cm");

    const restored = importCadProject(saved);
    restored.undo();
    expect(restored.createSnapshot()).toEqual(historyBaselineOf(saved));
    expect(
      restored.getDocument().sketchConstraints.get("legacy_angle")
    ).toMatchObject({ kind: "angle", angleDegrees: 90 });
    restored.redo();
    expect(exportCadProject(restored)).toEqual(saved);
  });

  it("round-trips an exact baseline through JSON parsing and engine import/export", () => {
    const engine = createEditedParameterEngine(3, 11);
    const saved = exportCadProject(engine);
    const baseline = historyBaselineOf(saved);

    expect(baseline).toBeDefined();
    const parsed = parseCadProjectJson(exportCadProjectJson(engine));
    expect(historyBaselineOf(parsed)).toEqual(baseline);

    const restored = importCadProjectJson(JSON.stringify(saved));
    expect(exportCadProject(restored)).toEqual(saved);
    restored.undo();
    expect(restored.createSnapshot()).toEqual(baseline);
    restored.redo();
    expect(exportCadProject(restored)).toEqual(saved);
  });

  it("round-trips the exact baseline through canonical commands CBOR and WCAD v2", async () => {
    const saved = exportCadProject(createEditedParameterEngine(3, 11));
    const exported = await exportCadProjectToWcad(saved);
    const read = await readCadProjectWcad(exported.bytes);

    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(exported.commandsBytes.byteLength).toBeGreaterThan(0);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      throw new Error("Expected the V22 WCAD package to import.");
    }
    expect(read.project).toEqual(saved);
    expect(historyBaselineOf(read.project)).toEqual(historyBaselineOf(saved));
    expect(read.sourceIdentity).toEqual(exported.sourceIdentity);

    const restored = importCadProject(read.project);
    restored.undo();
    expect(restored.createSnapshot()).toEqual(historyBaselineOf(saved));
    restored.redo();
    expect(exportCadProject(restored)).toEqual(saved);
  });

  it("restores a normalized V22 dimension that exists only in the baseline", () => {
    const source = createHistorylessV22Project();
    const engine = importCadProject(source);
    engine.apply({
      op: "sketch.dimension.delete",
      id: "skdim_1"
    });

    const saved = exportCadProject(engine);
    expect(saved.document.sketchDimensions).toEqual([]);
    expect(historyBaselineOf(saved)?.sketchDimensions).toEqual(
      source.document.sketchDimensions
    );

    const restored = importCadProject(saved);
    restored.undo();
    expect(restored.createSnapshot()).toEqual(historyBaselineOf(saved));
    restored.redo();
    expect(exportCadProject(restored)).toEqual(saved);
  });

  it("restores a normalized V22 regions profile that exists only in the baseline", () => {
    const seed = new CadEngine();
    seed.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Region profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      }
    ]);
    const base = exportCadProject(seed);
    const source: CadProject = {
      ...base,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
      history: [],
      redoStack: [],
      document: {
        ...base.document,
        sketches: base.document.sketches.map((sketch) => ({
          ...sketch,
          entities: sketch.entities.map((entity) => ({
            ...entity,
            construction: entity.construction ?? false
          }))
        })),
        features: [
          {
            id: "feat_1",
            kind: "extrude",
            profile: {
              kind: "regions",
              sketchId: "sketch_1",
              regions: [
                {
                  outer: { kind: "entity", entityId: "circle_1" },
                  holes: []
                }
              ]
            },
            operationMode: "newBody",
            depth: 5,
            side: "positive",
            bodyId: "body_1"
          }
        ],
        nextFeatureNumber: 2,
        nextBodyNumber: 2
      }
    };
    const sourceFeature = source.document.features[0];
    if (
      !sourceFeature ||
      sourceFeature.kind !== "extrude" ||
      !("profile" in sourceFeature)
    ) {
      throw new Error("Expected regions extrude fixture.");
    }
    const engine = importCadProject(source);
    engine.apply({ op: "feature.delete", id: "feat_1" });

    const saved = exportCadProject(engine);
    expect(saved.document.features).toEqual([]);
    expect(historyBaselineOf(saved)?.features).toEqual(
      source.document.features
    );
    expect(saved.history[0]?.diff.features?.deleted?.[0]).toMatchObject({
      id: "feat_1",
      profile: sourceFeature.profile
    });

    const restored = importCadProject(saved);
    restored.undo();
    expect(restored.createSnapshot()).toEqual(historyBaselineOf(saved));
    restored.redo();
    expect(exportCadProject(restored)).toEqual(saved);
  });

  it("activates an implicit topology replay seed before the first retained topology mutation", () => {
    const seed = new CadEngine();
    seed.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Topology profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 3
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 2
      }
    ]);
    const base = exportCadProject(seed);
    const paths = createWcadV2CheckpointEntryPaths("checkpoint_1");
    const source: CadProject = {
      ...base,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
      document: {
        ...base.document,
        topologyIdentity: {
          ...createEmptyTopologyIdentitySourceSnapshot(),
          checkpoints: [
            {
              checkpointId: "checkpoint_1",
              bodyId: "body_1",
              sourceFeatureId: "feat_1",
              sourceIdentity: {
                algorithm: "partbench-source-v1",
                sha256:
                  "1111111111111111111111111111111111111111111111111111111111111111"
              },
              packageVersion: "partbench.wcad.v2",
              projectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
              brepEntryPath: paths.brep,
              topologyEntryPath: paths.topology,
              signatureEntryPath: paths.signature,
              status: "active",
              diagnostics: []
            }
          ]
        }
      }
    };
    const engine = importCadProject(source);
    expect(exportCadProject(engine)).not.toHaveProperty("historyBaseline");

    engine.apply({
      op: "topology.anchor.create",
      anchorId: "anchor_1",
      entityKind: "face",
      bodyId: "body_1",
      checkpointId: "checkpoint_1",
      checkpointEntityId: "checkpoint-face-1",
      sourceFeatureId: "feat_1",
      stableId: "generated:face:body_1:endCap"
    });
    const saved = exportCadProject(engine);
    const baseline = historyBaselineOf(saved);
    expect(baseline).toMatchObject({
      objects: [],
      sketches: [],
      features: [],
      topologyIdentity: {
        checkpoints: [
          expect.objectContaining({ checkpointId: "checkpoint_1" })
        ],
        anchors: []
      }
    });

    const restored = importCadProject(saved);
    restored.undo();
    expect(restored.getDocument().topologyIdentity?.anchors).toEqual([]);
    while (restored.undo()) {
      // Restore the exact baseline.
    }
    expect(restored.createSnapshot()).toEqual(baseline);
    const allUndone = exportCadProject(restored);
    expect(historyBaselineOf(allUndone)).toEqual(baseline);
    expect(exportCadProject(importCadProject(allUndone))).toEqual(allUndone);

    restored.apply({
      op: "parameter.create",
      id: "param_branch",
      name: "Branch",
      value: 1
    });
    const branched = exportCadProject(restored);
    expect(branched.redoStack).toEqual([]);
    expect(branched).not.toHaveProperty("historyBaseline");
    expect(exportCadProject(importCadProject(branched))).toEqual(branched);
  });

  it("preserves the baseline across committed, partially undone, and all-undone stacks", () => {
    const engine = createEditedParameterEngine(3, 11);
    engine.apply({
      op: "parameter.rename",
      id: "param_width",
      name: "Panel width"
    });
    const committed = exportCadProject(engine);
    const baseline = historyBaselineOf(committed);
    expect(committed.history).toHaveLength(2);
    expect(committed.redoStack).toEqual([]);

    engine.undo();
    const partial = exportCadProject(engine);
    expect(historyBaselineOf(partial)).toEqual(baseline);
    expect(partial.history).toHaveLength(1);
    expect(partial.redoStack).toHaveLength(1);
    expect(exportCadProject(importCadProject(partial))).toEqual(partial);

    engine.undo();
    const allUndone = exportCadProject(engine);
    expect(historyBaselineOf(allUndone)).toEqual(baseline);
    expect(allUndone.history).toEqual([]);
    expect(allUndone.redoStack).toHaveLength(2);
    expect(allUndone.document).toEqual(baseline);

    const restored = importCadProject(allUndone);
    restored.redo();
    expect(parameterValue(restored.createSnapshot())).toBe(11);
    restored.redo();
    expect(restored.getDocument().parameters.get("param_width")?.name).toBe(
      "Panel width"
    );
    expect(exportCadProject(restored)).toEqual(committed);
  });

  it("retains one lineage baseline and clears redo when branching after partial undo or undo-all", () => {
    const createTwoEditEngine = (): CadEngine => {
      const engine = createEditedParameterEngine(3, 11);
      engine.apply({
        op: "parameter.rename",
        id: "param_width",
        name: "Panel width"
      });
      return engine;
    };

    const partial = createTwoEditEngine();
    const partialBaseline = historyBaselineOf(exportCadProject(partial));
    partial.undo();
    partial.apply({
      op: "parameter.update",
      id: "param_width",
      description: "partial branch"
    });
    const partialBranch = exportCadProject(partial);
    expect(partialBranch.redoStack).toEqual([]);
    expect(historyBaselineOf(partialBranch)).toEqual(partialBaseline);
    partial.undo();
    partial.undo();
    expect(partial.createSnapshot()).toEqual(partialBaseline);

    const all = createTwoEditEngine();
    const allBaseline = historyBaselineOf(exportCadProject(all));
    all.undo();
    all.undo();
    all.apply({
      op: "parameter.update",
      id: "param_width",
      value: 19
    });
    const allUndoneBranch = exportCadProject(all);
    expect(allUndoneBranch.history).toHaveLength(1);
    expect(allUndoneBranch.redoStack).toEqual([]);
    expect(historyBaselineOf(allUndoneBranch)).toEqual(allBaseline);
    all.undo();
    expect(all.createSnapshot()).toEqual(allBaseline);
  });

  it("preserves non-default units and every gapped next-id counter in the authoritative baseline", () => {
    const source = createHistorylessParameterProject(5, {
      units: "cm",
      gappedCounters: true
    });
    const engine = importCadProject(source);
    engine.apply({
      op: "parameter.update",
      id: "param_width",
      value: 8
    });

    const saved = exportCadProject(engine);
    const baseline = historyBaselineOf(saved);
    expect(baseline?.units).toBe("cm");
    for (const counter of counters) {
      expect(baseline?.[counter]).toBe(source.document[counter]);
    }

    const restored = importCadProjectJson(JSON.stringify(saved));
    restored.undo();
    expect(restored.createSnapshot()).toEqual(baseline);
    restored.redo();
    const resavedBaseline = historyBaselineOf(exportCadProject(restored));
    expect(resavedBaseline).toEqual(baseline);
  });

  it("restores all eight counters when undoing and redoing one allocating transaction", () => {
    const source = createGappedCounterSource();
    const engine = importCadProject(source);
    engine.applyBatch([
      {
        op: "scene.createBox",
        dimensions: { width: 1, height: 2, depth: 3 }
      },
      {
        op: "sketch.create",
        name: "Generated sketch",
        plane: "YZ"
      },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        point: [3, 3]
      },
      {
        op: "parameter.create",
        name: "Generated parameter",
        value: 2
      },
      {
        op: "sketch.dimension.create",
        name: "Generated radius",
        sketchId: "sketch_1",
        entityId: "circle_1",
        target: { entityKind: "circle", role: "radius" },
        value: 2
      },
      {
        op: "sketch.constraint.create",
        name: "Generated horizontal",
        sketchId: "sketch_1",
        kind: "horizontal",
        entityId: "line_1"
      },
      {
        op: "feature.extrude",
        sketchId: "sketch_1",
        entityId: "circle_1",
        depth: 2
      }
    ]);

    const saved = exportCadProject(engine);
    const baseline = historyBaselineOf(saved)!;
    for (const counter of counters) {
      expect(saved.document[counter]).toBe(baseline[counter] + 1);
    }

    engine.undo();
    expect(engine.createSnapshot()).toEqual(baseline);
    engine.redo();
    expect(engine.createSnapshot()).toEqual(saved.document);
    expect(exportCadProject(engine)).toEqual(saved);
  });

  it.each([
    {
      label: "invalid units",
      path: "$.historyBaseline.units",
      mutate: (baseline: Record<string, unknown>) => {
        baseline.units = "ft";
      }
    },
    {
      label: "invalid next-id counter",
      path: "$.historyBaseline.nextParameterNumber",
      mutate: (baseline: Record<string, unknown>) => {
        baseline.nextParameterNumber = 0;
      }
    }
  ])(
    "rejects a malformed baseline with exact path: $label",
    ({ path, mutate }) => {
      const malformed = cloneProject(
        exportCadProject(createEditedParameterEngine())
      ) as unknown as Record<string, unknown>;
      mutate(malformed.historyBaseline as Record<string, unknown>);
      expectImportIssue(malformed, { path });
    }
  );

  it("rejects baselines in lower schemas and baselines without retained transactions", () => {
    const saved = exportCadProject(createEditedParameterEngine());
    expectImportIssue(
      {
        ...saved,
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21
      },
      {
        code: "SCHEMA_V22_SOURCE_INVALID",
        path: "$.historyBaseline"
      }
    );

    expectImportIssue(
      {
        ...saved,
        document: historyBaselineOf(saved),
        history: [],
        redoStack: []
      },
      {
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.historyBaseline"
      }
    );
  });

  it("refuses to write a lower-schema WCAD package carrying V22 baseline authority", async () => {
    const saved = exportCadProject(createEditedParameterEngine());

    await expect(
      exportCadProjectToWcad({
        ...saved,
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V16
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "SCHEMA_V22_SOURCE_INVALID",
          path: "$.historyBaseline"
        })
      ])
    });
  });

  it("rejects missing lineage and baseline/history/current mismatches", () => {
    const saved = exportCadProject(createEditedParameterEngine(3, 11));
    const missing = cloneProject(saved) as unknown as Record<string, unknown>;
    delete missing.historyBaseline;
    expectImportIssue(missing, {
      code: "INVALID_TRANSACTION_HISTORY",
      path: "$.history"
    });

    const currentMismatch = cloneProject(saved) as unknown as {
      document: { units: string };
    };
    currentMismatch.document.units = "cm";
    expectImportIssue(currentMismatch, {
      code: "INVALID_TRANSACTION_HISTORY",
      path: "$.document"
    });

    const baselineMismatch = cloneProject(saved) as unknown as {
      historyBaseline: { units: string };
    };
    baselineMismatch.historyBaseline.units = "cm";
    expectImportIssue(baselineMismatch, {
      code: "INVALID_TRANSACTION_HISTORY",
      path: "$.document"
    });
  });

  it("rejects a gratuitous explicit baseline equal to the canonical implicit replay seed", () => {
    const engine = new CadEngine();
    const implicitBaseline = engine.createSnapshot();
    engine.apply({
      op: "parameter.create",
      id: "param_width",
      name: "Width",
      value: 3
    });
    const project = exportCadProject(engine);
    expect(project).not.toHaveProperty("historyBaseline");

    expectImportIssue(
      {
        ...project,
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
        historyBaseline: implicitBaseline
      },
      {
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.historyBaseline"
      }
    );
  });

  it("defensively owns imported and exported baseline snapshots", () => {
    const saved = cloneProject(
      exportCadProject(createEditedParameterEngine(3, 11))
    );
    const engine = importCadProject(saved);
    const importedBaseline = historyBaselineOf(saved)!;
    (importedBaseline.parameters[0] as unknown as { value: number }).value =
      999;
    (importedBaseline as unknown as { units: "cm" }).units = "cm";

    engine.undo();
    expect(parameterValue(engine.createSnapshot())).toBe(3);
    expect(engine.createSnapshot().units).toBe("mm");
    engine.redo();

    const exported = exportCadProject(engine);
    const exportedBaseline = historyBaselineOf(exported)!;
    (exportedBaseline.parameters[0] as unknown as { value: number }).value =
      777;
    (exportedBaseline as unknown as { units: "cm" }).units = "cm";

    const again = exportCadProject(engine);
    expect(parameterValue(historyBaselineOf(again)!)).toBe(3);
    expect(historyBaselineOf(again)?.units).toBe("mm");
  });

  it("does not churn untouched historyless projects, implicit-origin histories, or baseline-free V22 source", () => {
    const untouched = createHistorylessParameterProject(3);
    const untouchedSaved = exportCadProject(importCadProject(untouched));
    expect(untouchedSaved).not.toHaveProperty("historyBaseline");
    expect(exportCadProject(importCadProject(untouchedSaved))).toEqual(
      untouchedSaved
    );

    const implicitEngine = new CadEngine();
    implicitEngine.apply({
      op: "parameter.create",
      id: "param_width",
      name: "Width",
      value: 3
    });
    const implicit = exportCadProject(implicitEngine);
    expect(implicit).not.toHaveProperty("historyBaseline");
    expect(exportCadProject(importCadProject(implicit))).toEqual(implicit);

    const v22 = createHistorylessV22Project();
    expect(v22.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    const v22Saved = exportCadProject(importCadProject(v22));
    expect(v22Saved).not.toHaveProperty("historyBaseline");
    expect(exportCadProject(importCadProject(v22Saved))).toEqual(v22Saved);
  });

  it("includes every authoritative baseline mutation in command bytes, command hashes, and source identity while ignoring object key order", async () => {
    const saved = exportCadProject(createEditedParameterEngine(3, 11));
    const reordered = {
      history: saved.history,
      historyBaseline: historyBaselineOf(saved),
      document: saved.document,
      redoStack: saved.redoStack,
      schemaVersion: saved.schemaVersion
    } as CadProject;
    expect(createCadProjectSourceIdentity(reordered)).toEqual(
      createCadProjectSourceIdentity(saved)
    );

    const mutated = cloneProject(saved) as unknown as {
      historyBaseline: CadDocumentSnapshot;
    };
    (
      mutated.historyBaseline.parameters[0] as unknown as { value: number }
    ).value = 4;
    expect(createCadProjectSourceIdentity(mutated as CadProject)).not.toEqual(
      createCadProjectSourceIdentity(saved)
    );

    const alternate = exportCadProject(createEditedParameterEngine(7, 11));
    const [savedWcad, alternateWcad] = await Promise.all([
      exportCadProjectToWcad(saved),
      exportCadProjectToWcad(alternate)
    ]);
    expect(savedWcad.commandsBytes).not.toEqual(alternateWcad.commandsBytes);
    expect(savedWcad.manifest.commands.sha256).not.toBe(
      alternateWcad.manifest.commands.sha256
    );
    expect(savedWcad.sourceIdentity).not.toEqual(alternateWcad.sourceIdentity);
  });
});
