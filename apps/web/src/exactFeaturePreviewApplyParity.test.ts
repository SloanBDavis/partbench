import {
  CadEngine,
  createCadProjectSourceIdentity,
  createV15ReleaseSampleBatch,
  exportCadProject,
  exportCadProjectJson,
  type CadBatch,
  type CadFeatureSummary
} from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadGeneratedFaceReference
} from "@web-cad/cad-protocol";
import {
  createExactBodyArtifactWorkerRequest,
  createGeometryKernelWorker,
  type GeometryKernelExactBodyArtifact
} from "@web-cad/geometry-worker";
import { describe, expect, it } from "vitest";

import {
  resolveCurrentExactBodies,
  type CurrentExactBodyArtifactEvidence,
  type CurrentExactBodyResolution
} from "./currentExactBodyResolver";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createDerivedGeometrySourcesFromDocument,
  removeConsumedDerivedGeometrySources
} from "./derivedGeometrySources";
import { projectExactFeaturePreviewGeometry } from "./exactFeaturePreviewGeometry";
import { buildCurrentExactBodyArtifacts } from "./projectExactStepExport";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

const OCCT_PREVIEW_APPLY_PARITY_TIMEOUT_MS = 120_000;
const SAMPLE_BATCH = createV15ReleaseSampleBatch("v15-linear-pattern");
const EXTRUDE_CREATE: CadBatch = {
  ...SAMPLE_BATCH,
  ops: SAMPLE_BATCH.ops.slice(0, 3)
};
const PATTERN_CREATE: CadBatch = {
  ...SAMPLE_BATCH,
  ops: SAMPLE_BATCH.ops.slice(0, 4)
};
const PATTERN_UPDATE: CadBatch = {
  version: "cadops.v1",
  mode: "commit",
  ops: [
    {
      op: "feature.updateLinearPattern",
      id: "v15_linear_pattern_feature",
      spacing: 50
    }
  ]
};

describe("V22 preview/Apply same-shape OCCT parity", () => {
  it(
    "matches committed extrude create topology, mass, and display without consuming preview as proof",
    async () => {
      await expectPreviewApplySameShape(EXTRUDE_CREATE, [
        "v15_linear_seed_body"
      ]);
    },
    OCCT_PREVIEW_APPLY_PARITY_TIMEOUT_MS
  );

  it(
    "matches committed linear-pattern update topology, mass, and display without consuming preview as proof",
    async () => {
      const engine = new CadEngine();
      const created = engine.executeBatch(PATTERN_CREATE);
      expect(created.ok).toBe(true);
      await expectPreviewApplySameShape(
        PATTERN_UPDATE,
        ["v15_linear_result_body"],
        engine
      );
    },
    OCCT_PREVIEW_APPLY_PARITY_TIMEOUT_MS
  );
});

async function expectPreviewApplySameShape(
  batch: CadBatch,
  expectedBodyIds: readonly string[],
  engine = new CadEngine()
): Promise<void> {
  const runtime = createLivePreviewRuntime();
  const beforeProject = exportCadProjectJson(engine);
  const beforeTransactions = engine.getTransactions();
  const beforeEpoch = engine.getSourceAuthorityEpoch();

  const preview = await projectExactFeaturePreviewGeometry({
    engine,
    batch,
    runtime
  });

  expect(preview.affectedBodyIds).toEqual(expectedBodyIds);
  expect(preview.artifacts.map((artifact) => artifact.bodyId)).toEqual(
    expectedBodyIds
  );
  expect(exportCadProjectJson(engine)).toBe(beforeProject);
  expect(engine.getTransactions()).toEqual(beforeTransactions);
  expect(engine.getSourceAuthorityEpoch()).toBe(beforeEpoch);

  const applied = engine.executeBatch(batch);
  expect(applied.ok).toBe(true);
  expect(applied).toEqual(preview.response);
  expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
    preview.projectedSourceIdentity
  );

  const committedArtifacts = await buildCommittedExactArtifacts({
    engine,
    bodyIds: expectedBodyIds,
    runtime
  });
  expect(committedArtifacts.map((artifact) => artifact.bodyId)).toEqual(
    expectedBodyIds
  );
  expect(committedArtifacts).not.toBe(preview.artifacts);
  for (const [index, previewArtifact] of preview.artifacts.entries()) {
    expectSameShapeArtifact(previewArtifact, committedArtifacts[index]!);
  }
}

