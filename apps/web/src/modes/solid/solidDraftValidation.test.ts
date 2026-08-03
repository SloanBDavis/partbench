import { describe, expect, it } from "vitest";

import { validateSolidDraft } from "./solidDraftValidation";

describe("solid draft validation", () => {
  it.each(["linearPattern", "circularPattern"] as const)(
    "blocks over-limit %s drafts",
    (kind) => {
      const common = {
        id: "",
        bodyId: "",
        seedBodyId: "body_seed",
        name: "",
        instanceCount: 4_097
      };
      const draft =
        kind === "linearPattern"
          ? {
              ...common,
              direction: { kind: "globalAxis" as const, axis: "x" as const },
              spacing: 1
            }
          : {
              ...common,
              rotationAxis: {
                kind: "globalAxis" as const,
                axis: "z" as const
              },
              totalAngleDegrees: 360
            };

      expect(validateSolidDraft(kind, draft)).toMatchObject({
        status: "blocked",
        message: expect.stringContaining("4096")
      });
    }
  );
});
