import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedEntityKind,
  CadGeneratedReferenceEligibleOperation,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadQueryError,
  CadTopologyAnchorCommandProof,
  DocumentUnits,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  SketchAttachmentSnapshot
} from "@web-cad/cad-protocol";
import type { SketchCreateOnFaceForm } from "./cadCommands";
import {
  formatArea,
  formatBounds,
  formatVector,
  formatVolume
} from "./sceneObjectDisplay";

const SKETCH_PLANE_OPERATION = "feature.attachSketchPlane";

export interface GeneratedReferenceMeasurementDisplay {
  readonly measurement?: GeneratedReferenceMeasurement;
  readonly error?: string;
}

export interface GeneratedReferenceMeasurementRow {
  readonly label: string;
  readonly value: string;
}

export interface NamedReferenceStatusDisplay {
  readonly tone: "resolved" | "stale";
  readonly text: string;
}

export type GeneratedReferenceActionId =
  | "reference.name"
  | "sketch.createOnFace"
  | "feature.shell"
  | "feature.chamfer"
  | "feature.fillet";

export interface GeneratedReferenceActionStatus {
  readonly id: GeneratedReferenceActionId;
  readonly label: string;
  readonly available: boolean;
  readonly status: string;
}

export interface GeneratedReferenceDetailRow {
  readonly label: string;
  readonly value: string;
}

export interface GeneratedReferenceGroup {
  readonly kind: CadGeneratedEntityKind;
  readonly label: string;
  readonly countLabel: string;
  readonly references: readonly CadGeneratedReference[];
}

export interface SketchOnFaceDraft {
  readonly id: string;
  readonly name: string;
}

export function canCreateSketchOnFace(
  face: CadGeneratedFaceReference
): boolean {
  return face.eligibleOperations.includes(SKETCH_PLANE_OPERATION);
}

export function getSketchAttachableFaces(
  faces: readonly CadGeneratedFaceReference[]
): readonly CadGeneratedFaceReference[] {
  return faces.filter(canCreateSketchOnFace);
}

export function createSketchOnFaceDefaultName(
  face: CadGeneratedFaceReference
): string {
  return `${face.label} sketch`;
}

export function buildSketchOnFaceForm(
  bodyId: string,
  face: CadGeneratedFaceReference,
  draft: SketchOnFaceDraft,
  topologyAnchorId?: string,
  topologyAnchorProof?: CadTopologyAnchorCommandProof
): SketchCreateOnFaceForm | undefined {
  const name = draft.name.trim();

  if (!canCreateSketchOnFace(face) || name.length === 0) {
    return undefined;
  }

  return {
    id: draft.id,
    name,
    bodyId,
    faceStableId: face.stableId,
    ...(topologyAnchorId ? { topologyAnchorId } : {}),
    ...(topologyAnchorProof ? { topologyAnchorProof } : {})
  };
}

export function formatGeneratedFaceEligibility(
  face: CadGeneratedFaceReference
): string {
  if (canCreateSketchOnFace(face)) {
    return "Sketch plane";
  }

  return face.eligibilityNotes?.[0] ?? "Not eligible for sketch attachment";
}

export function formatSketchOnFaceAvailability(
  face: CadGeneratedFaceReference
): string {
  return canCreateSketchOnFace(face)
    ? "Planar face available for attached sketches"
    : formatGeneratedFaceEligibility(face);
}

export function formatGeneratedReferencesError(error: CadQueryError): string {
  if (error.code === "BODY_NOT_FOUND") {
    return `Generated references unavailable: ${error.bodyId ?? "selected body"} was not found.`;
  }

  if (error.code === "UNSUPPORTED_BODY_REFERENCES") {
    return `Generated references unavailable for ${error.bodyId ?? "selected body"}. Authored rectangle/circle extrudes, supported revolves, and supported holes are supported.`;
  }

  if (error.code === "GENERATED_REFERENCE_NOT_FOUND") {
    return `Generated reference ${error.stableId ?? "selected reference"} is missing or stale.`;
  }

  return error.message;
}

