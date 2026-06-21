import {
  CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
  CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
  CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
  WCAD_PACKAGE_VERSION,
  type CadBodySnapshot,
  type CadFeatureSummary,
  type CadOpsVersion,
  type CadTopologyEntityKind,
  type CadTopologyIdentityCapabilityId,
  type CadTopologyIdentityCapabilityReadiness,
  type CadTopologyIdentityDiagnostic,
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
}

const SOURCE_BOUNDARY_NOTE =
  "Derived from the current authoritative document schema, source features, bodies, and named references.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, path, viewport, and export artifact identifiers are excluded from public topology identity.";

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
  namedReferences
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
      "deferred",
      "TOPOLOGY_ANCHOR_PERSISTENCE_DEFERRED",
      "Authoritative topology anchor records are deferred until the V18 source contract tranche."
    ),
    createCapability(
      "checkpointPersistence",
      "B-rep checkpoint persistence",
      "deferred",
      "TOPOLOGY_CHECKPOINT_PERSISTENCE_DEFERRED",
      "Exact B-rep checkpoint metadata and package payload persistence are deferred to later V13 tranches."
    ),
    createCapability(
      "matchingEngine",
      "Topology matching engine",
      "deferred",
      "TOPOLOGY_MATCHING_ENGINE_DEFERRED",
      "Snapshot-to-snapshot matching with scored evidence and confidence is not implemented in this tranche."
    ),
    createCapability(
      "repairCommands",
      "Topology repair commands",
      "deferred",
      "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
      "Explicit topology anchor and named-reference repair commands are deferred."
    ),
    createCapability(
      "commandEligibility",
      "Topology-anchor command eligibility",
      "deferred",
      "TOPOLOGY_COMMAND_ELIGIBILITY_DEFERRED",
      "Command eligibility for arbitrary topology anchors is deferred until anchors and matching exist."
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
      "partbench.wcad.v2 checkpoint payload entries and manifest validation are typed. Current .wcad v1 read/write remains unchanged until checkpoint persistence is implemented."
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
    anchorCount: 0,
    anchors: [],
    checkpointCount: 0,
    checkpoints: [],
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
