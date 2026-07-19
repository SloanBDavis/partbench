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

interface SketchViewportDragState {
  readonly pointerId: number;
  readonly handle: SketchViewportDragHandle;
  readonly startClientPoint: ViewportPoint;
  readonly startEntity: SketchEntitySnapshot;
  readonly previewEntity: SketchEntitySnapshot;
  readonly moved: boolean;
  readonly previewSequence: number;
  readonly previewStatus: "valid" | "pending" | "invalid";
}

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
  const [drag, setDrag] = useState<SketchViewportDragState | undefined>();
  const dragRef = useRef<SketchViewportDragState | undefined>(undefined);
  const basisRef = useRef(basis);
  basisRef.current = basis;
  const latestInputsRef = useRef({ onCommitEntity, onPreviewEntity, sketch });
  latestInputsRef.current = { onCommitEntity, onPreviewEntity, sketch };
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
    if (!dragRef.current) {
      return undefined;
    }

    let moveFrameId: number | undefined;
    let pendingMove:
      | { readonly pointerId: number; readonly point: ViewportPoint }
      | undefined;

    const flushMove = () => {
      moveFrameId = undefined;
      const move = pendingMove;
      pendingMove = undefined;

      if (move) {
        moveDragFromPoint(move.pointerId, move.point);
      }
    };

    const move = (event: PointerEvent) => {
      if (event.pointerId !== dragRef.current?.pointerId) {
        return;
      }

      pendingMove = {
        pointerId: event.pointerId,
        point: { x: event.clientX, y: event.clientY }
      };
      if (moveFrameId === undefined) {
        moveFrameId = window.requestAnimationFrame(flushMove);
      }
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== dragRef.current?.pointerId) {
        return;
      }

      if (moveFrameId !== undefined) {
        window.cancelAnimationFrame(moveFrameId);
      }
      flushMove();
      void finishDragFromPointer(event.pointerId);
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId === dragRef.current?.pointerId) {
        clearDrag();
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      if (moveFrameId !== undefined) {
        window.cancelAnimationFrame(moveFrameId);
      }
      pendingMove = undefined;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag?.pointerId]);

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
    setCurrentDrag({
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
    const currentDrag = dragRef.current;
    const currentBasis = basisRef.current;

    if (!currentDrag || currentDrag.pointerId !== pointerId || !currentBasis) {
      return;
    }

    const sketchDelta = mapViewportDeltaToSketchDelta(currentBasis, {
      x: clientPoint.x - currentDrag.startClientPoint.x,
      y: clientPoint.y - currentDrag.startClientPoint.y
    });

    if (!sketchDelta) {
      return;
    }

    const activePointerId = currentDrag.pointerId;
    const previewSequence = previewSequenceRef.current + 1;
    const previewEntity = applySketchViewportDrag(
      currentDrag.startEntity,
      currentDrag.handle,
      addVec2(currentDrag.handle.sketchPoint, sketchDelta)
    );
    const inputs = latestInputsRef.current;
    previewSequenceRef.current = previewSequence;
    setCurrentDrag({
      ...currentDrag,
      moved: true,
      previewEntity,
      previewSequence,
      previewStatus: inputs.onPreviewEntity ? "pending" : "valid"
    });

    if (inputs.onPreviewEntity) {
      void Promise.resolve(
        inputs.onPreviewEntity(inputs.sketch.id, previewEntity)
      ).then(
        (valid) => {
          const current = dragRef.current;
          if (
            current?.pointerId === activePointerId &&
            current.previewSequence === previewSequence
          ) {
            setCurrentDrag({
              ...current,
              previewStatus: valid ? "valid" : "invalid"
            });
          }
        },
        () => {
          const current = dragRef.current;
          if (
            current?.pointerId === activePointerId &&
            current.previewSequence === previewSequence
          ) {
            setCurrentDrag({ ...current, previewStatus: "invalid" });
          }
        }
      );
    }
  }

  async function finishDragFromPointer(pointerId: number) {
    const currentDrag = dragRef.current;

    if (!currentDrag || currentDrag.pointerId !== pointerId) {
      return;
    }

    clearDrag();
    if (!currentDrag.moved) {
      return;
    }

    const inputs = latestInputsRef.current;
    const valid =
      currentDrag.previewStatus === "valid" ||
      (inputs.onPreviewEntity
        ? await Promise.resolve(
            inputs.onPreviewEntity(inputs.sketch.id, currentDrag.previewEntity)
          ).catch(() => false)
        : true);

    if (valid) {
      await inputs.onCommitEntity(
        inputs.sketch.id,
        currentDrag.previewEntity
      );
    }
  }

  function cancelDrag(event: ReactPointerEvent<SVGCircleElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      clearDrag();
    }
  }

  function setCurrentDrag(nextDrag: SketchViewportDragState): void {
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function clearDrag(): void {
    dragRef.current = undefined;
    setDrag(undefined);
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
