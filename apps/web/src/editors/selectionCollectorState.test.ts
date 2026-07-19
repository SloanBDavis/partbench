import { describe, expect, it } from "vitest";
import {
  addSelectionCollectorTarget,
  createSelectionCollectorState,
  selectionCollectorReducer,
  type SelectionCollectorTarget
} from "./selectionCollectorState";

interface ReferenceValue {
  readonly sourceId: string;
  readonly reference: string;
}

const key = (value: ReferenceValue) => `${value.sourceId}:${value.reference}`;
const face: SelectionCollectorTarget<ReferenceValue> = {
  value: { sourceId: "body-1", reference: "face-anchor" },
  label: "Top face",
  kind: "Face"
};

describe("selectionCollectorState", () => {
  it("retains the exact accepted reference value", () => {
    const selected = addSelectionCollectorTarget(
      createSelectionCollectorState<ReferenceValue>(),
      face,
      key
    );

    expect(selected.targets[0]?.value).toBe(face.value);
    expect(selected.rejectedReason).toBeUndefined();
  });

  it("rejects duplicates without losing the existing draft", () => {
    const selected = createSelectionCollectorState([face]);
    const duplicate = addSelectionCollectorTarget(selected, face, key);

    expect(duplicate.targets).toEqual([face]);
    expect(duplicate.rejectedReason).toBe("Top face is already selected.");
  });

  it("reports ineligible picks without removing eligible targets", () => {
    const rejected = selectionCollectorReducer(
      createSelectionCollectorState([face]),
      {
        type: "target-rejected",
        reason: "Select a supported face, not a body."
      },
      key
    );

    expect(rejected.targets).toEqual([face]);
    expect(rejected.rejectedReason).toContain("supported face");
  });

  it("supports collecting, remove, and clear transitions", () => {
    const collecting = selectionCollectorReducer(
      createSelectionCollectorState([face]),
      { type: "collection-started" },
      key
    );
    const removed = selectionCollectorReducer(
      collecting,
      { type: "target-removed", targetKey: key(face.value) },
      key
    );
    const cleared = selectionCollectorReducer(
      createSelectionCollectorState([face]),
      { type: "cleared" },
      key
    );

    expect(collecting.collecting).toBe(true);
    expect(removed.targets).toEqual([]);
    expect(cleared.targets).toEqual([]);
  });
});
