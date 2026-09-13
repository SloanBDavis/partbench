import type {
  CadOp,
  DocumentUnits,
  SketchEntitySnapshot,
  SketchPlane,
  SketchSnapshot,
  Vec2
} from "@web-cad/cad-protocol";

/** Exchange coordinates are millimetres in a sketch's local, Y-up frame. */
export type SketchExchangeFormat = "dxf" | "svg";
export type SketchExchangeUnit = "mm" | "cm" | "m" | "in" | "ft" | "px";
export type SketchExchangeCurve =
  | { readonly kind: "line"; readonly start: Vec2; readonly end: Vec2 }
  | { readonly kind: "circle"; readonly center: Vec2; readonly radius: number }
  | {
      readonly kind: "arc";
      readonly center: Vec2;
      readonly radius: number;
      readonly startAngleDegrees: number;
      readonly sweepAngleDegrees: number;
    };
export interface SketchExchangeRecipe {
  readonly format: SketchExchangeFormat;
  readonly unit: SketchExchangeUnit;
  readonly millimetresPerUnit: number;
  readonly sketches: readonly {
    readonly name: string;
    readonly entities: readonly SketchExchangeCurve[];
  }[];
  readonly notices: readonly string[];
}
export interface SketchExchangeOptions {
  /** For unitless DXF, or an explicit override of file units. SVG defaults to CSS pixels (96/in). */
  readonly unit?: SketchExchangeUnit;
  /** Explicit additional scale, applied after converting file units to millimetres. */
  readonly scale?: number;
}
export class SketchExchangeError extends Error {
  readonly code = "UNSUPPORTED_SKETCH_EXCHANGE";
  constructor(message: string) {
    super(message);
    this.name = "SketchExchangeError";
  }
}
const units: Record<SketchExchangeUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
  px: 25.4 / 96
};
function fail(message: string): never {
  throw new SketchExchangeError(message);
}
const number = (
  value: string | undefined,
  label: string,
  fallback?: number
): number => {
  if (value === undefined && fallback !== undefined) return fallback;
  if (
    value === undefined ||
    value.trim() === "" ||
    !Number.isFinite(Number(value))
  )
    return fail(`Invalid ${label}: expected a finite number.`);
  return Number(value);
};
const positive = (value: number, label: string): number =>
  value > 0 ? value : fail(`${label} must be positive.`);
const degrees = (radians: number) => (radians * 180) / Math.PI;
const radians = (angle: number) => (angle * Math.PI) / 180;
const norm = (angle: number) => ((angle % 360) + 360) % 360;
const pointAt = (center: Vec2, radius: number, angle: number): Vec2 => [
  center[0] + radius * Math.cos(radians(angle)),
  center[1] + radius * Math.sin(radians(angle))
];
const same = (a: Vec2, b: Vec2) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-10;

class RecipeBuilder {
  readonly layers = new Map<string, SketchExchangeCurve[]>();
  count = 0;
  add(layer: string, curve: SketchExchangeCurve) {
    if (++this.count > 50_000)
      fail("Sketch import exceeds the 50,000 curve limit.");
    if (curve.kind === "line") {
      if (same(curve.start, curve.end))
        fail("Zero-length sketch segment is not supported.");
    } else {
      positive(curve.radius, "Curve radius");
      if (
        curve.kind === "arc" &&
        (Math.abs(curve.sweepAngleDegrees) < 1e-10 ||
          Math.abs(curve.sweepAngleDegrees) >= 360)
      )
        fail("An arc must have a nonzero sweep smaller than 360 degrees.");
    }
    const coordinates =
      curve.kind === "line"
        ? [...curve.start, ...curve.end]
        : [
            ...curve.center,
            curve.radius,
            ...(curve.kind === "arc"
              ? [curve.startAngleDegrees, curve.sweepAngleDegrees]
              : [])
          ];
    if (coordinates.some((value) => !Number.isFinite(value)))
      fail("Sketch geometry contains non-finite coordinates.");
    const entities = this.layers.get(layer) ?? [];
    entities.push(curve);
    this.layers.set(layer, entities);
  }
  recipe(
    format: SketchExchangeFormat,
    unit: SketchExchangeUnit,
    scale: number,
    notices: string[]
  ): SketchExchangeRecipe {
    if (!this.count) fail("The file contains no supported sketch curves.");
    return {
      format,
      unit,
      millimetresPerUnit: scale,
      sketches: [...this.layers].map(([name, entities]) => ({
        name,
        entities
      })),
      notices
    };
  }
}

