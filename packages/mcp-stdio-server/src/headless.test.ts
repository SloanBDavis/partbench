import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHeadlessAgentHost } from "./headless.ts";
import { createCadSession } from "@web-cad/cad-runtime";

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

  it("imports, edits, and round-trips sketch files through real host tools with atomic dry-run and failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "partbench-exchange-host-"));
    const session = createCadSession();
    const host = await createHeadlessAgentHost({
      workspace: directory,
      session
    });
    const call = (name: string, arguments_: unknown = {}) =>
      host.server.callToolAsync({ name, arguments: arguments_ });
    try {
      await writeFile(
        join(directory, "ring.svg"),
        '<svg width="20mm" height="20mm" viewBox="-10 -10 20 20"><circle r="10"/><circle r="3"/></svg>'
      );
      const before = session.engine.exportProject();
      expect(
        await call("cad.project_import_file", {
          path: "ring.svg",
          dryRun: true
        })
      ).toMatchObject({
        isError: false,
        structuredContent: { result: { format: "svg" } }
      });
      expect(session.engine.exportProject()).toEqual(before);
      expect(
        await call("cad.project_import_file", { path: "ring.svg" })
      ).toMatchObject({
        isError: false,
        structuredContent: {
          result: { format: "svg", createdSketchIds: expect.any(Array) }
        }
      });
      const sketch = session.engine.createSnapshot().sketches[0]!;
      expect(sketch.entities).toHaveLength(2);
      expect(
        await call("cad.batch", {
          allowCommit: true,
          responseDetail: "summary",
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.updateEntity",
                sketchId: sketch.id,
                entity: {
                  id: sketch.entities[1]!.id,
                  kind: "circle",
                  center: [0, 0],
                  radius: 4,
                  construction: false
                }
              }
            ]
          }
        })
      ).toMatchObject({ isError: false });
      expect(
        await call("cad.project_export_file", {
          path: "edited.dxf",
          format: "dxf",
          sketchIds: [sketch.id]
        })
      ).toMatchObject({
        isError: false,
        structuredContent: {
          result: { format: "dxf", curveCount: 2, notices: expect.any(Array) }
        }
      });
      expect(
        await call("cad.project_import_file", { path: "edited.dxf" })
      ).toMatchObject({ isError: false });
      const reopened = session.engine.createSnapshot().sketches[1]!;
      expect(
        reopened.entities.map((entity) =>
          entity.kind === "circle" ? entity.radius : null
        )
      ).toEqual([10, 4]);
      const stable = session.engine.exportProject();
      await writeFile(
        join(directory, "broken.svg"),
        '<svg><circle r="2"/><image href="hidden.png"/></svg>'
      );
      expect(
        await call("cad.project_import_file", { path: "broken.svg" })
      ).toMatchObject({ isError: true });
      expect(
        await call("cad.project_import_file", { path: "../escape.step" })
      ).toMatchObject({
        isError: true,
        structuredContent: { error: { code: "PATH_OUTSIDE_WORKSPACE" } }
      });
      expect(session.engine.exportProject()).toEqual(stable);
      expect(
        await call("cad.project_export_file", {
          path: "edited.dxf",
          format: "dxf",
          sketchIds: [sketch.id]
        })
      ).toMatchObject({
        isError: true,
        structuredContent: { error: { code: "FILE_EXISTS" } }
      });
      expect(await call("cad.session_info")).toMatchObject({
        structuredContent: {
          result: {
            fileTools: expect.arrayContaining(["cad.project_import_file"]),
            fileFormats: { import: { formats: ["step", "dxf", "svg"] } }
          }
        }
      });
    } finally {
      await host.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
