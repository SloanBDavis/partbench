import type { RenderExactPickCandidate } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  reconcileViewportExactCandidateSession,
  updateViewportExactSelections
} from "./viewportExactSelectionSession";

describe("viewport exact selection session", () => {
  it("preserves cycling within pointer tolerance and resets outside it", () => {
    const candidates = [candidate("face", "1"), candidate("edge", "2")];
    const bodies = [] as const;
    const initial = reconcileViewportExactCandidateSession(
      undefined,
      {
        status: "ready",
        candidates,
        examined: 2,
        truncated: false
      },
      { x: 10, y: 20 },
      bodies
    );
    expect(initial?.index).toBe(0);
    const cycled = { ...initial!, index: 1 };
    expect(cycled.index).toBe(1);
    expect(
      reconcileViewportExactCandidateSession(
        cycled,
        {
          status: "ready",
          candidates,
          examined: 2,
          truncated: false
        },
        { x: 16, y: 20 },
        bodies
      )?.index
    ).toBe(1);
    expect(
      reconcileViewportExactCandidateSession(
        cycled,
        {
          status: "ready",
          candidates,
          examined: 2,
          truncated: false
        },
        { x: 21, y: 20 },
        bodies
      )?.index
    ).toBe(0);
  });

  it("retains resource and truncation status without fabricating candidates", () => {
    expect(
      reconcileViewportExactCandidateSession(
        undefined,
        {
          status: "resource-limited",
          candidates: [],
          examined: 250_000,
          truncated: false
        },
        { x: 0, y: 0 },
        []
      )
    ).toMatchObject({
      status: "resource-limited",
      candidates: [],
      index: 0
    });
  });

  it("replaces normally and retains additive exact selections", () => {
    const face = candidate("face", "1");
    const edge = candidate("edge", "2");
    const selectedFace = updateViewportExactSelections([], face, false);
    const additive = updateViewportExactSelections(selectedFace, edge, true);
    expect(additive.map((entry) => entry.entityKind)).toEqual(["face", "edge"]);
    expect(updateViewportExactSelections(additive, face, true)).toEqual(
      additive
    );
    expect(updateViewportExactSelections(additive, face, false)).toEqual([
      expect.objectContaining({ entityKind: "face", localId: "face:1" })
    ]);
  });

  it("bounds additive selection state", () => {
    const selections = Array.from({ length: 65 }, (_, index) =>
      candidate("edge", String(index))
    ).reduce<ReturnType<typeof updateViewportExactSelections>>(
      (current, entry) => updateViewportExactSelections(current, entry, true),
      []
    );
    expect(selections).toHaveLength(64);
  });
});

function candidate(
  entityKind: "face" | "edge",
  id: string
): RenderExactPickCandidate {
  return {
    bodyId: "body",
    bodySourceIdentitySignature: "source",
    topologySignature: "topology",
    entityKind,
    localId: `${entityKind}:${id}`,
    entitySignature: `${entityKind}-signature:${id}`,
    depth: Number(id),
    distance: 0,
    occluded: false
  };
}
