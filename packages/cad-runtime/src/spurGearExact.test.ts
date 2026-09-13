import { expect, it } from "vitest";
import { createCadSession } from "./index";
import type { CadOp } from "@web-cad/cad-protocol";

const batch = (ops: readonly CadOp[]) => ({
  version: "cadops.v1" as const,
  mode: "commit" as const,
  ops
});
async function expectExactGear(
  session: ReturnType<typeof createCadSession>,
  teeth: number
) {
  const sketch = session.engine.getDocument().sketches.get("gear_source")!;
  expect(sketch.spurGear?.values.teeth).toBe(teeth);
  expect(sketch.entities.size).toBeLessThan(800);
  let area = 0;
  for (const entity of sketch.entities.values()) {
    if (entity.kind === "circle") area -= Math.PI * entity.radius ** 2;
    else if (entity.kind === "line")
      area +=
        (entity.start[0] * entity.end[1] - entity.start[1] * entity.end[0]) / 2;
    else if (entity.kind === "arc") {
      const start = (entity.startAngleDegrees * Math.PI) / 180,
        sweep = (entity.sweepAngleDegrees * Math.PI) / 180,
        end = start + sweep;
      area +=
        (entity.radius * entity.center[0] * (Math.sin(end) - Math.sin(start)) -
          entity.radius * entity.center[1] * (Math.cos(end) - Math.cos(start)) +
          entity.radius ** 2 * sweep) /
        2;
    }
  }
  const mass = await session.query({
    requestId: "mass",
    adapterVersion: "web-cad.agent-adapter.v1",
    query: {
      version: "cadops.v1",
      query: { query: "body.massProperties", bodyId: "gear" }
    }
  });
  expect(mass).toMatchObject({
    ok: true,
    massProperties: { measurementSource: "kernel-derived" }
  });
  if (!mass.ok || mass.query !== "body.massProperties" || !mass.massProperties)
    throw new Error("Exact gear mass unavailable");
  expect(mass.massProperties.volume).toBeCloseTo(area * 10, 5);
  expect(
    (await session.getCurrentExactEvidence()).derivedExactMetadata[0]
  ).toMatchObject({
    status: "ready",
    metadata: { topologyCounts: { solidCount: 1 } }
  });
}

it("builds compact exact arc gears, regenerates 60 teeth and reopens canonical source", async () => {
  const session = createCadSession(),
    reopened = createCadSession();
  try {
    expect(
      await session.executeBatch(
        batch([
          { op: "parameter.create", id: "teeth", name: "Teeth", value: 20 },
          {
            op: "feature.spurGear",
            id: "gear_feature",
            bodyId: "gear",
            sketchId: "gear_source",
            teeth: { parameterId: "teeth" },
            module: 1.5,
            faceWidth: 10,
            boreDiameter: 8.1,
            backlash: 0.08
          }
        ])
      )
    ).toMatchObject({ ok: true });
    await expectExactGear(session, 20);
    expect(
      await session.executeBatch(
        batch([{ op: "parameter.update", id: "teeth", value: 60 }])
      )
    ).toMatchObject({ ok: true });
    await expectExactGear(session, 60);
    const saved = await session.exportWcad();
    await reopened.openWcad(saved);
    await expectExactGear(reopened, 60);
    // A second topology-changing revision after reopening previously expanded
    // reference-effect history until source identity encoding crashed.
    expect(
      await reopened.executeBatch(
        batch([{ op: "parameter.update", id: "teeth", value: 40 }])
      )
    ).toMatchObject({ ok: true });
    await expectExactGear(reopened, 40);
    expect((await reopened.exportWcad()).byteLength).toBeLessThan(3_000_000);
  } finally {
    session.dispose();
    reopened.dispose();
  }
}, 45_000);
