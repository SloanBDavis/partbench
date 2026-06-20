import type {
  SketchEntitySnapshot,
  SketchSnapshot,
  Vec2
} from "@web-cad/cad-protocol";
import type {
  RenderCamera,
  ViewportPoint,
  ViewportSize
} from "@web-cad/renderer";
import { projectPoint } from "@web-cad/renderer";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  applySketchViewportDrag,
  createSketchViewportDragHandles,
  createSketchViewportProjectionBasis,
  mapViewportDeltaToSketchDelta,
  type SketchViewportDragHandle
} from "../sketchViewportDrag";
import {
  createDefaultSketchDisplayFrame,
  mapSketchPointToDisplayFrame,
  type SketchDisplayFrame
} from "../sketchDisplayFrames";

export function SketchViewportDragOverlay({
  camera,
  disabled = false,
  displayFrame,
  selectedEntityId,
  size,
  sketch,
  onCommitEntity,
  onPreviewEntity
}: {
  readonly camera: RenderCamera;
  readonly disabled?: boolean;
  readonly displayFrame?: SketchDisplayFrame;
  readonly selectedEntityId?: string;
  readonly size: ViewportSize;
  readonly sketch: SketchSnapshot;
  readonly onCommitEntity: (
    sketchId: string,
    entity: SketchEntitySnapshot
  ) => void | Promise<void>;
  readonly onPreviewEntity?: (
    sketchId: string,
    entity: SketchEntitySnapshot
  ) => boolean | Promise<boolean>;
}) {
  const frame = displayFrame ?? createDefaultSketchDisplayFrame(sketch.plane);
  const previewSequenceRef = useRef(0);
  const basis = useMemo(
    () =>
      createSketchViewportProjectionBasis({
        camera,
        displayFrame: frame,
        size
      }),
    [camera, frame, size]
  );
  const [drag, setDrag] = useState<
    | {
        readonly pointerId: number;
        readonly handle: SketchViewportDragHandle;
        readonly startClientPoint: ViewportPoint;
        readonly startEntity: SketchEntitySnapshot;
        readonly previewEntity: SketchEntitySnapshot;
        readonly moved: boolean;
        readonly previewSequence: number;
        readonly previewStatus: "valid" | "pending" | "invalid";
      }
    | undefined
  >();
  const displaySketch = useMemo(
    () =>
      drag
        ? {
            ...sketch,
            entities: sketch.entities.map((entity) =>
              entity.id === drag.previewEntity.id ? drag.previewEntity : entity
            )
          }
        : sketch,
    [drag, sketch]
  );
  const handles = useMemo(
    () =>
      createSketchViewportDragHandles({
        camera,
        displayFrame: frame,
        selectedEntityId,
        size,
        sketch: displaySketch
      }),
    [camera, displaySketch, frame, selectedEntityId, size]
  );
  const preview = drag?.previewEntity;

  useEffect(() => {
    if (!drag) {
      return undefined;
    }

    const move = (event: PointerEvent) => {
      moveDragFromPoint(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });
    };
    const finish = (event: PointerEvent) => {
      void finishDragFromPointer(event.pointerId);
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId === drag.pointerId) {
        setDrag(undefined);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  });

  if (disabled || !selectedEntityId || handles.length === 0 || !basis) {
    return null;
  }

  return (
    <svg
      aria-label="Sketch drag handles"
      className="sketch-drag-overlay"
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      width={size.width}
    >
      {preview && (
        <SketchPreviewEntity
          camera={camera}
          displayFrame={frame}
          entity={preview}
          status={drag.previewStatus}
          size={size}
        />
      )}
      {handles.map((handle) => (
        <g key={handle.id}>
          <circle
            aria-label={`Drag ${handle.label}`}
            className={`sketch-drag-handle sketch-drag-handle-${handle.kind}`}
            cx={handle.screenPoint.x}
            cy={handle.screenPoint.y}
            onPointerCancel={cancelDrag}
            onPointerDown={(event) => startDrag(event, handle)}
            r={handle.kind === "circleRadius" ? 5 : 6}
            role="button"
            tabIndex={0}
          />
          <title>{handle.label}</title>
        </g>
      ))}
    </svg>
  );

  function startDrag(
    event: ReactPointerEvent<SVGCircleElement>,
    handle: SketchViewportDragHandle
  ) {
    if (!basis) {
      return;
    }

    const entity = sketch.entities.find(
      (candidate) => candidate.id === handle.entityId
    );

    if (!entity) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDrag({
      pointerId: event.pointerId,
      handle,
      startClientPoint: { x: event.clientX, y: event.clientY },
      startEntity: entity,
      previewEntity: entity,
      moved: false,
      previewSequence: previewSequenceRef.current,
      previewStatus: "valid"
    });
  }

  function moveDragFromPoint(pointerId: number, clientPoint: ViewportPoint) {
    if (!drag || drag.pointerId !== pointerId || !basis) {
      return;
    }

    const sketchDelta = mapViewportDeltaToSketchDelta(basis, {
      x: clientPoint.x - drag.startClientPoint.x,
      y: clientPoint.y - drag.startClientPoint.y
    });

    if (!sketchDelta) {
      return;
    }

    const activePointerId = drag.pointerId;
    const previewSequence = previewSequenceRef.current + 1;
    const previewEntity = applySketchViewportDrag(
      drag.startEntity,
      drag.handle,
      addVec2(drag.handle.sketchPoint, sketchDelta)
    );
    previewSequenceRef.current = previewSequence;
    setDrag({
      ...drag,
      moved: true,
      previewEntity,
      previewSequence,
      previewStatus: onPreviewEntity ? "pending" : "valid"
    });

    if (onPreviewEntity) {
      void Promise.resolve(onPreviewEntity(sketch.id, previewEntity)).then(
        (valid) => {
          setDrag((current) =>
            current?.pointerId === activePointerId &&
            current.previewSequence === previewSequence
              ? {
                  ...current,
                  previewStatus: valid ? "valid" : "invalid"
                }
              : current
          );
        },
        () => {
          setDrag((current) =>
            current?.pointerId === activePointerId &&
            current.previewSequence === previewSequence
              ? { ...current, previewStatus: "invalid" }
              : current
          );
        }
      );
    }
  }

  async function finishDragFromPointer(pointerId: number) {
    if (!drag || drag.pointerId !== pointerId) {
      return;
    }

    setDrag(undefined);
    if (!drag.moved) {
      return;
    }

    const valid =
      drag.previewStatus === "valid" ||
      (onPreviewEntity
        ? await Promise.resolve(
            onPreviewEntity(sketch.id, drag.previewEntity)
          ).catch(() => false)
        : true);

    if (valid) {
      await onCommitEntity(sketch.id, drag.previewEntity);
    }
  }

  function cancelDrag(event: ReactPointerEvent<SVGCircleElement>) {
    if (drag?.pointerId === event.pointerId) {
      setDrag(undefined);
    }
  }
}

