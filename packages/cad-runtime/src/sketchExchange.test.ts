import { describe, expect, it } from "vitest";
import { CadEngine } from "@web-cad/cad-core";
import type { CadOp, SketchSnapshot } from "@web-cad/cad-protocol";
import { createCadSession } from "./index";
import {
  buildSketchExchangeOps,
  exportSketchExchange,
  parseSketchExchange,
  SketchExchangeError
} from "./sketchExchange";

const batch = (ops: readonly CadOp[]) => ({
  version: "cadops.v1" as const,
  mode: "commit" as const,
  ops
});
const dxf = (entities: (string | number)[], unit = 4) =>
  [
    0,
    "SECTION",
    2,
    "HEADER",
    9,
    "$INSUNITS",
    70,
    unit,
    0,
    "ENDSEC",
    0,
    "SECTION",
    2,
    "ENTITIES",
    ...entities,
    0,
    "ENDSEC",
    0,
    "EOF"
  ].join("\n");
const plate =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="20mm" viewBox="-20 -10 40 20"><g data-name="Mounting plate"><path d="M -20 -10 H 20 V 10 H -20 Z"/><circle cx="0" cy="0" r="3"/></g></svg>';

describe("shared editable sketch exchange", () => {
  it("round-trips a hole-bearing SVG/DXF profile through normal sketch operations and exact extrusion, then edits it", async () => {
    const session = createCadSession();
    try {
      const parsed = parseSketchExchange("svg", plate);
      expect(parsed.sketches).toHaveLength(1);
      expect(parsed.sketches[0]?.entities).toHaveLength(5);
      const imported = buildSketchExchangeOps(parsed, { idPrefix: "svg" });
      expect(await session.executeBatch(batch(imported))).toMatchObject({
        ok: true
      });
      for (const format of ["dxf", "svg"] as const) {
        const source = session.engine
          .createSnapshot()
          .sketches.filter((sketch) => sketch.id === "svg_sketch_1");
        const file = exportSketchExchange(format, source, { unit: "in" });
        expect(file.curveCount).toBe(5);
        const recipe = parseSketchExchange(format, file.text);
        const prefix = `reopened_${format}`;
        const sketchId = `${prefix}_sketch_1`;
        expect(
          await session.executeBatch(
            batch([
              ...buildSketchExchangeOps(recipe, { idPrefix: prefix }),
              {
                op: "feature.extrude",
                id: `${format}_extrude`,
                bodyId: `${format}_body`,
                depth: 5,
                profile: {
                  kind: "regions",
                  sketchId,
                  regions: [
                    {
                      outer: {
                        kind: "wire",
                        segments: [1, 2, 3, 4].map((n) => ({
                          entityId: `${sketchId}_curve_${n}`,
                          orientation: "forward" as const
                        }))
                      },
                      holes: [
                        { kind: "entity", entityId: `${sketchId}_curve_5` }
                      ]
                    }
                  ]
                }
              }
            ])
          )
        ).toMatchObject({ ok: true });
        const measure = async () => {
          const result = await session.query({
            requestId: "volume",
            adapterVersion: "web-cad.agent-adapter.v1",
            query: {
              version: "cadops.v1",
              query: { query: "body.massProperties", bodyId: `${format}_body` }
            }
          });
          if (
            !result.ok ||
            result.query !== "body.massProperties" ||
            !result.massProperties
          )
            throw new Error(JSON.stringify(result));
          return result.massProperties.volume;
        };
        expect(await measure()).toBeCloseTo((800 - 9 * Math.PI) * 5, 5);
        expect(
          await session.executeBatch(
            batch([
              {
                op: "sketch.updateEntity",
                sketchId,
                entity: {
                  id: `${sketchId}_curve_5`,
                  kind: "circle",
                  center: [0, 0],
                  radius: 4,
                  construction: false
                }
              }
            ])
          )
        ).toMatchObject({ ok: true });
        expect(await measure()).toBeCloseTo((800 - 16 * Math.PI) * 5, 5);
      }
    } finally {
      await session.dispose();
    }
  }, 20_000);

  it("keeps bulged DXF polylines analytic, handles units once, and preserves independent layers", () => {
    const input = dxf(
      [
        0,
        "LWPOLYLINE",
        8,
        "Ring",
        90,
        2,
        70,
        1,
        10,
        1,
        20,
        0,
        42,
        1,
        10,
        -1,
        20,
        0,
        42,
        1,
        0,
        "LINE",
        8,
        "Axis",
        10,
        0,
        20,
        0,
        11,
        2,
        21,
        0
      ],
      1
    );
    const recipe = parseSketchExchange("dxf", input);
    expect(recipe.sketches.map((sketch) => sketch.name)).toEqual([
      "Ring",
      "Axis"
    ]);
    expect(recipe.sketches[0]!.entities).toEqual([
      {
        kind: "arc",
        center: [0, 0],
        radius: 25.4,
        startAngleDegrees: 0,
        sweepAngleDegrees: 180
      },
      {
        kind: "arc",
        center: [0, 0],
        radius: 25.4,
        startAngleDegrees: 180,
        sweepAngleDegrees: 180
      }
    ]);
    const engine = new CadEngine();
    expect(
      engine.executeBatch(
        batch(
          buildSketchExchangeOps(recipe, {
            idPrefix: "inches",
            targetUnits: "in"
          })
        )
      )
    ).toMatchObject({ ok: true });
    const first = engine.createSnapshot().sketches[0]!.entities[0]!;
    expect(first.kind).toBe("arc");
    if (first.kind !== "arc") throw new Error("Expected analytic arc");
    expect(first.radius).toBeCloseTo(1, 12);
    const file = exportSketchExchange("dxf", engine.createSnapshot().sketches, {
      unit: "cm",
      sourceUnits: "in"
    });
    expect(
      parseSketchExchange("dxf", file.text).sketches[0]!.entities[0]
    ).toMatchObject({ kind: "arc", radius: 25.4 });
    expect(() =>
      parseSketchExchange("dxf", dxf([0, "CIRCLE", 10, 0, 20, 0, 40, 1], 0))
    ).toThrow("Specify unit explicitly");
    expect(
      parseSketchExchange("dxf", dxf([0, "CIRCLE", 10, 0, 20, 0, 40, 1], 0), {
        unit: "cm",
        scale: 2
      }).sketches[0]!.entities[0]
    ).toMatchObject({ radius: 20 });
  });

  it("preserves transformed SVG circular arcs, relative paths, and names through SVG export", () => {
    const recipe = parseSketchExchange(
      "svg",
      '<svg><g data-name="A &amp; B" transform="translate(10 20) rotate(90)"><path d="m 2 0 a 2 2 0 1 1 -2 -2 l 2 0 z"/></g></svg>',
      { unit: "mm" }
    );
    const arc = recipe.sketches[0]!.entities[0]!;
    expect(arc.kind).toBe("arc");
    if (arc.kind !== "arc") throw new Error("Expected analytic arc");
    expect(arc.center[0]).toBeCloseTo(10);
    expect(arc.center[1]).toBeCloseTo(-20);
    expect(arc.radius).toBe(2);
    expect(arc.sweepAngleDegrees).toBeCloseTo(-270);
    const engine = new CadEngine();
    expect(
      engine.executeBatch(
        batch(buildSketchExchangeOps(recipe, { idPrefix: "arc" }))
      )
    ).toMatchObject({ ok: true });
    const output = exportSketchExchange(
      "svg",
      engine.createSnapshot().sketches
    );
    const reopened = parseSketchExchange("svg", output.text);
    expect(reopened.sketches[0]!.name).toBe("A & B");
    const newArc = reopened.sketches[0]!.entities[0]!;
    expect(newArc).toMatchObject({ kind: "arc", radius: 2 });
    if (newArc.kind !== "arc") throw new Error("Expected analytic arc");
    expect(newArc.center[0]).toBeCloseTo(arc.center[0], 12);
    expect(newArc.center[1]).toBeCloseTo(arc.center[1], 12);
    expect(newArc.sweepAngleDegrees).toBeCloseTo(arc.sweepAngleDegrees, 12);
  });

  it("rejects unsupported or malformed content atomically rather than dropping later geometry", () => {
    const engine = new CadEngine();
    expect(
      engine.executeBatch(
        batch(
          buildSketchExchangeOps(parseSketchExchange("svg", plate), {
            idPrefix: "existing"
          })
        )
      )
    ).toMatchObject({ ok: true });
    const before = engine.exportProject();
    const bad: ["dxf" | "svg", string][] = [
      [
        "dxf",
        dxf([
          0,
          "LINE",
          10,
          0,
          20,
          0,
          11,
          1,
          21,
          0,
          0,
          "SPLINE",
          8,
          "Unsupported"
        ])
      ],
      ["dxf", dxf([0, "CIRCLE", 10, 0, 20, 0, 40, 1, 30, 2])],
      ["dxf", dxf([0, "LWPOLYLINE", 90, 3, 10, 0, 20, 0, 10, 1, 20, 1])],
      ["svg", '<svg><line x2="1"/><path d="M 0 0 C 1 1 2 2 3 3"/></svg>'],
      ["svg", '<svg><path d="M 0 0 A 3 2 0 0 1 3 2"/></svg>'],
      ["svg", '<svg><g transform="scale(2 1)"><circle r="1"/></g></svg>'],
      [
        "svg",
        '<svg><rect width="2" height="2"/><image href="picture.png"/></svg>'
      ],
      ["svg", '<svg><line x2="1"/></g>'],
      ["svg", '<svg><path d="M 0 0 L"/></svg>'],
      [
        "svg",
        '<svg><path style="transform:translate(5px)" d="M 0 0 L 1 1"/></svg>'
      ]
    ];
    for (const [format, text] of bad) {
      expect(() =>
        engine.executeBatch(
          batch(
            buildSketchExchangeOps(parseSketchExchange(format, text), {
              idPrefix: "bad"
            })
          )
        )
      ).toThrow(SketchExchangeError);
      expect(engine.exportProject()).toEqual(before);
    }
    expect(
      engine.executeBatch(
        batch(
          buildSketchExchangeOps(parseSketchExchange("svg", plate), {
            idPrefix: "existing"
          })
        )
      )
    ).toMatchObject({ ok: false });
    expect(engine.exportProject()).toEqual(before);
  });

  it("exports authored rectangles as exact contours and refuses unsupported sketch geometry", () => {
    const source: SketchSnapshot = {
      id: "s",
      name: "Source",
      plane: "XY",
      entities: [
        {
          id: "rect",
          kind: "rectangle",
          center: [0, 0],
          width: 20,
          height: 10,
          construction: false
        }
      ]
    };
    expect(
      parseSketchExchange("dxf", exportSketchExchange("dxf", [source]).text)
        .sketches[0]!.entities
    ).toHaveLength(4);
    const spline: SketchSnapshot = {
      ...source,
      entities: [
        ...source.entities,
        {
          id: "spline",
          kind: "spline",
          form: "controlPoints",
          points: [
            [0, 0],
            [1, 1],
            [2, 0]
          ],
          degree: 2,
          closed: false,
          construction: false
        }
      ]
    };
    expect(() => exportSketchExchange("svg", [spline])).toThrow(
      "No geometry was exported"
    );
    expect(exportSketchExchange("svg", [source]).notices.join(" ")).toContain(
      "constraints"
    );
  });
});
