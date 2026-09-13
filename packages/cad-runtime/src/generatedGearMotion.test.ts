import { describe, expect, it } from "vitest";
import { CadEngine } from "@web-cad/cad-core";
import { createCadSession } from "./index";
import type { CadOp } from "@web-cad/cad-protocol";

function signature(engine: CadEngine): string {
  const result = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "gear_body" }
  });
  if (!result.ok || result.query !== "body.topology")
    throw new Error("Expected gear topology source.");
  return result.topology.sourceIdentity.signature;
}
const batch = (ops: readonly CadOp[]) => ({
  version: "cadops.v1" as const,
  mode: "commit" as const,
  ops
});
describe("generated gear exact motion stability", () => {
  it("keeps live, forked and native reopened source identities equal without rebuilding unchanged gears", async () => {
    const session = createCadSession(),
      reopened = createCadSession();
    try {
      expect(
        await session.executeBatch(
          batch([
            { op: "parameter.create", id: "angle", name: "angle", value: 0 },
            {
              op: "feature.spurGear",
              id: "gear",
              bodyId: "gear_body",
              sketchId: "gear_profile",
              teeth: 20,
              module: 1.5,
              faceWidth: 6,
              boreDiameter: 8
            }
          ])
        )
      ).toMatchObject({ ok: true });
      const initial = signature(session.engine);
      expect(signature(session.engine.forkForValidation())).toBe(initial);
      const before = session.getSessionInfo().geometry.artifactBuilds;
      // The first unchanged edit exposed the bug; the full sweep is in the closer.
      for (const angle of [0, 90]) {
        expect(
          await session.executeBatch(
            batch([{ op: "parameter.update", id: "angle", value: angle }])
          )
        ).toMatchObject({ ok: true });
        expect(signature(session.engine)).toBe(initial);
        expect(signature(session.engine.forkForValidation())).toBe(initial);
      }
      expect(session.getSessionInfo().geometry.artifactBuilds).toBe(before);
      await reopened.openWcad(await session.exportWcad());
      expect(signature(reopened.engine)).toBe(initial);
      expect(
        await session.executeBatch(
          batch([{ op: "feature.updateSpurGear", id: "gear", teeth: 21 }])
        )
      ).toMatchObject({ ok: true });
      const revised = signature(session.engine);
      expect(revised).not.toBe(initial);
      expect(signature(session.engine.forkForValidation())).toBe(revised);
      const afterRevision = session.getSessionInfo().geometry.artifactBuilds;
      expect(afterRevision).toBeGreaterThan(before);
      expect(
        await session.executeBatch(
          batch([{ op: "parameter.update", id: "angle", value: 90 }])
        )
      ).toMatchObject({ ok: true });
      expect(session.getSessionInfo().geometry.artifactBuilds).toBe(
        afterRevision
      );
    } finally {
      session.dispose();
      reopened.dispose();
    }
  }, 30_000);
});
