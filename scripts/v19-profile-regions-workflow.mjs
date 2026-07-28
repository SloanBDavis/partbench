import { isDeepStrictEqual } from "node:util";

export const V19_PROFILE_REGIONS_WORKFLOW_VERSION =
  "partbench.v19-profile-regions-workflow.v1";

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

function sequentialIds(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}_${index + 1}`);
}

function wire(_sketchId, entityIds) {
  return {
    kind: "wire",
    segments: entityIds.map((entityId) => ({
      entityId,
      orientation: "forward"
    }))
  };
}

function createRoundedPlate(cadCore) {
  const engine = new cadCore.CadEngine();
  const roundedIds = sequentialIds("rounded_edge", 8);
  const slotIds = sequentialIds("slot_edge", 4);

  commit(engine, [
    {
      op: "sketch.create",
      id: "rounded_plate_sketch",
      name: "Rounded plate with slot",
      plane: "XY"
    }
  ]);
  commit(engine, [
    {
      op: "sketch.addRoundedRectangle",
      sketchId: "rounded_plate_sketch",
      center: [0, 0],
      width: 20,
      height: 12,
      cornerRadius: 2,
      entityIds: roundedIds,
      constraintIds: sequentialIds("rounded_constraint", 23)
    }
  ]);
  commit(engine, [
    {
      op: "sketch.addSlot",
      sketchId: "rounded_plate_sketch",
      centerlineStart: [-4, 0],
      centerlineEnd: [4, 0],
      radius: 1.5,
      entityIds: slotIds,
      constraintIds: sequentialIds("slot_constraint", 9)
    }
  ]);
  commit(engine, [
    {
      op: "feature.extrude",
      id: "rounded_plate_feature",
      bodyId: "rounded_plate_body",
      profile: {
        kind: "regions",
        sketchId: "rounded_plate_sketch",
        regions: [
          {
            outer: wire("rounded_plate_sketch", roundedIds),
            holes: [wire("rounded_plate_sketch", slotIds)]
          }
        ]
      },
      operationMode: "newBody",
      depth: 3,
      side: "positive"
    }
  ]);

  return engine;
}

function createFlange(cadCore) {
  const engine = new cadCore.CadEngine();
  const holeIds = [
    "flange_hole_w",
    "flange_hole_s",
    "flange_hole_e",
    "flange_hole_n"
  ];
  const centers = [
    [-5, 0],
    [0, -5],
    [5, 0],
    [0, 5]
  ];

  commit(engine, [
    {
      op: "sketch.create",
      id: "flange_sketch",
      name: "Four-hole flange",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "flange_sketch",
      id: "flange_outer",
      center: [0, 0],
      radius: 10
    },
    ...holeIds.map((id, index) => ({
      op: "sketch.addCircle",
      sketchId: "flange_sketch",
      id,
      center: centers[index],
      radius: 1
    }))
  ]);
  commit(engine, [
    {
      op: "feature.extrude",
      id: "flange_feature",
      bodyId: "flange_body",
      profile: {
        kind: "regions",
        sketchId: "flange_sketch",
        regions: [
          {
            outer: { kind: "entity", entityId: "flange_outer" },
            holes: holeIds.map((entityId) => ({ kind: "entity", entityId }))
          }
        ]
      },
      operationMode: "newBody",
      depth: 2,
      side: "symmetric"
    }
  ]);

  return engine;
}

function createTopologyBackedMultiRegionCut(cadCore) {
  const engine = new cadCore.CadEngine();

  commit(engine, [
    {
      op: "sketch.create",
      id: "multi_cut_sketch",
      name: "Topology-backed multi-region cut",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "multi_cut_sketch",
      id: "multi_cut_target",
      center: [0, 0],
      width: 40,
      height: 20
    },
    {
      op: "sketch.addCircle",
      sketchId: "multi_cut_sketch",
      id: "multi_cut_left",
      center: [-10, 0],
      radius: 2
    },
    {
      op: "sketch.addCircle",
      sketchId: "multi_cut_sketch",
      id: "multi_cut_right",
      center: [10, 0],
      radius: 2
    },
    {
      op: "feature.extrude",
      id: "multi_cut_target_feature",
      bodyId: "multi_cut_target_body",
      sketchId: "multi_cut_sketch",
      entityId: "multi_cut_target",
      operationMode: "newBody",
      depth: 5,
      side: "positive"
    }
  ]);
  const targetTopology = query(engine, {
    query: "body.topology",
    bodyId: "multi_cut_target_body"
  });
  const targetSourceHash = targetTopology.topology.sourceIdentity.signature
    .split(":")
    .at(-1);
  invariant(
    targetSourceHash?.length === 64,
    "Target source identity was missing."
  );
  commit(engine, [
    {
      op: "topology.checkpoint.create",
      checkpointId: "multi_cut_target_checkpoint",
      bodyId: "multi_cut_target_body",
      sourceFeatureId: "multi_cut_target_feature",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: targetSourceHash
      },
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: "multi_cut_target_anchor",
      entityKind: "body",
      bodyId: "multi_cut_target_body",
      checkpointId: "multi_cut_target_checkpoint",
      checkpointEntityId: "body:0",
      sourceFeatureId: "multi_cut_target_feature",
      signatureHash: "multi-cut-target-body-signature"
    }
  ]);
  commit(engine, [
    {
      op: "feature.extrude",
      id: "multi_cut_feature",
      bodyId: "multi_cut_body",
      profile: {
        kind: "regions",
        sketchId: "multi_cut_sketch",
        regions: [
          {
            outer: { kind: "entity", entityId: "multi_cut_right" },
            holes: []
          },
          {
            outer: { kind: "entity", entityId: "multi_cut_left" },
            holes: []
          }
        ]
      },
      operationMode: "cut",
      targetTopologyAnchorId: "multi_cut_target_anchor",
      depth: 5,
      side: "positive"
    }
  ]);

  return engine;
}

function readExtrudeSource(engine, bodyId, modules) {
  const structure = query(engine, { query: "project.structure" });
  const sketches = [...engine.getDocument().sketches.values()].map(
    (sketch) => ({
      id: sketch.id,
      name: sketch.name,
      plane: sketch.plane,
      attachment: sketch.attachment,
      entities: [...sketch.entities.values()]
    })
  );
  const source = modules
    .createExtrudeDerivedGeometrySources(structure.features, sketches)
    .find((candidate) => candidate.id === bodyId);
  invariant(source, `Exact derived source ${bodyId} was missing.`);
  invariant(
    source.kind === "extrudeBoolean",
    `Expected ${bodyId} to resolve to an exact boolean recipe.`
  );
  return { source, structure };
}

async function proveExactRegionBody(engine, bodyId, modules) {
  const { source, structure } = readExtrudeSource(engine, bodyId, modules);
  const exactInput = modules.createExactMetadataRuntimeInput(source);
  invariant(
    exactInput.source.kind === "booleanExtrudes",
    `${bodyId} did not resolve to a boolean exact source.`
  );
  const worker = new modules.GeometryKernelWorker();
  const mesh = await worker.execute(
    modules.createExtrudeBooleanWorkerRequest({
      id: `${bodyId}:mesh`,
      operation: exactInput.source.operation,
      materialPolicy: exactInput.source.materialPolicy,
      target: exactInput.source.target,
      tool: exactInput.source.tool,
      linearDeflection: 0.25,
      angularDeflection: 0.5
    })
  );
  invariant(mesh.response.ok, JSON.stringify(mesh.response));
  invariant(
    "mesh" in mesh.response &&
      mesh.response.mesh.vertexCount > 0 &&
      mesh.response.mesh.triangleCount > 0,
    `${bodyId} did not produce an exact display mesh.`
  );

  const metadata = await worker.execute(
    modules.createExactBodyMetadataWorkerRequest({
      id: `${bodyId}:metadata`,
      source: exactInput.source
    })
  );
  invariant(metadata.response.ok, JSON.stringify(metadata.response));
  invariant(
    "metadata" in metadata.response,
    `${bodyId} exact metadata was missing.`
  );
  invariant(
    metadata.response.metadata.topologyCounts.solidCount === 1 &&
      metadata.response.metadata.volume > 0,
    `${bodyId} did not produce one positive-volume solid.`
  );

  const checkpoint = await worker.execute(
    modules.createExactTopologyCheckpointPayloadWorkerRequest({
      id: `${bodyId}:checkpoint`,
      checkpointId: `${bodyId}_checkpoint`,
      bodyId,
      source: exactInput.source
    })
  );
  invariant(checkpoint.response.ok, JSON.stringify(checkpoint.response));
  invariant(
    "checkpointPayload" in checkpoint.response &&
      checkpoint.response.checkpointPayload.brepBytes.byteLength > 100 &&
      checkpoint.response.checkpointPayload.topologySnapshot.entityCounts
        .solidCount === 1,
    `${bodyId} exact checkpoint proof was incomplete.`
  );

  const exactSnapshot = {
    entries: [
      {
        bodyId,
        sourceKind: source.kind,
        cacheKey: modules.createDerivedExactMetadataCacheKey(source),
        status: "ready",
        metadata: metadata.response.metadata,
        metrics: { objectId: bodyId, roundTripMs: 1 }
      }
    ],
    supportedCount: 1,
    pendingCount: 0,
    readyCount: 1,
    errorCount: 0
  };
  const cadMetadata = modules.createCurrentDerivedExactMetadataSnapshots(
    engine,
    exactSnapshot,
    [source]
  )[0];
  invariant(cadMetadata, `${bodyId} current exact metadata was not accepted.`);
  const topology = query(engine, {
    query: "body.topology",
    bodyId,
    derivedExactMetadata: cadMetadata
  });
  invariant(
    topology.topology.status === "healthy" &&
      topology.topology.topologyModel === "kernel-derived" &&
      topology.topology.exactMetadata?.topologyCounts.solidCount === 1,
    `${bodyId} exact topology was not healthy: ${JSON.stringify(topology.topology)}`
  );
  const health = query(engine, {
    query: "project.health",
    derivedExactMetadata: [cadMetadata]
  });
  invariant(
    health.authoredExtrudes.some(
      (feature) =>
        feature.bodyId === bodyId &&
        feature.status === "healthy" &&
        feature.topologyStatus === "healthy"
    ),
    `${bodyId} project health did not accept exact topology evidence: ${JSON.stringify(health)}`
  );

  const exactExport = modules.readProjectExactStepExport(
    engine,
    exactSnapshot,
    [source]
  );
  invariant(
    exactExport?.available && exactExport.exportableBodyCount === 1,
    `${bodyId} exact STEP source was unavailable: ${JSON.stringify(exactExport)}`
  );
  const step = await modules.executeProjectExactStepExport({
    exactExport,
    worker
  });
  invariant(
    step.available && step.artifact?.byteLength > 1_000,
    `${bodyId} real OCCT STEP artifact was unavailable.`
  );

  return {
    source,
    structure,
    metadata: metadata.response.metadata,
    topology: topology.topology,
    checkpointBytes: checkpoint.response.checkpointPayload.brepBytes.byteLength,
    stepBytes: step.artifact.byteLength,
    cadMetadata
  };
}

function approximatelyEqual(actual, expected, tolerance = 1e-6) {
  return (
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected))
  );
}

export async function runV19ProfileRegionsWorkflow(modules) {
  const checks = [];
  const failures = [];

  function check(id, condition, evidence) {
    checks.push({ id, passed: condition === true, evidence });
    invariant(
      condition === true,
      `V19 profile-regions check failed: ${id}: ${JSON.stringify(evidence)}`
    );
  }

  try {
    const rounded = createRoundedPlate(modules.cadCore);
    const roundedProof = await proveExactRegionBody(
      rounded,
      "rounded_plate_body",
      modules
    );
    const roundedExpectedVolume =
      (20 * 12 - (4 - Math.PI) * 2 ** 2 - (2 * 1.5 * 8 + Math.PI * 1.5 ** 2)) *
      3;
    const roundedReferences = query(rounded, {
      query: "body.generatedReferences",
      bodyId: "rounded_plate_body"
    });
    check(
      "rounded-plate-slot-void",
      approximatelyEqual(
        roundedProof.metadata.volume,
        roundedExpectedVolume,
        1e-5
      ) &&
        roundedReferences.faces.some((face) => face.role.includes(".hole:")) &&
        roundedProof.structure.bodies.filter(
          (body) => !body.consumedByFeatureId
        ).length === 1,
      {
        expectedVolume: roundedExpectedVolume,
        actualVolume: roundedProof.metadata.volume,
        faceCount: roundedProof.metadata.topologyCounts.faceCount,
        stepBytes: roundedProof.stepBytes
      }
    );
    const roundedBeforeUndo = modules.cadCore.exportCadProjectJson(rounded);
    const roundedUndo = rounded.undo();
    const roundedRedo = rounded.redo();
    check(
      "rounded-plate-authored-step-undo-redo",
      roundedUndo?.transaction.ops.length === 1 &&
        roundedUndo.transaction.ops[0]?.op === "feature.extrude" &&
        roundedRedo?.transaction.ops.length === 1 &&
        modules.cadCore.exportCadProjectJson(rounded) === roundedBeforeUndo &&
        rounded
          .getTransactions()
          .slice(-3)
          .every((transaction) => transaction.ops.length === 1),
      {
        undoOp: roundedUndo?.transaction.ops[0]?.op,
        redoOp: roundedRedo?.transaction.ops[0]?.op
      }
    );

    const flange = createFlange(modules.cadCore);
    const flangeProof = await proveExactRegionBody(
      flange,
      "flange_body",
      modules
    );
    const flangeExpectedVolume = Math.PI * (10 ** 2 - 4 * 1 ** 2) * 2;
    const flangeMass = query(flange, {
      query: "body.massProperties",
      bodyId: "flange_body",
      derivedExactMetadata: flangeProof.cadMetadata
    });
    check(
      "flange-four-exact-voids",
      approximatelyEqual(flangeProof.metadata.volume, flangeExpectedVolume) &&
        approximatelyEqual(
          flangeMass.massProperties.volume,
          flangeExpectedVolume
        ) &&
        flangeProof.source.kind === "extrudeBoolean" &&
        flangeProof.structure.bodies.filter((body) => !body.consumedByFeatureId)
          .length === 1,
      {
        expectedVolume: flangeExpectedVolume,
        actualVolume: flangeProof.metadata.volume,
        stepBytes: flangeProof.stepBytes
      }
    );

    const multiCut = createTopologyBackedMultiRegionCut(modules.cadCore);
    const cutTransaction = multiCut.getTransactions().at(-1);
    const multiCutProof = await proveExactRegionBody(
      multiCut,
      "multi_cut_body",
      modules
    );
    const multiCutExpectedVolume = 40 * 20 * 5 - 2 * Math.PI * 2 ** 2 * 5;
    const source = multiCutProof.source;
    const toolCenters = [
      source.target.tool.profile.center,
      source.tool.profile.center
    ];
    check(
      "topology-backed-multi-region-cut",
      source.operation === "cut" &&
        source.materialPolicy === "regionPositiveVolumeSingleSolid" &&
        source.target.kind === "extrudeBoolean" &&
        source.target.materialPolicy === "regionPositiveVolumeSingleSolid" &&
        isDeepStrictEqual(toolCenters, [
          [-10, 0],
          [10, 0]
        ]) &&
        approximatelyEqual(
          multiCutProof.metadata.volume,
          multiCutExpectedVolume
        ) &&
        cutTransaction?.ops[0]?.targetTopologyAnchorId ===
          "multi_cut_target_anchor" &&
        cutTransaction?.diff.features?.inputReferences?.[0]?.after?.kind ===
          "regions",
      {
        toolCenters,
        operation: source.operation,
        materialPolicy: source.materialPolicy,
        nestedKind: source.target.kind,
        nestedMaterialPolicy: source.target.materialPolicy,
        targetTopologyAnchorId: cutTransaction?.ops[0]?.targetTopologyAnchorId,
        diffProfileKind:
          cutTransaction?.diff.features?.inputReferences?.[0]?.after?.kind,
        expectedVolume: multiCutExpectedVolume,
        actualVolume: multiCutProof.metadata.volume,
        checkpointBytes: multiCutProof.checkpointBytes,
        stepBytes: multiCutProof.stepBytes
      }
    );
    const multiCutBeforeUndo = modules.cadCore.exportCadProjectJson(multiCut);
    const cutDiff = cutTransaction?.diff;
    multiCut.undo();
    const redoneCut = multiCut.redo();
    check(
      "multi-region-cut-stable-diff-undo-redo",
      redoneCut?.transaction.ops[0]?.op === "feature.extrude" &&
        isDeepStrictEqual(redoneCut?.transaction.diff, cutDiff) &&
        modules.cadCore.exportCadProjectJson(multiCut) === multiCutBeforeUndo,
      {
        transactionId: redoneCut?.transaction.id,
        semanticDiffStable: isDeepStrictEqual(
          redoneCut?.transaction.diff,
          cutDiff
        )
      }
    );
  } catch (error) {
    failures.push({
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    version: V19_PROFILE_REGIONS_WORKFLOW_VERSION,
    ok: failures.length === 0,
    checkCount: checks.length,
    passedCount: checks.filter(({ passed }) => passed).length,
    checks,
    failures,
    realGeometry: true
  };
}

export function formatV19ProfileRegionsWorkflowSummary(result) {
  const lines = [
    `V19 profile-regions workflow smoke ${result.ok ? "passed" : "failed"}: ${result.passedCount}/${result.checkCount} checks passed.`
  ];
  for (const failure of result.failures) lines.push(`- ${failure.message}`);
  return lines.join("\n");
}
