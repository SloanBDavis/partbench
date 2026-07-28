import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  SketchProfileRegionCandidate,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createDefaultCamera } from "@web-cad/renderer";
import { createDefaultSketchDisplayFrame } from "../sketchDisplayFrames";
import { SketchRegionOverlay } from "./SketchRegionOverlay";
import {
  createRegionScreenPath,
  createRegionScreenPaths
} from "./sketchRegionOverlayModel";

describe("V19 sketch region viewport overlay", () => {
  it("projects exact query refs as an even-odd cell with its hole unfilled", () => {
    const path = createRegionScreenPath(
      candidate,
      sketch,
      createDefaultSketchDisplayFrame("XY"),
      createDefaultCamera(),
      { width: 900, height: 600 }
    );

    expect(path).toBeDefined();
    expect(path?.match(/\bM\b/g)).toHaveLength(2);
    expect(path?.match(/\bZ\b/g)).toHaveLength(2);
  });

  it("keeps hover and selected region states separate from entity selection", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchRegionOverlay, {
        camera: createDefaultCamera(),
        candidates: [candidate],
        displayFrame: createDefaultSketchDisplayFrame("XY"),
        hoveredCandidateKey: candidate.candidateKey,
        selectedCandidateKeys: [candidate.candidateKey],
        size: { width: 900, height: 600 },
        sketch,
        onHoverCandidate: vi.fn(),
        onSelectCandidate: vi.fn()
      })
    );

    expect(markup).toContain("sketch-region-cell-selected");
    expect(markup).toContain("sketch-region-cell-hovered");
    expect(markup).toContain('fill-rule="evenodd"');
    expect(markup).toContain('aria-label="Material region 1"');
    expect(markup).not.toContain("selectedEntityId");
  });

  it("indexes near-limit sketch entities once for all candidate paths", () => {
    const circles = Array.from({ length: 512 }, (_, index) => ({
      id: `circle_${index}`,
      kind: "circle" as const,
      center: [(index % 32) * 3, Math.floor(index / 32) * 3] as const,
      radius: 0.5,
      construction: false
    }));
    let entityMapPasses = 0;
    const entities = new Proxy(circles, {
      get(target, property, receiver) {
        if (property === "map") entityMapPasses += 1;
        return Reflect.get(target, property, receiver);
      }
    });
    const nearLimitSketch: SketchSnapshot = {
      id: "near_limit",
      name: "Near limit",
      plane: "XY",
      entities
    };
    const candidates = circles.map(
      (circle, index): SketchProfileRegionCandidate => ({
        candidateKey: `candidate_${index}`,
        region: {
          outer: { kind: "entity", entityId: circle.id },
          holes: []
        },
        outerLoopKey: `loop_${index}`,
        holeLoopKeys: [],
        outerEntityIds: [circle.id],
        holeEntityIds: [],
        signedArea: Math.PI * 0.25,
        materialArea: Math.PI * 0.25,
        containmentDepth: 0,
        status: "valid",
        diagnostics: []
      })
    );

    const paths = createRegionScreenPaths(
      candidates,
      nearLimitSketch,
      createDefaultSketchDisplayFrame("XY"),
      createDefaultCamera(),
      { width: 900, height: 600 }
    );

    expect(paths.size).toBeGreaterThan(0);
    expect(paths.size).toBeLessThanOrEqual(512);
    expect(entityMapPasses).toBe(1);
  });
});

const sketch: SketchSnapshot = {
  id: "sketch_1",
  name: "Ring",
  plane: "XY",
  entities: [
    {
      id: "outer",
      kind: "circle",
      center: [0, 0],
      radius: 10,
      construction: false
    },
    {
      id: "hole",
      kind: "circle",
      center: [0, 0],
      radius: 3,
      construction: false
    }
  ]
};

const candidate: SketchProfileRegionCandidate = {
  candidateKey: "candidate_outer",
  region: {
    outer: { kind: "entity", entityId: "outer" },
    holes: [{ kind: "entity", entityId: "hole" }]
  },
  outerLoopKey: "loop_outer",
  holeLoopKeys: ["loop_hole"],
  outerEntityIds: ["outer"],
  holeEntityIds: [["hole"]],
  signedArea: Math.PI * 100,
  materialArea: Math.PI * 91,
  containmentDepth: 0,
  status: "valid",
  diagnostics: []
};
