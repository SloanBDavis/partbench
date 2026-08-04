import {
  CadEngine,
  createCadProjectSourceIdentity,
  decodeWcadCanonicalCbor,
  exportCadProject,
  sha256Hex,
  type CadFeatureSummary,
  type SketchSnapshot,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadGeneratedFaceReference,
  CadOp,
  FeatureShellOpenFaceRef,
  MirrorPlaneRef,
  PatternDirectionRef,
  PatternRotationAxisRef
} from "@web-cad/cad-protocol";
import {
  createExactBodyArtifactWorkerRequest,
  createExactTopologyCheckpointPayloadWorkerRequest,
  createGeometryKernelWorker,
  type GeometryKernelExactBodyArtifact
} from "@web-cad/geometry-worker";
import { isInvalidExactViewportPickMap } from "@web-cad/geometry-worker/browser";
import { describe, expect, it } from "vitest";

import {
  resolveCurrentExactBodies,
  type CurrentExactBodyResolution,
  type CurrentExactBodyResolverInput
} from "./currentExactBodyResolver";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import {
  createExactMetadataRuntimeInput,
  isExactMetadataSource
} from "./derivedExactMetadata";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import { buildCurrentExactBodyArtifacts } from "./projectExactStepExport";
import { createProjectWcadTopologyCheckpointPayloadInputs } from "./projectWcadTopologyCheckpoints";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

const EDGE_STABLE_ID = "generated:edge:body_seed:longitudinal:uMin:vMin";
const FACE_STABLE_ID = "generated:face:body_seed:endCap";
const EDGE_REFERENCE_NAME = "seed edge";
const FACE_REFERENCE_NAME = "seed face";

type EdgeSelector = "generated" | "named" | "topology";
type PatternSelector = "global" | EdgeSelector;
type MirrorSelector = "standard" | "generated" | "named" | "topology";
type ShellSelector = "closed" | "generated" | "named" | "topology";
type ReadyResolution = Extract<CurrentExactBodyResolution, { status: "ready" }>;

interface SeedTemplate {
  readonly project: ReturnType<typeof exportCadProject>;
  readonly checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[];
  readonly anchorId: string;
}

interface BuiltCase {
  readonly label: string;
  readonly resolution: ReadyResolution;
  readonly artifact: GeometryKernelExactBodyArtifact;
}

