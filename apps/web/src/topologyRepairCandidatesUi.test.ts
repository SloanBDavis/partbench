import type { CadTopologyRepairCandidate } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createTopologyRepairCandidatePreview,
  createTopologyRepairPreviewKey
} from "./topologyRepairCandidatesUi";

describe("topologyRepairCandidatesUi", () => {
  it("formats ambiguous repair candidates without exposing private ids", () => {
    const preview = createTopologyRepairCandidatePreview({
      status: "ambiguous",
      repairCandidates: [
        createCandidate({
          state: "ambiguous",
          confidence: "exact",
          recommendedAction: "manual-repair-plan"
        }),
        createCandidate({
          state: "split",
          confidence: "high",
          recommendedAction: "manual-repair-plan"
        })
      ]
    });

    expect(preview).toEqual({
      summary: "2 candidates · Ambiguous · manual choice required",
      candidateCount: 2,
      rows: [
        {
          candidateId: "topology_repair_candidate_private",
          entityKind: "Face",
          state: "Ambiguous",
          confidence: "Exact confidence",
          action: "Manual repair plan",
          repairable: true
        },
        {
          candidateId: "topology_repair_candidate_private",
          entityKind: "Face",
          state: "Split",
          confidence: "High confidence",
          action: "Manual repair plan",
          repairable: true
        }
      ]
    });
    const visibleRows = preview.rows.map((row) =>
      createVisibleCandidateRow(row)
    );

    expect(visibleRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: expect.any(String) })
      ])
    );
    expect(JSON.stringify(visibleRows)).not.toMatch(
      /candidateId|anchor_|stableId|checkpoint_|checkpoint-local|checkpointEntityId|proposedBatch|ops|rendererId|meshId|occtId|gpuId|selectionBufferId|fileHandle|opfsPath|localPath/i
    );
  });

  it("formats missing candidates as inspect-only display rows", () => {
    const preview = createTopologyRepairCandidatePreview({
      status: "missing",
      repairCandidates: [
        createCandidate({
          state: "deleted",
          confidence: "none",
          recommendedAction: "not-repairable"
        })
      ]
    });

    expect(preview.summary).toBe("1 candidate · Missing · not repairable");
    expect(preview.rows).toEqual([
      {
        candidateId: "topology_repair_candidate_private",
        entityKind: "Face",
        state: "Deleted",
        confidence: "No confidence",
        action: "Not repairable",
        repairable: false
      }
    ]);
  });

  it("creates stable transient keys without making them user-facing", () => {
    expect(
      createTopologyRepairPreviewKey({
        bodyId: "body_1",
        stableId: "generated:face:body_1:endCap",
        kind: "face",
        topologyAnchorId: "anchor_1"
      })
    ).toBe("body_1\u0000generated:face:body_1:endCap\u0000face\u0000anchor_1");
  });
});

function createVisibleCandidateRow(row: {
  readonly entityKind: string;
  readonly state: string;
  readonly confidence: string;
  readonly action: string;
  readonly repairable: boolean;
}) {
  return {
    entityKind: row.entityKind,
    state: row.state,
    confidence: row.confidence,
    action: row.action,
    repairable: row.repairable
  };
}

function createCandidate(
  overrides: Pick<
    CadTopologyRepairCandidate,
    "state" | "confidence" | "recommendedAction"
  >
): CadTopologyRepairCandidate {
  return {
    candidateId: "topology_repair_candidate_private",
    anchorId: "anchor_private",
    target: {
      type: "topologyAnchor",
      anchorId: "anchor_private"
    },
    previousCheckpointEvidence: {
      checkpointId: "checkpoint_private",
      checkpointEntityId: "checkpoint-local-face-private",
      idScope: "checkpoint-local",
      publicStableId: false
    },
    candidateCheckpointEvidence: {
      checkpointId: "checkpoint_private_next",
      checkpointEntityId: "checkpoint-local-face-private-next",
      idScope: "checkpoint-local",
      publicStableId: false
    },
    entityKind: "face",
    canAutoRetarget: false,
    evidence: [
      {
        kind: "geometrySignature",
        confidence: "high",
        message: "checkpoint-local-face-private matched"
      }
    ],
    diagnostics: [
      {
        code: "TOPOLOGY_MATCH_AMBIGUOUS",
        status: "deferred",
        severity: "warning",
        message: "anchor_private is ambiguous",
        received: "checkpoint-local-face-private"
      }
    ],
    ...overrides
  };
}
