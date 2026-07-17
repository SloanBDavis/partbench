import type {
  CadBodyGeneratedReferenceEdgeEvidence,
  CadBodyGeneratedReferenceEvidenceSnapshot,
  CadBodyGeneratedReferenceFaceEvidence
} from "@web-cad/cad-protocol";
import type { GeometryKernelGeneratedReferences } from "@web-cad/geometry-worker";

import type {
  DerivedExtrudeGeometrySource,
  DerivedGeometrySnapshot,
  DerivedGeometrySource
} from "./derivedGeometry";

export function createBodyGeneratedReferenceEvidence(
  bodyId: string,
  sourceIdentitySignature: string,
  snapshot: DerivedGeometrySnapshot,
  sources: readonly DerivedGeometrySource[]
): CadBodyGeneratedReferenceEvidenceSnapshot | undefined {
  const source = sources.find(
    (candidate): candidate is DerivedExtrudeGeometrySource =>
      candidate.id === bodyId && candidate.kind === "extrude"
  );
  const entry = snapshot.entries.find(
    (candidate) => candidate.objectId === bodyId
  );

  if (
    !source ||
    source.profile.kind !== "wire" ||
    entry?.status !== "ready" ||
    !entry.generatedReferences ||
    entry.generatedReferences.sourceIdentity !== source.profile.sourceIdentity
  ) {
    return undefined;
  }

  const generatedReferences = entry.generatedReferences;
  const base = {
    bodyId,
    sourceIdentitySignature,
    recipeIdentity: generatedReferences.sourceIdentity
  };

  if (
    generatedReferences.status === "ready" &&
    generatedReferences.diagnostic === undefined
  ) {
    const evidence = validateReadyGeneratedReferenceEvidence(
      generatedReferences.faces,
      generatedReferences.edges
    );
    if (!evidence) {
      return undefined;
    }

    return {
      ...base,
      status: "ready",
      ...evidence
    };
  }

  if (generatedReferences.status === "ready") {
    return undefined;
  }

  return {
    ...base,
    status: generatedReferences.status,
    faces: [],
    edges: [],
    diagnostic:
      generatedReferences.diagnostic ??
      "Kernel generated-reference correspondence was not proven."
  };
}

function validateReadyGeneratedReferenceEvidence(
  faces: GeometryKernelGeneratedReferences["faces"],
  edges: GeometryKernelGeneratedReferences["edges"]
):
  | {
      readonly faces: readonly CadBodyGeneratedReferenceFaceEvidence[];
      readonly edges: readonly CadBodyGeneratedReferenceEdgeEvidence[];
    }
  | undefined {
  const validatedFaces: CadBodyGeneratedReferenceFaceEvidence[] = [];
  for (const face of faces) {
    if (face.role === "startCap" || face.role === "endCap") {
      if (face.sourceEntityId !== undefined || face.surfaceClass !== "plane") {
        return undefined;
      }
      validatedFaces.push({
        role: face.role,
        surfaceClass: "plane",
        evidence: face.evidence
      });
      continue;
    }
    if (face.sourceEntityId === undefined) {
      return undefined;
    }
    validatedFaces.push({
      role: "side",
      sourceEntityId: face.sourceEntityId,
      surfaceClass: face.surfaceClass,
      evidence: face.evidence
    });
  }

  const validatedEdges: CadBodyGeneratedReferenceEdgeEvidence[] = [];
  for (const edge of edges) {
    if (edge.role === "longitudinal") {
      if (
        edge.sourceEntityId !== undefined ||
        edge.adjacentSourceEntityIds === undefined
      ) {
        return undefined;
      }
      validatedEdges.push({
        role: "longitudinal",
        adjacentSourceEntityIds: edge.adjacentSourceEntityIds,
        evidence: edge.evidence
      });
      continue;
    }
    if (
      edge.sourceEntityId === undefined ||
      edge.adjacentSourceEntityIds !== undefined
    ) {
      return undefined;
    }
    validatedEdges.push({
      role: edge.role,
      sourceEntityId: edge.sourceEntityId,
      evidence: edge.evidence
    });
  }

  return { faces: validatedFaces, edges: validatedEdges };
}
