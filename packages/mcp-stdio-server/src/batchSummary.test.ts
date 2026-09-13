import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHeadlessAgentHost } from "./headless.ts";

describe("headless compact gear revision", () => {
  it("returns less than 15 KB with true change counts while executing real exact gear revisions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "partbench-summary-"));
    const host = await createHeadlessAgentHost({ workspace: directory });
    const call = (name: string, args: unknown = {}, requestId?: string) =>
      host.server.callToolAsync({
        name,
        arguments: args,
        ...(requestId ? { requestId } : {})
      });
    const batch = (ops: unknown[], mode = "commit") => ({
      version: "cadops.v1",
      mode,
      ops
    });
    const volume = async () => {
      const r = (
        await call("cad.body_mass_properties", { bodyId: "gear_body" })
      ).structuredContent;
      expect(r).toMatchObject({
        ok: true,
        massProperties: { measurementSource: "kernel-derived" }
      });
      if (
        !("query" in r) ||
        r.query !== "body.massProperties" ||
        !("massProperties" in r) ||
        !r.massProperties
      )
        throw new Error("Missing exact mass");
      return r.massProperties.volume;
    };
    try {
      expect(
        await call("cad.batch", {
          allowCommit: true,
          responseDetail: "summary",
          batch: batch([
            { op: "parameter.create", id: "teeth", name: "teeth", value: 40 },
            {
              op: "feature.spurGear",
              id: "gear",
              bodyId: "gear_body",
              sketchId: "gear_profile",
              teeth: { parameterId: "teeth" },
              module: 1.5,
              faceWidth: 10,
              boreDiameter: 8.1
            }
          ])
        })
      ).toMatchObject({
        isError: false,
        structuredContent: { responseDetail: "summary" }
      });
      const initialVolume = await volume();
      const ops = [{ op: "parameter.update", id: "teeth", value: 60 }];
      const full = await call("cad.batch", { batch: batch(ops, "dryRun") });
      expect(full.isError).toBe(false);
      expect(full.structuredContent).toHaveProperty("semanticDiff");
      const summary = await call("cad.batch", {
        allowCommit: true,
        responseDetail: "summary",
        batch: batch(ops)
      });
      expect(summary).toMatchObject({
        isError: false,
        structuredContent: {
          ok: true,
          responseDetail: "summary",
          transactionId: expect.any(String),
          mode: "commit",
          idChanges: {
            modifiedFeatureIds: { total: 1, ids: ["gear"], truncated: false },
            modifiedBodyIds: { total: 1, ids: ["gear_body"], truncated: false },
            modifiedParameterIds: { total: 1, ids: ["teeth"], truncated: false }
          }
        }
      });
      expect(Buffer.byteLength(JSON.stringify(summary))).toBeLessThan(15_000);
      expect(Buffer.byteLength(JSON.stringify(full))).toBeGreaterThan(
        Buffer.byteLength(JSON.stringify(summary)) * 5
      );
      if (
        !("semanticDiff" in full.structuredContent) ||
        !("diffCounts" in summary.structuredContent) ||
        !("idChanges" in summary.structuredContent)
      )
        throw new Error("Missing full/summary evidence");
      expect(summary.structuredContent.diffCounts.sketches).toMatchObject({
        entityChanges:
          full.structuredContent.semanticDiff.sketches?.entityChanges?.length
      });
      expect(
        summary.structuredContent.idChanges.createdSketchEntityIds?.ids
          .length ?? 0
      ).toBeLessThanOrEqual(8);
      expect(summary.structuredContent).not.toHaveProperty("semanticDiff");
      expect(await volume()).toBeGreaterThan(initialVolume * 2);
      const before = (await call("cad.session_info")).structuredContent;
      const badBatch = batch([
        { op: "parameter.update", id: "teeth", value: 1 }
      ]);
      const rejected = await call(
        "cad.batch",
        { allowCommit: true, responseDetail: "summary", batch: badBatch },
        "reject"
      );
      expect(rejected).toMatchObject({
        isError: true,
        structuredContent: {
          ok: false,
          error: expect.any(Object),
          errors: expect.any(Array)
        }
      });
      expect(
        await call(
          "cad.batch",
          { allowCommit: true, batch: badBatch },
          "reject"
        )
      ).toEqual(rejected);
      const after = (await call("cad.session_info")).structuredContent;
      if (!("result" in before) || !("result" in after))
        throw new Error("Missing session identity");
      expect(after.result.sourceIdentity).toEqual(before.result.sourceIdentity);
    } finally {
      await host.close();
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
