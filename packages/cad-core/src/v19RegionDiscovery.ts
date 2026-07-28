import {
  CAD_V19_RESOURCE_LIMITS,
  type CadOpsVersion,
  type OrientedSketchSegmentRef,
  type SketchEntitySnapshot,
  type SketchLoopRef,
  type SketchProfileRegionCandidate,
  type SketchProfileRegionCandidatesQuery,
  type SketchProfileRegionCandidatesQueryResponse,
  type SketchRegionDiagnostic,
  type SketchRegionDiagnosticCode
} from "@web-cad/cad-protocol";

import { encodeCanonicalCbor } from "./canonicalCbor";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";
import {
  areSketchPointsCoincident,
  getSketchWireSignedArea,
  intersectSketchSegments,
  resolveOrientedSketchSegment,
  type ResolvedSketchSegment
} from "./sketchWireGeometry";
import { sha256Hex } from "./sha256";
import {
  compareSketchCanonicalKeys,
  getSketchLoopCanonicalKey
} from "./v22SourceShapes";
import {
  analyzeV22RegionDiscoveryLoops,
  type V22RegionDiscoveryAnalyzedLoop,
  type V22RegionSourceIssue,
  type V22RegionSourceSketch
} from "./v22RegionSourceValidation";

interface EndpointRef {
  readonly entityId: string;
  readonly endpoint: "start" | "end";
  readonly point: readonly [number, number];
}

interface DiscoveryEntity {
  readonly entity: Extract<
    SketchEntitySnapshot,
    { readonly kind: "line" | "arc" }
  >;
  readonly forward: ResolvedSketchSegment;
}

type EligibleRegionEntity = Extract<
  SketchEntitySnapshot,
  { readonly kind: "rectangle" | "circle" | "line" | "arc" }
>;

interface DiscoveryComponent {
  readonly entities: readonly DiscoveryEntity[];
  readonly vertices: readonly (readonly EndpointRef[])[];
}

class DiscoveryBudgetExceeded extends Error {}

class DiscoveryBudget {
  #count = 0;

  get count(): number {
    return this.#count;
  }

  visit(count = 1): void {
    this.#count += count;
    if (this.#count > CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits) {
      throw new DiscoveryBudgetExceeded();
    }
  }
}

function diagnostic(
  code: SketchRegionDiagnosticCode,
  message: string,
  sketchId: string,
  details: Omit<
    SketchRegionDiagnostic,
    "code" | "severity" | "message" | "sketchId"
  > = {}
): SketchRegionDiagnostic {
  return {
    code,
    severity: "blocker",
    message,
    sketchId,
    ...details
  };
}

function compareIds(left: string, right: string): number {
  return compareSketchCanonicalKeys(left, right);
}

function normalizeEntityIds(
  entityIds: readonly string[] | undefined
): readonly string[] | null {
  return entityIds === undefined
    ? null
    : [...new Set(entityIds)].sort(compareIds);
}

function discoveryEntityProjection(
  entity: SketchEntitySnapshot
): unknown | undefined {
  switch (entity.kind) {
    case "rectangle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: entity.center,
        width: entity.width,
        height: entity.height,
        construction: entity.construction
      };
    case "circle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: entity.center,
        radius: entity.radius,
        construction: entity.construction
      };
    case "line":
      return {
        id: entity.id,
        kind: entity.kind,
        start: entity.start,
        end: entity.end,
        construction: entity.construction
      };
    case "arc":
      return {
        id: entity.id,
        kind: entity.kind,
        center: entity.center,
        radius: entity.radius,
        startAngleDegrees: entity.startAngleDegrees,
        sweepAngleDegrees: entity.sweepAngleDegrees,
        construction: entity.construction
      };
    default:
      return undefined;
  }
}

