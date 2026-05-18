import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot
} from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import {
  createPrimitiveDerivedGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource
} from "./derivedGeometry";
import {
  createAttachedSketchDisplayFrame,
  createGeneratedFaceReferenceKey,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

export function createDerivedGeometrySourcesFromDocument(
  document: CadDocument,
  features: readonly CadFeatureSummary[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map()
): readonly DerivedGeometrySource[] {
  const sketches = [...document.sketches.values()].map((sketch) => ({
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    attachment: sketch.attachment,
    entities: [...sketch.entities.values()]
  }));

  return [
    ...[...document.objects.values()].map(createPrimitiveDerivedGeometrySource),
    ...createExtrudeDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey
    )
  ];
}

export function createExtrudeDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map()
): readonly DerivedExtrudeGeometrySource[] {
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
        feature.kind === "extrude"
    )
    .flatMap((feature) => {
      const sketch = sketches.find(
        (candidate) => candidate.id === feature.sketchId
      );
      const entity = sketch?.entities.find(
        (candidate) => candidate.id === feature.entityId
      );

      if (!sketch || !entity) {
        return [];
      }

      const placement = createAttachedSketchExtrudePlacement(
        sketch,
        generatedFacesByKey
      );

      if (entity.kind === "rectangle") {
        const source: DerivedExtrudeGeometrySource = {
          id: feature.bodyId,
          kind: "extrude",
          sketchPlane: sketch.plane,
          profile: {
            kind: entity.kind,
            center: entity.center,
            width: entity.width,
            height: entity.height
          },
          depth: feature.depth,
          side: feature.side,
          ...placement
        };

        return [source];
      }

      if (entity.kind === "circle") {
        const source: DerivedExtrudeGeometrySource = {
          id: feature.bodyId,
          kind: "extrude",
          sketchPlane: sketch.plane,
          profile: {
            kind: entity.kind,
            center: entity.center,
            radius: entity.radius
          },
          depth: feature.depth,
          side: feature.side,
          ...placement
        };

        return [source];
      }

      return [];
    });
}

function createAttachedSketchExtrudePlacement(
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): {
  readonly placementFrame?: SketchDisplayFrame;
  readonly placementError?: string;
} {
  const attachment = sketch.attachment;

  if (!attachment) {
    return {};
  }

  const face = generatedFacesByKey.get(
    createGeneratedFaceReferenceKey(attachment.bodyId, attachment.faceStableId)
  );

  if (!face) {
    return {
      placementError: `Attachment unresolved for ${sketch.name}; derived extrude mesh is unavailable.`
    };
  }

  const frame = createAttachedSketchDisplayFrame(sketch, face, 0);

  if (!frame) {
    return {
      placementError: `Attachment face cannot place ${sketch.name}; derived extrude mesh is unavailable.`
    };
  }

  return { placementFrame: frame };
}
