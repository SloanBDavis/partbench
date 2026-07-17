import { describe, expect, it } from "vitest";

import {
  validateProfileInputSource,
  validateSketchPathRefSource,
  validateSketchProfileRefSource
} from "./index";

describe("V21 source reference validation", () => {
  it("preserves ordered profile and path refs", () => {
    expect(
      validateSketchProfileRefSource({
        kind: "wire",
        sketchId: "sketch-1",
        segments: [
          { entityId: "line-2", orientation: "reverse" },
          { entityId: "arc-1", orientation: "forward" }
        ]
      })
    ).toMatchObject({
      ok: true,
      value: {
        segments: [
          { entityId: "line-2", orientation: "reverse" },
          { entityId: "arc-1", orientation: "forward" }
        ]
      }
    });
  });

  it("reports the repeated path entity at its exact source path", () => {
    expect(
      validateSketchPathRefSource({
        kind: "chain",
        sketchId: "sketch-1",
        segments: [
          { entityId: "line-1", orientation: "forward" },
          { entityId: "line-1", orientation: "reverse" }
        ]
      })
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: "SKETCH_PATH_ENTITY_REPEATED",
          path: "path.segments[1].entityId"
        }
      ]
    });
  });

  it("rejects mixed normalized and legacy profile source", () => {
    expect(
      validateProfileInputSource({
        profile: { kind: "entity", sketchId: "sketch-1", entityId: "circle-1" },
        sketchId: "sketch-1",
        entityId: "circle-1"
      })
    ).toMatchObject({
      ok: false,
      issues: [{ code: "COMMAND_INPUT_AMBIGUOUS", path: "profile" }]
    });
  });
});