export function createSketchRegionSourceIdentities(
  sketch: V22RegionSourceSketch,
  entityIds?: readonly string[]
): {
  readonly sourceFingerprint: string;
  readonly sourceRevision: string;
  readonly normalizedEntityIds: readonly string[] | null;
} {
  const normalizedEntityIds = normalizeEntityIds(entityIds);
  const projection = {
    sketchId: sketch.id,
    entities: [...sketch.entities.values()]
      .map(discoveryEntityProjection)
      .filter((entity) => entity !== undefined)
      .sort((left, right) =>
        compareIds(
          (left as { readonly id: string }).id,
          (right as { readonly id: string }).id
        )
      )
  };
  const sourceFingerprint = `partbench-source-v1:${sha256Hex(
    encodeCanonicalCbor(projection)
  )}`;
  const sourceRevision = `partbench-source-v1:${sha256Hex(
    encodeCanonicalCbor([sourceFingerprint, normalizedEntityIds])
  )}`;
  return { sourceFingerprint, sourceRevision, normalizedEntityIds };
}

function eligibleKind(
  entity: SketchEntitySnapshot
): entity is Extract<
  SketchEntitySnapshot,
  { readonly kind: "rectangle" | "circle" | "line" | "arc" }
> {
  return (
    entity.kind === "rectangle" ||
    entity.kind === "circle" ||
    entity.kind === "line" ||
    entity.kind === "arc"
  );
}

function hasFiniteEntityLoopGeometry(
  entity: Extract<
    SketchEntitySnapshot,
    { readonly kind: "rectangle" | "circle" }
  >
): boolean {
  if (
    !Number.isFinite(entity.center[0]) ||
    !Number.isFinite(entity.center[1])
  ) {
    return false;
  }
  if (entity.kind === "circle") {
    return (
      Number.isFinite(entity.radius) &&
      entity.radius > SKETCH_GEOMETRY_POLICY.linearTolerance &&
      Number.isFinite(Math.PI * entity.radius * entity.radius) &&
      Math.PI * entity.radius * entity.radius >=
        SKETCH_GEOMETRY_POLICY.minimumProfileArea
    );
  }
  const halfWidth = entity.width / 2;
  const halfHeight = entity.height / 2;
  return (
    Number.isFinite(entity.width) &&
    Number.isFinite(entity.height) &&
    entity.width > SKETCH_GEOMETRY_POLICY.linearTolerance &&
    entity.height > SKETCH_GEOMETRY_POLICY.linearTolerance &&
    Number.isFinite(entity.width * entity.height) &&
    entity.width * entity.height >= SKETCH_GEOMETRY_POLICY.minimumProfileArea &&
    Number.isFinite(entity.center[0] - halfWidth) &&
    Number.isFinite(entity.center[0] + halfWidth) &&
    Number.isFinite(entity.center[1] - halfHeight) &&
    Number.isFinite(entity.center[1] + halfHeight)
  );
}

