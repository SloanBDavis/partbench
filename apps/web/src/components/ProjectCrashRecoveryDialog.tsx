import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import type { ProjectCrashRecoveryOffer } from "../projectCrashRecoveryStatus";
import { getRecoveryDiscardConfirmPrompt } from "../projectDirtyReplacementGuard";
import { Button } from "../ui/Button";
import "./projectRecovery.css";

export interface ProjectCrashRecoveryDialogProps {
  readonly offer: ProjectCrashRecoveryOffer;
  readonly confirmDiscard?: boolean;
  readonly pending?: boolean;
  readonly onRestore: () => void | Promise<void>;
  readonly onRequestDiscard: () => void;
  readonly onConfirmDiscard: () => void | Promise<void>;
  readonly onCancelDiscard: () => void;
}

export function ProjectCrashRecoveryDialog({
  offer,
  confirmDiscard = false,
  pending = false,
  onRestore,
  onRequestDiscard,
  onConfirmDiscard,
  onCancelDiscard
}: ProjectCrashRecoveryDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const discardPrompt = getRecoveryDiscardConfirmPrompt();
  const titleId = confirmDiscard
    ? "project-recovery-discard-title"
    : "project-recovery-restore-title";

  useEffect(() => {
    const dialog = dialogRef.current;
    (
      dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
      getDialogFocusableElements(dialog)[0]
    )?.focus();
  }, [confirmDiscard]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (pending) return;
      if (confirmDiscard) onCancelDiscard();
      return;
    }
    if (event.key !== "Tab") {
      event.stopPropagation();
      return;
    }
    const focusable = getDialogFocusableElements(dialogRef.current);
    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement
    );
    const next = event.shiftKey
      ? currentIndex <= 0
        ? focusable.length - 1
        : currentIndex - 1
      : (currentIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[next]?.focus();
  }

  return (
    <div
      ref={dialogRef}
      className="pb-project-recovery-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={pending}
      tabIndex={-1}
      data-recovery-dialog={confirmDiscard ? "discard" : "restore"}
      onKeyDown={handleKeyDown}
    >
      <div className="pb-project-recovery-dialog__panel">
        {confirmDiscard ? (
          <>
            <h2 id={titleId}>{discardPrompt.title}</h2>
            <p>{discardPrompt.message}</p>
            <div className="pb-project-recovery-dialog__actions">
              <Button
                tone="danger"
                data-dialog-initial-focus=""
                pending={pending}
                disabled={pending}
                onClick={() => void onConfirmDiscard()}
              >
                {discardPrompt.confirmLabel}
              </Button>
              <Button disabled={pending} onClick={onCancelDiscard}>
                {discardPrompt.cancelLabel}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId}>Recover unsaved project?</h2>
            <p>
              A crash-recovery snapshot is available. Restore opens it as an
              unsaved project. Discard removes the snapshot after confirmation.
            </p>
            <dl className="pb-project-recovery-dialog__facts">
              <dt>Project</dt>
              <dd>{offer.projectName}</dd>
              <dt>Last captured</dt>
              <dd>{offer.committedAt}</dd>
              <dt>Identity</dt>
              <dd>{offer.sourceIdentitySummary}</dd>
              <dt>Units</dt>
              <dd>{offer.units}</dd>
              <dt>Bodies</dt>
              <dd>{String(offer.bodyCount)}</dd>
              <dt>Portability</dt>
              <dd>{offer.portabilityLabel}</dd>
            </dl>
            <div className="pb-project-recovery-dialog__actions">
              <Button
                tone="primary"
                data-dialog-initial-focus=""
                pending={pending}
                disabled={pending}
                onClick={() => void onRestore()}
              >
                Restore
              </Button>
              <Button disabled={pending} onClick={onRequestDiscard}>
                Discard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getDialogFocusableElements(dialog: HTMLElement | null): HTMLElement[] {
  if (!dialog) return [];
  return [
    ...dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )
  ].filter((element) => !element.hidden);
}