function expectSameShapeArtifact(
  preview: GeometryKernelExactBodyArtifact,
  applied: GeometryKernelExactBodyArtifact
): void {
  expect(applied.bodyId).toBe(preview.bodyId);
  expect(applied.sourceType).toBe(preview.sourceType);
  expect(applied.sourceKind).toBe(preview.sourceKind);
  expect(applied.topologySnapshot.signature).toBe(
    preview.topologySnapshot.signature
  );
  expect(applied.topologySnapshot.entityCounts).toEqual(
    preview.topologySnapshot.entityCounts
  );
  expect(applied.metadata.volume).toBeCloseTo(preview.metadata.volume, 6);
  expect(applied.metadata.surfaceArea).toBeCloseTo(
    preview.metadata.surfaceArea,
    6
  );
  expect(applied.metadata.centroid[0]).toBeCloseTo(
    preview.metadata.centroid[0],
    6
  );
  expect(applied.metadata.centroid[1]).toBeCloseTo(
    preview.metadata.centroid[1],
    6
  );
  expect(applied.metadata.centroid[2]).toBeCloseTo(
    preview.metadata.centroid[2],
    6
  );
  expect(applied.displayMesh.vertexCount).toBe(preview.displayMesh.vertexCount);
  expect(applied.displayMesh.triangleCount).toBe(
    preview.displayMesh.triangleCount
  );
  expect(applied.displayMesh.faceCount).toBe(preview.displayMesh.faceCount);
}

async function buildCommittedExactArtifacts(input: {
  readonly engine: CadEngine;
  readonly bodyIds: readonly string[];
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot" | "resumeModelWork"
  >;
}): Promise<readonly CurrentExactBodyArtifactEvidence[]> {
  const state = readCommittedState(input.engine);
  const artifactGeometrySources = createDerivedGeometrySourcesFromDocument(
    input.engine.getDocument(),
    state.features,
    state.generatedFacesByKey,
    state.sourceIdentitySignaturesByBodyId,
    true
  );
  const resolutions = resolveCurrentExactBodies({
    document: input.engine.getDocument(),
    bodies: state.bodies,
    features: state.features,
    geometrySources: removeConsumedDerivedGeometrySources(
      artifactGeometrySources,
      state.features
    ),
    artifactGeometrySources,
    sourceIdentitySignaturesByBodyId: state.sourceIdentitySignaturesByBodyId
  });
  const readyResolutions: Extract<
    CurrentExactBodyResolution,
    { readonly status: "ready" }
  >[] = [];
  for (const bodyId of input.bodyIds) {
    const ready = resolutions.find(
      (
        candidate
      ): candidate is Extract<
        CurrentExactBodyResolution,
        { readonly status: "ready" }
      > => candidate.bodyId === bodyId && candidate.status === "ready"
    );
    if (!ready) {
      throw new Error(
        `Expected a ready committed exact resolution for ${bodyId}.`
      );
    }
    readyResolutions.push(ready);
  }
  input.runtime.resumeModelWork();
  return buildCurrentExactBodyArtifacts({
    engine: input.engine,
    resolutions: readyResolutions,
    runtime: input.runtime,
    documentSourceIdentity: createCadProjectSourceIdentity(
      exportCadProject(input.engine)
    ),
    units: input.engine.getDocument().units,
    generation: input.runtime.getModelWorkSnapshot().generation,
    assertCurrent: () => undefined,
    executionIntent: "exact",
    requestIdPrefix: "feature-apply-artifact"
  });
}

function readCommittedState(engine: CadEngine): {
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>;
  readonly generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>;
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  const features =
    response.ok && response.query === "project.structure"
      ? response.features
      : [];
  const bodies =
    response.ok && response.query === "project.structure"
      ? response.bodies
      : [];
  const sourceIdentitySignaturesByBodyId = new Map<string, string>();
  const generatedFacesByKey = new Map<string, CadGeneratedFaceReference>();
  for (const body of bodies) {
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
  return {
    features,
    bodies,
    sourceIdentitySignaturesByBodyId,
    generatedFacesByKey
  };
}

function createLivePreviewRuntime(): Pick<
  DerivedGeometryRuntime,
  "exactBodyArtifact" | "getModelWorkSnapshot" | "resumeModelWork"
> {
  const worker = createGeometryKernelWorker();
  const snapshot = {
    generation: 1,
    stopped: false,
    active: false,
    queuedCount: 0,
    cancelledUserKinds: [] as const
  };
  return {
    getModelWorkSnapshot: () => snapshot,
    resumeModelWork() {
      return 0;
    },
    async exactBodyArtifact(input) {
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
}