function selectedEntities(
  sketch: V22RegionSourceSketch,
  normalizedEntityIds: readonly string[] | null,
  requestedEntityIds: readonly string[] | undefined
): {
  readonly entities: readonly EligibleRegionEntity[];
  readonly diagnostics: readonly SketchRegionDiagnostic[];
  readonly narrowingInvalid: boolean;
} {
  const diagnostics: SketchRegionDiagnostic[] = [];
  let narrowingInvalid = false;
  const requested =
    normalizedEntityIds === null
      ? [...sketch.entities.values()].sort((left, right) =>
          compareIds(left.id, right.id)
        )
      : normalizedEntityIds.flatMap((entityId) => {
          const entity = sketch.entities.get(entityId);
          if (entity) return [entity];
          diagnostics.push(
            diagnostic(
              "SKETCH_REGION_ENTITY_MISSING",
              `Narrowed discovery entity does not exist: ${entityId}.`,
              sketch.id,
              { entityId }
            )
          );
          narrowingInvalid = true;
          return [];
        });
  const duplicateNarrowing =
    requestedEntityIds !== undefined &&
    new Set(requestedEntityIds).size !== requestedEntityIds.length;
  narrowingInvalid ||= duplicateNarrowing;
  if (duplicateNarrowing) {
    diagnostics.push(
      diagnostic(
        "SKETCH_REGION_ENTITY_REPEATED",
        "Region discovery narrowing may not contain duplicate entity IDs.",
        sketch.id
      )
    );
  }
  const result: EligibleRegionEntity[] = [];
  for (const entity of requested) {
    if (!eligibleKind(entity)) {
      if (normalizedEntityIds !== null) {
        narrowingInvalid = true;
        diagnostics.push(
          diagnostic(
            "SKETCH_REGION_ENTITY_UNSUPPORTED",
            `Entity ${entity.id} is not eligible for material-region discovery.`,
            sketch.id,
            { entityId: entity.id, received: entity.kind }
          )
        );
      }
      continue;
    }
    if (entity.construction) {
      if (normalizedEntityIds !== null) {
        diagnostics.push(
          diagnostic(
            "SKETCH_REGION_CONSTRUCTION_ENTITY",
            `Construction entity ${entity.id} is excluded from material-region discovery.`,
            sketch.id,
            { entityId: entity.id }
          )
        );
        narrowingInvalid = true;
      }
      continue;
    }
    result.push(entity);
  }
  return { entities: result, diagnostics, narrowingInvalid };
}

function endpointSort(left: EndpointRef, right: EndpointRef): number {
  return (
    left.point[0] - right.point[0] ||
    left.point[1] - right.point[1] ||
    compareIds(left.entityId, right.entityId) ||
    compareIds(left.endpoint, right.endpoint)
  );
}

function buildComponents(
  entities: readonly DiscoveryEntity[],
  budget: DiscoveryBudget
): readonly DiscoveryComponent[] {
  const endpoints = entities
    .flatMap(({ entity, forward }) => [
      {
        entityId: entity.id,
        endpoint: "start" as const,
        point: forward.start
      },
      {
        entityId: entity.id,
        endpoint: "end" as const,
        point: forward.end
      }
    ])
    .sort(endpointSort);
  const parents = endpoints.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root]!;
    while (parents[index] !== index) {
      const next = parents[index]!;
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      const deltaX = endpoints[right]!.point[0] - endpoints[left]!.point[0];
      if (deltaX > SKETCH_GEOMETRY_POLICY.linearTolerance) break;
      budget.visit();
      if (
        areSketchPointsCoincident(
          endpoints[left]!.point,
          endpoints[right]!.point,
          SKETCH_GEOMETRY_POLICY
        )
      ) {
        union(left, right);
      }
    }
  }
  const verticesByRoot = new Map<number, EndpointRef[]>();
  endpoints.forEach((endpoint, index) => {
    const root = find(index);
    const vertex = verticesByRoot.get(root) ?? [];
    vertex.push(endpoint);
    verticesByRoot.set(root, vertex);
  });
  const neighbors = new Map(
    entities.map(({ entity }) => [entity.id, new Set<string>()])
  );
  for (const vertex of verticesByRoot.values()) {
    for (const left of vertex) {
      for (const right of vertex) {
        if (left.entityId !== right.entityId) {
          neighbors.get(left.entityId)!.add(right.entityId);
        }
      }
    }
  }
  const byId = new Map(entities.map((entity) => [entity.entity.id, entity]));
  const remaining = new Set(byId.keys());
  const components: DiscoveryComponent[] = [];
  while (remaining.size > 0) {
    const start = [...remaining].sort(compareIds)[0]!;
    const queue = [start];
    const ids: string[] = [];
    remaining.delete(start);
    while (queue.length > 0) {
      const id = queue.shift()!;
      ids.push(id);
      for (const neighbor of [...(neighbors.get(id) ?? [])].sort(compareIds)) {
        if (remaining.delete(neighbor)) queue.push(neighbor);
      }
    }
    const idSet = new Set(ids);
    components.push({
      entities: ids.sort(compareIds).map((id) => byId.get(id)!),
      vertices: [...verticesByRoot.values()]
        .filter((vertex) =>
          vertex.some((endpoint) => idSet.has(endpoint.entityId))
        )
        .map((vertex) => [...vertex].sort(endpointSort))
    });
  }
  return components;
}

