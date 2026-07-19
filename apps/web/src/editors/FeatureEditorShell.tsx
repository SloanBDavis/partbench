import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useId
} from "react";
import { Button } from "../ui/Button";
import { LiveRegion } from "../ui/LiveRegion";
import type {
  FeatureEditorPhase,
  FeatureEditorValidation
} from "./featureEditorState";
import "../styles/editor.css";

export interface FeatureEditorShellProps {
  readonly title: string;
  readonly kind: string;
  readonly phase: FeatureEditorPhase;
  readonly dirty: boolean;
  readonly validation: FeatureEditorValidation;
  readonly applyError?: string;
  readonly children: ReactNode;
  readonly advanced?: ReactNode;
  readonly dangerArea?: ReactNode;
  readonly onApply: () => void;
  readonly onCancel: () => void;
  readonly headingRef?: (node: HTMLHeadingElement | null) => void;
}

export function FeatureEditorShell({
  title,
  kind,
  phase,
  dirty,
  validation,
  applyError,
  children,
  advanced,
  dangerArea,
  onApply,
  onCancel,
  headingRef
}: FeatureEditorShellProps) {
  const validationId = useId();
  const applying = phase === "applying";
  const applyDisabled = applying || !dirty || validation.status !== "ready";

  return (
    <section
      className="pb-feature-editor"
      aria-labelledby={`${validationId}-heading`}
      aria-describedby={validationId}
      aria-busy={applying || undefined}
    >
      <header className="pb-feature-editor__header">
        <div>
          <span className="pb-feature-editor__kind">{kind}</span>
          <h2 id={`${validationId}-heading`} ref={headingRef} tabIndex={-1}>
            {title}
          </h2>
        </div>
        {dirty ? (
          <span className="pb-feature-editor__dirty">Unsaved changes</span>
        ) : null}
      </header>

      <div className="pb-feature-editor__scroll">
        <div className="pb-feature-editor__fields">{children}</div>
        {advanced ? (
          <AdvancedEditorSection>{advanced}</AdvancedEditorSection>
        ) : null}
        {dangerArea ? (
          <section
            className="pb-feature-editor__danger"
            aria-label="Destructive actions"
          >
            {dangerArea}
          </section>
        ) : null}
      </div>

      <footer className="pb-feature-editor__footer">
        <EditorValidationSummary
          id={validationId}
          phase={phase}
          validation={validation}
          applyError={applyError}
        />
        <div className="pb-feature-editor__footer-actions">
          <Button onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button
            tone="primary"
            pending={applying}
            disabled={applyDisabled}
            title="Apply (Ctrl/Cmd+Enter)"
            onClick={onApply}
          >
            {applying ? "Applying…" : "Apply"}
          </Button>
        </div>
      </footer>
    </section>
  );
}

export interface EditorFieldRowProps {
  readonly label: string;
  readonly htmlFor: string;
  readonly unit?: string;
  readonly description?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children: ReactNode;
}

export function EditorFieldRow({
  label,
  htmlFor,
  unit,
  description,
  error,
  required = false,
  children
}: EditorFieldRowProps) {
  const descriptionId = `${htmlFor}-description`;
  const errorId = `${htmlFor}-error`;
  const unitId = `${htmlFor}-unit`;
  const describedBy = [
    description ? descriptionId : undefined,
    unit ? unitId : undefined,
    error ? errorId : undefined
  ]
    .filter(Boolean)
    .join(" ");
  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{
          readonly "aria-describedby"?: string;
          readonly "aria-invalid"?: boolean;
        }>,
        {
          "aria-describedby": describedBy || undefined,
          "aria-invalid": error ? true : undefined
        }
      )
    : children;

  return (
    <div className="pb-editor-field-row">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="pb-editor-field-row__control">
        <div className="pb-editor-field-row__input">{control}</div>
        {unit ? (
          <span id={unitId} className="pb-editor-field-row__unit">
            {unit}
          </span>
        ) : null}
      </div>
      {description ? (
        <p id={descriptionId} className="pb-editor-field-row__description">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="pb-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface PreviewToggleProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> {
  readonly label?: string;
  readonly onChange: (checked: boolean) => void;
}

export function PreviewToggle({
  label = "Show provisional preview",
  onChange,
  ...props
}: PreviewToggleProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.checked);
  };

  return (
    <label className="pb-editor-toggle">
      <input {...props} type="checkbox" onChange={handleChange} />
      <span>{label}</span>
    </label>
  );
}

export function AdvancedEditorSection({
  children,
  label = "Advanced"
}: {
  readonly children: ReactNode;
  readonly label?: string;
}) {
  return (
    <details className="pb-editor-advanced">
      <summary>{label}</summary>
      <div className="pb-editor-advanced__content">{children}</div>
    </details>
  );
}

export function EditorValidationSummary({
  id,
  phase,
  validation,
  applyError
}: {
  readonly id: string;
  readonly phase: FeatureEditorPhase;
  readonly validation: FeatureEditorValidation;
  readonly applyError?: string;
}) {
  const error = phase === "error" ? applyError : undefined;
  const message =
    error ??
    (phase === "validating"
      ? "Checking this feature…"
      : phase === "applying"
        ? "Applying this feature…"
        : phase === "success"
          ? "Feature applied."
          : validation.status === "ready"
            ? (validation.message ?? "Ready to apply.")
            : validation.message);
  const tone = error
    ? "danger"
    : phase === "success" || validation.status === "ready"
      ? "success"
      : validation.status === "blocked"
        ? "danger"
        : "warning";

  return (
    <LiveRegion urgency={error ? "assertive" : "polite"}>
      <span
        id={id}
        className={`pb-editor-validation pb-editor-validation--${tone}`}
      >
        {message}
      </span>
    </LiveRegion>
  );
}
