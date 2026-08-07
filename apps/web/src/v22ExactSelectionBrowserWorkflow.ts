import {
  V21_EXACT_RELEASE_CORPUS,
  createExactBodyArtifactWorkerRequest,
  createExactStepExportWorkerRequest,
  createStepImportWorkerRequest,
  type GeometryKernelExactBodyArtifact
} from "@web-cad/geometry-worker/browser";
import { createRenderMeshFromSerializableMesh } from "@web-cad/renderer-mesh-bridge";
import {
  pickExactRenderBodies,
  pickRenderScene,
  projectPoint,
  type RenderCamera,
  type RenderExactPickBody,
  type RenderExactPickCandidate,
  type RenderExactPickFilter,
  type RenderExactPickMap,
  type RenderExactPickResult,
  type RenderTriangleMesh,
  type Vec3
} from "@web-cad/renderer";
import { BrowserGeometryWorker } from "./browserGeometryWorker";

export interface V22SelectionKindHits {
  readonly body: boolean;
  readonly face: boolean;
  readonly edge: boolean;
  readonly vertex: boolean;
}

export interface V22SelectionEvidence {
  readonly row: string;
  readonly fixture: string;
  readonly kindHits: V22SelectionKindHits;
  readonly identityBound: boolean;
  readonly occlusionProof: boolean;
  readonly clippingProof: boolean;
  readonly filterProof: boolean;
  readonly bodyOnlyFallback: boolean;
  readonly cycleCandidates: number;
}

const SELECTION_ROWS = [
  ["primitiveFeature", "primitive-box"],
  ["sketchExtrudeFeature", "extrude-entity"],
  ["sketchRevolveFeature", "revolve-entity"],
  ["sketchHoleFeature", "hole-blind"],
  ["edgeChamferFeature", "edge-chamfer"],
  ["edgeFilletFeature", "edge-fillet"],
  ["linearPatternFeature", "pattern-linear"],
  ["circularPatternFeature", "pattern-circular"],
  ["mirrorFeature", "mirror"],
  ["shellFeature", "shell"],
  ["sweepFeature", "sweep-line"],
  ["loftFeature", "loft"]
] as const;

const SIZE = { width: 1280, height: 800 };
const EMPTY_PICK: RenderExactPickResult = {
  status: "ready",
  candidates: [],
  examined: 0,
  truncated: false
};

export async function runV22ExactSelectionBrowserWorkflow(
  worker: BrowserGeometryWorker
): Promise<object> {
  const rows: V22SelectionEvidence[] = [];

  for (const [row, fixture] of SELECTION_ROWS) {
    const entry = V21_EXACT_RELEASE_CORPUS.find(({ id }) => id === fixture);
    if (!entry) throw new Error(`V22 row ${row} missing fixture ${fixture}.`);
    const artifact = await buildArtifact(worker, entry, row);
    rows.push(probeSelection(row, fixture, artifact));
  }

  rows.push(await buildImportedRow(worker));

  const ok = rows.every(
    (evidence) =>
      evidence.identityBound &&
      evidence.kindHits.body &&
      evidence.kindHits.face &&
      evidence.kindHits.edge &&
      evidence.kindHits.vertex &&
      evidence.occlusionProof &&
      evidence.clippingProof &&
      evidence.filterProof &&
      evidence.bodyOnlyFallback
  );

  return {
    ok,
    rowCount: rows.length,
    rows: rows.map((evidence) => ({ ...evidence }))
  };
}

async function buildArtifact(
  worker: BrowserGeometryWorker,
  entry: (typeof V21_EXACT_RELEASE_CORPUS)[number],
  sourceType: string
): Promise<GeometryKernelExactBodyArtifact> {
  const response = await worker.execute(
    createExactBodyArtifactWorkerRequest({
      id: `v22-select-${entry.id}`,
      bodyId: `v22-body-${entry.id}`,
      sourceType,
      documentSourceIdentity: sourceIdentity("a"),
      bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
      sourceCacheKeySha256: "c".repeat(64),
      sourceGraphNodeCount: entry.sourceGraphNodeCount,
      units: "mm",
      shapePolicy: entry.shapePolicy,
      source: entry.source
    })
  );
  if (!response.response.ok) {
    throw new Error(`${entry.id}: ${response.response.error.message}`);
  }
  const artifact = response.response.artifact;
  if (!artifact.viewportPickMap || artifact.viewportPickMapDowngrade) {
    throw new Error(`${entry.id} has no valid ready pick map.`);
  }
  return artifact;
}

