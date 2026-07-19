import {
  UI_ACTION_METADATA,
  type UiActionId,
  type WorkbenchMode
} from "../actions/actionRegistry";

export type V18RetirementSlice = "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type CapabilitySurface =
  | "registry-action"
  | "field-edit"
  | "tree-operation"
  | "sketch-gesture"
  | "viewport-gesture"
  | "display-only"
  | "advanced-operation";

export type CapabilityEffect =
  | {
      readonly kind: "cadops";
      readonly builder: string;
    }
  | {
      readonly kind: "ui-only";
      readonly effect: string;
    };

export interface V18CapabilityManifestRow {
  readonly id: `v18.capability.${string}`;
  readonly source: "v17" | "v18-contract";
  readonly label: string;
  readonly surface: CapabilitySurface;
  readonly legacyOwner: string;
  readonly legacyHandler: string;
  readonly v18Mode: WorkbenchMode;
  readonly v18Owner: string;
  readonly editor?: string;
  readonly actionId?: UiActionId;
  readonly availabilityAuthority: string;
  readonly effect: CapabilityEffect;
  readonly parityTest: string;
  readonly retirementSlice: V18RetirementSlice;
}

interface ActionAuditDetail {
  readonly source?: V18CapabilityManifestRow["source"];
  readonly legacyOwner: string;
  readonly legacyHandler: string;
  readonly availabilityAuthority: string;
  readonly effect: CapabilityEffect;
  readonly parityTest: string;
  readonly retirementSlice: V18RetirementSlice;
  readonly v18Owner?: string;
  readonly editor?: string;
}

const cadops = (builder: string): CapabilityEffect => ({
  kind: "cadops",
  builder
});
const uiOnly = (effect: string): CapabilityEffect => ({
  kind: "ui-only",
  effect
});

/**
 * Audit detail is intentionally explicit. A registry item cannot be added
 * without naming the V17 delegate/effect and its parity evidence here.
 */
