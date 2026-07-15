import { describe, expect, it } from "vitest";
import type { CadBodySnapshot, CadFeatureSummary } from "@web-cad/cad-protocol";
import {
  MIRROR_PLANE_OPTIONS,
  createMirrorDefaultName,
  formatMirrorPlaneLabel,
  getMirrorPanelState
} from "./mirrorPanelUi";

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
  seedBodyId: string,
  mirrorPlane: "XY" | "XZ" | "YZ",
  includeOriginal: boolean
): Extract<CadFeatureSummary, { kind: "mirror" }> {
  return {
    id,
    kind: "mirror",
    partId: "part:default",
    bodyId,
    seedBodyId,
    plane: { kind: "standardPlane", plane: mirrorPlane, offset: 0 },
    includeOriginal,
    source: {
      type: "mirrorFeature",
      seedBodyId,
      plane: { kind: "standardPlane", plane: mirrorPlane, offset: 0 }
    }
  };
}

describe("mirrorPanelUi", () => {
  it("offers an active authored feature body as a mirror seed", () => {
    const body = createBody("body_seed", "feat_seed", { name: "Seed body" });
    const feature = createExtrudeFeature("feat_seed", "body_seed");

    expect(getMirrorPanelState(body, feature)).toEqual({
      mode: "create",
      seedBodyId: "body_seed",
      seedLabel: "Seed body"
    });
  });

  it("falls back to the body id as the seed label when the body is unnamed", () => {
    const body = createBody("body_seed", "feat_seed");
    const feature = createExtrudeFeature("feat_seed", "body_seed");

    expect(getMirrorPanelState(body, feature)).toMatchObject({
      mode: "create",
      seedLabel: "body_seed"
    });
  });

  it("opens the edit form when the selected body is a mirror result", () => {
    const body = createBody("body_mirror", "feat_mirror");
    const feature = createMirrorFeature(
      "feat_mirror",
      "body_mirror",
      "body_seed",
      "YZ",
      true
    );

    expect(getMirrorPanelState(body, feature)).toEqual({
      mode: "edit",
      featureId: "feat_mirror",
      plane: { kind: "standardPlane", plane: "YZ", offset: 0 },
      includeOriginal: true
    });
  });

  it("rejects bodies without an authored feature as mirror seeds", () => {
    const body = createBody("body_primitive", "feat_primitive");

    expect(getMirrorPanelState(body, undefined)).toMatchObject({
      mode: "unavailable",
      reason: expect.stringContaining("Primitive-derived")
    });
  });

  it("rejects consumed bodies as mirror seeds", () => {
    const body = createBody("body_seed", "feat_seed", {
      consumedByFeatureId: "feat_cut"
    });
    const feature = createExtrudeFeature("feat_seed", "body_seed");

    expect(getMirrorPanelState(body, feature)).toMatchObject({
      mode: "unavailable",
      reason: expect.stringContaining("consumed by feature feat_cut")
    });
  });

  it("lists the three axis-aligned mirror planes", () => {
    expect(MIRROR_PLANE_OPTIONS).toEqual(["XY", "XZ", "YZ"]);
    expect(MIRROR_PLANE_OPTIONS.map(formatMirrorPlaneLabel)).toEqual([
      "XY plane",
      "XZ plane",
      "YZ plane"
    ]);
  });

  it("builds a descriptive default mirror feature name", () => {
    expect(createMirrorDefaultName("Seed body", "XZ")).toBe(
      "Mirror Seed body across XZ"
    );
  });
});
