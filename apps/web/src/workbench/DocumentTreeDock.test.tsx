import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  collectVisibleRowIds,
  DocumentTreeDock,
  toggleTreeExpansion
} from "./DocumentTreeDock";
import type {
  DocumentTreeGroup,
  DocumentTreeProjection,
  DocumentTreeRow
} from "./documentTreeProjection";

describe("DocumentTreeDock", () => {
  it("renders compact accessible rows without legacy tabs", () => {
    const markup = renderToStaticMarkup(
      createElement(DocumentTreeDock, {
        projection: createProjection(),
        selectedKey: "body:body_1",
        editingKey: "feature:feature_1",
        initialExpandedIds: [
          "group:origin",
          "group:model",
          "feature:feature_1"
        ],
        onSelect: () => undefined,
        onToggleVisibility: () => undefined,
        onEdit: () => undefined,
        onDelete: () => undefined
      })
    );

    expect(markup).toContain('role="tree"');
    expect(markup).toContain('aria-label="Document tree"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-label="Hide Result body"');
    expect(markup).toContain('aria-label="Actions for Extrude"');
    expect(markup).toContain("Editing");
    expect(markup).not.toContain('role="tab"');
    expect(markup).not.toContain("Tree</button>");
    expect(markup).not.toContain("Selection</button>");
  });

  it("keeps immutable expansion state and reports only visible descendants", () => {
    const projection = createProjection();
    const initial = new Set(["group:model"]);
    const expanded = toggleTreeExpansion(initial, "feature:feature_1", true);
    const collapsed = toggleTreeExpansion(expanded, "feature:feature_1", false);

    expect(initial.has("feature:feature_1")).toBe(false);
    expect(expanded.has("feature:feature_1")).toBe(true);
    expect(collapsed.has("feature:feature_1")).toBe(false);
    expect(collectVisibleRowIds(projection.groups, expanded)).toEqual([
      "feature:feature_1",
      "body:body_1"
    ]);
  });
});

function createProjection(): DocumentTreeProjection {
  const body: DocumentTreeRow = {
    id: "body:body_1",
    label: "Result body",
    icon: "solid",
    selection: { kind: "body", id: "body_1" },
    capabilities: { visible: true, canDelete: true },
    children: []
  };
  const feature: DocumentTreeRow = {
    id: "feature:feature_1",
    label: "Extrude",
    icon: "extrude",
    selection: { kind: "feature", id: "feature_1" },
    capabilities: { canEdit: true },
    children: [body]
  };
  const groups = [
    group("origin", "Origin", []),
    group("parameters", "Parameters", []),
    group("model", "Model", [feature]),
    group("references", "Named references", [])
  ] as const;

  return {
    groups,
    rowsById: new Map([
      [feature.id, feature],
      [body.id, body]
    ])
  };
}

function group(
  id: DocumentTreeGroup["id"],
  label: DocumentTreeGroup["label"],
  rows: readonly DocumentTreeRow[]
): DocumentTreeGroup {
  return { id, label, icon: id === "model" ? "sketch" : "solid", rows };
}
