import { describe, expect, it, vi } from "vitest";
import { createCadMcpServer, type CadMcpProjectFilesPort } from "./index";

describe("host project tools", () => {
  it("makes an occurrence independent through the host and validates the explicit path", async () => {
    const makeOccurrenceIndependent = vi.fn(async () => ({
      ok: true as const,
      result: {
        ok: true,
        bodyId: "copy",
        featureId: "copy_base",
        rootAssemblyId: "root",
        instancePath: ["left_copy", "bolt_copy"]
      }
    }));
    const server = createCadMcpServer({
      projectFiles: { makeOccurrenceIndependent }
    });
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.assembly_make_independent"
    );
    for (const arguments_ of [
      {},
      { rootAssemblyId: "root", instancePath: [] },
      { rootAssemblyId: "root", instancePath: [""] },
      { rootAssemblyId: "root", instancePath: "left/bolt" },
      { rootAssemblyId: " ", instancePath: ["bolt"] },
      { rootAssemblyId: "root", instancePath: ["bolt"], path: "file.step" }
    ]) {
      expect(
        await server.callToolAsync({
          name: "cad.assembly_make_independent",
          arguments: arguments_
        })
      ).toMatchObject({
        isError: true,
        structuredContent: { error: { code: "INVALID_ARGUMENTS" } }
      });
    }
    expect(makeOccurrenceIndependent).not.toHaveBeenCalled();
    expect(
      await server.callToolAsync({
        name: "cad.assembly_make_independent",
        arguments: { rootAssemblyId: "root", instancePath: ["left", "bolt"] }
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        result: { bodyId: "copy", instancePath: ["left_copy", "bolt_copy"] }
      }
    });
    expect(makeOccurrenceIndependent).toHaveBeenCalledWith({
      rootAssemblyId: "root",
      instancePath: ["left", "bolt"]
    });
  });

  it("advertises only supplied host capabilities and directs headless export to files", async () => {
    const port: CadMcpProjectFilesPort = {
      sessionInfo: async () => ({ ok: true, result: { mode: "headless" } }),
      exportProjectFile: async (request) => ({
        ok: true,
        result: { path: request.path }
      })
    };
    const server = createCadMcpServer({ projectFiles: port });
    const names = server.listTools().tools.map((tool) => tool.name);
    expect(names).toContain("cad.session_info");
    expect(names).toContain("cad.project_export_file");
    expect(names).not.toContain("cad.project_open");
    expect(names).not.toContain("cad.project_request_exact_export");
    expect(
      createCadMcpServer()
        .listTools()
        .tools.map((tool) => tool.name)
    ).not.toContain("cad.session_info");
    expect(
      await server.callToolAsync({ name: "cad.session_info" })
    ).toMatchObject({
      isError: false,
      structuredContent: { ok: true, result: { mode: "headless" } }
    });
    expect(
      await server.callToolAsync({
        name: "cad.project_open",
        arguments: { path: "a.wcad" }
      })
    ).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "UNKNOWN_TOOL" } }
    });
  });

  it("rejects malformed file calls before invoking the host and preserves actionable failures", async () => {
    const exportProjectFile = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: "FILE_EXISTS",
        message: "Choose a new path or set overwrite: true."
      }
    }));
    const server = createCadMcpServer({ projectFiles: { exportProjectFile } });
    for (const args of [
      [],
      { path: "a.step", format: "stl" },
      { path: "a.step", format: "step", bodyIds: [] },
      { path: "a.step", format: "step", bodyIds: ["a", "a"] },
      { path: "a.step", format: "step", bodyIds: [" "] },
      { path: "a.step", format: "step", bodyIds: ["a"], assemblyIds: ["b"] },
      { path: "a.step", format: "step", sketchIds: ["s"] },
      { path: "a.dxf", format: "dxf", assemblyIds: ["a"] },
      { path: "a.svg", format: "svg", bodyIds: ["a"] },
      { path: "a.svg", format: ["svg"] },
      { path: "a.step", format: "step", overwrite: "yes" },
      { path: "a.step", format: "step", extra: true }
    ]) {
      expect(
        await server.callToolAsync({
          name: "cad.project_export_file",
          arguments: args
        })
      ).toMatchObject({
        isError: true,
        structuredContent: { error: { code: "INVALID_ARGUMENTS" } }
      });
    }
    expect(exportProjectFile).not.toHaveBeenCalled();
    expect(
      await server.callToolAsync({
        name: "cad.project_export_file",
        arguments: { path: "a.step", format: "step", bodyIds: ["body_1"] }
      })
    ).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "FILE_EXISTS" } }
    });
    expect(exportProjectFile).toHaveBeenCalledWith({
      path: "a.step",
      format: "step",
      bodyIds: ["body_1"]
    });
  });

  it("discovers editable import and validates sketch scale and export selectors before host calls", async () => {
    const importProjectFile = vi.fn(async () => ({
      ok: true as const,
      result: { createdSketchIds: ["s"] }
    }));
    const exportProjectFile = vi.fn(async () => ({
      ok: true as const,
      result: { byteLength: 100 }
    }));
    const server = createCadMcpServer({
      projectFiles: { importProjectFile, exportProjectFile }
    });
    expect(
      server
        .listTools()
        .tools.find((tool) => tool.name === "cad.project_import_file")
        ?.inputSchema
    ).toMatchObject({ required: ["path"] });
    for (const arguments_ of [
      { path: "a.dxf", dryRun: "yes" },
      { path: "a.dxf", format: "stl" },
      { path: "a.dxf", overwrite: true },
      { path: "a.dxf", scale: 0 },
      { path: "a.dxf", scale: Infinity },
      { path: "a.dxf", scale: "2" },
      { path: "a.dxf", unit: ["mm"] },
      { path: "a.dxf", format: ["dxf"] },
      { path: "a.step", unit: "mm" },
      { path: "a.stp", scale: 1 },
      { path: "a.step", format: "step", unit: "in" }
    ]) {
      expect(
        await server.callToolAsync({
          name: "cad.project_import_file",
          arguments: arguments_
        })
      ).toMatchObject({
        isError: true,
        structuredContent: { error: { code: "INVALID_ARGUMENTS" } }
      });
    }
    expect(importProjectFile).not.toHaveBeenCalled();
    const importRequest = { path: "a.dxf", unit: "in", scale: 2, dryRun: true };
    expect(
      await server.callToolAsync({
        name: "cad.project_import_file",
        arguments: importRequest
      })
    ).toMatchObject({ isError: false });
    expect(importProjectFile).toHaveBeenCalledWith(importRequest);
    for (const request of [
      { path: "assembly.step", format: "step", assemblyIds: ["assembly"] },
      { path: "outline.dxf", format: "dxf", sketchIds: ["outline"] },
      { path: "outline.svg", format: "svg", sketchIds: ["outline"] }
    ]) {
      expect(
        await server.callToolAsync({
          name: "cad.project_export_file",
          arguments: request
        })
      ).toMatchObject({ isError: false });
      expect(exportProjectFile).toHaveBeenLastCalledWith(request);
    }
  });
});