describe("V22 exact pick semantic selector bridge", () => {
  it("builds exact pick evidence for the frozen semantic selector roots", async () => {
    const runtime = createLiveRuntime();
    const edgeTemplate = await createSeedTemplate({
      runtime,
      reference: {
        kind: "edge",
        stableId: EDGE_STABLE_ID,
        name: EDGE_REFERENCE_NAME,
        center: [10, 10]
      }
    });
    const faceTemplate = await createSeedTemplate({
      runtime,
      reference: {
        kind: "face",
        stableId: FACE_STABLE_ID,
        name: FACE_REFERENCE_NAME,
        center: [0, 0]
      }
    });
    const plainFaceTemplate = createPlainSeedTemplate({
      kind: "face",
      stableId: FACE_STABLE_ID,
      name: FACE_REFERENCE_NAME,
      center: [0, 0]
    });

    const chamfers: BuiltCase[] = [];
    const fillets: BuiltCase[] = [];
    for (const selector of ["generated", "named", "topology"] as const) {
      chamfers.push(
        await buildCase({
          label: `chamfer:${selector}`,
          template: edgeTemplate,
          runtime,
          finalBodyId: "body_chamfer",
          expectedSourceKind: "edgeFinish",
          expectsArtifactDependency: false,
          apply: (engine) => {
            engine.applyBatch([
              createEdgeFinishOp("chamfer", selector, edgeTemplate.anchorId)
            ]);
            expectEdgeFinishSelector(
              readFeature(engine, "feature_chamfer"),
              "chamfer",
              selector
            );
          }
        })
      );
      fillets.push(
        await buildCase({
          label: `fillet:${selector}`,
          template: edgeTemplate,
          runtime,
          finalBodyId: "body_fillet",
          expectedSourceKind: "edgeFinish",
          expectsArtifactDependency: false,
          apply: (engine) => {
            engine.applyBatch([
              createEdgeFinishOp("fillet", selector, edgeTemplate.anchorId)
            ]);
            expectEdgeFinishSelector(
              readFeature(engine, "feature_fillet"),
              "fillet",
              selector
            );
          }
        })
      );
    }

    const linearPatterns: BuiltCase[] = [];
    const circularPatterns: BuiltCase[] = [];
    for (const selector of [
      "global",
      "generated",
      "named",
      "topology"
    ] as const) {
      linearPatterns.push(
        await buildCase({
          label: `linear-pattern:${selector}`,
          template: edgeTemplate,
          runtime,
          finalBodyId: "body_linear_final",
          expectedSourceKind: "linearPattern",
          expectsArtifactDependency: true,
          apply: (engine) => {
            engine.applyBatch(
              createPatternOps("linear", selector, edgeTemplate.anchorId)
            );
            expectPatternSelector(
              readFeature(engine, "feature_linear_first"),
              "linearPattern",
              selector
            );
            expectPatternSelector(
              readFeature(engine, "feature_linear_final"),
              "linearPattern",
              selector
            );
          }
        })
      );
      circularPatterns.push(
        await buildCase({
          label: `circular-pattern:${selector}`,
          template: edgeTemplate,
          runtime,
          finalBodyId: "body_circular_final",
          expectedSourceKind: "circularPattern",
          expectsArtifactDependency: true,
          apply: (engine) => {
            engine.applyBatch(
              createPatternOps("circular", selector, edgeTemplate.anchorId)
            );
            expectPatternSelector(
              readFeature(engine, "feature_circular_first"),
              "circularPattern",
              selector
            );
            expectPatternSelector(
              readFeature(engine, "feature_circular_final"),
              "circularPattern",
              selector
            );
          }
        })
      );
    }

    const mirrors: BuiltCase[] = [];
    for (const selector of [
      "standard",
      "generated",
      "named",
      "topology"
    ] as const) {
      const template =
        selector === "topology" ? faceTemplate : plainFaceTemplate;
      mirrors.push(
        await buildCase({
          label: `mirror:${selector}`,
          template,
          runtime,
          finalBodyId: "body_mirror_final",
          expectedSourceKind: "mirror",
          expectsArtifactDependency: true,
          apply: (engine) => {
            engine.applyBatch(createMirrorOps(selector, template.anchorId));
            expectMirrorSelector(
              readFeature(engine, "feature_mirror_first"),
              selector
            );
            expectMirrorSelector(
              readFeature(engine, "feature_mirror_final"),
              selector
            );
          }
        })
      );
    }

    const shells: BuiltCase[] = [];
    for (const selector of [
      "closed",
      "generated",
      "named",
      "topology"
    ] as const) {
      const template =
        selector === "topology" ? faceTemplate : plainFaceTemplate;
      shells.push(
        await buildCase({
          label: `shell:${selector}`,
          template,
          runtime,
          finalBodyId: "body_shell",
          expectedSourceKind: "shell",
          expectsArtifactDependency: true,
          apply: (engine) => {
            engine.applyBatch([createShellOp(selector, template.anchorId)]);
            expectShellSelector(readFeature(engine, "feature_shell"), selector);
          }
        })
      );
    }

    expectDistinctIdentities("chamfer", chamfers);
    expectDistinctIdentities("fillet", fillets);
    expectDistinctIdentities("linear pattern", linearPatterns);
    expectDistinctIdentities("circular pattern", circularPatterns);
    expectDistinctIdentities("mirror", mirrors);
    expectDistinctIdentities("shell", shells);

    const finalCases = [
      ...chamfers,
      ...fillets,
      ...linearPatterns,
      ...circularPatterns,
      ...mirrors,
      ...shells
    ];
    expect(finalCases).toHaveLength(22);
    expectDistinctIdentities("all semantic roots", finalCases);
    for (const result of finalCases) {
      expectReadyExactViewportPickMap(result.artifact, result.label);
    }
  }, 180_000);
});

