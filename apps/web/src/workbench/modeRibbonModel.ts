import type { ProjectedUiAction, UiActionId } from "../actions/actionRegistry";
import type { IconName } from "../ui/Icon";
import type { WorkbenchMode } from "./types";

const HEADER_OWNED_ACTIONS = new Set<UiActionId>([
  "project.undo",
  "project.redo"
]);

const MODE_RIBBON_GROUPS: Readonly<
  Record<WorkbenchMode, readonly string[] | undefined>
> = {
  project: undefined,
  solid: ["Create", "Modify", "Pattern", "Inspect"],
  sketch: ["Create", "State", "Constraint", "Dimension", "Finish"],
  inspect: ["Measure", "Reference", "View", "Health"]
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
  const allowedGroups = MODE_RIBBON_GROUPS[mode];
  const groups = new Map<string, ProjectedUiAction[]>();
  for (const action of actions) {
    if (
      HEADER_OWNED_ACTIONS.has(action.definition.id) ||
      !action.definition.modes.includes(mode) ||
      (allowedGroups !== undefined &&
        !allowedGroups.includes(action.definition.group))
    ) {
      continue;
    }
    const group = groups.get(action.definition.group) ?? [];
    group.push(action);
    groups.set(action.definition.group, group);
  }

  return [...groups.entries()].map(([label, groupActions]) => ({
    id: `${mode}-${slug(label)}`,
    label,
    actions: groupActions,
    protectedFromOverflow: label === "Finish" || label === "Commit"
  }));
}

/**
 * Keeps a stable prefix and every protected group. Groups leave from the
 * trailing edge and never split between the ribbon and More menu.
 */
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

export function getActionIcon(id: UiActionId): IconName {
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
    edit: "edit",
    rename: "edit",
    delete: "delete",
    point: "point",
    line: "line",
    rectangle: "rectangle",
    circle: "circle",
    arc: "arc",
    construction: "line",
    horizontal: "constraint",
    vertical: "constraint",
    fixed: "constraint",
    coincident: "constraint",
    midpoint: "constraint",
    parallel: "constraint",
    perpendicular: "constraint",
    "rectangle-width": "dimension",
    "rectangle-height": "dimension",
    "line-length": "dimension",
    radius: "dimension",
    "arc-sweep": "dimension",
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
  return exact[suffix] ?? "more";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
