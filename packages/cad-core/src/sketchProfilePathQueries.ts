import type {
  CadOpsVersion,
  CadTopologyIdentitySourceSnapshot,
  FeatureId,
  OrientedSketchSegmentRef,
  SketchConstructionExclusion,
  SketchConsumerCompatibility,
  SketchEntityId,
  SketchPathCandidate,
  SketchPathCandidatesQueryResponse,
  SketchPathDiagnostic,
  SketchPathJoinHealth,
  SketchPathReadinessQuery,
  SketchPathReadinessQueryResponse,
  SketchPathRef,
  SketchPathRejectedComponent,
  SketchProfileCandidate,
  SketchProfileCandidatesQueryResponse,
  SketchProfileConsumerIntent,
  SketchProfileDiagnostic,
  SketchProfileJoinHealth,
  SketchProfileReadinessQuery,
  SketchProfileReadinessQueryResponse,
  SketchProfileTargetCompatibility,
  SketchProfileRef,
  SketchWireProfileRef,
  SketchProfileRejectedComponent,
  SketchReferenceDependencies,
  SketchSegmentOrientation,
  SketchBounds2d,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

import type { CadDocument, Sketch } from "./index";
import {
  createSupportedBooleanBodyTargetOperations,
  type BooleanTargetSupportFeature
} from "./booleanTargetSupport";
import { isPrimitiveBodyId } from "./primitiveBodyIdentity";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";
import {
  areSketchPointsCoincident,
  areSketchTangentsG1,
  getSketchSegmentEndpointTangent,
  getSketchWireSignedArea,
  intersectSketchSegments,
  mergeSketchSegmentBounds,
  normalizeSketchWireCounterClockwise,
  resolveOrientedSketchSegment,
  reverseSketchSegmentTraversal,
  type ResolvedSketchSegment,
  type SketchWireEntity
} from "./sketchWireGeometry";
import {
  createSourceMeasurementFrame,
  mapSketchPointToSourceMeasurementFrame
} from "./sourceMeasurementGeometry";
import {
  resolveActiveTopologyAnchorBodyTargetId,
  resolveActiveTopologyAnchorTargetSource
} from "./topologyAnchorTargetResolution";

interface ResolvedWire {
  readonly segments: readonly ResolvedSketchSegment[];
  readonly joins: readonly SketchProfileJoinHealth[];
  readonly diagnostics: readonly SketchProfileDiagnostic[];
  readonly intersectionStatus:
    | "clear"
    | "self-intersecting"
    | "overlapping"
    | "not-evaluated";
  readonly closed: boolean;
  readonly area?: number;
  readonly signedArea?: number;
  readonly bounds?: SketchBounds2d;
}

interface ResolvedPath {
  readonly segments: readonly ResolvedSketchSegment[];
  readonly joins: readonly SketchPathJoinHealth[];
  readonly diagnostics: readonly SketchPathDiagnostic[];
  readonly connectionStatus: "connected" | "disconnected" | "branching";
  readonly tangentStatus: "tangent" | "not-tangent" | "not-evaluated";
  readonly selfIntersectionStatus:
    | "clear"
    | "self-intersecting"
    | "not-evaluated";
  readonly length?: number;
  readonly bounds?: SketchBounds2d;
}

interface EndpointRef {
  readonly entityId: SketchEntityId;
  readonly endpoint: "start" | "end";
  readonly point: Vec2;
}

interface EntityComponent {
  readonly entities: readonly SketchWireEntity[];
  readonly vertices: readonly (readonly EndpointRef[])[];
}

const DEFAULT_PART_ID = "part:default";
const LINEAR_TOLERANCE = SKETCH_GEOMETRY_POLICY.linearTolerance;

export interface SketchProfileReadinessDocument {
  readonly sketches: ReadonlyMap<SketchId, Sketch>;
  readonly features: ReadonlyMap<FeatureId, BooleanTargetSupportFeature>;
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function profileDiagnostic(
  code: SketchProfileDiagnostic["code"],
  message: string,
  details: Omit<SketchProfileDiagnostic, "code" | "severity" | "message"> = {}
): SketchProfileDiagnostic {
  return { code, severity: "blocker", message, ...details };
}

function pathDiagnostic(
  code: SketchPathDiagnostic["code"],
  message: string,
  details: Omit<SketchPathDiagnostic, "code" | "severity" | "message"> = {}
): SketchPathDiagnostic {
  return { code, severity: "blocker", message, ...details };
}

function createEntityProfileBounds(
  entity: Extract<
    ReturnType<Sketch["entities"]["get"]>,
    { readonly kind: "rectangle" | "circle" }
  >
): SketchBounds2d {
  if (entity.kind === "circle") {
    return {
      min: [entity.center[0] - entity.radius, entity.center[1] - entity.radius],
      max: [entity.center[0] + entity.radius, entity.center[1] + entity.radius]
    };
  }
  return {
    min: [
      entity.center[0] - entity.width / 2,
      entity.center[1] - entity.height / 2
    ],
    max: [
      entity.center[0] + entity.width / 2,
      entity.center[1] + entity.height / 2
    ]
  };
}

function createJoin(
  left: ResolvedSketchSegment,
  right: ResolvedSketchSegment,
  joinIndex: number
): SketchProfileJoinHealth {
  const gapDistance = distance(left.end, right.start);
  return {
    joinIndex,
    primaryEntityId: left.entityId,
    secondaryEntityId: right.entityId,
    connectionStatus:
      gapDistance === 0
        ? "exact"
        : gapDistance <= LINEAR_TOLERANCE
          ? "within-tolerance"
          : "disconnected",
    coincidentWithinTolerance:
      gapDistance > 0 && gapDistance <= LINEAR_TOLERANCE,
    gapDistance
  };
}

function resolveWire(
  sketch: Sketch,
  references: readonly OrientedSketchSegmentRef[]
): ResolvedWire {
  const diagnostics: SketchProfileDiagnostic[] = [];
  const seen = new Set<string>();
  const segments: ResolvedSketchSegment[] = [];

  if (references.length < 2) {
    diagnostics.push(
      profileDiagnostic(
        "SKETCH_PROFILE_EMPTY",
        "A wire profile requires at least two oriented segments.",
        { sketchId: sketch.id }
      )
    );
  }

  references.forEach((reference, segmentIndex) => {
    if (seen.has(reference.entityId)) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_ENTITY_REPEATED",
          `Profile entity occurs more than once: ${reference.entityId}.`,
          { sketchId: sketch.id, entityId: reference.entityId, segmentIndex }
        )
      );
      return;
    }
    seen.add(reference.entityId);
    const entity = sketch.entities.get(reference.entityId);
    if (!entity) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_ENTITY_MISSING",
          `Profile entity does not exist on sketch ${sketch.id}: ${reference.entityId}.`,
          { sketchId: sketch.id, entityId: reference.entityId, segmentIndex }
        )
      );
      return;
    }
    if (entity.kind !== "line" && entity.kind !== "arc") {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_ENTITY_UNSUPPORTED",
          `Wire profiles support only line and arc entities, not ${entity.kind}.`,
          { sketchId: sketch.id, entityId: entity.id, segmentIndex }
        )
      );
      return;
    }
    if (entity.construction) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
          `Construction entity cannot define a solid profile: ${entity.id}.`,
          { sketchId: sketch.id, entityId: entity.id, segmentIndex }
        )
      );
      return;
    }
    const resolution = resolveOrientedSketchSegment(
      entity,
      reference.orientation
    );
    if (!resolution.ok) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_ENTITY_UNSUPPORTED",
          resolution.issue.message,
          { sketchId: sketch.id, entityId: entity.id, segmentIndex }
        )
      );
      return;
    }
    segments.push(resolution.segment);
  });

  if (segments.length !== references.length || segments.length < 2) {
    return {
      segments,
      joins: [],
      diagnostics,
      intersectionStatus: "not-evaluated",
      closed: false,
      bounds: mergeSketchSegmentBounds(segments)
    };
  }

  const joins = segments.map((segment, index) =>
    createJoin(segment, segments[(index + 1) % segments.length]!, index)
  );
  const disconnected = joins.filter(
    (join) => join.connectionStatus === "disconnected"
  );
  for (const join of disconnected) {
    diagnostics.push(
      profileDiagnostic(
        join.joinIndex === joins.length - 1
          ? "SKETCH_PROFILE_OPEN"
          : "SKETCH_PROFILE_DISCONNECTED",
        `Profile join ${join.joinIndex} exceeds the shared linear tolerance.`,
        { sketchId: sketch.id, joinIndex: join.joinIndex }
      )
    );
  }

  let intersectionStatus: ResolvedWire["intersectionStatus"] = "clear";
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex += 1
    ) {
      const left = segments[leftIndex]!;
      const right = segments[rightIndex]!;
      const intersection = intersectSketchSegments(left, right);
      const adjacent =
        rightIndex === leftIndex + 1 ||
        (leftIndex === 0 && rightIndex === segments.length - 1);
      const allowedEndpoint = adjacent
        ? segments.length === 2
          ? intersection.points.every(
              (point) =>
                (point.leftLocation === "start" &&
                  point.rightLocation === "end") ||
                (point.leftLocation === "end" &&
                  point.rightLocation === "start")
            )
          : leftIndex === 0 && rightIndex === segments.length - 1
            ? intersection.points.every(
                (point) =>
                  point.leftLocation === "start" &&
                  point.rightLocation === "end"
              )
            : intersection.points.every(
                (point) =>
                  point.leftLocation === "end" &&
                  point.rightLocation === "start"
              )
        : false;
      if (intersection.overlap) {
        intersectionStatus = "overlapping";
        diagnostics.push(
          profileDiagnostic(
            "SKETCH_PROFILE_OVERLAPPING",
            `Profile entities overlap: ${left.entityId} and ${right.entityId}.`,
            {
              sketchId: sketch.id,
              entityId: left.entityId,
              segmentIndex: leftIndex
            }
          )
        );
      } else if (
        intersection.points.length > 0 &&
        (!adjacent || !allowedEndpoint)
      ) {
        if (intersectionStatus !== "overlapping")
          intersectionStatus = "self-intersecting";
        diagnostics.push(
          profileDiagnostic(
            "SKETCH_PROFILE_SELF_INTERSECTING",
            `Profile entities intersect away from their shared join: ${left.entityId} and ${right.entityId}.`,
            {
              sketchId: sketch.id,
              entityId: left.entityId,
              segmentIndex: leftIndex
            }
          )
        );
      }
    }
  }

  const signedArea = getSketchWireSignedArea(segments);
  const area = Math.abs(signedArea);
  if (!Number.isFinite(signedArea)) {
    diagnostics.push(
      profileDiagnostic(
        "SKETCH_PROFILE_ENTITY_UNSUPPORTED",
        "Profile signed-area evaluation produced a non-finite result.",
        { sketchId: sketch.id }
      )
    );
  } else if (area < SKETCH_GEOMETRY_POLICY.minimumProfileArea) {
    diagnostics.push(
      profileDiagnostic(
        "SKETCH_PROFILE_AREA_TOO_SMALL",
        "Profile area is below the shared minimum profile area.",
        {
          sketchId: sketch.id,
          expected: `>= ${SKETCH_GEOMETRY_POLICY.minimumProfileArea}`,
          received: String(area)
        }
      )
    );
  }

  return {
    segments,
    joins,
    diagnostics,
    intersectionStatus,
    closed: disconnected.length === 0,
    ...(Number.isFinite(area) ? { area, signedArea } : {}),
    bounds: mergeSketchSegmentBounds(segments)
  };
}

