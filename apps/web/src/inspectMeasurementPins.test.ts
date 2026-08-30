import { describe, expect, it } from "vitest";
import {
  bindExactInspectionTarget,
  measureExactInspectionSingle,
  type ExactInspectionArtifact,
  type ExactInspectionIdentity
} from "./exactInspectionMeasurement";
import {
  MAX_INSPECT_MEASUREMENT_PINS,
  clearInspectMeasurementPins,
  inspectMeasurementPinRows,
  pinExactInspectionResult,
  refreshInspectMeasurementPins
} from "./inspectMeasurementPins";

const ARTIFACT: ExactInspectionArtifact = {
  bodyId: "body_box",
  bodySourceIdentitySignature: "src-1",
  topologySignature: "topo-1",
  metadata: {
    volume: 24,
    surfaceArea: 52,
    centroid: [0, 0, 0],
    bounds: { min: [0, 0, 0], max: [1, 1, 1] }
  },
  entities: []
};

const BODY: ExactInspectionIdentity = {
  bodyId: "body_box",
  bodySourceIdentitySignature: "src-1",
  topologySignature: "topo-1",
  entityKind: "body"
};

describe("inspect measurement pins", () => {
  it("pins a session readout and marks it stale after identity change", () => {
    const result = measureExactInspectionSingle(
      bindExactInspectionTarget(BODY, [ARTIFACT], "Box"),
      "mm"
    );
    const pinned = pinExactInspectionResult([], "Box", [BODY], result);
    const stale = refreshInspectMeasurementPins(
      pinned,
      [{ ...ARTIFACT, topologySignature: "topo-2" }],
      "mm"
    );

    expect(pinned[0]?.stale).toBe(false);
    expect(stale[0]?.stale).toBe(true);
    expect(inspectMeasurementPinRows(stale[0]!)[0]?.value).toContain("Stale");
    expect(clearInspectMeasurementPins()).toEqual([]);
  });

  it("keeps at most 32 session pins", () => {
    let pins = pinExactInspectionResult(
      [],
      "Box",
      [BODY],
      measureExactInspectionSingle(bindExactInspectionTarget(BODY, [ARTIFACT]), "mm")
    );
    for (let index = 0; index < MAX_INSPECT_MEASUREMENT_PINS + 4; index += 1) {
      pins = pinExactInspectionResult(
        pins,
        `Pin ${index}`,
        [BODY],
        measureExactInspectionSingle(bindExactInspectionTarget(BODY, [ARTIFACT]), "mm"),
        `pin-${index}`
      );
    }
    expect(pins).toHaveLength(MAX_INSPECT_MEASUREMENT_PINS);
  });
});
