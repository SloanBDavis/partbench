import {
  encodeWcadCanonicalCbor,
  type CadProjectImportStepResolver,
  type CadProjectImportStepResolverInput,
  type CadProjectImportStepResolverResult
} from "@web-cad/cad-core";
import type {
  CadStepImportDiagnostic,
  CadStepImportTransientPayloadRef,
  ProjectImportStepResolvedBody,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";
import type { GeometryKernelStepImportDiagnostic } from "@web-cad/geometry-worker";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";

export interface ProjectStepImportPayloadStore {
  putPayload(payloadId: string, bytes: Uint8Array): void;
  readPayload(
    payloadRef: CadStepImportTransientPayloadRef
  ): Uint8Array | undefined;
  deletePayload(payloadId: string): void;
  clear(): void;
}

export interface ProjectStepImportResolverInput {
  readonly getRuntime: () => Pick<DerivedGeometryRuntime, "importStep">;
  readonly payloadStore: ProjectStepImportPayloadStore;
}

export function createProjectStepImportPayloadStore(): ProjectStepImportPayloadStore {
  const payloadsById = new Map<string, Uint8Array>();

  return {
    putPayload(payloadId, bytes) {
      payloadsById.set(payloadId, new Uint8Array(bytes));
    },
    readPayload(payloadRef) {
      const bytes = payloadsById.get(payloadRef.payloadId);

      return bytes ? new Uint8Array(bytes) : undefined;
    },
    deletePayload(payloadId) {
      payloadsById.delete(payloadId);
    },
    clear() {
      payloadsById.clear();
    }
  };
}

export function createProjectStepImportResolver({
  getRuntime,
  payloadStore
}: ProjectStepImportResolverInput): CadProjectImportStepResolver {
  return {
    async resolveProjectImportStep(input) {
      return resolveProjectImportStep({
        input,
        runtime: getRuntime(),
        payloadStore
      });
    }
  };
}

async function resolveProjectImportStep({
  input,
  runtime,
  payloadStore
}: {
  readonly input: CadProjectImportStepResolverInput;
  readonly runtime: Pick<DerivedGeometryRuntime, "importStep">;
  readonly payloadStore: ProjectStepImportPayloadStore;
}): Promise<CadProjectImportStepResolverResult> {
  const bytes = payloadStore.readPayload(input.op.payloadRef);

  if (!bytes) {
    throw new Error(
      `STEP import payload ${input.op.payloadRef.payloadId} is no longer available.`
    );
  }

  validatePayloadRef(input.op.payloadRef, bytes);
  await validatePayloadHash(input.op.payloadRef, bytes);

  const sourceIdentity = await createStepImportSourceIdentity(bytes);
  const result = await runtime.importStep({
    id: input.op.payloadRef.payloadId,
    sourceFileName: input.op.sourceFileName,
    bytes,
    maxBodyCount: input.op.maxBodyCount ?? 1,
    bodyId: input.bodyId,
    checkpointId: input.checkpointId
  });

  if (result.bodyCount !== 1 || result.bodies.length !== 1) {
    throw new Error(
      `STEP import returned ${result.bodyCount} bodies; this command path currently commits one imported body per operation.`
    );
  }

  const body = result.bodies[0];

  if (!body) {
    throw new Error("STEP import did not return an imported body payload.");
  }

  const diagnostics = [
    ...mapStepImportDiagnostics(result.diagnostics, input),
    ...mapStepImportDiagnostics(body.diagnostics, input)
  ];
  const resolvedBody: ProjectImportStepResolvedBody = {
    featureId: input.featureId,
    bodyId: input.bodyId,
    checkpointId: input.checkpointId,
    ...(body.bodyName ? { name: body.bodyName } : {}),
    sourceIdentity,
    checkpointStatus: "active",
    healingApplied: body.healingApplied,
    ...(diagnostics.length > 0 ? { diagnostics } : {})
  };

  return {
    resolvedBodies: [resolvedBody],
    checkpointPayloads: [
      {
        checkpointId: input.checkpointId,
        bodyId: input.bodyId,
        sourceFeatureId: input.featureId,
        units: input.document.units,
        kernel: {
          boundary: "geometry-kernel",
          snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
        },
        tolerance: {
          linearTolerance: 0.001,
          angularToleranceDegrees: 0.01
        },
        brepBytes: body.checkpointPayload.brepBytes,
        topologyBytes: encodeWcadCanonicalCbor(body.topologySnapshot),
        signatureBytes: encodeWcadCanonicalCbor(
          body.checkpointPayload.signaturePayload
        )
      }
    ],
    diagnostics
  };
}

function validatePayloadRef(
  payloadRef: CadStepImportTransientPayloadRef,
  bytes: Uint8Array
): void {
  if (bytes.byteLength !== payloadRef.byteLength) {
    throw new Error(
      `STEP import payload ${payloadRef.payloadId} byte length changed before commit.`
    );
  }
}

async function validatePayloadHash(
  payloadRef: CadStepImportTransientPayloadRef,
  bytes: Uint8Array
): Promise<void> {
  if (!payloadRef.sha256) {
    return;
  }

  const sha256 = await sha256Hex(bytes);

  if (sha256 !== payloadRef.sha256) {
    throw new Error(
      `STEP import payload ${payloadRef.payloadId} hash changed before commit.`
    );
  }
}

async function createStepImportSourceIdentity(
  bytes: Uint8Array
): Promise<WcadSourceIdentity> {
  return {
    algorithm: "partbench-source-v1",
    sha256: await sha256Hex(bytes)
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);

  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function mapStepImportDiagnostics(
  diagnostics: readonly GeometryKernelStepImportDiagnostic[],
  input: CadProjectImportStepResolverInput
): readonly CadStepImportDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    featureId: input.featureId,
    bodyId: input.bodyId,
    checkpointId: input.checkpointId
  }));
}
