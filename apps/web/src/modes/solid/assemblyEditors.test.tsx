import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AssemblySnapshot } from "@web-cad/cad-protocol";
import {
  buildAssemblyDistanceMateEditOp,
  buildAssemblyDistanceMateOp,
  buildAssemblyInstancePoseOp,
  buildAssemblyRevoluteMateOp,
  type AssemblyDistanceMateForm,
  type AssemblyRevoluteMateForm
} from "../../cadCommands";
import {
  canEditAssemblyInstancePose,
  createAssemblyEditorRequest
} from "./assemblyEditorRequests";
import { defaultAssemblyFrame } from "./assemblyEditorDefaults";
import { SolidModePanel } from "./SolidModePanel";
import { validateSolidDraft } from "./solidDraftValidation";
import {
  isSolidFeatureEditorKind,
  type SolidEditorRequest
} from "./solidEditorTypes";

const transform = {
  translation: [0, 0, 0],
  rotation: [0, 0, Math.PI / 2],
  scale: [1, 1, 1]
} as const;
const primary = defaultAssemblyFrame("root");
const secondary = {
  instanceId: "child",
  frame: {
    kind: "sketch",
    sketchId: "link-sketch",
    entityId: "pivot",
    offset: 4,
    flip: true
  }
} as const;
const assembly: AssemblySnapshot = {
  id: "arm",
  name: "Arm",
  instances: ["root", "child"].map((id) => ({
    id,
    name: id,
    definition: { kind: "body", bodyId: `body-${id}` },
    transform
  })),
  mates: [
    { id: "ground", name: "Ground", kind: "fixed", instanceId: "root" },
    {
      id: "joint",
      name: "Shoulder",
      kind: "revolute",
      primary,
      secondary,
      angleDegrees: 30,
      angleParameterId: "shoulder-angle",
      offset: 2
    }
  ]
};
const revolute: AssemblyRevoluteMateForm = {
  id: "new-joint",
  name: "Joint",
  assemblyId: "arm",
  primary,
  secondary,
  angleDegrees: 45,
  offset: 2
};
const request = (
  actionId:
    | "solid.revolute-mate"
    | "solid.instance-pose"
    | "solid.distance-mate"
) =>
  createAssemblyEditorRequest({
    key: "editor",
    actionId,
    assemblies: [assembly],
    sketches: [],
    parameters: [{ id: "shoulder-angle", name: "Shoulder angle", value: 30 }],
    selection: { kind: "assembly-mate", assemblyId: "arm", id: "joint" }
  });
const render = (activeEditor: SolidEditorRequest) =>
  renderToStaticMarkup(
    createElement(SolidModePanel, { activeEditor, onApply: () => undefined })
  );

