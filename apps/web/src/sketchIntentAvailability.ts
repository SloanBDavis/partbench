import {
  CAD_V19_SKETCH_GEOMETRY_POLICY,
  type SketchEntitySnapshot
} from "@web-cad/cad-protocol";

export type SketchIntentFeasibility =
  | { readonly available: true; readonly message: "Ready to collect targets." }
  | { readonly available: false; readonly message: string };

type DimensionFamily =
  | "rectangleWidth"
  | "rectangleHeight"
  | "lineLength"
  | "radius"
  | "diameter"
  | "arcSweep"
  | "pointDistance"
  | "horizontalDistance"
  | "verticalDistance"
  | "pointLineDistance"
  | "lineAngle";

type ConstraintKind =
  | "horizontal"
  | "vertical"
  | "fixed"
  | "coincident"
  | "midpoint"
  | "parallel"
  | "perpendicular"
  | "tangent"
  | "concentric"
  | "equalLength"
  | "equalRadius"
  | "symmetry";

const READY = {
  available: true,
  message: "Ready to collect targets."
} as const;

export function getSketchDimensionFamilyFeasibility(
  family: DimensionFamily,
  entities: readonly SketchEntitySnapshot[]
): SketchIntentFeasibility {
  const linear = CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance;
  const angular = CAD_V19_SKETCH_GEOMETRY_POLICY.angularToleranceDegrees;
  const points = pointTargets(entities);
  const lines = validLines(entities);
  switch (family) {
    case "rectangleWidth":
      return result(
        entities.some(
          (entity) => entity.kind === "rectangle" && entity.width > linear
        ),
        "Add or select a rectangle with a width above model tolerance."
      );
    case "rectangleHeight":
      return result(
        entities.some(
          (entity) => entity.kind === "rectangle" && entity.height > linear
        ),
        "Add or select a rectangle with a height above model tolerance."
      );
    case "lineLength":
      return result(
        lines.length > 0,
        "Add or select a line with a defined direction."
      );
    case "radius":
    case "diameter":
      return result(
        entities.some(
          (entity) =>
            (entity.kind === "circle" || entity.kind === "arc") &&
            entity.radius > linear
        ),
        "Add or select a circle or arc with a radius above model tolerance."
      );
    case "arcSweep":
      return result(
        entities.some(
          (entity) =>
            entity.kind === "arc" &&
            Math.abs(entity.sweepAngleDegrees) >= angular &&
            Math.abs(entity.sweepAngleDegrees) <= 360 - angular
        ),
        "Add or select an arc with a valid signed sweep branch."
      );
    case "pointDistance":
      return result(
        hasPointPair(points, (dx, dy) => Math.hypot(dx, dy) > linear),
        "Choose two different points separated by more than model tolerance."
      );
    case "horizontalDistance":
      return result(
        hasPointPair(points, (dx) => Math.abs(dx) > linear),
        "Choose two points with horizontal separation above model tolerance."
      );
    case "verticalDistance":
      return result(
        hasPointPair(points, (_dx, dy) => Math.abs(dy) > linear),
        "Choose two points with vertical separation above model tolerance."
      );
    case "pointLineDistance":
      return result(
        lines.some((line) =>
          points.some((point) => {
            if (point.ownerId === line.id && point.ownerKind === "line")
              return false;
            const length = lineLength(line);
            const signed =
              ((line.end[0] - line.start[0]) *
                (point.coordinate[1] - line.start[1]) -
                (line.end[1] - line.start[1]) *
                  (point.coordinate[0] - line.start[0])) /
              length;
            return Math.abs(signed) > linear;
          })
        ),
        "Choose a point off a line with a defined direction."
      );
    case "lineAngle":
      return result(
        lines.some((primary) =>
          lines.some((secondary) => {
            if (primary.id === secondary.id) return false;
            const angle = Math.abs(signedLineAngle(primary, secondary));
            return angle > angular && angle < 180 - angular;
          })
        ),
        `Choose two lines whose angle is strictly between ${angular}° and ${
          180 - angular
        }°.`
      );
  }
}

