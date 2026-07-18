import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  runV17ReleaseSamples,
  runV17StorageMigrationWorkflow
} from "./v17-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("V17 release sample smoke", () => {
  it("runs deterministic command/query/round-trip samples", async () => {
    const first = await runV17ReleaseSamples(cadCore);
    const second = await runV17ReleaseSamples(cadCore);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      sampleCount: 3,
      passedCount: 3,
      failedCount: 0,
      checkCount: 12
    });
    expect(first.samples.map((sample) => sample.id)).toEqual([
      "two-arc-profile",
      "composite-features",
      "curved-sweep"
    ]);
  });

  it("proves deterministic V20/V21 JSON and WCAD migration", async () => {
    await expect(
      runV17StorageMigrationWorkflow(cadCore)
    ).resolves.toMatchObject({
      ok: true,
      versions: [
        cadCore.CAD_PROJECT_FORMAT_VERSION_V20,
        cadCore.CAD_PROJECT_FORMAT_VERSION_V21
      ]
    });
  });

  it("returns a failing command exit code for an unknown workflow", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/smoke-v17-release-samples.mjs",
        "--workflow=not-a-v17-workflow"
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    expect(result.status).toBe(1);
  });
});