function createEdgeFinishOp(
  kind: "chamfer" | "fillet",
  selector: EdgeSelector,
  anchorId: string
): CadOp {
  const reference = createEdgeFinishReference(selector, anchorId);
  if (kind === "chamfer") {
    return {
      op: "feature.chamfer",
      id: "feature_chamfer",
      bodyId: "body_chamfer",
      targetBodyId: "body_seed",
      distance: 0.2,
      ...reference
    };
  }
  return {
    op: "feature.fillet",
    id: "feature_fillet",
    bodyId: "body_fillet",
    targetBodyId: "body_seed",
    radius: 0.2,
    ...reference
  };
}

function createEdgeFinishReference(
  selector: EdgeSelector,
  anchorId: string
): Pick<
  Extract<CadOp, { op: "feature.chamfer" }>,
  "edgeStableId" | "namedReference" | "topologyAnchorId"
> {
  switch (selector) {
    case "generated":
      return { edgeStableId: EDGE_STABLE_ID };
    case "named":
      return { namedReference: EDGE_REFERENCE_NAME };
    case "topology":
      return { topologyAnchorId: anchorId };
  }
}

function createPatternOps(
  kind: "linear" | "circular",
  selector: PatternSelector,
  anchorId: string
): readonly CadOp[] {
  const reference = createPatternReference(selector, anchorId);
  if (kind === "linear") {
    return [
      {
        op: "feature.linearPattern",
        id: "feature_linear_first",
        bodyId: "body_linear_first",
        seedBodyId: "body_seed",
        direction: reference,
        spacing: 4,
        instanceCount: 2
      },
      {
        op: "feature.linearPattern",
        id: "feature_linear_final",
        bodyId: "body_linear_final",
        seedBodyId: "body_linear_first",
        direction: reference,
        spacing: 4,
        instanceCount: 2
      }
    ];
  }
  return [
    {
      op: "feature.circularPattern",
      id: "feature_circular_first",
      bodyId: "body_circular_first",
      seedBodyId: "body_seed",
      rotationAxis: reference,
      totalAngleDegrees: 180,
      instanceCount: 2
    },
    {
      op: "feature.circularPattern",
      id: "feature_circular_final",
      bodyId: "body_circular_final",
      seedBodyId: "body_circular_first",
      rotationAxis: reference,
      totalAngleDegrees: 180,
      instanceCount: 2
    }
  ];
}

function createPatternReference(
  selector: PatternSelector,
  anchorId: string
): PatternDirectionRef & PatternRotationAxisRef {
  switch (selector) {
    case "global":
      return { kind: "globalAxis", axis: "z" };
    case "generated":
      return {
        kind: "generatedEdge",
        bodyId: "body_seed",
        stableId: EDGE_STABLE_ID
      };
    case "named":
      return { kind: "namedReference", name: EDGE_REFERENCE_NAME };
    case "topology":
      return { kind: "topologyAnchor", bodyId: "body_seed", anchorId };
  }
}

function createMirrorOps(
  selector: MirrorSelector,
  anchorId: string
): readonly CadOp[] {
  const plane = createMirrorPlane(selector, anchorId);
  return [
    {
      op: "feature.mirror",
      id: "feature_mirror_first",
      bodyId: "body_mirror_first",
      seedBodyId: "body_seed",
      plane,
      includeOriginal: false
    },
    {
      op: "feature.mirror",
      id: "feature_mirror_final",
      bodyId: "body_mirror_final",
      seedBodyId: "body_mirror_first",
      plane,
      includeOriginal: false
    }
  ];
}

function createMirrorPlane(
  selector: MirrorSelector,
  anchorId: string
): MirrorPlaneRef {
  switch (selector) {
    case "standard":
      return { kind: "standardPlane", plane: "XY", offset: 2 };
    case "generated":
      return {
        kind: "generatedFace",
        bodyId: "body_seed",
        stableId: FACE_STABLE_ID
      };
    case "named":
      return { kind: "namedReference", name: FACE_REFERENCE_NAME };
    case "topology":
      return { kind: "topologyAnchor", bodyId: "body_seed", anchorId };
  }
}

function createShellOp(selector: ShellSelector, anchorId: string): CadOp {
  return {
    op: "feature.shell",
    id: "feature_shell",
    bodyId: "body_shell",
    targetBodyId: "body_seed",
    wallThickness: 0.2,
    openFaceRefs: createShellOpenFaceRefs(selector, anchorId)
  };
}

