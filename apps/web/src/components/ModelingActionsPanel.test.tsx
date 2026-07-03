import type { CadBodySnapshot, CadFeatureSummary } from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModelingActionsPanel } from "./ModelingActionsPanel";

function createBody(
  id: string,
  featureId: string,
  options: {
    readonly consumedByFeatureId?: string;
    readonly name?: string;
  } = {}
): CadBodySnapshot {
  return {
    id,
    kind: "solid",
    partId: "part:default",
    featureId,
    ...(options.consumedByFeatureId
      ? { consumedByFeatureId: options.consumedByFeatureId }
      : {}),
    ...(options.name ? { name: options.name } : {}),
    source: {
      type: "sketchExtrudeFeature",
      featureId,
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    }
  };
}

function createExtrudeFeature(
  id: string,
  bodyId: string
): Extract<CadFeatureSummary, { kind: "extrude" }> {
  return {
    id,
    kind: "extrude",
    partId: "part:default",
    bodyId,
    sketchId: "sketch_1",
    entityId: "rect_1",
    profileKind: "rectangle",
    depth: 1,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: "rect_1"
    }
  };
}

function createMirrorFeature(
  id: string,
  bodyId: string,
  seedBodyId: string
): Extract<CadFeatureSummary, { kind: "mirror" }> {
  return {
    id,
    kind: "mirror",
    partId: "part:default",
    bodyId,
    seedBodyId,
    mirrorPlane: "YZ",
    includeOriginal: true,
    source: {
      type: "mirrorFeature",
      seedBodyId,
      mirrorPlane: "YZ"
    }
  };
}

function renderBodyWorkbench(
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined
): string {
  return renderToStaticMarkup(
    createElement(ModelingActionsPanel, {
      actions: [],
      context: {
        selectionKind: "body",
        body,
        ...(feature ? { feature } : {})
      }
    })
  );
}

describe("ModelingActionsPanel mirror workbench", () => {
  it("offers the mirror creation form for an active authored body", () => {
    const markup = renderBodyWorkbench(
      createBody("body_seed", "feat_seed", { name: "Seed body" }),
      createExtrudeFeature("feat_seed", "body_seed")
    );

    expect(markup).toContain("Mirror body");
    expect(markup).toContain("Seed Seed body");
    expect(markup).toContain("Mirror plane");
    expect(markup).toContain("XY plane");
    expect(markup).toContain("XZ plane");
    expect(markup).toContain("YZ plane");
    expect(markup).toContain("Include original");
    expect(markup).toContain("Create mirror");
    expect(markup).toContain("the seed body stays active");
  });

  it("offers the mirror edit form when a mirror result body is selected", () => {
    const markup = renderBodyWorkbench(
      createBody("body_mirror", "feat_mirror"),
      createMirrorFeature("feat_mirror", "body_mirror", "body_seed")
    );

    expect(markup).toContain("Edit mirror");
    expect(markup).toContain("Feature feat_mirror");
    expect(markup).toContain("Apply mirror edits");
    expect(markup).toContain("merged into the result");
  });

  it("explains why a consumed body cannot seed a mirror", () => {
    const markup = renderBodyWorkbench(
      createBody("body_seed", "feat_seed", { consumedByFeatureId: "feat_cut" }),
      createExtrudeFeature("feat_seed", "body_seed")
    );

    expect(markup).toContain("Mirror");
    expect(markup).toContain("consumed by feature feat_cut");
    expect(markup).not.toContain("Create mirror");
  });

  it("explains why a primitive-derived body cannot seed a mirror", () => {
    const markup = renderBodyWorkbench(
      createBody("body_box", "feat_box"),
      undefined
    );

    expect(markup).toContain("Primitive-derived bodies cannot seed a mirror");
    expect(markup).not.toContain("Create mirror");
  });
});
