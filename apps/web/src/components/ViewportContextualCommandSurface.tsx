import { useEffect, useState } from "react";
import type { CadGeneratedReference } from "@web-cad/cad-protocol";
import type { SelectedGeneratedReference } from "../generatedReferenceSelection";
import type {
  ViewportContextualCommandAction,
  ViewportContextualCommandSurfaceModel
} from "../viewportContextualCommands";
import type { ViewportInteractionSurface } from "../viewportInteractionSurface";

type ExpandedContextualSection = "inspect" | "measure" | "name" | "references";

interface ContextualTransientState {
  readonly selectionKey: string;
  readonly expanded?: ExpandedContextualSection;
  readonly name: string;
}

export function ViewportContextualCommandSurface({
  disabled = false,
  interactionSurface,
  surface,
  onContinueInModeling,
  onNameReference,
  onRunCommand,
  onSelectReference
}: {
  readonly disabled?: boolean;
  readonly interactionSurface?: ViewportInteractionSurface;
  readonly surface: ViewportContextualCommandSurfaceModel;
  readonly onContinueInModeling?: (
    action: ViewportContextualCommandAction
  ) => void;
  readonly onNameReference?: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onRunCommand?: (action: ViewportContextualCommandAction) => void;
  readonly onSelectReference?: (reference: CadGeneratedReference) => void;
}) {
  const [transient, setTransient] = useState<ContextualTransientState>(() => ({
    selectionKey: surface.selectionKey,
    name: ""
  }));
  const isCurrentSelection = transient.selectionKey === surface.selectionKey;
  const expanded = isCurrentSelection ? transient.expanded : undefined;
  const name = isCurrentSelection ? transient.name : "";

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTransient({
          selectionKey: surface.selectionKey,
          name: ""
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded, surface.selectionKey]);

  if (!surface.visible) {
    return null;
  }

  const activeNameAction = surface.actions.find(
    (action) => action.id === "reference.name" && action.route === "name"
  );
  const canSaveName =
    !disabled &&
    activeNameAction !== undefined &&
    !activeNameAction.disabled &&
    activeNameAction.target !== undefined &&
    name.trim().length > 0 &&
    onNameReference !== undefined;

  return (
    <section
      className={`viewport-contextual-command-surface viewport-contextual-${surface.tone}`}
      aria-label="Viewport contextual commands"
    >
      <div className="viewport-contextual-heading">
        <strong>{surface.title}</strong>
        <span>{surface.detail}</span>
      </div>
      {surface.actions.length > 0 ? (
        <div className="viewport-contextual-actions">
          {surface.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={disabled || action.disabled}
              title={action.reason ?? action.label}
              aria-disabled={disabled || action.disabled}
              onClick={() => handleAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {surface.diagnostic ? (
        <small className="viewport-contextual-diagnostic">
          {surface.diagnostic}
        </small>
      ) : null}
      {expanded === "name" && activeNameAction ? (
        <form
          className="viewport-contextual-inline"
          aria-label="Name selected reference"
          onSubmit={(event) => {
            event.preventDefault();

            if (canSaveName && activeNameAction.target) {
              onNameReference?.(name.trim(), activeNameAction.target);
              clearTransient();
            }
          }}
        >
          <input
            type="text"
            value={name}
            disabled={disabled || activeNameAction.disabled}
            placeholder="reference_name"
            aria-label="Reference name"
            onChange={(event) => setTransientName(event.currentTarget.value)}
          />
          <button type="submit" disabled={!canSaveName}>
            Save
          </button>
        </form>
      ) : null}
      {expanded === "measure" ? (
        <MeasurementSection interactionSurface={interactionSurface} />
      ) : null}
      {expanded === "inspect" ? <InspectSection surface={surface} /> : null}
      {expanded === "references" ? (
        <ReferenceSection
          disabled={disabled}
          interactionSurface={interactionSurface}
          onSelectReference={onSelectReference}
        />
      ) : null}
    </section>
  );

  function handleAction(action: ViewportContextualCommandAction) {
    if (disabled || action.disabled) {
      return;
    }

    switch (action.route) {
      case "command":
        onRunCommand?.(action);
        return;
      case "inspect":
        toggleExpandedSection("inspect");
        return;
      case "measure":
        toggleExpandedSection("measure");
        return;
      case "modeling":
        onContinueInModeling?.(action);
        return;
      case "name":
        toggleExpandedSection("name");
        return;
      case "references":
        toggleExpandedSection("references");
        return;
    }
  }

  function clearTransient() {
    setTransient({
      selectionKey: surface.selectionKey,
      name: ""
    });
  }

  function setTransientName(nextName: string) {
    setTransient((current) => {
      const base = getCurrentTransientState(current, surface.selectionKey);

      return {
        ...base,
        name: nextName
      };
    });
  }

  function toggleExpandedSection(section: ExpandedContextualSection) {
    setTransient((current) => {
      const base = getCurrentTransientState(current, surface.selectionKey);

      return {
        ...base,
        expanded: base.expanded === section ? undefined : section
      };
    });
  }
}

function getCurrentTransientState(
  current: ContextualTransientState,
  selectionKey: string
): ContextualTransientState {
  return current.selectionKey === selectionKey
    ? current
    : {
        selectionKey,
        name: ""
      };
}

function MeasurementSection({
  interactionSurface
}: {
  readonly interactionSurface?: ViewportInteractionSurface;
}) {
  const measurement = interactionSurface?.selection.measurement;

  if (!measurement) {
    return (
      <small className="viewport-contextual-diagnostic">
        Measurement details are unavailable for this selection.
      </small>
    );
  }

  return (
    <div className="viewport-contextual-detail" aria-label="Viewport measure">
      <div className="viewport-contextual-detail-heading">
        <strong>{measurement.title}</strong>
        <span>{measurement.detail}</span>
      </div>
      {measurement.rows.length > 0 ? (
        <dl>
          {measurement.rows.map((row) => (
            <div key={`${row.label}:${row.value}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {measurement.overflowCount > 0 ? (
        <small>
          {measurement.overflowCount} more measurements in Inspector
        </small>
      ) : null}
      {measurement.error ? (
        <small className="viewport-contextual-diagnostic">
          {measurement.error}
        </small>
      ) : null}
    </div>
  );
}

function InspectSection({
  surface
}: {
  readonly surface: ViewportContextualCommandSurfaceModel;
}) {
  return (
    <div className="viewport-contextual-detail" aria-label="Viewport inspect">
      <div className="viewport-contextual-detail-heading">
        <strong>{surface.title}</strong>
        <span>{surface.detail}</span>
      </div>
      {surface.diagnostic ? (
        <small className="viewport-contextual-diagnostic">
          {surface.diagnostic}
        </small>
      ) : (
        <small>
          Detailed reference data remains in Selection and Modeling.
        </small>
      )}
    </div>
  );
}

function ReferenceSection({
  disabled,
  interactionSurface,
  onSelectReference
}: {
  readonly disabled: boolean;
  readonly interactionSurface?: ViewportInteractionSurface;
  readonly onSelectReference?: (reference: CadGeneratedReference) => void;
}) {
  const referenceSection = interactionSurface?.referenceSection;

  if (!referenceSection) {
    return (
      <small className="viewport-contextual-diagnostic">
        Reference targets are unavailable for this selection.
      </small>
    );
  }

  return (
    <div
      className="viewport-contextual-detail"
      aria-label="Viewport references"
    >
      <div className="viewport-contextual-detail-heading">
        <strong>{referenceSection.title}</strong>
        <span>{referenceSection.summary}</span>
      </div>
      <div className="viewport-contextual-reference-list">
        {referenceSection.groups.flatMap((group) =>
          group.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={disabled || !action.commandable}
              title={
                action.diagnostic?.message ??
                action.commandOperationLabels.join(", ") ??
                action.label
              }
              onClick={() => onSelectReference?.(action.reference)}
            >
              <span>{group.kindLabel}</span>
              <strong>{action.label}</strong>
            </button>
          ))
        )}
      </div>
      {referenceSection.overflowCount > 0 ? (
        <small>
          {referenceSection.overflowCount} more references in Selection
        </small>
      ) : null}
    </div>
  );
}
