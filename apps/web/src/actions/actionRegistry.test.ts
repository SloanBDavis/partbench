import { describe, expect, it, vi } from "vitest";
import {
  UI_ACTION_METADATA,
  UI_ACTION_REGISTRY,
  WORKBENCH_MODES,
  invokeUiAction,
  projectUiActions,
  type UiActionContext,
  type UiActionId
} from "./actionRegistry";
import { searchUiActions } from "./commandSearch";

describe("V18 UI action registry", () => {
  it("uses unique, mode-namespaced frontend IDs and complete presentation metadata", () => {
    const ids = UI_ACTION_REGISTRY.map((action) => action.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(UI_ACTION_METADATA).toHaveLength(UI_ACTION_REGISTRY.length);

    for (const action of UI_ACTION_REGISTRY) {
      expect(action.id).toMatch(
        /^(project|solid|sketch|inspect)\.[a-z][a-z0-9-]*$/
      );
      expect(action.label.trim()).not.toBe("");
      expect(action.group.trim()).not.toBe("");
      expect(action.modes.length).toBeGreaterThan(0);
      expect(action.modes.every((mode) => WORKBENCH_MODES.includes(mode))).toBe(
        true
      );
      expect(action.aliases.every((alias) => alias.trim() !== "")).toBe(true);
    }
  });

  it("registers the complete creatable sketch intent matrix", () => {
    const ids = UI_ACTION_REGISTRY.map((action) => action.id);
    const intentIds = [
      "horizontal",
      "vertical",
      "fixed",
      "coincident",
      "midpoint",
      "parallel",
      "perpendicular",
      "tangent",
      "concentric",
      "equal-length",
      "equal-radius",
      "symmetry",
      "rectangle-width",
      "rectangle-height",
      "line-length",
      "radius",
      "diameter",
      "arc-sweep",
      "point-distance",
      "horizontal-distance",
      "vertical-distance",
      "point-line-distance",
      "line-angle"
    ].map((id) => `sketch.${id}`);
    expect(ids).toEqual(expect.arrayContaining(intentIds));
    expect(
      ids.filter((id) =>
        UI_ACTION_REGISTRY.find((action) => action.id === id)?.group.match(
          /Constraint|Dimension/
        )
      )
    ).toHaveLength(23);
  });

  it("reads availability only from the assembled projection", () => {
    const context = createContext({
      availability: {
        "solid.extrude": {
          status: "blocked",
          message: "Profile is open. Connect the highlighted endpoints."
        },
        "inspect.fit-selection": { status: "ready" }
      }
    });
    const projected = projectUiActions(context);

    expect(find(projected, "solid.extrude").availability).toEqual({
      status: "blocked",
      message: "Profile is open. Connect the highlighted endpoints."
    });
    expect(find(projected, "inspect.fit-selection").availability).toEqual({
      status: "ready"
    });
    expect(find(projected, "solid.hole").availability).toEqual({
      status: "needs-selection",
      message: "Select a supported circle and target body."
    });
    expect(find(projected, "solid.box").availability).toEqual({
      status: "ready"
    });
  });

  it("shares the same projected object across ribbon/search/context mirrors", () => {
    const projected = projectUiActions(
      createContext({
        availability: {
          "solid.fillet": {
            status: "blocked",
            message: "The selected edge is no longer available."
          }
        }
      })
    );
    const ribbonAction = find(projected, "solid.fillet");
    const searchAction = searchUiActions(projected, "fillet")[0];
    const contextualAction = projected.filter(
      (action) => action.definition.id === "solid.fillet"
    )[0];

    expect(searchAction?.definition).toBe(ribbonAction.definition);
    expect(contextualAction).toBe(ribbonAction);
    expect(searchAction?.availability).toBe(ribbonAction.availability);
  });

  it("prevents pending mutation and unavailable actions from reaching handlers", async () => {
    const runAction = vi.fn();
    const explainUnavailable = vi.fn();
    const context = createContext({
      pending: true,
      runAction,
      explainUnavailable,
      availability: {
        "solid.extrude": {
          status: "blocked",
          message: "Choose a closed profile."
        }
      }
    });
    const projected = projectUiActions(context);

    await expect(
      invokeUiAction(find(projected, "solid.box"), context)
    ).resolves.toEqual({ status: "pending" });
    expect(runAction).not.toHaveBeenCalled();

    const nonMutating = find(projected, "inspect.fit-all");
    await expect(invokeUiAction(nonMutating, context)).resolves.toEqual({
      status: "started"
    });
    expect(runAction).toHaveBeenCalledWith("inspect.fit-all");

    const readyContext = { ...context, pending: false };
    const blocked = find(projectUiActions(readyContext), "solid.extrude");
    await expect(invokeUiAction(blocked, readyContext)).resolves.toEqual({
      status: "unavailable",
      availability: {
        status: "blocked",
        message: "Choose a closed profile."
      }
    });
    expect(explainUnavailable).toHaveBeenCalledWith(
      "solid.extrude",
      blocked.availability
    );
    expect(runAction).not.toHaveBeenCalledWith("solid.extrude");

    const collectorContext = createContext({ runAction });
    const needsSelection = find(
      projectUiActions(collectorContext),
      "solid.revolve"
    );
    await expect(
      invokeUiAction(needsSelection, collectorContext)
    ).resolves.toEqual({ status: "started" });
    expect(runAction).toHaveBeenCalledWith("solid.revolve");

    const curveTargetCollector = find(
      projectUiActions(collectorContext),
      "sketch.trim"
    );
    expect(curveTargetCollector.availability.status).toBe("needs-selection");
    await expect(
      invokeUiAction(curveTargetCollector, collectorContext)
    ).resolves.toEqual({ status: "started" });
    expect(runAction).toHaveBeenCalledWith("sketch.trim");
  });
});

describe("V18 command search", () => {
  it("orders exact label, label prefix, alias prefix, then stable registry order", () => {
    const actions = projectUiActions(createContext()).filter((action) =>
      [
        "inspect.measure",
        "inspect.measure-between",
        "solid.measure",
        "inspect.mass-properties"
      ].includes(action.definition.id)
    );

    expect(searchUiActions(actions, "measure").map(resultShape)).toEqual([
      ["solid.measure", "exact-label"],
      ["inspect.measure", "label-prefix"],
      ["inspect.measure-between", "label-prefix"],
      ["inspect.mass-properties", "other"]
    ]);

    const allActions = projectUiActions(createContext());
    expect(searchUiActions(allActions, "array").map(resultShape)).toEqual([
      ["solid.linear-pattern", "alias-prefix"],
      ["solid.circular-pattern", "alias-prefix"]
    ]);
  });

  it("matches normalized substrings, token prefixes, mode/group, and shortcuts", () => {
    const actions = projectUiActions(createContext());

    expect(searchUiActions(actions, "  THREE-point   ")[0]?.definition.id).toBe(
      "sketch.arc"
    );
    expect(searchUiActions(actions, "vis glb")[0]?.definition.id).toBe(
      "project.export-glb"
    );
    expect(
      searchUiActions(actions, "modify").map((result) => result.definition.id)
    ).toEqual([
      "solid.transform",
      "solid.hole",
      "solid.fillet",
      "solid.chamfer",
      "solid.shell",
      "solid.combine",
      "sketch.trim",
      "sketch.extend",
      "sketch.split",
      "sketch.explode-rectangle",
      "sketch.offset",
      "sketch.regions"
    ]);
    expect(searchUiActions(actions, "ctrl/cmd+k")[0]?.definition.id).toBe(
      "project.command-search"
    );
    expect(searchUiActions(actions, "ctrl/cmd+z")[0]?.definition.id).toBe(
      "project.undo"
    );
  });

  it("returns stable registry order for an empty query", () => {
    const actions = projectUiActions(createContext());
    expect(
      searchUiActions(actions, " ").map((result) => result.definition.id)
    ).toEqual(UI_ACTION_REGISTRY.map((action) => action.id));
  });

  it("uses current-mode readiness to break equally relevant matches", () => {
    // Both actions carry the exact alias "distance", so only the current mode
    // can decide which one ranks first.
    const actions = projectUiActions(createContext()).filter((action) =>
      ["solid.measure", "inspect.measure-between"].includes(
        action.definition.id
      )
    );

    expect(
      searchUiActions(actions, "distance", "inspect").map(
        (result) => result.definition.id
      )
    ).toEqual(["inspect.measure-between", "solid.measure"]);
    expect(
      searchUiActions(actions, "distance", "solid").map(
        (result) => result.definition.id
      )
    ).toEqual(["solid.measure", "inspect.measure-between"]);
    expect(
      searchUiActions(
        projectUiActions(createContext()),
        "create sketch",
        "solid"
      )[0]?.definition
    ).toMatchObject({ id: "solid.sketch", label: "Create sketch" });
  });
});

function createContext(
  overrides: Partial<UiActionContext> = {}
): UiActionContext {
  return {
    availability: {},
    pending: false,
    runAction: () => undefined,
    ...overrides
  };
}

function find(actions: ReturnType<typeof projectUiActions>, id: UiActionId) {
  const action = actions.find((candidate) => candidate.definition.id === id);
  if (!action) throw new Error(`Missing test action ${id}`);
  return action;
}

function resultShape(result: ReturnType<typeof searchUiActions>[number]) {
  return [result.definition.id, result.match];
}
