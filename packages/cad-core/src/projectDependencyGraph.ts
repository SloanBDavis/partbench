import type {
  BodyId,
  CadBodySnapshot,
  CadDependencyGraphEdge,
  CadDependencyGraphNode,
  CadFeatureSummary,
  CadGeneratedEntityKind,
  CadGeneratedReference,
  CadOpsVersion,
  CadReferenceHealthDependencies,
  CadReferenceHealthDiagnostic,
  CadReferenceHealthDiagnosticCode,
  CadReferenceHealthEntry,
  CadReferenceHealthStatus,
  CadReferenceHealthTarget,
  CadSelectionReferenceOperation,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyMatchResult,
  FeatureId,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  PartId,
  ProjectDependencyGraphQueryResponse,
  ReferenceHealthQueryResponse,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchId
} from "@web-cad/cad-protocol";

import {
  createBodyGeneratedReferences,
  resolveGeneratedReference,
  type GeneratedReferencesDocument,
  type GeneratedReferencesFeature,
  type GeneratedReferencesSketch
} from "./generatedReferences";
import {
  findSketchProfileHealthEntry,
  type SketchProfileHealthEntry
} from "./sketchProfileHealth";
import { createTopologyAnchorReferenceHealthEntries } from "./topologyReferenceHealth";

const SOURCE_BOUNDARY_NOTE =
  "Dependency graph and reference health are derived from authoritative document source features, bodies, sketches, generated references, and named references.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer meshes, OCCT indexes, OPFS paths, file handles, viewport state, selection-buffer ids, and export artifacts are excluded from dependency and reference identity.";

export interface CreateProjectDependencyGraphOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly ownerPartId: PartId;
  readonly document: DependencyGraphDocument;
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceSnapshot[];
  readonly sketchProfileHealth?: readonly SketchProfileHealthEntry[];
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
}

export interface CreateReferenceHealthOptions extends CreateProjectDependencyGraphOptions {
  readonly target?: CadReferenceHealthTarget;
}

export interface DependencyGraphDocument extends GeneratedReferencesDocument {
  readonly sketches: ReadonlyMap<SketchId, DependencyGraphSketch>;
  readonly features: ReadonlyMap<FeatureId, GeneratedReferencesFeature>;
  readonly namedReferences: ReadonlyMap<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >;
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
}

