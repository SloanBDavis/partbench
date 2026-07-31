import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  HEADER_OWNED_UI_ACTION_IDS,
  projectUiActions,
  UI_ACTION_REGISTRY,
  WORKBENCH_MODES,
  type UiActionContext
} from "../actions/actionRegistry";
import {
  composeActionTooltip,
  isRibbonTargetVisible,
  ModeRibbon
} from "./ModeRibbon";
import {
  assertRibbonCoversRegistryModes,
  chooseVisibleRibbonGroupIds,
  projectRibbonGroups
} from "./modeRibbonModel";

describe("V18 mode ribbon", () => {
  it("projects ordered, labeled mode groups and leaves header actions in the header", () => {
    const projected = projectUiActions(context());
    expect(
      projectRibbonGroups("solid", projected).map((group) => group.label)
    ).toEqual([
      "Create",
      "Modify",
      "Pattern",
      "Selection",
      "Inspect",
      "Reference",
      "View"
    ]);
    expect(
      projectRibbonGroups("project", projected)
        .flatMap((group) => group.actions)
        .map((action) => action.definition.id)
    ).not.toContain("project.undo");
    expect(projectRibbonGroups("sketch", projected).at(-1)).toMatchObject({
      label: "Finish",
      protectedFromOverflow: true
    });
    expect(
      projectRibbonGroups("sketch", projected).map((group) => group.label)
    ).toEqual([
      "Create",
      "Modify",
      "State",
      "Constraint",
      "Dimension",
      "Selection",
      "View",
      "Finish"
    ]);
  });

  it("includes Edit, Rename, and Delete in solid and sketch ribbons", () => {
    const projected = projectUiActions(context());
    const solidIds = projectRibbonGroups("solid", projected).flatMap((group) =>
      group.actions.map((action) => action.definition.id)
    );
    const sketchIds = projectRibbonGroups("sketch", projected).flatMap(
      (group) => group.actions.map((action) => action.definition.id)
    );
    for (const id of ["solid.edit", "solid.rename", "solid.delete"] as const) {
      expect(solidIds).toContain(id);
    }
    // Sketch mode owns entity deletion through `sketch.delete`, so `solid.delete`
    // is deliberately solid-only to keep Delete/Backspace unambiguous.
    for (const id of ["solid.edit", "solid.rename"] as const) {
      expect(sketchIds).toContain(id);
    }
    expect(sketchIds).toContain("sketch.delete");
    expect(sketchIds).not.toContain("solid.delete");
  });

  it("makes every registered action reachable in every mode it declares", () => {
    const projected = projectUiActions(context());
    for (const mode of WORKBENCH_MODES) {
      expect(assertRibbonCoversRegistryModes(mode, projected)).toEqual([]);
    }
    const headerOwned = new Set<string>(HEADER_OWNED_UI_ACTION_IDS);
    for (const definition of UI_ACTION_REGISTRY) {
      if (headerOwned.has(definition.id)) continue;
      for (const mode of definition.modes) {
        const ids = projectRibbonGroups(mode, projected).flatMap((group) =>
          group.actions.map((action) => action.definition.id)
        );
        expect(ids).toContain(definition.id);
      }
    }
  });

  it("moves whole trailing groups into overflow and keeps Finish visible", () => {
    const groups = projectRibbonGroups("sketch", projectUiActions(context()));
    const widths = Object.fromEntries(groups.map((group) => [group.id, 100]));
    const visible = chooseVisibleRibbonGroupIds(groups, widths, 268, 68);
    const firstGroup = groups.at(0);
    const lastGroup = groups.at(-1);
    if (!firstGroup || !lastGroup) {
      throw new Error("Expected projected sketch ribbon groups.");
    }

    expect([...visible]).toEqual([firstGroup.id, lastGroup.id]);
    expect(
      groups.every((group) => visible.has(group.id) || !visible.has(group.id))
    ).toBe(true);
  });

  it("renders shared ready, selection-needed, blocked, and pending projections", () => {
    const projected = projectUiActions(
      context({
        pending: true,
        availability: {
          "solid.extrude": {
            status: "blocked",
            message: "Profile is open."
          }
        }
      })
    );
    const markup = renderToStaticMarkup(
      createElement(ModeRibbon, {
        mode: "solid",
        actions: projected,
        onModeChange: vi.fn(),
        onInvokeAction: vi.fn()
      })
    );

    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain('aria-label="Solid tools"');
    expect(markup).toContain('title="Extrude — Profile is open."');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('data-action-id="solid.extrude"');
    expect(markup).toContain(">Extrude<");
  });

  it("keeps needs-selection actions invokable while blocked actions are aria-disabled", () => {
    const projected = projectUiActions(
      context({
        availability: {
          "solid.extrude": { status: "blocked", message: "Profile is open." }
        }
      })
    );
    const markup = renderToStaticMarkup(
      createElement(ModeRibbon, {
        mode: "solid",
        actions: projected,
        onModeChange: vi.fn(),
        onInvokeAction: vi.fn()
      })
    );

    expect(markup).toMatch(
      /data-availability="needs-selection"[^>]*title="Hole — Select a supported circle and target body\."/
    );
    expect(markup).toMatch(
      /aria-disabled="true"[^>]*data-availability="blocked"[^>]*title="Extrude — Profile is open\."/
    );
  });

  it("composes tooltips as label, shortcut, then availability reason", () => {
    expect(composeActionTooltip("Fit All", "F", undefined)).toBe("Fit All — F");
    expect(
      composeActionTooltip(
        "Delete",
        "Delete/Backspace",
        "Select a deletable item."
      )
    ).toBe("Delete — Delete/Backspace — Select a deletable item.");
    expect(composeActionTooltip("Extrude", undefined, "Profile is open.")).toBe(
      "Extrude — Profile is open."
    );

    const markup = renderToStaticMarkup(
      createElement(ModeRibbon, {
        mode: "solid",
        actions: projectUiActions(context()),
        onModeChange: vi.fn(),
        onInvokeAction: vi.fn()
      })
    );
    expect(markup).toContain('title="Fit all — F"');
    expect(markup).toContain(
      'title="Delete — Delete/Backspace — Select a deletable object or sketch item."'
    );
  });

  it("uses valid ARIA tokens for alternative shortcut keys", () => {
    const markup = renderToStaticMarkup(
      createElement(ModeRibbon, {
        mode: "sketch",
        actions: projectUiActions(context()),
        onModeChange: vi.fn(),
        onInvokeAction: vi.fn()
      })
    );

    expect(markup).toContain('aria-keyshortcuts="Delete Backspace"');
    expect(markup).not.toContain('aria-keyshortcuts="Delete/Backspace"');
  });

  it("treats CSS-hidden mode tabs as non-targets for roving focus", () => {
    const visible = {
      hidden: false,
      closest: () => null,
      getClientRects: () => [{ width: 40, height: 28 }]
    } as unknown as HTMLElement;
    const hiddenByCss = {
      hidden: false,
      closest: () => null,
      getClientRects: () => []
    } as unknown as HTMLElement;
    const hiddenAttr = {
      hidden: true,
      closest: () => null,
      getClientRects: () => [{ width: 40, height: 28 }]
    } as unknown as HTMLElement;

    expect(isRibbonTargetVisible(visible)).toBe(true);
    expect(isRibbonTargetVisible(hiddenByCss)).toBe(false);
    expect(isRibbonTargetVisible(hiddenAttr)).toBe(false);
  });
});

function context(overrides: Partial<UiActionContext> = {}): UiActionContext {
  return {
    availability: {},
    pending: false,
    runAction: () => undefined,
    ...overrides
  };
}
