import {
  resolveDrawingDimension,
  drawingLayerAppearance,
  type DrawingLayer,
  type DrawingDimension,
  type DrawingEntity,
  type DocumentUnits
} from "@web-cad/cad-protocol";

/** SVG geometry uses the workbench's model X / negative model Y convention. */
export function DrawingDimensionGlyph({
  entity,
  entities,
  units,
  size = 3.5,
  layer
}: {
  entity: DrawingDimension;
  entities: ReadonlyMap<string, DrawingEntity>;
  units: DocumentUnits;
  size?: number;
  layer?: DrawingLayer;
}) {
  const appearance = layer ? drawingLayerAppearance(layer) : undefined;
  const geometry = resolveDrawingDimension(entity, entities);
  if (!geometry) return null;
  const { first, second, start, end, value, labelPosition } = geometry;
  const path = `M ${first[0]} ${-first[1]} L ${start[0]} ${-start[1]} L ${end[0]} ${-end[1]} L ${second[0]} ${-second[1]}`;
  const tick = size * 0.3;
  return (
    <g
      data-drawing-dimension={entity.id}
      data-dimension-value={value}
      style={layer ? { color: layer.color } : undefined}
    >
      <path
        d={path}
        stroke="transparent"
        fill="none"
        strokeWidth={14}
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
      />
      <path
        d={path}
        stroke="currentColor"
        fill="none"
        strokeWidth={appearance?.strokeWidth ?? 1}
        strokeDasharray={appearance?.strokeDasharray}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {[start, end].map((p, i) => (
        <path
          key={i}
          d={`M ${p[0] - tick} ${-p[1] + tick} l ${tick * 2} ${-tick * 2}`}
          stroke="currentColor"
          strokeWidth={appearance?.strokeWidth ?? 1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <text
        x={labelPosition[0]}
        y={-labelPosition[1] - size * 0.3}
        textAnchor="middle"
        fontSize={size}
        fill="currentColor"
        stroke="var(--drawing-label-background, #101923)"
        strokeWidth={size * 0.15}
        paintOrder="stroke"
        data-dimension-label
      >
        {Number(value.toPrecision(10))} {units}
      </text>
    </g>
  );
}
