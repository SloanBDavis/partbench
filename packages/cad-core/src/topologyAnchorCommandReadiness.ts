import type {
  BodyId,
  CadBodyExactTopologyEntityDescriptor,
  CadOpsVersion,
  CadSelectionReferenceCandidate,
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  CadTopologyAnchorCommandProof,
  CadTopologyAnchorCommandReadinessStatus,
  CadTopologyAnchorEntityKind,
  CadTopologyIdentityDiagnostic,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyMatchSnapshotInput,
  TopologyAnchorCommandReadinessQuery,
  TopologyAnchorCommandReadinessQueryResponse
} from "@web-cad/cad-protocol";

const SOURCE_BOUNDARY_NOTE =
  "Topology anchor command readiness is derived from authoritative V18 topology anchor/checkpoint source records; it does not mutate source or persist derived match results.";
const DERIVED_BOUNDARY_NOTE =
  "Caller-supplied exact topology snapshots are used only as checkpoint evidence; checkpoint-scoped entity ids, renderer ids, mesh ids, OCCT ids, GPU ids, selection-buffer ids, OPFS paths, file handles, viewport state, and pixel ids are not returned as public stable CAD references.";

const AXES = ["x", "y", "z"] as const;
const BOUNDS_TOLERANCE = 1e-9;