async function buildImportedRow(
  worker: BrowserGeometryWorker
): Promise<V22SelectionEvidence> {
  const box = V21_EXACT_RELEASE_CORPUS.find(
    (item) => item.id === "primitive-box"
  );
  if (!box) throw new Error("primitive-box fixture missing.");
  const source = await buildArtifact(worker, box, "primitiveFeature");

  const exported = await worker.execute(
    createExactStepExportWorkerRequest({
      id: "v22-import-export",
      units: "mm",
      bodies: [
        {
          bodyId: "v22-import-source",
          bodyName: box.bodyName,
          brepFormat: source.brepFormat,
          brepByteLength: source.brepByteLength,
          brepSha256: source.brepSha256,
          brepBytes: source.brepBytes.slice()
        }
      ]
    })
  );
  if (!exported.response.ok) throw new Error(exported.response.error.message);
  const step = exported.response.artifact;

  const imported = await worker.execute(
    createStepImportWorkerRequest({
      id: `v22-import-${source.metadata.topologyCounts.solidCount}`,
      sourceFileName: "v22-selection.step",
      bytes: step.bytes.slice(),
      maxBodyCount: source.metadata.topologyCounts.solidCount
    })
  );
  if (!imported.response.ok) throw new Error(imported.response.error.message);
  const importedBody = imported.response.bodies[0];
  if (!importedBody) throw new Error("V22 STEP import returned no body.");

  const brepBytes = importedBody.checkpointPayload.brepBytes;
  const rebuilt = await worker.execute(
    createExactBodyArtifactWorkerRequest({
      id: "v22-import-rebuild",
      bodyId: "v22-imported-compound",
      sourceType: "importedStepBody",
      documentSourceIdentity: sourceIdentity("d"),
      bodySourceIdentitySignature: `body-topology-source:v1:${"e".repeat(64)}`,
      sourceCacheKeySha256: "f".repeat(64),
      sourceGraphNodeCount: 1,
      units: "mm",
      shapePolicy: "singleShapeOneOrMoreSolids",
      source: {
        kind: "checkpointBody",
        brepBytes: brepBytes.slice(),
        brepByteLength: brepBytes.byteLength,
        brepSha256: await sha256Hex(brepBytes),
        topologySourceKind: "importedBody",
        topologySignature: importedBody.topologySnapshot.signature
      }
    })
  );
  if (!rebuilt.response.ok) throw new Error(rebuilt.response.error.message);
  const artifact = rebuilt.response.artifact;
  if (!artifact.viewportPickMap || artifact.viewportPickMapDowngrade) {
    throw new Error("V22 rebuilt imported body has no pick map.");
  }
  return probeSelection("importedStepBody", "checkpoint-recovery", artifact);
}

