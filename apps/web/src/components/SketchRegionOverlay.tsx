import { memo, useMemo } from "react";
import type {
  SketchProfileRegionCandidate,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type { RenderCamera, ViewportSize } from "@web-cad/renderer";
import type { SketchDisplayFrame } from "../sketchDisplayFrames";
import {
  createRegionScreenPathFromEntityIndex,
  createSketchRegionEntityIndex
} from "./sketchRegionOverlayModel";

const REGION_OVERLAY_PREVIEW_LIMIT = 12;

export function SketchRegionOverlay({
  camera,
  candidates,
  displayFrame,
  hoveredCandidateKey,
  selectedCandidateKeys,
  size,
  sketch,
  onHoverCandidate,
  onSelectCandidate
}: {
  readonly camera: RenderCamera;
  readonly candidates: readonly SketchProfileRegionCandidate[];
  readonly displayFrame: SketchDisplayFrame;
  readonly hoveredCandidateKey?: string;
  readonly selectedCandidateKeys: readonly string[];
  readonly size: ViewportSize;
  readonly sketch: SketchSnapshot;
  readonly onHoverCandidate: (candidateKey: string | undefined) => void;
  readonly onSelectCandidate: (candidateKey: string) => void;
}) {
  const projectionCache = useMemo(
    () => ({
      camera,
      displayFrame,
      entities: createSketchRegionEntityIndex(sketch),
      paths: new Map<string, string | undefined>(),
      size: { height: size.height, width: size.width }
    }),
    [camera, displayFrame, size.height, size.width, sketch]
  );
  const selectedKeys = useMemo(
    () => new Set(selectedCandidateKeys),
    [selectedCandidateKeys]
  );
  const overlayCandidates = useMemo(() => {
    const previewKeys = new Set(
      candidates
        .slice(0, REGION_OVERLAY_PREVIEW_LIMIT)
        .map((candidate) => candidate.candidateKey)
    );
    if (hoveredCandidateKey) previewKeys.add(hoveredCandidateKey);
    for (const key of selectedKeys) previewKeys.add(key);
    return candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => previewKeys.has(candidate.candidateKey));
  }, [candidates, hoveredCandidateKey, selectedKeys]);
  const candidatePaths = useMemo(() => {
    const paths = new Map<string, string>();
    for (const { candidate } of overlayCandidates) {
      if (candidate.status !== "valid") continue;
      if (!projectionCache.paths.has(candidate.candidateKey)) {
        projectionCache.paths.set(
          candidate.candidateKey,
          createRegionScreenPathFromEntityIndex(
            candidate,
            projectionCache.entities,
            projectionCache.displayFrame,
            projectionCache.camera,
            projectionCache.size
          )
        );
      }
      const path = projectionCache.paths.get(candidate.candidateKey);
      if (path) paths.set(candidate.candidateKey, path);
    }
    return paths;
  }, [overlayCandidates, projectionCache]);

  return (
    <div
      className="sketch-region-layer"
      aria-label="Material region selection overlay"
      data-testid="v19-sketch-region-overlay"
    >
      <svg
        className="sketch-region-overlay"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
      >
        {overlayCandidates.map(({ candidate, index }) => {
          const path = candidatePaths.get(candidate.candidateKey);
          if (!path) return null;
          return (
            <SketchRegionCell
              key={candidate.candidateKey}
              candidateKey={candidate.candidateKey}
              index={index}
              path={path}
              selected={selectedKeys.has(candidate.candidateKey)}
              hovered={hoveredCandidateKey === candidate.candidateKey}
              onHoverCandidate={onHoverCandidate}
              onSelectCandidate={onSelectCandidate}
            />
          );
        })}
      </svg>
    </div>
  );
}

const SketchRegionCell = memo(function SketchRegionCell({
  candidateKey,
  index,
  path,
  selected,
  hovered,
  onHoverCandidate,
  onSelectCandidate
}: {
  readonly candidateKey: string;
  readonly index: number;
  readonly path: string;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly onHoverCandidate: (candidateKey: string | undefined) => void;
  readonly onSelectCandidate: (candidateKey: string) => void;
}) {
  return (
    <path
      className={[
        "sketch-region-cell",
        selected ? "sketch-region-cell-selected" : undefined,
        hovered ? "sketch-region-cell-hovered" : undefined
      ]
        .filter(Boolean)
        .join(" ")}
      d={path}
      fillRule="evenodd"
      aria-label={`Material region ${index + 1}`}
      data-candidate-key={candidateKey}
      onPointerEnter={() => onHoverCandidate(candidateKey)}
      onPointerLeave={() => onHoverCandidate(undefined)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectCandidate(candidateKey);
      }}
    />
  );
});