function traverseComponent(
  component: DiscoveryComponent
): readonly ResolvedSketchSegment[] | undefined {
  if (component.entities.length < 2) return undefined;
  const endpointVertex = new Map<string, number>();
  component.vertices.forEach((vertex, vertexIndex) => {
    for (const endpoint of vertex) {
      endpointVertex.set(
        `${endpoint.entityId}:${endpoint.endpoint}`,
        vertexIndex
      );
    }
  });
  const byId = new Map(
    component.entities.map((value) => [value.entity.id, value.entity])
  );
  const startId = component.entities[0]!.entity.id;
  for (const firstOrientation of ["forward", "reverse"] as const) {
    const used = new Set<string>();
    const ordered: ResolvedSketchSegment[] = [];
    let entityId: string | undefined = startId;
    let orientation: "forward" | "reverse" = firstOrientation;
    while (entityId && !used.has(entityId)) {
      const resolution = resolveOrientedSketchSegment(
        byId.get(entityId)!,
        orientation,
        SKETCH_GEOMETRY_POLICY
      );
      if (!resolution.ok) break;
      ordered.push(resolution.segment);
      used.add(entityId);
      const exitEndpoint = orientation === "forward" ? "end" : "start";
      const vertexIndex = endpointVertex.get(`${entityId}:${exitEndpoint}`);
      const next =
        vertexIndex === undefined
          ? undefined
          : component.vertices[vertexIndex]!.find(
              (endpoint) => !used.has(endpoint.entityId)
            );
      if (!next) break;
      entityId = next.entityId;
      orientation = next.endpoint === "start" ? "forward" : "reverse";
    }
    if (
      ordered.length === component.entities.length &&
      areSketchPointsCoincident(
        ordered.at(-1)!.end,
        ordered[0]!.start,
        SKETCH_GEOMETRY_POLICY
      )
    ) {
      return ordered;
    }
  }
  return undefined;
}

function referencesFromSegments(
  segments: readonly ResolvedSketchSegment[]
): readonly OrientedSketchSegmentRef[] {
  return segments.map((segment) => ({
    entityId: segment.entityId,
    orientation: segment.orientation
  }));
}

function validateWireTraversal(
  sketchId: string,
  segments: readonly ResolvedSketchSegment[],
  budget: DiscoveryBudget
): readonly SketchRegionDiagnostic[] {
  const diagnostics: SketchRegionDiagnostic[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    budget.visit();
    if (
      !areSketchPointsCoincident(
        segments[index]!.end,
        segments[(index + 1) % segments.length]!.start,
        SKETCH_GEOMETRY_POLICY
      )
    ) {
      diagnostics.push(
        diagnostic(
          "SKETCH_REGION_LOOP_OPEN",
          "Connected discovery component does not form one closed whole-entity loop.",
          sketchId,
          { entityId: segments[index]!.entityId }
        )
      );
    }
  }
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex += 1
    ) {
      budget.visit();
      const intersection = intersectSketchSegments(
        segments[leftIndex]!,
        segments[rightIndex]!,
        SKETCH_GEOMETRY_POLICY
      );
      const adjacent =
        rightIndex === leftIndex + 1 ||
        (leftIndex === 0 && rightIndex === segments.length - 1);
      const allowedJoin =
        adjacent &&
        !intersection.overlap &&
        intersection.points.length > 0 &&
        intersection.points.every((point) =>
          segments.length === 2
            ? (point.leftLocation === "start" &&
                point.rightLocation === "end") ||
              (point.leftLocation === "end" && point.rightLocation === "start")
            : leftIndex === 0 && rightIndex === segments.length - 1
              ? point.leftLocation === "start" && point.rightLocation === "end"
              : point.leftLocation === "end" && point.rightLocation === "start"
        );
      if (
        intersection.overlap ||
        (intersection.points.length > 0 && !allowedJoin)
      ) {
        diagnostics.push(
          diagnostic(
            "SKETCH_REGION_LOOP_INTERSECTION",
            `Discovery loop entities ${segments[leftIndex]!.entityId} and ${segments[rightIndex]!.entityId} intersect or overlap away from a shared join.`,
            sketchId,
            { entityId: segments[leftIndex]!.entityId }
          )
        );
      }
    }
  }
  const area = Math.abs(getSketchWireSignedArea(segments));
  if (
    !Number.isFinite(area) ||
    area < SKETCH_GEOMETRY_POLICY.minimumProfileArea
  ) {
    diagnostics.push(
      diagnostic(
        "SKETCH_REGION_LOOP_AREA_TOO_SMALL",
        "Discovery loop is below the shared minimum profile area.",
        sketchId,
        {
          expected: `>= ${SKETCH_GEOMETRY_POLICY.minimumProfileArea}`,
          received: String(area)
        }
      )
    );
  }
  return diagnostics;
}

