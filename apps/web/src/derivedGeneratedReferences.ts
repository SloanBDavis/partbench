import type { CadBodyGeneratedReferenceEvidenceSnapshot } from "@web-cad/cad-protocol";

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
    return {
      ...base,
      status: "ready",
      faces: [...generatedReferences.faces],
      edges: [...generatedReferences.edges]
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