function createShellOpenFaceRefs(
  selector: ShellSelector,
  anchorId: string
): readonly FeatureShellOpenFaceRef[] {
  switch (selector) {
    case "closed":
      return [];
    case "generated":
      return [
        {
          kind: "generatedFace",
          bodyId: "body_seed",
          stableId: FACE_STABLE_ID
        }
      ];
    case "named":
      return [{ kind: "namedReference", name: FACE_REFERENCE_NAME }];
    case "topology":
      return [{ kind: "topologyAnchor", bodyId: "body_seed", anchorId }];
  }
}

type SeedReference = {
  readonly kind: "edge" | "face";
  readonly stableId: string;
  readonly name: string;
  readonly center: readonly [number, number];
};

function createSeedEngine(reference: SeedReference): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_seed",
      name: "Seed",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_seed",
      id: "rect_seed",
      center: reference.center,
      width: 2,
      height: 2
    },
    {
      op: "feature.extrude",
      id: "feature_seed",
      bodyId: "body_seed",
      sketchId: "sketch_seed",
      entityId: "rect_seed",
      depth: 2,
      operationMode: "newBody"
    },
    {
      op: "reference.nameGenerated",
      name: reference.name,
      bodyId: "body_seed",
      stableId: reference.stableId
    }
  ]);
  return engine;
}

function createPlainSeedTemplate(reference: SeedReference): SeedTemplate {
  return {
    project: exportCadProject(createSeedEngine(reference)),
    checkpointPayloads: [],
    anchorId: ""
  };
}

async function createSeedTemplate({
  runtime,
  reference
}: {
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactTopologyCheckpointPayload"
  >;
  readonly reference: SeedReference;
}): Promise<SeedTemplate> {
  const engine = createSeedEngine(reference);
  const resolution = readReadyResolution(
    createResolverContext(engine, []).resolutions,
    "body_seed",
    `${reference.kind} anchor seed`
  );
  const checkpointId = `checkpoint_seed_${reference.kind}`;
  if (!isExactMetadataSource(resolution.source)) {
    throw new Error(`Expected an exact ${reference.kind} seed source.`);
  }
  const checkpoint = await runtime.exactTopologyCheckpointPayload({
    id: `v22-${reference.kind}-anchor`,
    checkpointId,
    bodyId: "body_seed",
    source: createExactMetadataRuntimeInput(resolution.source).source
  });
  const entity = checkpoint.checkpointPayload.topologySnapshot.entities.find(
    (candidate) =>
      candidate.kind === reference.kind &&
      (reference.kind === "edge"
        ? candidate.midpoint?.every(
            (coordinate, index) =>
              Math.abs(coordinate - ([9, 9, 1] as const)[index]!) < 1e-6
          ) && Math.abs(Math.abs(candidate.axis?.[2] ?? 0) - 1) < 1e-6
        : candidate.bounds !== undefined &&
          Math.abs(candidate.bounds.min[2] - 2) < 1e-6 &&
          Math.abs(candidate.bounds.max[2] - 2) < 1e-6)
  );
  if (!entity) {
    throw new Error(`Expected the exact seed ${reference.kind} entity.`);
  }
  const anchorId = `anchor_seed_${reference.kind}`;
  engine.applyBatch([
    {
      op: "topology.checkpoint.create",
      checkpointId,
      bodyId: "body_seed",
      sourceFeatureId: "feature_seed",
      sourceIdentity: createCadProjectSourceIdentity(exportCadProject(engine)),
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId,
      entityKind: reference.kind,
      bodyId: "body_seed",
      checkpointId,
      checkpointEntityId: entity.localId,
      sourceFeatureId: "feature_seed",
      stableId: reference.stableId,
      sourceSemanticRole:
        reference.kind === "edge" ? "longitudinal:uMin:vMin" : "endCap",
      signatureHash: entity.signature
    }
  ]);
  const checkpointPayloads =
    await createProjectWcadTopologyCheckpointPayloadInputs({
      document: engine.getDocument(),
      features: readStructure(engine).features,
      sketches: readSketches(engine),
      runtime
    });
  assertCheckpointPayload(checkpointPayloads[0], `${reference.kind} seed`, {
    sourceKind: checkpoint.checkpointPayload.sourceKind,
    topologySignature: checkpoint.checkpointPayload.topologySnapshot.signature
  });
  if (checkpointPayloads.length === 0) {
    throw new Error(
      `Expected a real checkpoint payload for ${reference.kind}.`
    );
  }
  return {
    project: exportCadProject(engine),
    checkpointPayloads,
    anchorId
  };
}

