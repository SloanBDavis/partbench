import { useEffect, useState } from "react";
import type { CadGeneratedReference } from "@web-cad/cad-protocol";
import type { SelectedGeneratedReference } from "../generatedReferenceSelection";
import type {
  ViewportContextualCommandAction,
  ViewportContextualCommandSurfaceModel
} from "../viewportContextualCommands";
import type { ViewportInteractionSurface } from "../viewportInteractionSurface";
import type {
  ViewportTwoTargetMeasurementTarget,
  ViewportTwoTargetMeasurementView
} from "../viewportTwoTargetMeasurement";
import { shouldCancelViewportTransientState } from "../viewportKeyboard";

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
  twoTargetMeasurement,
  onContinueInModeling,
  onNameReference,
  onRunCommand,
  onClearTwoTargetMeasurement,
  onSetSecondTwoTargetMeasurement,
  onStartTwoTargetMeasurement,
  onSelectReference
}: {
  readonly disabled?: boolean;
  readonly interactionSurface?: ViewportInteractionSurface;
  readonly surface: ViewportContextualCommandSurfaceModel;
  readonly twoTargetMeasurement?: ViewportTwoTargetMeasurementView;
  readonly onContinueInModeling?: (
    action: ViewportContextualCommandAction
  ) => void;
  readonly onClearTwoTargetMeasurement?: () => void;
  readonly onNameReference?: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onRunCommand?: (action: ViewportContextualCommandAction) => void;
  readonly onSetSecondTwoTargetMeasurement?: (
    target: ViewportTwoTargetMeasurementTarget
  ) => void;
  readonly onStartTwoTargetMeasurement?: (
    target: ViewportTwoTargetMeasurementTarget
  ) => void;
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
      if (shouldCancelViewportTransientState(event)) {
        event.preventDefault();
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
      {twoTargetMeasurement?.firstTarget && expanded !== "measure" ? (
        <small className="viewport-contextual-session-status">
          Two-target: {twoTargetMeasurement.firstTarget.title} -{" "}
          {twoTargetMeasurement.prompt}
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
        <MeasurementSection
          disabled={disabled}
          interactionSurface={interactionSurface}
          twoTargetMeasurement={twoTargetMeasurement}
          onClearTwoTargetMeasurement={onClearTwoTargetMeasurement}
          onSetSecondTwoTargetMeasurement={onSetSecondTwoTargetMeasurement}
          onStartTwoTargetMeasurement={onStartTwoTargetMeasurement}
        />
      ) : null}
      {expanded === "inspect" ? (
        <InspectSection
          interactionSurface={interactionSurface}
          surface={surface}
        />
      ) : null}
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
      case "repair":
        onRunCommand?.(action);
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
  disabled,
  interactionSurface,
  twoTargetMeasurement,
  onClearTwoTargetMeasurement,
  onSetSecondTwoTargetMeasurement,
  onStartTwoTargetMeasurement
}: {
  readonly disabled: boolean;
  readonly interactionSurface?: ViewportInteractionSurface;
  readonly twoTargetMeasurement?: ViewportTwoTargetMeasurementView;
  readonly onClearTwoTargetMeasurement?: () => void;
  readonly onSetSecondTwoTargetMeasurement?: (
    target: ViewportTwoTargetMeasurementTarget
  ) => void;
  readonly onStartTwoTargetMeasurement?: (
    target: ViewportTwoTargetMeasurementTarget
  ) => void;
}) {
  const measurement = interactionSurface?.selection.measurement;

  if (!measurement && !twoTargetMeasurement?.firstTarget) {
    return (
      <small className="viewport-contextual-diagnostic">
        Measurement details are unavailable for this selection.
      </small>
    );
  }

  return (
    <div className="viewport-contextual-detail" aria-label="Viewport measure">
      {measurement ? (
        <>
          <div className="viewport-contextual-detail-heading">
            <strong>{measurement.title}</strong>
            <span>{measurement.detail}</span>
          </div>
          <small className="viewport-contextual-authority">
            {measurement.authorityLabel}
          </small>
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
        </>
      ) : null}
      {twoTargetMeasurement ? (
        <TwoTargetMeasurementSection
          disabled={disabled}
          view={twoTargetMeasurement}
          onClear={onClearTwoTargetMeasurement}
          onSetSecond={onSetSecondTwoTargetMeasurement}
          onStart={onStartTwoTargetMeasurement}
        />
      ) : null}
    </div>
  );
}

