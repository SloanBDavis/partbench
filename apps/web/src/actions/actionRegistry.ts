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

/** Canonical needs-selection / blocked copy shared by registry defaults and App projection. */
export const UI_ACTION_AVAILABILITY_MESSAGES = {
  openSketchMode: "Open Sketch mode.",
  solidExtrude: "Select a supported sketch profile.",
  solidRevolve: "Select a supported sketch profile and axis.",
  solidSweep: "Select a supported profile and path.",
  solidLoft:
    "Select at least two closed sketch profiles. Sections may lie on non-parallel planes.",
  solidTransform: "Select an editable source object.",
  solidHole: "Select a supported circle and target body.",
  solidFillet: "Select a supported generated edge.",
  solidChamfer: "Select a supported generated edge.",
  solidShell: "Select a supported body or face.",
  solidLinearPattern: "Select a supported body.",
  solidCircularPattern: "Select a supported body.",
  solidMirror: "Select a supported body.",
  solidCombine: "Select two completed exact solids.",
  solidOffset: "Select a sketch profile or a face.",
  solidAlign: "Select a completed exact body and a planar face to move.",
  solidDraft: "Select a completed exact solid and a planar face set.",
  solidFixedMate: "Create an assembly with at least one instance to ground.",
  solidCoincidentMate: "Create an assembly with at least two instances to mate.",
  solidEdit: "Select an editable feature or object.",
  solidRename: "Select a renameable object or sketch.",
  solidDelete: "Select a deletable object or sketch item.",
  sketchTrim: "Select a supported line, arc, or circle.",
  sketchExtend: "Select a supported line or arc.",
  sketchSplit: "Select a supported line, arc, or circle.",
  sketchExplodeRectangle: "Select a rectangle.",
  sketchOffset:
    "Select a supported line, arc, circle, rectangle, or line/arc chain.",
  sketchRegions: "Open a sketch containing closed profile geometry.",
  sketchConstruction: "Select a sketch entity.",
  sketchDelete: "Select a sketch entity, dimension, or constraint.",
  inspectMassProperties: "Select a body with available exact properties.",
  inspectNameReference: "Select a supported face or edge.",
  inspectRepairReference: "Select a named reference and its replacement.",
  inspectFitSelection: "Select a visible body, face, or edge."
} as const;

const SKETCH_INTENT_ACTION_METADATA = (
  [
    ["horizontal", "Horizontal", "Constraint"],
    ["vertical", "Vertical", "Constraint"],
    ["fixed", "Fixed", "Constraint"],
    ["coincident", "Coincident", "Constraint"],
    ["midpoint", "Midpoint", "Constraint"],
    ["parallel", "Parallel", "Constraint"],
    ["perpendicular", "Perpendicular", "Constraint"],
    ["tangent", "Tangent", "Constraint"],
    ["concentric", "Concentric", "Constraint"],
    ["equal-length", "Equal length", "Constraint"],
    ["equal-radius", "Equal radius", "Constraint"],
    ["symmetry", "Symmetry", "Constraint"],
    ["rectangle-width", "Rectangle width", "Dimension"],
    ["rectangle-height", "Rectangle height", "Dimension"],
    ["line-length", "Line length", "Dimension"],
    ["radius", "Radius", "Dimension"],
    ["diameter", "Diameter", "Dimension"],
    ["arc-sweep", "Arc sweep", "Dimension"],
    ["point-distance", "Point distance", "Dimension"],
    ["horizontal-distance", "Horizontal distance", "Dimension"],
    ["vertical-distance", "Vertical distance", "Dimension"],
    ["point-line-distance", "Point to line", "Dimension"],
    ["line-angle", "Line angle", "Dimension"]
  ] as const
).map(([id, label, group]) =>
  action(
    `sketch.${id}`,
    label,
    group,
    ["sketch"],
    [],
    true,
    undefined,
    blocked(UI_ACTION_AVAILABILITY_MESSAGES.openSketchMode)
  )
);