function SketchPreviewEntity({
  camera,
  displayFrame,
  entity,
  status,
  size
}: {
  readonly camera: RenderCamera;
  readonly displayFrame: SketchDisplayFrame;
  readonly entity: SketchEntitySnapshot;
  readonly status: "valid" | "pending" | "invalid";
  readonly size: ViewportSize;
}) {
  const className = `sketch-drag-preview sketch-drag-preview-${status}`;

  if (entity.kind === "line") {
    const start = createScreenPoint(entity.start, displayFrame, camera, size);
    const end = createScreenPoint(entity.end, displayFrame, camera, size);

    return start && end ? (
      <line
        className={className}
        x1={start.x}
        x2={end.x}
        y1={start.y}
        y2={end.y}
      />
    ) : null;
  }

  if (entity.kind === "circle") {
    const center = createScreenPoint(entity.center, displayFrame, camera, size);
    const radiusPoint = createScreenPoint(
      [entity.center[0] + entity.radius, entity.center[1]],
      displayFrame,
      camera,
      size
    );

    return center && radiusPoint ? (
      <circle
        className={className}
        cx={center.x}
        cy={center.y}
        r={Math.hypot(center.x - radiusPoint.x, center.y - radiusPoint.y)}
      />
    ) : null;
  }

  if (entity.kind === "point") {
    const point = createScreenPoint(entity.point, displayFrame, camera, size);

    return point ? (
      <circle className={className} cx={point.x} cy={point.y} r={8} />
    ) : null;
  }

  return null;
}

function createScreenPoint(
  point: Vec2,
  displayFrame: SketchDisplayFrame,
  camera: RenderCamera,
  size: ViewportSize
): ViewportPoint | undefined {
  const projected = projectPoint(
    mapSketchPointToDisplayFrame(displayFrame, point),
    camera,
    size
  );

  return projected ? { x: projected.x, y: projected.y } : undefined;
}

function addVec2(left: Vec2, right: Vec2): Vec2 {
  return [left[0] + right[0], left[1] + right[1]];
}