function resolvePath(sketch: Sketch, path: SketchPathRef): ResolvedPath {
  const references: readonly OrientedSketchSegmentRef[] =
    path.kind === "entity"
      ? [{ entityId: path.entityId, orientation: path.orientation }]
      : path.segments;
  const diagnostics: SketchPathDiagnostic[] = [];
  const segments: ResolvedSketchSegment[] = [];
  const seen = new Set<string>();

  if (path.kind === "chain" && references.length < 2) {
    diagnostics.push(
      pathDiagnostic(
        "SKETCH_PATH_EMPTY",
        "A path chain requires at least two segments.",
        {
          sketchId: sketch.id
        }
      )
    );
  }

  references.forEach((reference, segmentIndex) => {
    if (seen.has(reference.entityId)) {
      diagnostics.push(
        pathDiagnostic(
          "SKETCH_PATH_ENTITY_REPEATED",
          `Path entity occurs more than once: ${reference.entityId}.`,
          { sketchId: sketch.id, entityId: reference.entityId, segmentIndex }
        )
      );
      return;
    }
    seen.add(reference.entityId);
    const entity = sketch.entities.get(reference.entityId);
    if (!entity) {
      diagnostics.push(
        pathDiagnostic(
          "SKETCH_PATH_ENTITY_MISSING",
          `Path entity does not exist on sketch ${sketch.id}: ${reference.entityId}.`,
          { sketchId: sketch.id, entityId: reference.entityId, segmentIndex }
        )
      );
      return;
    }
    if (entity.kind !== "line" && entity.kind !== "arc") {
      diagnostics.push(
        pathDiagnostic(
          "SKETCH_PATH_ENTITY_UNSUPPORTED",
          `Sweep paths support only line and arc entities, not ${entity.kind}.`,
          { sketchId: sketch.id, entityId: entity.id, segmentIndex }
        )
      );
      return;
    }
    const resolution = resolveOrientedSketchSegment(
      entity,
      reference.orientation
    );
    if (!resolution.ok) {
      diagnostics.push(
        pathDiagnostic(
          "SKETCH_PATH_ENTITY_UNSUPPORTED",
          resolution.issue.message,
          {
            sketchId: sketch.id,
            entityId: entity.id,
            segmentIndex
          }
        )
      );
      return;
    }
    segments.push(resolution.segment);
  });

  if (segments.length !== references.length || segments.length === 0) {
    return {
      segments,
      joins: [],
      diagnostics,
      connectionStatus: "disconnected",
      tangentStatus: "not-evaluated",
      selfIntersectionStatus: "not-evaluated",
      bounds: mergeSketchSegmentBounds(segments)
    };
  }

  const joins: SketchPathJoinHealth[] = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    const left = segments[index]!;
    const right = segments[index + 1]!;
    const connection = createJoin(left, right, index);
    const outgoing = getSketchSegmentEndpointTangent(left, "end");
    const incoming = getSketchSegmentEndpointTangent(right, "start");
    const cosine = Math.max(
      -1,
      Math.min(1, outgoing[0] * incoming[0] + outgoing[1] * incoming[1])
    );
    const angularDeviationDegrees = (Math.acos(cosine) * 180) / Math.PI;
    joins.push({
      ...connection,
      tangentStatus:
        connection.connectionStatus === "disconnected"
          ? "not-evaluated"
          : areSketchTangentsG1(outgoing, incoming)
            ? "tangent"
            : "not-tangent",
      ...(connection.connectionStatus === "disconnected"
        ? {}
        : { angularDeviationDegrees })
    });
  }

  for (const join of joins) {
    if (join.connectionStatus === "disconnected") {
      diagnostics.push(
        pathDiagnostic(
          "SKETCH_PATH_DISCONNECTED",
          `Path join ${join.joinIndex} exceeds the shared linear tolerance.`,
          { sketchId: sketch.id, joinIndex: join.joinIndex }
        )
      );
    } else if (join.tangentStatus === "not-tangent") {
      diagnostics.push(
        pathDiagnostic(
          "SKETCH_PATH_JOIN_NOT_TANGENT",
          `Path join ${join.joinIndex} is not G1 within the shared angular tolerance.`,
          { sketchId: sketch.id, joinIndex: join.joinIndex }
        )
      );
    }
  }

  if (
    segments.length > 1 &&
    areSketchPointsCoincident(segments[0]!.start, segments.at(-1)!.end)
  ) {
    diagnostics.push(
      pathDiagnostic(
        "SKETCH_PATH_CLOSED_UNSUPPORTED",
        "Closed sweep paths are not supported in V17.",
        { sketchId: sketch.id }
      )
    );
  }

  let selfIntersectionStatus: ResolvedPath["selfIntersectionStatus"] = "clear";
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex += 1
    ) {
      const adjacent = rightIndex === leftIndex + 1;
      const intersection = intersectSketchSegments(
        segments[leftIndex]!,
        segments[rightIndex]!
      );
      const onlySharedEndpoint =
        adjacent &&
        intersection.points.every(
          (point) =>
            point.leftLocation === "end" && point.rightLocation === "start"
        );
      if (
        intersection.overlap ||
        (intersection.points.length > 0 && (!adjacent || !onlySharedEndpoint))
      ) {
        selfIntersectionStatus = "self-intersecting";
        diagnostics.push(
          pathDiagnostic(
            "SKETCH_PATH_SELF_INTERSECTING",
            `Path entities self-intersect: ${segments[leftIndex]!.entityId} and ${segments[rightIndex]!.entityId}.`,
            {
              sketchId: sketch.id,
              entityId: segments[leftIndex]!.entityId,
              segmentIndex: leftIndex
            }
          )
        );
      }
    }
  }

  return {
    segments,
    joins,
    diagnostics,
    connectionStatus: joins.some(
      (join) => join.connectionStatus === "disconnected"
    )
      ? "disconnected"
      : "connected",
    tangentStatus: joins.some((join) => join.tangentStatus === "not-tangent")
      ? "not-tangent"
      : joins.some((join) => join.tangentStatus === "not-evaluated")
        ? "not-evaluated"
        : "tangent",
    selfIntersectionStatus,
    length: segments.reduce((total, segment) => {
      return (
        total +
        (segment.kind === "line"
          ? distance(segment.start, segment.end)
          : segment.radius * Math.abs(segment.sweepAngleRadians))
      );
    }, 0),
    bounds: mergeSketchSegmentBounds(segments)
  };
}

