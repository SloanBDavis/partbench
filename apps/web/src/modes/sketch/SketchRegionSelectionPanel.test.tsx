import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  SketchProfileRegionCandidate,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import {
  SketchRegionSelectionPanel,
  type SketchRegionSelectionPanelProps
} from "./SketchRegionSelectionPanel";

describe("V19 material region collector", () => {
  it("renders a keyboard-complete paginated region-to-extrude editor", () => {
    const markup = render();

    expect(markup).toContain('aria-label="Select sketch material regions"');
    expect(markup).toContain("Prospective consumer");
    expect(markup).toContain("Extrude · New body");
    expect(markup).toContain("Extrude · Add or cut");
    expect(markup).toContain("Revolve · New body");
    expect(markup).toContain("Exactly 1 region");
    expect(markup).toContain("Region 1");
    expect(markup).toContain("Circle 1");
    expect(markup).toContain("Holes · Circle 2");
    expect(markup).toContain("Depth");
    expect(markup).toContain("Side");
    expect(markup).toContain("Create extrude");
    expect(markup).toContain("Ctrl/Cmd+Enter applies");
    expect(markup).toContain("Escape cancels");
    expect(markup).toContain("submits the same typed");
    expect(markup).not.toContain("candidate_outer</button>");
  });

  it("keeps invalid discovery diagnostics localized and unselectable", () => {
    const invalid: SketchProfileRegionCandidate = {
      ...candidate,
      status: "invalid",
      diagnostics: [
        {
          code: "SKETCH_REGION_BOUNDARY_TOUCHING",
          severity: "blocker",
          message: "The inner loop touches the outer boundary."
        }
      ]
    };
    const markup = render({ candidates: [invalid] });

    expect(markup).toContain("The inner loop touches the outer boundary.");
    expect(markup).toContain("disabled");
    expect(markup).not.toContain("SKETCH_REGION_BOUNDARY_TOUCHING");
  });
});

const sketch: SketchSnapshot = {
  id: "sketch_1",
  name: "Flange",
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
      radius: 2,
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
  materialArea: Math.PI * 96,
  containmentDepth: 0,
  status: "valid",
  diagnostics: []
};

function render(
  overrides: Partial<SketchRegionSelectionPanelProps> = {}
): string {
  return renderToStaticMarkup(
    createElement(SketchRegionSelectionPanel, {
      disabled: false,
      sketch,
      sourceAuthorityKey: 1,
      candidates: [candidate],
      selectedCandidateKeys: ["candidate_outer"],
      consumer: "extrude-new-body",
      queryCandidates: vi.fn(),
      validateProfile: vi.fn(),
      onCandidatesChange: vi.fn(),
      onToggleCandidate: vi.fn(),
      onHoverCandidate: vi.fn(),
      onConsumerChange: vi.fn(),
      onApplyReady: vi.fn(),
      onCancel: vi.fn(),
      ...overrides
    })
  );
}
