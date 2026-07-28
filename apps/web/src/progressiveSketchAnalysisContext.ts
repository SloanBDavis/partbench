import type {
  SketchEvaluationQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchSolverStatusQueryResponse
} from "@web-cad/cad-protocol";
import { createContext, useContext } from "react";

export interface ProgressiveSketchAnalysis {
  readonly evaluationsBySketchId: ReadonlyMap<
    string,
    SketchEvaluationQueryResponse
  >;
  readonly solverStatusesBySketchId: ReadonlyMap<
    string,
    SketchSolverStatusQueryResponse
  >;
  readonly pathCandidatesBySketchId: ReadonlyMap<
    string,
    SketchPathCandidatesQueryResponse
  >;
}

export const EMPTY_PROGRESSIVE_SKETCH_ANALYSIS: ProgressiveSketchAnalysis = {
  evaluationsBySketchId: new Map(),
  solverStatusesBySketchId: new Map(),
  pathCandidatesBySketchId: new Map()
};

export const ProgressiveSketchAnalysisContext =
  createContext<ProgressiveSketchAnalysis>(EMPTY_PROGRESSIVE_SKETCH_ANALYSIS);

export function useProgressiveSketchAnalysis(): ProgressiveSketchAnalysis {
  return useContext(ProgressiveSketchAnalysisContext);
}
