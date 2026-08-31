import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import {
  getProjectReplacementGuardPrompt,
  type ProjectReplacementKind
} from "../projectDirtyReplacementGuard";
import { Button } from "../ui/Button";
import "./projectRecovery.css";

export interface ProjectReplacementGuardProps {
  readonly replacement: ProjectReplacementKind;
  readonly pending?: boolean;
  readonly onSave: () => void | Promise<void>;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
}

export function ProjectReplacementGuard({
  replacement,
  pending = false,
  onSave,
  onDiscard,
  onCancel
}: ProjectReplacementGuardProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const prompt = getProjectReplacementGuardPrompt(replacement);

  useEffect(() => {
    const dialog = dialogRef.current;
    (
      dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
      getDialogFocusableElements(dialog)[0]
    )?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!pending) onCancel();
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
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
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
      aria-labelledby="project-replacement-title"
      aria-busy={pending}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="pb-project-recovery-dialog__panel">
        <h2 id="project-replacement-title">{prompt.title}</h2>
        <p>{prompt.message}</p>
        <div className="pb-project-recovery-dialog__actions">
          <Button
            tone="primary"
            data-dialog-initial-focus=""
            pending={pending}
            disabled={pending}
            onClick={() => void onSave()}
          >
            {prompt.saveLabel}
          </Button>
          <Button disabled={pending} onClick={onDiscard}>
            {prompt.discardLabel}
          </Button>
          <Button disabled={pending} onClick={onCancel}>
            {prompt.cancelLabel}
          </Button>
        </div>
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