function componentDiagnostic(
  sketchId: string,
  component: DiscoveryComponent
): SketchRegionDiagnostic {
  const branched = component.vertices.some((vertex) => vertex.length > 2);
  return diagnostic(
    branched ? "SKETCH_REGION_LOOP_INTERSECTION" : "SKETCH_REGION_LOOP_OPEN",
    branched
      ? "Connected discovery component contains a branch and cannot define one whole loop."
      : "Connected discovery component is open and cannot define one whole loop.",
    sketchId,
    { entityId: component.entities[0]?.entity.id }
  );
}

function issueDiagnostic(
  sketchId: string,
  issue: V22RegionSourceIssue
): SketchRegionDiagnostic {
  return diagnostic(issue.code, issue.message, sketchId, {
    ...(issue.entityId === undefined ? {} : { entityId: issue.entityId }),
    ...(issue.loopKey === undefined ? {} : { loopKey: issue.loopKey }),
    ...(issue.expected === undefined ? {} : { expected: issue.expected }),
    ...(issue.received === undefined ? {} : { received: issue.received })
  });
}

function candidateKey(
  loop: V22RegionDiscoveryAnalyzedLoop,
  holeLoopKeys: readonly string[]
): string {
  return JSON.stringify([
    "region",
    loop.containmentDepth,
    loop.outerLoopKey,
    holeLoopKeys
  ]);
}

function complexityResponse(
  regionCount: number,
  loopCount: number,
  segmentReferenceCount: number,
  predicateVisitCount: number
): SketchProfileRegionCandidatesQueryResponse["complexity"] {
  return {
    regionCount,
    loopCount,
    segmentReferenceCount,
    predicateVisitCount
  };
}

function blockedResponse(
  query: SketchProfileRegionCandidatesQuery,
  cadOpsVersion: CadOpsVersion,
  identities: ReturnType<typeof createSketchRegionSourceIdentities>,
  diagnostics: readonly SketchRegionDiagnostic[],
  complexity: SketchProfileRegionCandidatesQueryResponse["complexity"],
  candidateCount = 0
): SketchProfileRegionCandidatesQueryResponse {
  return {
    ok: true,
    query: "sketch.profileRegionCandidates",
    cadOpsVersion,
    sketchId: query.sketchId,
    status: "blocked",
    sourceRevision: identities.sourceRevision,
    sourceFingerprint: identities.sourceFingerprint,
    candidateCount,
    candidates: [],
    hasMore: false,
    complexity,
    diagnostics
  };
}

