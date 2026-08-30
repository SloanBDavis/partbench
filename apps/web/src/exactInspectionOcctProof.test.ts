import {
  CadEngine,
  createCadProjectSourceIdentity,
  createV15ReleaseSampleBatch,
  exportCadProject,
  exportCadProjectJson,
  type CadBatch
} from "@web-cad/cad-core";
import {
  createExactBodyArtifactWorkerRequest,
  createGeometryKernelWorker,
  type GeometryKernelExactBodyArtifact
} from "@web-cad/geometry-worker";
import { describe, expect, it } from "vitest";

import {
  bindExactInspectionTarget,
  measureExactInspectionPair,
  measureExactInspectionSingle,
  toExactInspectionArtifact,
  type ExactInspectionIdentity
} from "./exactInspectionMeasurement";
import { createDerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createDerivedGeometrySourcesFromDocument,
  removeConsumedDerivedGeometrySources
} from "./derivedGeometrySources";
import { resolveCurrentExactBodies } from "./currentExactBodyResolver";
import { buildCurrentExactBodyArtifacts } from "./projectExactStepExport";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

const OCCT_INSPECTION_PROOF_TIMEOUT_MS = 120_000;
const SAMPLE_BATCH = createV15ReleaseSampleBatch("v15-linear-pattern");
const EXTRUDE_CREATE: CadBatch = {
  ...SAMPLE_BATCH,
  ops: SAMPLE_BATCH.ops.slice(0, 3)
};

describe("V22 inspection exact-measurement OCCT proof", () => {
  it(
    "measures current exact body, face, edge, vertex, and pair values without mutating source",
    async () => {
      const engine = new CadEngine();
      const created = engine.executeBatch(EXTRUDE_CREATE);
      expect(created.ok).toBe(true);
      const beforeProject = exportCadProjectJson(engine);
      const beforeTransactions = engine.getTransactions();
      const beforeEpoch = engine.getSourceAuthorityEpoch();
      const beforeIdentity = createCadProjectSourceIdentity(
        exportCadProject(engine)
      );

      const artifact = await buildExtrudeArtifact(engine);
      const inspection = toExactInspectionArtifact(artifact);
      const bodyIdentity: ExactInspectionIdentity = {
        bodyId: inspection.bodyId,
        bodySourceIdentitySignature: inspection.bodySourceIdentitySignature,
        topologySignature: inspection.topologySignature,
        entityKind: "body"
      };
      const planarFaces = inspection.entities.filter(
        (entity) => entity.kind === "face" && entity.surfaceClass === "plane"
      );
      const linearEdges = inspection.entities.filter(
        (entity) => entity.kind === "edge" && entity.curveClass === "line"
      );
      const vertices = inspection.entities.filter(
        (entity) => entity.kind === "vertex" && entity.point
      );
      expect(planarFaces.length).toBeGreaterThanOrEqual(2);
      expect(linearEdges.length).toBeGreaterThanOrEqual(2);
      expect(vertices.length).toBeGreaterThanOrEqual(2);

      const body = measureExactInspectionSingle(
        bindExactInspectionTarget(bodyIdentity, [inspection], "Extrude"),
        "mm"
      );
      const face = measureExactInspectionSingle(
        bindExactInspectionTarget(identityFor(inspection, planarFaces[0]!), [
          inspection
        ]),
        "mm"
      );
      const edge = measureExactInspectionSingle(
        bindExactInspectionTarget(identityFor(inspection, linearEdges[0]!), [
          inspection
        ]),
        "mm"
      );
      const vertex = measureExactInspectionSingle(
        bindExactInspectionTarget(identityFor(inspection, vertices[0]!), [
          inspection
        ]),
        "mm"
      );
      const pair = measureExactInspectionPair(
        bindExactInspectionTarget(identityFor(inspection, planarFaces[0]!), [
          inspection
        ]),
        bindExactInspectionTarget(identityFor(inspection, planarFaces[1]!), [
          inspection
        ]),
        "mm"
      );

      expect(body.status).toBe("ready");
      expect(body.authority).toBe("geometryBoundaryExact");
      expect(body.values.some((value) => value.label === "Volume")).toBe(true);
      expect(face.status).toBe("ready");
      expect(face.values[0]?.label).toBe("Area");
      expect(edge.status).toBe("ready");
      expect(edge.values[0]?.label).toBe("Length");
      expect(vertex.status).toBe("ready");
      expect(pair.status).toBe("ready");
      expect(pair.values.some((value) => value.kind === "distance")).toBe(true);
      expect(pair.authority).toBe("geometryBoundaryExact");
      expect(exportCadProjectJson(engine)).toBe(beforeProject);
      expect(engine.getTransactions()).toEqual(beforeTransactions);
      expect(engine.getSourceAuthorityEpoch()).toBe(beforeEpoch);
      expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
        beforeIdentity
      );
    },
    OCCT_INSPECTION_PROOF_TIMEOUT_MS
  );
});