function buildComponents(
  entities: readonly SketchWireEntity[]
): readonly EntityComponent[] {
  const endpoints: EndpointRef[] = [];
  const validEntities: SketchWireEntity[] = [];
  for (const entity of [...entities].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const resolved = resolveOrientedSketchSegment(entity, "forward");
    if (!resolved.ok) continue;
    validEntities.push(entity);
    endpoints.push(
      { entityId: entity.id, endpoint: "start", point: resolved.segment.start },
      { entityId: entity.id, endpoint: "end", point: resolved.segment.end }
    );
  }

  const parents = endpoints.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parents[current] !== current) current = parents[current]!;
    while (parents[index] !== index) {
      const next = parents[index]!;
      parents[index] = current;
      index = next;
    }
    return current;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      if (
        areSketchPointsCoincident(
          endpoints[left]!.point,
          endpoints[right]!.point
        )
      ) {
        union(left, right);
      }
    }
  }

  const verticesByRoot = new Map<number, EndpointRef[]>();
  endpoints.forEach((endpoint, index) => {
    const group = verticesByRoot.get(find(index)) ?? [];
    group.push(endpoint);
    verticesByRoot.set(find(index), group);
  });
  const entityNeighbors = new Map<string, Set<string>>();
  for (const entity of validEntities) entityNeighbors.set(entity.id, new Set());
  for (const vertex of verticesByRoot.values()) {
    for (const left of vertex) {
      for (const right of vertex) {
        if (left.entityId !== right.entityId)
          entityNeighbors.get(left.entityId)!.add(right.entityId);
      }
    }
  }

  const byId = new Map(validEntities.map((entity) => [entity.id, entity]));
  const remaining = new Set(validEntities.map((entity) => entity.id));
  const components: EntityComponent[] = [];
  while (remaining.size > 0) {
    const start = [...remaining].sort()[0]!;
    const queue = [start];
    const ids: string[] = [];
    remaining.delete(start);
    while (queue.length > 0) {
      const id = queue.shift()!;
      ids.push(id);
      for (const neighbor of [...(entityNeighbors.get(id) ?? [])].sort()) {
        if (remaining.delete(neighbor)) queue.push(neighbor);
      }
    }
    const idSet = new Set(ids);
    components.push({
      entities: ids.sort().map((id) => byId.get(id)!),
      vertices: [...verticesByRoot.values()].filter((vertex) =>
        vertex.some((endpoint) => idSet.has(endpoint.entityId))
      )
    });
  }
  return components;
}