async function buildCase({
  label,
  template,
  runtime,
  finalBodyId,
  expectedSourceKind,
  expectsArtifactDependency,
  apply
}: {
  readonly label: string;
  readonly template: SeedTemplate;
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot"
  >;
  readonly finalBodyId: string;
  readonly expectedSourceKind: string;
  readonly expectsArtifactDependency: boolean;
  readonly apply: (engine: CadEngine) => void;
}): Promise<BuiltCase> {
  const engine = CadEngine.fromProject(template.project);
  try {
    apply(engine);
  } catch (error) {
    throw new Error(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  const checkpointPayloads = structuredClone(template.checkpointPayloads);
  if (checkpointPayloads[0]) {
    assertCheckpointPayload(
      checkpointPayloads[0],
      `${label}: cloned checkpoint`
    );
  }
  const resolution = readReadyResolution(
    createResolverContext(engine, checkpointPayloads).resolutions,
    finalBodyId,
    label
  );
  expect(resolution.source.kind, `${label}: resolver source`).toBe(
    expectedSourceKind
  );
  expect(
    resolution.artifactDependency !== undefined,
    `${label}: resolver artifact dependency`
  ).toBe(expectsArtifactDependency);
  const sourceIdentity = createCadProjectSourceIdentity(
    exportCadProject(engine)
  );
  let artifacts: readonly GeometryKernelExactBodyArtifact[];
  try {
    artifacts = await buildCurrentExactBodyArtifacts({
      engine,
      resolutions: [resolution],
      runtime,
      documentSourceIdentity: sourceIdentity,
      units: engine.getDocument().units,
      assertCurrent: () => {
        const current = createCadProjectSourceIdentity(
          exportCadProject(engine)
        );
        if (
          current.algorithm !== sourceIdentity.algorithm ||
          current.sha256 !== sourceIdentity.sha256
        ) {
          throw new Error(
            `${label}: document source identity changed during build.`
          );
        }
      },
      executionIntent: "exact",
      requestIdPrefix: `v22-semantic-pick:${label}`
    });
  } catch (error) {
    throw new Error(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  const artifact = artifacts.find(
    (candidate) => candidate.bodyId === finalBodyId
  );
  if (!artifact) {
    throw new Error(
      `${label}: no exact artifact was built for ${finalBodyId}.`
    );
  }
  return { label, resolution, artifact };
}

function createLiveRuntime(): Pick<
  DerivedGeometryRuntime,
  | "exactBodyArtifact"
  | "exactTopologyCheckpointPayload"
  | "getModelWorkSnapshot"
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
    },
    async exactTopologyCheckpointPayload(input) {
      const response = await worker.execute(
        createExactTopologyCheckpointPayloadWorkerRequest({
          id: input.id,
          checkpointId: input.checkpointId,
          bodyId: input.bodyId,
          source: input.source
        })
      );
      if (
        !response.response.ok ||
        response.response.op !== "geometry.exactTopologyCheckpointPayload"
      ) {
        throw new Error(
          response.response.ok
            ? "Expected an exact topology checkpoint payload response."
            : response.response.error.message
        );
      }
      return {
        checkpointPayload: response.response.checkpointPayload,
        metrics: { objectId: input.bodyId, roundTripMs: 0 },
        message: `Built topology checkpoint payload for ${input.bodyId}.`
      };
    }
  };
}

function createResolverContext(
  engine: CadEngine,
  checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[]
): {
  readonly input: CurrentExactBodyResolverInput;
  readonly resolutions: readonly CurrentExactBodyResolution[];
} {
  const structure = readStructure(engine);
  const signatures = new Map<string, string>();
  const faces = new Map<string, CadGeneratedFaceReference>();
  for (const body of structure.bodies) {
    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: body.id }
    });
    if (topology.ok && topology.query === "body.topology") {
      signatures.set(body.id, topology.topology.sourceIdentity.signature);
    }
    const generated = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: body.id }
    });
    if (generated.ok && generated.query === "body.generatedReferences") {
      for (const face of generated.faces) {
        faces.set(
          createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
          face
        );
      }
    }
  }
  const document = engine.getDocument();
  const geometrySources = createDerivedGeometrySourcesFromDocument(
    document,
    structure.features,
    faces,
    signatures
  );
  const input: CurrentExactBodyResolverInput = {
    document,
    bodies: structure.bodies,
    features: structure.features,
    geometrySources,
    artifactGeometrySources: createDerivedGeometrySourcesFromDocument(
      document,
      structure.features,
      faces,
      signatures,
      true
    ),
    checkpointPayloads,
    sourceIdentitySignaturesByBodyId: signatures
  };
  return { input, resolutions: resolveCurrentExactBodies(input) };
}

