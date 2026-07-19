export const WORKBENCH_MODES = [
  "project",
  "solid",
  "sketch",
  "inspect"
] as const;

export type WorkbenchMode = (typeof WORKBENCH_MODES)[number];

export type UiActionAvailability =
  | { readonly status: "ready" }
  | { readonly status: "needs-selection"; readonly message: string }
  | { readonly status: "blocked"; readonly message: string };

interface UiActionMetadata {
  readonly id: `${WorkbenchMode}.${string}`;
  readonly label: string;
  readonly group: string;
  readonly modes: readonly WorkbenchMode[];
  readonly aliases: readonly string[];
  readonly mutatesSource: boolean;
  readonly shortcut?: string;
  readonly defaultAvailability?: UiActionAvailability;
}

const READY = { status: "ready" } as const;

/**
 * Stable V18 action order. Ribbon groups, contextual actions, menus, and
 * command search filter this list; none owns CAD behavior.
 */
export const UI_ACTION_METADATA = [
  action("project.new", "New", "File", ["project"], ["new project"], true),
  action(
    "project.open",
    "Open",
    "File",
    ["project"],
    ["open project", "wcad"],
    true
  ),
  action(
    "project.save",
    "Save",
    "File",
    ["project"],
    ["save project", "wcad"],
    false
  ),
  action(
    "project.save-as",
    "Save As",
    "File",
    ["project"],
    ["download wcad"],
    false
  ),
  action(
    "project.import-step",
    "Import STEP",
    "File",
    ["project"],
    ["step upload"],
    true
  ),
  action(
    "project.import-json",
    "Import JSON",
    "Advanced Interchange",
    ["project"],
    ["load json"],
    true
  ),
  action(
    "project.export-json",
    "Export JSON",
    "Advanced Interchange",
    ["project"],
    ["generate json"],
    false
  ),
  action(
    "project.download-json",
    "Download JSON",
    "Advanced Interchange",
    ["project"],
    ["save json"],
    false
  ),
  action(
    "project.export-step",
    "Export STEP",
    "Export",
    ["project"],
    ["download step"],
    false
  ),
  action(
    "project.export-glb",
    "Export Visualization GLB",
    "Export",
    ["project"],
    ["mesh export", "glb"],
    false
  ),
  action(
    "project.overview",
    "Project Overview",
    "Navigate",
    ["project"],
    ["units", "summary"],
    false
  ),
  action(
    "project.files",
    "Project Files",
    "Navigate",
    ["project"],
    ["file workspace"],
    false
  ),
  action(
    "project.parameters",
    "Parameters",
    "Navigate",
    ["project"],
    ["variables", "expressions"],
    false
  ),
  action(
    "project.history",
    "History",
    "Navigate",
    ["project"],
    ["transactions"],
    false
  ),
  action(
    "project.export",
    "Export Workspace",
    "Navigate",
    ["project"],
    ["export readiness"],
    false
  ),
  action(
    "project.create-parameter",
    "Create Parameter",
    "Parameters",
    ["project"],
    ["add parameter"],
    true
  ),
  action(
    "project.undo",
    "Undo",
    "History",
    WORKBENCH_MODES,
    ["revert"],
    true,
    "Ctrl/Cmd+Z"
  ),
  action(
    "project.redo",
    "Redo",
    "History",
    WORKBENCH_MODES,
    ["repeat"],
    true,
    "Ctrl/Cmd+Shift+Z"
  ),

  action("solid.box", "Box", "Create", ["solid"], ["cube", "primitive"], true),
  action(
    "solid.cylinder",
    "Cylinder",
    "Create",
    ["solid"],
    ["primitive"],
    true
  ),
  action(
    "solid.sphere",
    "Sphere",
    "Create",
    ["solid"],
    ["ball", "primitive"],
    true
  ),
  action("solid.cone", "Cone", "Create", ["solid"], ["primitive"], true),
  action(
    "solid.torus",
    "Torus",
    "Create",
    ["solid"],
    ["donut", "primitive"],
    true
  ),
  action(
    "solid.sketch",
    "Sketch",
    "Create",
    ["solid"],
    ["create sketch", "draw"],
    true
  ),
  action(
    "solid.extrude",
    "Extrude",
    "Create",
    ["solid"],
    ["pull", "profile"],
    true,
    undefined,
    needs("Select a supported sketch profile.")
  ),
  action(
    "solid.revolve",
    "Revolve",
    "Create",
    ["solid"],
    ["lathe", "spin profile"],
    true,
    undefined,
    needs("Select a supported sketch profile and axis.")
  ),
  action(
    "solid.sweep",
    "Sweep",
    "Create",
    ["solid"],
    ["profile path"],
    true,
    undefined,
    needs("Select a supported profile and path.")
  ),
  action(
    "solid.loft",
    "Loft",
    "Create",
    ["solid"],
    ["sections"],
    true,
    undefined,
    needs("Select supported sketch sections.")
  ),
  action(
    "solid.transform",
    "Transform",
    "Modify",
    ["solid"],
    ["move", "rotate", "scale"],
    true,
    undefined,
    needs("Select an editable object.")
  ),
  action(
    "solid.hole",
    "Hole",
    "Modify",
    ["solid"],
    ["drill"],
    true,
    undefined,
    needs("Select a supported circle and target body.")
  ),
  action(
    "solid.fillet",
    "Fillet",
    "Modify",
    ["solid"],
    ["round edge"],
    true,
    undefined,
    needs("Select a supported edge.")
  ),
  action(
    "solid.chamfer",
    "Chamfer",
    "Modify",
    ["solid"],
    ["bevel edge"],
    true,
    undefined,
    needs("Select a supported edge.")
  ),
  action(
    "solid.shell",
    "Shell",
    "Modify",
    ["solid"],
    ["hollow"],
    true,
    undefined,
    needs("Select a supported body or face.")
  ),
  action(
    "solid.linear-pattern",
    "Linear Pattern",
    "Pattern",
    ["solid"],
    ["array", "repeat"],
    true,
    undefined,
    needs("Select a supported body.")
  ),
  action(
    "solid.circular-pattern",
    "Circular Pattern",
    "Pattern",
    ["solid"],
    ["radial pattern", "array"],
    true,
    undefined,
    needs("Select a supported body.")
  ),
  action(
    "solid.mirror",
    "Mirror",
    "Pattern",
    ["solid"],
    ["reflect"],
    true,
    undefined,
    needs("Select a supported body.")
  ),
  action(
    "solid.edit",
    "Edit",
    "Selection",
    ["solid", "sketch"],
    ["edit feature", "properties"],
    false,
    undefined,
    needs("Select an editable feature, sketch, or object.")
  ),
  action(
    "solid.rename",
    "Rename",
    "Selection",
    ["solid", "sketch", "inspect"],
    ["change name"],
    true,
    "F2",
    needs("Select a renameable item.")
  ),
  action(
    "solid.delete",
    "Delete",
    "Selection",
    ["solid", "sketch"],
    ["remove"],
    true,
    "Delete/Backspace",
    needs("Select a deletable item.")
  ),
  action(
    "solid.measure",
    "Measure",
    "Inspect",
    ["solid"],
    ["inspect size", "distance"],
    false
  ),

  action("sketch.point", "Point", "Create", ["sketch"], ["add point"], true),
  action("sketch.line", "Line", "Create", ["sketch"], ["add line"], true),
  action(
    "sketch.rectangle",
    "Rectangle",
    "Create",
    ["sketch"],
    ["add rectangle"],
    true
  ),
  action("sketch.circle", "Circle", "Create", ["sketch"], ["add circle"], true),
  action(
    "sketch.arc",
    "Three-point Arc",
    "Create",
    ["sketch"],
    ["arc", "curve"],
    true
  ),
  action(
    "sketch.construction",
    "Construction",
    "State",
    ["sketch"],
    ["construction geometry"],
    true,
    undefined,
    needs("Select a sketch entity.")
  ),
  action(
    "sketch.delete",
    "Delete Sketch Item",
    "State",
    ["sketch"],
    ["remove entity", "remove constraint"],
    true,
    "Delete/Backspace",
    needs("Select a sketch entity, dimension, or constraint.")
  ),
  action(
    "sketch.horizontal",
    "Horizontal",
    "Constraint",
    ["sketch"],
    ["horizontal constraint"],
    true,
    undefined,
    needs("Select an eligible line.")
  ),
  action(
    "sketch.vertical",
    "Vertical",
    "Constraint",
    ["sketch"],
    ["vertical constraint"],
    true,
    undefined,
    needs("Select an eligible line.")
  ),
  action(
    "sketch.fixed",
    "Fixed",
    "Constraint",
    ["sketch"],
    ["fix constraint"],
    true,
    undefined,
    needs("Select an eligible sketch entity.")
  ),
  action(
    "sketch.coincident",
    "Coincident",
    "Constraint",
    ["sketch"],
    ["join points"],
    true,
    undefined,
    needs("Select an eligible entity and endpoint.")
  ),
  action(
    "sketch.midpoint",
    "Midpoint",
    "Constraint",
    ["sketch"],
    ["center point"],
    true,
    undefined,
    needs("Select an eligible point and line.")
  ),
  action(
    "sketch.parallel",
    "Parallel",
    "Constraint",
    ["sketch"],
    ["parallel lines"],
    true,
    undefined,
    needs("Select eligible lines.")
  ),
  action(
    "sketch.perpendicular",
    "Perpendicular",
    "Constraint",
    ["sketch"],
    ["right angle"],
    true,
    undefined,
    needs("Select eligible lines.")
  ),
  action(
    "sketch.rectangle-width",
    "Rectangle Width",
    "Dimension",
    ["sketch"],
    ["width dimension"],
    true,
    undefined,
    needs("Select a rectangle.")
  ),
  action(
    "sketch.rectangle-height",
    "Rectangle Height",
    "Dimension",
    ["sketch"],
    ["height dimension"],
    true,
    undefined,
    needs("Select a rectangle.")
  ),
  action(
    "sketch.line-length",
    "Line Length",
    "Dimension",
    ["sketch"],
    ["length dimension"],
    true,
    undefined,
    needs("Select a line.")
  ),
  action(
    "sketch.radius",
    "Radius",
    "Dimension",
    ["sketch"],
    ["circle radius", "arc radius"],
    true,
    undefined,
    needs("Select a circle or arc.")
  ),
  action(
    "sketch.arc-sweep",
    "Arc Sweep",
    "Dimension",
    ["sketch"],
    ["sweep angle"],
    true,
    undefined,
    needs("Select an arc.")
  ),
  action(
    "sketch.finish",
    "Finish Sketch",
    "Finish",
    ["sketch"],
    ["exit sketch", "done"],
    false
  ),

  action(
    "inspect.measure",
    "Measure",
    "Measure",
    ["inspect"],
    ["inspect", "size"],
    false
  ),
  action(
    "inspect.measure-between",
    "Measure Between",
    "Measure",
    ["inspect"],
    ["two target", "distance"],
    false
  ),
  action(
    "inspect.mass-properties",
    "Mass Properties",
    "Measure",
    ["inspect"],
    ["volume", "center of mass"],
    false,
    undefined,
    needs("Select a body with available exact properties.")
  ),
  action(
    "inspect.name-reference",
    "Name Reference",
    "Reference",
    ["inspect", "solid"],
    ["save reference"],
    true,
    undefined,
    needs("Select a supported face or edge.")
  ),
  action(
    "inspect.repair-reference",
    "Repair Reference",
    "Reference",
    ["inspect", "solid"],
    ["replace reference", "stale reference"],
    true,
    undefined,
    needs("Select a named reference that needs repair.")
  ),
  action(
    "inspect.fit-all",
    "Fit All",
    "View",
    ["inspect", "solid"],
    ["zoom all"],
    false,
    "F"
  ),
  action(
    "inspect.fit-selection",
    "Fit Selection",
    "View",
    ["inspect", "solid"],
    ["zoom selection"],
    false,
    undefined,
    needs("Select an item to fit.")
  ),
  action(
    "inspect.top",
    "Top View",
    "View",
    ["inspect", "solid", "sketch"],
    ["camera top"],
    false
  ),
  action(
    "inspect.front",
    "Front View",
    "View",
    ["inspect", "solid", "sketch"],
    ["camera front"],
    false
  ),
  action(
    "inspect.right",
    "Right View",
    "View",
    ["inspect", "solid", "sketch"],
    ["camera right"],
    false
  ),
  action(
    "inspect.isometric",
    "Isometric View",
    "View",
    ["inspect", "solid"],
    ["camera iso"],
    false
  ),
  action(
    "inspect.health",
    "Model Health",
    "Health",
    ["inspect", "project"],
    ["diagnostics", "reference health"],
    false
  )
] as const satisfies readonly UiActionMetadata[];

