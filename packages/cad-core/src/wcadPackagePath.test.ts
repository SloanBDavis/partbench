import { describe, expect, it } from "vitest";

import { isValidWcadPackagePath } from "./wcadPackagePath";

describe("WCAD package paths", () => {
  it.each(["manifest.json", "document.cbor", "checkpoints/checkpoint_1.brep"])(
    "accepts canonical relative path %s",
    (path) => {
      expect(isValidWcadPackagePath(path)).toBe(true);
    }
  );

  it.each([
    "",
    "/document.cbor",
    "\\document.cbor",
    "checkpoints\\checkpoint.brep",
    "../document.cbor",
    "checkpoints/../document.cbor",
    "./document.cbor",
    "checkpoints//checkpoint.brep",
    "C:/document.cbor",
    "c:document.cbor",
    "document\0.cbor"
  ])("rejects non-relative or ambiguous path %j", (path) => {
    expect(isValidWcadPackagePath(path)).toBe(false);
  });
});
