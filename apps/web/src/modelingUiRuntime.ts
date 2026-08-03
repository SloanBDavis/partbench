import {
  createCadDownstreamBodyPolicyProjection,
  evaluateCadBodyDependencies,
  type CadBodySnapshot,
  type CadDocument
} from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadExactDownstreamOperation,
  CadSelectionReferenceOperation,
  CadTopologyIdentitySourceSnapshot,
  FeatureShellOpenFaceRef,
  MirrorPlaneRef,
  NamedGeneratedReferenceEntry,
  PatternDirectionRef,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";

import type { CurrentExactResultProjection } from "./currentExactResultProjection";
import type { DerivedExactMetadataEntry } from "./derivedExactMetadata";
import { getSelectionReferenceCandidateForOperation } from "./generatedReferenceSelection";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";
import type { EdgeChoiceValue, SolidChoice } from "./modes/solid";

export { deriveModelingActions } from "./modelingActions";
export { createModelingResultState } from "./modelingResultState";
export { createRenderSceneInputs } from "./renderScene";

export function createExactDownstreamModelingState(input: {
  readonly document: CadDocument;
  readonly bodies: readonly CadBodySnapshot[];
  readonly projections: readonly CurrentExactResultProjection[];
  readonly metadataEntries: readonly DerivedExactMetadataEntry[];
}) {
  const projections = new Map(
    input.projections.map((projection) => [projection.bodyId, projection])
  );
  const metadata = new Map(
    input.metadataEntries.map((entry) => [entry.bodyId, entry])
  );
  const readiness = (operation: CadExactDownstreamOperation) => {
    return new Map(
      input.bodies.map((body) => {
        const projection = projections.get(body.id);
        const entry = metadata.get(body.id);
        const solidCount =
          projection?.status === "ready" && entry?.status === "ready"
            ? entry.metadata.topologyCounts.solidCount
            : undefined;
        const dependencies = evaluateCadBodyDependencies(
          input.document,
          input.bodies,
          body.id
        );
        const result = createCadDownstreamBodyPolicyProjection({
          bodyId: body.id,
          featureId: body.featureId,
          sourceType: body.source.type,
          operation,
          lifecycle:
            body.consumedByFeatureId === undefined ? "active" : "consumed",
          dependencyStatus: dependencies.status,
          dependencyCycle: dependencies.cycle,
          exactStatus: projection?.status,
          ...(projection?.shapePolicy
            ? { shapePolicy: projection.shapePolicy }
            : {}),
          diagnostics: projection?.diagnostics
        }).readiness;
        return [
          body.id,
          {
            status: result.status,
            ...(solidCount === undefined ? {} : { solidCount }),
            ...(result.diagnostics[0]
              ? { reason: result.diagnostics[0].message }
              : {})
          }
        ] as const;
      })
    );
  };
  const patternSeedReadinessByBodyId = readiness("patternSeed");
  const shellTargetReadinessByBodyId = readiness("shellTarget");
  return {
    holeTargetReadinessByBodyId: readiness("holeTarget"),
    patternSeedBodyChoices: input.bodies.map((body, index) => {
      const state = patternSeedReadinessByBodyId.get(body.id);
      const disabled = state?.status !== "ready";
      const warning =
        !disabled && (state.solidCount ?? 0) > 1
          ? `This body contains ${state.solidCount} solids. The result remains one exact body.`
          : undefined;
      return {
        key: body.id,
        value: body.id,
        label: body.name ?? `Body ${index + 1}`,
        kind: "exact body",
        detail: disabled
          ? (state?.reason ??
            `Exact seed is ${state?.status ?? "unavailable"}.`)
          : (warning ?? "Exact-ready body"),
        ...(disabled ? { disabled: true } : {}),
        ...(warning ? { warning } : {})
      } satisfies SolidChoice<string>;
    }),
    shellTargetBodyChoices: input.bodies.map((body, index) => {
      const state = shellTargetReadinessByBodyId.get(body.id);
      const disabled = state?.status !== "ready";
      return {
        key: body.id,
        value: body.id,
        label: body.name ?? `Body ${index + 1}`,
        kind: "exact single-solid body",
        detail: disabled
          ? (state?.reason ??
            `Exact shell target is ${state?.status ?? "unavailable"}.`)
          : "Exact-ready single solid",
        ...(disabled ? { disabled: true } : {})
      } satisfies SolidChoice<string>;
    })
  };
}

