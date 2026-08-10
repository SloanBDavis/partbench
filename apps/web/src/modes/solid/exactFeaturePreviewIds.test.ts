import { describe, expect, it } from "vitest";

import type { FeatureExtrudeForm } from "../../cadCommands";
import {
  materializeSolidEditorRequestIds,
  type SolidFeaturePreviewIdCounters
} from "./exactFeaturePreviewIds";
import {
  type SolidDraft,
  type SolidEditorKind,
  type SolidEditorRequest
} from "./solidEditorTypes";

const counters: SolidFeaturePreviewIdCounters = {
  nextFeatureNumber: 12,
  nextBodyNumber: 27
};

const previewCreateKinds = [
  "extrude",
  "compositeExtrude",
  "revolve",
  "compositeRevolve",
  "hole",
  "chamfer",
  "fillet",
  "linearPattern",
  "circularPattern",
  "mirror",
  "shell",
  "sweep",
  "compositeSweep",
  "loft"
] as const satisfies readonly SolidEditorKind[];

function requestFor(
  kind: SolidEditorKind,
  initialDraft: SolidDraft,
  mode?: "create" | "edit"
): SolidEditorRequest {
  return {
    key: `${kind}-request`,
    kind,
    title: `Test ${kind}`,
    ...(mode ? { mode } : {}),
    initialDraft
  };
}

function blankDraft(): SolidDraft {
  return {
    id: "",
    bodyId: "",
    name: "Preview feature"
  } as SolidDraft;
}

describe("materializeSolidEditorRequestIds", () => {
  it.each(previewCreateKinds)(
    "materializes independent IDs for create %s",
    (kind) => {
      const request = requestFor(kind, blankDraft());

      const materialized = materializeSolidEditorRequestIds(
        request,
        counters
      );

      expect(materialized.initialDraft).toMatchObject({
        id: "feat_12",
        bodyId: "body_27",
        name: "Preview feature"
      });
    }
  );

  it("preserves supplied IDs and returns the original request", () => {
    const draft: FeatureExtrudeForm = {
      id: "feat_existing",
      bodyId: "body_existing",
      targetBodyId: "body_target",
      targetTopologyAnchorId: "anchor_target",
      name: "Pocket",
      depth: 8,
      side: "symmetric",
      operationMode: "cut"
    };
    const request = requestFor("extrude", draft);

    const materialized = materializeSolidEditorRequestIds(
      request,
      counters
    );

    expect(materialized).toBe(request);
    expect(materialized.initialDraft).toBe(draft);
  });

  it("materializes only a blank feature ID", () => {
    const request = requestFor("hole", {
      ...blankDraft(),
      id: "",
      bodyId: "body_kept"
    } as SolidDraft);

    const materialized = materializeSolidEditorRequestIds(
      request,
      counters
    );

    expect(materialized.initialDraft).toMatchObject({
      id: "feat_12",
      bodyId: "body_kept"
    });
  });

  it("materializes only a blank body ID", () => {
    const request = requestFor("shell", {
      ...blankDraft(),
      id: "feat_kept",
      bodyId: ""
    } as SolidDraft);

    const materialized = materializeSolidEditorRequestIds(
      request,
      counters
    );

    expect(materialized.initialDraft).toMatchObject({
      id: "feat_kept",
      bodyId: "body_27"
    });
  });

  it.each([
    ["extrude", "edit"],
    ["compositeExtrude", "edit"],
    ["revolve", "edit"],
    ["compositeRevolve", "edit"],
    ["hole", "edit"],
    ["chamfer", "edit"],
    ["fillet", "edit"],
    ["linearPattern", "edit"],
    ["circularPattern", "edit"],
    ["mirror", "edit"],
    ["shell", "edit"],
    ["sweep", "edit"],
    ["compositeSweep", "edit"],
    ["loft", "edit"],
    ["box", "create"],
    ["cylinder", "create"],
    ["sphere", "create"],
    ["cone", "create"],
    ["torus", "create"],
    ["sketch", "create"],
    ["transform", "create"]
  ] as const)("leaves %s %s requests unchanged", (kind, mode) => {
    const request = requestFor(kind, blankDraft(), mode);

    expect(materializeSolidEditorRequestIds(request, counters)).toBe(request);
  });

  it("does not mutate the input request or draft", () => {
    const request = requestFor("compositeExtrude", {
      ...blankDraft(),
      profile: {
        kind: "entity",
        sketchId: "sketch_profile",
        entityId: "entity_profile"
      }
    } as SolidDraft);
    const before = structuredClone(request);

    const materialized = materializeSolidEditorRequestIds(
      request,
      counters
    );

    expect(request).toEqual(before);
    expect(materialized).not.toBe(request);
    expect(materialized.initialDraft).not.toBe(request.initialDraft);
    expect(materialized.initialDraft).toMatchObject({
      id: "feat_12",
      bodyId: "body_27",
      profile: before.initialDraft.profile
    });
  });
});