function readStructure(engine: CadEngine): {
  readonly bodies: readonly CadBodySnapshot[];
  readonly features: readonly CadFeatureSummary[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure response.");
  }
  return response;
}

function readSketches(engine: CadEngine): readonly SketchSnapshot[] {
  return [...engine.getDocument().sketches.values()].map((sketch) => ({
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    attachment: sketch.attachment,
    entities: [...sketch.entities.values()]
  }));
}

function readFeature(engine: CadEngine, featureId: string): CadFeatureSummary {
  const feature = readStructure(engine).features.find(
    (candidate) => candidate.id === featureId
  );
  if (!feature) throw new Error(`Expected feature ${featureId}.`);
  return feature;
}

function readReadyResolution(
  resolutions: readonly CurrentExactBodyResolution[],
  bodyId: string,
  label: string
): ReadyResolution {
  const resolution = resolutions.find(
    (candidate) => candidate.bodyId === bodyId
  );
  if (!resolution || resolution.status !== "ready") {
    const diagnostic =
      resolution?.diagnostics[0]?.message ?? "missing resolution";
    throw new Error(`${label}: final exact body is not ready: ${diagnostic}`);
  }
  return resolution;
}

function expectEdgeFinishSelector(
  feature: CadFeatureSummary,
  kind: "chamfer" | "fillet",
  selector: EdgeSelector
): void {
  expect(feature.kind).toBe(kind);
  if (feature.kind !== kind) return;
  if (selector === "generated") {
    expect(feature.edgeStableId).toBe(EDGE_STABLE_ID);
    expect(feature.namedReference).toBeUndefined();
    expect(feature.topologyAnchorId).toBeUndefined();
    return;
  }
  if (selector === "named") {
    expect(feature.namedReference).toBe(EDGE_REFERENCE_NAME);
    expect(feature.edgeStableId).toBeUndefined();
    expect(feature.topologyAnchorId).toBeUndefined();
    return;
  }
  expect(feature.topologyAnchorId).toBe("anchor_seed_edge");
  expect(feature.edgeStableId).toBe(EDGE_STABLE_ID);
  expect(feature.namedReference).toBeUndefined();
}

function expectPatternSelector(
  feature: CadFeatureSummary,
  kind: "linearPattern" | "circularPattern",
  selector: PatternSelector
): void {
  expect(feature.kind).toBe(kind);
  if (feature.kind !== kind) return;
  const reference =
    feature.kind === "linearPattern" ? feature.direction : feature.rotationAxis;
  expect(reference).toEqual(
    selector === "global"
      ? { kind: "globalAxis", axis: "z" }
      : selector === "generated"
        ? {
            kind: "generatedEdge",
            bodyId: "body_seed",
            stableId: EDGE_STABLE_ID
          }
        : selector === "named"
          ? { kind: "namedReference", name: EDGE_REFERENCE_NAME }
          : {
              kind: "topologyAnchor",
              bodyId: "body_seed",
              anchorId: "anchor_seed_edge"
            }
  );
}

