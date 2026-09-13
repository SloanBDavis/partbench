import { expect, it } from "vitest";
import { CadEngine } from "./index";
import type {
  CadBodyDerivedExactMetadataSnapshot,
  CadOp
} from "@web-cad/cad-protocol";

it("keeps consumed wire reference capability separate from source validity and exact failures", () => {
  const engine = new CadEngine();
  const points = [
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10]
  ] as const;
  engine.applyBatch([
    { op: "sketch.create", id: "profile", name: "Profile", plane: "XY" },
    ...points.map(
      (start, index): CadOp => ({
        op: "sketch.addLine",
        sketchId: "profile",
        id: `edge_${index}`,
        start,
        end: points[(index + 1) % points.length]!
      })
    ),
    {
      op: "feature.extrude",
      id: "blank",
      bodyId: "blank_body",
      depth: 10,
      profile: {
        kind: "wire",
        sketchId: "profile",
        segments: points.map((_, index) => ({
          entityId: `edge_${index}`,
          orientation: "forward"
        }))
      }
    },
    {
      op: "sketch.addCircle",
      sketchId: "profile",
      id: "circle",
      center: [0, 0],
      radius: 3
    },
    {
      op: "feature.hole",
      id: "bore",
      bodyId: "finished",
      sketchId: "profile",
      circleEntityId: "circle",
      depthMode: "throughAll",
      targetBodyId: "blank_body"
    }
  ]);
  const health = (
    derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[]
  ) =>
    engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health", derivedExactMetadata }
    });
  expect(health()).toMatchObject({
    status: "under-defined",
    authoredExtrudes: [
      {
        featureId: "blank",
        status: "healthy",
        issues: [],
        topologyAvailable: false,
        topologyIssueCount: 1
      }
    ]
  });
  const topology = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "blank_body" }
  });
  if (!topology.ok || topology.query !== "body.topology")
    throw new Error("Expected source topology descriptor");
  expect(
    health([
      {
        bodyId: "blank_body",
        sourceIdentitySignature: topology.topology.sourceIdentity.signature,
        status: "kernel-failed",
        error: { code: "KERNEL_FAILURE", message: "Exact evaluation failed." }
      }
    ])
  ).toMatchObject({
    status: "unsupported",
    authoredExtrudes: [
      {
        status: "unsupported",
        issues: [
          expect.objectContaining({ code: "EXACT_GEOMETRY_KERNEL_FAILED" })
        ]
      }
    ]
  });
  engine.apply({
    op: "sketch.updateEntity",
    sketchId: "profile",
    entity: {
      id: "edge_0",
      kind: "line",
      start: [-10, -10],
      end: [9, -10],
      construction: false
    }
  });
  expect(health()).toMatchObject({
    status: "unsupported",
    authoredExtrudes: [
      {
        status: "unsupported",
        issues: [
          expect.objectContaining({ code: "UNSUPPORTED_BODY_REFERENCES" })
        ]
      }
    ]
  });
});
