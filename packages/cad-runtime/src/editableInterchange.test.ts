import { expect, it } from "vitest";
import { createCadSession } from "./index";
import type { CadOp, CadQuery } from "@web-cad/cad-protocol";

it("cuts an imported rotated planar face using the ordinary attached sketch evaluator and reopens its feature", async () => {
  const authored = createCadSession();
  await authored.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "scene.createBox",
        id: "plate",
        name: "Rotated plate",
        dimensions: { width: 10, height: 8, depth: 6 },
        transform: {
          translation: [3, 4, 5],
          rotation: [0.3, 0.4, 0],
          scale: [1, 1, 1]
        }
      }
    ]
  });
  const step = await authored.exportStep();
  const session = createCadSession();
  const reopened = createCadSession();
  const query = (query: CadQuery) =>
    session.query({
      requestId: "editable-interchange",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: { version: "cadops.v1", query }
    });
  const anchorFor = async (
    bodyId: string,
    localId: string,
    anchorId: string
  ) => {
    const identity = await query({ query: "body.topologyIdentity", bodyId });
    if (!identity.ok || identity.query !== "body.topologyIdentity")
      throw new Error(JSON.stringify(identity));
    const candidate = identity.candidates.find(
      (candidate) => candidate.checkpointEntityId === localId
    );
    expect(candidate).toMatchObject({ status: "bound", confidence: "exact" });
    if (!candidate) throw new Error("Missing public exact face reference.");
    const plan = await query({
      query: "topology.anchorCreationPlan",
      bodyId,
      stableId: candidate.stableId,
      anchorId
    });
    expect(plan, JSON.stringify(plan)).toMatchObject({
      ok: true,
      status: "ready"
    });
    if (!plan.ok || plan.query !== "topology.anchorCreationPlan")
      throw new Error(JSON.stringify(plan));
    const committed = await session.executeBatch(plan.proposedBatch);
    expect(committed, JSON.stringify(committed)).toMatchObject({ ok: true });
    const checkpoint = await query({
      query: "body.topologyIdentity",
      bodyId,
      checkpointId: plan.checkpointId
    });
    if (
      !checkpoint.ok ||
      checkpoint.query !== "body.topologyIdentity" ||
      !checkpoint.snapshot
    )
      throw new Error(JSON.stringify(checkpoint));
    const readiness = await query({
      query: "topology.anchorCommandReadiness",
      anchorId,
      snapshot: checkpoint.snapshot,
      requiredOperation: "feature.attachSketchPlane"
    });
    if (
      !readiness.ok ||
      readiness.query !== "topology.anchorCommandReadiness" ||
      !readiness.proof
    )
      throw new Error(JSON.stringify(readiness));
    expect(readiness.proof.planeFrame).toBeDefined();
    return {
      proof: readiness.proof,
      createsCheckpoint: plan.createsCheckpoint
    };
  };
  const commit = (ops: readonly CadOp[]) =>
    session.executeBatch({ version: "cadops.v1", mode: "commit", ops });
  try {
    await session.importFile({
      bytes: step.bytes,
      fileName: "rotated-plate.step",
      format: "step"
    });
    const base = session.engine
      .createSnapshot()
      .features.find((feature) => feature.kind === "importedBody")!;
    if (base.kind !== "importedBody")
      throw new Error("Missing imported exact base.");
    const evidence = await session.getCurrentExactEvidence();
    const bodyEvidence = evidence.derivedExactMetadata.find(
      (item) => item.bodyId === base.bodyId
    );
    const metadata = bodyEvidence?.metadata;
    expect(metadata?.volume).toBeCloseTo(480, 6);
    const face = metadata?.topologySnapshot?.entities.find(
      (entity) =>
        entity.surfaceClass === "plane" &&
        entity.planeFrame &&
        entity.orientation === "forward" &&
        entity.planeFrame.normal[2] > 0.8
    );
    expect(face?.planeFrame).toBeDefined();
    if (!face?.planeFrame || !face.bounds)
      throw new Error("Expected an exact planar support face.");
    expect(
      await query({
        query: "selection.referenceCandidates",
        currentTopologyEvidence: {
          bodyId: base.bodyId,
          bodySourceIdentitySignature: bodyEvidence!.sourceIdentitySignature,
          topologySignature: metadata!.topologySnapshot!.signature,
          entityKind: "face",
          localId: face.localId,
          entitySignature: face.signature
        },
        requiredOperation: "feature.faceOffset"
      })
    ).toMatchObject({
      ok: true,
      currentTopology: { outcome: "promotableGeneratedMatch" }
    });
    const page = await query({
      query: "body.topologyIdentity",
      bodyId: base.bodyId,
      limit: 1,
      includeSnapshot: false
    });
    expect(page).toMatchObject({ ok: true, candidateCount: 1, nextOffset: 1 });
    expect(page).not.toHaveProperty("snapshot");
    const firstAnchor = await anchorFor(
      base.bodyId,
      face.localId,
      "mount_face"
    );
    expect(firstAnchor.createsCheckpoint).toBe(false);
    const frame = firstAnchor.proof.planeFrame!;
    const center = face.bounds!.min.map(
      (value, index) => (value + face.bounds!.max[index]!) / 2
    );
    const delta = center.map((value, index) => value - frame.origin[index]!);
    const dot = (axis: readonly number[]) =>
      delta.reduce((total, value, index) => total + value * axis[index]!, 0);
    const result = await commit([
      {
        op: "sketch.createOnFace",
        id: "mount",
        name: "Mounting hole",
        topologyAnchorId: "mount_face",
        topologyAnchorProof: firstAnchor.proof
      },
      {
        op: "sketch.addCircle",
        sketchId: "mount",
        id: "hole",
        center: [dot(frame.xDirection), dot(frame.yDirection)],
        radius: 1
      },
      {
        op: "feature.extrude",
        id: "cut",
        bodyId: "cut_body",
        sketchId: "mount",
        entityId: "hole",
        depth: 1.5,
        side: "negative",
        operationMode: "cut",
        targetBodyId: base.bodyId
      }
    ]);
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    const cut = (
      await session.getCurrentExactEvidence()
    ).derivedExactMetadata.find((item) => item.bodyId === "cut_body");
    expect(cut?.status).toBe("ready");
    expect(cut?.metadata?.volume).toBeCloseTo(480 - 1.5 * Math.PI, 5);
    const beforeRejectedCheckpoint = session.engine.exportProject();
    const rejectedCheckpoint = await commit([
      {
        op: "topology.checkpoint.create",
        checkpointId: base.checkpointId,
        bodyId: "cut_body",
        sourceFeatureId: "cut",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256: "a".repeat(64)
        },
        status: "active"
      }
    ]);
    expect(rejectedCheckpoint.ok).toBe(false);
    expect(session.engine.exportProject()).toEqual(beforeRejectedCheckpoint);
    // The failed prospective capture must not replace the imported base bytes;
    // the save/reopen and later cut update below exercise that rollback.
    const editedFace = cut?.metadata?.topologySnapshot?.entities.find(
      (entity) => entity.kind === "face" && entity.planeFrame
    );
    if (!editedFace) throw new Error("Missing edited exact face.");
    const editedAnchor = await anchorFor(
      "cut_body",
      editedFace.localId,
      "edited_face"
    );
    expect(editedAnchor.createsCheckpoint).toBe(true);
    expect(
      await commit([
        {
          op: "sketch.createOnFace",
          id: "inspection",
          name: "Inspection sketch",
          topologyAnchorId: "edited_face",
          topologyAnchorProof: editedAnchor.proof
        }
      ])
    ).toMatchObject({ ok: true });
    const file = await session.exportWcad();
    await reopened.openWcad(file);
    const updated = await reopened.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [{ op: "feature.updateExtrude", id: "cut", depth: 2 }]
    });
    expect(updated, JSON.stringify(updated)).toMatchObject({ ok: true });
    const changed = (
      await reopened.getCurrentExactEvidence()
    ).derivedExactMetadata.find((item) => item.bodyId === "cut_body");
    expect(changed?.metadata?.volume).toBeCloseTo(480 - 2 * Math.PI, 5);
    const roundTrip = await reopened.exportStep();
    const fresh = createCadSession();
    try {
      await fresh.importFile({
        bytes: roundTrip.bytes,
        fileName: "edited-plate.step",
        format: "step"
      });
      const imported = await fresh.getCurrentExactEvidence();
      expect(
        imported.derivedExactMetadata.reduce(
          (sum, item) => sum + (item.metadata?.volume ?? 0),
          0
        )
      ).toBeCloseTo(480 - 2 * Math.PI, 5);
    } finally {
      fresh.dispose();
    }
  } finally {
    session.dispose();
    reopened.dispose();
    authored.dispose();
  }
}, 30_000);
