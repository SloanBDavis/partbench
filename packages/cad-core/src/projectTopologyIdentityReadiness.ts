import {
  CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
  CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
  CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
  WCAD_PACKAGE_VERSION,
  type CadBodySnapshot,
  type CadFeatureSummary,
  type CadTopologyAnchorDescriptor,
  type CadTopologyCheckpointMetadata,
  type CadOpsVersion,
  type CadTopologyEntityKind,
  type CadTopologyIdentityCapabilityId,
  type CadTopologyIdentityCapabilityReadiness,
  type CadTopologyIdentityDiagnostic,
  type CadTopologyIdentitySourceSnapshot,
  type NamedGeneratedReferenceSnapshot,
  type ProjectTopologyIdentityReadinessQueryResponse,
  type WcadDocumentSchemaVersion,
  type WcadReadinessStatus
} from "@web-cad/cad-protocol";

interface ProjectTopologyIdentityReadinessInput {
  readonly cadOpsVersion: CadOpsVersion;
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceSnapshot[];
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot | undefined;
}

const SOURCE_BOUNDARY_NOTE =
  "Derived from the current authoritative document schema, source features, bodies, and named references.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, path, viewport, and export artifact identifiers are excluded from public topology identity.";
const PRIVATE_DIAGNOSTIC_TOKEN_PATTERN =
  /\b(?:checkpointEntityId|rendererId|renderId|meshId|occtId|occtShape|gpuId|gpuBuffer|selectionBufferId|pixelId|triangleIndex|faceIndex|edgeIndex|vertexIndex|opfsPath|fileHandle|localPath|exportArtifactId)\b|checkpoint-local[-:\w]*/gi;

const SUPPORTED_ENTITY_KINDS = [
  "body",
  "face",
  "loop",
  "wire",
  "coedge",
  "edge",
  "vertex",
  "axis"
] satisfies readonly CadTopologyEntityKind[];

