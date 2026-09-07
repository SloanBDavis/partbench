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
      plane: planes,
      offset: number,
      flip: { type: "boolean" }
    },
    ["instanceId", "plane"]
  );
  const axisRef = object(
    { instanceId: id, axis: { enum: ["X", "Y", "Z"] }, origin: vec3 },
    ["instanceId", "axis"]
  );

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
        definition: object({ kind: { const: "body" }, bodyId: id }),
        transform: object(
          { translation: vec3, rotation: vec3, scale: vec3 },
          []
        )
      },
      "Insert an instance of a finished body without duplicating its geometry. Transform defaults to identity."
    ),
    ...["create", "edit"].flatMap((action) => {
      const fields = {
        assemblyId: id,
        name: id,
        ...(action === "create" ? { id } : { mateId: id })
      };
      const required =
        action === "create" ? ["assemblyId"] : ["assemblyId", "mateId"];
      return [
        op(
          `assembly.mate.${action}`,
          [...required, "kind", "instanceId"],
          { ...fields, kind: { const: "fixed" }, instanceId: id },
          "Ground one instance before adding relational mates."
        ),
        ...["coincident", "concentric", "distance"].map((kind) =>
          op(
            `assembly.mate.${action}`,
            [
              ...required,
              "kind",
              "primary",
              "secondary",
              ...(kind === "distance" ? ["distance"] : [])
            ],
            {
              ...fields,
              kind: { const: kind },
              primary: kind === "concentric" ? axisRef : planeRef,
              secondary: kind === "concentric" ? axisRef : planeRef,
              ...(kind === "distance" ? { distance: number } : {})
            },
            "Constrain two instances. One side must already be grounded; references are definition-local standard planes or axes."
          )
        )
      ];
    })
  ];
}
