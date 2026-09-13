import { describe, expect, it } from "vitest";
import type { SketchEntitySnapshot, Vec2 } from "@web-cad/cad-protocol";
import { createSpurGearGeometry, resolveSpurGearValues } from "./spurGear";
import { validateV22RegionSource } from "./v22RegionSourceValidation";

const TAU = 2 * Math.PI;
const normalize = (angle: number) => ((angle % TAU) + TAU) % TAU;
function distanceToSource(point: Vec2, entity: SketchEntitySnapshot): number {
  if (entity.kind === "line") {
    const dx = entity.end[0] - entity.start[0],
      dy = entity.end[1] - entity.start[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - entity.start[0]) * dx +
          (point[1] - entity.start[1]) * dy) /
          (dx * dx + dy * dy)
      )
    );
    return Math.hypot(
      point[0] - entity.start[0] - t * dx,
      point[1] - entity.start[1] - t * dy
    );
  }
  if (entity.kind !== "arc") return Infinity;
  const start = (entity.startAngleDegrees * Math.PI) / 180,
    sweep = (entity.sweepAngleDegrees * Math.PI) / 180;
  const angle = Math.atan2(
    point[1] - entity.center[1],
    point[0] - entity.center[0]
  );
  if (
    sweep > 0
      ? normalize(angle - start) <= sweep
      : normalize(start - angle) <= -sweep
  )
    return Math.abs(
      Math.hypot(point[0] - entity.center[0], point[1] - entity.center[1]) -
        entity.radius
    );
  return Math.min(
    ...[start, start + sweep].map((a) =>
      Math.hypot(
        point[0] - entity.center[0] - entity.radius * Math.cos(a),
        point[1] - entity.center[1] - entity.radius * Math.sin(a)
      )
    )
  );
}