export function formatSketchAttachmentLabel(
  attachment: SketchAttachmentSnapshot
): string {
  if (attachment.kind === "topologyAnchorFace") {
    return `attached face on ${attachment.bodyId}`;
  }

  return `${attachment.faceRole} on ${attachment.bodyId}`;
}

export function getGeneratedReferenceItems(
  references: BodyGeneratedReferencesQueryResponse
): readonly CadGeneratedReference[] {
  return [
    references.body,
    ...references.faces,
    ...references.edges,
    ...references.vertices,
    ...references.axes
  ];
}

export function getGeneratedReferenceGroups(
  references: BodyGeneratedReferencesQueryResponse
): readonly GeneratedReferenceGroup[] {
  return [
    createGeneratedReferenceGroup("body", [references.body]),
    createGeneratedReferenceGroup("face", references.faces),
    createGeneratedReferenceGroup("edge", references.edges),
    createGeneratedReferenceGroup("vertex", references.vertices),
    createGeneratedReferenceGroup("axis", references.axes)
  ].filter((group) => group.references.length > 0);
}

export function formatGeneratedReferenceKind(
  kind: CadGeneratedEntityKind
): string {
  switch (kind) {
    case "body":
      return "Body";
    case "face":
      return "Face";
    case "edge":
      return "Edge";
    case "vertex":
      return "Vertex";
    case "axis":
      return "Axis";
  }
}

export function formatGeneratedReferenceKindPlural(
  kind: CadGeneratedEntityKind
): string {
  switch (kind) {
    case "body":
      return "Body";
    case "face":
      return "Faces";
    case "edge":
      return "Edges";
    case "vertex":
      return "Vertices";
    case "axis":
      return "Axes";
  }
}

export function formatGeneratedReferenceCount(
  kind: CadGeneratedEntityKind,
  count: number
): string {
  const singular = formatGeneratedReferenceKind(kind).toLowerCase();
  const plural =
    kind === "body"
      ? "bodies"
      : kind === "vertex"
        ? "vertices"
        : kind === "axis"
          ? "axes"
          : `${singular}s`;

  return `${count} ${count === 1 ? singular : plural}`;
}

export function createGeneratedReferenceActionStatuses(
  reference: CadGeneratedReference
): readonly GeneratedReferenceActionStatus[] {
  const actions: GeneratedReferenceActionStatus[] = [
    {
      id: "reference.name",
      label: "Name reference",
      available: true,
      status: "Available"
    }
  ];

  if (reference.kind === "face") {
    const available = canCreateSketchOnFace(reference);
    actions.push({
      id: "sketch.createOnFace",
      label: "Create sketch",
      available,
      status: available
        ? "Planar face"
        : formatGeneratedFaceEligibility(reference)
    });

    if (reference.eligibleOperations.includes("feature.shell")) {
      actions.push(createOperationActionStatus(reference, "feature.shell"));
    }
  }

  if (reference.kind === "edge") {
    if (reference.eligibleOperations.includes("feature.chamfer")) {
      actions.push(createOperationActionStatus(reference, "feature.chamfer"));
    }

    if (reference.eligibleOperations.includes("feature.fillet")) {
      actions.push(createOperationActionStatus(reference, "feature.fillet"));
    }
  }

  return actions;
}

export function formatGeneratedReferenceActionStatus(
  action: GeneratedReferenceActionStatus
): string {
  return action.available ? action.status : `Unavailable: ${action.status}`;
}

export function createGeneratedReferenceDetailRows(
  reference: CadGeneratedReference
): readonly GeneratedReferenceDetailRow[] {
  return [
    { label: "Stable ID", value: reference.stableId },
    { label: "Body", value: reference.bodyId },
    { label: "Source feature", value: reference.sourceFeatureId },
    { label: "Source sketch", value: reference.sourceSketchId },
    {
      label: "Source entity",
      value:
        reference.sourceSketchEntityId ??
        ("sourceSketchEntityIds" in reference
          ? reference.sourceSketchEntityIds?.join(", ")
          : undefined) ??
        "Composite profile"
    },
    { label: "Profile", value: reference.geometricSignature.profileKind },
    ...generatedReferenceRoleRows(reference)
  ];
}

