import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { CadOp } from "@web-cad/cad-protocol";
import { CadEngine } from "./engine";

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../../../examples/agent-runtime/mounting-plate.json",
      import.meta.url
    ),
    "utf8"
  )
) as { readonly create: readonly CadOp[]; readonly revise: readonly CadOp[] };

it("reports a patterned hole on a finished target as source-healthy through revision and reopen", () => {
  const engine = new CadEngine();
  const check = (current: CadEngine, radius: number) => {
    const source = current.exportProject();
    const response = current.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(response).toMatchObject({
      ok: true,
      status: "under-defined",
      authoredHoles: [
        { featureId: "mounting_hole", status: "healthy", issues: [] }
      ],
      sketchDimensions: [
        {
          dimensionId: "hole_dimension",
          effectiveValue: radius,
          status: "healthy",
          issues: []
        }
      ]
    });
    const summary = current.executeQuery({
      version: "cadops.v1",
      query: { query: "project.summary" }
    });
    expect(summary).toMatchObject({
      ok: true,
      health: { status: "under-defined" }
    });
    expect(current.exportProject()).toEqual(source);
  };
  expect(
    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: fixture.create
    }).ok
  ).toBe(true);
  check(engine, 2);
  expect(
    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: fixture.revise
    }).ok
  ).toBe(true);
  check(engine, 2.5);
  check(CadEngine.fromProject(engine.exportProject()), 2.5);
});
