import {
  CadEngine,
  exportCadProject,
  type CadBodySnapshot,
  type CadFeatureSummary
} from "@web-cad/cad-core";
import type {
  CadBatchErrorResponse,
  CadBatchSuccessResponse,
  CadGeneratedFaceReference,
  CadOp
} from "@web-cad/cad-protocol";
import {
  deriveGeometrySourceMesh,
  type DerivedHoleGeometrySource
} from "./derivedGeometry";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

export type HoleGeometryPreflightResult =
  | {
      readonly ok: true;
      readonly response: CadBatchSuccessResponse;
    }
  | {
      readonly ok: false;
      readonly reason: "command" | "source" | "runtime";
      readonly message: string;
      readonly response?: CadBatchErrorResponse;
    };

export async function preflightHoleGeometryCommand({
  engine,
  ops,
  bodyId,
  runtime
}: {
  readonly engine: CadEngine;
  readonly ops: readonly CadOp[];
  readonly bodyId?: string;
  readonly runtime: DerivedGeometryRuntime;
}): Promise<HoleGeometryPreflightResult> {
  const projectedEngine = CadEngine.fromProject(exportCadProject(engine));
  const response = projectedEngine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: "command",
      message: response.error.message,
      response
    };
  }

  const projectedBodyId = bodyId ?? response.createdBodyIds?.[0];

  if (!projectedBodyId) {
    return {
      ok: false,
      reason: "source",
      message:
        "Could not create this hole because its resulting body could not be identified."
    };
  }

  const source = findProjectedHoleSource(projectedEngine, projectedBodyId);

  if (!source) {
    return {
      ok: false,
      reason: "source",
      message:
        "Could not create this hole because its display geometry source is unavailable."
    };
  }

  try {
    await deriveGeometrySourceMesh(runtime, source);
  } catch (error) {
    return {
      ok: false,
      reason: "runtime",
      message: formatHoleGeometryPreflightError(error)
    };
  }

  return { ok: true, response };
}

function findProjectedHoleSource(
  engine: CadEngine,
  bodyId: string
): DerivedHoleGeometrySource | undefined {
  const structure = readProjectStructure(engine);
  const generatedFacesByKey = readGeneratedFaceReferencesByKey(
    engine,
    structure.bodies.filter(
      (body) => body.source.type === "sketchExtrudeFeature"
    )
  );
  const sources = createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    structure.features,
    generatedFacesByKey
  );

  return sources.find(
    (source): source is DerivedHoleGeometrySource =>
      source.kind === "hole" && source.id === bodyId
  );
}

function readProjectStructure(engine: CadEngine): {
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  return response.ok && response.query === "project.structure"
    ? {
        features: response.features,
        bodies: response.bodies
      }
    : { features: [], bodies: [] };
}

function readGeneratedFaceReferencesByKey(
  engine: CadEngine,
  bodies: readonly CadBodySnapshot[]
): ReadonlyMap<string, CadGeneratedFaceReference> {
  const facesByKey = new Map<string, CadGeneratedFaceReference>();

  for (const body of bodies) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.generatedReferences",
        bodyId: body.id
      }
    });

    if (!response.ok || response.query !== "body.generatedReferences") {
      continue;
    }

    for (const face of response.faces) {
      facesByKey.set(
        createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
        face
      );
    }
  }

  return facesByKey;
}

function formatHoleGeometryPreflightError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error.";

  return formatVisibleDiagnosticMessage(
    `Could not create this hole on the selected target. ${message}`
  );
}