export function formatGeneratedReferenceOperationLabels(
  reference: CadGeneratedReference
): string {
  if (reference.eligibleOperations.length === 0) {
    return reference.eligibilityNotes?.[0] ?? "No eligible operations";
  }

  return reference.eligibleOperations.map(formatOperationLabel).join(", ");
}

export function createGeneratedReferenceMeasurementRows(
  measurement: GeneratedReferenceMeasurement,
  units: DocumentUnits
): readonly GeneratedReferenceMeasurementRow[] {
  switch (measurement.kind) {
    case "body":
      return [
        { label: "Volume", value: formatVolume(measurement.volume, units) },
        { label: "Bounds", value: formatBounds(measurement.bounds, units) },
        {
          label: "Centroid",
          value: formatPoint(measurement.centroid, units)
        }
      ];
    case "face":
      return [
        { label: "Area", value: formatArea(measurement.area, units) },
        { label: "Bounds", value: formatBounds(measurement.bounds, units) },
        { label: "Center", value: formatPoint(measurement.center, units) },
        { label: "Surface", value: measurement.surfaceType },
        ...optionalVectorRow("Normal", measurement.normal),
        ...optionalTextRow("Normal role", measurement.normalRole),
        ...optionalVectorRow("Axis", measurement.axis),
        ...optionalTextRow("Axis role", measurement.axisRole)
      ];
    case "edge":
      return [
        { label: "Length", value: formatLength(measurement.length, units) },
        { label: "Curve", value: measurement.curveType },
        ...optionalPointRow("Start", measurement.startPoint, units),
        ...optionalPointRow("End", measurement.endPoint, units),
        ...optionalPointRow("Center", measurement.center, units),
        ...optionalNumberRow("Radius", measurement.radius, units),
        ...optionalVectorRow("Axis", measurement.axis),
        ...optionalTextRow("Axis role", measurement.axisRole)
      ];
    case "vertex":
      return [{ label: "Point", value: formatPoint(measurement.point, units) }];
    default:
      return [];
  }
}

export function formatGeneratedReferenceMeasurementError(
  error: CadQueryError
): string {
  if (error.code === "BODY_NOT_FOUND") {
    return `Reference measurements unavailable: ${error.bodyId ?? "selected body"} was not found.`;
  }

  if (error.code === "UNSUPPORTED_BODY_REFERENCES") {
    return `Reference measurements unavailable for ${error.bodyId ?? "selected body"}. Authored rectangle and circle extrude bodies are supported.`;
  }

  if (error.code === "GENERATED_REFERENCE_NOT_FOUND") {
    return `Reference measurements unavailable: ${error.stableId ?? "selected reference"} is missing or stale.`;
  }

  if (error.code === "UNSUPPORTED_GENERATED_REFERENCE_MEASUREMENTS") {
    return `Reference measurements unavailable for ${error.stableId ?? "selected reference"}. ${error.message}`;
  }

  return error.message;
}