function probeSelection(
  row: string,
  fixture: string,
  artifact: GeometryKernelExactBodyArtifact
): V22SelectionEvidence {
  const pickMap = artifact.viewportPickMap;
  if (!pickMap) throw new Error("selection requires a pick map.");
  const { mesh } = createRenderMeshFromSerializableMesh(artifact.displayMesh, {
    id: artifact.bodyId,
    alignment: "source"
  });
  const body: RenderExactPickBody = { mesh, pickMap };

  const center = meshCenter(mesh);
  const camera: RenderCamera = {
    target: center,
    yaw: 0,
    pitch: 0,
    distance: Math.max(16, meshRadius(mesh, center) * 3)
  };
  const pick = (
    world: Vec3,
    filter: RenderExactPickFilter
  ): RenderExactPickResult => pickBodiesAt(world, [body], camera, filter);

  const facePoint = firstTriangleCenter(mesh, pickMap);
  const auto = pick(facePoint, "auto");
  const face = pick(facePoint, "face");
  const vertex = pick(pointAtPickMap(pickMap.vertexPoints, 0, mesh), "vertex");
  const edgeStart = edgePointStartIndex(pickMap, 0);
  const edge = pick(
    pointAtPickMap(pickMap.edgePoints, edgeStart, mesh),
    "edge"
  );

  const identityBound = [auto, face, edge, vertex].every((result) =>
    result.candidates.every(
      (candidate) =>
        candidate.bodyId === pickMap.bodyId &&
        candidate.bodySourceIdentitySignature ===
          pickMap.bodySourceIdentitySignature &&
        candidate.topologySignature === pickMap.topologySignature &&
        candidateMatchesPickMap(candidate, pickMap)
    )
  );
  const occlusionProof = proveOcclusion(body, camera, facePoint);
  const clippingProof = proveClipping(body, camera, facePoint);
  const filterProof =
    face.candidates.length > 0 &&
    face.candidates.every((candidate) => candidate.entityKind === "face") &&
    vertex.candidates.length > 0 &&
    vertex.candidates.every((candidate) => candidate.entityKind === "vertex") &&
    edge.candidates.length > 0 &&
    edge.candidates.every((candidate) => candidate.entityKind === "edge");
  const faceScreen = projected(facePoint, camera);
  const fallbackId = faceScreen
    ? pickRenderScene([], [mesh], camera, SIZE, faceScreen)
    : undefined;

  return {
    row,
    fixture,
    kindHits: {
      body: auto.candidates.some(
        (candidate) => candidate.entityKind === "body"
      ),
      face: auto.candidates.some(
        (candidate) => candidate.entityKind === "face"
      ),
      edge: edge.candidates.length > 0,
      vertex: vertex.candidates.length > 0
    },
    identityBound,
    occlusionProof,
    clippingProof,
    filterProof,
    bodyOnlyFallback: fallbackId === mesh.id,
    cycleCandidates: auto.candidates.length
  };
}

function pickBodiesAt(
  world: Vec3,
  declaredBodies: readonly RenderExactPickBody[],
  camera: RenderCamera,
  filter: RenderExactPickFilter
): RenderExactPickResult {
  const screen = projected(world, camera);
  if (!screen) return EMPTY_PICK;
  return pickExactRenderBodies(
    declaredBodies,
    camera,
    SIZE,
    { x: screen.x, y: screen.y },
    filter
  );
}

function candidateMatchesPickMap(
  candidate: RenderExactPickCandidate,
  pickMap: RenderExactPickMap
): boolean {
  if (candidate.entityKind === "body") return true;
  const entities =
    candidate.entityKind === "face"
      ? pickMap.faces
      : candidate.entityKind === "edge"
        ? pickMap.edges
        : pickMap.vertices;
  return entities.some(
    (entity) =>
      entity.localId === candidate.localId &&
      entity.entitySignature === candidate.entitySignature
  );
}

function proveOcclusion(
  front: RenderExactPickBody,
  camera: RenderCamera,
  center: Vec3
): boolean {
  const cameraPosition = getCameraPosition(camera);
  const scale = 1.1;
  const behindMesh: RenderTriangleMesh = {
    ...front.mesh,
    transform: {
      ...front.mesh.transform,
      translation: [
        cameraPosition[0] +
          (front.mesh.transform.translation[0] - cameraPosition[0]) * scale,
        cameraPosition[1] +
          (front.mesh.transform.translation[1] - cameraPosition[1]) * scale,
        cameraPosition[2] +
          (front.mesh.transform.translation[2] - cameraPosition[2]) * scale
      ],
      scale: [
        front.mesh.transform.scale[0] * scale,
        front.mesh.transform.scale[1] * scale,
        front.mesh.transform.scale[2] * scale
      ]
    }
  };
  const behindPickMap: RenderExactPickMap = {
    ...front.pickMap,
    bodyId: `${front.pickMap.bodyId}:behind`,
    bodySourceIdentitySignature: `${front.pickMap.bodySourceIdentitySignature}:behind`
  };
  const behind: RenderExactPickBody = {
    mesh: behindMesh,
    pickMap: behindPickMap
  };
  const result = pickBodiesAt(center, [front, behind], camera, "body");
  const frontVisible =
    result.candidates.find(
      (candidate) =>
        candidate.bodyId === front.pickMap.bodyId && !candidate.occluded
    ) !== undefined;
  const behindOccluded =
    result.candidates.find(
      (candidate) =>
        candidate.bodyId === behind.pickMap.bodyId && candidate.occluded
    ) !== undefined;
  return frontVisible && behindOccluded;
}

