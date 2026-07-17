import type {
  SketchConstraintEntry,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { createSketchConstraintInferenceCandidates } from "./sketchConstraintInference";

describe("createSketchConstraintInferenceCandidates", () => {
  it("infers a horizontal candidate for a nearly horizontal line", () => {
    const line = createLine("line_1", [0, 0], [10, 0.2]);
    const [candidate] = createSketchConstraintInferenceCandidates({
      entity: line,
      sketchEntities: [line],
      constraints: []
    });

    expect(candidate).toMatchObject({
      id: "constraint-inference:horizontal:line_1",
      kind: "horizontal",
      label: "Horizontal",
      confidence: "strong",
      relatedEntityIds: ["line_1"],
      form: {
        id: "",
        name: "Horizontal",
        kind: "horizontal",
        secondaryEntityId: ""
      }
    });
  });

  it("infers a vertical candidate for a nearly vertical line", () => {
    const line = createLine("line_1", [0, 0], [0.1, 10]);

    expect(
      createSketchConstraintInferenceCandidates({
        entity: line,
        sketchEntities: [line],
        constraints: []
      }).map((candidate) => candidate.kind)
    ).toEqual(["vertical"]);
  });

  it("suppresses an axis candidate when the matching constraint already exists", () => {
    const line = createLine("line_1", [0, 0], [10, 0]);

    expect(
      createSketchConstraintInferenceCandidates({
        entity: line,
        sketchEntities: [line],
        constraints: [
          createAxisConstraint("constraint_1", "horizontal", line.id)
        ]
      })
    ).toEqual([]);
  });

  it("infers parallel and perpendicular candidates against other lines", () => {
    const primary = createLine("line_1", [0, 0], [10, 0]);
    const parallel = createLine("line_2", [0, 2], [5, 2.1]);
    const perpendicular = createLine("line_3", [1, 0], [1.1, 5]);

    expect(
      createSketchConstraintInferenceCandidates({
        entity: primary,
        sketchEntities: [primary, parallel, perpendicular],
        constraints: [],
        maxCandidates: 10
      }).map((candidate) => [candidate.kind, candidate.form.secondaryEntityId])
    ).toEqual([
      ["horizontal", ""],
      ["parallel", "line_2"],
      ["perpendicular", "line_3"]
    ]);
  });

  it("suppresses duplicate line-pair candidates for existing ordered source records", () => {
    const primary = createLine("line_1", [0, 0], [10, 0]);
    const other = createLine("line_2", [0, 2], [5, 2]);

    expect(
      createSketchConstraintInferenceCandidates({
        entity: primary,
        sketchEntities: [primary, other],
        constraints: [
          createLinePairConstraint(
            "constraint_1",
            "parallel",
            primary.id,
            other.id
          )
        ],
        maxCandidates: 10
      }).map((candidate) => candidate.kind)
    ).toEqual(["horizontal"]);
  });

  it("ignores zero-length and non-line entities", () => {
    const zeroLine = createLine("line_1", [1, 1], [1, 1]);
    const circle: SketchEntitySnapshot = {
      id: "circle_1",
      kind: "circle",
      construction: false,
      center: [0, 0],
      radius: 1
    };

    expect(
      createSketchConstraintInferenceCandidates({
        entity: zeroLine,
        sketchEntities: [zeroLine],
        constraints: []
      })
    ).toEqual([]);
    expect(
      createSketchConstraintInferenceCandidates({
        entity: circle,
        sketchEntities: [circle],
        constraints: []
      })
    ).toEqual([]);
  });

  it("keeps candidates source-entity based without private renderer identifiers", () => {
    const line = createLine("line_1", [0, 0], [10, 0]);
    const [candidate] = createSketchConstraintInferenceCandidates({
      entity: line,
      sketchEntities: [line],
      constraints: []
    });

    const serialized = JSON.stringify(candidate);

    expect(serialized).not.toMatch(
      /renderer|mesh|occt|gpu|selection-buffer|opfs|file-handle|viewport/i
    );
  });
});

function createLine(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
): Extract<SketchEntitySnapshot, { readonly kind: "line" }> {
  return {
    id,
    kind: "line",
    construction: false,
    start,
    end
  };
}

function createAxisConstraint(
  id: string,
  kind: "horizontal" | "vertical",
  entityId: string
): SketchConstraintEntry {
  return {
    id,
    name: kind,
    sketchId: "sketch_1",
    entityId,
    kind,
    status: "healthy",
    issues: []
  };
}

function createLinePairConstraint(
  id: string,
  kind: "parallel" | "perpendicular",
  primaryLineEntityId: string,
  secondaryLineEntityId: string
): SketchConstraintEntry {
  return {
    id,
    name: kind,
    sketchId: "sketch_1",
    entityId: primaryLineEntityId,
    kind,
    primaryLineEntityId,
    secondaryLineEntityId,
    status: "healthy",
    issues: []
  };
}