export const UI_ACTION_METADATA = [
  action("project.new", "New", "File", ["project"], ["new project"], true),
  action(
    "project.open",
    "Open .wcad",
    "File",
    ["project"],
    ["open project", "wcad", "open"],
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
    "Save as",
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
    "Prepare JSON",
    "Advanced Interchange",
    ["project"],
    ["generate json", "export json"],
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
    "Download STEP",
    "Export",
    ["project"],
    ["export step"],
    false
  ),
  action(
    "project.export-glb",
    "Download visualization GLB",
    "Export",
    ["project"],
    ["mesh export", "glb", "export visualization glb"],
    false
  ),
  action(
    "project.overview",
    "Project overview",
    "Navigate",
    ["project"],
    ["units", "summary"],
    false
  ),
  action(
    "project.files",
    "Project files",
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
    "project.agent",
    "Agent",
    "Navigate",
    ["project"],
    ["mcp", "approval", "connected agent"],
    false
  ),
  action(
    "project.export",
    "Export workspace",
    "Navigate",
    ["project"],
    ["export readiness"],
    false
  ),
  action(
    "project.create-parameter",
    "Create parameter",
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
    "Ctrl/Cmd+Shift+Z or Ctrl+Y"
  ),
  action(
    "project.command-search",
    "Command search",
    "View",
    WORKBENCH_MODES,
    ["search commands", "quick open"],
    false,
    "Ctrl/Cmd+K"
  ),
  action(
    "project.help",
    "Help",
    "View",
    WORKBENCH_MODES,
    ["keyboard shortcuts", "shortcuts"],
    false
  ),
  action(
    "project.cancel",
    "Cancel",
    "View",
    WORKBENCH_MODES,
    ["escape", "cancellation stack"],
    false,
    "Escape"
  ),
  action(
    "project.apply",
    "Apply",
    "View",
    WORKBENCH_MODES,
    ["commit draft", "apply feature"],
    true,
    "Ctrl/Cmd+Enter"
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
    "Create sketch",
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
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidExtrude)
  ),
  action(
    "solid.revolve",
    "Revolve",
    "Create",
    ["solid"],
    ["lathe", "spin profile"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidRevolve)
  ),
  action(
    "solid.sweep",
    "Sweep",
    "Create",
    ["solid"],
    ["profile path"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidSweep)
  ),
  action(
    "solid.loft",
    "Loft",
    "Create",
    ["solid"],
    ["sections"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidLoft)
  ),
  action(
    "solid.transform",
    "Transform",
    "Modify",
    ["solid"],
    ["move", "rotate", "scale"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidTransform)
  ),
  action(
    "solid.hole",
    "Hole",
    "Modify",
    ["solid"],
    ["drill"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidHole)
  ),
  action(
    "solid.fillet",
    "Fillet",
    "Modify",
    ["solid"],
    ["round edge"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidFillet)
  ),
  action(
    "solid.chamfer",
    "Chamfer",
    "Modify",
    ["solid"],
    ["bevel edge"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidChamfer)
  ),
  action(
    "solid.shell",
    "Shell",
    "Modify",
    ["solid"],
    ["hollow"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidShell)
  ),
  action(
    "solid.linear-pattern",
    "Linear body pattern",
    "Pattern",
    ["solid"],
    ["array", "repeat"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidLinearPattern)
  ),
  action(
    "solid.circular-pattern",
    "Circular body pattern",
    "Pattern",
    ["solid"],
    ["radial pattern", "array"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidCircularPattern)
  ),
  action(
    "solid.mirror",
    "Mirror",
    "Pattern",
    ["solid"],
    ["reflect"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidMirror)
  ),
  action(
    "solid.combine",
    "Combine",
    "Modify",
    ["solid"],
    ["union", "subtract", "boolean", "fuse"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidCombine)
  ),
  action(
    "solid.offset",
    "Offset",
    "Modify",
    ["solid"],
    ["offset face", "offset profile", "associative offset"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidOffset)
  ),
  action(
    "solid.align",
    "Align",
    "Modify",
    ["solid"],
    ["align body", "move body", "mate face", "datum"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidAlign)
  ),
  action(
    "solid.draft",
    "Draft",
    "Modify",
    ["solid"],
    ["draft face", "taper", "draft angle"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidDraft)
  ),
  action(
    "solid.datum-plane",
    "Datum plane",
    "Sketch",
    ["solid", "sketch"],
    ["offset plane", "construction plane"],
    true
  ),
  action(
    "solid.datum-axis",
    "Datum axis",
    "Sketch",
    ["solid", "sketch"],
    ["construction axis", "pattern axis"],
    true
  ),
  action(
    "solid.fixed-mate",
    "Fixed mate",
    "Assemble",
    ["solid"],
    ["ground", "fixed", "assembly mate", "root"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidFixedMate)
  ),
  action(
    "solid.coincident-mate",
    "Coincident mate",
    "Assemble",
    ["solid"],
    ["coincident", "plane mate", "stack", "assembly mate"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidCoincidentMate)
  ),
  action(
    "solid.edit",
    "Edit",
    "Selection",
    ["solid", "sketch"],
    ["edit feature", "properties"],
    false,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidEdit)
  ),
  action(
    "solid.rename",
    "Rename",
    "Selection",
    ["solid", "sketch", "inspect"],
    ["change name"],
    true,
    "F2",
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidRename)
  ),
  action(
    "solid.delete",
    "Delete",
    "Selection",
    ["solid"],
    ["remove"],
    true,
    "Delete/Backspace",
    needs(UI_ACTION_AVAILABILITY_MESSAGES.solidDelete)
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
  action("sketch.spline", "Spline", "Create", ["sketch"], ["add spline"], true),
  action("sketch.slot", "Slot", "Create", ["sketch"], ["add slot"], true),
  action(
    "sketch.rounded-rectangle",
    "Rounded Rectangle",
    "Create",
    ["sketch"],
    ["add rounded rectangle"],
    true
  ),
  action(
    "sketch.arc",
    "Three-point arc",
    "Create",
    ["sketch"],
    ["arc", "curve"],
    true
  ),
  action(
    "sketch.trim",
    "Trim",
    "Modify",
    ["sketch"],
    ["remove curve interval"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchTrim)
  ),
  action(
    "sketch.extend",
    "Extend",
    "Modify",
    ["sketch"],
    ["extend curve to boundary"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchExtend)
  ),
  action(
    "sketch.split",
    "Split",
    "Modify",
    ["sketch"],
    ["divide curve"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchSplit)
  ),
  action(
    "sketch.explode-rectangle",
    "Explode rectangle",
    "Modify",
    ["sketch"],
    ["rectangle to lines"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchExplodeRectangle)
  ),
  action(
    "sketch.offset",
    "Offset",
    "Modify",
    ["sketch"],
    ["offset curve", "parallel curve"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchOffset)
  ),
  action(
    "sketch.regions",
    "Material Regions",
    "Modify",
    ["sketch"],
    [
      "profile cells",
      "select region",
      "holes",
      "region revolve",
      "hollow revolve"
    ],
    false,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchRegions)
  ),
  action(
    "sketch.construction",
    "Construction",
    "State",
    ["sketch"],
    ["construction geometry"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchConstruction)
  ),
  action(
    "sketch.delete",
    "Delete sketch item",
    "State",
    ["sketch"],
    ["remove entity", "remove constraint", "delete"],
    true,
    "Delete/Backspace",
    needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchDelete)
  ),
  ...SKETCH_INTENT_ACTION_METADATA,
  action(
    "sketch.finish",
    "Finish sketch",
    "Finish",
    ["sketch"],
    ["exit sketch", "done"],
    false
  ),

  action(
    "inspect.measure",
    "Measure selection",
    "Measure",
    ["inspect"],
    ["inspect", "size", "measure"],
    false
  ),
  action(
    "inspect.measure-between",
    "Measure between two targets",
    "Measure",
    ["inspect"],
    ["two target", "distance", "measure between"],
    false
  ),
  action(
    "inspect.mass-properties",
    "Mass properties",
    "Measure",
    ["inspect"],
    ["volume", "center of mass"],
    false,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectMassProperties)
  ),
  action(
    "inspect.name-reference",
    "Name reference",
    "Reference",
    ["inspect", "solid"],
    ["save reference"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectNameReference)
  ),
  action(
    "inspect.repair-reference",
    "Repair reference",
    "Reference",
    ["inspect", "solid"],
    ["replace reference", "stale reference"],
    true,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectRepairReference)
  ),
  action(
    "inspect.fit-all",
    "Fit all",
    "View",
    ["inspect", "solid"],
    ["zoom all"],
    false,
    "F"
  ),
  action(
    "inspect.fit-selection",
    "Fit selected",
    "View",
    ["inspect", "solid"],
    ["zoom selection", "fit selection"],
    false,
    undefined,
    needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectFitSelection)
  ),
  action(
    "inspect.top",
    "Top",
    "View",
    ["inspect", "solid", "sketch"],
    ["camera top", "top view"],
    false
  ),
  action(
    "inspect.front",
    "Front",
    "View",
    ["inspect", "solid", "sketch"],
    ["camera front", "front view"],
    false
  ),
  action(
    "inspect.right",
    "Right",
    "View",
    ["inspect", "solid", "sketch"],
    ["camera right", "right view"],
    false
  ),
  action(
    "inspect.isometric",
    "Isometric",
    "View",
    ["inspect", "solid"],
    ["camera iso", "isometric view"],
    false
  ),
  action(
    "inspect.health",
    "Model health",
    "Health",
    ["inspect", "project"],
    ["diagnostics", "reference health"],
    false
  )
] as const satisfies readonly UiActionMetadata[];