describe("assembly workbench editors", () => {
  it("builds full revolute create and edit commands, preserving pivot references and exclusive bindings", () => {
    expect(buildAssemblyRevoluteMateOp(revolute)).toEqual({
      op: "assembly.mate.create",
      id: "new-joint",
      name: "Joint",
      assemblyId: "arm",
      kind: "revolute",
      primary,
      secondary,
      angleDegrees: 45,
      offset: 2
    });
    const edited = buildAssemblyRevoluteMateOp({
      ...revolute,
      mateId: "joint",
      angleParameterId: " shoulder-angle ",
      offsetParameterId: " clearance "
    });
    expect(edited).toMatchObject({
      op: "assembly.mate.edit",
      mateId: "joint",
      primary,
      secondary,
      angleParameterId: "shoulder-angle",
      offsetParameterId: "clearance"
    });
    expect(edited).not.toHaveProperty("id");
    expect(edited).not.toHaveProperty("angleDegrees");
    expect(edited).not.toHaveProperty("offset");
  });

  it("loads existing joint bindings into ordinary frame and parameter controls", () => {
    const editor = request("solid.revolute-mate");
    expect(editor.initialDraft).toMatchObject({
      mateId: "joint",
      primary,
      secondary,
      angleParameterId: "shoulder-angle"
    });
    const markup = render(editor);
    expect(markup).toContain('id="solid-revolute-mate-existing"');
    expect(markup).toContain('value="joint" selected=""');
    expect(markup).toContain('id="solid-revolute-primary-origin-x"');
    expect(markup).toContain('id="solid-revolute-secondary-pivot"');
    expect(markup).toContain('id="solid-revolute-angle-parameter"');
    expect(markup).toContain("Shoulder angle");
    expect(isSolidFeatureEditorKind("revoluteMate")).toBe(false);
  });

  it("blocks blank literals, unselected parameter bindings and invalid local frames", () => {
    for (const draft of [
      { ...revolute, angleDegrees: NaN },
      { ...revolute, offset: NaN },
      { ...revolute, angleParameterId: "" },
      {
        ...revolute,
        primary: {
          ...primary,
          frame: {
            kind: "local" as const,
            origin: [0, 0, 0] as const,
            xDirection: [0, 0, 0] as const,
            zDirection: [0, 0, 1] as const
          }
        }
      },
      {
        ...revolute,
        secondary: { ...secondary, frame: { ...secondary.frame, entityId: "" } }
      }
    ])
      expect(validateSolidDraft("revoluteMate", draft).status).toBe("blocked");
    expect(
      validateSolidDraft("revoluteMate", {
        ...revolute,
        angleDegrees: NaN,
        angleParameterId: "shoulder-angle"
      }).status
    ).toBe("ready");
    const markup = render({
      ...request("solid.revolute-mate"),
      initialDraft: { ...revolute, angleDegrees: NaN }
    });
    expect(markup).toMatch(/<button[^>]*data-ui-smoke="apply"[^>]*disabled=""/);
  });

  it("edits only free or grounded poses, converts displayed degrees and preserves scale", () => {
    const editor = request("solid.instance-pose");
    expect(editor.initialDraft).toMatchObject({
      instanceId: "root",
      rotationZ: 90
    });
    expect(
      editor.choices?.assemblyPoseInstances?.find(
        (choice) => choice.value.instanceId === "child"
      )?.disabled
    ).toBe(true);
    const pose = editor.choices!.assemblyPoseInstances![0]!.value;
    const op = buildAssemblyInstancePoseOp({
      ...pose,
      translationX: 12,
      rotationZ: 180
    });
    expect(op.transform).toEqual({
      translation: [12, 0, 0],
      rotation: [0, 0, Math.PI]
    });
    expect(op.transform).not.toHaveProperty("scale");
    expect(
      validateSolidDraft("instancePose", { ...pose, rotationY: NaN }).status
    ).toBe("blocked");
    const markup = render(editor);
    expect(markup).toContain("Rotation Z (degrees)");
    expect(markup).toContain('value="arm:child" disabled=""');
    expect(isSolidFeatureEditorKind("instancePose")).toBe(false);
  });

  it("keeps a reversed grounded root movable and blocks its constrained primary", () => {
    const reversed: AssemblySnapshot = {
      ...assembly,
      mates: [
        { id: "ground", name: "Ground", kind: "fixed", instanceId: "child" },
        {
          id: "joint",
          name: "Joint",
          kind: "revolute",
          primary,
          secondary,
          angleDegrees: 0,
          offset: 0
        }
      ]
    };
    expect(canEditAssemblyInstancePose(reversed, "child")).toBe(true);
    expect(canEditAssemblyInstancePose(reversed, "root")).toBe(false);
    expect(
      canEditAssemblyInstancePose({ ...assembly, mates: [] }, "root")
    ).toBe(true);
  });

  it("offers standard sketch pivots and avoids preselecting non-unit instances", () => {
    const sketch = {
      id: "standard",
      name: "Pivot sketch",
      entities: [
        {
          id: "point",
          kind: "point" as const,
          point: [0, 0] as const,
          construction: true
        }
      ]
    };
    const editor = createAssemblyEditorRequest({
      key: "new",
      actionId: "solid.revolute-mate",
      parameters: [],
      assemblies: [
        {
          ...assembly,
          instances: [
            {
              ...assembly.instances[0]!,
              id: "scaled",
              transform: { ...transform, scale: [2, 2, 2] }
            },
            ...assembly.instances
          ]
        }
      ],
      sketches: [sketch, { ...sketch, id: "datum-sketch", datumId: "datum" }],
      selection: { kind: "assembly-instance", assemblyId: "arm", id: "scaled" }
    });
    expect(
      editor.choices?.assemblySketchFrames?.map(
        (choice) => choice.value.sketchId
      )
    ).toEqual(["standard"]);
    expect(editor.initialDraft).toMatchObject({
      primary: { instanceId: "root" },
      secondary: { instanceId: "child" }
    });
    expect(
      editor.choices?.assemblyInstances?.find(
        (choice) => choice.value.instanceId === "scaled"
      )?.disabled
    ).toBe(true);
  });

  it("supports distance parameters in both create and edit without leaking literal values", () => {
    const form: AssemblyDistanceMateForm = {
      id: "distance",
      assemblyId: "arm",
      name: "Gap",
      primary: { instanceId: "root", plane: "XY", offset: 0, flip: false },
      secondary: { instanceId: "child", plane: "XY", offset: 0, flip: false },
      distance: NaN,
      distanceParameterId: "opening"
    };
    expect(validateSolidDraft("distanceMate", form).status).toBe("ready");
    expect(
      validateSolidDraft("distanceMate", { ...form, distanceParameterId: "" })
        .status
    ).toBe("blocked");
    for (const op of [
      buildAssemblyDistanceMateOp(form),
      buildAssemblyDistanceMateEditOp({ ...form, mateId: "gap" })
    ]) {
      expect(op).toHaveProperty("distanceParameterId", "opening");
      expect(op).not.toHaveProperty("distance");
    }
    expect(
      render({ ...request("solid.distance-mate"), initialDraft: form })
    ).toContain('id="solid-distance-mate-distance-parameter"');
  });
});