export function createSketchProfileRegionCandidatesResponse(
  sketch: V22RegionSourceSketch,
  query: SketchProfileRegionCandidatesQuery,
  cadOpsVersion: CadOpsVersion
): SketchProfileRegionCandidatesQueryResponse {
  const identities = createSketchRegionSourceIdentities(
    sketch,
    query.entityIds
  );
  if (query.sketchId !== sketch.id) {
    return blockedResponse(
      query,
      cadOpsVersion,
      identities,
      [
        diagnostic(
          "SKETCH_REGION_SKETCH_MISMATCH",
          "Region discovery must execute against the requested sketch scope.",
          sketch.id,
          { expected: query.sketchId, received: sketch.id }
        )
      ],
      complexityResponse(0, 0, 0, 0)
    );
  }
  if (
    query.sourceRevision !== undefined &&
    query.sourceRevision !== identities.sourceRevision
  ) {
    return blockedResponse(
      query,
      cadOpsVersion,
      identities,
      [
        diagnostic(
          "SKETCH_REGION_SOURCE_REVISION_STALE",
          "The region-candidate page revision no longer matches the relevant sketch source and narrowing.",
          sketch.id,
          {
            expected: identities.sourceRevision,
            received: query.sourceRevision,
            recoveryAction: "Restart region discovery from the first page."
          }
        )
      ],
      complexityResponse(0, 0, 0, 0)
    );
  }

  const selection = selectedEntities(
    sketch,
    identities.normalizedEntityIds,
    query.entityIds
  );
  if (
    selection.narrowingInvalid ||
    (query.entityIds?.length ?? 0) >
      CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch ||
    sketch.entities.size >
      CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch
  ) {
    const diagnostics = [...selection.diagnostics];
    if (
      (query.entityIds?.length ?? 0) >
      CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch
    ) {
      diagnostics.push(
        diagnostic(
          "SKETCH_REGION_COMPLEXITY_LIMIT",
          "Region discovery narrowing exceeds the V19 entity limit.",
          sketch.id,
          {
            expected: `<= ${CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch}`,
            received: String(query.entityIds?.length ?? 0)
          }
        )
      );
    }
    if (
      sketch.entities.size >
      CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch
    ) {
      diagnostics.push(
        diagnostic(
          "SKETCH_REGION_COMPLEXITY_LIMIT",
          "Region discovery exceeds the V19 per-sketch entity limit.",
          sketch.id,
          {
            expected: `<= ${CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch}`,
            received: String(sketch.entities.size)
          }
        )
      );
    }
    return blockedResponse(
      query,
      cadOpsVersion,
      identities,
      diagnostics,
      complexityResponse(0, 0, 0, 0)
    );
  }

  const budget = new DiscoveryBudget();
  const diagnostics = [...selection.diagnostics];
  const loops: SketchLoopRef[] = [];
  try {
    const lineArcEntities: DiscoveryEntity[] = [];
    for (const entity of selection.entities) {
      if (entity.kind === "rectangle" || entity.kind === "circle") {
        if (hasFiniteEntityLoopGeometry(entity)) {
          loops.push({ kind: "entity", entityId: entity.id });
        } else {
          diagnostics.push(
            diagnostic(
              "SKETCH_REGION_ENTITY_UNSUPPORTED",
              `Entity ${entity.id} has non-finite, degenerate, or sub-minimum region geometry.`,
              sketch.id,
              { entityId: entity.id }
            )
          );
        }
        continue;
      }
      const resolution = resolveOrientedSketchSegment(
        entity,
        "forward",
        SKETCH_GEOMETRY_POLICY
      );
      if (!resolution.ok) {
        diagnostics.push(
          diagnostic(
            "SKETCH_REGION_ENTITY_UNSUPPORTED",
            resolution.issue.message,
            sketch.id,
            { entityId: entity.id }
          )
        );
        continue;
      }
      lineArcEntities.push({ entity, forward: resolution.segment });
    }
    for (const component of buildComponents(lineArcEntities, budget)) {
      if (
        component.entities.length < 2 ||
        component.vertices.some((vertex) => vertex.length !== 2)
      ) {
        diagnostics.push(componentDiagnostic(sketch.id, component));
        continue;
      }
      const traversal = traverseComponent(component);
      if (!traversal) {
        diagnostics.push(componentDiagnostic(sketch.id, component));
        continue;
      }
      const traversalDiagnostics = validateWireTraversal(
        sketch.id,
        traversal,
        budget
      );
      if (traversalDiagnostics.length > 0) {
        diagnostics.push(...traversalDiagnostics);
        continue;
      }
      loops.push({
        kind: "wire",
        segments: referencesFromSegments(traversal)
      });
    }
  } catch (error) {
    if (!(error instanceof DiscoveryBudgetExceeded)) throw error;
    diagnostics.push(
      diagnostic(
        "SKETCH_REGION_COMPLEXITY_LIMIT",
        "Region discovery exceeded the analytic pair/edge-visit limit while connecting whole entities.",
        sketch.id,
        {
          expected: `<= ${CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits}`,
          received: String(budget.count)
        }
      )
    );
    return blockedResponse(
      query,
      cadOpsVersion,
      identities,
      diagnostics,
      complexityResponse(0, 0, 0, budget.count)
    );
  }

  const analysis = analyzeV22RegionDiscoveryLoops(sketch, loops, budget.count);
  if (!analysis.ok) {
    return blockedResponse(
      query,
      cadOpsVersion,
      identities,
      [
        ...diagnostics,
        ...analysis.issues.map((issue) => issueDiagnostic(sketch.id, issue))
      ],
      complexityResponse(
        analysis.complexity.regionCount,
        analysis.complexity.loopCount,
        analysis.complexity.segmentReferenceCount,
        analysis.complexity.predicateVisitCount
      )
    );
  }

  const conflictsByLoop = new Map<number, SketchRegionDiagnostic[]>();
  for (const conflict of analysis.boundaryConflicts) {
    const left = analysis.loops[conflict.leftLoopIndex]!;
    const right = analysis.loops[conflict.rightLoopIndex]!;
    const conflictDiagnostic = diagnostic(
      "SKETCH_REGION_BOUNDARY_TOUCHING",
      `Discovered whole loops ${left.outerLoopKey} and ${right.outerLoopKey} touch, cross, or overlap within the shared linear tolerance.`,
      sketch.id,
      {
        loopKey: left.outerLoopKey,
        expected: `> ${SKETCH_GEOMETRY_POLICY.linearTolerance}`,
        received: String(conflict.separation)
      }
    );
    for (const loopIndex of [conflict.leftLoopIndex, conflict.rightLoopIndex]) {
      const values = conflictsByLoop.get(loopIndex) ?? [];
      values.push(conflictDiagnostic);
      conflictsByLoop.set(loopIndex, values);
    }
  }
  const candidates = analysis.loops.map(
    (loop, loopIndex): SketchProfileRegionCandidate => {
      const childIndexes = [...loop.directChildIndexes].sort((left, right) =>
        compareIds(
          analysis.loops[left]!.holeLoopKey,
          analysis.loops[right]!.holeLoopKey
        )
      );
      const children = childIndexes.map(
        (childIndex) => analysis.loops[childIndex]!
      );
      const holeLoopKeys = children.map((child) => child.holeLoopKey);
      const materialArea =
        loop.absoluteArea -
        children.reduce((sum, child) => sum + child.absoluteArea, 0);
      const candidateDiagnostics = [
        ...(conflictsByLoop.get(loopIndex) ?? []),
        ...childIndexes.flatMap(
          (childIndex) => conflictsByLoop.get(childIndex) ?? []
        )
      ];
      if (
        !Number.isFinite(materialArea) ||
        materialArea < SKETCH_GEOMETRY_POLICY.minimumProfileArea
      ) {
        candidateDiagnostics.push(
          diagnostic(
            "SKETCH_REGION_LOOP_AREA_TOO_SMALL",
            "Discovered cell material area is below the shared minimum profile area.",
            sketch.id,
            {
              loopKey: loop.outerLoopKey,
              expected: `>= ${SKETCH_GEOMETRY_POLICY.minimumProfileArea}`,
              received: String(materialArea)
            }
          )
        );
      }
      return {
        candidateKey: candidateKey(loop, holeLoopKeys),
        region: {
          outer: loop.outer,
          holes: children.map((child) => child.hole)
        },
        outerLoopKey: loop.outerLoopKey,
        holeLoopKeys,
        outerEntityIds: loop.entityIds,
        holeEntityIds: children.map((child) => child.entityIds),
        signedArea: loop.signedArea,
        materialArea,
        containmentDepth: loop.containmentDepth,
        status: candidateDiagnostics.length === 0 ? "valid" : "invalid",
        diagnostics: candidateDiagnostics
      };
    }
  );
  candidates.sort(
    (left, right) =>
      left.containmentDepth - right.containmentDepth ||
      right.materialArea - left.materialArea ||
      compareIds(left.outerLoopKey, right.outerLoopKey)
  );

  if (candidates.length === 0) {
    diagnostics.push(
      diagnostic(
        "SKETCH_REGION_PROFILE_EMPTY",
        "No complete material-region loop candidates were discovered.",
        sketch.id
      )
    );
  }
  const afterIndex =
    query.afterCandidateKey === undefined
      ? -1
      : candidates.findIndex(
          (candidate) => candidate.candidateKey === query.afterCandidateKey
        );
  if (query.afterCandidateKey !== undefined && afterIndex < 0) {
    return blockedResponse(
      query,
      cadOpsVersion,
      identities,
      [
        ...diagnostics,
        diagnostic(
          "SKETCH_REGION_CURSOR_INVALID",
          "The candidate cursor does not exist in the current canonical result.",
          sketch.id,
          {
            received: query.afterCandidateKey,
            recoveryAction: "Restart region discovery from the first page."
          }
        )
      ],
      complexityResponse(
        candidates.length,
        analysis.complexity.loopCount,
        analysis.complexity.segmentReferenceCount,
        analysis.complexity.predicateVisitCount
      ),
      candidates.length
    );
  }
  const limit =
    query.limit ?? CAD_V19_RESOURCE_LIMITS.maxRegionCandidatesPerPage;
  const page = candidates.slice(afterIndex + 1, afterIndex + 1 + limit);
  const hasMore = afterIndex + 1 + page.length < candidates.length;
  const responseDiagnostics = [
    ...diagnostics,
    ...analysis.boundaryConflicts.flatMap((conflict) => [
      ...(conflictsByLoop.get(conflict.leftLoopIndex) ?? [])
    ])
  ];
  return {
    ok: true,
    query: "sketch.profileRegionCandidates",
    cadOpsVersion,
    sketchId: query.sketchId,
    status: candidates.some((candidate) => candidate.status === "valid")
      ? "ready"
      : "blocked",
    sourceRevision: identities.sourceRevision,
    sourceFingerprint: identities.sourceFingerprint,
    candidateCount: candidates.length,
    candidates: page,
    hasMore,
    ...(hasMore && page.length > 0
      ? { nextAfterCandidateKey: page.at(-1)!.candidateKey }
      : {}),
    complexity: complexityResponse(
      candidates.length,
      analysis.complexity.loopCount,
      analysis.complexity.segmentReferenceCount,
      analysis.complexity.predicateVisitCount
    ),
    diagnostics: responseDiagnostics
  };
}

export function createRegionCandidateKeyForSimpleProfile(
  profile: SketchLoopRef
): string {
  return JSON.stringify(["region", 0, getSketchLoopCanonicalKey(profile), []]);
}