export function createProjectTopologyIdentityReadiness({
  cadOpsVersion,
  documentSchemaVersion,
  features,
  bodies,
  namedReferences,
  topologyIdentity
}: ProjectTopologyIdentityReadinessInput): ProjectTopologyIdentityReadinessQueryResponse {
  const capabilities: readonly CadTopologyIdentityCapabilityReadiness[] = [
    createCapability(
      "protocolVocabulary",
      "Topology identity protocol vocabulary",
      "supported",
      "TOPOLOGY_IDENTITY_CONTRACT_READY",
      "Topology snapshots, anchors, checkpoints, match evidence, confidence, repair candidates, and diagnostics are typed."
    ),
    createCapability(
      "snapshotExtraction",
      "Exact topology snapshot extraction",
      "supported",
      "TOPOLOGY_SNAPSHOT_EXTRACTION_READY",
      "Geometry-boundary extraction of derived exact topology snapshots is available for supported exact body sources. These snapshots are derived evidence, not persisted public topology identity."
    ),
    createCapability(
      "anchorPersistence",
      "Topology anchor persistence",
      "supported",
      "TOPOLOGY_ANCHOR_PERSISTENCE_READY",
      "Authoritative topology anchor records are typed in the V18 source contract and can be created through topology.anchor.create against existing checkpoint source records."
    ),
    createCapability(
      "checkpointPersistence",
      "B-rep checkpoint persistence",
      "supported",
      "TOPOLOGY_CHECKPOINT_PERSISTENCE_READY",
      "WCAD v2 can preserve and validate checkpoint B-rep, topology, and signature payload bytes. The app geometry boundary can generate payload bytes for supported exact body sources; automatic normal-save orchestration remains separate."
    ),
    createCapability(
      "matchingEngine",
      "Topology matching engine",
      "supported",
      "TOPOLOGY_MATCHING_ENGINE_READY",
      "Snapshot-to-snapshot matching with scored evidence, confidence, and explicit ambiguity/repair diagnostics is available as a non-mutating query."
    ),
    createCapability(
      "repairCommands",
      "Topology repair commands",
      "supported",
      "TOPOLOGY_REPAIR_COMMANDS_READY",
      "Explicit topology anchor repair is available through topology.anchor.repair. Named-reference repair to topology-anchor targets is available through reference.repairName when the shared reference query proves the target."
    ),
    createCapability(
      "commandEligibility",
      "Topology-anchor command eligibility",
      "deferred",
      "TOPOLOGY_COMMAND_ELIGIBILITY_DEFERRED",
      "Command eligibility for arbitrary topology anchors remains deferred until command validators and geometry runtime paths explicitly accept topology-anchor targets."
    ),
    createCapability(
      "v18SourceContract",
      "V18 topology identity source contract",
      "supported",
      "TOPOLOGY_SOURCE_CONTRACT_READY",
      "web-cad.project.v18 topology identity source settings, checkpoint metadata, anchor records, and repair records are typed. Existing projects are not migrated until source records are written."
    ),
    createCapability(
      "wcadV2Package",
      "WCAD v2 checkpoint package contract",
      "supported",
      "TOPOLOGY_PACKAGE_V2_CONTRACT_READY",
      "partbench.wcad.v2 checkpoint payload entries, manifest validation, package source identity, and read/write preservation are implemented while current .wcad v1 read/write remains unchanged."
    ),
    createCapability(
      "protocolVocabulary",
      "Public topology identity boundary",
      "supported",
      "TOPOLOGY_PUBLIC_ID_BOUNDARY_ENFORCED",
      "Public topology identity records expose document-controlled anchors and semantic references, not raw renderer, mesh, kernel, browser, or file identifiers."
    )
  ];
  const diagnostics = capabilities.flatMap(
    (capability) => capability.diagnostics
  );

  const checkpoints =
    topologyIdentity?.checkpoints.map(createCheckpointMetadata) ?? [];
  const anchors = topologyIdentity?.anchors.map(createAnchorDescriptor) ?? [];

  return {
    ok: true,
    query: "project.topologyIdentityReadiness",
    cadOpsVersion,
    contractVersion: CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
    status: chooseReadinessStatus(
      capabilities.map((capability) => capability.status)
    ),
    currentDocumentSchemaVersion: documentSchemaVersion,
    plannedProjectSchemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
    currentPackageVersion: WCAD_PACKAGE_VERSION,
    plannedPackageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
    requiresProjectSchemaMigration: false,
    requiresPackageVersionMigration: false,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    supportedEntityKinds: SUPPORTED_ENTITY_KINDS,
    currentFeatureCount: features.length,
    currentBodyCount: bodies.length,
    currentNamedReferenceCount: namedReferences.length,
    snapshotDescriptorCount: 0,
    snapshots: [],
    anchorCount: anchors.length,
    anchors,
    checkpointCount: checkpoints.length,
    checkpoints,
    matchResultCount: 0,
    matchResults: [],
    repairCandidateCount: 0,
    repairCandidates: [],
    capabilityCount: capabilities.length,
    capabilities,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createCheckpointMetadata(
  checkpoint: CadTopologyIdentitySourceSnapshot["checkpoints"][number]
): CadTopologyCheckpointMetadata {
  return {
    checkpointId: checkpoint.checkpointId,
    bodyId: checkpoint.bodyId,
    sourceIdentity: checkpoint.sourceIdentity,
    projectSchemaVersion: checkpoint.projectSchemaVersion,
    packageVersion: checkpoint.packageVersion,
    brepEntryId: checkpoint.brepEntryPath,
    topologyEntryId: checkpoint.topologyEntryPath,
    signatureEntryId: checkpoint.signatureEntryPath,
    status: checkpoint.status,
    diagnostics: sanitizeTopologyIdentityDiagnostics(checkpoint.diagnostics)
  };
}

function createAnchorDescriptor(
  anchor: CadTopologyIdentitySourceSnapshot["anchors"][number]
): CadTopologyAnchorDescriptor {
  return {
    anchorId: anchor.anchorId,
    entityKind: anchor.entityKind,
    bodyId: anchor.bodyId,
    sourceFeatureId: anchor.sourceFeatureId,
    stableId: anchor.stableId,
    sourceSemanticRole: anchor.sourceSemanticRole,
    checkpointId: anchor.checkpointId,
    signatureHash: anchor.signatureHash,
    state: anchor.state,
    diagnostics: sanitizeTopologyIdentityDiagnostics(anchor.diagnostics)
  };
}

function sanitizeTopologyIdentityDiagnostics(
  diagnostics: readonly CadTopologyIdentityDiagnostic[]
): readonly CadTopologyIdentityDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const message = sanitizePublicDiagnosticText(diagnostic.message);
    const expected =
      diagnostic.expected === undefined
        ? undefined
        : sanitizePublicDiagnosticText(diagnostic.expected);
    const received =
      diagnostic.received === undefined
        ? undefined
        : sanitizePublicDiagnosticText(diagnostic.received);

    if (
      message === diagnostic.message &&
      expected === diagnostic.expected &&
      received === diagnostic.received
    ) {
      return diagnostic;
    }

    return {
      ...diagnostic,
      message,
      ...(expected === undefined ? {} : { expected }),
      ...(received === undefined ? {} : { received })
    };
  });
}

function sanitizePublicDiagnosticText(value: string): string {
  return value.replace(PRIVATE_DIAGNOSTIC_TOKEN_PATTERN, "[private]");
}

function createCapability(
  capability: CadTopologyIdentityCapabilityId,
  label: string,
  status: WcadReadinessStatus,
  code: CadTopologyIdentityDiagnostic["code"],
  message: string
): CadTopologyIdentityCapabilityReadiness {
  const diagnostic: CadTopologyIdentityDiagnostic = {
    code,
    status,
    severity: status === "unavailable" ? "error" : "info",
    message
  };

  return {
    capability,
    label,
    status,
    available: status === "supported",
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    diagnostics: [diagnostic]
  };
}

function chooseReadinessStatus(
  statuses: readonly WcadReadinessStatus[]
): WcadReadinessStatus {
  if (statuses.some((status) => status === "unavailable")) {
    return "unavailable";
  }

  if (statuses.some((status) => status === "deferred")) {
    return "deferred";
  }

  return "supported";
}
