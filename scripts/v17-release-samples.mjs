import { isDeepStrictEqual } from "node:util";

const CADOPS_VERSION = "cadops.v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function commit(engine, ops) {
  const response = engine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops
  });
  invariant(response.ok, JSON.stringify(response));
  return response;
}

function query(engine, value) {
  const response = engine.executeQuery({
    version: CADOPS_VERSION,
    query: value
  });
  invariant(response.ok, JSON.stringify(response));
  return response;
}

function wire(sketchId, ids) {
  return {
    kind: "wire",
    sketchId,
    segments: ids.map((entityId) => ({ entityId, orientation: "forward" }))
  };
}

function createArcProfileEngine(cadCore) {
  const engine = new cadCore.CadEngine();
  commit(engine, [
    {
      op: "sketch.create",
      id: "arc_profile",
      name: "Two arc profile",
      plane: "XY"
    },
    {
      op: "sketch.addArc",
      sketchId: "arc_profile",
      id: "right_half",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 270,
        sweepAngleDegrees: 180
      }
    },
    {
      op: "sketch.addArc",
      sketchId: "arc_profile",
      id: "left_half",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180
      }
    },
    {
      op: "sketch.addLine",
      sketchId: "arc_profile",
      id: "construction_axis",
      start: [0, -3],
      end: [0, 3],
      construction: true
    },
    {
      op: "feature.extrude",
      id: "arc_extrude",
      bodyId: "arc_body",
      profile: wire("arc_profile", ["right_half", "left_half"]),
      depth: 3,
      operationMode: "newBody"
    }
  ]);
  return engine;
}

function createCompositeEngine(cadCore) {
  const engine = new cadCore.CadEngine();
  commit(engine, [
    {
      op: "sketch.create",
      id: "targets",
      name: "Boolean targets",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "targets",
      id: "target_rect",
      center: [0, 0],
      width: 6,
      height: 4
    },
    {
      op: "feature.extrude",
      id: "target_add_feature",
      bodyId: "target_add_body",
      sketchId: "targets",
      entityId: "target_rect",
      depth: 4
    },
    {
      op: "feature.extrude",
      id: "target_cut_feature",
      bodyId: "target_cut_body",
      sketchId: "targets",
      entityId: "target_rect",
      depth: 4
    },
    {
      op: "sketch.create",
      id: "composite",
      name: "Composite features",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "composite",
      id: "diameter",
      start: [0, -1],
      end: [0, 1]
    },
    {
      op: "sketch.addArc",
      sketchId: "composite",
      id: "round",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180
      }
    },
    {
      op: "sketch.addLine",
      sketchId: "composite",
      id: "axis",
      start: [-2, -3],
      end: [-2, 3],
      construction: true
    },
    {
      op: "feature.extrude",
      id: "composite_extrude",
      bodyId: "composite_extrude_body",
      profile: wire("composite", ["diameter", "round"]),
      depth: 4,
      operationMode: "newBody"
    },
    {
      op: "feature.extrude",
      id: "composite_add",
      bodyId: "composite_add_body",
      profile: wire("composite", ["diameter", "round"]),
      depth: 5,
      operationMode: "add",
      targetBodyId: "target_add_body"
    },
    {
      op: "feature.extrude",
      id: "composite_cut",
      bodyId: "composite_cut_body",
      profile: wire("composite", ["diameter", "round"]),
      depth: 3,
      operationMode: "cut",
      targetBodyId: "target_cut_body"
    },
    {
      op: "feature.revolve",
      id: "composite_revolve",
      bodyId: "composite_revolve_body",
      profile: wire("composite", ["diameter", "round"]),
      axis: { type: "sketchLine", sketchId: "composite", entityId: "axis" },
      angleDegrees: 180,
      operationMode: "newBody"
    }
  ]);
  return engine;
}

