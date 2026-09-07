import { describe, expect, it, vi } from "vitest";
import { createCadMcpServer, type CadMcpProjectFilesPort } from "./index";

describe("host project tools", () => {
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
});
