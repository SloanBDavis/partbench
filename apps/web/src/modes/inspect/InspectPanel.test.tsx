import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTechnicalDetails } from "../../diagnostics/technicalDetails";
import { containsInternalText } from "../../diagnostics/userDiagnostic";
import { InspectPanel, type InspectPanelProps } from "./InspectPanel";

function render(props: InspectPanelProps): string {
  return renderToStaticMarkup(createElement(InspectPanel, props));
}

describe("InspectPanel", () => {
  it("renders a quiet empty state without advertising unsupported targets", () => {
    const markup = render({});

    expect(markup).toContain("Selection details");
    expect(markup).toContain("Nothing selected");
    expect(markup).toContain(
      "Select a body, supported face, or supported edge to inspect it."
    );
    expect(markup).not.toContain("Vertex");
    expect(markup).not.toContain("Pin measurement");
  });

  it("presents an authored object and its formatted measurements", () => {
    const markup = render({
      selection: {
        kind: "object",
        typeLabel: "Box",
        name: "Mounting block",
        properties: [
          { label: "Dimensions", value: "80 × 48 × 12 mm" },
          { label: "Position", value: "0, 0, 6 mm" }
        ]
      },
      measurements: {
        object: {
          title: "Authored dimensions",
          status: "ready",
          confidence: "From authored values",
          rows: [{ label: "Volume", value: "46,080 mm³" }]
        }
      },
      actions: [
        {
          id: "solid.transform",
          label: "Transform",
          availability: { status: "ready" }
        }
      ]
    });

    expect(markup).toContain("Mounting block");
    expect(markup).toContain("80 × 48 × 12 mm");
    expect(markup).toContain("From authored values");
    expect(markup).toContain("Transform");
  });

  it("combines body measurements, two-target results, mass properties, and health", () => {
    const markup = render({
      selection: {
        kind: "body",
        typeLabel: "Body",
        name: "Gearbox mount",
        owner: { part: "Main part", feature: "Fillet 1" },
        properties: [{ label: "Shape", value: "Solid" }]
      },
      measurements: {
        body: {
          title: "Body measurements",
          status: "ready",
          confidence: "From authored values",
          rows: [
            { label: "Volume", value: "181,000 mm³" },
            { label: "Surface area", value: "42,600 mm²" }
          ]
        },
        twoTarget: {
          status: "complete",
          firstTarget: "Left bore center",
          secondTarget: "Right bore center",
          prompt: "Two-target measurement complete for this session.",
          confidence: "Exact result",
          results: [
            { label: "Center distance", value: "80.00 mm" },
            { label: "Angle", value: "0.00°" }
          ]
        }
      },
      massProperties: {
        title: "Exact body properties",
        status: "ready",
        confidence: "Exact result",
        rows: [
          { label: "Mass", value: "1.42 kg" },
          { label: "Center of mass", value: "45.672, 12.385, 8.000 mm" }
        ]
      },
      health: [
        {
          scope: "body",
          label: "Body health",
          statusLabel: "Healthy",
          tone: "success",
          message: "The current result is ready for supported actions."
        }
      ],
      onBeginTwoTargetMeasurement: () => undefined,
      onClearTwoTargetMeasurement: () => undefined
    });

    expect(markup).toContain("Gearbox mount");
    expect(markup).toContain("Left bore center");
    expect(markup).toContain("80.00 mm");
    expect(markup).toContain("Mass properties");
    expect(markup).toContain("1.42 kg");
    expect(markup).toContain("Body health");
    expect(markup).toContain("Healthy");
    expect(markup).toContain("Clear");
  });

  it("shows generated and named reference readiness with actionable recovery", () => {
    const markup = render({
      selection: {
        kind: "named-reference",
        typeLabel: "Saved face",
        name: "Mounting face",
        owner: { body: "Gearbox mount", feature: "Extrude 1" }
      },
      measurements: {
        generatedReference: {
          title: "Face measurement",
          status: "ready",
          confidence: "From current geometry",
          rows: [
            { label: "Area", value: "3,840 mm²" },
            { label: "Surface", value: "Plane" }
          ]
        }
      },
      reference: {
        kindLabel: "Planar face",
        name: "Mounting face",
        health: {
          scope: "reference",
          label: "Reference health",
          statusLabel: "Needs repair",
          tone: "warning",
          message:
            "The saved reference no longer resolves to current geometry.",
          recovery: "Review the suggested compatible targets."
        },
        naming: { status: "ready" },
        repair: {
          status: "blocked",
          message: "Choose a compatible face before repairing this reference."
        }
      },
      onNameReference: () => undefined,
      onRepairReference: () => undefined,
      technicalDetails: createTechnicalDetails({
        code: "REFERENCE_STALE",
        context: {
          checkpointEntityId: "internal_checkpoint_face_001",
          stableId: "generated:face:top"
        }
      })
    });

    expect(markup).toContain("Saved face");
    expect(markup).toContain("Mounting face");
    expect(markup).toContain("Face measurement");
    expect(markup).toContain("Needs repair");
    expect(markup).toContain("Review the suggested compatible targets.");
    expect(markup).toContain("Rename reference");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Technical Details");
    expect(markup).not.toContain("<details open");
  });

  it("keeps internal vocabulary out of default visible and accessible copy", () => {
    const markup = render({
      selection: {
        kind: "edge",
        typeLabel: "Circular edge",
        name: "Outer rim",
        owner: { body: "Gearbox mount", feature: "Fillet 1" }
      },
      measurements: {
        generatedReference: {
          title: "Edge measurement",
          status: "ready",
          confidence: "From current geometry",
          rows: [{ label: "Radius", value: "8.00 mm" }]
        }
      },
      reference: {
        kindLabel: "Circular edge",
        health: {
          scope: "reference",
          label: "Reference health",
          statusLabel: "Healthy",
          tone: "success"
        },
        naming: { status: "ready" }
      },
      technicalDetails: createTechnicalDetails({
        code: "PRIVATE_DIAGNOSTIC_CODE",
        context: {
          stableId: "generated:edge:outer",
          worker: "geometry-worker"
        }
      })
    });
    const defaultSurface = markup.replace(
      /<details\b[^>]*>[\s\S]*?<\/details>/i,
      ""
    );

    expect(containsInternalText(defaultSurface)).toBe(false);
    expect(defaultSurface).not.toMatch(/\b(?:CADOps|schema|JSON|Vertex)\b/i);
  });
});
