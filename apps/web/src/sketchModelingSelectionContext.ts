import type {
  SketchDimensionEntry,
  SketchEvaluationQueryResponse,
  SketchSnapshot,
  SketchSolverStatusQueryResponse
} from "@web-cad/cad-protocol";
import type { ModelingSelectionContext } from "./modelingActions";
import type { SketchPanelSelectionContext } from "./sketchPanelUi";
import {
  createSketchEntitySelectionId,
  createSketchSelectionId
} from "./sketchRenderIds";

export function createSketchModelingSelectionContext({
  focusedSketchId,
  selectedId,
  selectedSketchContext,
  sketchDimensionsBySketchId,
  sketchEvaluationsBySketchId,
  sketchSolverStatusesBySketchId,
  sketches
}: {
  readonly focusedSketchId?: string;
  readonly selectedId?: string;
  readonly selectedSketchContext?: SketchPanelSelectionContext;
  readonly sketchDimensionsBySketchId: ReadonlyMap<
    string,
    readonly SketchDimensionEntry[]
  >;
  readonly sketchEvaluationsBySketchId: ReadonlyMap<
    string,
    SketchEvaluationQueryResponse
  >;
  readonly sketchSolverStatusesBySketchId: ReadonlyMap<
    string,
    SketchSolverStatusQueryResponse
  >;
  readonly sketches: readonly SketchSnapshot[];
}): ModelingSelectionContext | undefined {
  if (selectedSketchContext) {
    const sketch = sketches.find(
      (candidate) => candidate.id === selectedSketchContext.sketchId
    );
    const entity = sketch?.entities.find(
      (candidate) => candidate.id === selectedSketchContext.entityId
    );

    if (sketch && entity) {
      const evaluation = sketchEvaluationsBySketchId.get(sketch.id);
      const solverStatus = sketchSolverStatusesBySketchId.get(sketch.id);

      return {
        selectionKind: "sketchEntity",
        sketch,
        entity,
        dimensions:
          evaluation?.dimensions ?? sketchDimensionsBySketchId.get(sketch.id),
        constraints: evaluation?.constraints,
        solverStatus
      };
    }

    if (sketch) {
      return {
        selectionKind: "sketch",
        sketch,
        solverStatus: sketchSolverStatusesBySketchId.get(sketch.id)
      };
    }
  }

  if (selectedId) {
    for (const sketch of sketches) {
      for (const entity of sketch.entities) {
        if (
          selectedId === createSketchEntitySelectionId(sketch.id, entity.id)
        ) {
          const evaluation = sketchEvaluationsBySketchId.get(sketch.id);
          const solverStatus = sketchSolverStatusesBySketchId.get(sketch.id);

          return {
            selectionKind: "sketchEntity",
            sketch,
            entity,
            dimensions:
              evaluation?.dimensions ??
              sketchDimensionsBySketchId.get(sketch.id),
            constraints: evaluation?.constraints,
            solverStatus
          };
        }
      }

      if (selectedId === createSketchSelectionId(sketch.id)) {
        return {
          selectionKind: "sketch",
          sketch,
          solverStatus: sketchSolverStatusesBySketchId.get(sketch.id)
        };
      }
    }
  }

  const focusedSketch = focusedSketchId
    ? sketches.find((sketch) => sketch.id === focusedSketchId)
    : undefined;

  return focusedSketch
    ? {
        selectionKind: "sketch",
        sketch: focusedSketch,
        solverStatus: sketchSolverStatusesBySketchId.get(focusedSketch.id)
      }
    : undefined;
}
