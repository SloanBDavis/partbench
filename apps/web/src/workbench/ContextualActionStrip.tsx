import { useState } from "react";
import type {
  ViewportContextualCommandAction,
  ViewportContextualCommandSurfaceModel
} from "../viewportContextualCommands";
import { Button } from "../ui/Button";
import "./contextualActionStrip.css";

export function ContextualActionStrip({
  disabled = false,
  surface,
  onInvoke
}: {
  readonly disabled?: boolean;
  readonly surface: ViewportContextualCommandSurfaceModel;
  readonly onInvoke: (action: ViewportContextualCommandAction) => void;
}) {
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
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ContextButton({
  action,
  disabled,
  onInvoke
}: {
  readonly action: ViewportContextualCommandAction;
  readonly disabled: boolean;
  readonly onInvoke: (action: ViewportContextualCommandAction) => void;
}) {
  return (
    <Button
      density="dense"
      unavailableReason={action.disabled ? action.reason : undefined}
      pending={disabled}
      onClick={() => {
        if (!disabled && !action.disabled) onInvoke(action);
      }}
    >
      {action.label}
    </Button>
  );
}