const ACTION_AUDIT_BY_ID = {
  "project.new": audit(
    "App.tsx",
    "new document integration (V18 owner)",
    "ui:dirty-draft guard",
    uiOnly("replace the active session with a new empty CadEngine document"),
    "actions/actionRegistry.test.ts",
    "G",
    { source: "v18-contract" }
  ),
  "project.open": audit(
    "ProjectJsonPanel",
    "openProjectWcad / importProjectWcadBytes",
    "projectStorageCapabilities + WCAD validation",
    uiOnly(
      "open validated .wcad through readCadProjectWcad, preserving the current project on failure"
    ),
    "projectWcadWorkflow.test.ts",
    "G"
  ),
  "project.save": audit(
    "ProjectJsonPanel",
    "saveProjectWcad",
    "projectStorageCapabilities + ProjectFileWorkflowState",
    uiOnly(
      "save the current .wcad through the existing file handle or Save As fallback"
    ),
    "projectWcadWorkflow.test.ts",
    "G"
  ),
  "project.save-as": audit(
    "ProjectJsonPanel",
    "saveProjectWcadAs",
    "projectStorageCapabilities",
    uiOnly("write or download the existing .wcad package export"),
    "projectWcadWorkflow.test.ts",
    "G"
  ),
  "project.import-step": audit(
    "ProjectJsonPanel",
    "openProjectStepImport / importProjectStepBytes",
    "project.importReadiness + STEP resolver",
    uiOnly("import the validated STEP result through the existing import plan"),
    "projectStepImportResolver.test.ts",
    "G"
  ),
  "project.import-json": audit(
    "ProjectJsonPanel",
    "importProjectJson",
    "project.importReadiness",
    uiOnly("import a validated JSON project with importCadProjectJson"),
    "projectJson.test.ts",
    "G"
  ),
  "project.export-json": audit(
    "ProjectJsonPanel",
    "exportProjectJson",
    "project snapshot",
    uiOnly("generate JSON with exportCadProjectJson"),
    "projectJson.test.ts",
    "G"
  ),
  "project.download-json": audit(
    "ProjectJsonPanel",
    "downloadProjectJson",
    "projectStorageCapabilities.jsonDownloadAvailable",
    uiOnly("download exportCadProjectJson output"),
    "modes/project/ProjectWorkspace.test.tsx",
    "G"
  ),
  "project.export-step": audit(
    "ProjectJsonPanel",
    "downloadExactStepExport",
    "readProjectExactStepExport",
    uiOnly("execute and download the existing exact STEP export"),
    "projectExactStepExport.test.ts",
    "G"
  ),
  "project.export-glb": audit(
    "ProjectJsonPanel",
    "downloadVisualizationMeshExport",
    "createVisualizationMeshExportStatus",
    uiOnly("download the existing visualization GLB artifact"),
    "visualizationMeshExport.test.ts",
    "G"
  ),
  "project.overview": navAudit(
    "Project/File utility tab",
    "open Project Overview",
    "G"
  ),
  "project.files": navAudit("ProjectJsonPanel", "open Project Files", "G"),
  "project.parameters": navAudit(
    "SketchPanel parameter section",
    "open Parameters",
    "G"
  ),
  "project.history": navAudit("HistoryPanel", "open History", "G"),
  "project.export": navAudit(
    "ProjectJsonPanel export section",
    "open Export",
    "G"
  ),
  "project.create-parameter": audit(
    "SketchPanel",
    "createParameter",
    "parameter form validation",
    cadops("buildCreateParameterOp"),
    "modes/project/ProjectWorkspace.test.tsx",
    "G",
    { editor: "ParameterEditor" }
  ),
  "project.undo": audit(
    "App header / HistoryPanel",
    "undo",
    "CadEngine.canUndo + pending state",
    uiOnly("CadEngine.undo through the existing App integration"),
    "transactionHistoryDisplay.test.ts",
    "B"
  ),
  "project.redo": audit(
    "App header / HistoryPanel",
    "redo",
    "CadEngine.canRedo + pending state",
    uiOnly("CadEngine.redo through the existing App integration"),
    "transactionHistoryDisplay.test.ts",
    "B"
  ),

  "solid.box": primitiveAudit(
    "Box",
    "createBox",
    "createQuickStartSourceBodyPlan",
    "quickStartBodies.test.ts"
  ),
  "solid.cylinder": primitiveAudit(
    "Cylinder",
    "createCylinder",
    "createQuickStartSourceBodyPlan",
    "quickStartBodies.test.ts"
  ),
  "solid.sphere": primitiveAudit(
    "Sphere",
    "createSphere",
    "buildCreateSphereOp",
    "cadCommands.test.ts"
  ),
  "solid.cone": primitiveAudit(
    "Cone",
    "createCone",
    "buildCreateConeOp",
    "cadCommands.test.ts"
  ),
  "solid.torus": primitiveAudit(
    "Torus",
    "createTorus",
    "buildCreateTorusOp",
    "cadCommands.test.ts"
  ),
  "solid.sketch": audit(
    "ModelingActionsPanel / SketchPanel",
    "createSketch",
    "ui:collector complete",
    cadops("buildCreateSketchOp"),
    "modes/solid/SolidModePanel.test.tsx",
    "D",
    { editor: "SketchEditor" }
  ),
  "solid.extrude": featureAudit(
    "Extrude",
    "createCompositeExtrude / extrudeSketchEntity",
    "sketch.profileCandidates + target readiness",
    "buildFeatureExtrudeOp / buildFeatureCompositeExtrudeOp",
    "v17CompositeExtrudeIntegration.test.ts"
  ),
  "solid.revolve": featureAudit(
    "Revolve",
    "createCompositeRevolve / revolveSketchEntity",
    "sketch.profileCandidates + revolve-axis options",
    "buildFeatureRevolveOp / buildFeatureCompositeRevolveOp",
    "v17CompositeRevolveIntegration.test.ts"
  ),
  "solid.sweep": featureAudit(
    "Sweep",
    "createCompositeSweep / createSweep",
    "sketch.profileCandidates + sketch.pathCandidates",
    "buildFeatureSweepOp / buildFeatureCompositeSweepOp",
    "v17ProductIntegration.test.ts"
  ),
  "solid.loft": featureAudit(
    "Loft",
    "createLoft",
    "sketch.profileCandidates + loft section matrix",
    "buildFeatureLoftOp",
    "modelingActions.test.ts"
  ),
  "solid.transform": audit(
    "Inspector",
    "updateSelectedTransform",
    "selected editable object",
    cadops("buildUpdateTransformOp"),
    "modes/inspect/InspectPanel.test.tsx",
    "D",
    { editor: "PrimitiveEditor" }
  ),
  "solid.hole": featureAudit(
    "Hole",
    "holeSketchEntity",
    "topology.commandTargetReadiness + geometry preflight",
    "buildFeatureHoleOp",
    "v14ResultHoleWorkflow.test.ts"
  ),
  "solid.fillet": featureAudit(
    "Fillet",
    "createEdgeFinish",
    "selection.referenceCandidates",
    "buildFeatureFilletOp",
    "edgeFinishUi.test.ts"
  ),
  "solid.chamfer": featureAudit(
    "Chamfer",
    "createEdgeFinish",
    "selection.referenceCandidates",
    "buildFeatureChamferOp",
    "edgeFinishUi.test.ts"
  ),
  "solid.shell": featureAudit(
    "Shell",
    "createShell",
    "selection.referenceCandidates",
    "buildFeatureShellOp",
    "modelingActions.test.ts"
  ),
  "solid.linear-pattern": featureAudit(
    "Linear Pattern",
    "createLinearPattern",
    "body/feature selection",
    "buildFeatureLinearPatternOp",
    "patternPanelUi.test.ts"
  ),
  "solid.circular-pattern": featureAudit(
    "Circular Pattern",
    "createCircularPattern",
    "body/feature selection",
    "buildFeatureCircularPatternOp",
    "patternPanelUi.test.ts"
  ),
  "solid.mirror": featureAudit(
    "Mirror",
    "createMirror",
    "body/feature selection",
    "buildFeatureMirrorOp",
    "mirrorPanelUi.test.ts"
  ),
  "solid.edit": audit(
    "StructurePanel / Inspector / CompositeFeatureEditor",
    "selection + edit callback",
    "feature.editability",
    uiOnly("open the matching V18 editor without changing source"),
    "modes/solid/SolidModePanel.test.tsx",
    "D",
    { editor: "FeatureEditorShell" }
  ),
  "solid.rename": audit(
    "Inspector / SketchPanel",
    "renameSelectedObject / renameSketch",
    "selected semantic object kind",
    cadops(
      "buildRenameObjectOp / buildRenameSketchOp / inventoried entry-specific rename builder"
    ),
    "modes/inspect/InspectPanel.test.tsx",
    "C",
    { editor: "SelectionInspector" }
  ),
  "solid.delete": audit(
    "Inspector / StructurePanel / ModelingActionsPanel",
    "deleteSelectedObject / deleteSketch / deleteAuthoredFeature",
    "selected semantic target + pending state",
    cadops("buildDeleteObjectOp / buildDeleteSketchOp / buildFeatureDeleteOp"),
    "workbench/DocumentTreeDock.test.tsx",
    "C"
  ),
  "solid.measure": audit(
    "ViewportContextualCommandSurface / Inspector",
    "open measurement surface",
    "body/generated-reference measurement queries",
    uiOnly("enter Inspect with the eligible current selection"),
    "workbench/ContextualActionStrip.test.tsx",
    "F"
  ),

  "sketch.point": sketchEntityAudit("Point", "buildAddSketchPointOp"),
  "sketch.line": sketchEntityAudit("Line", "buildAddSketchLineOp"),
  "sketch.rectangle": sketchEntityAudit(
    "Rectangle",
    "buildAddSketchRectangleOp"
  ),
  "sketch.circle": sketchEntityAudit("Circle", "buildAddSketchCircleOp"),
  "sketch.arc": audit(
    "SketchPanel / SketchArcToolOverlay",
    "startThreePointArcTool / captureThreePointArcToolPick",
    "active sketch frame + three-point gesture state",
    cadops("buildAddSketchThreePointArcOp"),
    "v17ProductIntegration.test.ts",
    "E",
    { editor: "SketchWorkspace" }
  ),
  "sketch.construction": audit(
    "SketchPanel",
    "setSketchEntityConstruction",
    "selected sketch entity",
    cadops("buildSetSketchEntityConstructionOp"),
    "modes/sketch/SketchModeDock.test.tsx",
    "E",
    { editor: "SketchInspector" }
  ),
  "sketch.delete": audit(
    "SketchPanel",
    "deleteSketchEntity / deleteSketchDimension / deleteSketchConstraint",
    "selected sketch item",
    cadops(
      "buildDeleteSketchEntityOp / buildDeleteSketchDimensionOp / buildDeleteSketchConstraintOp"
    ),
    "modes/sketch/SketchModeDock.test.tsx",
    "E"
  ),
  "sketch.horizontal": constraintAudit("Horizontal"),
  "sketch.vertical": constraintAudit("Vertical"),
  "sketch.fixed": constraintAudit("Fixed"),
  "sketch.coincident": constraintAudit("Coincident"),
  "sketch.midpoint": constraintAudit("Midpoint"),
  "sketch.parallel": constraintAudit("Parallel"),
  "sketch.perpendicular": constraintAudit("Perpendicular"),
  "sketch.rectangle-width": dimensionAudit("Rectangle width"),
  "sketch.rectangle-height": dimensionAudit("Rectangle height"),
  "sketch.line-length": dimensionAudit("Line length"),
  "sketch.radius": dimensionAudit("Circle/arc radius"),
  "sketch.arc-sweep": dimensionAudit("Arc sweep"),
  "sketch.finish": audit(
    "SketchPanel / App utility tabs",
    "focusSketch / mode navigation",
    "ui:active sketch",
    uiOnly("leave Sketch mode without a source mutation"),
    "modes/sketch/SketchModeDock.test.tsx",
    "E",
    { source: "v18-contract", v18Owner: "SketchMode" }
  ),

  "inspect.measure": audit(
    "Inspector / ViewportContextualCommandSurface",
    "select measurement surface",
    "object/body/generated-reference measurement queries",
    uiOnly("show existing measurement projections"),
    "viewportMeasurementOverlay.test.ts",
    "F"
  ),
  "inspect.measure-between": audit(
    "ViewportContextualCommandSurface",
    "startViewportTwoTargetMeasurement / setSecondViewportTwoTargetMeasurement",
    "eligible session targets",
    uiOnly("update session-only two-target measurement state"),
    "viewportTwoTargetMeasurement.test.ts",
    "F"
  ),
  "inspect.mass-properties": audit(
    "Inspector",
    "readBodyMassProperties",
    "matching derived exact metadata",
    uiOnly("show query-backed mass properties"),
    "derivedExactMetadata.test.ts",
    "F"
  ),
  "inspect.name-reference": audit(
    "Inspector / ViewportContextualCommandSurface",
    "nameGeneratedReference",
    "selection.referenceCandidates",
    cadops("buildNameGeneratedReferenceOp"),
    "viewportReferenceActions.test.ts",
    "F",
    { editor: "NamedReferenceEditor" }
  ),
  "inspect.repair-reference": audit(
    "Inspector / ViewportContextualCommandSurface",
    "repairNamedReference / repairStableTopologyReference",
    "reference health + topology repair plan",
    cadops(
      "buildRepairNamedReferenceOp / buildRepairNamedReferenceToTopologyAnchorOp / topology repair plan ops"
    ),
    "namedReferenceRepairUi.test.ts",
    "F",
    { editor: "NamedReferenceEditor" }
  ),
  "inspect.fit-all": viewportAudit(
    "fitView",
    "viewport camera reducer fitAll",
    "components/ViewportCanvas.test.tsx"
  ),
  "inspect.fit-selection": viewportAudit(
    "fitSelectedView",
    "viewport camera reducer fitSelected",
    "components/ViewportCanvas.test.tsx"
  ),
  "inspect.top": viewportAudit(
    "setStandardView(top)",
    "viewport camera reducer standardView",
    "viewportCamera.test.ts"
  ),
  "inspect.front": viewportAudit(
    "setStandardView(front)",
    "viewport camera reducer standardView",
    "viewportCamera.test.ts"
  ),
  "inspect.right": viewportAudit(
    "setStandardView(right)",
    "viewport camera reducer standardView",
    "viewportCamera.test.ts"
  ),
  "inspect.isometric": viewportAudit(
    "setStandardView(isometric)",
    "viewport camera reducer standardView",
    "viewportCamera.test.ts"
  ),
  "inspect.health": audit(
    "Inspector / StructurePanel / ProjectJsonPanel",
    "health projections",
    "project.health + reference.health + topology readiness",
    uiOnly("open query-backed health summaries"),
    "projectTopologyIdentityStatus.test.ts",
    "F"
  )
} as const satisfies Record<UiActionId, ActionAuditDetail>;