export function parseSketchExchange(
  format: SketchExchangeFormat,
  text: string,
  options: SketchExchangeOptions = {}
): SketchExchangeRecipe {
  if (text.length > 20_000_000)
    fail("Sketch exchange text exceeds the 20 MB limit.");
  if (options.unit !== undefined && !(options.unit in units))
    fail("Unsupported sketch unit.");
  const scale = positive(options.scale ?? 1, "Import scale");
  if (!Number.isFinite(scale)) fail("Import scale must be finite.");
  if (format === "dxf") return parseDxf(text, options);
  if (format === "svg") return parseSvg(text, options);
  return fail(`Unsupported sketch format: ${String(format)}.`);
}

/** The caller allocates an unused prefix and submits these operations in one ordinary transaction. */
export function buildSketchExchangeOps(
  recipe: SketchExchangeRecipe,
  options: {
    readonly idPrefix: string;
    readonly plane?: SketchPlane;
    readonly targetUnits?: DocumentUnits;
  }
): readonly CadOp[] {
  if (!options.idPrefix.trim())
    fail("A nonempty import ID prefix is required.");
  const scale = 1 / units[options.targetUnits ?? "mm"];
  return recipe.sketches.flatMap((sketch, index): CadOp[] => {
    const sketchId = `${options.idPrefix}_sketch_${index + 1}`;
    return [
      {
        op: "sketch.create",
        id: sketchId,
        name: sketch.name,
        plane: options.plane ?? "XY"
      },
      ...sketch.entities.map((source, entityIndex): CadOp => {
        const entity = transformedCurve(source, [scale, 0, 0, scale, 0, 0]);
        const common = { sketchId, id: `${sketchId}_curve_${entityIndex + 1}` };
        if (entity.kind === "line")
          return {
            op: "sketch.addLine",
            ...common,
            start: entity.start,
            end: entity.end
          };
        if (entity.kind === "circle")
          return {
            op: "sketch.addCircle",
            ...common,
            center: entity.center,
            radius: entity.radius
          };
        return {
          op: "sketch.addArc",
          ...common,
          definition: {
            kind: "centerAngles",
            center: entity.center,
            radius: entity.radius,
            startAngleDegrees: entity.startAngleDegrees,
            sweepAngleDegrees: entity.sweepAngleDegrees
          }
        };
      })
    ];
  });
}

type DxfPair = readonly [number, string];
const dxfValue = (pairs: readonly DxfPair[], code: number) =>
  pairs.find((pair) => pair[0] === code)?.[1];
