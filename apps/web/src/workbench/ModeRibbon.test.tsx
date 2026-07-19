import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  projectUiActions,
  type UiActionContext
} from "../actions/actionRegistry";
import {
  ModeRibbon,
  chooseVisibleRibbonGroupIds,
  projectRibbonGroups
} from "./ModeRibbon";

describe("V18 mode ribbon", () => {
  it("projects ordered, labeled mode groups and leaves header actions in the header", () => {
    const projected = projectUiActions(context());
    expect(
      projectRibbonGroups("solid", projected).map((group) => group.label)
    ).toEqual(["Create", "Modify", "Pattern", "Inspect"]);
    expect(
      projectRibbonGroups("project", projected)
        .flatMap((group) => group.actions)
        .map((action) => action.definition.id)
    ).not.toContain("project.undo");
    expect(projectRibbonGroups("sketch", projected).at(-1)).toMatchObject({
      label: "Finish",
      protectedFromOverflow: true
    });
  });

  it("moves whole trailing groups into overflow and keeps Finish visible", () => {
    const groups = projectRibbonGroups("sketch", projectUiActions(context()));
    const widths = Object.fromEntries(groups.map((group) => [group.id, 100]));
    const visible = chooseVisibleRibbonGroupIds(groups, widths, 268, 68);

    expect([...visible]).toEqual([groups[0].id, groups.at(-1)?.id]);
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
    expect(markup).toContain('title="Profile is open."');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
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
      /data-availability="needs-selection"[^>]*title="Select a supported circle and target body\."/
    );
    expect(markup).toMatch(
      /aria-disabled="true"[^>]*data-availability="blocked"[^>]*title="Profile is open\."/
    );
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
