import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceFiles } from "./workspaceFiles.ts";
import { parseCliOptions } from "./cliOptions.ts";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "partbench-files-"));
  directories.push(directory);
  await mkdir(join(directory, "workspace"));
  return {
    directory,
    files: await WorkspaceFiles.create(join(directory, "workspace"))
  };
}

describe("headless workspace files", () => {
  it("confines reads and writes, including symlinks and similarly prefixed sibling directories", async () => {
    const { directory, files } = await fixture();
    const outside = join(directory, "outside.wcad");
    await writeFile(outside, "outside");
    await symlink(directory, join(files.root, "escape"));
    await symlink(outside, join(files.root, "linked.wcad"));
    for (const path of [
      "../outside.wcad",
      outside,
      "escape/outside.wcad",
      "linked.wcad"
    ]) {
      await expect(files.readNative(path)).rejects.toMatchObject({
        code: "PATH_OUTSIDE_WORKSPACE"
      });
      await expect(files.outputPath(path, "wcad", true)).rejects.toMatchObject({
        code: "PATH_OUTSIDE_WORKSPACE"
      });
    }
    await expect(
      files.outputPath("../workspace-sibling/new.step", "step")
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
    await expect(
      files.outputPath("escape/new.step", "step")
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
    expect(await readFile(outside, "utf8")).toBe("outside");
  });

  it("publishes complete bytes atomically and requires explicit overwrite", async () => {
    const { files } = await fixture();
    const path = await files.outputPath("part.wcad", "wcad");
    await files.write(path, new TextEncoder().encode("first"));
    await expect(files.outputPath("part.wcad", "wcad")).rejects.toMatchObject({
      code: "FILE_EXISTS"
    });
    await expect(
      files.write(path, new TextEncoder().encode("second"))
    ).rejects.toMatchObject({ code: "FILE_EXISTS" });
    expect(
      new TextDecoder().decode((await files.readNative("part.wcad")).bytes)
    ).toBe("first");
    await files.write(
      await files.outputPath("part.wcad", "wcad", true),
      new TextEncoder().encode("replacement"),
      true
    );
    expect(
      new TextDecoder().decode((await files.readNative("part.wcad")).bytes)
    ).toBe("replacement");
    expect(await readdir(files.root)).toEqual(["part.wcad"]);
    await expect(files.outputPath("part.stl", "step")).rejects.toMatchObject({
      code: "INVALID_FILE_EXTENSION"
    });
  });

  it("parses headless options without silently accepting a mistaken workspace", () => {
    expect(
      parseCliOptions(["--headless", "--workspace", "projects"], "/tmp")
    ).toEqual({ headless: true, workspace: "projects", help: false });
    expect(parseCliOptions(["--headless"], "/tmp").workspace).toBe("/tmp");
    expect(() => parseCliOptions(["--workspace", "projects"])).toThrow(
      "--headless"
    );
    expect(() => parseCliOptions(["--headless", "--workspace"])).toThrow(
      "directory path"
    );
    expect(() => parseCliOptions(["--headles"])).toThrow("Unknown option");
  });
});