export function getNamedReferencesForGeneratedReference(
  references: readonly NamedGeneratedReferenceEntry[],
  target: CadGeneratedReference
): readonly NamedGeneratedReferenceEntry[] {
  return references
    .filter(
      (reference) =>
        reference.bodyId === target.bodyId &&
        reference.stableId === target.stableId &&
        reference.kind === target.kind
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function formatNamedReferenceTarget(
  reference: NamedGeneratedReferenceEntry
): string {
  if (reference.status === "resolved" && reference.reference) {
    return `${formatGeneratedReferenceKind(reference.kind)} / ${reference.reference.label}`;
  }

  return `${formatGeneratedReferenceKind(reference.kind)} / ${reference.stableId}`;
}

export function formatNamedReferenceStatus(
  reference: NamedGeneratedReferenceEntry
): NamedReferenceStatusDisplay {
  if (reference.status === "resolved") {
    return {
      tone: "resolved",
      text: "Resolved"
    };
  }

  return {
    tone: "stale",
    text: formatNamedReferenceError(reference.error, reference)
  };
}

export function formatNamedReferenceError(
  error: CadQueryError | undefined,
  reference: Pick<NamedGeneratedReferenceEntry, "bodyId" | "stableId">
): string {
  if (!error) {
    return "Target is stale.";
  }

  if (error.code === "BODY_NOT_FOUND") {
    return `Target body ${error.bodyId ?? reference.bodyId} is missing.`;
  }

  if (error.code === "GENERATED_REFERENCE_NOT_FOUND") {
    return `Target reference ${error.stableId ?? reference.stableId} is stale or missing.`;
  }

  if (error.code === "UNSUPPORTED_BODY_REFERENCES") {
    return `Target body ${error.bodyId ?? reference.bodyId} is not supported for generated references.`;
  }

  if (error.code === "NAMED_REFERENCE_NOT_FOUND") {
    return `Named reference ${error.referenceName ?? "selected name"} is missing.`;
  }

  return error.message;
}

function createGeneratedReferenceGroup(
  kind: CadGeneratedEntityKind,
  references: readonly CadGeneratedReference[]
): GeneratedReferenceGroup {
  return {
    kind,
    label: formatGeneratedReferenceKindPlural(kind),
    countLabel: formatGeneratedReferenceCount(kind, references.length),
    references
  };
}

function createOperationActionStatus(
  reference: CadGeneratedReference,
  operation: Extract<
    CadGeneratedReferenceEligibleOperation,
    "feature.chamfer" | "feature.fillet" | "feature.shell"
  >
): GeneratedReferenceActionStatus {
  const available = reference.eligibleOperations.includes(operation);

  return {
    id: operation,
    label: formatOperationLabel(operation),
    available,
    status: available
      ? `Eligible ${reference.kind}`
      : (reference.eligibilityNotes?.[0] ??
        `Reference is not eligible for ${formatOperationLabel(operation).toLowerCase()}.`)
  };
}

function generatedReferenceRoleRows(
  reference: CadGeneratedReference
): readonly GeneratedReferenceDetailRow[] {
  if (reference.kind === "body") {
    return [];
  }

  const rows: GeneratedReferenceDetailRow[] = [
    { label: "Role", value: reference.role }
  ];

  if (reference.kind === "edge" || reference.kind === "vertex") {
    rows.push({
      label: "Adjacent faces",
      value: reference.adjacentFaceRoles.join(", ")
    });
  }

  if (reference.kind === "vertex") {
    rows.push({
      label: "Adjacent edges",
      value: reference.adjacentEdgeRoles.join(", ")
    });
  }

  return rows;
}

function formatOperationLabel(operation: string): string {
  switch (operation) {
    case "feature.attachSketchPlane":
      return "Sketch plane";
    case "feature.chamfer":
      return "Chamfer";
    case "feature.fillet":
      return "Fillet";
    case "feature.shell":
      return "Shell";
    case "feature.measureReference":
      return "Measure";
    case "feature.selectReference":
      return "Select";
    default:
      return operation;
  }
}

function optionalTextRow(
  label: string,
  value: string | undefined
): readonly GeneratedReferenceMeasurementRow[] {
  return value ? [{ label, value }] : [];
}

function optionalNumberRow(
  label: string,
  value: number | undefined,
  units: DocumentUnits
): readonly GeneratedReferenceMeasurementRow[] {
  return value === undefined
    ? []
    : [{ label, value: formatLength(value, units) }];
}

function optionalVectorRow(
  label: string,
  value: readonly [number, number, number] | undefined
): readonly GeneratedReferenceMeasurementRow[] {
  return value ? [{ label, value: formatVector(value) }] : [];
}

function optionalPointRow(
  label: string,
  value: readonly [number, number, number] | undefined,
  units: DocumentUnits
): readonly GeneratedReferenceMeasurementRow[] {
  return value ? [{ label, value: formatPoint(value, units) }] : [];
}

function formatPoint(
  point: readonly [number, number, number],
  units: DocumentUnits
): string {
  return point.map((value) => `${formatNumber(value)} ${units}`).join(", ");
}

function formatLength(value: number, units: DocumentUnits): string {
  return `${formatNumber(value)} ${units}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
