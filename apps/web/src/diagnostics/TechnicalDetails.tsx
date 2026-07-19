import { useId, useMemo, useState } from "react";
import {
  copyTechnicalDetails,
  createTechnicalDetails,
  type TechnicalDetailsModel
} from "./technicalDetails";
import type { StructuredDiagnosticInput } from "./userDiagnostic";

export function TechnicalDetails({
  details,
  diagnostic,
  initiallyOpen = false
}: {
  readonly details?: TechnicalDetailsModel;
  readonly diagnostic?: StructuredDiagnosticInput;
  readonly initiallyOpen?: boolean;
}) {
  const fallback = useMemo(
    () => createTechnicalDetails(diagnostic ?? {}),
    [diagnostic]
  );
  const model = details ?? fallback;
  const contentId = useId();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  return (
    <details className="pb-technical-details" open={initiallyOpen || undefined}>
      <summary aria-controls={contentId}>{model.label}</summary>
      <div id={contentId} className="pb-technical-details__content">
        <pre tabIndex={0}>{model.copyText}</pre>
        <button
          className="pb-button pb-button--dense"
          type="button"
          onClick={() => {
            void copyTechnicalDetails(model).then((copied) => {
              setCopyStatus(copied ? "copied" : "failed");
            });
          }}
        >
          Copy details
        </button>
        <span className="pb-visually-hidden" aria-live="polite">
          {copyStatus === "copied"
            ? "Technical details copied."
            : copyStatus === "failed"
              ? "Technical details could not be copied."
              : ""}
        </span>
      </div>
    </details>
  );
}
