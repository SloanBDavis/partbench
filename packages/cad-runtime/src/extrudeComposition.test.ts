import { describe, expect, it } from "vitest";
import type { CadOp, SketchProfileRefV22 } from "@web-cad/cad-protocol";
import { createCadSession } from "./index";

const batch = (
  ops: readonly CadOp[],
  mode: "commit" | "dryRun" = "commit"
) => ({ version: "cadops.v1" as const, mode, ops });

function squareSource(kind: "rectangle" | "circle" | "wire" | "regions"): {
  ops: CadOp[];
  profile: SketchProfileRefV22;
  area: number;
} {
  const sketchId = "outline";
  const ops: CadOp[] = [
    { op: "sketch.create", id: sketchId, name: "Outline", plane: "XY" }
  ];
  if (kind === "wire") {
    const points = [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10]
    ] as const;
    ops.push(
      ...points.map(
        (start, index): CadOp => ({
          op: "sketch.addLine",
          sketchId,
          id: `edge_${index}`,
          start,
          end: points[(index + 1) % points.length]!
        })
      )
    );
    return {
      ops,
      area: 400,
      profile: {
        kind: "wire",
        sketchId,
        segments: points.map((_, index) => ({
          entityId: `edge_${index}`,
          orientation: "forward"
        }))
      }
    };
  }
  if (kind === "circle") {
    ops.push({
      op: "sketch.addCircle",
      sketchId,
      id: "outer",
      center: [0, 0],
      radius: 10
    });
    return {
      ops,
      area: 100 * Math.PI,
      profile: { kind: "entity", sketchId, entityId: "outer" }
    };
  }
  ops.push({
    op: "sketch.addRectangle",
    sketchId,
    id: "outer",
    center: [0, 0],
    width: 20,
    height: 20
  });
  if (kind === "regions") {
    ops.push({
      op: "sketch.addCircle",
      sketchId,
      id: "existing_bore",
      center: [-6, 0],
      radius: 1
    });
    return {
      ops,
      area: 400 - Math.PI,
      profile: {
        kind: "regions",
        sketchId,
        regions: [
          {
            outer: { kind: "entity", entityId: "outer" },
            holes: [{ kind: "entity", entityId: "existing_bore" }]
          }
        ]
      }
    };
  }
  return {
    ops,
    area: 400,
    profile: { kind: "entity", sketchId, entityId: "outer" }
  };
}

async function volume(
  session: ReturnType<typeof createCadSession>,
  bodyId: string
) {
  const response = await session.query({
    requestId: "measure",
    adapterVersion: "web-cad.agent-adapter.v1",
    query: {
      version: "cadops.v1",
      query: { query: "body.massProperties", bodyId }
    }
  });
  expect(response).toMatchObject({
    ok: true,
    query: "body.massProperties",
    massProperties: { measurementSource: "kernel-derived" }
  });
  if (
    !response.ok ||
    response.query !== "body.massProperties" ||
    !response.massProperties
  )
    throw new Error("Exact mass properties unavailable");
  return response.massProperties.volume;
}

describe("source-independent exact extrude composition", () => {
  it.each(["rectangle", "circle", "wire", "regions"] as const)(
    "cuts and adds to %s sources, reopens and fails atomically",
    async (kind) => {
      const session = createCadSession();
      const reopened = createCadSession();
      try {
        const source = squareSource(kind);
        expect(
          await session.executeBatch(
            batch([
              ...source.ops,
              {
                op: "feature.extrude",
                id: "blank",
                bodyId: "blank_body",
                profile: source.profile,
                depth: 10
              },
              { op: "sketch.create", id: "tools", name: "Tools", plane: "XY" },
              {
                op: "sketch.addCircle",
                sketchId: "tools",
                id: "bore",
                center: [0, 0],
                radius: 3
              },
              {
                op: "sketch.addRectangle",
                sketchId: "tools",
                id: "boss",
                center: [7, 0],
                width: 4,
                height: 4
              },
              {
                op: "sketch.addRectangle",
                sketchId: "tools",
                id: "disjoint",
                center: [100, 0],
                width: 4,
                height: 4
              },
              {
                op: "sketch.addCircle",
                sketchId: "tools",
                id: "oversize",
                center: [0, 0],
                radius: 50
              },
              {
                op: "feature.extrude",
                id: "bore_cut",
                bodyId: "cut_body",
                sketchId: "tools",
                entityId: "bore",
                depth: 10,
                operationMode: "cut",
                targetBodyId: "blank_body"
              },
              {
                op: "feature.extrude",
                id: "boss_add",
                bodyId: "finished",
                sketchId: "tools",
                entityId: "boss",
                depth: 4,
                side: "negative",
                operationMode: "add",
                targetBodyId: "cut_body"
              }
            ])
          )
        ).toMatchObject({ ok: true });
        const expected = (source.area - 9 * Math.PI) * 10 + 64;
        expect(await volume(session, "finished")).toBeCloseTo(expected, 6);
        const saved = await session.exportWcad();
        await reopened.openWcad(saved);
        expect(await volume(reopened, "finished")).toBeCloseTo(expected, 6);
        expect(reopened.engine.exportProject()).toEqual(
          session.engine.exportProject()
        );
        const before = session.engine.exportProject();
        for (const mode of ["dryRun", "commit"] as const) {
          for (const [entityId, operationMode] of [
            ["oversize", "cut"],
            ["disjoint", "add"]
          ] as const) {
            expect(
              await session.executeBatch(
                batch(
                  [
                    {
                      op: "feature.extrude",
                      id: "invalid",
                      bodyId: "invalid_body",
                      sketchId: "tools",
                      entityId,
                      depth: 100,
                      side: "symmetric",
                      operationMode,
                      targetBodyId: "finished"
                    }
                  ],
                  mode
                )
              )
            ).toMatchObject({ ok: false });
            expect(session.engine.exportProject()).toEqual(before);
          }
        }
        expect(await volume(session, "finished")).toBeCloseTo(expected, 6);
      } finally {
        session.dispose();
        reopened.dispose();
      }
    },
    30_000
  );
});