const dxfNumber = (
  pairs: readonly DxfPair[],
  code: number,
  fallback?: number
) => number(dxfValue(pairs, code), `DXF group ${code}`, fallback);
const dxfPoint = (
  pairs: readonly DxfPair[],
  code: number,
  scale: number
): Vec2 => [
  dxfNumber(pairs, code) * scale,
  dxfNumber(pairs, code + 10) * scale
];
function planarDxf(pairs: readonly DxfPair[]) {
  for (const [code, value] of pairs) {
    if (
      [30, 31, 38, 39, 210, 220].includes(code) &&
      Math.abs(number(value, `DXF group ${code}`)) > 1e-10
    )
      fail(
        "Only planar XY DXF entities without thickness or tilted extrusion are supported."
      );
    if (code === 230 && number(value, "DXF extrusion Z") !== 1)
      fail("Only DXF extrusion direction +Z is supported.");
    if (code === 67 && number(value, "DXF space") !== 0)
      fail(
        "Paper-space DXF entities are not supported; export model-space sketch geometry."
      );
  }
}
function parseDxf(
  text: string,
  options: SketchExchangeOptions
): SketchExchangeRecipe {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split(/\r?\n/);
  if (lines.length % 2 !== 0)
    fail("Malformed ASCII DXF: expected group-code/value pairs.");
  const pairs: DxfPair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = number(lines[i], "DXF group code");
    if (!Number.isInteger(code) || code < 0 || code > 1071)
      fail("Invalid DXF group code.");
    pairs.push([code, lines[i + 1]!.trim()]);
  }
  const unitIndex = pairs.findIndex(
    ([code, value]) => code === 9 && value === "$INSUNITS"
  );
  const unitCode =
    unitIndex >= 0 ? number(pairs[unitIndex + 1]?.[1], "$INSUNITS") : 0;
  const dxfUnits: Record<number, SketchExchangeUnit> = {
    1: "in",
    2: "ft",
    4: "mm",
    5: "cm",
    6: "m"
  };
  const unit = options.unit ?? dxfUnits[unitCode];
  if (!unit)
    fail(
      unitCode === 0
        ? "DXF has no declared units. Specify unit explicitly."
        : `Unsupported DXF $INSUNITS value ${unitCode}; specify an explicit unit override.`
    );
  const scale = units[unit] * (options.scale ?? 1);
  const result = new RecipeBuilder();
  let section = "";
  let foundEntities = false;
  let foundEof = false;
  let polyline:
    | {
        layer: string;
        closed: boolean;
        vertices: { point: Vec2; bulge: number }[];
      }
    | undefined;
  for (let i = 0; i < pairs.length; ) {
    const pair = pairs[i]!;
    if (pair[0] !== 0) {
      i++;
      continue;
    }
    let end = i + 1;
    while (end < pairs.length && pairs[end]![0] !== 0) end++;
    const data = pairs.slice(i + 1, end);
    i = end;
    const type = pair[1];
    if (type === "SECTION") {
      if (section) fail("Nested DXF sections are not supported.");
      section = dxfValue(data, 2) ?? "";
      if (!section) fail("DXF section name is missing.");
      if (section === "ENTITIES") {
        if (foundEntities) fail("Duplicate DXF ENTITIES section.");
        foundEntities = true;
      }
      continue;
    }
    if (type === "ENDSEC") {
      if (polyline || !section) fail("Malformed DXF section ending.");
      section = "";
      continue;
    }
    if (type === "EOF") {
      if (section || i !== pairs.length)
        fail("DXF EOF must follow the final ENDSEC.");
      foundEof = true;
      break;
    }
    if (section !== "ENTITIES") continue;
    planarDxf(data);
    const layer = dxfValue(data, 8) ?? "0";
    if (polyline && type !== "VERTEX" && type !== "SEQEND")
      fail("Malformed DXF POLYLINE vertex sequence.");
    if (type === "LINE")
      result.add(layer, {
        kind: "line",
        start: dxfPoint(data, 10, scale),
        end: dxfPoint(data, 11, scale)
      });
    else if (type === "CIRCLE")
      result.add(layer, {
        kind: "circle",
        center: dxfPoint(data, 10, scale),
        radius: dxfNumber(data, 40) * scale
      });
    else if (type === "ARC") {
      const startAngleDegrees = dxfNumber(data, 50);
      result.add(layer, {
        kind: "arc",
        center: dxfPoint(data, 10, scale),
        radius: dxfNumber(data, 40) * scale,
        startAngleDegrees,
        sweepAngleDegrees: norm(dxfNumber(data, 51) - startAngleDegrees)
      });
    } else if (type === "LWPOLYLINE") {
      const flags = dxfNumber(data, 70, 0);
      if ((flags & ~129) !== 0) fail("Unsupported DXF LWPOLYLINE flags.");
      for (const [code, value] of data)
        if (
          [40, 41, 43].includes(code) &&
          number(value, "DXF polyline width") !== 0
        )
          fail(
            "DXF polyline width is not a sketch centerline; zero-width polylines are supported."
          );
      const vertices: { point: Vec2; bulge: number }[] = [];
      for (let cursor = 0; cursor < data.length; cursor++) {
        if (data[cursor]![0] !== 10) continue;
        let vertexEnd = cursor + 1;
        while (vertexEnd < data.length && data[vertexEnd]![0] !== 10)
          vertexEnd++;
        const vertex = data.slice(cursor, vertexEnd);
        vertices.push({
          point: dxfPoint(vertex, 10, scale),
          bulge: dxfNumber(vertex, 42, 0)
        });
        cursor = vertexEnd - 1;
      }
      if (dxfNumber(data, 90) !== vertices.length)
        fail("DXF LWPOLYLINE vertex count does not match its geometry.");
      addPolyline(result, layer, vertices, (flags & 1) !== 0);
    } else if (type === "POLYLINE") {
      const flags = dxfNumber(data, 70, 0);
      if (
        (flags & ~129) !== 0 ||
        dxfNumber(data, 40, 0) !== 0 ||
        dxfNumber(data, 41, 0) !== 0
      )
        fail("Only ordinary zero-width 2D DXF POLYLINE is supported.");
      polyline = { layer, closed: (flags & 1) !== 0, vertices: [] };
    } else if (type === "VERTEX") {
      if (!polyline) fail("DXF VERTEX appears outside a POLYLINE.");
      if (
        dxfNumber(data, 70, 0) !== 0 ||
        dxfNumber(data, 40, 0) !== 0 ||
        dxfNumber(data, 41, 0) !== 0
      )
        fail("Only ordinary zero-width DXF vertices are supported.");
      polyline.vertices.push({
        point: dxfPoint(data, 10, scale),
        bulge: dxfNumber(data, 42, 0)
      });
    } else if (type === "SEQEND") {
      if (!polyline) fail("DXF SEQEND appears outside a POLYLINE.");
      addPolyline(result, polyline.layer, polyline.vertices, polyline.closed);
      polyline = undefined;
    } else
      fail(
        `Unsupported DXF entity ${type} on layer ${layer}. No geometry was imported.`
      );
  }
  if (!foundEntities || !foundEof || section || polyline)
    fail("Malformed or incomplete DXF document.");
  const notices = [
    "DXF curves import as editable sketch geometry; foreign constraints, styles, and feature history are not reconstructed."
  ];
  if (options.unit !== undefined)
    notices.push(`Explicit unit override: ${options.unit}.`);
  return result.recipe("dxf", unit, scale, notices);
}
function addPolyline(
  builder: RecipeBuilder,
  layer: string,
  vertices: readonly { point: Vec2; bulge: number }[],
  closed: boolean
) {
  if (vertices.length < 2)
    fail("A polyline must contain at least two vertices.");
  for (let i = 0; i < vertices.length - (closed ? 0 : 1); i++) {
    const { point: start, bulge } = vertices[i]!;
    const end = vertices[(i + 1) % vertices.length]!.point;
    if (bulge === 0) builder.add(layer, { kind: "line", start, end });
    else {
      const dx = end[0] - start[0],
        dy = end[1] - start[1];
      const factor = (1 - bulge * bulge) / (4 * bulge);
      const center: Vec2 = [
        (start[0] + end[0]) / 2 - dy * factor,
        (start[1] + end[1]) / 2 + dx * factor
      ];
      builder.add(layer, {
        kind: "arc",
        center,
        radius:
          (Math.hypot(dx, dy) * (1 + bulge * bulge)) / (4 * Math.abs(bulge)),
        startAngleDegrees: degrees(
          Math.atan2(start[1] - center[1], start[0] - center[0])
        ),
        sweepAngleDegrees: degrees(4 * Math.atan(bulge))
      });
    }
  }
  if (!closed && vertices.at(-1)!.bulge !== 0)
    fail("An open polyline's final bulge has no following vertex.");
}

