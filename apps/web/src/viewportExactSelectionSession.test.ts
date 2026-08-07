import type { RenderExactPickCandidate } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  canCycleViewportExactCandidate,
  getNextViewportExactCandidateIndex,
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

  it("returns an absent session when the pick map is missing or cancelled", () => {
    const bodies = [] as const;
    expect(
      reconcileViewportExactCandidateSession(
        undefined,
        undefined,
        undefined,
        bodies
      )
    ).toBeUndefined();
    expect(
      reconcileViewportExactCandidateSession(
        undefined,
        undefined,
        { x: 1, y: 2 },
        bodies
      )
    ).toBeUndefined();
    expect(
      reconcileViewportExactCandidateSession(
        undefined,
        undefined,
        undefined,
        bodies
      )
    ).toBeUndefined();
  });

  it("keeps body-only selection usable when exact pick data is resource-limited", () => {
    const session = reconcileViewportExactCandidateSession(
      undefined,
      {
        status: "resource-limited",
        candidates: [],
        examined: 250_000,
        truncated: false
      },
      { x: 0, y: 0 },
      []
    );
    expect(session).toBeDefined();
    expect(session?.candidates).toEqual([]);
    expect(session?.status).toBe("resource-limited");
  });

  it("resets the cycle index when the exact pick body identity changes", () => {
    const candidates = [candidate("face", "1"), candidate("edge", "2")];
    const firstBodies = [{}] as unknown as Parameters<
      typeof reconcileViewportExactCandidateSession
    >[3];
    const nextBodies = [{}] as unknown as Parameters<
      typeof reconcileViewportExactCandidateSession
    >[3];
    expect(firstBodies).not.toBe(nextBodies);
    const cycled = {
      ...reconcileViewportExactCandidateSession(
        undefined,
        { status: "ready", candidates, examined: 2, truncated: false },
        { x: 10, y: 20 },
        firstBodies
      )!,
      index: 1
    };
    expect(
      reconcileViewportExactCandidateSession(
        cycled,
        { status: "ready", candidates, examined: 2, truncated: false },
        { x: 12, y: 20 },
        nextBodies
      )?.index
    ).toBe(0);
  });

  it("supports N-key cycling through bounded wrap-around", () => {
    const candidates = [
      candidate("face", "1"),
      candidate("edge", "2"),
      candidate("face", "3")
    ];
    const session = {
      ...reconcileViewportExactCandidateSession(
        undefined,
        { status: "ready", candidates, examined: 3, truncated: false },
        { x: 10, y: 20 },
        []
      )!,
      index: 2
    };
    expect(canCycleViewportExactCandidate(session)).toBe(true);
    expect(getNextViewportExactCandidateIndex(session)).toBe(0);
    expect(getNextViewportExactCandidateIndex({ ...session, index: 0 })).toBe(
      1
    );
    expect(
      canCycleViewportExactCandidate(
        reconcileViewportExactCandidateSession(
          undefined,
          {
            status: "ready",
            candidates: [candidate("face", "1")],
            examined: 1,
            truncated: false
          },
          { x: 0, y: 0 },
          []
        )
      )
    ).toBe(false);
    expect(getNextViewportExactCandidateIndex(undefined)).toBe(-1);
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