function getCommandableReferenceCandidate(
  response: SelectionReferenceCandidatesQueryResponse | undefined,
  operation: CadSelectionReferenceOperation
) {
  const candidate = getSelectionReferenceCandidateForOperation(
    response,
    operation
  );
  return candidate?.commandable &&
    candidate.commandOperations.includes(operation)
    ? candidate
    : undefined;
}

export function createSolidEdgeChoices(
  references: BodyGeneratedReferencesQueryResponse | undefined,
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  candidatesByStableId: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  candidatesByName: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  operation: "feature.chamfer" | "feature.fillet"
): readonly SolidChoice<EdgeChoiceValue>[] {
  const choices: SolidChoice<EdgeChoiceValue>[] = [];
  for (const edge of references?.edges ?? []) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByStableId.get(edge.stableId),
      operation
    );
    if (
      !candidate ||
      candidate.target.type !== "generatedReference" ||
      candidate.reference.kind !== "edge"
    )
      continue;
    choices.push({
      key: `${operation}:${candidate.target.topologyAnchorId ? "topology" : "generated"}:${edge.stableId}`,
      value: {
        targetBodyId: candidate.target.bodyId,
        ...(candidate.target.topologyAnchorId
          ? { topologyAnchorId: candidate.target.topologyAnchorId }
          : { edgeStableId: candidate.target.stableId })
      },
      label: edge.label,
      kind: candidate.target.topologyAnchorId ? "saved edge" : "edge"
    });
  }
  for (const reference of namedReferences) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByName.get(reference.name),
      operation
    );
    if (
      !candidate ||
      candidate.target.type !== "generatedReference" ||
      candidate.reference.kind !== "edge"
    )
      continue;
    choices.push({
      key: `${operation}:named:${reference.name}`,
      value: {
        targetBodyId: candidate.target.bodyId,
        namedReference: reference.name
      },
      label: reference.name,
      kind: "named edge"
    });
  }
  return choices;
}

export function createSolidDirectionChoices(
  references: BodyGeneratedReferencesQueryResponse | undefined,
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  candidatesByStableId: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  candidatesByName: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  operation: "feature.linearPatternDirection" | "feature.circularPatternAxis"
): readonly SolidChoice<PatternDirectionRef>[] {
  const choices: SolidChoice<PatternDirectionRef>[] = (
    ["x", "y", "z"] as const
  ).map((axis) => ({
    key: `${operation}:axis:${axis}`,
    value: { kind: "globalAxis", axis },
    label: `${axis.toUpperCase()} axis`,
    kind: "global axis"
  }));
  for (const edge of references?.edges ?? []) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByStableId.get(edge.stableId),
      operation
    );
    if (
      !candidate ||
      candidate.target.type !== "generatedReference" ||
      candidate.reference.kind !== "edge"
    )
      continue;
    choices.push({
      key: `${operation}:${candidate.target.topologyAnchorId ? "topology" : "generated"}:${edge.stableId}`,
      value: candidate.target.topologyAnchorId
        ? {
            kind: "topologyAnchor",
            bodyId: candidate.target.bodyId,
            anchorId: candidate.target.topologyAnchorId
          }
        : {
            kind: "generatedEdge",
            bodyId: candidate.target.bodyId,
            stableId: candidate.target.stableId
          },
      label: edge.label,
      kind: candidate.target.topologyAnchorId ? "saved line edge" : "line edge"
    });
  }
  for (const reference of namedReferences) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByName.get(reference.name),
      operation
    );
    if (
      !candidate ||
      candidate.target.type !== "generatedReference" ||
      candidate.reference.kind !== "edge"
    )
      continue;
    choices.push({
      key: `${operation}:named:${reference.name}`,
      value: { kind: "namedReference", name: reference.name },
      label: reference.name,
      kind: "named line edge"
    });
  }
  return choices;
}

