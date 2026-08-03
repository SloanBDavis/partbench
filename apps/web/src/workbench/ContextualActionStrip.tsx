import { useState } from "react";
import {
  createViewportContextualCommandSurface,
  type CreateViewportContextualCommandSurfaceInput,
  ViewportContextualCommandAction,
  ViewportContextualCommandSurfaceModel
} from "../viewportContextualCommands";
import { Button } from "../ui/Button";
import "./contextualActionStrip.css";

type ContextualActionStripProps = {
  readonly disabled?: boolean;
  readonly onInvoke: (action: ViewportContextualCommandAction) => void;
  readonly onExplainUnavailable?: (message: string) => void;
} & (
  | { readonly surface: ViewportContextualCommandSurfaceModel }
  | CreateViewportContextualCommandSurfaceInput
);

export function ContextualActionStrip(props: ContextualActionStripProps) {
  const { disabled = false, onInvoke, onExplainUnavailable } = props;
  const surface =
    "surface" in props
      ? props.surface
      : createViewportContextualCommandSurface(props);
  const [transient, setTransient] = useState({
    selectionKey: surface.selectionKey,
    expanded: false
  });
  const expanded =
    transient.selectionKey === surface.selectionKey && transient.expanded;

  if (!surface.visible || surface.actions.length === 0) return null;

  const primary = surface.actions.slice(0, 4);
  const overflow = surface.actions.slice(4);

  return (
    <section className="pb-context-strip" aria-label="Selection actions">
      <span className="pb-context-strip__selection">
        <strong>{surface.title}</strong>
        <small>{surface.detail}</small>
      </span>
      <div className="pb-context-strip__actions">
        {primary.map((action) => (
          <ContextButton
            key={action.id}
            action={action}
            disabled={disabled}
            onInvoke={onInvoke}
            onExplainUnavailable={onExplainUnavailable}
          />
        ))}
        {overflow.length > 0 ? (
          <Button
            density="dense"
            aria-expanded={expanded}
            onClick={() =>
              setTransient((current) => ({
                selectionKey: surface.selectionKey,
                expanded:
                  current.selectionKey === surface.selectionKey
                    ? !current.expanded
                    : true
              }))
            }
          >
            More
          </Button>
        ) : null}
      </div>
      {expanded ? (
        <div className="pb-context-strip__more" role="menu">
          {overflow.map((action) => (
            <ContextButton
              key={action.id}
              action={action}
              disabled={disabled}
              onInvoke={onInvoke}
              onExplainUnavailable={onExplainUnavailable}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function activateContextualStripAction(
  action: ViewportContextualCommandAction,
  options: {
    readonly stripDisabled?: boolean;
    readonly onInvoke: (action: ViewportContextualCommandAction) => void;
    readonly onExplainUnavailable?: (message: string) => void;
  }
): void {
  if (options.stripDisabled) return;
  if (action.disabled) {
    options.onExplainUnavailable?.(
      action.reason ?? "This action is unavailable."
    );
    return;
  }
  options.onInvoke(action);
}

function ContextButton({
  action,
  disabled,
  onInvoke,
  onExplainUnavailable
}: {
  readonly action: ViewportContextualCommandAction;
  readonly disabled: boolean;
  readonly onInvoke: (action: ViewportContextualCommandAction) => void;
  readonly onExplainUnavailable?: (message: string) => void;
}) {
  return (
    <Button
      density="dense"
      unavailableReason={action.disabled ? action.reason : undefined}
      pending={disabled}
      onUnavailableActivate={(reason) => onExplainUnavailable?.(reason)}
      onClick={() => {
        activateContextualStripAction(action, {
          stripDisabled: disabled,
          onInvoke,
          onExplainUnavailable
        });
      }}
    >
      {action.label}
    </Button>
  );
}
