// Discovery for the common build/revise path. Execution still uses CADOps
// validation; these schemas never implement modeling or geometry semantics.
type Schema = Record<string, unknown>;
interface OpSchema extends Schema {
  readonly properties: {
    readonly op: { readonly const: string };
    readonly [key: string]: unknown;
  };
}

const id = { type: "string", minLength: 1 };
const number = { type: "number" };
const positive = { type: "number", exclusiveMinimum: 0 };
const axes = { enum: ["x", "y", "z"] };
const planes = { enum: ["XY", "XZ", "YZ"] };
const vec3 = { type: "array", minItems: 3, maxItems: 3, items: number };
const transform = {
  ...object(
    {
      translation: {
        ...vec3,
        description:
          "[x,y,z] translation in document length units, applied last; default [0,0,0]."
      },
      rotation: {
        ...vec3,
        description:
          "[x,y,z] Euler angles in radians, applied X then Y then Z; default [0,0,0]."
      },
      scale: {
        ...vec3,
        description:
          "Dimensionless [x,y,z] scale, applied before rotation; default [1,1,1]. Revolute-connected instances require [1,1,1]."
      }
    },
    []
  ),
  description:
    "Definition-local point → componentwise scale → X, Y, Z rotations (radians) → translation in assembly coordinates. Insert defaults missing fields to identity; update preserves them."
};
const featureFields = { id, bodyId: id, name: id };
const targetFields = { targetBodyId: id, targetTopologyAnchorId: id };
const proof = {
  type: "object",
  description:
    "Use the topologyAnchorProof returned by readiness unchanged; never invent private topology IDs."
};

function object(
  properties: Schema,
  required: readonly string[] = Object.keys(properties)
): Schema {
  return { type: "object", additionalProperties: false, required, properties };
}
function op(
  name: string,
  required: readonly string[],
  fields: Schema,
  description: string,
  extra: Schema = {}
): OpSchema {
  return {
    ...object({ op: { const: name }, ...fields }, ["op", ...required]),
    description,
    ...extra,
    properties: { op: { const: name }, ...fields }
  };
}
function exactlyOne(...fields: string[]): Schema {
  return {
    oneOf: fields.map((field) => ({
      required: [field],
      not: {
        anyOf: fields
          .filter((other) => other !== field)
          .map((other) => ({ required: [other] }))
      }
    }))
  };
}

