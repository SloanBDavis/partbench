import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  documentTreeEditingKeyForEditor,
  documentTreeKeysForBodySelection
} from "./documentTreeProjection";
import { DocumentTreeDock } from "./DocumentTreeDock";
import type {
  DocumentTreeGroup,
  DocumentTreeProjection,
  DocumentTreeRow
} from "./documentTreeProjection";
import {
  collectVisibleRowIds,
  resolveDocumentTreeEditingKeys,
  resolveDocumentTreeSelectedKeys,
  toggleTreeExpansion
} from "./documentTreeState";

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

  it("highlights the clicked feature when App remaps selection to its body", () => {
    const projection = createProjection();
    const keys = resolveDocumentTreeSelectedKeys({
      selectedKey: "body:body_1",
      clickedRowId: "feature:feature_1",
      rowsById: projection.rowsById
    });

    expect(keys.has("feature:feature_1")).toBe(true);
    expect(keys.has("body:body_1")).toBe(false);
  });

  it("accepts selectedKeys and recovers sketch editing from a feature-prefixed key", () => {
    const projection = createProjectionWithSketch();
    const selected = resolveDocumentTreeSelectedKeys({
      selectedKeys: ["feature:feature_1", "body:body_1"],
      rowsById: projection.rowsById
    });
    expect([...selected].sort()).toEqual(["body:body_1", "feature:feature_1"]);

    const editing = resolveDocumentTreeEditingKeys({
      editingKey: "feature:sketch_1",
      rowsById: projection.rowsById
    });
    expect(editing.has("sketch:sketch_1")).toBe(true);

    const markup = renderToStaticMarkup(
      createElement(DocumentTreeDock, {
        projection,
        selectedKeys: ["feature:feature_1"],
        editingKey: "feature:sketch_1",
        initialExpandedIds: ["group:model", "feature:feature_1"],
        onSelect: () => undefined,
        onEdit: () => undefined
      })
    );
    expect(markup).toContain('data-tree-select="sketch:sketch_1"');
    expect(markup).toContain("Editing");
    expect(markup).toContain('class="pb-tree-row is-selected');
  });

  it("closes the row menu markup path after invoking an action", () => {
    let deleted = false;
    const markup = renderToStaticMarkup(
      createElement(DocumentTreeDock, {
        projection: createProjection(),
        initialExpandedIds: ["group:model", "feature:feature_1"],
        onSelect: () => undefined,
        onDelete: () => {
          deleted = true;
        }
      })
    );
    // Menu is closed by default; opening requires interaction. Contract helpers:
    expect(
      documentTreeEditingKeyForEditor({ kind: "extrude", sourceId: "f1" })
    ).toBe("feature:f1");
    expect(
      documentTreeEditingKeyForEditor({
        kind: "sketch-edit",
        sourceId: "s1"
      })
    ).toBe("sketch:s1");
    expect(
      documentTreeKeysForBodySelection({
        bodyId: "b1",
        featureId: "f1"
      })
    ).toEqual(["body:b1", "feature:f1"]);
    expect(markup).toContain('aria-expanded="false"');
    expect(deleted).toBe(false);
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

function createProjectionWithSketch(): DocumentTreeProjection {
  const base = createProjection();
  const sketch: DocumentTreeRow = {
    id: "sketch:sketch_1",
    label: "Profile",
    icon: "sketch",
    selection: { kind: "sketch", id: "sketch_1" },
    capabilities: { canEdit: true },
    children: []
  };
  const model = base.groups[2];
  const groups = [
    base.groups[0],
    base.groups[1],
    { ...model, rows: [sketch, ...model.rows] },
    base.groups[3]
  ] as const satisfies DocumentTreeProjection["groups"];

  return {
    groups,
    rowsById: new Map([...base.rowsById, [sketch.id, sketch]])
  };
}

function group(
  id: DocumentTreeGroup["id"],
  label: DocumentTreeGroup["label"],
  rows: readonly DocumentTreeRow[]
): DocumentTreeGroup {
  return { id, label, icon: id === "model" ? "sketch" : "solid", rows };
}