function identityFor(
  artifact: ReturnType<typeof toExactInspectionArtifact>,
  entity: ReturnType<typeof toExactInspectionArtifact>["entities"][number]
): ExactInspectionIdentity {
  return {
    bodyId: artifact.bodyId,
    bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
    topologySignature: artifact.topologySignature,
    entityKind: entity.kind as ExactInspectionIdentity["entityKind"],
    localId: entity.localId,
    entitySignature: entity.signature
  };
}

async function buildExtrudeArtifact(
  engine: CadEngine
): Promise<GeometryKernelExactBodyArtifact> {
  const worker = createGeometryKernelWorker();
  const snapshot = {
    generation: 1,
    stopped: false,
    active: false,
    queuedCount: 0,
    cancelledUserKinds: [] as const
  };
  const runtime = {
    getModelWorkSnapshot: () => snapshot,
    resumeModelWork() {
      return 0;
    },
    async exactBodyArtifact(input: Parameters<
      ReturnType<typeof createDerivedGeometryRuntime>["exactBodyArtifact"]
    >[0]) {
      const response = await worker.execute(
        createExactBodyArtifactWorkerRequest(input)
      );
      if (
        !response.response.ok ||
        response.response.op !== "geometry.exactBodyArtifact"
      ) {
        throw new Error(
          response.response.ok
            ? "Expected an exact body artifact response."
            : response.response.error.message
        );
      }
      return {
        artifact: response.response.artifact,
        metrics: { objectId: input.bodyId, roundTripMs: 0 },
        message: `Built exact body artifact for ${input.bodyId}.`
      };
    }
  };
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!structure.ok || structure.query !== "project.structure") {
    throw new Error("Expected project structure after extrude create.");
  }
  const generatedFacesByKey = new Map();
  const sourceIdentitySignaturesByBodyId = new Map<string, string>();
  for (const body of structure.bodies) {
    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: body.id }
    });
    if (topology.ok && topology.query === "body.topology") {
      sourceIdentitySignaturesByBodyId.set(
        body.id,
        topology.topology.sourceIdentity.signature
      );
    }
    if (body.source.type !== "sketchExtrudeFeature") continue;
    const references = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: body.id }
    });
    if (!references.ok || references.query !== "body.generatedReferences") {
      continue;
    }
    for (const face of references.faces) {
      generatedFacesByKey.set(
        createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
        face
      );
    }
  }
  const artifactGeometrySources = createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    structure.features,
    generatedFacesByKey,
    sourceIdentitySignaturesByBodyId,
    true
  );
  const resolutions = resolveCurrentExactBodies({
    document: engine.getDocument(),
    bodies: structure.bodies,
    features: structure.features,
    geometrySources: removeConsumedDerivedGeometrySources(
      artifactGeometrySources,
      structure.features
    ),
    artifactGeometrySources,
    sourceIdentitySignaturesByBodyId
  });
  const ready = resolutions.find(
    (candidate) => candidate.status === "ready"
  );
  if (!ready || ready.status !== "ready") {
    throw new Error("Expected a ready exact resolution for the extrude body.");
  }
  const artifacts = await buildCurrentExactBodyArtifacts({
    engine,
    resolutions: [ready],
    runtime,
    documentSourceIdentity: createCadProjectSourceIdentity(
      exportCadProject(engine)
    ),
    units: engine.getDocument().units,
    generation: 1,
    assertCurrent: () => undefined,
    executionIntent: "exact",
    requestIdPrefix: "inspection-occt-proof"
  });
  const artifact = artifacts[0];
  if (!artifact) {
    throw new Error("Expected one exact body artifact.");
  }
  return artifact;
}