export type UiActionId = (typeof UI_ACTION_METADATA)[number]["id"];

export type UiActionAvailabilityProjection = Readonly<
  Partial<Record<UiActionId, UiActionAvailability>>
>;

export interface UiActionContext {
  /** Precomputed from commands/queries before presentation renders. */
  readonly availability: UiActionAvailabilityProjection;
  readonly pending: boolean;
  readonly runAction: (id: UiActionId) => void | Promise<void>;
  readonly explainUnavailable?: (
    id: UiActionId,
    availability: Exclude<UiActionAvailability, { readonly status: "ready" }>
  ) => void;
}

export interface UiActionDefinition {
  readonly id: UiActionId;
  readonly label: string;
  readonly group: string;
  readonly modes: readonly WorkbenchMode[];
  readonly aliases: readonly string[];
  readonly mutatesSource: boolean;
  readonly shortcut?: string;
  readonly getAvailability: (context: UiActionContext) => UiActionAvailability;
  readonly run: (context: UiActionContext) => void | Promise<void>;
}

export interface ProjectedUiAction {
  readonly definition: UiActionDefinition;
  readonly availability: UiActionAvailability;
  readonly pending: boolean;
  readonly registryIndex: number;
}

export type UiActionInvocationResult =
  | { readonly status: "started" }
  | { readonly status: "pending" }
  | {
      readonly status: "unavailable";
      readonly availability: Exclude<
        UiActionAvailability,
        { readonly status: "ready" }
      >;
    };

