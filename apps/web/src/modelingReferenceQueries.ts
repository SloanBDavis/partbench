import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedReference,
  CadSelectionReferenceOperation,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { getGeneratedReferenceItems } from "./generatedReferenceUi";

/** One cache per engine; shares reads at its current epoch without retaining history. */
export class ModelingReferenceQueryCache {
  private sourceAuthorityEpoch: number | undefined;
  private readonly candidates = new Map<
    string,
    SelectionReferenceCandidatesQueryResponse | undefined
  >();

  read(
    sourceAuthorityEpoch: number,
    references: BodyGeneratedReferencesQueryResponse | undefined,
    query: (
      reference: CadGeneratedReference
    ) => SelectionReferenceCandidatesQueryResponse | undefined,
    options: {
      readonly kind?: CadGeneratedReference["kind"];
      readonly operation?: CadSelectionReferenceOperation;
    } = {}
  ): ReadonlyMap<string, SelectionReferenceCandidatesQueryResponse> {
    if (this.sourceAuthorityEpoch !== sourceAuthorityEpoch) {
      this.sourceAuthorityEpoch = sourceAuthorityEpoch;
      this.candidates.clear();
    }
    const result = new Map<string, SelectionReferenceCandidatesQueryResponse>();
    if (!references) return result;
    for (const reference of getGeneratedReferenceItems(references)) {
      if (options.kind && reference.kind !== options.kind) continue;
      // Eligibility is a necessary filter, never proof of commandability. A
      // correspondence-only reference needs explicit promotion before modeling.
      if (
        !reference.eligibleOperations.some((operation) =>
          options.operation
            ? operation === options.operation
            : operation !== "feature.selectReference" &&
              operation !== "feature.measureReference"
        )
      )
        continue;
      const key = JSON.stringify([
        reference.bodyId,
        reference.kind,
        reference.stableId
      ]);
      if (!this.candidates.has(key)) this.candidates.set(key, query(reference));
      const response = this.candidates.get(key);
      if (response) result.set(reference.stableId, response);
    }
    return result;
  }
}