export function createModelingOpSchemas(
  vec2: Schema,
  orientedSegment: Schema,
  loop: Schema
): readonly OpSchema[] {
  const profile = {
    oneOf: [
      object({ kind: { const: "entity" }, sketchId: id, entityId: id }),
      object({
        kind: { const: "wire" },
        sketchId: id,
        segments: { type: "array", minItems: 1, items: orientedSegment }
      }),
      object({
        kind: { const: "regions" },
        sketchId: id,
        regions: {
          type: "array",
          minItems: 1,
          items: object({ outer: loop, holes: { type: "array", items: loop } })
        }
      })
    ]
  };
  const profileFields = { sketchId: id, entityId: id, profile };
  const sourceProfile = {
    oneOf: [
      { required: ["sketchId", "entityId"], not: { required: ["profile"] } },
      {
        required: ["profile"],
        not: { anyOf: [{ required: ["sketchId"] }, { required: ["entityId"] }] }
      }
    ]
  };
  const face = {
    oneOf: [
      object({ kind: { const: "generatedFace" }, bodyId: id, stableId: id }),
      object({ kind: { const: "namedReference" }, name: id }),
      object({ kind: { const: "topologyAnchor" }, bodyId: id, anchorId: id })
    ]
  };
  const directionVariants = [
    object({ kind: { const: "globalAxis" }, axis: axes }),
    object({ kind: { const: "generatedEdge" }, bodyId: id, stableId: id }),
    object({ kind: { const: "namedReference" }, name: id }),
    object({ kind: { const: "topologyAnchor" }, bodyId: id, anchorId: id })
  ];
  const linear = {
    axis: axes,
    direction: { oneOf: directionVariants },
    spacing: positive,
    instanceCount: { type: "integer", minimum: 2 },
    topologyAnchorProof: proof
  };
  const circular = {
    rotationAxis: {
      oneOf: [
        axes,
        ...directionVariants,
        object({ kind: { const: "datumAxis" }, datumId: id })
      ]
    },
    totalAngleDegrees: { ...positive, maximum: 360 },
    instanceCount: { type: "integer", minimum: 2 },
    topologyAnchorProof: proof
  };
  const seed = { seedBodyId: id, seedFeatureId: id };
  const sketchFields = {
    sketchId: id,
    id,
    center: vec2,
    construction: { type: "boolean" }
  };
  const extrude = {
    ...profileFields,
    depth: positive,
    side: { enum: ["positive", "negative", "symmetric"] }
  };
  const hole = {
    ...targetFields,
    depthMode: { enum: ["blind", "throughAll"] },
    depth: positive,
    direction: { enum: ["positive", "negative"] }
  };
  const shell = {
    wallThickness: positive,
    openFaceRefs: { type: "array", items: face }
  };
  const planeRef = object(
    {
      instanceId: id,
      plane: {
        ...planes,
        description:
          "Definition-local mate plane; unflipped normals are +Z for XY, +Y for XZ, and +X for YZ."
      },
      offset: {
        ...number,
        description:
          "Offset in document units along the unflipped mate-plane normal; default 0."
      },
      flip: {
        type: "boolean",
        description:
          "Reverse the mate-plane normal, retaining its offset point; default false."
      }
    },
    ["instanceId", "plane"]
  );
  const axisRef = object(
    { instanceId: id, axis: { enum: ["X", "Y", "Z"] }, origin: vec3 },
    ["instanceId", "axis"]
  );
  const definition = object({ kind: { const: "body" }, bodyId: id });
  const frameRef = object({
    instanceId: id,
    frame: {
      oneOf: [
        {
          ...object({
            kind: { const: "local" },
            origin: vec3,
            xDirection: vec3,
            zDirection: vec3
          }),
          description:
            "Complete definition-local frame. Origin uses document units; nonzero orthogonal X/Z directions are normalized. Numeric origins do not follow sketch edits."
        },
        {
          ...object(
            {
              kind: { const: "sketch" },
              sketchId: id,
              entityId: id,
              offset: {
                ...number,
                description:
                  "Distance along the unflipped sketch normal in document units; default 0."
              },
              flip: {
                type: "boolean",
                description:
                  "Reverse frame Z and Y, retaining X; default false."
              }
            },
            ["kind", "sketchId", "entityId"]
          ),
          description:
            "Frame at an authored circle center or point. The unattached XY/XZ/YZ sketch must be in the instance body's source ancestry. Tracks evaluated sketch edits and dimensions."
        }
      ]
    }
  });

  return [
    op(
      "parameter.create",
      ["name", "value"],
      { id, name: id, value: number, description: { type: "string" } },
      "Create a named dimension parameter. Bind it using sketch.dimension.create with parameterId."
    ),
    op(
      "parameter.update",
      ["id"],
      { id, value: number, description: { type: "string" } },
      "Revise a parameter and its bound sketch dimensions."
    ),
    op(
      "parameter.setExpression",
      ["id"],
      { id, expression: { type: ["string", "null"] } },
      "Set a parameter expression; null or omission clears it."
    ),
    op(
      "sketch.create",
      ["name"],
      { id, name: id, plane: planes, datumId: id },
      "Create a sketch on exactly one standard plane (XY/XZ/YZ) or datumId.",
      exactlyOne("plane", "datumId")
    ),
    op(
      "sketch.addRectangle",
      ["sketchId", "center", "width", "height"],
      { ...sketchFields, width: positive, height: positive },
      "Add a rectangle centered at [x,y] in sketch coordinates."
    ),
    op(
      "sketch.addCircle",
      ["sketchId", "center", "radius"],
      { ...sketchFields, radius: positive },
      "Add a circle centered at [x,y] in sketch coordinates."
    ),
    op(
      "feature.extrude",
      ["depth"],
      {
        ...featureFields,
        ...targetFields,
        ...extrude,
        operationMode: { enum: ["newBody", "add", "cut"] }
      },
      "Extrude a sketch entity or profile. newBody is default; add/cut require a targetBodyId. Specify id and bodyId to reference the result in this batch.",
      sourceProfile
    ),
    op(
      "feature.updateExtrude",
      ["id"],
      { id, ...extrude },
      "Revise an existing extrude depth, side, or profile; supported downstream chains rebuild while preserving feature/body IDs."
    ),
    op(
      "feature.hole",
      ["sketchId", "circleEntityId", "depthMode"],
      { ...featureFields, ...hole, sketchId: id, circleEntityId: id },
      "Cut a hole from a sketch circle into one target body. throughAll omits depth; blind requires positive depth. Default direction is positive.",
      exactlyOne("targetBodyId", "targetTopologyAnchorId")
    ),
    op(
      "feature.updateHole",
      ["id"],
      { id, ...hole },
      "Revise a hole's depth mode, depth, direction, or target."
    ),
    op(
      "feature.fillet",
      ["targetBodyId", "radius"],
      {
        ...featureFields,
        targetBodyId: id,
        edgeStableId: id,
        namedReference: id,
        topologyAnchorId: id,
        topologyAnchorProof: proof,
        radius: positive
      },
      "Round a target body's edge. Read cad.body_generated_references or topology readiness for a valid public edge reference; do not guess IDs.",
      exactlyOne("edgeStableId", "namedReference", "topologyAnchorId")
    ),
    op(
      "feature.updateFillet",
      ["id", "radius"],
      { id, radius: positive },
      "Revise the radius of an existing fillet."
    ),
    op(
      "feature.linearPattern",
      ["spacing", "instanceCount"],
      { ...featureFields, ...seed, ...linear },
      "Pattern one body or one completed feature. seedFeatureId repeats that feature's operation; seedBodyId copies the whole body. instanceCount includes the original.",
      {
        ...exactlyOne("seedBodyId", "seedFeatureId"),
        anyOf: [{ required: ["axis"] }, { required: ["direction"] }]
      }
    ),
    op(
      "feature.circularPattern",
      ["rotationAxis", "totalAngleDegrees", "instanceCount"],
      { ...featureFields, ...seed, ...circular },
      "Circular pattern around a required rotationAxis, such as 'z'. Use totalAngleDegrees: 360 for a full circle. instanceCount includes the original; seedFeatureId repeats an operation such as a mounting hole.",
      exactlyOne("seedBodyId", "seedFeatureId")
    ),
    op(
      "feature.updateLinearPattern",
      ["id"],
      { id, ...linear },
      "Revise pattern spacing, count, or direction."
    ),
    op(
      "feature.updateCircularPattern",
      ["id"],
      { id, ...circular },
      "Revise circular pattern angle, count, or rotation axis."
    ),
    op(
      "feature.shell",
      ["targetBodyId", "wallThickness"],
      { ...featureFields, targetBodyId: id, ...shell },
      "Hollow a solid by wallThickness. openFaceRefs selects faces to remove; omit it for a closed shell. Get face references from cad.body_generated_references or topology readiness."
    ),
    op(
      "feature.updateShell",
      ["id"],
      { id, ...shell },
      "Revise shell wall thickness or removed faces."
    ),
    op(
      "assembly.create",
      [],
      { id, name: id },
      "Create an assembly container for shared solid-body instances."
    ),
    op(
      "assembly.instance.insert",
      ["assemblyId", "definition"],
      {
        id,
        assemblyId: id,
        name: id,
        definition,
        transform
      },
      "Insert an instance of a finished body without duplicating its geometry. Transform defaults to identity."
    ),
    op(
      "assembly.instance.updateTransform",
      ["assemblyId", "instanceId", "transform"],
      {
        assemblyId: id,
        instanceId: id,
        transform: { ...transform, minProperties: 1 }
      },
      "Update a free instance or fixed root's pose in place, preserving omitted fields and propagating connected descendants. Edit a constrained child's mate to change its pose."
    ),
    op(
      "assembly.instance.replace",
      ["assemblyId", "instanceId", "definition"],
      { assemblyId: id, instanceId: id, definition },
      "Replace an instance's body definition while preserving its ID, name and transform. Retained mate references must remain valid."
    ),
    op(
      "assembly.instance.delete",
      ["assemblyId", "instanceId"],
      { assemblyId: id, instanceId: id },
      "Delete an instance and cascade-delete its referencing mates."
    ),
    op(
      "assembly.mate.delete",
      ["assemblyId", "mateId"],
      { assemblyId: id, mateId: id },
      "Delete a mate while retaining its instances."
    ),
    ...["create", "edit"].flatMap((action) => {
      const fields = {
        assemblyId: id,
        name: id,
        ...(action === "create" ? { id } : { mateId: id })
      };
      const required =
        action === "create" ? ["assemblyId"] : ["assemblyId", "mateId"];
      const editNote =
        action === "edit"
          ? " Full replacement: include kind, references and value/binding fields; omitted name is preserved."
          : "";
      return [
        op(
          `assembly.mate.${action}`,
          [...required, "kind", "instanceId"],
          { ...fields, kind: { const: "fixed" }, instanceId: id },
          `Ground one instance before adding relational mates. Connected constraints form a rooted forest; conflicting roots, cycles and multiple parents reject.${editNote}`
        ),
        ...["coincident", "concentric", "distance"].map((kind) =>
          op(
            `assembly.mate.${action}`,
            [...required, "kind", "primary", "secondary"],
            {
              ...fields,
              kind: { const: kind },
              primary: kind === "concentric" ? axisRef : planeRef,
              secondary: kind === "concentric" ? axisRef : planeRef,
              ...(kind === "distance"
                ? {
                    distance: {
                      ...number,
                      description:
                        "Signed plane separation in document units; mutually exclusive with distanceParameterId."
                    },
                    distanceParameterId: {
                      ...id,
                      description:
                        "Parameter ID; its evaluated numeric value drives plane separation in document units."
                    }
                  }
                : {})
            },
            `Constrain two instances connected to a fixed root. References are definition-local standard planes or axes; the unconstrained degrees of freedom are preserved.${editNote}`,
            kind === "distance"
              ? exactlyOne("distance", "distanceParameterId")
              : {}
          )
        ),
        op(
          `assembly.mate.${action}`,
          [...required, "kind", "primary", "secondary"],
          {
            ...fields,
            kind: { const: "revolute" },
            primary: frameRef,
            secondary: frameRef,
            angleDegrees: {
              ...number,
              description:
                "Signed rotation about primary frame Z, in degrees; mutually exclusive with angleParameterId."
            },
            angleParameterId: {
              ...id,
              description:
                "Parameter ID; its evaluated numeric value is interpreted in degrees."
            },
            offset: {
              ...number,
              description:
                "Signed separation along primary frame Z in document units; default 0, mutually exclusive with offsetParameterId."
            },
            offsetParameterId: {
              ...id,
              description:
                "Parameter ID; its evaluated numeric value sets separation along primary frame Z in document units."
            }
          },
          `Connect complete joint frames and solve the child pose at an angle about primary Z. Instances require unit scale. Sketch frames follow authored geometry; local frames retain numeric coordinates.${editNote}`,
          {
            ...exactlyOne("angleDegrees", "angleParameterId"),
            not: { required: ["offset", "offsetParameterId"] }
          }
        )
      ];
    })
  ];
}
