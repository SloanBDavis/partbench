import type {
  CadGeneratedReference,
  CadSelectionReferenceIssue
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import type { ViewportHoverState } from "./viewportHoverIntent";
import {
  createViewportInteractionSurface,
  type ViewportInteractionSurface
} from "./viewportInteractionSurface";
import type { ViewportMeasurementOverlay } from "./viewportMeasurementOverlay";
import type { ViewportReferenceAction } from "./viewportReferenceActions";
import type { ViewportSelectionDisplay } from "./viewportSelectionDisplay";

describe("viewport interaction surface", () => {
  it("attaches measurement rows to the selected target summary", () => {
    const surface = createViewportInteractionSurface({
      selectionDisplay: createSelectionDisplay({
        title: "Face: Start cap",
        selectionKind: "generatedReference"
      }),
      measurementOverlay: createMeasurementOverlay({
        rows: [
          { label: "Area", value: "8 mm^2" },
          { label: "Surface", value: "plane" }
        ],
        inspect: createInspectOverlay({
          rows: [
            { label: "Target", value: "Face: Start cap" },
            {
              label: "Authority",
              value: "Authority: source-analytic exact"
            }
          ]
        })
      })
    });

    expect(surface.selection).toMatchObject({
      selectionKind: "generatedReference",
      title: "Face: Start cap",
      detail: "Command-ready reference",
      measurement: {
        title: "Face measurement",
        detail: "Start cap",
        source: "body.generatedReferenceMeasurements",
        authority: "sourceAnalytic",
        authorityLabel: "Authority: source-analytic exact",
        tone: "ready",
        rows: [
          { label: "Area", value: "8 mm^2" },
          { label: "Surface", value: "plane" }
        ],
        overflowCount: 0
      },
      inspect: {
        title: "Inspect target",
        detail: "Command-ready target",
        authority: "sourceAnalytic",
        authorityLabel: "Authority: source-analytic exact",
        rows: [
          { label: "Target", value: "Face: Start cap" },
          {
            label: "Authority",
            value: "Authority: source-analytic exact"
          }
        ]
      }
    });
  });

  it("keeps selected target primary and suppresses duplicate hover for the same render target", () => {
    const surface = createViewportInteractionSurface({
      selectionDisplay: createSelectionDisplay({
        renderTargetId: "body_rect",
        title: "Base (Body)"
      }),
      hoverState: createHoverState({
        renderTargetId: "body_rect",
        title: "Base (Body)",
        detail: "4 command-ready operations"
      })
    });

    expect(surface.selection.title).toBe("Base (Body)");
    expect(surface.hover).toBeUndefined();
  });

  it("shows different hover targets as transient subordinate state", () => {
    const surface = createViewportInteractionSurface({
      selectionDisplay: createSelectionDisplay({
        renderTargetId: "body_rect",
        title: "Base (Body)"
      }),
      hoverState: createHoverState({
        bodyId: "body_slot",
        renderTargetId: "body_slot",
        title: "Slot cut (Body)",
        detail: "Selection body consumed",
        tone: "warning"
      })
    });

    expect(surface.selection.title).toBe("Base (Body)");
    expect(surface.hover).toMatchObject({
      kind: "body",
      title: "Slot cut (Body)",
      detail: "Selection body consumed",
      tone: "warning"
    });
  });

  it("groups and caps reference actions with selected and commandable targets first", () => {
    const actions = [
      createReferenceAction({ kind: "vertex", label: "Corner A" }),
      createReferenceAction({ kind: "body", label: "Rectangle extrude body" }),
      createReferenceAction({ kind: "edge", label: "Start uMin" }),
      createReferenceAction({
        kind: "face",
        label: "Start cap",
        selected: true
      }),
      createReferenceAction({
        kind: "edge",
        label: "Blocked edge",
        commandable: false,
        diagnostic: createIssue("NON_COMMANDABLE_SELECTION_TARGET")
      }),
      createReferenceAction({
        kind: "face",
        label: "Blocked face",
        commandable: false,
        diagnostic: createIssue("CONSUMED_SELECTION_BODY")
      })
    ];
    const surface = createViewportInteractionSurface({
      selectionDisplay: createSelectionDisplay(),
      referenceActions: actions,
      maxReferenceActions: 3
    });

    expect(surface.referenceSection).toMatchObject({
      title: "Reference targets",
      summary: "3 of 6 targets",
      totalCount: 6,
      visibleCount: 3,
      overflowCount: 3,
      commandableCount: 4,
      blockedCount: 2,
      selectedCount: 1,
      diagnosticCount: 2
    });
    expect(
      surface.referenceSection?.groups.flatMap((group) =>
        group.actions.map((action) => `${group.kindLabel}:${action.label}`)
      )
    ).toEqual([
      "Face:Start cap",
      "Edge:Start uMin",
      "Body:Rectangle extrude body"
    ]);
  });

  it("keeps structured diagnostics visible on blocked reference actions", () => {
    const surface = createViewportInteractionSurface({
      selectionDisplay: createSelectionDisplay(),
      referenceActions: [
        createReferenceAction({
          kind: "face",
          label: "Start cap",
          commandable: false,
          diagnostic: createIssue("NON_COMMANDABLE_SELECTION_TARGET")
        })
      ]
    });

    expect(surface.referenceSection?.groups[0]?.actions[0]).toMatchObject({
      commandable: false,
      diagnostic: {
        code: "NON_COMMANDABLE_SELECTION_TARGET",
        status: "non-commandable",
        message: "Selection is not commandable for this operation."
      }
    });
  });

  it("caps selected measurement rows without detaching them from the summary", () => {
    const surface = createViewportInteractionSurface({
      selectionDisplay: createSelectionDisplay(),
      measurementOverlay: createMeasurementOverlay({
        rows: [
          { label: "Area", value: "8 mm^2" },
          { label: "Bounds", value: "size 4 mm, 2 mm, 0 mm" },
          { label: "Center", value: "0 mm, 0 mm, 0 mm" },
          { label: "Surface", value: "plane" }
        ]
      }),
      maxMeasurementRows: 2
    });

    expect(surface.selection.measurement?.rows).toEqual([
      { label: "Area", value: "8 mm^2" },
      { label: "Bounds", value: "size 4 mm, 2 mm, 0 mm" }
    ]);
    expect(surface.selection.measurement?.overflowCount).toBe(2);
  });

  it("redacts raw internal IDs from visible interaction text", () => {
    const surface = createViewportInteractionSurface({
      selectionDisplay: createSelectionDisplay({
        title: "Selected selection-buffer:face:17",
        detail: "Derived from occt-shape:wire:12",
        geometryDetail: "Cache mesh-triangle:99 is pending",
        diagnostics: [
          {
            code: "MISSING_SELECTION_TARGET",
            status: "missing",
            message: "Missing selection-buffer:face:17."
          }
        ]
      }),
      hoverState: createHoverState({
        title: "Hover selection-buffer:face:18",
        detail: "Unknown occt-shape:solid:2"
      }),
      measurementOverlay: createMeasurementOverlay({
        error:
          "Reference measurements unavailable for mesh-triangle:1 and occt-shape:solid:2."
      }),
      referenceActions: [
        createReferenceAction({
          kind: "face",
          label: "selection-buffer:face:19",
          diagnostic: createIssue(
            "MISSING_SELECTION_TARGET",
            "Missing occt-shape:face:4."
          )
        })
      ]
    });
    const visibleText = collectVisibleSurfaceText(surface);

    expect(visibleText).not.toContain("selection-buffer");
    expect(visibleText).not.toContain("mesh-triangle");
    expect(visibleText).not.toContain("occt-shape");
    expect(visibleText).toContain("internal render target");
  });
});

function createSelectionDisplay(
  overrides: Partial<ViewportSelectionDisplay> = {}
): ViewportSelectionDisplay {
  return {
    selectionKind: "body",
    title: "Base (Body)",
    detail: "Command-ready reference",
    tone: "ready",
    renderTargetId: "body_rect",
    geometryStatus: "ready",
    geometryDetail: "OCCT mesh ready",
    referenceStatus: "resolved",
    referenceSummary: "Face: Start cap",
    commandOperations: [],
    commandOperationLabels: ["Create sketch on face", "Name reference"],
    diagnostics: [],
    ...overrides
  };
}

function createHoverState(
  overrides: Partial<
    Extract<ViewportHoverState, { readonly kind: "body" }>
  > = {}
): ViewportHoverState {
  return {
    kind: "body",
    title: "Hovered body (Body)",
    detail: "Command-ready reference",
    tone: "ready",
    bodyId: "body_hovered",
    renderTargetId: "body_hovered",
    semanticSelection: { type: "body", bodyId: "body_hovered" },
    referenceStatus: "resolved",
    commandOperations: [],
    commandOperationLabels: ["Inspect reference"],
    diagnostics: [],
    ...overrides
  };
}

function createMeasurementOverlay(
  overrides: Partial<ViewportMeasurementOverlay> = {}
): ViewportMeasurementOverlay {
  return {
    selectionKind: "generatedReference",
    title: "Face measurement",
    detail: "Start cap",
    source: "body.generatedReferenceMeasurements",
    authority: "sourceAnalytic",
    authorityLabel: "Authority: source-analytic exact",
    target: {
      targetKind: "generatedPlanarFace",
      title: "Face: Start cap",
      detail: "Generated reference target",
      label: "Start cap",
      bodyId: "body_rect",
      stableId: "generated:face:body_rect:startCap",
      selection: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId: "generated:face:body_rect:startCap",
        expectedKind: "face"
      },
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      status: "resolved",
      diagnostics: []
    },
    tone: "ready",
    rows: [],
    diagnostics: [],
    inspect: createInspectOverlay(),
    ...overrides
  };
}

