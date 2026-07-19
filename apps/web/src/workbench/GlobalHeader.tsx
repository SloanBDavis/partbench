import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/Button";
import { LiveRegion } from "../ui/LiveRegion";

export interface GlobalHeaderCommandState {
  readonly available: boolean;
  readonly pending?: boolean;
  readonly unavailableReason?: string;
  readonly run: () => void;
}

export interface GlobalHeaderProps {
  readonly documentName: string;
  readonly saveState: "saved-local" | "saved-browser" | "unsaved";
  readonly undo: GlobalHeaderCommandState;
  readonly redo: GlobalHeaderCommandState;
  readonly onOpenCommandSearch: () => void;
  readonly onOpenHelp: () => void;
  readonly pendingLabel?: string;
}

const SAVE_STATE_LABELS: Readonly<Record<GlobalHeaderProps["saveState"], string>> = {
  "saved-local": "All changes saved locally",
  "saved-browser": "All changes saved in this browser",
  unsaved: "Unsaved changes"
};

/** Quiet, document-global header. Mode-specific controls belong in the ribbon. */
export function GlobalHeader({
  documentName,
  saveState,
  undo,
  redo,
  onOpenCommandSearch,
  onOpenHelp,
  pendingLabel
}: GlobalHeaderProps) {
  const saveLabel = SAVE_STATE_LABELS[saveState];

  return (
    <header className="pb-global-header" aria-label="Partbench document header">
      <div className="pb-global-header__brand" aria-label="Partbench">
        <span className="pb-global-header__mark" aria-hidden="true">
          <Icon name="partbench" size={24} />
        </span>
        <span className="pb-global-header__brand-name">Partbench</span>
      </div>

      <div className="pb-global-header__document" title={documentName}>
        <span className="pb-global-header__document-name">{documentName}</span>
      </div>

      <div
        className={`pb-global-header__save-state pb-global-header__save-state--${saveState}`}
        aria-label={saveLabel}
        title={saveLabel}
      >
        <Icon
          name={saveState === "unsaved" ? "warning" : "success"}
          size={16}
        />
        <span>{saveLabel}</span>
      </div>

      {pendingLabel ? (
        <span className="pb-global-header__pending" aria-busy="true">
          {pendingLabel}
        </span>
      ) : null}

      <div className="pb-global-header__history" aria-label="Document history">
        <IconButton
          icon="undo"
          label="Undo"
          density="dense"
          pending={undo.pending}
          disabled={!undo.available && !undo.unavailableReason}
          unavailableReason={undo.unavailableReason}
          onClick={undo.run}
        />
        <IconButton
          icon="redo"
          label="Redo"
          density="dense"
          pending={redo.pending}
          disabled={!redo.available && !redo.unavailableReason}
          unavailableReason={redo.unavailableReason}
          onClick={redo.run}
        />
      </div>

      <button
        className="pb-global-header__search"
        type="button"
        onClick={onOpenCommandSearch}
        aria-label="Search commands"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Icon name="search" size={16} />
        <span>Search commands…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <IconButton
        className="pb-global-header__help"
        icon="help"
        label="Help and keyboard shortcuts"
        density="dense"
        onClick={onOpenHelp}
      />

      <LiveRegion visuallyHidden>{pendingLabel ?? ""}</LiveRegion>
    </header>
  );
}