const ACTION_CAPABILITIES: readonly V18CapabilityManifestRow[] =
  UI_ACTION_METADATA.map((action) => {
    const audit = ACTION_AUDIT_BY_ID[action.id];
    return {
      id: `v18.capability.action.${action.id}`,
      source: audit.source ?? "v17",
      label: action.label,
      surface: "registry-action",
      legacyOwner: audit.legacyOwner,
      legacyHandler: audit.legacyHandler,
      v18Mode: action.id.split(".")[0] as WorkbenchMode,
      v18Owner:
        audit.v18Owner ??
        `${capitalize(action.id.split(".")[0] ?? "solid")}Mode`,
      ...(audit.editor ? { editor: audit.editor } : {}),
      actionId: action.id,
      availabilityAuthority: audit.availabilityAuthority,
      effect: audit.effect,
      parityTest: audit.parityTest,
      retirementSlice: audit.retirementSlice
    };
  });

const NON_REGISTRY_CAPABILITIES = [
  nonAction(
    "primitive-draft-fields",
    "Primitive dimension and transform draft fields",
    "field-edit",
    "App quick-create toolbar",
    "quick primitive form setters",
    "solid",
    "PrimitiveEditor",
    "ui:local draft validation",
    uiOnly("edit local draft until Apply"),
    "featureFormDefaults.test.ts",
    "D"
  ),
  nonAction(
    "primitive-edit-fields",
    "Primitive name, dimensions, and transform edits",
    "field-edit",
    "Inspector",
    "updateSelectedDimensions / updateSelectedTransform / renameSelectedObject",
    "solid",
    "PrimitiveEditor",
    "selected object kind",
    cadops(
      "buildUpdate*DimensionsOp / buildUpdateTransformOp / buildRenameObjectOp"
    ),
    "modes/inspect/InspectPanel.test.tsx",
    "D"
  ),
  nonAction(
    "units-update",
    "Relabel or convert document units",
    "field-edit",
    "App header",
    "updateDocumentUnits",
    "project",
    "ProjectOverview",
    "document units + selected update mode",
    cadops("buildUpdateUnitsOp"),
    "cadCommands.test.ts",
    "G"
  ),
  nonAction(
    "parameter-edit",
    "Edit parameter value, expression, name, and description",
    "field-edit",
    "SketchPanel",
    "applyParameterEdit",
    "project",
    "ParameterEditor",
    "project.parameterEvaluation",
    cadops("buildParameterEditOps"),
    "modes/sketch/SketchModeDock.test.tsx",
    "G"
  ),
  nonAction(
    "parameter-delete",
    "Delete parameter",
    "tree-operation",
    "SketchPanel",
    "deleteParameter",
    "project",
    "ParameterEditor",
    "selected parameter",
    cadops("buildDeleteParameterOp"),
    "modes/sketch/SketchModeDock.test.tsx",
    "G"
  ),
  nonAction(
    "feature-edit-fields",
    "Edit every supported authored feature field",
    "field-edit",
    "Inspector / CompositeFeatureEditor / ModelingActionsPanel",
    "updateAuthored* callbacks",
    "solid",
    "per-feature field groups",
    "feature.editability + feature-specific readiness",
    cadops(
      "buildFeatureUpdateExtrudeOp / buildFeatureUpdateCompositeExtrudeOp / buildFeatureUpdateRevolveOp / buildFeatureUpdateCompositeRevolveOp / buildFeatureUpdateCompositeSweepOp / buildFeatureUpdateHoleOp / buildFeatureUpdateChamferOp / buildFeatureUpdateFilletOp / buildFeatureUpdateLinearPatternOp / buildFeatureUpdateCircularPatternOp / buildFeatureUpdateMirrorOp / buildFeatureUpdateShellOp"
    ),
    "modes/solid/SolidModePanel.test.tsx",
    "D"
  ),
  nonAction(
    "sketch-entity-edit",
    "Edit supported sketch entity geometry",
    "field-edit",
    "SketchPanel / SketchViewportDragOverlay",
    "updateSketchEntity / previewSketchEntityUpdate",
    "sketch",
    "SketchInspector",
    "sketch solver dry-run",
    cadops("buildUpdateSketchEntityOp"),
    "components/SketchViewportDragOverlay.test.tsx",
    "E"
  ),
  nonAction(
    "dimension-edit",
    "Edit or rename a loaded sketch dimension",
    "field-edit",
    "SketchPanel",
    "applySketchDimensionEdit",
    "sketch",
    "SketchInspector",
    "sketch evaluation + local form validation",
    cadops("buildSketchDimensionEditOps"),
    "modes/sketch/SketchModeDock.test.tsx",
    "E"
  ),
  nonAction(
    "constraint-loaded-record-edit",
    "Rename loaded constraint records and retain unsupported kinds",
    "field-edit",
    "SketchPanel",
    "applySketchConstraintEdit",
    "sketch",
    "SketchInspector",
    "loaded constraint kind + editable fields",
    cadops("buildSketchConstraintEditOps"),
    "modes/sketch/SketchModeDock.test.tsx",
    "E"
  ),
  nonAction(
    "tree-expand",
    "Expand and collapse semantic tree rows",
    "tree-operation",
    "StructurePanel",
    "local disclosure state",
    "solid",
    "DocumentTreeDock",
    "ui:row has children",
    uiOnly("change expanded row UI state"),
    "workbench/DocumentTreeDock.test.tsx",
    "C"
  ),
  nonAction(
    "tree-select",
    "Select semantic tree rows",
    "tree-operation",
    "StructurePanel",
    "selectObject / focusSketch / selectGeneratedReference",
    "solid",
    "DocumentTreeDock",
    "shared semantic projection",
    uiOnly("update semantic UI selection"),
    "workbench/DocumentTreeDock.test.tsx",
    "C"
  ),
  nonAction(
    "tree-inspect-named-reference",
    "Inspect a named reference from the tree",
    "tree-operation",
    "StructurePanel",
    "inspectNamedReference",
    "inspect",
    "DocumentTreeDock",
    "reference.resolveNamed",
    uiOnly("resolve and select the named reference"),
    "workbench/DocumentTreeDock.test.tsx",
    "C"
  ),
  nonAction(
    "three-point-arc-hover",
    "Preview the three-point arc gesture",
    "sketch-gesture",
    "SketchArcToolOverlay / App",
    "hoverThreePointArcTool",
    "sketch",
    "SketchWorkspace",
    "active sketch display frame",
    uiOnly("update transient three-point arc hover"),
    "v17ProductIntegration.test.ts",
    "E"
  ),
  nonAction(
    "three-point-arc-cancel",
    "Cancel the active three-point arc gesture",
    "sketch-gesture",
    "App keyboard handler",
    "clearViewportTransientState",
    "sketch",
    "SketchWorkspace",
    "ui:active gesture",
    uiOnly("discard transient arc session without mutation"),
    "viewportKeyboard.test.ts",
    "E"
  ),
  nonAction(
    "sketch-drag-preview",
    "Preview supported sketch entity drag",
    "sketch-gesture",
    "SketchViewportDragOverlay",
    "previewSketchEntityUpdate",
    "sketch",
    "SketchWorkspace",
    "command dry-run",
    uiOnly("render a provisional entity overlay"),
    "sketchViewportDrag.test.ts",
    "E"
  ),
  nonAction(
    "viewport-orbit",
    "Orbit the viewport",
    "viewport-gesture",
    "ViewportCanvas",
    "pointer camera reducer",
    "solid",
    "PersistentViewport",
    "ui:pointer gesture",
    uiOnly("update camera only"),
    "viewportCamera.test.ts",
    "B"
  ),
  nonAction(
    "viewport-pan",
    "Pan the viewport",
    "viewport-gesture",
    "ViewportCanvas",
    "pointer camera reducer",
    "solid",
    "PersistentViewport",
    "ui:pointer gesture",
    uiOnly("update camera only"),
    "viewportCamera.test.ts",
    "B"
  ),
  nonAction(
    "viewport-zoom",
    "Zoom the viewport",
    "viewport-gesture",
    "ViewportCanvas",
    "wheel / zoom buttons",
    "solid",
    "PersistentViewport",
    "ui:pointer or camera control",
    uiOnly("update camera only"),
    "viewportCamera.test.ts",
    "B"
  ),
  nonAction(
    "viewport-reset",
    "Reset the viewport camera",
    "viewport-gesture",
    "ViewportCanvas",
    "resetView",
    "inspect",
    "PersistentViewport",
    "ui:camera",
    uiOnly("reset the camera"),
    "components/ViewportCanvas.test.tsx",
    "F"
  ),
  nonAction(
    "semantic-pick",
    "Select a body, supported face, or supported edge",
    "viewport-gesture",
    "ViewportCanvas / App",
    "selectViewportPick",
    "solid",
    "PersistentViewport",
    "renderer-agnostic pick intent + selection.referenceCandidates",
    uiOnly("update semantic selection"),
    "viewportPickIntent.test.ts",
    "C"
  ),
  nonAction(
    "semantic-hover",
    "Preselect a semantic viewport target",
    "viewport-gesture",
    "ViewportCanvas / App",
    "hoverViewportPick",
    "solid",
    "PersistentViewport",
    "renderer-agnostic pick intent",
    uiOnly("update semantic hover state"),
    "viewportHoverIntent.test.ts",
    "B"
  ),
  nonAction(
    "measurement-clear",
    "Clear two-target measurement capture",
    "advanced-operation",
    "ViewportContextualCommandSurface",
    "clearViewportTwoTargetMeasurement",
    "inspect",
    "InspectMode",
    "ui:measurement session",
    uiOnly("clear session-only measurement state"),
    "viewportTwoTargetMeasurement.test.ts",
    "F"
  ),
  nonAction(
    "topology-anchor-create",
    "Save a stable topology reference",
    "advanced-operation",
    "Inspector",
    "createStableTopologyReference",
    "inspect",
    "NamedReferenceEditor",
    "topology anchor creation plan + dry-run",
    cadops("topology anchor creation plan ops"),
    "topologyRepairCandidatesUi.test.ts",
    "F"
  ),
  nonAction(
    "topology-anchor-preview",
    "Preview compatible topology repair candidates",
    "advanced-operation",
    "Inspector",
    "previewStableTopologyRepair",
    "inspect",
    "NamedReferenceEditor",
    "topology anchor repair plan",
    uiOnly("show query/plan-backed repair candidates"),
    "topologyRepairCandidatesUi.test.ts",
    "F"
  ),
  nonAction(
    "named-reference-delete",
    "Delete a named reference",
    "tree-operation",
    "Inspector",
    "deleteNamedReference",
    "inspect",
    "NamedReferenceEditor",
    "selected named reference",
    cadops("buildDeleteNamedReferenceOp"),
    "viewportReferenceActions.test.ts",
    "F"
  ),
  nonAction(
    "project-json-draft",
    "Edit the Advanced Interchange JSON draft",
    "field-edit",
    "ProjectJsonPanel",
    "onProjectJsonChange",
    "project",
    "AdvancedInterchange",
    "ui:local JSON draft",
    uiOnly("edit local JSON text without source mutation"),
    "modes/project/ProjectWorkspace.test.tsx",
    "G"
  ),
  nonAction(
    "wcad-upload-fallback",
    "Upload .wcad without File System Access",
    "advanced-operation",
    "ProjectJsonPanel",
    "loadProjectWcadFile / importProjectWcadBytes",
    "project",
    "ProjectFiles",
    "projectStorageCapabilities.wcadUploadAvailable",
    uiOnly("read and validate an uploaded .wcad"),
    "modes/project/ProjectWorkspace.test.tsx",
    "G"
  ),
  nonAction(
    "step-upload-fallback",
    "Upload STEP without File System Access",
    "advanced-operation",
    "ProjectJsonPanel",
    "loadStepFile / importProjectStepBytes",
    "project",
    "ProjectFiles",
    "projectStorageCapabilities.stepUploadAvailable",
    uiOnly("read and validate an uploaded STEP file"),
    "modes/project/ProjectWorkspace.test.tsx",
    "G"
  ),
  nonAction(
    "opfs-cache-refresh",
    "Refresh local derived cache status",
    "advanced-operation",
    "ProjectJsonPanel",
    "refreshProjectOpfsCache",
    "project",
    "TechnicalDetails",
    "projectStorageCapabilities.opfsApiDetected",
    uiOnly("inspect the existing app-local derived cache"),
    "projectOpfsCache.test.ts",
    "G"
  ),
  nonAction(
    "opfs-cache-clear",
    "Clear local derived cache",
    "advanced-operation",
    "ProjectJsonPanel",
    "clearProjectOpfsCache",
    "project",
    "TechnicalDetails",
    "projectStorageCapabilities.opfsApiDetected",
    uiOnly("clear only the existing app-local derived cache"),
    "projectOpfsCache.test.ts",
    "G"
  ),
  nonAction(
    "history-technical-diff",
    "Disclose a transaction semantic diff",
    "display-only",
    "HistoryPanel",
    "transaction row disclosure",
    "project",
    "ProjectHistory",
    "transaction history snapshot",
    uiOnly("show existing structured diff data"),
    "transactionHistoryDisplay.test.ts",
    "G"
  ),
  nonAction(
    "solver-state",
    "Show sketch solver status, degrees of freedom, dimensions, and constraints",
    "display-only",
    "SketchPanel / viewport overlays",
    "solver and evaluation projections",
    "sketch",
    "SketchWorkspace",
    "sketch.solverStatus + sketch.evaluate",
    uiOnly("render query-backed sketch state"),
    "sketchPanelUi.test.ts",
    "E"
  ),
  nonAction(
    "profile-path-candidates",
    "Show profile and path candidate readiness",
    "display-only",
    "SketchPanel / ModelingActionsPanel",
    "profile/path projections",
    "sketch",
    "SketchInspector",
    "sketch.profileCandidates + sketch.pathCandidates",
    uiOnly("render query-backed downstream readiness"),
    "v17ProductIntegration.test.ts",
    "E"
  ),
  nonAction(
    "selection-details",
    "Show object, body, feature, face, edge, and named-reference details",
    "display-only",
    "Inspector",
    "selection projections",
    "inspect",
    "InspectorDock",
    "document snapshots + selection/reference queries",
    uiOnly("render human-oriented semantic selection details"),
    "modes/inspect/InspectPanel.test.tsx",
    "F"
  )
] as const satisfies readonly V18CapabilityManifestRow[];