function traverseComponent(
  component: EntityComponent,
  closed: boolean
): readonly ResolvedSketchSegment[] | undefined {
  const endpointVertex = new Map<string, number>();
  component.vertices.forEach((vertex, vertexIndex) => {
    for (const endpoint of vertex)
      endpointVertex.set(
        `${endpoint.entityId}:${endpoint.endpoint}`,
        vertexIndex
      );
  });
  const degreeOneEntities = component.vertices
    .filter((vertex) => vertex.length === 1)
    .map((vertex) => vertex[0]!.entityId)
    .sort();
  const startId = closed ? component.entities[0]!.id : degreeOneEntities[0];
  if (!startId) return undefined;
  const byId = new Map(component.entities.map((entity) => [entity.id, entity]));

  for (const firstOrientation of ["forward", "reverse"] as const) {
    const used = new Set<string>();
    const ordered: ResolvedSketchSegment[] = [];
    let entityId: string | undefined = startId;
    let orientation: SketchSegmentOrientation = firstOrientation;
    while (entityId && !used.has(entityId)) {
      const entity = byId.get(entityId)!;
      const resolved = resolveOrientedSketchSegment(entity, orientation);
      if (!resolved.ok) break;
      ordered.push(resolved.segment);
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
    if (ordered.length === component.entities.length) {
      if (
        !closed ||
        areSketchPointsCoincident(ordered.at(-1)!.end, ordered[0]!.start)
      ) {
        return ordered;
      }
    }
  }
  return undefined;
}

function refsFromSegments(
  segments: readonly ResolvedSketchSegment[]
): readonly OrientedSketchSegmentRef[] {
  return segments.map((segment) => ({
    entityId: segment.entityId,
    orientation: segment.orientation
  }));
}

function dependencies(
  sketchId: string,
  segments: readonly ResolvedSketchSegment[]
): SketchReferenceDependencies {
  return {
    sketchIds: [sketchId],
    orderedEntityIds: segments.map((segment) => segment.entityId)
  };
}

function componentSortKey(component: EntityComponent): string {
  return component.entities
    .map((entity) => entity.id)
    .sort()
    .join("|");
}

function rejectedProfileComponent(
  sketch: Sketch,
  component: EntityComponent,
  componentIndex: number,
  extraDiagnostics: readonly SketchProfileDiagnostic[] = []
): SketchProfileRejectedComponent {
  const degrees = component.vertices.map((vertex) => vertex.length);
  const closed = degrees.length > 0 && degrees.every((degree) => degree === 2);
  const traversal = closed ? traverseComponent(component, true) : undefined;
  const wire = traversal
    ? resolveWire(sketch, refsFromSegments(traversal))
    : undefined;
  const diagnostics = [...(wire?.diagnostics ?? []), ...extraDiagnostics];
  if (degrees.some((degree) => degree > 2)) {
    diagnostics.push(
      profileDiagnostic(
        "SKETCH_PROFILE_BRANCHING",
        "Connected profile component contains a branch vertex.",
        {
          sketchId: sketch.id
        }
      )
    );
  } else if (!closed) {
    diagnostics.push(
      profileDiagnostic(
        "SKETCH_PROFILE_OPEN",
        "Connected profile component is not a closed loop.",
        {
          sketchId: sketch.id
        }
      )
    );
  }
  return {
    status: "blocked",
    componentIndex,
    sortKey: componentSortKey(component),
    sketchId: sketch.id,
    entityIds: component.entities.map((entity) => entity.id),
    ...(wire?.bounds ? { bounds: wire.bounds } : {}),
    closed,
    branchFree: degrees.every((degree) => degree <= 2),
    intersectionStatus: wire?.intersectionStatus ?? "not-evaluated",
    ...(wire?.area === undefined ? {} : { area: wire.area }),
    joinCount: wire?.joins.length ?? 0,
    joins: wire?.joins ?? [],
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createEntityProfileCandidate(
  sketch: Sketch,
  entity: Extract<
    ReturnType<Sketch["entities"]["get"]>,
    { readonly kind: "rectangle" | "circle" }
  >,
  candidateIndex: number
): SketchProfileCandidate {
  const area =
    entity.kind === "circle"
      ? Math.PI * entity.radius * entity.radius
      : entity.width * entity.height;
  const profile: SketchProfileRef = {
    kind: "entity",
    sketchId: sketch.id,
    entityId: entity.id
  };
  return {
    status: "ready",
    candidateIndex,
    sortKey: entity.id,
    profile,
    orientation: "counterclockwise",
    area,
    signedArea: area,
    bounds: createEntityProfileBounds(entity),
    joinCount: 0,
    joins: [],
    intersectionStatus: "clear",
    dependencies: { sketchIds: [sketch.id], orderedEntityIds: [entity.id] },
    diagnosticCount: 0,
    diagnostics: []
  };
}

function createRejectedEntityProfile(
  sketch: Sketch,
  entity: Extract<
    ReturnType<Sketch["entities"]["get"]>,
    { readonly kind: "rectangle" | "circle" }
  >,
  componentIndex: number,
  area: number
): SketchProfileRejectedComponent {
  const diagnostic = profileDiagnostic(
    Number.isFinite(area)
      ? "SKETCH_PROFILE_AREA_TOO_SMALL"
      : "SKETCH_PROFILE_ENTITY_UNSUPPORTED",
    Number.isFinite(area)
      ? "Entity profile area is below the shared minimum profile area."
      : "Entity profile area evaluation produced a non-finite result.",
    { sketchId: sketch.id, entityId: entity.id, received: String(area) }
  );
  return {
    status: "blocked",
    componentIndex,
    sortKey: entity.id,
    sketchId: sketch.id,
    entityIds: [entity.id],
    bounds: createEntityProfileBounds(entity),
    closed: true,
    branchFree: true,
    intersectionStatus: "not-evaluated",
    ...(Number.isFinite(area) ? { area } : {}),
    joinCount: 0,
    joins: [],
    diagnosticCount: 1,
    diagnostics: [diagnostic]
  };
}

export function createSketchProfileCandidatesResponse(
  sketch: Sketch,
  cadOpsVersion: CadOpsVersion
): SketchProfileCandidatesQueryResponse {
  const candidates: SketchProfileCandidate[] = [];
  const rejectedComponents: SketchProfileRejectedComponent[] = [];
  const constructionExclusions: SketchConstructionExclusion[] = [];
  const wireEntities: SketchWireEntity[] = [];

  for (const entity of [...sketch.entities.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    if (
      entity.construction &&
      ["rectangle", "circle", "line", "arc"].includes(entity.kind)
    ) {
      constructionExclusions.push({
        entityId: entity.id,
        entityKind: entity.kind as SketchConstructionExclusion["entityKind"],
        diagnostic: profileDiagnostic(
          "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
          `Construction entity is excluded from automatic profile discovery: ${entity.id}.`,
          { sketchId: sketch.id, entityId: entity.id }
        )
      });
      continue;
    }
    if (entity.kind === "rectangle" || entity.kind === "circle") {
      const candidate = createEntityProfileCandidate(sketch, entity, 0);
      if (
        Number.isFinite(candidate.area) &&
        candidate.area >= SKETCH_GEOMETRY_POLICY.minimumProfileArea
      ) {
        candidates.push(candidate);
      } else {
        rejectedComponents.push(
          createRejectedEntityProfile(
            sketch,
            entity,
            rejectedComponents.length,
            candidate.area
          )
        );
      }
    } else if (entity.kind === "line" || entity.kind === "arc") {
      wireEntities.push(entity);
    }
  }

  const readyWireCandidates: SketchProfileCandidate[] = [];
  const components = buildComponents(wireEntities);
  for (const component of components) {
    const degrees = component.vertices.map((vertex) => vertex.length);
    const closed =
      degrees.length > 0 && degrees.every((degree) => degree === 2);
    const traversal = closed ? traverseComponent(component, true) : undefined;
    if (!traversal) {
      rejectedComponents.push(rejectedProfileComponent(sketch, component, 0));
      continue;
    }
    const wire = resolveWire(sketch, refsFromSegments(traversal));
    if (
      wire.diagnostics.some(
        (diagnostic) => diagnostic.severity === "blocker"
      ) ||
      !wire.bounds ||
      wire.area === undefined
    ) {
      rejectedComponents.push(rejectedProfileComponent(sketch, component, 0));
      continue;
    }
    const normalized = normalizeSketchWireCounterClockwise(traversal);
    const normalizedRefs = refsFromSegments(normalized.segments);
    const normalizedWire = resolveWire(sketch, normalizedRefs);
    const diagnostics: SketchProfileDiagnostic[] = normalized.normalized
      ? [
          {
            code: "SKETCH_PROFILE_ORIENTATION_NORMALIZED",
            severity: "info",
            message: "Candidate traversal was normalized counterclockwise.",
            sketchId: sketch.id
          }
        ]
      : [];
    readyWireCandidates.push({
      status: "ready",
      candidateIndex: 0,
      sortKey: normalized.segments.map((segment) => segment.entityId).join("|"),
      profile: { kind: "wire", sketchId: sketch.id, segments: normalizedRefs },
      orientation: "counterclockwise",
      area: normalizedWire.area!,
      signedArea: normalizedWire.area!,
      bounds: normalizedWire.bounds!,
      joinCount: normalizedWire.joins.length,
      joins: normalizedWire.joins,
      intersectionStatus: "clear",
      dependencies: dependencies(sketch.id, normalized.segments),
      diagnosticCount: diagnostics.length,
      diagnostics
    });
  }

  // Nested loops are not candidates in V17. Bounds containment is only a fast
  // prefilter; the analytic point-in-wire test below is authoritative.
  const nested = new Set<string>();
  for (const inner of readyWireCandidates) {
    for (const outer of readyWireCandidates) {
      if (
        inner === outer ||
        inner.profile.kind !== "wire" ||
        outer.profile.kind !== "wire"
      )
        continue;
      const innerSegments = inner.profile.segments.map((ref) => {
        const entity = sketch.entities.get(ref.entityId) as SketchWireEntity;
        return resolveOrientedSketchSegment(entity, ref.orientation);
      });
      const outerSegments = outer.profile.segments.map((ref) => {
        const entity = sketch.entities.get(ref.entityId) as SketchWireEntity;
        return resolveOrientedSketchSegment(entity, ref.orientation);
      });
      const resolvedInner = innerSegments.flatMap((result) =>
        result.ok ? [result.segment] : []
      );
      const resolvedOuter = outerSegments.flatMap((result) =>
        result.ok ? [result.segment] : []
      );
      if (
        resolvedInner.length !== innerSegments.length ||
        resolvedOuter.length !== outerSegments.length
      ) {
        continue;
      }
      if (pointInsideWire(resolvedInner[0]!.start, resolvedOuter)) {
        nested.add(inner.sortKey);
        nested.add(outer.sortKey);
      }
    }
  }

  for (const candidate of readyWireCandidates) {
    if (nested.has(candidate.sortKey) && candidate.profile.kind === "wire") {
      const component = components.find(
        (value) =>
          componentSortKey(value) ===
          [...candidate.dependencies.orderedEntityIds].sort().join("|")
      );
      if (component) {
        rejectedComponents.push(
          rejectedProfileComponent(sketch, component, 0, [
            profileDiagnostic(
              "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED",
              "Nested or inner profile loops are not supported in V17.",
              { sketchId: sketch.id }
            )
          ])
        );
      }
    } else {
      candidates.push(candidate);
    }
  }

  candidates.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  rejectedComponents.sort((left, right) =>
    left.sortKey.localeCompare(right.sortKey)
  );
  const indexedCandidates = candidates.map((candidate, candidateIndex) => ({
    ...candidate,
    candidateIndex
  }));
  const indexedRejectedComponents = rejectedComponents.map(
    (component, componentIndex) => ({ ...component, componentIndex })
  );
  const diagnostics = rejectedComponents.flatMap(
    (component) => component.diagnostics
  );
  return {
    ok: true as const,
    query: "sketch.profileCandidates",
    cadOpsVersion,
    sketchId: sketch.id,
    status: indexedCandidates.length > 0 ? "ready" : "blocked",
    candidateCount: indexedCandidates.length,
    candidates: indexedCandidates,
    rejectedComponentCount: indexedRejectedComponents.length,
    rejectedComponents: indexedRejectedComponents,
    constructionExclusionCount: constructionExclusions.length,
    constructionExclusions,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function pointInsideWire(
  point: Vec2,
  segments: readonly ResolvedSketchSegment[]
): boolean {
  // Exact winding-angle integration for analytic line and circular-arc pieces.
  let winding = 0;
  for (const segment of segments) {
    if (segment.kind === "line") {
      const start = [
        segment.start[0] - point[0],
        segment.start[1] - point[1]
      ] as Vec2;
      const end = [
        segment.end[0] - point[0],
        segment.end[1] - point[1]
      ] as Vec2;
      winding += Math.atan2(
        start[0] * end[1] - start[1] * end[0],
        start[0] * end[0] + start[1] * end[1]
      );
      continue;
    }
    const centerOffset = [
      segment.center[0] - point[0],
      segment.center[1] - point[1]
    ] as Vec2;
    const startVector = [
      segment.start[0] - point[0],
      segment.start[1] - point[1]
    ] as Vec2;
    const endVector = [
      segment.end[0] - point[0],
      segment.end[1] - point[1]
    ] as Vec2;
    const endpointDelta = Math.atan2(
      startVector[0] * endVector[1] - startVector[1] * endVector[0],
      startVector[0] * endVector[0] + startVector[1] * endVector[1]
    );
    // If the query point lies inside the supporting circle, polar angle follows
    // the authored arc sweep; otherwise the principal endpoint delta is exact.
    winding +=
      Math.hypot(...centerOffset) < segment.radius
        ? segment.sweepAngleRadians
        : endpointDelta;
  }
  return Math.abs(winding) > Math.PI;
}

function createConsumerCompatibility(
  profile: SketchProfileRef,
  consumer: SketchProfileConsumerIntent
): SketchProfileReadinessQueryResponse["consumerCompatibility"] {
  const supported =
    profile.kind === "entity" ||
    consumer.featureKind === "extrude" ||
    consumer.featureKind === "revolve";
  const diagnostics = supported
    ? []
    : [
        profileDiagnostic(
          "SKETCH_PROFILE_CONSUMER_UNSUPPORTED",
          `Wire profiles are not supported by feature.${consumer.featureKind} in V17.`
        )
      ];
  return {
    status: supported ? "ready" : "blocked",
    featureKind: consumer.featureKind,
    operationMode: consumer.operationMode,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createTargetCompatibility(
  document: SketchProfileReadinessDocument,
  consumer: SketchProfileConsumerIntent
): SketchProfileReadinessQueryResponse["targetCompatibility"] {
  if (
    consumer.featureKind !== "extrude" ||
    consumer.operationMode === "newBody"
  ) {
    return { status: "not-applicable", diagnosticCount: 0, diagnostics: [] };
  }
  if (!consumer.targetBodyId && !consumer.targetTopologyAnchorId) {
    const diagnostics = [
      profileDiagnostic(
        "TARGET_BODY_REQUIRED",
        `${consumer.operationMode} readiness requires a target body or body topology anchor.`
      )
    ];
    return {
      status: "missing",
      diagnosticCount: diagnostics.length,
      diagnostics
    };
  }
  const requiredOperation =
    consumer.operationMode === "add"
      ? "feature.extrudeAddTarget"
      : "feature.extrudeCutTarget";

  if (consumer.targetTopologyAnchorId) {
    const anchorResolution = resolveActiveTopologyAnchorTargetSource(
      document.topologyIdentity,
      consumer.targetTopologyAnchorId,
      "body"
    );
    if (!anchorResolution.ok) {
      const issue = anchorResolution.issue;
      const missing =
        issue.code === "invalid-id" || issue.code === "anchor-not-found";
      const stale =
        issue.code === "checkpoint-not-found" || issue.code === "inactive";
      const resolvedBodyId = "bodyId" in issue ? issue.bodyId : undefined;
      const diagnostics = [
        profileDiagnostic(
          missing ? "TOPOLOGY_ANCHOR_NOT_FOUND" : "INVALID_TOPOLOGY_ANCHOR",
          missing
            ? `Topology anchor does not exist: ${consumer.targetTopologyAnchorId}.`
            : `Topology anchor is not an active body target: ${consumer.targetTopologyAnchorId}.`,
          { ...(resolvedBodyId ? { bodyId: resolvedBodyId } : {}) }
        )
      ];
      const responseDetails = {
        targetTopologyAnchorId: consumer.targetTopologyAnchorId,
        diagnosticCount: diagnostics.length,
        diagnostics
      };
      if (missing) return { status: "missing", ...responseDetails };
      if (stale) {
        return {
          status: "stale",
          ...(resolvedBodyId ? { targetBodyId: resolvedBodyId } : {}),
          ...responseDetails
        };
      }
      return {
        status: "unsupported",
        targetBodyId: resolvedBodyId!,
        ...responseDetails
      };
    }

    const targetBodyId = resolveActiveTopologyAnchorBodyTargetId(
      document.features,
      anchorResolution.target
    );
    return createResolvedTargetCompatibility(
      document,
      targetBodyId,
      requiredOperation,
      consumer.targetTopologyAnchorId
    );
  }

  return createResolvedTargetCompatibility(
    document,
    consumer.targetBodyId!,
    requiredOperation
  );
}

function createResolvedTargetCompatibility(
  document: CadDocument,
  targetBodyId: string,
  requiredOperation: "feature.extrudeAddTarget" | "feature.extrudeCutTarget",
  targetTopologyAnchorId?: string
): SketchProfileReadinessQueryResponse["targetCompatibility"] {
  const target = [...document.features.values()].find(
    (feature) => feature.bodyId === targetBodyId
  );
  const consumedBy = [...document.features.values()].find(
    (feature) =>
      "targetBodyId" in feature && feature.targetBodyId === targetBodyId
  );
  const supportedOperations = createSupportedBooleanBodyTargetOperations(
    document,
    targetBodyId,
    targetTopologyAnchorId
  );
  const supported =
    target !== undefined &&
    consumedBy === undefined &&
    supportedOperations.includes(requiredOperation);
  const primitiveTarget = isPrimitiveBodyId(document, targetBodyId);
  const diagnostics = supported
    ? []
    : [
        profileDiagnostic(
          target
            ? consumedBy
              ? "TARGET_BODY_NOT_SUPPORTED"
              : "UNSUPPORTED_BODY_REFERENCES"
            : primitiveTarget
              ? "TARGET_BODY_NOT_SUPPORTED"
              : "BODY_NOT_FOUND",
          target
            ? consumedBy
              ? `Target body is already consumed by feature ${consumedBy.id}: ${targetBodyId}.`
              : `Target body is outside the supported boolean target matrix: ${targetBodyId}.`
            : primitiveTarget
              ? `Primitive-derived body cannot be targeted by feature.extrude: ${targetBodyId}.`
              : `Target body does not exist: ${targetBodyId}.`,
          { bodyId: targetBodyId }
        )
      ];
  return {
    status: supported ? "ready" : "unsupported",
    targetBodyId,
    ...(targetTopologyAnchorId ? { targetTopologyAnchorId } : {}),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

export function createNewBodyWireProfileReadinessResponse(
  sketch: Sketch,
  profile: SketchWireProfileRef,
  cadOpsVersion: CadOpsVersion
): SketchProfileReadinessQueryResponse {
  const consumer = {
    featureKind: "extrude" as const,
    operationMode: "newBody" as const
  };
  const consumerCompatibility = createConsumerCompatibility(profile, consumer);
  const targetCompatibility = {
    status: "not-applicable" as const,
    diagnosticCount: 0 as const,
    diagnostics: [] as const
  };
  return createWireProfileReadinessResponse(
    sketch,
    profile,
    consumer,
    consumerCompatibility,
    targetCompatibility,
    cadOpsVersion
  );
}

function createWireProfileReadinessResponse(
  sketch: Sketch,
  profile: SketchWireProfileRef,
  consumer: SketchProfileConsumerIntent,
  consumerCompatibility: SketchConsumerCompatibility,
  targetCompatibility: SketchProfileTargetCompatibility,
  cadOpsVersion: CadOpsVersion
): SketchProfileReadinessQueryResponse {
  const wire = resolveWire(sketch, profile.segments);
  const normalized =
    wire.segments.length === profile.segments.length
      ? normalizeSketchWireCounterClockwise(wire.segments)
      : undefined;
  const normalizedProfile: SketchProfileRef | undefined = normalized
    ? {
        kind: "wire",
        sketchId: sketch.id,
        segments: refsFromSegments(normalized.segments)
      }
    : undefined;
  const orientationDiagnostic = normalized?.normalized
    ? [
        {
          code: "SKETCH_PROFILE_ORIENTATION_NORMALIZED" as const,
          severity: "info" as const,
          message: "Profile traversal was normalized counterclockwise.",
          sketchId: sketch.id
        }
      ]
    : [];
  const selectedKey = profile.segments
    .map((segment) => segment.entityId)
    .sort()
    .join("|");
  const nestingDiagnostics = createSketchProfileCandidatesResponse(
    sketch,
    cadOpsVersion
  )
    .rejectedComponents.filter(
      (component) => [...component.entityIds].sort().join("|") === selectedKey
    )
    .flatMap((component) => component.diagnostics)
    .filter(
      (diagnostic) =>
        diagnostic.code === "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED"
    );
  const diagnostics = [
    ...wire.diagnostics,
    ...orientationDiagnostic,
    ...nestingDiagnostics,
    ...consumerCompatibility.diagnostics,
    ...targetCompatibility.diagnostics
  ];
  const ready =
    wire.closed &&
    wire.intersectionStatus === "clear" &&
    wire.area !== undefined &&
    wire.bounds !== undefined &&
    normalized !== undefined &&
    normalizedProfile !== undefined &&
    wire.area >= SKETCH_GEOMETRY_POLICY.minimumProfileArea &&
    consumerCompatibility.status === "ready" &&
    (targetCompatibility.status === "not-applicable" ||
      targetCompatibility.status === "ready") &&
    !diagnostics.some((diagnostic) => diagnostic.severity === "blocker");
  const responseBase = {
    ok: true as const,
    query: "sketch.profileReadiness" as const,
    cadOpsVersion,
    requestedProfile: profile,
    consumer,
    consumerCompatibility,
    targetCompatibility,
    dependencies: {
      sketchIds: [sketch.id],
      orderedEntityIds: profile.segments.map((segment) => segment.entityId)
    },
    joinCount: wire.joins.length,
    joins: wire.joins,
    intersectionStatus: wire.intersectionStatus,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
  if (ready) {
    return {
      ...responseBase,
      status: "ready",
      normalizedProfile,
      orientation: "counterclockwise",
      orientationNormalized: normalized.normalized,
      area: wire.area,
      signedArea: normalized.signedArea,
      bounds: wire.bounds,
      intersectionStatus: "clear"
    };
  }
  return {
    ...responseBase,
    status: "blocked",
    ...(normalizedProfile ? { normalizedProfile } : {}),
    ...(wire.signedArea === undefined
      ? {}
      : {
          orientation:
            wire.signedArea < 0
              ? ("clockwise" as const)
              : ("counterclockwise" as const)
        }),
    orientationNormalized: normalized?.normalized ?? false,
    ...(wire.area === undefined ? {} : { area: wire.area }),
    ...(normalized
      ? { signedArea: normalized.signedArea }
      : wire.signedArea === undefined
        ? {}
        : { signedArea: wire.signedArea }),
    ...(wire.bounds ? { bounds: wire.bounds } : {})
  };
}

export function createSketchProfileReadinessResponse(
  document: SketchProfileReadinessDocument,
  query: SketchProfileReadinessQuery,
  cadOpsVersion: CadOpsVersion
): SketchProfileReadinessQueryResponse {
  const sketch = document.sketches.get(query.profile.sketchId)!;
  const consumerCompatibility = createConsumerCompatibility(
    query.profile,
    query.consumer
  );
  const targetCompatibility = createTargetCompatibility(
    document,
    query.consumer
  );
  const targetDiagnostics = targetCompatibility.diagnostics;

  if (query.profile.kind === "entity") {
    const entity = sketch.entities.get(query.profile.entityId);
    const diagnostics: SketchProfileDiagnostic[] = [];
    if (!entity) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_ENTITY_MISSING",
          `Profile entity does not exist: ${query.profile.entityId}.`,
          {
            sketchId: sketch.id,
            entityId: query.profile.entityId
          }
        )
      );
    } else if (entity.kind !== "rectangle" && entity.kind !== "circle") {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_ENTITY_UNSUPPORTED",
          `Entity profiles require a rectangle or circle, not ${entity.kind}.`,
          {
            sketchId: sketch.id,
            entityId: entity.id
          }
        )
      );
    } else if (entity.construction) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
          "Construction entities cannot define solid profiles.",
          {
            sketchId: sketch.id,
            entityId: entity.id
          }
        )
      );
    }
    const readyEntity =
      entity?.kind === "rectangle" || entity?.kind === "circle"
        ? entity
        : undefined;
    const area = readyEntity
      ? readyEntity.kind === "circle"
        ? Math.PI * readyEntity.radius * readyEntity.radius
        : readyEntity.width * readyEntity.height
      : undefined;
    if (area !== undefined && !Number.isFinite(area)) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_ENTITY_UNSUPPORTED",
          "Entity profile area evaluation produced a non-finite result.",
          { sketchId: sketch.id, entityId: query.profile.entityId }
        )
      );
    } else if (
      area !== undefined &&
      area < SKETCH_GEOMETRY_POLICY.minimumProfileArea
    ) {
      diagnostics.push(
        profileDiagnostic(
          "SKETCH_PROFILE_AREA_TOO_SMALL",
          "Entity profile area is below the shared minimum profile area.",
          { sketchId: sketch.id, entityId: query.profile.entityId }
        )
      );
    }
    const allDiagnostics = [
      ...diagnostics,
      ...consumerCompatibility.diagnostics,
      ...targetDiagnostics
    ];
    const ready =
      allDiagnostics.every((diagnostic) => diagnostic.severity !== "blocker") &&
      readyEntity;
    return {
      ok: true,
      query: "sketch.profileReadiness",
      cadOpsVersion,
      status: ready ? "ready" : "blocked",
      requestedProfile: query.profile,
      ...(ready
        ? {
            normalizedProfile: query.profile,
            orientation: "counterclockwise" as const
          }
        : {}),
      orientationNormalized: false,
      ...(area === undefined ? {} : { area, signedArea: area }),
      ...(readyEntity
        ? { bounds: createEntityProfileBounds(readyEntity) }
        : {}),
      consumer: query.consumer,
      consumerCompatibility,
      targetCompatibility,
      dependencies: {
        sketchIds: [sketch.id],
        orderedEntityIds: [query.profile.entityId]
      },
      joinCount: 0,
      joins: [],
      intersectionStatus: ready ? "clear" : "not-evaluated",
      diagnosticCount: allDiagnostics.length,
      diagnostics: allDiagnostics
    } as SketchProfileReadinessQueryResponse;
  }

  return createWireProfileReadinessResponse(
    sketch,
    query.profile,
    query.consumer,
    consumerCompatibility,
    targetCompatibility,
    cadOpsVersion
  );
}