export const UI_ACTION_REGISTRY: readonly UiActionDefinition[] =
  UI_ACTION_METADATA.map((metadata) => ({
    id: metadata.id,
    label: metadata.label,
    group: metadata.group,
    modes: metadata.modes,
    aliases: metadata.aliases,
    mutatesSource: metadata.mutatesSource,
    ...("shortcut" in metadata ? { shortcut: metadata.shortcut } : {}),
    getAvailability: (context: UiActionContext) =>
      context.availability[metadata.id] ??
      metadata.defaultAvailability ??
      READY,
    run: (context: UiActionContext) => context.runAction(metadata.id)
  }));

export function projectUiActions(
  context: UiActionContext,
  registry: readonly UiActionDefinition[] = UI_ACTION_REGISTRY
): readonly ProjectedUiAction[] {
  return registry.map((definition, registryIndex) => ({
    definition,
    availability: definition.getAvailability(context),
    pending: context.pending && definition.mutatesSource,
    registryIndex
  }));
}

export async function invokeUiAction(
  action: ProjectedUiAction,
  context: UiActionContext
): Promise<UiActionInvocationResult> {
  if (action.pending) return { status: "pending" };

  if (action.availability.status !== "ready") {
    context.explainUnavailable?.(action.definition.id, action.availability);
    return { status: "unavailable", availability: action.availability };
  }

  await action.definition.run(context);
  return { status: "started" };
}

function action<const Id extends `${WorkbenchMode}.${string}`>(
  id: Id,
  label: string,
  group: string,
  modes: readonly WorkbenchMode[],
  aliases: readonly string[],
  mutatesSource: boolean,
  shortcut?: string,
  defaultAvailability?: UiActionAvailability
): UiActionMetadata & { readonly id: Id } {
  return {
    id,
    label,
    group,
    modes,
    aliases,
    mutatesSource,
    ...(shortcut ? { shortcut } : {}),
    ...(defaultAvailability ? { defaultAvailability } : {})
  };
}

function needs(message: string): UiActionAvailability {
  return { status: "needs-selection", message };
}