export const V18_CAPABILITY_MANIFEST: readonly V18CapabilityManifestRow[] = [
  ...ACTION_CAPABILITIES,
  ...NON_REGISTRY_CAPABILITIES
];

export const V18_FORBIDDEN_IMAGE_ONLY_CAPABILITY_IDS = [
  "sketch.trim",
  "sketch.extend",
  "sketch.offset",
  "sketch.mirror",
  "sketch.pattern",
  "sketch.snap-toggle",
  "sketch.grid-toggle",
  "sketch.auto-constraints-toggle",
  "sketch.tangent-create",
  "sketch.concentric-create",
  "sketch.equal-create",
  "sketch.angle-create",
  "sketch.symmetry-create",
  "inspect.vertex-filter",
  "inspect.section-view",
  "inspect.pin-measurement",
  "solid.offset-face",
  "solid.appearance",
  "project.part-number",
  "project.description",
  "project.export-scope",
  "project.export-units",
  "project.export-include-names"
] as const;

function audit(
  legacyOwner: string,
  legacyHandler: string,
  availabilityAuthority: string,
  effect: CapabilityEffect,
  parityTest: string,
  retirementSlice: V18RetirementSlice,
  overrides: Partial<
    Pick<ActionAuditDetail, "source" | "v18Owner" | "editor">
  > = {}
): ActionAuditDetail {
  return {
    legacyOwner,
    legacyHandler,
    availabilityAuthority,
    effect,
    parityTest,
    retirementSlice,
    ...overrides
  };
}