// Strict, non-executing XML subset: no DOM, external entities, scripts, URLs, or raster fallback.
type Matrix = readonly [number, number, number, number, number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5]
];
const transformPoint = (m: Matrix, p: Vec2): Vec2 => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5]
];
function numbers(value: string, label: string): number[] {
  const values =
    value.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  if (
    value
      .replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, "")
      .replace(/[\s,]/g, "")
  )
    fail(`Unsupported ${label}.`);
  return values.map((item) => number(item, label));
}
function transform(value: string | undefined): Matrix {
  if (!value) return identity;
  let current = identity;
  let position = 0;
  const pattern = /([A-Za-z]+)\s*\(([^)]*)\)/g;
  for (const match of value.matchAll(pattern)) {
    if (value.slice(position, match.index).replace(/[\s,]/g, ""))
      fail("Invalid SVG transform.");
    position = match.index! + match[0].length;
    const args = numbers(match[2]!, "SVG transform");
    const kind = match[1];
    let next: Matrix;
    if (kind === "matrix" && args.length === 6)
      next = args as unknown as Matrix;
    else if (kind === "translate" && (args.length === 1 || args.length === 2))
      next = [1, 0, 0, 1, args[0]!, args[1] ?? 0];
    else if (kind === "scale" && (args.length === 1 || args.length === 2))
      next = [args[0]!, 0, 0, args[1] ?? args[0]!, 0, 0];
    else if (kind === "rotate" && (args.length === 1 || args.length === 3)) {
      const c = Math.cos(radians(args[0]!)),
        s = Math.sin(radians(args[0]!));
      const x = args[1] ?? 0,
        y = args[2] ?? 0;
      next = [c, s, -s, c, x - c * x + s * y, y - s * x - c * y];
    } else return fail(`Unsupported SVG transform ${kind}.`);
    current = multiply(current, next);
  }
  if (value.slice(position).trim() || position === 0)
    fail("Invalid SVG transform.");
  if (Math.abs(current[0] * current[3] - current[1] * current[2]) < 1e-14)
    fail("SVG transform collapses the geometry.");
  return current;
}
function transformedCurve(
  curve: SketchExchangeCurve,
  matrix: Matrix
): SketchExchangeCurve {
  if (curve.kind === "line")
    return {
      kind: "line",
      start: transformPoint(matrix, curve.start),
      end: transformPoint(matrix, curve.end)
    };
  const sx = Math.hypot(matrix[0], matrix[1]),
    sy = Math.hypot(matrix[2], matrix[3]);
  if (
    Math.abs(sx - sy) > 1e-9 * Math.max(sx, sy) ||
    Math.abs(matrix[0] * matrix[2] + matrix[1] * matrix[3]) > 1e-9 * sx * sy
  )
    fail(
      "Nonuniform SVG scaling would produce an ellipse; elliptical curves are not yet supported."
    );
  const center = transformPoint(matrix, curve.center);
  const radius = curve.radius * sx;
  if (curve.kind === "circle") return { kind: "circle", center, radius };
  const start = transformPoint(
    matrix,
    pointAt(curve.center, curve.radius, curve.startAngleDegrees)
  );
  return {
    kind: "arc",
    center,
    radius,
    startAngleDegrees: degrees(
      Math.atan2(start[1] - center[1], start[0] - center[0])
    ),
    sweepAngleDegrees:
      curve.sweepAngleDegrees *
      Math.sign(matrix[0] * matrix[3] - matrix[1] * matrix[2])
  };
}
const decodeXml = (value: string) =>
  value.replace(/&([^;]+);/g, (_, entity: string) => {
    const named: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'"
    };
    if (entity in named) return named[entity]!;
    const code = entity.startsWith("#x")
      ? parseInt(entity.slice(2), 16)
      : entity.startsWith("#")
        ? Number(entity.slice(1))
        : NaN;
    if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff)
      return fail("Unsupported SVG XML entity.");
    return String.fromCodePoint(code);
  });
