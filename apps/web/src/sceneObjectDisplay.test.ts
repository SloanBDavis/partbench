import type {
  BoxObject,
  ConeObject,
  CylinderObject,
  SphereObject,
  TorusObject
} from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  formatBounds,
  formatArea,
  formatBodyMeasurementError,
  formatBodyMeasurementConfidence,
  formatBodyTopologyCounts,
  formatBodyTopologyError,
  formatBodyTopologyModel,
  formatBodyTopologyStatus,
  formatDimensions,
  getObjectDisplayName,
  formatObjectKind,
  formatObjectPosition,
  formatObjectScale,
  formatVector,
  formatVolume
} from "./sceneObjectDisplay";

describe("scene object display helpers", () => {
  it("formats object kinds and dimensions for object lists and inspector", () => {
    expect(formatObjectKind("box")).toBe("Box");
    expect(formatObjectKind("cylinder")).toBe("Cylinder");
    expect(formatObjectKind("sphere")).toBe("Sphere");
    expect(formatObjectKind("cone")).toBe("Cone");
    expect(formatObjectKind("torus")).toBe("Torus");
    expect(formatDimensions(createBoxObject())).toBe("2 x 3.25 x 4");
    expect(formatDimensions(createBoxObject(), "mm")).toBe("2 x 3.25 x 4 mm");
    expect(formatDimensions(createCylinderObject())).toBe("r 1.50, h 4");
    expect(formatDimensions(createCylinderObject(), "in")).toBe(
      "r 1.50 in, h 4 in"
    );
    expect(formatDimensions(createSphereObject(), "cm")).toBe("r 2.25 cm");
    expect(formatDimensions(createConeObject(), "mm")).toBe(
      "r 1.50 mm, h 4 mm"
    );
    expect(formatDimensions(createTorusObject(), "mm")).toBe(
      "R 3 mm, r 0.50 mm"
    );
    expect(getObjectDisplayName(createBoxObject())).toBe("box_1");
    expect(getObjectDisplayName({ ...createBoxObject(), name: "Base" })).toBe(
      "Base"
    );
  });

  it("formats transform values compactly", () => {
    const object = createBoxObject();

    expect(formatVector([1, 2.345, 3])).toBe("1, 2.35, 3");
    expect(formatObjectPosition(object)).toBe("pos 1, 2.35, 3");
    expect(formatObjectScale(object)).toBe("scale 1, 1, 2");
  });

  it("formats measurement values", () => {
    expect(
      formatBounds(
        {
          min: [-1, -2.345, -3],
          max: [1, 2.345, 3],
          size: [2, 4.69, 6],
          center: [0, 0, 0]
        },
        "mm"
      )
    ).toBe(
      "min -1 mm, -2.35 mm, -3 mm; max 1 mm, 2.35 mm, 3 mm; size 2 mm, 4.69 mm, 6 mm"
    );
    expect(formatVolume(12.345, "mm")).toBe("12.35 mm^3");
    expect(formatArea(12.345, "mm")).toBe("12.35 mm^2");
  });

  it("formats body measurement errors clearly", () => {
    expect(
      formatBodyMeasurementError({
        code: "BODY_NOT_FOUND",
        message: "Body not found.",
        bodyId: "missing_body"
      })
    ).toBe("Body measurements unavailable: missing_body was not found.");

    expect(
      formatBodyMeasurementError({
        code: "UNSUPPORTED_BODY_MEASUREMENTS",
        message: "Body measurements are not supported.",
        bodyId: "body:box_1"
      })
    ).toBe(
      "Body measurements unavailable for body:box_1. Authored rectangle and circle extrude bodies are supported."
    );
  });

  it("formats body topology status and confidence", () => {
    const topology = {
      bodyId: "body_1",
      units: "mm",
      status: "healthy",
      sourceKind: "authoredExtrude",
      sourceIdentity: {
        bodyId: "body_1",
        sourceKind: "authoredExtrude",
        cacheKey: "topology:key",
        units: "mm"
      },
      topologyModel: "semantic-source",
      topologyAvailable: true,
      exactGeometryAvailable: false,
      exactMeasurementsAvailable: true,
      measurementConfidence: "source-analytic",
      faceCount: 6,
      edgeCount: 12,
      vertexCount: 8,
      issues: []
    } as const;

    expect(formatBodyTopologyStatus(topology.status)).toBe("Healthy");
    expect(formatBodyTopologyModel(topology)).toBe("Semantic source");
    expect(formatBodyTopologyCounts(topology)).toBe(
      "6 faces, 12 edges, 8 vertices"
    );
    expect(formatBodyMeasurementConfidence(topology)).toBe("Source analytic");
  });

  it("formats body topology errors clearly", () => {
    expect(
      formatBodyTopologyError({
        code: "BODY_NOT_FOUND",
        message: "Body not found.",
        bodyId: "missing_body"
      })
    ).toBe("Body topology unavailable: missing_body was not found.");

    expect(
      formatBodyTopologyError({
        code: "UNSUPPORTED_BODY_TOPOLOGY",
        message: "Topology is not supported.",
        bodyId: "body:box_1"
      })
    ).toBe("Body topology unavailable for body:box_1.");
  });
});

function createBoxObject(): BoxObject {
  return {
    id: "box_1",
    kind: "box",
    dimensions: {
      width: 2,
      height: 3.25,
      depth: 4
    },
    transform: {
      translation: [1, 2.345, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 2]
    }
  };
}

function createCylinderObject(): CylinderObject {
  return {
    id: "cylinder_1",
    kind: "cylinder",
    dimensions: {
      radius: 1.5,
      height: 4
    },
    transform: {
      translation: [0, 0, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createSphereObject(): SphereObject {
  return {
    id: "sphere_1",
    kind: "sphere",
    dimensions: {
      radius: 2.25
    },
    transform: {
      translation: [0, 0, 2.25],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createConeObject(): ConeObject {
  return {
    id: "cone_1",
    kind: "cone",
    dimensions: {
      radius: 1.5,
      height: 4
    },
    transform: {
      translation: [0, 0, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createTorusObject(): TorusObject {
  return {
    id: "torus_1",
    kind: "torus",
    dimensions: {
      majorRadius: 3,
      minorRadius: 0.5
    },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}