export interface DependencyGraphSketch extends GeneratedReferencesSketch {
  readonly id: SketchId;
  readonly name?: string;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

export function createProjectDependencyGraph(
  options: CreateProjectDependencyGraphOptions
): ProjectDependencyGraphQueryResponse {
  const referenceHealth = createAllReferenceHealthEntries(options);
  const graph = buildDependencyGraph(options, referenceHealth);
  const diagnostics = collectReferenceHealthDiagnostics(referenceHealth);

  return {
    ok: true,
    query: "project.dependencyGraph",
    cadOpsVersion: options.cadOpsVersion,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodes: graph.nodes,
    edges: graph.edges,
    referenceHealthCount: referenceHealth.length,
    referenceHealth,
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    requiresProjectSchemaMigration: false
  };
}

export function createReferenceHealth(
  options: CreateReferenceHealthOptions
): ReferenceHealthQueryResponse {
  const target = options.target ?? { type: "all" as const };
  const referenceHealth = filterReferenceHealthEntries(
    options,
    createAllReferenceHealthEntries(options),
    target
  );
  const diagnostics = collectReferenceHealthDiagnostics(referenceHealth);

  return {
    ok: true,
    query: "reference.health",
    cadOpsVersion: options.cadOpsVersion,
    target,
    status: combineReferenceHealthStatuses(
      referenceHealth.map((entry) => entry.status)
    ),
    referenceHealthCount: referenceHealth.length,
    referenceHealth,
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    requiresProjectSchemaMigration: false
  };
}

function buildDependencyGraph(
  options: CreateProjectDependencyGraphOptions,
  referenceHealth: readonly CadReferenceHealthEntry[]
): {
  readonly nodes: readonly CadDependencyGraphNode[];
  readonly edges: readonly CadDependencyGraphEdge[];
} {
  const nodes = new Map<string, CadDependencyGraphNode>();
  const edges = new Map<string, CadDependencyGraphEdge>();
  const bodyStatus = new Map<BodyId, CadReferenceHealthStatus>();
  const generatedStatus = new Map<string, CadReferenceHealthStatus>();
  const namedStatus = new Map<NamedReferenceName, CadReferenceHealthStatus>();
  const topologyAnchorStatus = new Map<string, CadReferenceHealthStatus>();

  for (const entry of referenceHealth) {
    if (entry.bodyId) {
      bodyStatus.set(
        entry.bodyId,
        mergeReferenceStatus(bodyStatus.get(entry.bodyId), entry.status)
      );
    }

    if (entry.bodyId && entry.stableId) {
      generatedStatus.set(
        generatedReferenceNodeId(entry.bodyId, entry.stableId),
        entry.status
      );
    }

    if (entry.referenceName) {
      namedStatus.set(entry.referenceName, entry.status);
    }

    if (entry.topologyAnchorId) {
      topologyAnchorStatus.set(entry.topologyAnchorId, entry.status);
    }
  }

  for (const sketch of options.document.sketches.values()) {
    addNode(nodes, {
      id: sketchNodeId(sketch.id),
      kind: "sketch",
      label: sketch.name ?? sketch.id,
      status: "active",
      sketchId: sketch.id
    });

    for (const entity of sketch.entities.values()) {
      addNode(nodes, {
        id: sketchEntityNodeId(sketch.id, entity.id),
        kind: "sketchEntity",
        label: `${entity.kind} ${entity.id}`,
        status: "active",
        sketchId: sketch.id,
        sketchEntityId: entity.id
      });
      addEdge(edges, {
        kind: "contains",
        from: sketchNodeId(sketch.id),
        to: sketchEntityNodeId(sketch.id, entity.id),
        label: "contains",
        sketchId: sketch.id,
        sketchEntityId: entity.id
      });
    }
  }

  for (const feature of options.features) {
    addNode(nodes, {
      id: featureNodeId(feature.id),
      kind: "feature",
      label: `${feature.kind} ${feature.id}`,
      status: featureStatus(feature, options),
      featureId: feature.id,
      featureKind: feature.kind
    });

    addFeatureSourceEdges(edges, feature);
  }

  for (const body of options.bodies) {
    addNode(nodes, {
      id: bodyNodeId(body.id),
      kind: "body",
      label: body.name ?? body.id,
      status: bodyStatus.get(body.id) ?? bodyStatusFromSnapshot(options, body),
      bodyId: body.id,
      featureId: body.featureId,
      bodySourceType: body.source.type
    });
    addEdge(edges, {
      kind: "produces",
      from: featureNodeId(body.featureId),
      to: bodyNodeId(body.id),
      label: "produces",
      sourceFeatureId: body.featureId,
      bodyId: body.id
    });

    if (body.consumedByFeatureId) {
      addEdge(edges, {
        kind: "consumes",
        from: featureNodeId(body.consumedByFeatureId),
        to: bodyNodeId(body.id),
        label: "consumes",
        sourceFeatureId: body.consumedByFeatureId,
        bodyId: body.id
      });
    }
  }

  for (const feature of options.features) {
    addFeatureTargetEdges(edges, feature);
  }

  for (const entry of referenceHealth) {
    if (!entry.bodyId || !entry.stableId || !entry.kind) {
      continue;
    }

    addNode(nodes, {
      id: generatedReferenceNodeId(entry.bodyId, entry.stableId),
      kind: "generatedReference",
      label: entry.label,
      status:
        generatedStatus.get(
          generatedReferenceNodeId(entry.bodyId, entry.stableId)
        ) ?? entry.status,
      bodyId: entry.bodyId,
      stableId: entry.stableId,
      generatedReferenceKind: entry.kind,
      ...(entry.sourceFeatureId ? { featureId: entry.sourceFeatureId } : {})
    });
    addEdge(edges, {
      kind: "generates",
      from: bodyNodeId(entry.bodyId),
      to: generatedReferenceNodeId(entry.bodyId, entry.stableId),
      label: "generates",
      bodyId: entry.bodyId,
      stableId: entry.stableId,
      ...(entry.sourceFeatureId
        ? { sourceFeatureId: entry.sourceFeatureId }
        : {})
    });
  }

  for (const reference of options.namedReferences) {
    addNode(nodes, {
      id: namedReferenceNodeId(reference.name),
      kind: "namedReference",
      label: reference.name,
      status: namedStatus.get(reference.name) ?? "missing",
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      referenceName: reference.name,
      generatedReferenceKind: reference.kind,
      ...(reference.topologyAnchorId
        ? { topologyAnchorId: reference.topologyAnchorId }
        : {})
    });

    if (reference.topologyAnchorId) {
      addEdge(edges, {
        kind: "dependsOn",
        from: namedReferenceNodeId(reference.name),
        to: topologyAnchorNodeId(reference.topologyAnchorId),
        label: "depends on topology anchor",
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name,
        topologyAnchorId: reference.topologyAnchorId
      });
    }

    if (
      nodes.has(generatedReferenceNodeId(reference.bodyId, reference.stableId))
    ) {
      addEdge(edges, {
        kind: "names",
        from: namedReferenceNodeId(reference.name),
        to: generatedReferenceNodeId(reference.bodyId, reference.stableId),
        label: "names",
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name
      });
    } else {
      addEdge(edges, {
        kind: "dependsOn",
        from: namedReferenceNodeId(reference.name),
        to: bodyNodeId(reference.bodyId),
        label: "depends on body",
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name
      });
    }
  }

  for (const entry of referenceHealth) {
    if (entry.source !== "topologyAnchor" || !entry.topologyAnchorId) {
      continue;
    }

    addNode(nodes, {
      id: topologyAnchorNodeId(entry.topologyAnchorId),
      kind: "topologyAnchor",
      label: entry.label,
      status: topologyAnchorStatus.get(entry.topologyAnchorId) ?? entry.status,
      bodyId: entry.bodyId,
      stableId: entry.stableId,
      topologyAnchorId: entry.topologyAnchorId,
      checkpointId: entry.checkpointId,
      topologyEntityKind: entry.topologyEntityKind,
      ...(entry.sourceFeatureId ? { featureId: entry.sourceFeatureId } : {})
    });

    if (entry.bodyId && entry.stableId) {
      const generatedReferenceId = generatedReferenceNodeId(
        entry.bodyId,
        entry.stableId
      );

      addEdge(edges, {
        kind: "anchors",
        from: topologyAnchorNodeId(entry.topologyAnchorId),
        to: nodes.has(generatedReferenceId)
          ? generatedReferenceId
          : bodyNodeId(entry.bodyId),
        label: nodes.has(generatedReferenceId)
          ? "anchors generated reference"
          : "anchors body topology",
        bodyId: entry.bodyId,
        stableId: entry.stableId,
        topologyAnchorId: entry.topologyAnchorId,
        checkpointId: entry.checkpointId,
        ...(entry.sourceFeatureId
          ? { sourceFeatureId: entry.sourceFeatureId }
          : {})
      });
    } else if (entry.bodyId) {
      addEdge(edges, {
        kind: "anchors",
        from: topologyAnchorNodeId(entry.topologyAnchorId),
        to: bodyNodeId(entry.bodyId),
        label: "anchors body topology",
        bodyId: entry.bodyId,
        topologyAnchorId: entry.topologyAnchorId,
        checkpointId: entry.checkpointId,
        ...(entry.sourceFeatureId
          ? { sourceFeatureId: entry.sourceFeatureId }
          : {})
      });
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()]
  };
}

function addFeatureSourceEdges(
  edges: Map<string, CadDependencyGraphEdge>,
  feature: CadFeatureSummary
): void {
  if (feature.kind === "primitive") {
    return;
  }

  if (feature.kind === "hole") {
    addEdge(edges, {
      kind: "sources",
      from: sketchNodeId(feature.sketchId),
      to: featureNodeId(feature.id),
      label: "sources",
      sourceFeatureId: feature.id,
      sketchId: feature.sketchId
    });
    addEdge(edges, {
      kind: "sources",
      from: sketchEntityNodeId(feature.sketchId, feature.circleEntityId),
      to: featureNodeId(feature.id),
      label: "sources",
      sourceFeatureId: feature.id,
      sketchId: feature.sketchId,
      sketchEntityId: feature.circleEntityId
    });
    if (feature.targetTopologyAnchorId) {
      addEdge(edges, {
        kind: "sources",
        from: topologyAnchorNodeId(feature.targetTopologyAnchorId),
        to: featureNodeId(feature.id),
        label: "target topology anchor source",
        sourceFeatureId: feature.id,
        topologyAnchorId: feature.targetTopologyAnchorId
      });
    }
    return;
  }

  if (feature.kind === "chamfer" || feature.kind === "fillet") {
    if (feature.topologyAnchorId) {
      addEdge(edges, {
        kind: "sources",
        from: topologyAnchorNodeId(feature.topologyAnchorId),
        to: featureNodeId(feature.id),
        label: "topology anchor source",
        sourceFeatureId: feature.id,
        topologyAnchorId: feature.topologyAnchorId
      });
    }
    return;
  }

  if (
    feature.kind === "importedBody" ||
    feature.kind === "linearPattern" ||
    feature.kind === "circularPattern"
  ) {
    return;
  }

  addEdge(edges, {
    kind: "sources",
    from: sketchNodeId(feature.sketchId),
    to: featureNodeId(feature.id),
    label: "sources",
    sourceFeatureId: feature.id,
    sketchId: feature.sketchId
  });
  addEdge(edges, {
    kind: "sources",
    from: sketchEntityNodeId(feature.sketchId, feature.entityId),
    to: featureNodeId(feature.id),
    label: "sources",
    sourceFeatureId: feature.id,
    sketchId: feature.sketchId,
    sketchEntityId: feature.entityId
  });

  if (feature.kind === "extrude" && feature.targetTopologyAnchorId) {
    addEdge(edges, {
      kind: "sources",
      from: topologyAnchorNodeId(feature.targetTopologyAnchorId),
      to: featureNodeId(feature.id),
      label: "target topology anchor source",
      sourceFeatureId: feature.id,
      topologyAnchorId: feature.targetTopologyAnchorId
    });
  }

  if (feature.kind === "revolve") {
    addEdge(edges, {
      kind: "sources",
      from: sketchEntityNodeId(feature.axis.sketchId, feature.axis.entityId),
      to: featureNodeId(feature.id),
      label: "axis source",
      sourceFeatureId: feature.id,
      sketchId: feature.axis.sketchId,
      sketchEntityId: feature.axis.entityId
    });
  }
}

function addFeatureTargetEdges(
  edges: Map<string, CadDependencyGraphEdge>,
  feature: CadFeatureSummary
): void {
  const targetBodyId =
    "targetBodyId" in feature ? feature.targetBodyId : undefined;

  if (!targetBodyId) {
    return;
  }

  addEdge(edges, {
    kind: "targets",
    from: featureNodeId(feature.id),
    to: bodyNodeId(targetBodyId),
    label: "targets",
    sourceFeatureId: feature.id,
    bodyId: targetBodyId
  });
}

function createAllReferenceHealthEntries(
  options: CreateProjectDependencyGraphOptions
): readonly CadReferenceHealthEntry[] {
  const entries: CadReferenceHealthEntry[] = [];

  for (const body of options.bodies) {
    const generatedEntries = createGeneratedReferenceHealthForBody(
      options,
      body
    );

    entries.push(...generatedEntries);

    if (generatedEntries.length === 0) {
      entries.push(createUnsupportedBodyReferenceHealth(options, body));
    }
  }

  for (const reference of options.namedReferences) {
    entries.push(createNamedReferenceHealth(options, reference));
  }

  entries.push(
    ...createTopologyAnchorReferenceHealthEntries({
      document: options.document,
      ownerPartId: options.ownerPartId,
      topologyIdentity: options.document.topologyIdentity,
      topologyMatchResults: options.topologyMatchResults
    })
  );

  return entries;
}

function createGeneratedReferenceHealthForBody(
  options: CreateProjectDependencyGraphOptions,
  body: CadBodySnapshot
): readonly CadReferenceHealthEntry[] {
  const references = createBodyGeneratedReferences(
    options.document,
    body.id,
    options.ownerPartId
  );

  if (!references) {
    return [];
  }

  return listGeneratedReferences(references).map((reference) =>
    createGeneratedReferenceHealth(options, body, reference)
  );
}

function createGeneratedReferenceHealth(
  options: CreateProjectDependencyGraphOptions,
  body: CadBodySnapshot,
  reference: CadGeneratedReference
): CadReferenceHealthEntry {
  const consumedByFeatureId = body.consumedByFeatureId;
  const profileHealth = findSketchProfileHealthEntry(
    options.sketchProfileHealth ?? [],
    body.featureId
  );
  const profileStatus = profileHealth
    ? referenceStatusFromProfileHealth(profileHealth)
    : undefined;
  const status = consumedByFeatureId ? "consumed" : (profileStatus ?? "active");
  const diagnostics = consumedByFeatureId
    ? [
        createDiagnostic({
          code: "REFERENCE_BODY_CONSUMED",
          severity: "blocker",
          status: "consumed",
          message: `Generated reference ${reference.stableId} is on consumed body ${body.id}.`,
          bodyId: body.id,
          stableId: reference.stableId,
          featureId: reference.sourceFeatureId,
          received: consumedByFeatureId
        })
      ]
    : profileHealth && profileHealth.status !== "ready"
      ? [
          createProfileHealthReferenceDiagnostic({
            profileHealth,
            body,
            stableId: reference.stableId
          })
        ]
      : [];
  const commandOperations =
    status === "active" ? createReferenceCommandOperations(reference) : [];

  return {
    source: "generatedReference",
    status,
    commandable: commandOperations.length > 0,
    commandOperations,
    label: reference.label,
    bodyId: body.id,
    stableId: reference.stableId,
    kind: reference.kind,
    sourceFeatureId: reference.sourceFeatureId,
    ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
    dependencies: createReferenceDependencies({
      sketchIds: [reference.sourceSketchId],
      sketchEntityIds: [reference.sourceSketchEntityId],
      featureIds: [reference.sourceFeatureId],
      bodyIds: [body.id],
      generatedReferenceStableIds: [reference.stableId],
      namedReferenceNames: findNamesForReference(
        options,
        body.id,
        reference.stableId
      )
    }),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createUnsupportedBodyReferenceHealth(
  options: CreateProjectDependencyGraphOptions,
  body: CadBodySnapshot
): CadReferenceHealthEntry {
  const status = unsupportedBodyReferenceStatus(body);
  const code = unsupportedBodyDiagnosticCode(status);
  const diagnostic = createDiagnostic({
    code,
    severity: status === "missing" ? "blocker" : "warning",
    status,
    message: unsupportedBodyReferenceMessage(body),
    bodyId: body.id,
    featureId: body.featureId,
    expected: "source-semantic generated references",
    received: body.source.type
  });

  return {
    source: "body",
    status,
    commandable: false,
    commandOperations: [],
    label: body.name ?? body.id,
    bodyId: body.id,
    sourceFeatureId: body.featureId,
    ...(body.consumedByFeatureId
      ? { consumedByFeatureId: body.consumedByFeatureId }
      : {}),
    dependencies: createReferenceDependencies({
      featureIds: [body.featureId],
      bodyIds: [body.id]
    }),
    diagnosticCount: 1,
    diagnostics: [diagnostic]
  };
}

function createNamedReferenceHealth(
  options: CreateProjectDependencyGraphOptions,
  reference: NamedGeneratedReferenceSnapshot
): CadReferenceHealthEntry {
  const body = options.bodies.find(
    (candidate) => candidate.id === reference.bodyId
  );

  if (!body) {
    const diagnostics = [
      createDiagnostic({
        code: "REFERENCE_TARGET_MISSING",
        severity: "blocker",
        status: "missing",
        message: `Named reference ${reference.name} targets missing body ${reference.bodyId}.`,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name
      })
    ];

    return createNamedReferenceEntry({
      reference,
      status: "missing",
      commandable: false,
      commandOperations: [],
      label: reference.name,
      dependencies: createReferenceDependencies({
        bodyIds: [reference.bodyId],
        generatedReferenceStableIds: [reference.stableId],
        namedReferenceNames: [reference.name]
      }),
      diagnostics
    });
  }

  const generatedReferences = createBodyGeneratedReferences(
    options.document,
    reference.bodyId,
    options.ownerPartId
  );

  if (!generatedReferences) {
    const status = unsupportedBodyReferenceStatus(body);
    const diagnostics = [
      createDiagnostic({
        code: unsupportedBodyDiagnosticCode(status),
        severity: "warning",
        status,
        message: `Named reference ${reference.name} targets a body without command-ready generated references.`,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name,
        featureId: body.featureId,
        expected: "supported source-semantic generated reference",
        received: body.source.type
      })
    ];

    return createNamedReferenceEntry({
      reference,
      status,
      commandable: false,
      commandOperations: [],
      label: reference.name,
      sourceFeatureId: body.featureId,
      consumedByFeatureId: body.consumedByFeatureId,
      dependencies: createReferenceDependencies({
        featureIds: [body.featureId],
        bodyIds: [body.id],
        generatedReferenceStableIds: [reference.stableId],
        namedReferenceNames: [reference.name]
      }),
      diagnostics
    });
  }

  const resolved = resolveGeneratedReference(
    generatedReferences,
    reference.stableId
  );

  if (!resolved) {
    const diagnostics = [
      createDiagnostic({
        code: "REFERENCE_STALE",
        severity: "warning",
        status: "stale",
        message: `Named reference ${reference.name} is stale: ${reference.stableId}`,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name,
        featureId: body.featureId
      }),
      createDiagnostic({
        code: "REFERENCE_REPAIR_NEEDED",
        severity: "warning",
        status: "repair-needed",
        message: `Named reference ${reference.name} needs explicit repair before it can be command-ready again.`,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name,
        featureId: body.featureId
      })
    ];

    return createNamedReferenceEntry({
      reference,
      status: "stale",
      commandable: false,
      commandOperations: [],
      label: reference.name,
      sourceFeatureId: body.featureId,
      dependencies: createReferenceDependencies({
        featureIds: [body.featureId],
        bodyIds: [body.id],
        generatedReferenceStableIds: [reference.stableId],
        namedReferenceNames: [reference.name]
      }),
      diagnostics
    });
  }

  if (resolved.kind !== reference.kind) {
    const diagnostics = [
      createDiagnostic({
        code: "REFERENCE_STALE",
        severity: "warning",
        status: "stale",
        message: `Named reference ${reference.name} changed kind from ${reference.kind} to ${resolved.kind}.`,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name,
        featureId: body.featureId,
        expected: reference.kind,
        received: resolved.kind
      })
    ];

    return createNamedReferenceEntry({
      reference,
      status: "stale",
      commandable: false,
      commandOperations: [],
      label: reference.name,
      sourceFeatureId: body.featureId,
      dependencies: createReferenceDependencies({
        featureIds: [body.featureId],
        bodyIds: [body.id],
        generatedReferenceStableIds: [reference.stableId],
        namedReferenceNames: [reference.name]
      }),
      diagnostics
    });
  }

  const consumedByFeatureId = body.consumedByFeatureId;
  const profileHealth = findSketchProfileHealthEntry(
    options.sketchProfileHealth ?? [],
    body.featureId
  );
  const profileStatus = profileHealth
    ? referenceStatusFromProfileHealth(profileHealth)
    : undefined;
  const status = consumedByFeatureId ? "consumed" : (profileStatus ?? "active");
  const diagnostics = consumedByFeatureId
    ? [
        createDiagnostic({
          code: "REFERENCE_BODY_CONSUMED",
          severity: "blocker",
          status: "consumed",
          message: `Named reference ${reference.name} targets consumed body ${body.id}.`,
          bodyId: body.id,
          stableId: reference.stableId,
          referenceName: reference.name,
          featureId: body.featureId,
          received: consumedByFeatureId
        })
      ]
    : profileHealth && profileHealth.status !== "ready"
      ? [
          createProfileHealthReferenceDiagnostic({
            profileHealth,
            body,
            stableId: reference.stableId,
            referenceName: reference.name
          })
        ]
      : [];

  return createNamedReferenceEntry({
    reference,
    status,
    commandable: status === "active",
    commandOperations:
      status === "active"
        ? createReferenceCommandOperations(resolved.reference)
        : [],
    label: reference.name,
    kind: resolved.kind,
    sourceFeatureId: body.featureId,
    consumedByFeatureId,
    dependencies: createReferenceDependencies({
      featureIds: [body.featureId],
      bodyIds: [body.id],
      generatedReferenceStableIds: [reference.stableId],
      namedReferenceNames: [reference.name]
    }),
    diagnostics
  });
}

function filterReferenceHealthEntries(
  options: CreateProjectDependencyGraphOptions,
  entries: readonly CadReferenceHealthEntry[],
  target: CadReferenceHealthTarget
): readonly CadReferenceHealthEntry[] {
  if (target.type === "all") {
    return entries;
  }

  if (target.type === "body") {
    const matches = entries.filter((entry) => entry.bodyId === target.bodyId);

    if (matches.length > 0) {
      return matches;
    }

    return [createMissingBodyReferenceHealth(target.bodyId)];
  }

  if (target.type === "namedReference") {
    const matches = entries.filter(
      (entry) => entry.referenceName === target.name
    );

    if (matches.length > 0) {
      return matches;
    }

    return [createMissingNamedReferenceHealth(target.name)];
  }

  if (target.type === "topologyAnchor") {
    const matches = entries.filter(
      (entry) => entry.topologyAnchorId === target.anchorId
    );

    if (matches.length > 0) {
      return matches;
    }

    return [createMissingTopologyAnchorReferenceHealth(target.anchorId)];
  }

  const matches = entries.filter(
    (entry) =>
      entry.bodyId === target.bodyId && entry.stableId === target.stableId
  );

  if (matches.length > 0) {
    return matches.map((entry) =>
      target.expectedKind !== undefined &&
      entry.kind !== undefined &&
      entry.kind !== target.expectedKind
        ? withKindMismatchDiagnostic(entry, target.expectedKind)
        : entry
    );
  }

  const body = options.bodies.find(
    (candidate) => candidate.id === target.bodyId
  );

  if (!body) {
    return [createMissingGeneratedReferenceHealth(target)];
  }

  return [createStaleGeneratedReferenceHealth(options, body, target)];
}

function createMissingBodyReferenceHealth(
  bodyId: BodyId
): CadReferenceHealthEntry {
  const diagnostics = [
    createDiagnostic({
      code: "REFERENCE_TARGET_MISSING",
      severity: "blocker",
      status: "missing",
      message: `Reference health target body does not exist: ${bodyId}`,
      bodyId
    })
  ];

  return {
    source: "body",
    status: "missing",
    commandable: false,
    commandOperations: [],
    label: bodyId,
    bodyId,
    dependencies: createReferenceDependencies({ bodyIds: [bodyId] }),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createMissingNamedReferenceHealth(
  name: NamedReferenceName
): CadReferenceHealthEntry {
  const diagnostics = [
    createDiagnostic({
      code: "REFERENCE_TARGET_MISSING",
      severity: "blocker",
      status: "missing",
      message: `Named reference does not exist: ${name}`,
      referenceName: name
    })
  ];

  return {
    source: "namedReference",
    status: "missing",
    commandable: false,
    commandOperations: [],
    label: name,
    referenceName: name,
    dependencies: createReferenceDependencies({ namedReferenceNames: [name] }),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createMissingTopologyAnchorReferenceHealth(
  anchorId: string
): CadReferenceHealthEntry {
  const diagnostics = [
    createDiagnostic({
      code: "REFERENCE_TARGET_MISSING",
      severity: "blocker",
      status: "missing",
      message: `Topology anchor does not exist: ${anchorId}`,
      topologyAnchorId: anchorId
    })
  ];

  return {
    source: "topologyAnchor",
    status: "missing",
    commandable: false,
    commandOperations: [],
    label: anchorId,
    topologyAnchorId: anchorId,
    dependencies: createReferenceDependencies({
      topologyAnchorIds: [anchorId]
    }),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createMissingGeneratedReferenceHealth(
  target: Extract<
    CadReferenceHealthTarget,
    { readonly type: "generatedReference" }
  >
): CadReferenceHealthEntry {
  const diagnostics = [
    createDiagnostic({
      code: "REFERENCE_TARGET_MISSING",
      severity: "blocker",
      status: "missing",
      message: `Generated reference body does not exist: ${target.bodyId}`,
      bodyId: target.bodyId,
      stableId: target.stableId,
      ...(target.expectedKind ? { expected: target.expectedKind } : {})
    })
  ];

  return {
    source: "generatedReference",
    status: "missing",
    commandable: false,
    commandOperations: [],
    label: target.stableId,
    bodyId: target.bodyId,
    stableId: target.stableId,
    ...(target.expectedKind ? { kind: target.expectedKind } : {}),
    dependencies: createReferenceDependencies({
      bodyIds: [target.bodyId],
      generatedReferenceStableIds: [target.stableId]
    }),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createStaleGeneratedReferenceHealth(
  options: CreateProjectDependencyGraphOptions,
  body: CadBodySnapshot,
  target: Extract<
    CadReferenceHealthTarget,
    { readonly type: "generatedReference" }
  >
): CadReferenceHealthEntry {
  const bodyStatus = unsupportedBodyReferenceStatus(body);
  const references = createBodyGeneratedReferences(
    options.document,
    body.id,
    options.ownerPartId
  );
  const status = references ? "stale" : bodyStatus;
  const diagnostics = [
    createDiagnostic({
      code: references
        ? "REFERENCE_STALE"
        : unsupportedBodyDiagnosticCode(bodyStatus),
      severity: status === "stale" ? "warning" : "blocker",
      status,
      message: references
        ? `Generated reference is stale: ${target.stableId}`
        : unsupportedBodyReferenceMessage(body),
      bodyId: body.id,
      stableId: target.stableId,
      featureId: body.featureId,
      ...(target.expectedKind ? { expected: target.expectedKind } : {}),
      received: body.source.type
    })
  ];

  return {
    source: "generatedReference",
    status,
    commandable: false,
    commandOperations: [],
    label: target.stableId,
    bodyId: body.id,
    stableId: target.stableId,
    ...(target.expectedKind ? { kind: target.expectedKind } : {}),
    sourceFeatureId: body.featureId,
    dependencies: createReferenceDependencies({
      featureIds: [body.featureId],
      bodyIds: [body.id],
      generatedReferenceStableIds: [target.stableId]
    }),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function withKindMismatchDiagnostic(
  entry: CadReferenceHealthEntry,
  expectedKind: CadGeneratedEntityKind
): CadReferenceHealthEntry {
  const diagnostic = createDiagnostic({
    code: "REFERENCE_STALE",
    severity: "warning",
    status: "stale",
    message: `Generated reference resolved as ${entry.kind}, not ${expectedKind}.`,
    bodyId: entry.bodyId,
    stableId: entry.stableId,
    referenceName: entry.referenceName,
    featureId: entry.sourceFeatureId,
    expected: expectedKind,
    received: entry.kind
  });
  const diagnostics = [...entry.diagnostics, diagnostic];

  return {
    ...entry,
    status: "stale",
    commandable: false,
    commandOperations: [],
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createNamedReferenceEntry(args: {
  readonly reference: NamedGeneratedReferenceSnapshot;
  readonly status: CadReferenceHealthStatus;
  readonly commandable: boolean;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly label: string;
  readonly kind?: CadGeneratedEntityKind;
  readonly sourceFeatureId?: FeatureId;
  readonly consumedByFeatureId?: FeatureId;
  readonly dependencies: CadReferenceHealthDependencies;
  readonly diagnostics: readonly CadReferenceHealthDiagnostic[];
}): CadReferenceHealthEntry {
  return {
    source: "namedReference",
    status: args.status,
    commandable: args.commandable,
    commandOperations: args.commandOperations,
    label: args.label,
    bodyId: args.reference.bodyId,
    stableId: args.reference.stableId,
    kind: args.kind ?? args.reference.kind,
    referenceName: args.reference.name,
    ...(args.reference.topologyAnchorId
      ? { topologyAnchorId: args.reference.topologyAnchorId }
      : {}),
    ...(args.sourceFeatureId ? { sourceFeatureId: args.sourceFeatureId } : {}),
    ...(args.consumedByFeatureId
      ? { consumedByFeatureId: args.consumedByFeatureId }
      : {}),
    dependencies: args.dependencies,
    diagnosticCount: args.diagnostics.length,
    diagnostics: args.diagnostics
  };
}

function createReferenceDependencies(args: {
  readonly sketchIds?: readonly SketchId[];
  readonly sketchEntityIds?: readonly SketchEntityId[];
  readonly featureIds?: readonly FeatureId[];
  readonly bodyIds?: readonly BodyId[];
  readonly generatedReferenceStableIds?: readonly string[];
  readonly namedReferenceNames?: readonly NamedReferenceName[];
  readonly topologyAnchorIds?: readonly string[];
  readonly checkpointIds?: readonly string[];
}): CadReferenceHealthDependencies {
  return {
    sketchIds: unique(args.sketchIds ?? []),
    sketchEntityIds: unique(args.sketchEntityIds ?? []),
    featureIds: unique(args.featureIds ?? []),
    bodyIds: unique(args.bodyIds ?? []),
    generatedReferenceStableIds: unique(args.generatedReferenceStableIds ?? []),
    namedReferenceNames: unique(args.namedReferenceNames ?? []),
    ...(args.topologyAnchorIds
      ? { topologyAnchorIds: unique(args.topologyAnchorIds) }
      : {}),
    ...(args.checkpointIds ? { checkpointIds: unique(args.checkpointIds) } : {})
  };
}

function createReferenceCommandOperations(
  reference: CadGeneratedReference
): readonly CadSelectionReferenceOperation[] {
  return reference.eligibleOperations.includes("feature.selectReference")
    ? ["reference.nameGenerated", ...reference.eligibleOperations]
    : [...reference.eligibleOperations];
}

function listGeneratedReferences(
  references: ReturnType<typeof createBodyGeneratedReferences>
): readonly CadGeneratedReference[] {
  if (!references) {
    return [];
  }

  return [
    references.body,
    ...references.faces,
    ...references.edges,
    ...references.vertices,
    ...references.axes
  ];
}

function findNamesForReference(
  options: CreateProjectDependencyGraphOptions,
  bodyId: BodyId,
  stableId: string
): readonly NamedReferenceName[] {
  return options.namedReferences
    .filter(
      (reference) =>
        reference.bodyId === bodyId && reference.stableId === stableId
    )
    .map((reference) => reference.name);
}

function unsupportedBodyReferenceStatus(
  body: CadBodySnapshot
): CadReferenceHealthStatus {
  if (body.consumedByFeatureId) {
    return "consumed";
  }

  if (body.source.type === "sketchExtrudeFeature") {
    return "ambiguous";
  }

  if (
    body.source.type === "sketchHoleFeature" ||
    body.source.type === "edgeChamferFeature" ||
    body.source.type === "edgeFilletFeature"
  ) {
    return "repair-needed";
  }

  return "unsupported";
}

function unsupportedBodyDiagnosticCode(
  status: CadReferenceHealthStatus
): CadReferenceHealthDiagnosticCode {
  if (status === "consumed") {
    return "REFERENCE_BODY_CONSUMED";
  }

  if (status === "ambiguous") {
    return "REFERENCE_TOPOLOGY_AMBIGUOUS";
  }

  if (status === "repair-needed") {
    return "REFERENCE_REPAIR_NEEDED";
  }

  if (status === "missing") {
    return "REFERENCE_TARGET_MISSING";
  }

  return "REFERENCE_UNSUPPORTED";
}

function unsupportedBodyReferenceMessage(body: CadBodySnapshot): string {
  if (body.consumedByFeatureId) {
    return `Body ${body.id} is consumed by feature ${body.consumedByFeatureId}.`;
  }

  if (body.source.type === "sketchExtrudeFeature") {
    return `Body ${body.id} does not currently expose unambiguous result topology references.`;
  }

  if (
    body.source.type === "sketchHoleFeature" ||
    body.source.type === "edgeChamferFeature" ||
    body.source.type === "edgeFilletFeature"
  ) {
    return `Body ${body.id} result references need explicit repair semantics before becoming command-ready.`;
  }

  return `Body ${body.id} does not expose source-semantic generated references in this tranche.`;
}

function referenceStatusFromProfileHealth(
  profileHealth: SketchProfileHealthEntry
): CadReferenceHealthStatus {
  if (profileHealth.status === "missing") {
    return "missing";
  }

  if (profileHealth.status === "unsupported") {
    return "unsupported";
  }

  if (profileHealth.status === "stale") {
    return "stale";
  }

  return "active";
}

function createProfileHealthReferenceDiagnostic({
  profileHealth,
  body,
  stableId,
  referenceName
}: {
  readonly profileHealth: SketchProfileHealthEntry;
  readonly body: CadBodySnapshot;
  readonly stableId: string;
  readonly referenceName?: NamedReferenceName;
}): CadReferenceHealthDiagnostic {
  const status = referenceStatusFromProfileHealth(profileHealth);

  return createDiagnostic({
    code:
      status === "missing"
        ? "REFERENCE_TARGET_MISSING"
        : status === "unsupported"
          ? "REFERENCE_UNSUPPORTED"
          : "REFERENCE_STALE",
    severity: status === "missing" ? "blocker" : "warning",
    status,
    message: profileHealth.message,
    bodyId: body.id,
    stableId,
    referenceName,
    featureId: profileHealth.featureId,
    sketchId: profileHealth.sketchId,
    sketchEntityId: profileHealth.sketchEntityId,
    expected: profileHealth.expected,
    received: profileHealth.received
  });
}

function bodyStatusFromSnapshot(
  options: CreateProjectDependencyGraphOptions,
  body: CadBodySnapshot
): CadReferenceHealthStatus {
  if (body.consumedByFeatureId) {
    return "consumed";
  }

  const profileHealth = findSketchProfileHealthEntry(
    options.sketchProfileHealth ?? [],
    body.featureId
  );

  if (profileHealth && profileHealth.status !== "ready") {
    return referenceStatusFromProfileHealth(profileHealth);
  }

  if (body.source.type === "sketchExtrudeFeature") {
    return "active";
  }

  return unsupportedBodyReferenceStatus(body);
}

function featureStatus(
  feature: CadFeatureSummary,
  options: CreateProjectDependencyGraphOptions
): CadReferenceHealthStatus {
  const body = options.bodies.find(
    (candidate) => candidate.featureId === feature.id
  );

  if (body?.consumedByFeatureId) {
    return "consumed";
  }

  const profileHealth = findSketchProfileHealthEntry(
    options.sketchProfileHealth ?? [],
    feature.id
  );

  if (profileHealth && profileHealth.status !== "ready") {
    return referenceStatusFromProfileHealth(profileHealth);
  }

  if (feature.kind === "extrude") {
    return feature.operationMode === "newBody" ? "active" : "ambiguous";
  }

  if (feature.kind === "primitive") {
    return "unsupported";
  }

  if (feature.kind === "hole") {
    return "active";
  }

  if (feature.kind === "chamfer" || feature.kind === "fillet") {
    return "repair-needed";
  }

  return "unsupported";
}

function collectReferenceHealthDiagnostics(
  entries: readonly CadReferenceHealthEntry[]
): readonly CadReferenceHealthDiagnostic[] {
  return entries.flatMap((entry) => entry.diagnostics);
}

function combineReferenceHealthStatuses(
  statuses: readonly CadReferenceHealthStatus[]
): CadReferenceHealthStatus {
  if (statuses.length === 0) {
    return "missing";
  }

  for (const status of [
    "missing",
    "deleted",
    "stale",
    "consumed",
    "ambiguous",
    "unsupported",
    "repair-needed",
    "replaced",
    "active"
  ] satisfies readonly CadReferenceHealthStatus[]) {
    if (statuses.includes(status)) {
      return status;
    }
  }

  return "active";
}

function mergeReferenceStatus(
  left: CadReferenceHealthStatus | undefined,
  right: CadReferenceHealthStatus
): CadReferenceHealthStatus {
  return combineReferenceHealthStatuses([...(left ? [left] : []), right]);
}

function addNode(
  nodes: Map<string, CadDependencyGraphNode>,
  node: CadDependencyGraphNode
): void {
  if (!nodes.has(node.id)) {
    nodes.set(node.id, node);
  }
}

function addEdge(
  edges: Map<string, CadDependencyGraphEdge>,
  edge: Omit<CadDependencyGraphEdge, "id"> & {
    readonly sketchId?: SketchId;
    readonly sketchEntityId?: SketchEntityId;
  }
): void {
  const id = `${edge.kind}:${edge.from}->${edge.to}`;

  if (edges.has(id)) {
    return;
  }

  edges.set(id, {
    id,
    kind: edge.kind,
    from: edge.from,
    to: edge.to,
    label: edge.label,
    ...(edge.sourceFeatureId ? { sourceFeatureId: edge.sourceFeatureId } : {}),
    ...(edge.targetFeatureId ? { targetFeatureId: edge.targetFeatureId } : {}),
    ...(edge.bodyId ? { bodyId: edge.bodyId } : {}),
    ...(edge.stableId ? { stableId: edge.stableId } : {}),
    ...(edge.topologyAnchorId
      ? { topologyAnchorId: edge.topologyAnchorId }
      : {}),
    ...(edge.checkpointId ? { checkpointId: edge.checkpointId } : {}),
    ...(edge.referenceName ? { referenceName: edge.referenceName } : {})
  });
}

function createDiagnostic(args: {
  readonly code: CadReferenceHealthDiagnosticCode;
  readonly severity: CadReferenceHealthDiagnostic["severity"];
  readonly status: CadReferenceHealthStatus;
  readonly message: string;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly stableId?: string;
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly expected?: string;
  readonly received?: string;
}): CadReferenceHealthDiagnostic {
  return {
    code: args.code,
    severity: args.severity,
    status: args.status,
    message: args.message,
    ...(args.featureId ? { featureId: args.featureId } : {}),
    ...(args.bodyId ? { bodyId: args.bodyId } : {}),
    ...(args.targetBodyId ? { targetBodyId: args.targetBodyId } : {}),
    ...(args.sketchId ? { sketchId: args.sketchId } : {}),
    ...(args.sketchEntityId ? { sketchEntityId: args.sketchEntityId } : {}),
    ...(args.stableId ? { stableId: args.stableId } : {}),
    ...(args.topologyAnchorId
      ? { topologyAnchorId: args.topologyAnchorId }
      : {}),
    ...(args.checkpointId ? { checkpointId: args.checkpointId } : {}),
    ...(args.referenceName ? { referenceName: args.referenceName } : {}),
    ...(args.expected ? { expected: args.expected } : {}),
    ...(args.received ? { received: args.received } : {})
  };
}

function sketchNodeId(sketchId: SketchId): string {
  return `sketch:${sketchId}`;
}

function sketchEntityNodeId(
  sketchId: SketchId,
  entityId: SketchEntityId
): string {
  return `sketch-entity:${sketchId}:${entityId}`;
}

function featureNodeId(featureId: FeatureId): string {
  return `feature:${featureId}`;
}

function bodyNodeId(bodyId: BodyId): string {
  return `body:${bodyId}`;
}

function generatedReferenceNodeId(bodyId: BodyId, stableId: string): string {
  return `generated-reference:${bodyId}:${stableId}`;
}

function namedReferenceNodeId(name: NamedReferenceName): string {
  return `named-reference:${name}`;
}

function topologyAnchorNodeId(anchorId: string): string {
  return `topology-anchor:${anchorId}`;
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