function getCameraPosition(camera: RenderCamera): Vec3 {
  return [
    camera.target[0] +
      camera.distance * Math.cos(camera.pitch) * Math.sin(camera.yaw),
    camera.target[1] -
      camera.distance * Math.cos(camera.pitch) * Math.cos(camera.yaw),
    camera.target[2] + camera.distance * Math.sin(camera.pitch)
  ];
}

function proveClipping(
  body: RenderExactPickBody,
  camera: RenderCamera,
  point: Vec3
): boolean {
  const minY = Math.min(
    ...body.mesh.vertices.map(
      (vertex) => pointAtMeshVertex(vertex, body.mesh)[1]
    )
  );
  const screen = projected(point, camera);
  if (!screen) return false;
  return (
    pickExactRenderBodies([body], camera, SIZE, screen, "auto", {
      origin: [0, minY - 1, 0],
      normal: [0, -1, 0]
    }).candidates.length === 0
  );
}

function pointAtPickMap(
  points: Float64Array,
  index: number,
  mesh: RenderTriangleMesh
): Vec3 {
  if (index < 0) return [0, 0, 0];
  return [
    (points[index * 3] ?? 0) + mesh.transform.translation[0],
    (points[index * 3 + 1] ?? 0) + mesh.transform.translation[1],
    (points[index * 3 + 2] ?? 0) + mesh.transform.translation[2]
  ];
}

function edgePointStartIndex(
  pickMap: RenderExactPickMap,
  edgeIndex: number
): number {
  if (pickMap.edges.length === 0) return -1;
  return pickMap.edgePointRanges[edgeIndex * 2] ?? 0;
}

function pointAtMeshVertex(vertex: Vec3, mesh: RenderTriangleMesh): Vec3 {
  return [
    vertex[0] + mesh.transform.translation[0],
    vertex[1] + mesh.transform.translation[1],
    vertex[2] + mesh.transform.translation[2]
  ];
}

function meshCenter(mesh: RenderTriangleMesh): Vec3 {
  let count = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const vertex of mesh.vertices) {
    const world = pointAtMeshVertex(vertex, mesh);
    x += world[0];
    y += world[1];
    z += world[2];
    count += 1;
  }
  if (count === 0) return [0, 0, 0];
  return [x / count, y / count, z / count];
}

function meshRadius(mesh: RenderTriangleMesh, center: Vec3): number {
  return mesh.vertices.reduce((radius, vertex) => {
    const point = pointAtMeshVertex(vertex, mesh);
    return Math.max(
      radius,
      Math.hypot(
        point[0] - center[0],
        point[1] - center[1],
        point[2] - center[2]
      )
    );
  }, 0);
}

function firstTriangleCenter(
  mesh: RenderTriangleMesh,
  pickMap: RenderExactPickMap
): Vec3 {
  const triangle = pickMap.faceTriangleRanges[0] ?? 0;
  const offset = triangle * 3;
  const points = [0, 1, 2].map((index) =>
    pointAtMeshVertex(
      mesh.vertices[mesh.indices[offset + index] ?? -1] ?? [0, 0, 0],
      mesh
    )
  );
  return [
    (points[0]![0] + points[1]![0] + points[2]![0]) / 3,
    (points[0]![1] + points[1]![1] + points[2]![1]) / 3,
    (points[0]![2] + points[1]![2] + points[2]![2]) / 3
  ];
}

function projected(
  world: Vec3,
  camera: RenderCamera
): { readonly x: number; readonly y: number } | undefined {
  return projectPoint(world, camera, SIZE);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function sourceIdentity(fill: string) {
  return { algorithm: "partbench-source-v1" as const, sha256: fill.repeat(64) };
}