export function createTopologyAnchorCommandReadinessResponse(args: {
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: TopologyAnchorCommandReadinessQuery;
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  readonly resolveProofCommandOperations?: (
    proof: CadTopologyAnchorCommandProof,
    context: {
      readonly anchorId: string;
      readonly bodyId: BodyId;
      readonly entityKind: CadTopologyAnchorEntityKind;
      readonly checkpointId: string;
    }
  ) => readonly CadSelectionReferenceOperation[];
  readonly selectionResult?: {
    readonly status: CadSelectionReferenceStatus;
    readonly candidates: readonly CadSelectionReferenceCandidate[];
    readonly issues: readonly CadSelectionReferenceIssue[];
  };
}): TopologyAnchorCommandReadinessQueryResponse {
  const anchor = args.topologyIdentity?.anchors.find(
    (candidate) => candidate.anchorId === args.query.anchorId
  );

  if (!args.topologyIdentity || !anchor) {
    return createResponse(args, {
      status: "missing",
      commandOperations: [],
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_ENTITY_MISSING",
          "unavailable",
          "error",
          `Topology anchor does not exist: ${args.query.anchorId}`,
          {
            anchorId: args.query.anchorId,
            expected: "existing topology anchor"
          }
        )
      ]
    });
  }

  const checkpoint = args.topologyIdentity.checkpoints.find(
    (candidate) => candidate.checkpointId === anchor.checkpointId
  );

  if (!checkpoint) {
    return createResponse(args, {
      status: "missing",
      bodyId: anchor.bodyId,
      entityKind: anchor.entityKind,
      checkpointId: anchor.checkpointId,
      commandOperations: [],
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_CHECKPOINT_PERSISTENCE_DEFERRED",
          "unavailable",
          "error",
          `Topology anchor ${anchor.anchorId} targets missing checkpoint ${anchor.checkpointId}.`,
          {
            bodyId: anchor.bodyId,
            anchorId: anchor.anchorId,
            checkpointId: anchor.checkpointId,
            expected: "existing topology checkpoint source record",
            received: anchor.checkpointId
          }
        )
      ]
    });
  }

  const inactiveStatus = createInactiveStatus(anchor.state, checkpoint.status);
  if (inactiveStatus) {
    return createResponse(args, {
      status: inactiveStatus,
      bodyId: anchor.bodyId,
      entityKind: anchor.entityKind,
      checkpointId: anchor.checkpointId,
      commandOperations: [],
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_COMMAND_NOT_ELIGIBLE",
          inactiveStatus === "missing" ? "unavailable" : "deferred",
          inactiveStatus === "missing" ? "error" : "warning",
          `Topology anchor ${anchor.anchorId} is not active enough for command readiness.`,
          {
            bodyId: anchor.bodyId,
            anchorId: anchor.anchorId,
            checkpointId: anchor.checkpointId,
            expected: "active topology anchor and checkpoint",
            received: `anchor:${anchor.state}, checkpoint:${checkpoint.status}`
          }
        )
      ]
    });
  }

  const snapshotDiagnostics = validateSnapshotScope(
    args.query.snapshot,
    anchor.bodyId,
    anchor.checkpointId
  );
  if (snapshotDiagnostics.length > 0) {
    return createResponse(args, {
      status: "unsupported",
      bodyId: anchor.bodyId,
      entityKind: anchor.entityKind,
      checkpointId: anchor.checkpointId,
      commandOperations: [],
      diagnostics: snapshotDiagnostics
    });
  }

  const entity = args.query.snapshot.topologySnapshot.entities.find(
    (candidate) => candidate.localId === anchor.checkpointEntityId
  );

  if (!entity) {
    return createResponse(args, {
      status: "missing",
      bodyId: anchor.bodyId,
      entityKind: anchor.entityKind,
      checkpointId: anchor.checkpointId,
      commandOperations: [],
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_ENTITY_MISSING",
          "unavailable",
          "error",
          `Topology anchor ${anchor.anchorId} checkpoint entity is not present in the supplied snapshot.`,
          {
            bodyId: anchor.bodyId,
            anchorId: anchor.anchorId,
            checkpointId: anchor.checkpointId,
            expected: "snapshot entity matching the topology anchor",
            received: "missing"
          }
        )
      ]
    });
  }

  if (entity.kind !== anchor.entityKind) {
    return createResponse(args, {
      status: "unsupported",
      bodyId: anchor.bodyId,
      entityKind: anchor.entityKind,
      checkpointId: anchor.checkpointId,
      commandOperations: [],
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_ENTITY_KIND_MISMATCH",
          "unavailable",
          "error",
          `Topology anchor ${anchor.anchorId} is ${anchor.entityKind}, but snapshot evidence is ${entity.kind}.`,
          {
            bodyId: anchor.bodyId,
            anchorId: anchor.anchorId,
            checkpointId: anchor.checkpointId,
            expected: anchor.entityKind,
            received: entity.kind
          }
        )
      ]
    });
  }

  const proof = createCommandProof(anchor.entityKind, entity);
  const selectionResult =
    args.selectionResult ?? createEmptySelectionResult("unsupported");
  const proofOperations =
    proof === undefined
      ? []
      : createCommandOperations([
          ...createProofCommandOperations(proof),
          ...(args.resolveProofCommandOperations?.(proof, {
            anchorId: anchor.anchorId,
            bodyId: anchor.bodyId,
            entityKind: anchor.entityKind,
            checkpointId: anchor.checkpointId
          }) ?? [])
        ]);
  const commandOperations =
    proof === undefined
      ? []
      : createCommandOperations([
          ...createCommandOperations(selectionResult.candidates),
          ...proofOperations
        ]);
  const status = chooseStatus({
    proof,
    selectionStatus: selectionResult.status,
    commandOperations,
    requiredOperation: args.query.requiredOperation
  });
  const diagnostics =
    proof === undefined
      ? [
          createDiagnostic(
            "TOPOLOGY_COMMAND_NOT_ELIGIBLE",
            "deferred",
            "warning",
            `Topology anchor ${anchor.anchorId} does not have enough checkpoint evidence for command readiness.`,
            {
              bodyId: anchor.bodyId,
              anchorId: anchor.anchorId,
              checkpointId: anchor.checkpointId,
              expected:
                args.query.requiredOperation ?? "supported command operation",
              received: "unsupported checkpoint topology evidence"
            }
          )
        ]
      : [
          createDiagnostic(
            status === "ready"
              ? "TOPOLOGY_COMMAND_ELIGIBILITY_READY"
              : "TOPOLOGY_COMMAND_ELIGIBILITY_DEFERRED",
            status === "ready" ? "supported" : "deferred",
            status === "ready" ? "info" : "warning",
            status === "ready"
              ? `Topology anchor ${anchor.anchorId} has checkpoint evidence and selection-reference command readiness.`
              : `Topology anchor ${anchor.anchorId} has checkpoint evidence but is not command-ready for the requested operation.`,
            {
              bodyId: anchor.bodyId,
              anchorId: anchor.anchorId,
              checkpointId: anchor.checkpointId,
              expected:
                args.query.requiredOperation ??
                "resolved selection.referenceCandidates topology anchor target",
              received:
                commandOperations.length > 0
                  ? commandOperations.join(", ")
                  : selectionResult.status
            }
          )
        ];

  return createResponse(args, {
    status,
    bodyId: anchor.bodyId,
    entityKind: anchor.entityKind,
    checkpointId: anchor.checkpointId,
    commandOperations,
    selectionStatus: status === "ready" ? "resolved" : selectionResult.status,
    candidates: proof === undefined ? [] : selectionResult.candidates,
    issues:
      proof === undefined || status === "ready" ? [] : selectionResult.issues,
    proof,
    diagnostics
  });
}