function createCurvedSweepEngine(cadCore) {
  const engine = new cadCore.CadEngine();
  commit(engine, [
    {
      op: "sketch.create",
      id: "sweep_profile",
      name: "Sweep profile",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sweep_profile",
      id: "forward_profile",
      center: [0, 0],
      radius: 0.2
    },
    {
      op: "sketch.addCircle",
      sketchId: "sweep_profile",
      id: "reverse_profile",
      center: [2, 0],
      radius: 0.2
    },
    { op: "sketch.create", id: "sweep_path", name: "Curved path", plane: "XZ" },
    {
      op: "sketch.addLine",
      sketchId: "sweep_path",
      id: "lead",
      start: [0, 0],
      end: [0, 2],
      construction: true
    },
    {
      op: "sketch.addArc",
      sketchId: "sweep_path",
      id: "bend",
      construction: true,
      definition: {
        kind: "centerAngles",
        center: [1, 2],
        radius: 1,
        startAngleDegrees: 180,
        sweepAngleDegrees: -180
      }
    },
    {
      op: "sketch.addLine",
      sketchId: "sweep_path",
      id: "tail",
      start: [2, 2],
      end: [2, 0],
      construction: true
    },
    {
      op: "feature.sweep",
      id: "forward_sweep",
      bodyId: "forward_sweep_body",
      profile: {
        kind: "entity",
        sketchId: "sweep_profile",
        entityId: "forward_profile"
      },
      path: {
        kind: "chain",
        sketchId: "sweep_path",
        segments: ["lead", "bend", "tail"].map((entityId) => ({
          entityId,
          orientation: "forward"
        }))
      }
    },
    {
      op: "feature.sweep",
      id: "reverse_sweep",
      bodyId: "reverse_sweep_body",
      profile: {
        kind: "entity",
        sketchId: "sweep_profile",
        entityId: "reverse_profile"
      },
      path: {
        kind: "chain",
        sketchId: "sweep_path",
        segments: ["tail", "bend", "lead"].map((entityId) => ({
          entityId,
          orientation: "reverse"
        }))
      }
    }
  ]);
  return engine;
}

function readyExactMetadata(engine, bodyId) {
  const topology = query(engine, { query: "body.topology", bodyId });
  return {
    bodyId,
    sourceIdentitySignature: topology.topology.sourceIdentity.signature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      bounds: {
        min: [-3, -2, 0],
        max: [3, 2, 5],
        size: [6, 4, 5],
        center: [0, 0, 2.5]
      },
      volume: 80,
      surfaceArea: 120,
      centroid: [0, 0, 2.5],
      topologyCounts: {
        solidCount: 1,
        faceCount: 10,
        edgeCount: 24,
        vertexCount: 16
      },
      diagnostics: []
    }
  };
}

async function exactStep(
  engine,
  GeometryKernelWorker,
  executeProjectExactStepExport,
  options = {}
) {
  const exactExport = query(engine, {
    query: "project.exportExact",
    format: "step",
    ...(options.bodyIds ? { bodyIds: options.bodyIds } : {}),
    ...(options.derivedExactMetadata
      ? { derivedExactMetadata: options.derivedExactMetadata }
      : {})
  });
  invariant(exactExport.available, "Exact STEP source was not available.");
  const result = await executeProjectExactStepExport({
    exactExport,
    worker: new GeometryKernelWorker()
  });
  invariant(result.available, JSON.stringify(result.diagnostics));
  invariant(
    result.artifact?.byteLength > 1_000,
    "Real OCCT STEP artifact was unexpectedly small."
  );
  return result.artifact.byteLength;
}

function sampleResult(id, checks, details = {}) {
  return { id, ok: true, checkCount: checks, ...details };
}

