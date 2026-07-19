import { describe, expect, it } from "vitest";
import { UI_ACTION_REGISTRY } from "../actions/actionRegistry";
import {
  V18_CAPABILITY_MANIFEST,
  V18_FORBIDDEN_IMAGE_ONLY_CAPABILITY_IDS
} from "./capabilityManifest";

describe("V18 capability manifest", () => {
  it("gives every capability exactly one V18 owner and complete audit evidence", () => {
    const ids = V18_CAPABILITY_MANIFEST.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const row of V18_CAPABILITY_MANIFEST) {
      expect(row.legacyOwner.trim()).not.toBe("");
      expect(row.legacyHandler.trim()).not.toBe("");
      expect(row.v18Owner.trim()).not.toBe("");
      expect(row.availabilityAuthority.trim()).not.toBe("");
      expect(row.parityTest).toMatch(/\.test\.tsx?$/);
      expect(row.retirementSlice).toMatch(/^[B-H]$/);

      if (row.effect.kind === "cadops") {
        expect(row.effect.builder.trim()).not.toBe("");
      } else {
        expect(row.effect.effect.trim()).not.toBe("");
      }
    }
  });

  it("maps every inventoried invokable operation to one registry item and back", () => {
    const actionRows = V18_CAPABILITY_MANIFEST.filter(
      (row) => row.surface === "registry-action"
    );
    const manifestActionIds = actionRows.map((row) => row.actionId);
    const registryIds = UI_ACTION_REGISTRY.map((action) => action.id);

    expect(manifestActionIds).toEqual(registryIds);
    expect(new Set(manifestActionIds).size).toBe(manifestActionIds.length);
  });

  it("includes non-registry fields, tree operations, file fallbacks, and gestures", () => {
    const surfaces = new Set(V18_CAPABILITY_MANIFEST.map((row) => row.surface));
    expect(surfaces).toEqual(
      new Set([
        "registry-action",
        "field-edit",
        "tree-operation",
        "sketch-gesture",
        "viewport-gesture",
        "display-only",
        "advanced-operation"
      ])
    );

    for (const id of [
      "v18.capability.primitive-edit-fields",
      "v18.capability.feature-edit-fields",
      "v18.capability.tree-select",
      "v18.capability.three-point-arc-cancel",
      "v18.capability.wcad-upload-fallback",
      "v18.capability.step-upload-fallback",
      "v18.capability.solver-state"
    ]) {
      expect(V18_CAPABILITY_MANIFEST.some((row) => row.id === id)).toBe(true);
    }
  });

  it("contains no reference-image-only capability", () => {
    const searchableInventory = V18_CAPABILITY_MANIFEST.flatMap((row) => [
      row.id,
      row.actionId ?? ""
    ]);

    for (const forbidden of V18_FORBIDDEN_IMAGE_ONLY_CAPABILITY_IDS) {
      expect(searchableInventory).not.toContain(forbidden);
      expect(searchableInventory).not.toContain(
        `v18.capability.action.${forbidden}`
      );
    }
  });

  it("keeps V18 presentation source effects separate from CAD builders", () => {
    const sourceEffects = V18_CAPABILITY_MANIFEST.filter(
      (row) => row.effect.kind === "cadops"
    );
    expect(sourceEffects.length).toBeGreaterThan(30);
    expect(
      sourceEffects.every(
        (row) =>
          row.effect.kind === "cadops" &&
          !/engine\.execute|document\.(set|delete)|objects\.(set|delete)/i.test(
            row.effect.builder
          )
      )
    ).toBe(true);
  });
});