function navAudit(
  legacyOwner: string,
  effect: string,
  retirementSlice: V18RetirementSlice
): ActionAuditDetail {
  return audit(
    legacyOwner,
    "setActiveUtilityPanel / V18 mode navigation",
    "ui:dirty-draft navigation guard",
    uiOnly(effect),
    "actions/actionRegistry.test.ts",
    retirementSlice,
    { source: "v18-contract", v18Owner: "ProjectMode" }
  );
}

function primitiveAudit(
  label: string,
  handler: string,
  builder: string,
  parityTest: string
): ActionAuditDetail {
  return audit(
    "App quick-create toolbar",
    handler,
    "ui:valid primitive draft + pending state",
    cadops(builder),
    parityTest,
    "D",
    { editor: `${label}Editor` }
  );
}

function featureAudit(
  label: string,
  handler: string,
  authority: string,
  builder: string,
  parityTest: string
): ActionAuditDetail {
  return audit(
    "ModelingActionsPanel / CompositeFeaturePanel",
    handler,
    authority,
    cadops(builder),
    parityTest,
    "D",
    { editor: `${label.replace(/\s+/g, "")}Editor` }
  );
}

function sketchEntityAudit(label: string, builder: string): ActionAuditDetail {
  return audit(
    "SketchPanel / ModelingActionsPanel",
    "addSketchEntity",
    "active sketch + local entity form validation",
    cadops(builder),
    "sketchEntityForms.test.ts",
    "E",
    { editor: `${label}Tool` }
  );
}

