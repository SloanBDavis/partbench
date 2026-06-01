import type {
  CadFeatureSummary,
  SketchEntityKind
} from "@web-cad/cad-protocol";
import type {
  ModelingActionDescriptor,
  ModelingSelectionContext
} from "../modelingActions";
import { formatGeneratedReferenceKind } from "../generatedReferenceUi";
import { formatSketchEntity } from "../sketchEntityForms";

export interface ModelingActionsPanelProps {
  readonly actions: readonly ModelingActionDescriptor[];
  readonly context: ModelingSelectionContext;
  readonly disabled?: boolean;
  readonly onAction?: (action: ModelingActionDescriptor) => void;
}

export interface ModelingSelectionSummary {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail?: string;
}

export interface ModelingActionDisplay {
  readonly category: string;
  readonly controlLabel: string;
  readonly detail: string;
  readonly status: "available" | "unavailable";
}

export function ModelingActionsPanel({
  actions,
  context,
  disabled = false,
  onAction
}: ModelingActionsPanelProps) {
  const summary = formatModelingSelectionSummary(context);

  return (
    <section className="modeling-actions-panel" aria-label="Modeling actions">
      <div className="modeling-actions-heading">
        <div>
          <h2>Actions</h2>
          <small>{summary.eyebrow}</small>
        </div>
        <span>{actions.length}</span>
      </div>

      <div className="modeling-selection-summary">
        <strong>{summary.title}</strong>
        {summary.detail && <small>{summary.detail}</small>}
      </div>

      {actions.length === 0 ? (
        <p className="empty-state compact">No actions for this selection.</p>
      ) : (
        <ul className="modeling-action-list">
          {actions.map((action) => {
            const display = createModelingActionDisplay(action);
            const isDisabled = disabled || !action.available;

            return (
              <li
                key={action.id}
                className={`modeling-action-card ${display.status}`}
              >
                <div className="modeling-action-copy">
                  <div className="modeling-action-title">
                    <strong>{action.label}</strong>
                    <span>{display.category}</span>
                  </div>
                  <small>{display.detail}</small>
                </div>
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onAction?.(action)}
                >
                  {display.controlLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatModelingSelectionSummary(
  context: ModelingSelectionContext
): ModelingSelectionSummary {
  switch (context.selectionKind) {
    case "none":
      return {
        eyebrow: "No selection",
        title: "No modeling context selected",
        detail: "Start from a sketch, body, or generated reference."
      };
    case "sketch":
      return {
        eyebrow: "Sketch",
        title: context.sketch.name,
        detail: `${formatSketchPlane(context.sketch.plane)} plane / ${
          context.sketch.entities.length
        } entities`
      };
    case "sketchEntity":
      return {
        eyebrow: "Sketch entity",
        title: `${formatSketchEntityKind(context.entity.kind)} in ${
          context.sketch.name
        }`,
        detail: formatSketchEntity(context.entity)
      };
    case "body":
      return {
        eyebrow: "Body",
        title: context.body.name ?? "Generated body",
        detail: formatBodySelectionDetail(context.feature)
      };
    case "generatedReference":
      return {
        eyebrow: formatGeneratedReferenceKind(context.reference.kind),
        title: context.reference.label,
        detail:
          context.reference.description ??
          formatGeneratedReferenceKind(context.reference.kind)
      };
  }
}

function createModelingActionDisplay(
  action: ModelingActionDescriptor
): ModelingActionDisplay {
  return {
    category: formatModelingActionCategory(action.category),
    controlLabel: formatModelingActionControlLabel(action),
    detail: action.available
      ? formatModelingActionHint(action)
      : (action.reason ?? "Not available for the current selection."),
    status: action.available ? "available" : "unavailable"
  };
}

function formatModelingActionHint(action: ModelingActionDescriptor): string {
  switch (action.id) {
    case "sketch.create":
      return "Open the Sketch panel to create or edit sketches.";
    case "sketch.entity.add.point":
    case "sketch.entity.add.line":
    case "sketch.entity.add.rectangle":
    case "sketch.entity.add.circle":
      return "Open the selected sketch controls and add this entity type.";
    case "sketch.entity.edit":
      return "Open the Sketch panel entity editor.";
    case "sketch.dimension.add":
      return "Use the Sketch panel dimension controls.";
    case "sketch.constraint.add":
      return "Use the Sketch panel constraint controls.";
    case "sketch.revolveAxis.use":
      return "Use this line from the revolve controls in the Sketch panel.";
    case "feature.extrude":
      return "Create the feature from the Sketch panel feature controls.";
    case "feature.hole":
      return "Create the hole from the Sketch panel feature controls.";
    case "feature.revolve":
      return "Create the revolve from the Sketch panel feature controls.";
    case "body.references.inspect":
      return "Inspect generated faces, edges, and vertices.";
    case "body.measureTopology":
      return "Review body measurements and topology in the Inspector.";
    case "sketch.createOnFace":
      return "Select an eligible face and use the Inspector sketch-on-face form.";
    case "reference.name":
      return "Use the Inspector selected-reference naming control.";
    case "feature.chamfer":
      return "Use the Inspector edge finish controls.";
    case "feature.fillet":
      return "Use the Inspector edge finish controls.";
  }
}

function formatModelingActionControlLabel(
  action: ModelingActionDescriptor
): string {
  if (!action.available) {
    return "Unavailable";
  }

  switch (action.id) {
    case "sketch.create":
    case "sketch.entity.add.point":
    case "sketch.entity.add.line":
    case "sketch.entity.add.rectangle":
    case "sketch.entity.add.circle":
    case "sketch.entity.edit":
    case "sketch.dimension.add":
    case "sketch.constraint.add":
    case "sketch.revolveAxis.use":
    case "feature.extrude":
    case "feature.hole":
    case "feature.revolve":
      return "Open Sketch";
    case "body.references.inspect":
    case "body.measureTopology":
      return "Inspect";
    case "sketch.createOnFace":
      return "Select face";
    case "reference.name":
      return "Name";
    case "feature.chamfer":
    case "feature.fillet":
      return "Open finish";
  }
}

function formatModelingActionCategory(
  category: ModelingActionDescriptor["category"]
): string {
  switch (category) {
    case "sketch":
      return "Sketch";
    case "sketchEntity":
      return "Entity";
    case "feature":
      return "Feature";
    case "body":
      return "Body";
    case "generatedReference":
      return "Reference";
  }
}

function formatSketchEntityKind(kind: SketchEntityKind): string {
  switch (kind) {
    case "point":
      return "Point";
    case "line":
      return "Line";
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
  }
}

function formatSketchPlane(plane: string): string {
  return plane;
}

function formatBodySelectionDetail(feature: CadFeatureSummary | undefined) {
  if (!feature) {
    return "Body details are available in the Inspector.";
  }

  const featureName = feature.name ? `${feature.name} ` : "";

  switch (feature.kind) {
    case "primitive":
      return `${featureName}${formatPrimitiveKind(feature.primitive)} feature`;
    case "extrude":
      return `${featureName}Extrude feature`;
    case "revolve":
      return `${featureName}Revolve feature`;
    case "hole":
      return `${featureName}Hole feature`;
    case "chamfer":
      return `${featureName}Chamfer feature`;
    case "fillet":
      return `${featureName}Fillet feature`;
  }
}

function formatPrimitiveKind(kind: string): string {
  switch (kind) {
    case "box":
      return "Box";
    case "cylinder":
      return "Cylinder";
    case "sphere":
      return "Sphere";
    case "cone":
      return "Cone";
    case "torus":
      return "Torus";
    default:
      return "Primitive";
  }
}
