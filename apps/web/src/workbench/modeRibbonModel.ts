import {
  HEADER_OWNED_UI_ACTION_IDS,
  UI_ACTION_REGISTRY,
  type ProjectedUiAction,
  type UiActionId
} from "../actions/actionRegistry";
import type { IconName } from "../ui/Icon";
import type { WorkbenchMode } from "./types";

const HEADER_OWNED_ACTIONS = new Set<UiActionId>(HEADER_OWNED_UI_ACTION_IDS);

/**
 * Preferred group order per mode. Groups are included only when the registry
 * has at least one non-header action for that mode; unknown groups append in
 * registry encounter order so ribbon and command search cannot drift.
 */
const MODE_RIBBON_GROUP_ORDER: Readonly<
  Record<WorkbenchMode, readonly string[]>
> = {
  project: [
    "File",
    "Advanced Interchange",
    "Export",
    "Navigate",
    "Parameters",
    "Health"
  ],
  solid: [
    "Create",
    "Modify",
    "Assemble",
    "Pattern",
    "Selection",
    "Inspect",
    "Reference",
    "View"
  ],
  sketch: [
    "Create",
    "Modify",
    "State",
    "Constraint",
    "Dimension",
    "Selection",
    "View",
    "Finish"
  ],
  inspect: ["Measure", "Reference", "View", "Selection", "Health"]
};

export interface RibbonGroupProjection {
  readonly id: string;
  readonly label: string;
  readonly actions: readonly ProjectedUiAction[];
  readonly protectedFromOverflow: boolean;
}

export function projectRibbonGroups(
  mode: WorkbenchMode,
  actions: readonly ProjectedUiAction[]
): readonly RibbonGroupProjection[] {
  const groups = new Map<string, ProjectedUiAction[]>();
  for (const action of actions) {
    if (
      HEADER_OWNED_ACTIONS.has(action.definition.id) ||
      !action.definition.modes.includes(mode)
    ) {
      continue;
    }
    const group = groups.get(action.definition.group) ?? [];
    group.push(action);
    groups.set(action.definition.group, group);
  }

  const preferred = MODE_RIBBON_GROUP_ORDER[mode];
  const orderedLabels = [
    ...preferred.filter((label) => groups.has(label)),
    ...[...groups.keys()].filter((label) => !preferred.includes(label))
  ];

  return orderedLabels.map((label) => {
    const groupActions = groups.get(label) ?? [];
    return {
      id: `${mode}-${slug(label)}`,
      label,
      actions: groupActions,
      protectedFromOverflow: label === "Finish" || label === "Commit"
    };
  });
}

/** True when every registry action that declares `mode` appears in that mode's ribbon. */
export function assertRibbonCoversRegistryModes(
  mode: WorkbenchMode,
  actions: readonly ProjectedUiAction[] = actionsFromRegistry()
): readonly UiActionId[] {
  const projectedIds = new Set(
    projectRibbonGroups(mode, actions).flatMap((group) =>
      group.actions.map((action) => action.definition.id)
    )
  );
  const missing: UiActionId[] = [];
  for (const action of actions) {
    if (
      HEADER_OWNED_ACTIONS.has(action.definition.id) ||
      !action.definition.modes.includes(mode)
    ) {
      continue;
    }
    if (!projectedIds.has(action.definition.id)) {
      missing.push(action.definition.id);
    }
  }
  return missing;
}

export function chooseVisibleRibbonGroupIds(
  groups: readonly RibbonGroupProjection[],
  widths: Readonly<Record<string, number>>,
  availableWidth: number,
  moreWidth = 68
): ReadonlySet<string> {
  const visible = new Set<string>();
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (group) visible.add(group.id);
  }
  const total = () =>
    groups.reduce(
      (sum, group) =>
        sum + (visible.has(group.id) ? (widths[group.id] ?? 0) : 0),
      0
    );

  if (total() <= availableWidth) return visible;
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group || group.protectedFromOverflow) continue;
    visible.delete(group.id);
    if (total() + moreWidth <= availableWidth) break;
  }
  return visible;
}

export function getActionIcon(id: UiActionId, group?: string): IconName {
  const suffix = id.slice(id.indexOf(".") + 1);
  const exact: Partial<Record<string, IconName>> = {
    new: "file",
    open: "project",
    save: "save",
    "save-as": "save",
    "import-step": "import",
    "import-json": "import",
    "export-json": "export",
    "download-json": "export",
    "export-step": "export",
    "export-glb": "export",
    overview: "project",
    files: "file",
    parameters: "dimension",
    history: "undo",
    export: "export",
    "create-parameter": "add",
    sketch: "sketch",
    box: "box",
    cylinder: "cylinder",
    sphere: "sphere",
    cone: "cone",
    torus: "torus",
    extrude: "extrude",
    revolve: "revolve",
    sweep: "sweep",
    loft: "loft",
    transform: "transform",
    hole: "hole",
    fillet: "fillet",
    chamfer: "chamfer",
    shell: "shell",
    "linear-pattern": "linear-pattern",
    "circular-pattern": "circular-pattern",
    mirror: "mirror",
    combine: "extrude",
    "datum-plane": "extrude",
    "datum-axis": "extrude",
    "fixed-mate": "constraint",
    "coincident-mate": "constraint",
    edit: "edit",
    rename: "edit",
    delete: "delete",
    point: "point",
    line: "line",
    rectangle: "rectangle",
    circle: "circle",
    arc: "arc",
    trim: "edit",
    extend: "edit",
    split: "edit",
    "explode-rectangle": "edit",
    construction: "line",
    finish: "success",
    measure: "measure",
    "measure-between": "measure",
    "mass-properties": "mass-properties",
    "name-reference": "reference",
    "repair-reference": "repair",
    "fit-all": "fit",
    "fit-selection": "fit",
    top: "top-view",
    front: "front-view",
    right: "right-view",
    isometric: "isometric",
    health: "success"
  };
  return (
    exact[suffix] ??
    (group === "Constraint"
      ? "constraint"
      : group === "Dimension"
        ? "dimension"
        : "more")
  );
}

function actionsFromRegistry(): readonly ProjectedUiAction[] {
  return UI_ACTION_REGISTRY.map((definition, registryIndex) => ({
    definition,
    availability: { status: "ready" as const },
    pending: false,
    registryIndex
  }));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