function constraintAudit(label: string): ActionAuditDetail {
  return audit(
    "SketchPanel / ModelingActionsPanel",
    "createSketchConstraint",
    "createAvailableSketchConstraintKindOptions",
    cadops("buildCreateSketchConstraintOp"),
    "sketchPanelUi.test.ts",
    "E",
    { editor: `${label}ConstraintTool` }
  );
}

function dimensionAudit(label: string): ActionAuditDetail {
  return audit(
    "SketchPanel / ModelingActionsPanel",
    "createSketchDimension",
    "createAvailableSketchDimensionTargetOptions",
    cadops("buildCreateSketchDimensionOp"),
    "sketchPanelUi.test.ts",
    "E",
    { editor: `${label.replace(/\s+/g, "")}DimensionTool` }
  );
}

function viewportAudit(
  handler: string,
  effect: string,
  parityTest: string
): ActionAuditDetail {
  return audit(
    "ViewportCanvas",
    handler,
    "viewport bounds / semantic selection projection",
    uiOnly(effect),
    parityTest,
    "F",
    { v18Owner: "PersistentViewport" }
  );
}

function nonAction(
  id: string,
  label: string,
  surface: Exclude<CapabilitySurface, "registry-action">,
  legacyOwner: string,
  legacyHandler: string,
  v18Mode: WorkbenchMode,
  v18Owner: string,
  availabilityAuthority: string,
  effect: CapabilityEffect,
  parityTest: string,
  retirementSlice: V18RetirementSlice
): V18CapabilityManifestRow {
  return {
    id: `v18.capability.${id}`,
    source: "v17",
    label,
    surface,
    legacyOwner,
    legacyHandler,
    v18Mode,
    v18Owner,
    availabilityAuthority,
    effect,
    parityTest,
    retirementSlice
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}