function createInspectOverlay(
  overrides: Partial<ViewportMeasurementOverlay["inspect"]> = {}
): ViewportMeasurementOverlay["inspect"] {
  return {
    title: "Inspect target",
    detail: "Command-ready target",
    authority: "sourceAnalytic",
    authorityLabel: "Authority: source-analytic exact",
    rows: [
      { label: "Target", value: "Face: Start cap" },
      { label: "Authority", value: "Authority: source-analytic exact" },
      { label: "Commands", value: "Inspect reference" }
    ],
    commandOperationLabels: ["Inspect reference"],
    diagnostics: [],
    ...overrides
  };
}

function createReferenceAction({
  commandable = true,
  diagnostic,
  kind,
  label,
  selected = false
}: {
  readonly commandable?: boolean;
  readonly diagnostic?: CadSelectionReferenceIssue;
  readonly kind: CadGeneratedReference["kind"];
  readonly label: string;
  readonly selected?: boolean;
}): ViewportReferenceAction {
  return {
    id: `viewport-reference:${kind}:${label}`,
    reference: createGeneratedReference(kind, label),
    label,
    kindLabel: formatKindLabel(kind),
    commandable,
    selected,
    commandOperations: commandable ? ["feature.selectReference"] : [],
    commandOperationLabels: commandable ? ["Inspect reference"] : [],
    ...(diagnostic ? { diagnostic } : {})
  };
}