export function createSolidFaceChoices(
  references: BodyGeneratedReferencesQueryResponse | undefined,
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  candidatesByStableId: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  candidatesByName: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  operation: "feature.shell" | "feature.mirrorPlane",
  topologyAnchors: CadTopologyIdentitySourceSnapshot["anchors"] = [],
  targetBodyId?: string
): readonly SolidChoice<FeatureShellOpenFaceRef>[] {
  const choices: SolidChoice<FeatureShellOpenFaceRef>[] = [];
  for (const face of references?.faces ?? []) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByStableId.get(face.stableId),
      operation
    );
    if (
      !candidate ||
      candidate.target.type !== "generatedReference" ||
      candidate.reference.kind !== "face"
    )
      continue;
    choices.push({
      key: `${operation}:${candidate.target.topologyAnchorId ? "topology" : "generated"}:${face.stableId}`,
      value: candidate.target.topologyAnchorId
        ? {
            kind: "topologyAnchor",
            bodyId: candidate.target.bodyId,
            anchorId: candidate.target.topologyAnchorId
          }
        : {
            kind: "generatedFace",
            bodyId: candidate.target.bodyId,
            stableId: candidate.target.stableId
          },
      label: face.label,
      kind: candidate.target.topologyAnchorId ? "saved planar face" : "face",
      targetBodyId: candidate.target.bodyId
    });
  }
  for (const reference of namedReferences) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByName.get(reference.name),
      operation
    );
    if (
      !candidate ||
      candidate.target.type !== "generatedReference" ||
      candidate.reference.kind !== "face"
    )
      continue;
    choices.push({
      key: `${operation}:named:${reference.name}`,
      value: { kind: "namedReference", name: reference.name },
      label: reference.name,
      kind: "named planar face",
      targetBodyId: candidate.target.bodyId
    });
  }
  for (const anchor of topologyAnchors) {
    if (
      anchor.state !== "active" ||
      anchor.entityKind !== "face" ||
      anchor.bodyId !== targetBodyId ||
      choices.some(
        (choice) =>
          choice.value.kind === "topologyAnchor" &&
          choice.value.anchorId === anchor.anchorId
      )
    )
      continue;
    choices.push({
      key: `${operation}:topology:${anchor.anchorId}`,
      value: {
        kind: "topologyAnchor",
        bodyId: anchor.bodyId,
        anchorId: anchor.anchorId
      },
      label: anchor.sourceSemanticRole ?? anchor.stableId ?? anchor.anchorId,
      kind: "saved face",
      targetBodyId: anchor.bodyId
    });
  }
  return choices;
}

export function createSolidMirrorPlaneChoices(
  faceChoices: readonly SolidChoice<FeatureShellOpenFaceRef>[]
): readonly SolidChoice<MirrorPlaneRef>[] {
  return [
    ...(["XY", "XZ", "YZ"] as const).map((plane) => ({
      key: `feature.mirrorPlane:plane:${plane}`,
      value: { kind: "standardPlane" as const, plane },
      label: `${plane} plane`,
      kind: "standard plane"
    })),
    ...faceChoices.map((choice) => ({
      ...choice,
      value: choice.value as MirrorPlaneRef
    }))
  ];
}

export function findSelectedEdgeChoice(
  choices: readonly SolidChoice<EdgeChoiceValue>[],
  state: GeneratedReferenceSelectionState,
  selectedName: string | undefined
): SolidChoice<EdgeChoiceValue> | undefined {
  if (selectedName)
    return choices.find(
      (choice) => choice.value.namedReference === selectedName
    );
  if (state.status !== "selected" || state.reference.kind !== "edge")
    return undefined;
  return choices.find(
    (choice) =>
      choice.value.edgeStableId === state.reference.stableId ||
      (state.selection.topologyAnchorId !== undefined &&
        choice.value.topologyAnchorId === state.selection.topologyAnchorId)
  );
}

export function findSelectedDirectionChoice(
  choices: readonly SolidChoice<PatternDirectionRef>[],
  state: GeneratedReferenceSelectionState,
  selectedName: string | undefined
): SolidChoice<PatternDirectionRef> | undefined {
  if (selectedName)
    return choices.find(
      (choice) =>
        choice.value.kind === "namedReference" &&
        choice.value.name === selectedName
    );
  if (state.status !== "selected" || state.reference.kind !== "edge")
    return undefined;
  return choices.find(
    (choice) =>
      (choice.value.kind === "generatedEdge" &&
        choice.value.stableId === state.reference.stableId) ||
      (choice.value.kind === "topologyAnchor" &&
        choice.value.anchorId === state.selection.topologyAnchorId)
  );
}

export function findSelectedFaceChoice<Value extends FeatureShellOpenFaceRef>(
  choices: readonly SolidChoice<Value>[],
  state: GeneratedReferenceSelectionState,
  selectedName: string | undefined
): SolidChoice<Value> | undefined {
  if (selectedName)
    return choices.find(
      (choice) =>
        choice.value.kind === "namedReference" &&
        choice.value.name === selectedName
    );
  if (state.status !== "selected" || state.reference.kind !== "face")
    return undefined;
  return choices.find(
    (choice) =>
      (choice.value.kind === "generatedFace" &&
        choice.value.stableId === state.reference.stableId) ||
      (choice.value.kind === "topologyAnchor" &&
        choice.value.anchorId === state.selection.topologyAnchorId)
  );
}
