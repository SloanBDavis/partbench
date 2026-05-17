import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot
} from "@web-cad/cad-core";
import {
  createPrimitiveDerivedGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource
} from "./derivedGeometry";

export function createDerivedGeometrySourcesFromDocument(
  document: CadDocument,
  features: readonly CadFeatureSummary[]
): readonly DerivedGeometrySource[] {
  const sketches = [...document.sketches.values()].map((sketch) => ({
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    entities: [...sketch.entities.values()]
  }));

  return [
    ...[...document.objects.values()].map(createPrimitiveDerivedGeometrySource),
    ...createExtrudeDerivedGeometrySources(features, sketches)
  ];
}

export function createExtrudeDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[]
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
          side: feature.side
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
          side: feature.side
        };

        return [source];
      }

      return [];
    });
}