function attributes(value: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let position = 0;
  for (const match of value.matchAll(
    /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  )) {
    if (value.slice(position, match.index).trim())
      fail("Malformed SVG attribute.");
    if (attrs[match[1]!] !== undefined) fail("Duplicate SVG attribute.");
    attrs[match[1]!] = decodeXml(match[2] ?? match[3] ?? "");
    position = match.index! + match[0].length;
  }
  if (value.slice(position).trim()) fail("Malformed SVG attributes.");
  return attrs;
}
function parseSvg(
  text: string,
  options: SketchExchangeOptions
): SketchExchangeRecipe {
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(text))
    fail("SVG declarations, external entities, and CDATA are not supported.");
  const source = text
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<\?xml\s[^]*?\?>/g, "");
  const builder = new RecipeBuilder();
  const stack: {
    tag: string;
    matrix: Matrix;
    layer: string;
    metadata: boolean;
  }[] = [];
  let position = 0,
    roots = 0,
    unit: SketchExchangeUnit = options.unit ?? "px",
    scale = units[unit] * (options.scale ?? 1);
  for (const token of source.matchAll(
    /<\/?[\w:.-]+(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/g
  )) {
    if (source.slice(position, token.index).trim() && !stack.at(-1)?.metadata)
      fail("Unsupported text or malformed SVG markup.");
    position = token.index! + token[0].length;
    const closing = token[0].startsWith("</");
    const match = /^<\/?([\w:.-]+)([^]*?)\/?\s*>$/.exec(token[0])!;
    const tag = match[1]!;
    if (closing) {
      if (stack.pop()?.tag !== tag) fail("Mismatched SVG closing tag.");
      continue;
    }
    const attrs = attributes(match[2]!);
    const parent = stack.at(-1);
    const metadata =
      parent?.metadata || ["title", "desc", "metadata"].includes(tag);
    if (!parent && tag !== "svg") fail("SVG requires one root svg element.");
    if (tag === "svg") {
      if (parent || roots++)
        fail("Nested or multiple SVG viewports are not supported.");
      if (attrs.viewBox) {
        const box = numbers(attrs.viewBox, "SVG viewBox");
        if (box.length !== 4 || box[2]! <= 0 || box[3]! <= 0)
          fail("Invalid SVG viewBox.");
        if (options.unit === undefined) {
          const width = svgPhysicalLength(attrs.width),
            height = svgPhysicalLength(attrs.height);
          if (!width || !height)
            fail(
              "SVG viewBox requires explicit physical width and height, or an explicit import unit."
            );
          const xScale = width.mm / box[2]!,
            yScale = height.mm / box[3]!;
          if (Math.abs(xScale - yScale) > 1e-9 * Math.max(xScale, yScale))
            fail(
              "SVG viewBox aspect ratio differs from its physical dimensions. Normalize the viewport or specify an explicit import unit."
            );
          unit = width.unit;
          scale = xScale * (options.scale ?? 1);
        }
      }
    }
    for (const attribute of [
      "clip-path",
      "mask",
      "filter",
      "href",
      "xlink:href"
    ])
      if (attrs[attribute] !== undefined)
        fail(`SVG ${attribute} changes visible geometry and is not supported.`);
    if (
      attrs.style &&
      /(?:^|;)\s*(?:transform|clip-path|mask|filter|display|visibility|d|x|y|r|rx|ry|cx|cy|width|height)\s*:/i.test(
        attrs.style
      )
    )
      fail(
        "Geometry-changing SVG CSS is not supported; use explicit shape attributes."
      );
    if (attrs.display === "none" || attrs.visibility === "hidden")
      fail(
        "SVG contains hidden geometry; remove it or make it visible before import."
      );
    const base: Matrix = parent?.matrix ?? [scale, 0, 0, -scale, 0, 0];
    const matrix = multiply(base, transform(attrs.transform));
    const layer =
      tag === "g"
        ? (attrs["inkscape:label"] ??
          attrs["data-name"] ??
          attrs.id ??
          parent?.layer ??
          "SVG")
        : (parent?.layer ?? "SVG");
    const add = (curve: SketchExchangeCurve) =>
      builder.add(layer, transformedCurve(curve, matrix));
    if (!metadata) {
      const n = (key: string, fallback?: number) =>
        svgCoordinate(attrs[key], key, fallback);
      if (tag === "line")
        add({
          kind: "line",
          start: [n("x1", 0), n("y1", 0)],
          end: [n("x2", 0), n("y2", 0)]
        });
      else if (tag === "circle")
        add({
          kind: "circle",
          center: [n("cx", 0), n("cy", 0)],
          radius: n("r")
        });
      else if (tag === "rect") {
        if (n("rx", 0) !== 0 || n("ry", 0) !== 0)
          fail(
            "Rounded SVG rectangles require circular-arc paths; rx/ry are not supported."
          );
        const x = n("x", 0),
          y = n("y", 0),
          w = positive(n("width"), "SVG width"),
          h = positive(n("height"), "SVG height");
        const points: Vec2[] = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h]
        ];
        points.forEach((start, index) =>
          add({ kind: "line", start, end: points[(index + 1) % 4]! })
        );
      } else if (tag === "polyline" || tag === "polygon") {
        const coords = numbers(attrs.points ?? "", "SVG points");
        if (coords.length < 4 || coords.length % 2)
          fail("SVG points must contain at least two XY pairs.");
        const points: Vec2[] = [];
        for (let i = 0; i < coords.length; i += 2)
          points.push([coords[i]!, coords[i + 1]!]);
        if (tag === "polygon" && !same(points[0]!, points.at(-1)!))
          points.push(points[0]!);
        for (let i = 1; i < points.length; i++)
          add({ kind: "line", start: points[i - 1]!, end: points[i]! });
      } else if (tag === "path") parseSvgPath(attrs.d ?? "", add);
      else if (tag !== "svg" && tag !== "g")
        fail(`Unsupported SVG element ${tag}. No geometry was imported.`);
    }
    if (!token[0].endsWith("/>")) stack.push({ tag, matrix, layer, metadata });
  }
  if (stack.length || source.slice(position).trim() || roots !== 1)
    fail("Malformed SVG document.");
  return builder.recipe("svg", unit, scale, [
    "SVG coordinates use the source user-space origin, physical scale, and Y-up sketch axes. ViewBox origin is preserved.",
    "Styles, fill rules, constraints, and feature history are not sketch geometry; all supported contours are imported."
  ]);
}
function svgPhysicalLength(
  value: string | undefined
): { mm: number; unit: SketchExchangeUnit } | undefined {
  if (!value) return undefined;
  const match =
    /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(mm|cm|m|in|ft|px)?\s*$/.exec(
      value
    );
  if (!match) fail("SVG physical lengths must use mm, cm, m, in, ft, or px.");
  const unit = (match[2] ?? "px") as SketchExchangeUnit;
  return {
    unit,
    mm: positive(number(match[1], "SVG length"), "SVG length") * units[unit]
  };
}
function svgCoordinate(
  value: string | undefined,
  label: string,
  fallback?: number
): number {
  if (
    value !== undefined &&
    !/^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/.test(value)
  )
    fail(
      `SVG ${label} must use unitless user coordinates; normalize per-shape units before import.`
    );
  return number(value, `SVG ${label}`, fallback);
}
function parseSvgPath(
  value: string,
  add: (curve: SketchExchangeCurve) => void
) {
  const tokens =
    value.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  if (
    value
      .replace(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, "")
      .replace(/[\s,]/g, "")
  )
    fail("Malformed SVG path.");
  let cursor = 0,
    command = "",
    current: Vec2 = [0, 0],
    start: Vec2 | undefined;
  const read = () => number(tokens[cursor++], "SVG path coordinate");
  while (cursor < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[cursor]!)) command = tokens[cursor++]!;
    const kind = command.toUpperCase(),
      relative = command !== kind;
    if (!["M", "L", "H", "V", "A", "Z"].includes(kind))
      fail(
        `Unsupported SVG path command ${command || "(missing)"}; supported commands are M/L/H/V/A/Z with circular arcs.`
      );
    if (!start && kind !== "M") fail("SVG path must start with M.");
    const xy = (): Vec2 => {
      const x = read(),
        y = read();
      return relative ? [current[0] + x, current[1] + y] : [x, y];
    };
    if (kind === "Z") {
      if (start && !same(current, start))
        add({ kind: "line", start: current, end: start });
      current = start!;
      command = "";
    } else if (kind === "M") {
      current = xy();
      start = current;
      command = relative ? "l" : "L";
    } else if (kind === "A") {
      const rx = read(),
        ry = read();
      read();
      const large = read(),
        sweep = read(),
        end = xy();
      if (
        ![0, 1].includes(large) ||
        ![0, 1].includes(sweep) ||
        rx < 0 ||
        ry < 0
      )
        fail("Invalid SVG arc flags or radius.");
      if (Math.abs(rx - ry) > 1e-9 * Math.max(rx, ry, 1))
        fail(
          "Elliptical SVG arcs are not supported; no circular approximation is performed."
        );
      if (same(current, end))
        fail(
          "SVG arc endpoints coincide; use a circle for a full circular contour."
        );
      if (rx === 0) add({ kind: "line", start: current, end });
      else {
        const dx = end[0] - current[0],
          dy = end[1] - current[1],
          chord = Math.hypot(dx, dy);
        const radius = Math.max(rx, chord / 2); // SVG's specified radii correction, not a tessellation approximation.
        const offset =
          Math.sqrt(Math.max(0, radius * radius - (chord * chord) / 4)) *
          (large === sweep ? -1 : 1);
        const center: Vec2 = [
          (current[0] + end[0]) / 2 - (dy / chord) * offset,
          (current[1] + end[1]) / 2 + (dx / chord) * offset
        ];
        const angle = degrees(
          Math.atan2(current[1] - center[1], current[0] - center[0])
        );
        const endAngle = degrees(
          Math.atan2(end[1] - center[1], end[0] - center[0])
        );
        add({
          kind: "arc",
          center,
          radius,
          startAngleDegrees: angle,
          sweepAngleDegrees: sweep
            ? norm(endAngle - angle)
            : -norm(angle - endAngle)
        });
      }
      current = end;
    } else {
      let end: Vec2;
      if (kind === "H")
        end = [read() + (relative ? current[0] : 0), current[1]];
      else if (kind === "V")
        end = [current[0], read() + (relative ? current[1] : 0)];
      else end = xy();
      add({ kind: "line", start: current, end });
      current = end;
    }
  }
  if (!start) fail("SVG path is empty.");
}

