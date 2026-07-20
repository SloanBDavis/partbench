import type {
  CadBodySnapshot,
  CadDependencyHealthStatus,
  CadFeatureSummary,
  CadObjectSnapshot,
  CadParameterSnapshot,
  CadPartSnapshot,
  NamedGeneratedReferenceEntry,
  ProjectHealthQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type { IconName } from "../ui/Icon";
import {
  getBodyHealthStatus,
  getFeatureHealthStatus,
  getHealthIssues,
  getNamedReferenceHealthStatus,
  getSketchHealthStatus
} from "../structurePanelUi";

export type DocumentTreeSelection =
  | { readonly kind: "origin-plane"; readonly plane: "XY" | "XZ" | "YZ" }
  | { readonly kind: "parameter"; readonly id: string }
  | { readonly kind: "sketch"; readonly id: string }
  | {
      readonly kind: "sketch-entity";
      readonly sketchId: string;
      readonly id: string;
    }
  | { readonly kind: "feature"; readonly id: string }
  | { readonly kind: "object"; readonly id: string }
  | { readonly kind: "body"; readonly id: string }
  | { readonly kind: "named-reference"; readonly name: string };

export interface DocumentTreeRowCapabilities {
  /** UI-local display state. Only provide this for an inventoried display operation. */
  readonly visible?: boolean;
  readonly canRename?: boolean;
  readonly canEdit?: boolean;
  readonly canDelete?: boolean;
}

export type DocumentTreeHealthTone = "warning" | "error";

export interface DocumentTreeHealth {
  readonly label: string;
  readonly tone: DocumentTreeHealthTone;
  readonly description: string;
}

export interface DocumentTreeRow {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon: IconName;
  readonly selection: DocumentTreeSelection;
  readonly health?: DocumentTreeHealth;
  readonly capabilities: DocumentTreeRowCapabilities;
  readonly children: readonly DocumentTreeRow[];
}

export interface DocumentTreeGroup {
  readonly id: "origin" | "parameters" | "model" | "references";
  readonly label: "Origin" | "Parameters" | "Model" | "Named references";
  readonly icon: IconName;
  readonly rows: readonly DocumentTreeRow[];
}

export interface DocumentTreeProjection {
  readonly groups: readonly [
    DocumentTreeGroup,
    DocumentTreeGroup,
    DocumentTreeGroup,
    DocumentTreeGroup
  ];
  readonly rowsById: ReadonlyMap<string, DocumentTreeRow>;
}

export interface CreateDocumentTreeProjectionInput {
  readonly parts: readonly CadPartSnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly sketches: readonly SketchSnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly objects: readonly CadObjectSnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  /** One query-backed health snapshot for the whole projection; rows issue no queries. */
  readonly health?: ProjectHealthQueryResponse;
  /** Keyed by {@link documentTreeSelectionKey}. */
  readonly capabilitiesBySelectionKey?: ReadonlyMap<
    string,
    DocumentTreeRowCapabilities
  >;
}

const EMPTY_CAPABILITIES: DocumentTreeRowCapabilities = {};

export function documentTreeSelectionKey(
  selection: DocumentTreeSelection
): string {
  switch (selection.kind) {
    case "origin-plane":
      return `origin-plane:${selection.plane}`;
    case "named-reference":
      return `named-reference:${selection.name}`;
    case "sketch-entity":
      return `sketch-entity:${selection.sketchId}:${selection.id}`;
    default:
      return `${selection.kind}:${selection.id}`;
  }
}

export function createDocumentTreeProjection(
  input: CreateDocumentTreeProjectionInput
): DocumentTreeProjection {
  const capabilitiesFor = (selection: DocumentTreeSelection) =>
    input.capabilitiesBySelectionKey?.get(
      documentTreeSelectionKey(selection)
    ) ?? EMPTY_CAPABILITIES;
  const bodiesByFeatureId = groupBy(input.bodies, (body) => body.featureId);
  const objectsById = new Map(
    input.objects.map((object) => [object.id, object])
  );

  const originRows: readonly DocumentTreeRow[] = [
    createOriginRow("XY", "Top plane", capabilitiesFor),
    createOriginRow("XZ", "Front plane", capabilitiesFor),
    createOriginRow("YZ", "Right plane", capabilitiesFor)
  ];
  const parameterRows = input.parameters.map((parameter) => {
    const selection = {
      kind: "parameter",
      id: parameter.id
    } as const satisfies DocumentTreeSelection;

    return {
      id: documentTreeSelectionKey(selection),
      label: parameter.name,
      detail: parameter.expression ?? formatNumber(parameter.value),
      icon: "dimension" as const,
      selection,
      capabilities: capabilitiesFor(selection),
      children: []
    };
  });

  const orderedSketches = orderByPartIds(
    input.parts,
    input.sketches,
    (part) => part.sketchIds
  );
  const sketchRows = orderedSketches.map((sketch) => {
    const selection = {
      kind: "sketch",
      id: sketch.id
    } as const satisfies DocumentTreeSelection;

    const health = healthForSketch(input.health, sketch.id);
    return {
      id: documentTreeSelectionKey(selection),
      label: sketch.name,
      detail: formatSketchPlane(sketch),
      icon: "sketch" as const,
      selection,
      ...(health ? { health } : {}),
      capabilities: capabilitiesFor(selection),
      children: sketch.entities.map((entity, index) => {
        const entitySelection = {
          kind: "sketch-entity",
          sketchId: sketch.id,
          id: entity.id
        } as const satisfies DocumentTreeSelection;
        return {
          id: documentTreeSelectionKey(entitySelection),
          label: `${formatEntityKind(entity.kind)} ${index + 1}`,
          detail: entity.construction ? "Construction" : undefined,
          icon: entityIcon(entity.kind),
          selection: entitySelection,
          capabilities: capabilitiesFor(entitySelection),
          children: []
        };
      })
    };
  });

  const orderedFeatures = orderByPartIds(
    input.parts,
    input.features,
    (part) => part.featureIds
  );
  const featureRows = orderedFeatures.map((feature, index) => {
    const selection = {
      kind: "feature",
      id: feature.id
    } as const satisfies DocumentTreeSelection;
    const featureBodies = bodiesByFeatureId.get(feature.id) ?? [];
    const object =
      feature.kind === "primitive"
        ? objectsById.get(feature.objectId)
        : undefined;
    const children: DocumentTreeRow[] = [];

    if (object) {
      const objectSelection = {
        kind: "object",
        id: object.id
      } as const satisfies DocumentTreeSelection;
      children.push({
        id: documentTreeSelectionKey(objectSelection),
        label: object.name ?? formatObjectKind(object.kind),
        detail: "Source object",
        icon: objectIcon(object.kind),
        selection: objectSelection,
        capabilities: capabilitiesFor(objectSelection),
        children: []
      });
    }

    children.push(
      ...featureBodies.map((body) => {
        const bodySelection = {
          kind: "body",
          id: body.id
        } as const satisfies DocumentTreeSelection;
        const health = healthForBody(input.health, body.id);
        return {
          id: documentTreeSelectionKey(bodySelection),
          label: body.name && body.name !== feature.name ? body.name : "Result",
          detail: body.consumedByFeatureId
            ? "Replaced by a later feature"
            : "Solid body",
          icon: "solid" as const,
          selection: bodySelection,
          ...(health ? { health } : {}),
          capabilities: capabilitiesFor(bodySelection),
          children: []
        };
      })
    );

    const health = healthForFeature(input.health, feature.id);
    return {
      id: documentTreeSelectionKey(selection),
      label: feature.name ?? `${formatFeatureKind(feature)} ${index + 1}`,
      detail:
        feature.kind === "importedBody" ? feature.sourceFileName : undefined,
      icon: featureIcon(feature),
      selection,
      ...(health ? { health } : {}),
      capabilities: capabilitiesFor(selection),
      children
    };
  });

  const referenceRows = input.namedReferences.map((reference) => {
    const selection = {
      kind: "named-reference",
      name: reference.name
    } as const satisfies DocumentTreeSelection;
    const health = healthForNamedReference(input.health, reference.name);
    return {
      id: documentTreeSelectionKey(selection),
      label: reference.name,
      detail: `${capitalize(reference.kind)} reference`,
      icon: "reference" as const,
      selection,
      ...(health ? { health } : {}),
      capabilities: capabilitiesFor(selection),
      children: []
    };
  });
  const sketchRowsById = new Map(
    sketchRows.map((row) => [
      row.selection.kind === "sketch" ? row.selection.id : row.id,
      row
    ])
  );
  const featureRowsById = new Map(
    featureRows.map((row) => [
      row.selection.kind === "feature" ? row.selection.id : row.id,
      row
    ])
  );
  const modelRows = interleaveOwnedModelRows(
    input.parts,
    input.sketches,
    input.features,
    sketchRowsById,
    featureRowsById
  );
  const primitiveObjectIds = new Set(
    input.features.flatMap((feature) =>
      feature.kind === "primitive" ? [feature.objectId] : []
    )
  );
  for (const object of input.objects) {
    if (primitiveObjectIds.has(object.id)) continue;
    const selection = {
      kind: "object",
      id: object.id
    } as const satisfies DocumentTreeSelection;
    modelRows.push({
      id: documentTreeSelectionKey(selection),
      label: object.name ?? formatObjectKind(object.kind),
      detail: "Standalone object",
      icon: objectIcon(object.kind),
      selection,
      capabilities: capabilitiesFor(selection),
      children: []
    });
  }

  const groups = [
    { id: "origin", label: "Origin", icon: "isometric", rows: originRows },
    {
      id: "parameters",
      label: "Parameters",
      icon: "dimension",
      rows: parameterRows
    },
    {
      id: "model",
      label: "Model",
      icon: "solid",
      rows: modelRows
    },
    {
      id: "references",
      label: "Named references",
      icon: "reference",
      rows: referenceRows
    }
  ] as const satisfies DocumentTreeProjection["groups"];
  const rowsById = new Map<string, DocumentTreeRow>();

  for (const group of groups) {
    for (const row of group.rows) visitRow(row, rowsById);
  }

  return { groups, rowsById };
}

function interleaveOwnedModelRows(
  parts: readonly CadPartSnapshot[],
  sketches: readonly SketchSnapshot[],
  features: readonly CadFeatureSummary[],
  sketchRowsById: ReadonlyMap<string, DocumentTreeRow>,
  featureRowsById: ReadonlyMap<string, DocumentTreeRow>
): DocumentTreeRow[] {
  const sketchesById = new Map(sketches.map((sketch) => [sketch.id, sketch]));
  const featuresById = new Map(
    features.map((feature) => [feature.id, feature])
  );
  const seenSketches = new Set<string>();
  const seenFeatures = new Set<string>();
  const rows: DocumentTreeRow[] = [];
  const addSketch = (id: string) => {
    if (seenSketches.has(id)) return;
    const row = sketchRowsById.get(id);
    if (!row) return;
    seenSketches.add(id);
    rows.push(row);
  };
  const addFeature = (id: string) => {
    if (seenFeatures.has(id)) return;
    const row = featureRowsById.get(id);
    if (!row) return;
    seenFeatures.add(id);
    rows.push(row);
  };

  for (const part of parts) {
    const partSketchIds = new Set(part.sketchIds);
    for (const featureId of part.featureIds) {
      const feature = featuresById.get(featureId);
      if (!feature) continue;
      for (const sketchId of getFeatureSketchIds(feature)) {
        if (partSketchIds.has(sketchId) && sketchesById.has(sketchId)) {
          addSketch(sketchId);
        }
      }
      addFeature(featureId);
    }
    for (const sketchId of part.sketchIds) addSketch(sketchId);
  }
  for (const sketch of sketches) addSketch(sketch.id);
  for (const feature of features) addFeature(feature.id);
  return rows;
}

function getFeatureSketchIds(feature: CadFeatureSummary): readonly string[] {
  switch (feature.kind) {
    case "extrude":
    case "revolve":
    case "hole":
      return [feature.sketchId];
    case "sweep":
      return [feature.profile.sketchId, feature.path.sketchId];
    case "loft":
      return feature.sections.map((section) => section.sketchId);
    case "primitive":
    case "chamfer":
    case "fillet":
    case "importedBody":
    case "linearPattern":
    case "circularPattern":
    case "mirror":
    case "shell":
      return [];
  }
}

function createOriginRow(
  plane: "XY" | "XZ" | "YZ",
  label: string,
  capabilitiesFor: (
    selection: DocumentTreeSelection
  ) => DocumentTreeRowCapabilities
): DocumentTreeRow {
  const selection = { kind: "origin-plane", plane } as const;
  return {
    id: documentTreeSelectionKey(selection),
    label,
    detail: plane,
    icon:
      plane === "XY"
        ? "top-view"
        : plane === "XZ"
          ? "front-view"
          : "right-view",
    selection,
    capabilities: capabilitiesFor(selection),
    children: []
  };
}

function orderByPartIds<T extends { readonly id: string }>(
  parts: readonly CadPartSnapshot[],
  entries: readonly T[],
  idsForPart: (part: CadPartSnapshot) => readonly string[]
): readonly T[] {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const ordered: T[] = [];

  for (const part of parts) {
    for (const id of idsForPart(part)) {
      const entry = entriesById.get(id);
      if (entry && !seen.has(id)) {
        seen.add(id);
        ordered.push(entry);
      }
    }
  }

  for (const entry of entries) {
    if (!seen.has(entry.id)) ordered.push(entry);
  }
  return ordered;
}

function groupBy<T>(
  entries: readonly T[],
  keyFor: (entry: T) => string
): ReadonlyMap<string, readonly T[]> {
  const grouped = new Map<string, T[]>();
  for (const entry of entries) {
    const key = keyFor(entry);
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  return grouped;
}

function visitRow(row: DocumentTreeRow, rows: Map<string, DocumentTreeRow>) {
  rows.set(row.id, row);
  for (const child of row.children) visitRow(child, rows);
}

function healthForSketch(
  health: ProjectHealthQueryResponse | undefined,
  id: string
): DocumentTreeHealth | undefined {
  if (!health) return undefined;
  return createHealth(
    getSketchHealthStatus(health, id),
    getHealthIssues(health, { kind: "sketch", id })
  );
}

function healthForFeature(
  health: ProjectHealthQueryResponse | undefined,
  id: string
): DocumentTreeHealth | undefined {
  if (!health) return undefined;
  return createHealth(
    getFeatureHealthStatus(health, id),
    getHealthIssues(health, { kind: "feature", id })
  );
}

function healthForBody(
  health: ProjectHealthQueryResponse | undefined,
  id: string
): DocumentTreeHealth | undefined {
  if (!health) return undefined;
  return createHealth(
    getBodyHealthStatus(health, id),
    getHealthIssues(health, { kind: "body", id })
  );
}

function healthForNamedReference(
  health: ProjectHealthQueryResponse | undefined,
  name: string
): DocumentTreeHealth | undefined {
  if (!health) return undefined;
  return createHealth(
    getNamedReferenceHealthStatus(health, name),
    getHealthIssues(health, { kind: "namedReference", name })
  );
}

function createHealth(
  status: CadDependencyHealthStatus | undefined,
  issues: readonly string[]
): DocumentTreeHealth | undefined {
  // Normal sketch freedom is design information, not a failed model result.
  // Sketch mode and Project health retain the detailed solver/readiness view;
  // the history tree reserves alarm badges for actionable failures.
  if (!status || status === "healthy" || status === "under-defined") {
    return undefined;
  }
  const label = formatHealthLabel(status);
  return {
    label,
    tone: "error",
    description: issues[0] ?? label
  };
}

function formatHealthLabel(status: CadDependencyHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "under-defined":
      return "Under-defined";
    case "over-defined":
      return "Over-defined";
    case "stale":
      return "Needs attention";
    case "missing-source":
      return "Missing source";
    case "unsupported":
      return "Unsupported";
  }
}

function formatFeatureKind(feature: CadFeatureSummary): string {
  switch (feature.kind) {
    case "primitive":
      return formatObjectKind(feature.primitive);
    case "linearPattern":
      return "Linear pattern";
    case "circularPattern":
      return "Circular pattern";
    case "importedBody":
      return "Imported body";
    default:
      return capitalize(feature.kind);
  }
}

function featureIcon(feature: CadFeatureSummary): IconName {
  switch (feature.kind) {
    case "primitive":
      return objectIcon(feature.primitive);
    case "linearPattern":
      return "linear-pattern";
    case "circularPattern":
      return "circular-pattern";
    case "importedBody":
      return "import";
    case "extrude":
    case "revolve":
    case "sweep":
    case "loft":
    case "hole":
    case "fillet":
    case "chamfer":
    case "shell":
    case "mirror":
      return feature.kind;
  }
}

function objectIcon(kind: CadObjectSnapshot["kind"]): IconName {
  return kind;
}

function formatObjectKind(kind: CadObjectSnapshot["kind"]): string {
  return capitalize(kind);
}

function entityIcon(
  kind: SketchSnapshot["entities"][number]["kind"]
): IconName {
  return kind;
}

function formatEntityKind(
  kind: SketchSnapshot["entities"][number]["kind"]
): string {
  return capitalize(kind);
}

function formatSketchPlane(sketch: SketchSnapshot): string {
  return sketch.attachment ? "Attached sketch" : `${sketch.plane} plane`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