function createResponse(
  args: {
    readonly cadOpsVersion: CadOpsVersion;
    readonly query: TopologyAnchorCommandReadinessQuery;
  },
  details: {
    readonly status: CadTopologyAnchorCommandReadinessStatus;
    readonly bodyId?: BodyId;
    readonly entityKind?: CadTopologyAnchorEntityKind;
    readonly checkpointId?: string;
    readonly commandOperations: readonly CadSelectionReferenceOperation[];
    readonly selectionStatus?: CadSelectionReferenceStatus;
    readonly candidates?: readonly CadSelectionReferenceCandidate[];
    readonly issues?: readonly CadSelectionReferenceIssue[];
    readonly proof?: CadTopologyAnchorCommandProof;
    readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  }
): TopologyAnchorCommandReadinessQueryResponse {
  const commandable = details.status === "ready";
  const candidates = details.candidates ?? [];
  const issues = details.issues ?? [];
  return {
    ok: true,
    query: "topology.anchorCommandReadiness",
    cadOpsVersion: args.cadOpsVersion,
    status: details.status,
    anchorId: args.query.anchorId,
    ...(details.bodyId ? { bodyId: details.bodyId } : {}),
    ...(details.entityKind ? { entityKind: details.entityKind } : {}),
    ...(details.checkpointId ? { checkpointId: details.checkpointId } : {}),
    ...(args.query.requiredOperation
      ? { requiredOperation: args.query.requiredOperation }
      : {}),
    selectionStatus:
      details.selectionStatus ??
      selectionStatusFromReadinessStatus(details.status),
    commandable,
    commandOperationCount: details.commandOperations.length,
    commandOperations: details.commandOperations,
    candidateCount: candidates.length,
    candidates,
    issueCount: issues.length,
    issues,
    ...(details.proof ? { proof: details.proof } : {}),
    diagnosticCount: details.diagnostics.length,
    diagnostics: details.diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    mutatesSource: false,
    exposesCheckpointLocalIds: false
  };
}

function createInactiveStatus(
  anchorState: CadTopologyIdentitySourceSnapshot["anchors"][number]["state"],
  checkpointStatus: CadTopologyIdentitySourceSnapshot["checkpoints"][number]["status"]
): CadTopologyAnchorCommandReadinessStatus | undefined {
  if (anchorState === "active" && checkpointStatus === "active") {
    return undefined;
  }

  if (anchorState === "missing" || checkpointStatus === "missing") {
    return "missing";
  }

  if (anchorState === "stale" || checkpointStatus === "stale") {
    return "stale";
  }

  return "non-commandable";
}

function validateSnapshotScope(
  snapshot: CadTopologyMatchSnapshotInput,
  bodyId: BodyId,
  checkpointId: string
): readonly CadTopologyIdentityDiagnostic[] {
  const diagnostics: CadTopologyIdentityDiagnostic[] = [];

  if (snapshot.bodyId !== bodyId) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SNAPSHOT_INVALID",
        "unavailable",
        "error",
        `Topology snapshot body ${snapshot.bodyId} does not match anchor body ${bodyId}.`,
        { bodyId, checkpointId, expected: bodyId, received: snapshot.bodyId }
      )
    );
  }

  if (snapshot.checkpointId && snapshot.checkpointId !== checkpointId) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SNAPSHOT_INVALID",
        "unavailable",
        "error",
        `Topology snapshot checkpoint ${snapshot.checkpointId} does not match anchor checkpoint ${checkpointId}.`,
        {
          bodyId,
          checkpointId,
          expected: checkpointId,
          received: snapshot.checkpointId
        }
      )
    );
  }

  return diagnostics;
}

function createCommandProof(
  entityKind: CadTopologyAnchorEntityKind,
  entity: CadBodyExactTopologyEntityDescriptor
): CadTopologyAnchorCommandProof | undefined {
  if (entityKind === "face") {
    const plane = entity.bounds
      ? findAxisAlignedPlane(entity.bounds)
      : undefined;

    if (!plane) {
      return undefined;
    }

    return {
      kind: "axisAlignedPlanarFace",
      entityKind,
      evidenceSource: "checkpointSnapshot",
      exposesCheckpointLocalIds: false,
      bounds: entity.bounds,
      planarAxis: plane.axis,
      planarCoordinate: plane.coordinate
    };
  }

  if (entityKind === "edge") {
    const line = entity.bounds ? findAxisAlignedLine(entity.bounds) : undefined;

    if (!line) {
      return undefined;
    }

    return {
      kind: "axisAlignedLinearEdge",
      entityKind,
      evidenceSource: "checkpointSnapshot",
      exposesCheckpointLocalIds: false,
      bounds: entity.bounds,
      linearAxis: line.axis,
      length: line.length
    };
  }

  if (
    entityKind === "vertex" &&
    entity.bounds &&
    isPointBounds(entity.bounds)
  ) {
    return {
      kind: "pointVertex",
      entityKind,
      evidenceSource: "checkpointSnapshot",
      exposesCheckpointLocalIds: false,
      bounds: entity.bounds
    };
  }

  return {
    kind: "checkpointEntityPresent",
    entityKind,
    evidenceSource: "checkpointSnapshot",
    exposesCheckpointLocalIds: false,
    ...(entity.bounds ? { bounds: entity.bounds } : {})
  };
}

