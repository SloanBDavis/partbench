import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommandSearchDialog } from "./CommandSearchDialog";
import {
  getNextCommandSearchResultIndex,
  invokeCommandSearchAction
} from "./commandSearchDialogModel";
import { projectUiActions, type UiActionContext } from "./actionRegistry";

describe("CommandSearchDialog", () => {
  it("renders searchable action metadata without frontend IDs", () => {
    const context = createContext();
    const actions = projectUiActions(context).filter((action) =>
      ["solid.extrude", "project.undo"].includes(action.definition.id)
    );
    const markup = renderToStaticMarkup(
      createElement(CommandSearchDialog, {
        open: true,
        actions,
        actionContext: context,
        currentMode: "solid",
        onRequestClose: vi.fn()
      })
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain("Extrude");
    expect(markup).toContain("pull, profile");
    expect(markup).toContain("Create");
    expect(markup).toContain("Solid");
    expect(markup).toContain("Needs selection");
    expect(markup).toContain("Ctrl/Cmd+Z");
    expect(markup).not.toContain("solid.extrude");
    expect(markup).not.toContain("project.undo");
    expect(markup).not.toContain("chat");
  });

  it("presents ready, needs-selection, blocked, and pending states textually", () => {
    const context = createContext({
      pending: true,
      availability: {
        "inspect.mass-properties": {
          status: "needs-selection",
          message: "Select a body with available exact properties."
        },
        "inspect.health": {
          status: "blocked",
          message: "Model health is unavailable while rebuilding."
        }
      }
    });
    const actions = projectUiActions(context).filter((action) =>
      [
        "inspect.fit-all",
        "inspect.mass-properties",
        "inspect.health",
        "solid.box"
      ].includes(action.definition.id)
    );
    const markup = renderToStaticMarkup(
      createElement(CommandSearchDialog, {
        open: true,
        actions,
        actionContext: context,
        onRequestClose: vi.fn()
      })
    );

    expect(markup).toContain("Ready");
    expect(markup).toContain("Needs selection");
    expect(markup).toContain("Blocked");
    expect(markup).toContain("Pending");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-disabled="true"');
  });

  it("does not render when closed", () => {
    const context = createContext();
    expect(
      renderToStaticMarkup(
        createElement(CommandSearchDialog, {
          open: false,
          actions: projectUiActions(context),
          actionContext: context,
          onRequestClose: vi.fn()
        })
      )
    ).toBe("");
  });

  it("wraps Arrow navigation and supports Home and End", () => {
    expect(getNextCommandSearchResultIndex(0, 4, "ArrowDown")).toBe(1);
    expect(getNextCommandSearchResultIndex(3, 4, "ArrowDown")).toBe(0);
    expect(getNextCommandSearchResultIndex(0, 4, "ArrowUp")).toBe(3);
    expect(getNextCommandSearchResultIndex(2, 4, "Home")).toBe(0);
    expect(getNextCommandSearchResultIndex(1, 4, "End")).toBe(3);
    expect(getNextCommandSearchResultIndex(-1, 4, "ArrowDown")).toBe(0);
    expect(getNextCommandSearchResultIndex(-1, 4, "ArrowUp")).toBe(3);
    expect(getNextCommandSearchResultIndex(0, 0, "ArrowDown")).toBe(-1);
  });

  it("explains blocked actions without running their registry handlers", async () => {
    const runAction = vi.fn();
    const explainUnavailable = vi.fn();
    const context = createContext({
      runAction,
      explainUnavailable,
      availability: {
        "inspect.health": {
          status: "blocked",
          message: "Resolve the model error before inspecting health."
        }
      }
    });
    const blocked = projectUiActions(context).find(
      (action) => action.definition.id === "inspect.health"
    );
    if (!blocked) throw new Error("Missing inspect health action");

    await expect(invokeCommandSearchAction(blocked, context)).resolves.toEqual({
      status: "unavailable",
      availability: {
        status: "blocked",
        message: "Resolve the model error before inspecting health."
      }
    });
    expect(explainUnavailable).toHaveBeenCalledWith(
      "inspect.health",
      blocked.availability
    );
    expect(runAction).not.toHaveBeenCalled();
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