function createGeneratedReference(
  kind: CadGeneratedReference["kind"],
  label: string
): CadGeneratedReference {
  const base = {
    stableId: `generated:${kind}:body_rect:${label}`,
    label,
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    eligibleOperations: ["feature.selectReference"] as const,
    geometricSignature: {
      profileKind: "rectangle" as const,
      sketchPlane: "XY" as const,
      extrudeSide: "positive" as const,
      depth: 2
    }
  };

  switch (kind) {
    case "body":
      return {
        ...base,
        kind,
        profileKind: "rectangle"
      };
    case "face":
      return {
        ...base,
        kind,
        role: "startCap"
      };
    case "edge":
      return {
        ...base,
        kind,
        role: "start:uMin",
        adjacentFaceRoles: ["startCap", "side:uMin"]
      };
    case "vertex":
      return {
        ...base,
        kind,
        role: "start:uMin:vMin",
        adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
        adjacentEdgeRoles: [
          "start:uMin",
          "start:vMin",
          "longitudinal:uMin:vMin"
        ]
      };
  }
}

function formatKindLabel(kind: CadGeneratedReference["kind"]): string {
  switch (kind) {
    case "body":
      return "Body";
    case "face":
      return "Face";
    case "edge":
      return "Edge";
    case "vertex":
      return "Vertex";
  }
}

function createIssue(
  code: CadSelectionReferenceIssue["code"],
  message = "Selection is not commandable for this operation."
): CadSelectionReferenceIssue {
  return {
    code,
    status:
      code === "CONSUMED_SELECTION_BODY"
        ? "consumed"
        : code === "MISSING_SELECTION_TARGET"
          ? "missing"
          : "non-commandable",
    message
  };
}

function collectVisibleSurfaceText(
  surface: ViewportInteractionSurface
): string {
  const text = [
    surface.selection.title,
    surface.selection.detail,
    surface.selection.geometryDetail,
    surface.selection.referenceSummary,
    ...surface.selection.commandOperationLabels,
    ...surface.selection.diagnostics.map((diagnostic) => diagnostic.message),
    surface.selection.measurement?.title,
    surface.selection.measurement?.detail,
    surface.selection.measurement?.error,
    ...(surface.selection.measurement?.rows.flatMap((row) => [
      row.label,
      row.value
    ]) ?? []),
    surface.hover?.title,
    surface.hover?.detail,
    ...(surface.hover?.commandOperationLabels ?? []),
    ...(surface.hover?.diagnostics.map((diagnostic) => diagnostic.message) ??
      []),
    surface.referenceSection?.title,
    surface.referenceSection?.summary,
    ...(surface.referenceSection?.groups.flatMap((group) => [
      group.kindLabel,
      ...group.actions.flatMap((action) => [
        action.label,
        action.kindLabel,
        ...action.commandOperationLabels,
        action.diagnostic?.message
      ])
    ]) ?? [])
  ];

  return text.filter((value): value is string => Boolean(value)).join(" ");
}