function TwoTargetMeasurementSection({
  disabled,
  onClear,
  onSetSecond,
  onStart,
  view
}: {
  readonly disabled: boolean;
  readonly onClear?: () => void;
  readonly onSetSecond?: (target: ViewportTwoTargetMeasurementTarget) => void;
  readonly onStart?: (target: ViewportTwoTargetMeasurementTarget) => void;
  readonly view: ViewportTwoTargetMeasurementView;
}) {
  const firstTarget = view.firstTarget;
  const pendingTarget = view.pendingTarget;
  const secondTarget = view.secondTarget ?? pendingTarget;
  const canStart = !disabled && !firstTarget && view.activeTarget && onStart;
  const canSetSecond =
    !disabled &&
    firstTarget &&
    pendingTarget &&
    view.results.length > 0 &&
    onSetSecond;

  return (
    <div
      className="viewport-contextual-two-target"
      aria-label="Viewport two-target measure"
    >
      <div className="viewport-contextual-detail-heading">
        <strong>Two-target measure</strong>
        <span>{view.prompt}</span>
      </div>
      {firstTarget ? (
        <dl>
          <div>
            <dt>First</dt>
            <dd>{firstTarget.title}</dd>
          </div>
          <div>
            <dt>{view.secondTarget ? "Second" : "Pending"}</dt>
            <dd>{secondTarget?.title ?? "Select another target"}</dd>
          </div>
        </dl>
      ) : null}
      {view.results.length > 0
        ? view.results.map((result) => (
            <div
              key={`${result.kind}:${result.value}`}
              className="viewport-contextual-result"
            >
              <div className="viewport-contextual-detail-heading">
                <strong>{result.title}</strong>
                <span>{result.detail}</span>
              </div>
              <small className="viewport-contextual-authority">
                {result.authorityLabel}
              </small>
              <dl>
                {result.rows.map((row) => (
                  <div key={`${result.kind}:${row.label}:${row.value}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        : null}
      {view.diagnostics[0] && firstTarget ? (
        <small className="viewport-contextual-diagnostic">
          {view.diagnostics[0].message}
        </small>
      ) : null}
      <div className="viewport-contextual-mini-actions">
        {!firstTarget ? (
          <button
            type="button"
            disabled={!canStart}
            onClick={() => {
              if (view.activeTarget) {
                onStart?.(view.activeTarget);
              }
            }}
          >
            Start two-target
          </button>
        ) : null}
        {pendingTarget ? (
          <button
            type="button"
            disabled={!canSetSecond}
            onClick={() => onSetSecond?.(pendingTarget)}
          >
            Use selected as second
          </button>
        ) : null}
        {firstTarget ? (
          <button
            type="button"
            disabled={disabled || !onClear}
            onClick={onClear}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InspectSection({
  interactionSurface,
  surface
}: {
  readonly interactionSurface?: ViewportInteractionSurface;
  readonly surface: ViewportContextualCommandSurfaceModel;
}) {
  const inspect = interactionSurface?.selection.inspect;

  if (inspect) {
    return (
      <div className="viewport-contextual-detail" aria-label="Viewport inspect">
        <div className="viewport-contextual-detail-heading">
          <strong>{inspect.title}</strong>
          <span>{inspect.detail}</span>
        </div>
        <small className="viewport-contextual-authority">
          {inspect.authorityLabel}
        </small>
        <dl>
          {inspect.rows.map((row) => (
            <div key={`${row.label}:${row.value}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        {inspect.diagnostics[0] ? (
          <small className="viewport-contextual-diagnostic">
            {inspect.diagnostics[0].message}
          </small>
        ) : null}
      </div>
    );
  }

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
