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
    plane: { kind: "standardPlane", plane: "YZ", offset: 0 },
    includeOriginal: true,
    source: {
      type: "mirrorFeature",
      seedBodyId,
      plane: { kind: "standardPlane", plane: "YZ", offset: 0 }
    }
  };
}

function createShellFeature(
  id: string,
  bodyId: string,
  targetBodyId: string
): Extract<CadFeatureSummary, { kind: "shell" }> {
  return {
    id,
    kind: "shell",
    partId: "part:default",
    bodyId,
    targetBodyId,
    wallThickness: 0.2,
    openFaceRefs: [
      {
        kind: "generatedFace",
        bodyId: targetBodyId,
        stableId: `generated:face:${targetBodyId}:endCap`
      }
    ],
    source: {
      type: "shellFeature",
      targetBodyId
    }
  };
}

function createLinearPatternFeature(
  id: string,
  bodyId: string,
  seedBodyId: string
): Extract<CadFeatureSummary, { kind: "linearPattern" }> {
  return {
    id,
    kind: "linearPattern",
    partId: "part:default",
    bodyId,
    seedBodyId,
    direction: { kind: "globalAxis", axis: "x" },
    spacing: 10,
    instanceCount: 3,
    instances: [],
    source: {
      type: "linearPatternFeature",
      seedBodyId,
      direction: { kind: "globalAxis", axis: "x" }
    }
  };
}

function createCircularPatternFeature(
  id: string,
  bodyId: string,
  seedBodyId: string
): Extract<CadFeatureSummary, { kind: "circularPattern" }> {
  return {
    id,
    kind: "circularPattern",
    partId: "part:default",
    bodyId,
    seedBodyId,
    rotationAxis: { kind: "globalAxis", axis: "z" },
    totalAngleDegrees: 360,
    instanceCount: 6,
    instances: [],
    source: {
      type: "circularPatternFeature",
      seedBodyId,
      rotationAxis: { kind: "globalAxis", axis: "z" }
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

describe("ModelingActionsPanel pattern workbench", () => {
  it("offers the pattern creation form for an active authored body", () => {
    const markup = renderBodyWorkbench(
      createBody("body_seed", "feat_seed", { name: "Seed body" }),
      createExtrudeFeature("feat_seed", "body_seed")
    );

    expect(markup).toContain("Pattern body");
    expect(markup).toContain("Seed Seed body");
    expect(markup).toContain("Linear");
    expect(markup).toContain("Circular");
    expect(markup).toContain("Spacing");
    expect(markup).toContain("Instances");
    expect(markup).toContain("Create linear pattern");
  });

  it("offers the linear pattern edit form when a linear pattern result body is selected", () => {
    const markup = renderBodyWorkbench(
      createBody("body_linear", "feat_linear"),
      createLinearPatternFeature("feat_linear", "body_linear", "body_seed")
    );

    expect(markup).toContain("Edit linear pattern");
    expect(markup).toContain("Feature feat_linear");
    expect(markup).toContain("Axis");
    expect(markup).toContain("Spacing");
    expect(markup).toContain("Instances");
    expect(markup).toContain("Apply linear pattern edits");
  });

  it("offers the circular pattern edit form when a circular pattern result body is selected", () => {
    const markup = renderBodyWorkbench(
      createBody("body_circular", "feat_circular"),
      createCircularPatternFeature(
        "feat_circular",
        "body_circular",
        "body_seed"
      )
    );

    expect(markup).toContain("Edit circular pattern");
    expect(markup).toContain("Feature feat_circular");
    expect(markup).toContain("Axis");
    expect(markup).toContain("Angle");
    expect(markup).toContain("Instances");
    expect(markup).toContain("Apply circular pattern edits");
  });

  it("explains why a consumed body cannot seed a pattern", () => {
    const markup = renderBodyWorkbench(
      createBody("body_seed", "feat_seed", { consumedByFeatureId: "feat_cut" }),
      createExtrudeFeature("feat_seed", "body_seed")
    );

    expect(markup).toContain("Pattern");
    expect(markup).toContain("consumed by feature feat_cut");
    expect(markup).not.toContain("Create linear pattern");
  });
});

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

describe("ModelingActionsPanel shell workbench", () => {
  it("offers the shell creation form for an active authored body", () => {
    const markup = renderBodyWorkbench(
      createBody("body_seed", "feat_seed", { name: "Seed body" }),
      createExtrudeFeature("feat_seed", "body_seed")
    );

    expect(markup).toContain("Shell body");
    expect(markup).toContain("Target Seed body");
    expect(markup).toContain("Wall thickness");
    expect(markup).toContain("Feature name");
    expect(markup).toContain("Open faces");
    expect(markup).toContain("Closed shell");
    expect(markup).toContain("Create shell");
  });

  it("offers the shell edit form when a shell result body is selected", () => {
    const markup = renderBodyWorkbench(
      createBody("body_shell", "feat_shell"),
      createShellFeature("feat_shell", "body_shell", "body_seed")
    );

    expect(markup).toContain("Edit shell");
    expect(markup).toContain("Feature feat_shell");
    expect(markup).toContain("Wall thickness");
    expect(markup).toContain("Open faces");
    expect(markup).toContain("Apply shell edits");
    expect(markup).toContain(
      "Target face references are unavailable; thickness edits preserve existing open-face refs."
    );
  });

  it("explains why a consumed body cannot be shelled", () => {
    const markup = renderBodyWorkbench(
      createBody("body_seed", "feat_seed", { consumedByFeatureId: "feat_cut" }),
      createExtrudeFeature("feat_seed", "body_seed")
    );

    expect(markup).toContain("Shell");
    expect(markup).toContain("consumed by feature feat_cut");
    expect(markup).not.toContain("Create shell");
  });

  it("explains why a primitive-derived body cannot be shelled", () => {
    const markup = renderBodyWorkbench(
      createBody("body_box", "feat_box"),
      undefined
    );

    expect(markup).toContain(
      "Primitive-derived bodies cannot be shell targets"
    );
    expect(markup).not.toContain("Create shell");
  });
});
