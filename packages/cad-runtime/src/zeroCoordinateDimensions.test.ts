import { describe, expect, it } from "vitest";
import type { CadOp } from "@web-cad/cad-protocol";
import { exportCadProject } from "@web-cad/cad-core";
import { createCadSession } from "./index";

const batch = (ops: readonly CadOp[]) => ({
  version: "cadops.v1" as const,
  mode: "commit" as const,
  ops
});
function profile(kind: "circle" | "rectangle"): CadOp[] {
  const point = {
    entityId: `${kind}_origin`,
    entityKind: "point" as const,
    role: "position" as const
  };
  const coordinate = (
    measurement: "horizontal" | "vertical",
    drive: boolean
  ): CadOp => ({
    op: "sketch.dimension.create",
    id: `${kind}_${measurement}`,
    name: measurement,
    sketchId: kind,
    target: {
      kind: "pointPair",
      primary: point,
      secondary: {
        entityId: `${kind}_outline`,
        entityKind: kind,
        role: "center"
      },
      measurement,
      direction: kind === "circle" ? "positive" : "negative"
    },
    ...(drive ? { parameterId: "position" } : { value: 0 })
  });
  return [
    { op: "sketch.create", id: kind, name: kind, plane: "XY" },
    {
      op: "sketch.addPoint",
      sketchId: kind,
      id: `${kind}_origin`,
      point: [0, 0],
      construction: true
    },
    {
      op: "sketch.constraint.create",
      id: `${kind}_fixed`,
      name: "Origin",
      sketchId: kind,
      kind: "fixed",
      target: point,
      coordinate: [0, 0]
    },
    kind === "circle"
      ? {
          op: "sketch.addCircle",
          sketchId: kind,
          id: `${kind}_outline`,
          center: [0, 0],
          radius: 2
        }
      : {
          op: "sketch.addRectangle",
          sketchId: kind,
          id: `${kind}_outline`,
          center: [0, 0],
          width: 4,
          height: 6
        },
    coordinate("horizontal", kind === "circle"),
    coordinate("vertical", kind === "rectangle"),
    ...(kind === "circle"
      ? [
          {
            op: "sketch.dimension.create",
            id: "radius",
            name: "Radius",
            sketchId: kind,
            target: {
              kind: "entityScalar",
              entityId: `${kind}_outline`,
              entityKind: "circle",
              role: "radius"
            },
            value: 2
          } as CadOp
        ]
      : ["width", "height"].map(
          (role): CadOp => ({
            op: "sketch.dimension.create",
            id: role,
            name: role,
            sketchId: kind,
            target: {
              kind: "entityScalar",
              entityId: `${kind}_outline`,
              entityKind: "rectangle",
              role: role as "width" | "height"
            },
            value: role === "width" ? 4 : 6
          })
        )),
    {
      op: "feature.extrude",
      id: `${kind}_feature`,
      bodyId: `${kind}_body`,
      sketchId: kind,
      entityId: `${kind}_outline`,
      depth: 2
    }
  ];
}

describe("zero coordinate dimensions with exact solids", () => {
  it("drives fully defined circle/rectangle centers 0→5→0, with exact mass, Undo/Redo and reopen", async () => {
    const session = createCadSession();
    const check = async (position: number) => {
      for (const kind of ["circle", "rectangle"] as const) {
        const result = await session.query({
          requestId: kind,
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: { query: "body.massProperties", bodyId: `${kind}_body` }
          }
        });
        expect(result).toMatchObject({
          ok: true,
          massProperties: { measurementSource: "kernel-derived" }
        });
        if (
          !result.ok ||
          result.query !== "body.massProperties" ||
          !result.massProperties
        )
          throw new Error("Missing exact solid");
        expect(result.massProperties.volume).toBeCloseTo(
          kind === "circle" ? 8 * Math.PI : 48,
          6
        );
        const expected =
          kind === "circle" ? [position, 0, 1] : [0, -position, 1];
        result.massProperties.centerOfMass.forEach((value, index) =>
          expect(value).toBeCloseTo(expected[index]!, 6)
        );
        const status = session.engine.executeQuery({
          version: "cadops.v1",
          query: { query: "sketch.solverStatus", sketchId: kind }
        });
        expect(status).toMatchObject({ ok: true, status: "fully-defined" });
      }
    };
    try {
      expect(
        await session.executeBatch(
          batch([
            {
              op: "parameter.create",
              id: "position",
              name: "Position",
              value: 0
            },
            ...profile("circle"),
            ...profile("rectangle")
          ])
        )
      ).toMatchObject({ ok: true });
      await check(0);
      expect(
        await session.executeBatch(
          batch([{ op: "parameter.update", id: "position", value: 5 }])
        )
      ).toMatchObject({ ok: true });
      await check(5);
      expect(
        await session.executeBatch(
          batch([{ op: "parameter.update", id: "position", value: 0 }])
        )
      ).toMatchObject({ ok: true });
      await check(0);
      session.engine.undo();
      await check(5);
      session.engine.redo();
      await check(0);
      const source = session.getSessionInfo().sourceIdentity;
      expect(
        await session.executeBatch(
          batch([{ op: "parameter.update", id: "position", value: -1 }])
        )
      ).toMatchObject({ ok: false });
      expect(session.getSessionInfo().sourceIdentity).toEqual(source);
      await check(0);
      const reopened = createCadSession({
        project: exportCadProject(session.engine)
      });
      try {
        expect(
          await reopened.executeBatch(
            batch([{ op: "parameter.update", id: "position", value: 3 }])
          )
        ).toMatchObject({ ok: true });
        expect(
          reopened.engine
            .getDocument()
            .sketches.get("rectangle")
            ?.entities.get("rectangle_outline")
        ).toMatchObject({
          center: [expect.closeTo(0, 6), expect.closeTo(-3, 6)]
        });
      } finally {
        await reopened.dispose();
      }
    } finally {
      await session.dispose();
    }
  });
});