export function getSketchConstraintKindFeasibility(
  kind: ConstraintKind,
  entities: readonly SketchEntitySnapshot[]
): SketchIntentFeasibility {
  const linear = CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance;
  const points = pointTargets(entities);
  const lines = validLines(entities);
  const curves = entities.filter(
    (entity) =>
      entity.kind === "line" ||
      ((entity.kind === "circle" || entity.kind === "arc") &&
        entity.radius > linear)
  );
  const radiusCurves = curves.filter(
    (entity) => entity.kind === "circle" || entity.kind === "arc"
  );
  switch (kind) {
    case "horizontal":
    case "vertical":
      return result(
        lines.length > 0,
        "Choose a line with a defined direction."
      );
    case "fixed":
      return result(points.length > 0, "Choose an eligible sketch point.");
    case "coincident":
      return result(points.length > 1, "Choose two different sketch points.");
    case "midpoint":
      return result(
        lines.length > 0 &&
          points.some(
            (point) =>
              point.ownerKind === "point" ||
              point.ownerKind === "rectangle" ||
              point.ownerKind === "circle"
          ),
        "Choose a line and an eligible point target."
      );
    case "parallel":
    case "perpendicular":
    case "equalLength":
      return result(
        lines.length > 1,
        "Choose two lines with defined directions."
      );
    case "tangent":
      return result(
        curves.some((primary) =>
          curves.some(
            (secondary) =>
              primary.id !== secondary.id &&
              tangentPairSupported(primary.kind, secondary.kind)
          )
        ),
        "Choose a supported line-circle, line-arc, circle-arc, or arc-arc pair."
      );
    case "concentric":
    case "equalRadius":
      return result(
        radiusCurves.length > 1,
        "Choose two circles or arcs with radii above model tolerance."
      );
    case "symmetry":
      return result(
        points.length > 1 && lines.length > 0,
        "Choose two different points and a line with a defined direction."
      );
  }
}

function pointTargets(entities: readonly SketchEntitySnapshot[]) {
  return entities.flatMap((entity) => {
    const base = { ownerId: entity.id, ownerKind: entity.kind } as const;
    if (entity.kind === "point")
      return [
        { ...base, key: `${entity.id}:position`, coordinate: entity.point }
      ];
    if (entity.kind === "line")
      return [
        { ...base, key: `${entity.id}:start`, coordinate: entity.start },
        { ...base, key: `${entity.id}:end`, coordinate: entity.end }
      ];
    if (entity.kind === "arc") {
      const radians = (entity.startAngleDegrees * Math.PI) / 180;
      const endRadians =
        ((entity.startAngleDegrees + entity.sweepAngleDegrees) * Math.PI) / 180;
      return [
        { ...base, key: `${entity.id}:center`, coordinate: entity.center },
        {
          ...base,
          key: `${entity.id}:start`,
          coordinate: [
            entity.center[0] + entity.radius * Math.cos(radians),
            entity.center[1] + entity.radius * Math.sin(radians)
          ] as const
        },
        {
          ...base,
          key: `${entity.id}:end`,
          coordinate: [
            entity.center[0] + entity.radius * Math.cos(endRadians),
            entity.center[1] + entity.radius * Math.sin(endRadians)
          ] as const
        }
      ];
    }
    if (entity.kind === "spline") {
      return entity.points.map((point, index) => ({
        ...base,
        key: `${entity.id}:p${index}`,
        coordinate: point
      }));
    }
    return [{ ...base, key: `${entity.id}:center`, coordinate: entity.center }];
  });
}

function validLines(entities: readonly SketchEntitySnapshot[]) {
  return entities.filter(
    (
      entity
    ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
      entity.kind === "line" &&
      lineLength(entity) > CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance
  );
}

function hasPointPair(
  points: ReturnType<typeof pointTargets>,
  predicate: (dx: number, dy: number) => boolean
): boolean {
  return points.some((primary) =>
    points.some(
      (secondary) =>
        primary.key !== secondary.key &&
        predicate(
          secondary.coordinate[0] - primary.coordinate[0],
          secondary.coordinate[1] - primary.coordinate[1]
        )
    )
  );
}

function signedLineAngle(
  primary: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  secondary: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  const ax = primary.end[0] - primary.start[0];
  const ay = primary.end[1] - primary.start[1];
  const bx = secondary.end[0] - secondary.start[0];
  const by = secondary.end[1] - secondary.start[1];
  return (Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI;
}

function lineLength(
  line: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  return Math.hypot(line.end[0] - line.start[0], line.end[1] - line.start[1]);
}

function tangentPairSupported(
  primary: SketchEntitySnapshot["kind"],
  secondary: SketchEntitySnapshot["kind"]
): boolean {
  if (primary === secondary) return primary === "arc";
  return (
    primary === "line" ||
    secondary === "line" ||
    primary === "arc" ||
    secondary === "arc"
  );
}

function result(available: boolean, message: string): SketchIntentFeasibility {
  return available ? READY : { available: false, message };
}
