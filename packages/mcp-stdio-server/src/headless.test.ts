import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHeadlessAgentHost } from "./headless.ts";

describe("headless MCP host", () => {
  it("serializes pipelined CADOps and native files, and preserves the document on invalid open", async () => {
    const directory = await mkdtemp(join(tmpdir(), "partbench-host-"));
    const host = await createHeadlessAgentHost({ workspace: directory });
    const call = (name: string, args: unknown = {}) =>
      host.server.callToolAsync({ name, arguments: args });
    const createBox = (id: string) =>
      call("cad.batch", {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id,
              name: id,
              dimensions: { width: 2, height: 3, depth: 4 }
            }
          ]
        }
      });
    try {
      expect(await call("cad.session_info")).toMatchObject({
        isError: false,
        structuredContent: {
          result: {
            mode: "headless",
            fileAccess: "workspace-only",
            geometry: { artifactBuilds: 0 }
          }
        }
      });
      const results = await Promise.all([
        createBox("kept"),
        call("cad.project_save", { path: "part.wcad" }),
        createBox("discarded"),
        call("cad.project_open", { path: "part.wcad" }),
        call("cad.project_summary")
      ]);
      expect(results.every((result) => !result.isError)).toBe(true);
      expect(results[4]).toMatchObject({
        structuredContent: { objectCount: 1, objects: [{ id: "kept" }] }
      });
      expect(
        (await readFile(join(directory, "part.wcad"))).byteLength
      ).toBeGreaterThan(0);
      const before = await call("cad.session_info");
      await writeFile(join(directory, "broken.wcad"), "invalid native file");
      expect(
        await call("cad.project_open", { path: "broken.wcad" })
      ).toMatchObject({ isError: true, structuredContent: { ok: false } });
      expect(await call("cad.session_info")).toEqual(before);
      expect(
        await call("cad.project_save", { path: "part.wcad" })
      ).toMatchObject({
        isError: true,
        structuredContent: { error: { code: "FILE_EXISTS" } }
      });
    } finally {
      await host.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