export type UiActionId = (typeof UI_ACTION_METADATA)[number]["id"];

/**
 * Actions owned by the global header (or workbench chrome), not the mode ribbon.
 * `modeRibbonModel` must exclude these from ribbon projection.
 */
export const HEADER_OWNED_UI_ACTION_IDS = [
  "project.undo",
  "project.redo",
  "project.command-search",
  "project.help",
  "project.cancel",
  "project.apply"
] as const satisfies readonly UiActionId[];

/**
 * When the same expanded shortcut token is declared by more than one action in a
 * mode, the first listed id wins. F2 on `solid.rename` is an addition beyond the
 * V18 minimum shortcut set.
 */
export const SHORTCUT_MODE_PRECEDENCE: Readonly<
  Partial<Record<WorkbenchMode, readonly UiActionId[]>>
> = {
  sketch: ["sketch.delete"]
};

export type UiActionAvailabilityProjection = Readonly<
  Partial<Record<UiActionId, UiActionAvailability>>
>;

export interface UiActionContext {
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

  if (action.availability.status === "blocked") {
    context.explainUnavailable?.(action.definition.id, action.availability);
    return { status: "unavailable", availability: action.availability };
  }

  await action.definition.run(context);
  return { status: "started" };
}

/**
 * Expand a declared shortcut string into individual tokens the router can bind.
 * Handles `or` alternatives and `/` dual-key forms (e.g. Delete/Backspace).
 */