function rejectedPathComponent(
  sketch: Sketch,
  component: EntityComponent,
  componentIndex: number
): SketchPathRejectedComponent {
  const degrees = component.vertices.map((vertex) => vertex.length);
  const branching = degrees.some((degree) => degree > 2);
  const closed = degrees.length > 0 && degrees.every((degree) => degree === 2);
  const traversal = !branching
    ? traverseComponent(component, closed)
    : undefined;
  const resolved = traversal
    ? resolvePath(sketch, {
        kind: traversal.length === 1 ? "entity" : "chain",
        sketchId: sketch.id,
        ...(traversal.length === 1
          ? {
              entityId: traversal[0]!.entityId,
              orientation: traversal[0]!.orientation
            }
          : { segments: refsFromSegments(traversal) })
      } as SketchPathRef)
    : undefined;
  const diagnostics = [...(resolved?.diagnostics ?? [])];
  if (branching) {
    diagnostics.push(
      pathDiagnostic(
        "SKETCH_PATH_BRANCHING",
        "Connected path component contains a branch vertex.",
        { sketchId: sketch.id }
      )
    );
  } else if (!traversal) {
    diagnostics.push(
      pathDiagnostic(
        "SKETCH_PATH_DISCONNECTED",
        "Path component could not be ordered as one chain.",
        { sketchId: sketch.id }
      )
    );
  }
  return {
    status: "blocked",
    componentIndex,
    sortKey: componentSortKey(component),
    sketchId: sketch.id,
    entityIds: component.entities.map((entity) => entity.id),
    ...(resolved?.bounds ? { bounds: resolved.bounds } : {}),
    connectionStatus: branching
      ? "branching"
      : (resolved?.connectionStatus ?? "disconnected"),
    tangentStatus: resolved?.tangentStatus ?? "not-evaluated",
    selfIntersectionStatus: resolved?.selfIntersectionStatus ?? "not-evaluated",
    joinCount: resolved?.joins.length ?? 0,
    joins: resolved?.joins ?? [],
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createPathCandidate(
  sketch: Sketch,
  path: SketchPathRef
): SketchPathCandidate | undefined {
  const resolved = resolvePath(sketch, path);
  if (
    resolved.diagnostics.some(
      (diagnostic) => diagnostic.severity === "blocker"
    ) ||
    resolved.connectionStatus !== "connected" ||
    resolved.tangentStatus !== "tangent" ||
    resolved.selfIntersectionStatus !== "clear" ||
    resolved.length === undefined ||
    !resolved.bounds
  )
    return undefined;
  const orientationKey =
    path.kind === "entity"
      ? path.orientation
      : path.segments.map((segment) => segment.orientation[0]).join("");
  return {
    status: "ready",
    candidateIndex: 0,
    sortKey: `${resolved.segments.map((segment) => segment.entityId).join("|")}|${orientationKey}`,
    path,
    length: resolved.length,
    bounds: resolved.bounds,
    connectionStatus: "connected",
    tangentStatus: "tangent",
    selfIntersectionStatus: "clear",
    joinCount: resolved.joins.length,
    joins: resolved.joins,
    dependencies: dependencies(sketch.id, resolved.segments),
    diagnosticCount: 0,
    diagnostics: []
  };
}

export function createSketchPathCandidatesResponse(
  sketch: Sketch,
  cadOpsVersion: CadOpsVersion
): SketchPathCandidatesQueryResponse {
  const candidates: SketchPathCandidate[] = [];
  const rejectedComponents: SketchPathRejectedComponent[] = [];
  const entities = [...sketch.entities.values()]
    .filter(
      (entity): entity is SketchWireEntity =>
        entity.kind === "line" || entity.kind === "arc"
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const entity of entities) {
    for (const orientation of ["forward", "reverse"] as const) {
      const candidate = createPathCandidate(sketch, {
        kind: "entity",
        sketchId: sketch.id,
        entityId: entity.id,
        orientation
      });
      if (candidate) candidates.push(candidate);
    }
  }
  const components = buildComponents(entities);
  for (const component of components) {
    if (component.entities.length < 2) continue;
    const degrees = component.vertices.map((vertex) => vertex.length);
    const open =
      degrees.filter((degree) => degree === 1).length === 2 &&
      degrees.every((degree) => degree <= 2);
    const traversal = open ? traverseComponent(component, false) : undefined;
    if (!traversal) {
      rejectedComponents.push(rejectedPathComponent(sketch, component, 0));
      continue;
    }
    const forward: SketchPathRef = {
      kind: "chain",
      sketchId: sketch.id,
      segments: refsFromSegments(traversal)
    };
    const reverseSegments = [...traversal]
      .reverse()
      .map(reverseSketchSegmentTraversal);
    const reverse: SketchPathRef = {
      kind: "chain",
      sketchId: sketch.id,
      segments: refsFromSegments(reverseSegments)
    };
    const forwardCandidate = createPathCandidate(sketch, forward);
    const reverseCandidate = createPathCandidate(sketch, reverse);
    if (forwardCandidate && reverseCandidate) {
      candidates.push(forwardCandidate, reverseCandidate);
    } else {
      rejectedComponents.push(rejectedPathComponent(sketch, component, 0));
    }
  }
  candidates.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  rejectedComponents.sort((left, right) =>
    left.sortKey.localeCompare(right.sortKey)
  );
  const indexedCandidates = candidates.map((candidate, candidateIndex) => ({
    ...candidate,
    candidateIndex
  }));
  const indexedRejectedComponents = rejectedComponents.map(
    (component, componentIndex) => ({ ...component, componentIndex })
  );
  const diagnostics = rejectedComponents.flatMap(
    (component) => component.diagnostics
  );
  return {
    ok: true,
    query: "sketch.pathCandidates",
    cadOpsVersion,
    sketchId: sketch.id,
    status: indexedCandidates.length > 0 ? "ready" : "blocked",
    candidateCount: indexedCandidates.length,
    candidates: indexedCandidates,
    rejectedComponentCount: indexedRejectedComponents.length,
    rejectedComponents: indexedRejectedComponents,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function vector3Length(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function dot3(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross3(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function validateSweepFrame(
  document: CadDocument,
  pathSketch: Sketch,
  path: ResolvedPath,
  profileRef: SketchPathReadinessQuery["sweepProfile"]
): readonly SketchPathDiagnostic[] {
  if (!profileRef || path.segments.length === 0) return [];
  const profileSketch = document.sketches.get(profileRef.sketchId);
  const profileEntity = profileSketch?.entities.get(profileRef.entityId);
  if (
    !profileSketch ||
    (profileEntity?.kind !== "rectangle" && profileEntity?.kind !== "circle") ||
    profileEntity.construction
  ) {
    return [
      pathDiagnostic(
        "SKETCH_PATH_FRAME_INVALID",
        "Sweep profile must resolve to one non-construction rectangle or circle.",
        {
          sketchId: profileRef.sketchId,
          entityId: profileRef.entityId
        }
      )
    ];
  }
  const pathFrame = createSourceMeasurementFrame(
    document,
    pathSketch,
    DEFAULT_PART_ID
  );
  const profileFrame = createSourceMeasurementFrame(
    document,
    profileSketch,
    DEFAULT_PART_ID
  );
  if (!pathFrame || !profileFrame) {
    return [
      pathDiagnostic(
        "SKETCH_PATH_FRAME_INVALID",
        "Sweep profile or path sketch frame cannot be resolved."
      )
    ];
  }
  const pathStart = mapSketchPointToSourceMeasurementFrame(
    pathFrame,
    path.segments[0]!.start
  );
  const profileCenter = mapSketchPointToSourceMeasurementFrame(
    profileFrame,
    profileEntity.center
  );
  const profileNormal = cross3(profileFrame.uAxis, profileFrame.vAxis);
  const tangent2d = getSketchSegmentEndpointTangent(path.segments[0]!, "start");
  const pathTangent: Vec3 = [
    pathFrame.uAxis[0] * tangent2d[0] + pathFrame.vAxis[0] * tangent2d[1],
    pathFrame.uAxis[1] * tangent2d[0] + pathFrame.vAxis[1] * tangent2d[1],
    pathFrame.uAxis[2] * tangent2d[0] + pathFrame.vAxis[2] * tangent2d[1]
  ];
  const delta: Vec3 = [
    pathStart[0] - profileCenter[0],
    pathStart[1] - profileCenter[1],
    pathStart[2] - profileCenter[2]
  ];
  const planeDistance = Math.abs(dot3(delta, profileNormal));
  const centerDistance = vector3Length(delta);
  const tangentCosine = Math.abs(
    dot3(pathTangent, profileNormal) / vector3Length(pathTangent)
  );
  const minimumCosine = Math.cos(
    (SKETCH_GEOMETRY_POLICY.angularToleranceDegrees * Math.PI) / 180
  );
  const diagnostics: SketchPathDiagnostic[] = [];
  if (planeDistance > LINEAR_TOLERANCE || centerDistance > LINEAR_TOLERANCE) {
    diagnostics.push(
      pathDiagnostic(
        "SKETCH_PATH_FRAME_INVALID",
        "Path start must coincide with the sweep profile center in its plane.",
        {
          sketchId: pathSketch.id,
          expected: `distance <= ${LINEAR_TOLERANCE}`,
          received: String(centerDistance)
        }
      )
    );
  }
  if (tangentCosine < minimumCosine) {
    diagnostics.push(
      pathDiagnostic(
        "SKETCH_PATH_FRAME_INVALID",
        "Path start tangent must be normal to the sweep profile plane.",
        {
          sketchId: pathSketch.id,
          expected: `angular deviation <= ${SKETCH_GEOMETRY_POLICY.angularToleranceDegrees} degrees`,
          received: String((Math.acos(tangentCosine) * 180) / Math.PI)
        }
      )
    );
  }
  return diagnostics;
}

export function createSketchPathReadinessResponse(
  document: CadDocument,
  query: SketchPathReadinessQuery,
  cadOpsVersion: CadOpsVersion
): SketchPathReadinessQueryResponse {
  const sketch = document.sketches.get(query.path.sketchId)!;
  const resolved = resolvePath(sketch, query.path);
  const frameDiagnostics = validateSweepFrame(
    document,
    sketch,
    resolved,
    query.sweepProfile
  );
  const diagnostics = [...resolved.diagnostics, ...frameDiagnostics];
  const ready =
    resolved.connectionStatus === "connected" &&
    resolved.tangentStatus === "tangent" &&
    resolved.selfIntersectionStatus === "clear" &&
    frameDiagnostics.length === 0 &&
    resolved.length !== undefined &&
    resolved.bounds !== undefined &&
    !diagnostics.some((diagnostic) => diagnostic.severity === "blocker");
  const pathEntityIds =
    query.path.kind === "entity"
      ? [query.path.entityId]
      : query.path.segments.map((segment) => segment.entityId);
  const sketchIds = [query.path.sketchId];
  const orderedEntityIds = [...pathEntityIds];
  if (query.sweepProfile) {
    if (!sketchIds.includes(query.sweepProfile.sketchId))
      sketchIds.push(query.sweepProfile.sketchId);
    orderedEntityIds.push(query.sweepProfile.entityId);
  }
  return {
    ok: true,
    query: "sketch.pathReadiness",
    cadOpsVersion,
    status: ready ? "ready" : "blocked",
    requestedPath: query.path,
    ...(resolved.segments.length === pathEntityIds.length
      ? { normalizedPath: query.path }
      : {}),
    ...(query.sweepProfile ? { sweepProfile: query.sweepProfile } : {}),
    consumer: { featureKind: "sweep", operationMode: "newBody" },
    dependencies: { sketchIds, orderedEntityIds },
    connectionStatus: resolved.connectionStatus,
    tangentStatus: resolved.tangentStatus,
    selfIntersectionStatus: resolved.selfIntersectionStatus,
    frameStatus: query.sweepProfile
      ? frameDiagnostics.length === 0
        ? "ready"
        : "invalid"
      : "not-evaluated",
    ...(resolved.length === undefined ? {} : { length: resolved.length }),
    ...(resolved.bounds ? { bounds: resolved.bounds } : {}),
    joinCount: resolved.joins.length,
    joins: resolved.joins,
    diagnosticCount: diagnostics.length,
    diagnostics
  } as SketchPathReadinessQueryResponse;
}
