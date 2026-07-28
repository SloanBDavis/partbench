import type {
  SketchProfileRegionCandidate,
  SketchRegionsProfileRef,
  SketchSnapshot
} from "@web-cad/cad-protocol";

export type SketchRegionConsumerIntent =
  | "extrude-new-body"
  | "extrude-add-cut"
  | "revolve-new-body";

export const SKETCH_REGION_CONSUMER_OPTIONS = [
  {
    value: "extrude-new-body",
    label: "Extrude · New body",
    countLabel: "Exactly 1 region",
    maximum: 1
  },
  {
    value: "extrude-add-cut",
    label: "Extrude · Add or cut",
    countLabel: "1–256 disjoint regions",
    maximum: 256
  },
  {
    value: "revolve-new-body",
    label: "Revolve · New body",
    countLabel: "Exactly 1 region",
    maximum: 1
  }
] as const satisfies readonly {
  readonly value: SketchRegionConsumerIntent;
  readonly label: string;
  readonly countLabel: string;
  readonly maximum: number;
}[];

export interface SketchRegionSelectionUpdate {
  readonly ok: boolean;
  readonly selectedCandidateKeys: readonly string[];
  readonly message?: string;
}

export function updateSketchRegionSelection(
  candidates: readonly SketchProfileRegionCandidate[],
  selectedCandidateKeys: readonly string[],
  candidateKey: string,
  consumer: SketchRegionConsumerIntent
): SketchRegionSelectionUpdate {
  if (selectedCandidateKeys.includes(candidateKey)) {
    return {
      ok: true,
      selectedCandidateKeys: selectedCandidateKeys.filter(
        (key) => key !== candidateKey
      )
    };
  }

  const candidate = candidates.find(
    (item) => item.candidateKey === candidateKey
  );
  if (!candidate || candidate.status !== "valid") {
    return {
      ok: false,
      selectedCandidateKeys,
      message: "Only a valid whole-loop material region can be selected."
    };
  }

  const maximum = getSketchRegionConsumerMaximum(consumer);
  if (maximum === 1) {
    return { ok: true, selectedCandidateKeys: [candidateKey] };
  }
  if (selectedCandidateKeys.length >= maximum) {
    return {
      ok: false,
      selectedCandidateKeys,
      message: `This consumer accepts at most ${maximum} regions.`
    };
  }

  const selected = candidates.filter((item) =>
    selectedCandidateKeys.includes(item.candidateKey)
  );
  const sharedBoundary = selected.some((item) =>
    regionBoundaryKeys(item).some((key) =>
      regionBoundaryKeys(candidate).includes(key)
    )
  );
  if (sharedBoundary) {
    return {
      ok: false,
      selectedCandidateKeys,
      message:
        "These material cells share a loop boundary and cannot be combined."
    };
  }

  return {
    ok: true,
    selectedCandidateKeys: [...selectedCandidateKeys, candidateKey]
  };
}

export function normalizeSketchRegionSelectionForConsumer(
  selectedCandidateKeys: readonly string[],
  consumer: SketchRegionConsumerIntent
): readonly string[] {
  return selectedCandidateKeys.slice(
    0,
    getSketchRegionConsumerMaximum(consumer)
  );
}

export function createSelectedSketchRegionsProfile(
  sketchId: string,
  candidates: readonly SketchProfileRegionCandidate[],
  selectedCandidateKeys: readonly string[]
): SketchRegionsProfileRef | undefined {
  const selected = candidates.filter(
    (candidate) =>
      candidate.status === "valid" &&
      selectedCandidateKeys.includes(candidate.candidateKey)
  );
  const first = selected[0];
  if (!first || selected.length !== selectedCandidateKeys.length) {
    return undefined;
  }
  return {
    kind: "regions",
    sketchId,
    regions: [
      first.region,
      ...selected.slice(1).map((candidate) => candidate.region)
    ]
  };
}

export function isSketchRegionSelectionCountReady(
  selectedCount: number,
  consumer: SketchRegionConsumerIntent
): boolean {
  return (
    selectedCount >= 1 &&
    selectedCount <= getSketchRegionConsumerMaximum(consumer)
  );
}

export function getSketchRegionConsumerMaximum(
  consumer: SketchRegionConsumerIntent
): number {
  return (
    SKETCH_REGION_CONSUMER_OPTIONS.find((option) => option.value === consumer)
      ?.maximum ?? 1
  );
}

export function formatSketchRegionCandidateName(
  candidate: SketchProfileRegionCandidate,
  entityNames: ReadonlyMap<string, string>
): {
  readonly outer: string;
  readonly holes: readonly string[];
} {
  return {
    outer: formatEntityNames(candidate.outerEntityIds, entityNames),
    holes: candidate.holeEntityIds.map((ids) =>
      formatEntityNames(ids, entityNames)
    )
  };
}

function regionBoundaryKeys(
  candidate: SketchProfileRegionCandidate
): readonly string[] {
  return [candidate.outerLoopKey, ...candidate.holeLoopKeys];
}

function formatEntityNames(
  ids: readonly string[],
  entityNames: ReadonlyMap<string, string>
): string {
  return ids
    .map((id) => entityNames.get(id) ?? "Missing sketch entity")
    .join(" · ");
}

export function createSketchEntitySemanticNames(
  sketch: SketchSnapshot
): ReadonlyMap<string, string> {
  const ordinalByKind = new Map<string, number>();
  return new Map(
    sketch.entities.map((entity) => {
      const ordinal = (ordinalByKind.get(entity.kind) ?? 0) + 1;
      ordinalByKind.set(entity.kind, ordinal);
      return [entity.id, `${formatKind(entity.kind)} ${ordinal}`];
    })
  );
}

function formatKind(kind: string): string {
  return `${kind.slice(0, 1).toUpperCase()}${kind.slice(1)}`;
}