export interface SketchExchangeExport {
  readonly format: SketchExchangeFormat;
  readonly text: string;
  readonly unit: SketchExchangeUnit;
  readonly curveCount: number;
  readonly notices: readonly string[];
}
/** Exports local 2D geometry, never projects a 3D assembly or silently tessellates curves. */
export function exportSketchExchange(
  format: SketchExchangeFormat,
  sketches: readonly SketchSnapshot[],
  options: {
    readonly unit?: SketchExchangeUnit;
    readonly sourceUnits?: DocumentUnits;
  } = {}
): SketchExchangeExport {
  const unit = options.unit ?? "mm";
  if (!(unit in units) || (format === "dxf" && unit === "px"))
    fail("Unsupported export unit.");
  const scale = units[options.sourceUnits ?? "mm"] / units[unit];
  const names = new Set<string>();
  const layers = sketches.map((sketch) => {
    if (!sketch.name.trim() || names.has(sketch.name))
      fail(
        "Exported sketch names must be nonempty and unique so layers remain distinct."
      );
    names.add(sketch.name);
    return {
      name: sketch.name,
      curves: sketch.entities
        .flatMap(exportCurves)
        .map((curve) => transformedCurve(curve, [scale, 0, 0, scale, 0, 0]))
    };
  });
  const curveCount = layers.reduce(
    (sum, layer) => sum + layer.curves.length,
    0
  );
  if (!curveCount)
    fail("Select at least one sketch containing supported geometry.");
  const notices = [
    "Only local 2D curve geometry and sketch names are exported. Dimensions, constraints, construction flags, attachments, and feature history remain in the native .wcad file."
  ];
  if (format === "dxf") {
    const codes: Record<string, number> = { in: 1, ft: 2, mm: 4, cm: 5, m: 6 };
    const lines: (number | string)[] = [
      0,
      "SECTION",
      2,
      "HEADER",
      9,
      "$ACADVER",
      1,
      "AC1015",
      9,
      "$INSUNITS",
      70,
      codes[unit]!,
      0,
      "ENDSEC",
      0,
      "SECTION",
      2,
      "ENTITIES"
    ];
    for (const layer of layers) {
      if (/[<>/\\":;?*|=\r\n]/.test(layer.name) || layer.name.length > 255)
        fail(
          `Sketch name cannot be represented as a DXF layer: ${layer.name}. Rename it before exporting.`
        );
      for (const curve of layer.curves) {
        lines.push(0, curve.kind.toUpperCase(), 8, layer.name);
        if (curve.kind === "line")
          lines.push(
            10,
            fmt(curve.start[0]),
            20,
            fmt(curve.start[1]),
            11,
            fmt(curve.end[0]),
            21,
            fmt(curve.end[1])
          );
        else {
          lines.push(
            10,
            fmt(curve.center[0]),
            20,
            fmt(curve.center[1]),
            40,
            fmt(curve.radius)
          );
          if (curve.kind === "arc")
            lines.push(
              50,
              fmt(
                norm(
                  curve.startAngleDegrees +
                    (curve.sweepAngleDegrees < 0 ? curve.sweepAngleDegrees : 0)
                )
              ),
              51,
              fmt(
                norm(
                  curve.startAngleDegrees +
                    (curve.sweepAngleDegrees > 0 ? curve.sweepAngleDegrees : 0)
                )
              )
            );
        }
      }
    }
    lines.push(0, "ENDSEC", 0, "EOF");
    return { format, text: `${lines.join("\n")}\n`, unit, curveCount, notices };
  }
  if (format !== "svg") return fail("Unsupported sketch export format.");
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const include = (point: Vec2) => {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, -point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, -point[1]);
  };
  for (const layer of layers)
    for (const curve of layer.curves) {
      if (curve.kind === "line") {
        include(curve.start);
        include(curve.end);
      } else {
        include([
          curve.center[0] - curve.radius,
          curve.center[1] - curve.radius
        ]);
        include([
          curve.center[0] + curve.radius,
          curve.center[1] + curve.radius
        ]);
      }
    }
  const width = Math.max(1, maxX - minX),
    height = Math.max(1, maxY - minY);
  const elements = layers.map(
    (layer, index) =>
      `  <g id="sketch_${index + 1}" data-name="${xml(layer.name)}">\n${layer.curves
        .map(svgElement)
        .map((line) => `    ${line}`)
        .join("\n")}\n  </g>`
  );
  return {
    format,
    unit,
    curveCount,
    notices,
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}${unit}" height="${fmt(height)}${unit}" viewBox="${fmt(minX)} ${fmt(minY)} ${fmt(width)} ${fmt(height)}" fill="none" stroke="black" stroke-width="${fmt(0.1 * scale)}">\n${elements.join("\n")}\n</svg>\n`
  };
}
function exportCurves(entity: SketchEntitySnapshot): SketchExchangeCurve[] {
  if (entity.kind === "point" || entity.kind === "spline")
    return fail(
      `Sketch entity ${entity.id} is ${entity.kind}; this codec supports exact lines, circles, arcs, and rectangles. No geometry was exported.`
    );
  if (entity.kind === "rectangle") {
    const x = entity.center[0] - entity.width / 2,
      y = entity.center[1] - entity.height / 2;
    const p: Vec2[] = [
      [x, y],
      [x + entity.width, y],
      [x + entity.width, y + entity.height],
      [x, y + entity.height]
    ];
    return p.map((start, i) => ({ kind: "line", start, end: p[(i + 1) % 4]! }));
  }
  return [entity];
}
const fmt = (value: number) => {
  if (!Number.isFinite(value))
    return fail("Cannot export non-finite sketch geometry.");
  return String(Number(value.toPrecision(15)));
};
const xml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
function svgElement(curve: SketchExchangeCurve): string {
  if (curve.kind === "line")
    return `<line x1="${fmt(curve.start[0])}" y1="${fmt(-curve.start[1])}" x2="${fmt(curve.end[0])}" y2="${fmt(-curve.end[1])}"/>`;
  if (curve.kind === "circle")
    return `<circle cx="${fmt(curve.center[0])}" cy="${fmt(-curve.center[1])}" r="${fmt(curve.radius)}"/>`;
  const start = pointAt(curve.center, curve.radius, curve.startAngleDegrees),
    end = pointAt(
      curve.center,
      curve.radius,
      curve.startAngleDegrees + curve.sweepAngleDegrees
    );
  return `<path d="M ${fmt(start[0])} ${fmt(-start[1])} A ${fmt(curve.radius)} ${fmt(curve.radius)} 0 ${Math.abs(curve.sweepAngleDegrees) > 180 ? 1 : 0} ${curve.sweepAngleDegrees > 0 ? 0 : 1} ${fmt(end[0])} ${fmt(-end[1])}"/>`;
}