export async function runV17ReleaseSamples(cadCore) {
  const samples = [];
  const failures = [];
  const definitions = [
    ["two-arc-profile", createArcProfileEngine, "arc_body"],
    ["composite-features", createCompositeEngine, "composite_revolve_body"],
    ["curved-sweep", createCurvedSweepEngine, "forward_sweep_body"]
  ];
  for (const [id, create, bodyId] of definitions) {
    try {
      const engine = create(cadCore);
      const structure = query(engine, { query: "project.structure" });
      const topology = query(engine, { query: "body.topology", bodyId });
      const exported = cadCore.exportCadProject(engine);
      const restored = cadCore.importCadProject({
        ...exported,
        history: [],
        redoStack: []
      });
      query(restored, { query: "body.topology", bodyId });
      invariant(structure.features.length > 0, `${id} has no feature summary.`);
      invariant(
        typeof topology.topology?.sourceIdentity?.signature === "string",
        `${id} has no topology source identity.`
      );
      samples.push(sampleResult(id, 4, { bodyId }));
    } catch (error) {
      failures.push({
        id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return {
    ok: failures.length === 0,
    workflow: "release-samples",
    sampleCount: definitions.length,
    passedCount: samples.length,
    failedCount: failures.length,
    checkCount: samples.reduce((total, sample) => total + sample.checkCount, 0),
    samples,
    failures
  };
}

export async function runV17GeometryWorkflow(name, modules) {
  const { cadCore, GeometryKernelWorker, executeProjectExactStepExport } =
    modules;
  const create = {
    "arcs-profiles": createArcProfileEngine,
    "composite-features": createCompositeEngine,
    "curved-sweep": createCurvedSweepEngine
  }[name];
  invariant(create, `Unknown V17 geometry workflow: ${name}`);
  try {
    const engine = create(cadCore);
    let checkCount = 4;
    let exactOptions = {};
    if (name === "arcs-profiles") {
      const candidates = query(engine, {
        query: "sketch.profileCandidates",
        sketchId: "arc_profile"
      });
      invariant(
        candidates.candidateCount === 1,
        "Construction geometry polluted profile candidates."
      );
      invariant(
        candidates.candidates[0]?.profile?.segments?.every(
          (segment) => segment.entityId !== "construction_axis"
        ),
        "Construction axis was included in the solid profile."
      );
      const readiness = query(engine, {
        query: "sketch.editReadiness",
        edit: {
          editKind: "sketch.updateEntity",
          sketchId: "arc_profile",
          entity: {
            id: "right_half",
            kind: "arc",
            center: [0, 0],
            radius: 2.5,
            startAngleDegrees: 270,
            sweepAngleDegrees: 180,
            construction: false
          }
        }
      });
      invariant(
        readiness.status === "ready",
        "Arc edit readiness was not ready."
      );
      commit(engine, [
        {
          op: "sketch.updateEntity",
          sketchId: "arc_profile",
          entity: {
            id: "right_half",
            kind: "arc",
            center: [0, 0],
            radius: 2.5,
            startAngleDegrees: 270,
            sweepAngleDegrees: 180,
            construction: false
          }
        },
        {
          op: "sketch.updateEntity",
          sketchId: "arc_profile",
          entity: {
            id: "left_half",
            kind: "arc",
            center: [0, 0],
            radius: 2.5,
            startAngleDegrees: 90,
            sweepAngleDegrees: 180,
            construction: false
          }
        }
      ]);
      invariant(
        query(engine, {
          query: "sketch.profileCandidates",
          sketchId: "arc_profile"
        }).candidateCount === 1,
        "Edited arcs did not rebuild a ready closed profile."
      );
      checkCount += 5;
    } else if (name === "composite-features") {
      exactOptions = {
        bodyIds: [
          "composite_extrude_body",
          "composite_add_body",
          "composite_cut_body",
          "composite_revolve_body"
        ],
        derivedExactMetadata: [
          readyExactMetadata(engine, "composite_add_body"),
          readyExactMetadata(engine, "composite_cut_body")
        ]
      };
      const structure = query(engine, { query: "project.structure" });
      for (const mode of ["newBody", "add", "cut"]) {
        invariant(
          structure.features.some(
            (feature) =>
              feature.kind === "extrude" && feature.operationMode === mode
          ),
          `Composite ${mode} extrude was missing.`
        );
      }
      invariant(
        structure.features.some(
          (feature) =>
            feature.kind === "revolve" && feature.profile.kind === "wire"
        ),
        "Composite revolve was missing."
      );
      checkCount += 4;
    } else {
      exactOptions = { bodyIds: ["forward_sweep_body", "reverse_sweep_body"] };
      const candidates = query(engine, {
        query: "sketch.pathCandidates",
        sketchId: "sweep_path"
      });
      invariant(
        candidates.candidates.some(
          (candidate) =>
            candidate.path.kind === "chain" &&
            candidate.path.segments.length === 3
        ),
        "G1 line/arc chain candidate was missing."
      );
      const structure = query(engine, { query: "project.structure" });
      invariant(
        structure.features.filter(
          (feature) => feature.kind === "sweep" && feature.path.kind === "chain"
        ).length === 2,
        "Both sweep orientations were not committed as normalized V21 chains."
      );
      checkCount += 3;
    }
    const byteLength = await exactStep(
      engine,
      GeometryKernelWorker,
      executeProjectExactStepExport,
      exactOptions
    );
    const before = cadCore.exportCadProjectJson(engine);
    engine.undo();
    engine.redo();
    invariant(
      cadCore.exportCadProjectJson(engine) === before,
      "Undo/redo changed the canonical project."
    );
    return {
      ok: true,
      workflow: name,
      sampleCount: 1,
      passedCount: 1,
      failedCount: 0,
      checkCount,
      realGeometry: true,
      stepByteLength: byteLength,
      failures: []
    };
  } catch (error) {
    return {
      ok: false,
      workflow: name,
      sampleCount: 1,
      passedCount: 0,
      failedCount: 1,
      checkCount: 0,
      realGeometry: true,
      failures: [
        {
          id: name,
          message: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
}

export async function runV17StorageMigrationWorkflow(cadCore) {
  try {
    const v20Engine = new cadCore.CadEngine();
    commit(v20Engine, [
      {
        op: "sketch.create",
        id: "legacy_profile",
        name: "V20 profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "legacy_profile",
        id: "circle",
        center: [0, 0],
        radius: 0.5
      },
      { op: "sketch.create", id: "legacy_path", name: "V20 path", plane: "XZ" },
      {
        op: "sketch.addLine",
        sketchId: "legacy_path",
        id: "line",
        start: [0, 0],
        end: [0, 4]
      },
      {
        op: "feature.sweep",
        id: "legacy_feature",
        bodyId: "legacy_body",
        profileSketchId: "legacy_profile",
        profileEntityId: "circle",
        pathSketchId: "legacy_path",
        pathEntityIds: ["line"]
      }
    ]);
    const v20 = cadCore.exportCadProject(v20Engine);
    invariant(
      v20.schemaVersion === cadCore.CAD_PROJECT_FORMAT_VERSION_V20,
      "Legacy project did not remain V20."
    );

    const v21Engine = createArcProfileEngine(cadCore);
    v21Engine.apply({
      op: "topology.checkpoint.create",
      checkpointId: "v17_storage_checkpoint",
      bodyId: "arc_body",
      sourceFeatureId: "arc_extrude",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: "a".repeat(64)
      },
      status: "active"
    });
    v21Engine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "arc_profile",
      entityId: "construction_axis",
      construction: false
    });
    v21Engine.undo();
    const v21 = cadCore.exportCadProject(v21Engine);
    invariant(
      v21.schemaVersion === cadCore.CAD_PROJECT_FORMAT_VERSION_V21,
      "Arc project did not emit V21."
    );

    for (const project of [v20, v21]) {
      const parsed = cadCore.parseCadProjectJson(JSON.stringify(project));
      const restored = cadCore.exportCadProject(
        cadCore.importCadProject(parsed)
      );
      const canonicalAgain = cadCore.exportCadProject(
        cadCore.importCadProject(
          cadCore.parseCadProjectJson(JSON.stringify(restored))
        )
      );
      invariant(
        restored.schemaVersion === project.schemaVersion,
        `${project.schemaVersion} migration selected the wrong version.`
      );
      invariant(
        isDeepStrictEqual(restored, canonicalAgain),
        `${project.schemaVersion} JSON round-trip was not canonical.`
      );
      const wcadOptions =
        project.schemaVersion === cadCore.CAD_PROJECT_FORMAT_VERSION_V21
          ? {
              topologyCheckpoints: [
                {
                  checkpointId: "v17_storage_checkpoint",
                  bodyId: "arc_body",
                  sourceFeatureId: "arc_extrude",
                  kernel: {
                    boundary: "geometry-kernel",
                    snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
                  },
                  tolerance: {
                    linearTolerance: 0.001,
                    angularToleranceDegrees: 0.01
                  },
                  brepBytes: new TextEncoder().encode(
                    "deterministic V17 checkpoint B-rep fixture"
                  ),
                  topologyBytes: cadCore.encodeWcadCanonicalCbor({
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
                    signatureAlgorithm:
                      "partbench-derived-topology-snapshot-v1",
                    signature: "v17_storage_signature",
                    diagnostics: []
                  }),
                  signatureBytes: cadCore.encodeWcadCanonicalCbor({
                    checkpointId: "v17_storage_checkpoint",
                    signatureAlgorithm:
                      "partbench-derived-topology-snapshot-v1",
                    signature: "v17_storage_signature",
                    entityCount: 0,
                    entities: []
                  })
                }
              ]
            }
          : {};
      const first = await cadCore.exportCadProjectToWcad(restored, wcadOptions);
      const second = await cadCore.exportCadProjectToWcad(
        structuredClone(restored),
        wcadOptions
      );
      invariant(
        isDeepStrictEqual(first.documentBytes, second.documentBytes),
        `${project.schemaVersion} document CBOR was not canonical.`
      );
      invariant(
        isDeepStrictEqual(first.commandsBytes, second.commandsBytes),
        `${project.schemaVersion} command CBOR was not canonical.`
      );
      invariant(
        isDeepStrictEqual(first.sourceIdentity, second.sourceIdentity),
        `${project.schemaVersion} source identity changed.`
      );
      const read = await cadCore.readCadProjectWcad(first.bytes);
      invariant(read.ok, `${project.schemaVersion} WCAD did not read.`);
      const readCanonical = cadCore.exportCadProject(
        cadCore.importCadProject(read.project)
      );
      invariant(
        isDeepStrictEqual(readCanonical, restored),
        `${project.schemaVersion} WCAD round-trip changed the canonical project.`
      );
      invariant(
        read.project.history.length === restored.history.length,
        `${project.schemaVersion} history was not preserved.`
      );
      invariant(
        read.project.redoStack.length === restored.redoStack.length,
        `${project.schemaVersion} redo was not preserved.`
      );
      if (project.schemaVersion === cadCore.CAD_PROJECT_FORMAT_VERSION_V21) {
        invariant(
          read.project.document.topologyIdentity?.checkpoints?.some(
            (checkpoint) => checkpoint.checkpointId === "v17_storage_checkpoint"
          ),
          "V21 topology checkpoint was not preserved."
        );
        invariant(
          read.checkpointPayloads?.[0]?.brepBytes.byteLength > 0,
          "V21 topology checkpoint payload bytes were not preserved."
        );
      }
    }
    invariant(
      isDeepStrictEqual(
        cadCore.encodeWcadCanonicalCbor({ z: 1, a: { y: 2, x: 3 } }),
        cadCore.encodeWcadCanonicalCbor({ a: { x: 3, y: 2 }, z: 1 })
      ),
      "Canonical CBOR changed with key order."
    );
    return {
      ok: true,
      workflow: "storage-migration",
      sampleCount: 2,
      passedCount: 2,
      failedCount: 0,
      checkCount: 13,
      versions: [v20.schemaVersion, v21.schemaVersion],
      failures: []
    };
  } catch (error) {
    return {
      ok: false,
      workflow: "storage-migration",
      sampleCount: 2,
      passedCount: 0,
      failedCount: 1,
      checkCount: 0,
      failures: [
        {
          id: "storage-migration",
          message: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
}

export function formatV17SmokeSummary(result) {
  const lines = [
    `V17 ${result.workflow} smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed; checks: ${result.checkCount}`
  ];
  if (result.stepByteLength)
    lines.push(`real OCCT STEP bytes: ${result.stepByteLength}`);
  for (const failure of result.failures ?? [])
    lines.push(`- ${failure.id}: ${failure.message}`);
  return lines.join("\n");
}