function expectMirrorSelector(
  feature: CadFeatureSummary,
  selector: MirrorSelector
): void {
  expect(feature.kind).toBe("mirror");
  if (feature.kind !== "mirror") return;
  expect(feature.plane).toEqual(
    selector === "standard"
      ? { kind: "standardPlane", plane: "XY", offset: 2 }
      : selector === "generated"
        ? {
            kind: "generatedFace",
            bodyId: "body_seed",
            stableId: FACE_STABLE_ID,
            offset: 0
          }
        : selector === "named"
          ? { kind: "namedReference", name: FACE_REFERENCE_NAME, offset: 0 }
          : {
              kind: "topologyAnchor",
              bodyId: "body_seed",
              anchorId: "anchor_seed_face",
              offset: 0
            }
  );
  expect(feature.includeOriginal).toBe(false);
}

function expectShellSelector(
  feature: CadFeatureSummary,
  selector: ShellSelector
): void {
  expect(feature.kind).toBe("shell");
  if (feature.kind !== "shell") return;
  if (selector === "closed") {
    expect(feature.openFaceRefs).toEqual([]);
    return;
  }
  expect(feature.openFaceRefs).toHaveLength(1);
  expect(feature.openFaceRefs[0]).toEqual(
    selector === "generated"
      ? {
          kind: "generatedFace",
          bodyId: "body_seed",
          stableId: FACE_STABLE_ID
        }
      : selector === "named"
        ? { kind: "namedReference", name: FACE_REFERENCE_NAME }
        : {
            kind: "topologyAnchor",
            bodyId: "body_seed",
            anchorId: "anchor_seed_face"
          }
  );
}

function expectDistinctIdentities(
  label: string,
  cases: readonly BuiltCase[]
): void {
  expect(
    new Set(
      cases.map((candidate) => candidate.resolution.sourceIdentitySignature)
    ).size,
    `${label}: source identity signatures`
  ).toBe(cases.length);
  expect(
    new Set(cases.map((candidate) => candidate.resolution.cacheKeySha256)).size,
    `${label}: exact artifact cache keys`
  ).toBe(cases.length);
}

function assertCheckpointPayload(
  payload: WcadTopologyCheckpointPayloadInput | undefined,
  label: string,
  expected?: {
    readonly sourceKind: string;
    readonly topologySignature: string;
  }
): asserts payload is WcadTopologyCheckpointPayloadInput {
  if (
    !payload ||
    payload.brepByteLength !== payload.brepBytes.byteLength ||
    payload.brepSha256 !== sha256Hex(payload.brepBytes)
  ) {
    throw new Error(`${label}: invalid checkpoint B-rep evidence.`);
  }
  const signature = decodeWcadCanonicalCbor(payload.signatureBytes);
  const topology = decodeWcadCanonicalCbor(payload.topologyBytes);
  if (
    typeof signature !== "object" ||
    signature === null ||
    !("checkpointId" in signature) ||
    signature.checkpointId !== payload.checkpointId ||
    !("signature" in signature) ||
    typeof signature.signature !== "string" ||
    typeof topology !== "object" ||
    topology === null ||
    !("signature" in topology) ||
    topology.signature !== signature.signature ||
    !("sourceKind" in topology) ||
    typeof topology.sourceKind !== "string" ||
    (expected !== undefined &&
      (topology.sourceKind !== expected.sourceKind ||
        topology.signature !== expected.topologySignature))
  ) {
    throw new Error(`${label}: invalid checkpoint topology evidence.`);
  }
}

function expectReadyExactViewportPickMap(
  artifact: GeometryKernelExactBodyArtifact,
  label: string
): void {
  const pickMap = artifact.viewportPickMap;
  expect(pickMap, label).toBeDefined();
  if (!pickMap) throw new Error(`${label}: expected exact pick evidence.`);
  expect(isInvalidExactViewportPickMap(pickMap, artifact), label).toBe(false);
  expect(pickMap.faces.length, `${label}: faces`).toBeGreaterThan(0);
  expect(pickMap.edges.length, `${label}: edges`).toBeGreaterThan(0);
  expect(pickMap.vertices.length, `${label}: vertices`).toBeGreaterThan(0);
}