describe("bounded circular-arc involute approximation", () => {
  it.each([
    [17, 15],
    [20, 20],
    [60, 20],
    [128, 30]
  ] as const)(
    "stays within requested distance of the mathematical %iT / %i degree flank",
    (teeth, pressureAngleDegrees) => {
      const v = resolveSpurGearValues(
        {
          teeth,
          pressureAngleDegrees,
          module: 1.5,
          faceWidth: 10,
          backlash: 0.08
        },
        new Map()
      );
      for (const tolerance of [v.profileTolerance, v.profileTolerance / 4]) {
        const geometry = createSpurGearGeometry("gear", {
          ...v,
          profileTolerance: tolerance
        });
        const pitch = (v.module * teeth) / 2,
          alpha = (pressureAngleDegrees * Math.PI) / 180,
          base = pitch * Math.cos(alpha);
        const lo = Math.sqrt(
            (Math.max(base, pitch - 1.25 * v.module) / base) ** 2 - 1
          ),
          hi = Math.sqrt(((pitch + v.module) / base) ** 2 - 1);
        const baseHalf =
          Math.PI / (2 * teeth) -
          v.backlash / (2 * pitch) +
          Math.tan(alpha) -
          alpha;
        const perTooth = geometry.entities.length / teeth;
        const firstTooth = geometry.entities.slice(0, perTooth);
        let maximum = 0;
        // Independent, denser mathematical sampling, through the actual persisted
        // canonical entities rather than the generator's private fitted curves.
        for (let index = 0; index <= 10001; index++) {
          const t = lo + ((hi - lo) * index) / 10001;
          const radius = base * Math.sqrt(1 + t * t),
            angle = -baseHalf + t - Math.atan(t);
          const point: Vec2 = [
            radius * Math.cos(angle),
            radius * Math.sin(angle)
          ];
          maximum = Math.max(
            maximum,
            Math.min(
              ...firstTooth.map((entity) => distanceToSource(point, entity))
            )
          );
        }
        expect(maximum).toBeLessThan(tolerance);
        let reverseMaximum = 0;
        for (const entity of firstTooth) {
          if (entity.kind !== "arc" || Math.hypot(...entity.center) < 1e-9)
            continue;
          for (let index = 0; index <= 4001; index++) {
            const a =
              ((entity.startAngleDegrees +
                (entity.sweepAngleDegrees * index) / 4001) *
                Math.PI) /
              180;
            const point: Vec2 = [
              entity.center[0] + entity.radius * Math.cos(a),
              entity.center[1] + entity.radius * Math.sin(a)
            ];
            const t = Math.max(
              lo,
              Math.min(
                hi,
                Math.sqrt(Math.max(0, (Math.hypot(...point) / base) ** 2 - 1))
              )
            );
            const radius = base * Math.sqrt(1 + t * t),
              angle = Math.sign(point[1]) * (baseHalf - t + Math.atan(t));
            reverseMaximum = Math.max(
              reverseMaximum,
              Math.hypot(
                point[0] - radius * Math.cos(angle),
                point[1] - radius * Math.sin(angle)
              )
            );
          }
        }
        expect(reverseMaximum).toBeLessThan(tolerance);
        expect(geometry.entities.length).toBeLessThanOrEqual(4096);
        expect(
          validateV22RegionSource(geometry.profile, {
            id: "gear",
            entities: new Map(
              geometry.entities.map((entity) => [entity.id, entity])
            )
          }).ok
        ).toBe(true);
      }
    }
  );

  it("bounds requested precision instead of silently relaxing it", () => {
    expect(() =>
      resolveSpurGearValues(
        { teeth: 20, module: 1.5, faceWidth: 10, profileTolerance: 1e-8 },
        new Map()
      )
    ).toThrow(/at least/);
    expect(() =>
      resolveSpurGearValues(
        { teeth: 20, module: 1.5, faceWidth: 10, profileTolerance: 0.1 },
        new Map()
      )
    ).toThrow(/module\/50/);
    expect(() =>
      createSpurGearGeometry(
        "gear",
        resolveSpurGearValues(
          { teeth: 128, module: 1.5, faceWidth: 10, profileTolerance: 8e-7 },
          new Map()
        )
      )
    ).toThrow(/4096/);
    const bound = resolveSpurGearValues(
      {
        teeth: 20,
        module: 1.5,
        faceWidth: 10,
        profileTolerance: { parameterId: "accuracy" }
      },
      new Map([["accuracy", { value: 0.001 }]])
    );
    expect(bound.profileTolerance).toBe(0.001);
  });

  it.each([40, 60])(
    "keeps the sampled 20:%i geared poses free of source boundary/material intersection",
    (outputTeeth) => {
      const values = (teeth: number) =>
        resolveSpurGearValues(
          {
            teeth,
            module: 1.5,
            faceWidth: 10,
            backlash: 0.08,
            boreDiameter: 8.1
          },
          new Map()
        );
      const pinion = createSpurGearGeometry("pinion", values(20)),
        wheel = createSpurGearGeometry("wheel", values(outputTeeth));
      const transform = (
        entity: SketchEntitySnapshot,
        angle: number,
        x: number
      ): SketchEntitySnapshot => {
        const move = (p: Vec2): Vec2 => [
          p[0] * Math.cos(angle) - p[1] * Math.sin(angle) + x,
          p[0] * Math.sin(angle) + p[1] * Math.cos(angle)
        ];
        if (entity.kind === "line")
          return {
            ...entity,
            start: move(entity.start),
            end: move(entity.end)
          };
        if (entity.kind === "arc")
          return {
            ...entity,
            center: move(entity.center),
            startAngleDegrees:
              entity.startAngleDegrees + (angle * 180) / Math.PI
          };
        if (entity.kind === "circle")
          return { ...entity, center: move(entity.center) };
        throw new Error("Unexpected gear entity");
      };
      for (const degrees of [0, 3, 9, 30, 90, 180, 270, 360]) {
        const angle = (degrees * Math.PI) / 180,
          ratio = outputTeeth / 20,
          spacing = (1.5 * (20 + outputTeeth)) / 2;
        const entities = [
          ...pinion.entities.map((entity) => transform(entity, angle, 0)),
          ...wheel.entities.map((entity) =>
            transform(entity, Math.PI / outputTeeth - angle / ratio, spacing)
          )
        ];
        const result = validateV22RegionSource(
          {
            kind: "regions",
            sketchId: "mesh",
            regions: [pinion.profile.regions[0], wheel.profile.regions[0]]
          },
          {
            id: "mesh",
            entities: new Map(entities.map((entity) => [entity.id, entity]))
          }
        );
        expect(result.issues).toEqual([]);
        expect(result.ok).toBe(true);
      }
    }
  );
});
