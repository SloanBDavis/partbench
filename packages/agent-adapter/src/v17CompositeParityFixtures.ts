export interface V17AdapterCompositeParityFixture {
  readonly ids: {
    readonly baseSketch: string;
    readonly baseProfile: string;
    readonly baseFeature: string;
    readonly baseBody: string;
    readonly topSketch: string;
    readonly topCircle: string;
    readonly topRectangle: string;
    readonly sweepProfileSketch: string;
    readonly sweepProfile: string;
    readonly sweepRetargetProfile: string;
    readonly pathSketch: string;
    readonly lead: string;
    readonly bend: string;
    readonly tail: string;
    readonly sweepFeature: string;
    readonly sweepBody: string;
    readonly loftFeature: string;
    readonly loftBody: string;
  };
  readonly setupBatches: readonly (readonly unknown[])[];
  readonly sweepCreate: Readonly<Record<string, unknown>>;
  readonly sweepUpdate: Readonly<Record<string, unknown>>;
  readonly loftCreate: Readonly<Record<string, unknown>>;
  readonly loftUpdate: Readonly<Record<string, unknown>>;
  readonly mixedSweep: Readonly<Record<string, unknown>>;
  readonly mixedLoft: Readonly<Record<string, unknown>>;
}

/** Shared JSON fixtures for agent, MCP, and stdio V17 command parity tests. */
export function createV17AdapterCompositeParityFixture(
  prefix: string
): V17AdapterCompositeParityFixture {
  const id = (suffix: string): string => `${prefix}_${suffix}`;
  const ids = {
    baseSketch: id("base_sketch"),
    baseProfile: id("base_profile"),
    baseFeature: id("base_feature"),
    baseBody: id("base_body"),
    topSketch: id("top_sketch"),
    topCircle: id("top_circle"),
    topRectangle: id("top_rectangle"),
    sweepProfileSketch: id("sweep_profiles"),
    sweepProfile: id("sweep_profile"),
    sweepRetargetProfile: id("sweep_retarget_profile"),
    pathSketch: id("path_sketch"),
    lead: id("lead"),
    bend: id("bend"),
    tail: id("tail"),
    sweepFeature: id("sweep_feature"),
    sweepBody: id("sweep_body"),
    loftFeature: id("loft_feature"),
    loftBody: id("loft_body")
  } as const;
  const sweepProfile = {
    kind: "entity",
    sketchId: ids.sweepProfileSketch,
    entityId: ids.sweepProfile
  } as const;
  const forwardPath = {
    kind: "chain",
    sketchId: ids.pathSketch,
    segments: [ids.lead, ids.bend, ids.tail].map((entityId) => ({
      entityId,
      orientation: "forward"
    }))
  } as const;
  const reversePath = {
    kind: "chain",
    sketchId: ids.pathSketch,
    segments: [ids.tail, ids.bend, ids.lead].map((entityId) => ({
      entityId,
      orientation: "reverse"
    }))
  } as const;
  const loftSections = [
    {
      profile: {
        kind: "entity",
        sketchId: ids.baseSketch,
        entityId: ids.baseProfile
      }
    },
    {
      profile: {
        kind: "entity",
        sketchId: ids.topSketch,
        entityId: ids.topCircle
      }
    }
  ] as const;

  return {
    ids,
    setupBatches: [
      [
        {
          op: "sketch.create",
          id: ids.baseSketch,
          name: "Adapter loft base",
          plane: "XY"
        },
        {
          op: "sketch.addRectangle",
          sketchId: ids.baseSketch,
          id: ids.baseProfile,
          center: [0, 0],
          width: 4,
          height: 3
        },
        {
          op: "feature.extrude",
          id: ids.baseFeature,
          bodyId: ids.baseBody,
          profile: {
            kind: "entity",
            sketchId: ids.baseSketch,
            entityId: ids.baseProfile
          },
          depth: 5,
          operationMode: "newBody"
        },
        {
          op: "sketch.create",
          id: ids.sweepProfileSketch,
          name: "Adapter sweep profiles",
          plane: "XY"
        },
        {
          op: "sketch.addCircle",
          sketchId: ids.sweepProfileSketch,
          id: ids.sweepProfile,
          center: [0, 0],
          radius: 0.2
        },
        {
          op: "sketch.addCircle",
          sketchId: ids.sweepProfileSketch,
          id: ids.sweepRetargetProfile,
          center: [2, 0],
          radius: 0.2
        },
        {
          op: "sketch.create",
          id: ids.pathSketch,
          name: "Adapter curved path",
          plane: "XZ"
        },
        {
          op: "sketch.addLine",
          sketchId: ids.pathSketch,
          id: ids.lead,
          start: [0, 0],
          end: [0, 2]
        },
        {
          op: "sketch.addArc",
          sketchId: ids.pathSketch,
          id: ids.bend,
          definition: {
            kind: "centerAngles",
            center: [1, 2],
            radius: 1,
            startAngleDegrees: 180,
            sweepAngleDegrees: -180
          }
        },
        {
          op: "sketch.addLine",
          sketchId: ids.pathSketch,
          id: ids.tail,
          start: [2, 2],
          end: [2, 0]
        }
      ],
      [
        {
          op: "sketch.createOnFace",
          id: ids.topSketch,
          name: "Adapter loft top",
          bodyId: ids.baseBody,
          faceStableId: `generated:face:${ids.baseBody}:endCap`
        },
        {
          op: "sketch.addCircle",
          sketchId: ids.topSketch,
          id: ids.topCircle,
          center: [0, 0],
          radius: 1
        },
        {
          op: "sketch.addRectangle",
          sketchId: ids.topSketch,
          id: ids.topRectangle,
          center: [0, 0],
          width: 2,
          height: 1
        }
      ]
    ],
    sweepCreate: {
      op: "feature.sweep",
      id: ids.sweepFeature,
      bodyId: ids.sweepBody,
      profile: sweepProfile,
      path: forwardPath
    },
    sweepUpdate: {
      op: "feature.updateSweep",
      id: ids.sweepFeature,
      profile: {
        ...sweepProfile,
        entityId: ids.sweepRetargetProfile
      },
      path: reversePath
    },
    loftCreate: {
      op: "feature.loft",
      id: ids.loftFeature,
      bodyId: ids.loftBody,
      sections: loftSections
    },
    loftUpdate: {
      op: "feature.updateLoft",
      id: ids.loftFeature,
      sections: [
        loftSections[0],
        {
          profile: {
            kind: "entity",
            sketchId: ids.topSketch,
            entityId: ids.topRectangle
          }
        }
      ]
    },
    mixedSweep: {
      op: "feature.sweep",
      id: id("mixed_sweep"),
      bodyId: id("mixed_sweep_body"),
      profile: sweepProfile,
      path: forwardPath,
      profileSketchId: ids.sweepProfileSketch,
      profileEntityId: ids.sweepProfile,
      pathSketchId: ids.pathSketch,
      pathEntityIds: [ids.lead, ids.bend, ids.tail]
    },
    mixedLoft: {
      op: "feature.loft",
      id: id("mixed_loft"),
      bodyId: id("mixed_loft_body"),
      sections: [
        { sketchId: ids.baseSketch, entityId: ids.baseProfile },
        loftSections[1]
      ]
    }
  };
}