function createCommandOperations(
  operations: readonly CadSelectionReferenceOperation[]
): readonly CadSelectionReferenceOperation[];
function createCommandOperations(
  candidates: readonly CadSelectionReferenceCandidate[]
): readonly CadSelectionReferenceOperation[];
function createCommandOperations(
  input:
    | readonly CadSelectionReferenceOperation[]
    | readonly CadSelectionReferenceCandidate[]
): readonly CadSelectionReferenceOperation[] {
  const operations = input.flatMap((item) =>
    typeof item === "string" ? [item] : item.commandOperations
  );

  return [...new Set(operations)];
}

function createProofCommandOperations(
  proof: CadTopologyAnchorCommandProof
): readonly CadSelectionReferenceOperation[] {
  if (proof.entityKind === "body") {
    return [
      "feature.extrudeCutTarget",
      "feature.extrudeAddTarget",
      "feature.holeTarget"
    ];
  }

  if (proof.kind === "axisAlignedPlanarFace") {
    return ["feature.attachSketchPlane"];
  }

  return [];
}

function chooseStatus(input: {
  readonly proof: CadTopologyAnchorCommandProof | undefined;
  readonly selectionStatus: CadSelectionReferenceStatus;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly requiredOperation?: CadSelectionReferenceOperation;
}): CadTopologyAnchorCommandReadinessStatus {
  if (!input.proof) {
    return "unsupported";
  }

  if (
    input.requiredOperation
      ? input.commandOperations.includes(input.requiredOperation)
      : input.commandOperations.length > 0
  ) {
    return "ready";
  }

  if (input.selectionStatus === "missing") {
    return "missing";
  }

  if (input.selectionStatus === "stale") {
    return "stale";
  }

  if (input.selectionStatus === "non-commandable") {
    return "non-commandable";
  }

  return "partial";
}

function createEmptySelectionResult(status: CadSelectionReferenceStatus): {
  readonly status: CadSelectionReferenceStatus;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issues: readonly CadSelectionReferenceIssue[];
} {
  return {
    status,
    candidates: [],
    issues: []
  };
}

function selectionStatusFromReadinessStatus(
  status: CadTopologyAnchorCommandReadinessStatus
): CadSelectionReferenceStatus {
  if (status === "ready") {
    return "resolved";
  }

  if (status === "missing") {
    return "missing";
  }

  if (status === "stale") {
    return "stale";
  }

  if (status === "non-commandable") {
    return "non-commandable";
  }

  return "unsupported";
}

function findAxisAlignedPlane(bounds: {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}):
  | { readonly axis: "x" | "y" | "z"; readonly coordinate: number }
  | undefined {
  const degenerateAxes = getDegenerateAxes(bounds);

  if (degenerateAxes.length !== 1) {
    return undefined;
  }

  const axisIndex = degenerateAxes[0]!;
  return {
    axis: AXES[axisIndex],
    coordinate: bounds.min[axisIndex]
  };
}

function findAxisAlignedLine(bounds: {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}): { readonly axis: "x" | "y" | "z"; readonly length: number } | undefined {
  const degenerateAxes = getDegenerateAxes(bounds);

  if (degenerateAxes.length !== 2) {
    return undefined;
  }

  const axisIndex = [0, 1, 2].find((index) => !degenerateAxes.includes(index));

  if (axisIndex === undefined) {
    return undefined;
  }

  const length = Math.abs(bounds.max[axisIndex] - bounds.min[axisIndex]);

  if (length <= BOUNDS_TOLERANCE) {
    return undefined;
  }

  return {
    axis: AXES[axisIndex],
    length
  };
}

function isPointBounds(bounds: {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}): boolean {
  return getDegenerateAxes(bounds).length === 3;
}

function getDegenerateAxes(bounds: {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}): number[] {
  return [0, 1, 2].filter(
    (index) =>
      Math.abs(bounds.max[index] - bounds.min[index]) <= BOUNDS_TOLERANCE
  );
}

function createDiagnostic(
  code: CadTopologyIdentityDiagnostic["code"],
  status: CadTopologyIdentityDiagnostic["status"],
  severity: CadTopologyIdentityDiagnostic["severity"],
  message: string,
  details: Pick<
    CadTopologyIdentityDiagnostic,
    "bodyId" | "checkpointId" | "anchorId" | "expected" | "received"
  > = {}
): CadTopologyIdentityDiagnostic {
  return {
    code,
    status,
    severity,
    message,
    ...details
  };
}