export function expandShortcutDeclaration(
  shortcut: string | undefined
): readonly string[] {
  if (!shortcut) return [];
  return shortcut
    .split(/\s+or\s+/i)
    .flatMap((part) => {
      const trimmed = part.trim();
      if (!trimmed) return [];
      if (/^[A-Za-z]+\/[A-Za-z]+$/.test(trimmed)) {
        return trimmed.split("/");
      }
      return [trimmed];
    })
    .filter(Boolean);
}

/**
 * Resolve a keyboard shortcut token to exactly one action for the active mode.
 * Uses {@link SHORTCUT_MODE_PRECEDENCE} when multiple declarations collide.
 */
export function resolveShortcutActionId(
  shortcutToken: string,
  mode: WorkbenchMode,
  registry: readonly UiActionDefinition[] = UI_ACTION_REGISTRY
): UiActionId | undefined {
  const normalized = shortcutToken.trim().toLocaleLowerCase();
  const matches = registry.filter(
    (action) =>
      action.modes.includes(mode) &&
      expandShortcutDeclaration(action.shortcut).some(
        (token) => token.toLocaleLowerCase() === normalized
      )
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0]?.id;

  const precedence = SHORTCUT_MODE_PRECEDENCE[mode] ?? [];
  for (const id of precedence) {
    const preferred = matches.find((action) => action.id === id);
    if (preferred) return preferred.id;
  }
  return matches[0]?.id;
}

/** Build per-mode shortcut → action maps after applying collision precedence. */
export function getShortcutBindingsByMode(
  registry: readonly UiActionDefinition[] = UI_ACTION_REGISTRY
): ReadonlyMap<WorkbenchMode, ReadonlyMap<string, UiActionId>> {
  const byMode = new Map<WorkbenchMode, Map<string, UiActionId>>();
  for (const mode of WORKBENCH_MODES) {
    const bindings = new Map<string, UiActionId>();
    const tokens = new Set<string>();
    for (const action of registry) {
      if (!action.modes.includes(mode) || !action.shortcut) continue;
      for (const token of expandShortcutDeclaration(action.shortcut)) {
        tokens.add(token);
      }
    }
    for (const token of tokens) {
      const id = resolveShortcutActionId(token, mode, registry);
      if (id) bindings.set(token, id);
    }
    byMode.set(mode, bindings);
  }
  return byMode;
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

function blocked(message: string): UiActionAvailability {
  return { status: "blocked", message };
}
