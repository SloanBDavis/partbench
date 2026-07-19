import { useId, type ReactNode } from "react";
import type { UiActionId } from "../../actions/actionRegistry";
import { TechnicalDetails } from "../../diagnostics/TechnicalDetails";
import type { TechnicalDetailsModel } from "../../diagnostics/technicalDetails";
import { Button } from "../../ui/Button";
import { Icon, type IconName } from "../../ui/Icon";
import "./inspectPanel.css";

export type InspectTone = "neutral" | "success" | "warning" | "danger";

export interface InspectValueRow {
  readonly label: string;
  /** A formatted, human-readable value, including its unit when applicable. */
  readonly value: string;
}

export interface InspectOwnerProjection {
  readonly part?: string;
  readonly body?: string;
  readonly feature?: string;
}

export interface InspectSelectionProjection {
  readonly kind:
    | "object"
    | "body"
    | "face"
    | "edge"
    | "feature"
    | "sketch"
    | "named-reference";
  readonly typeLabel: string;
  readonly name: string;
  readonly owner?: InspectOwnerProjection;
  readonly properties?: readonly InspectValueRow[];
}

export interface InspectMetricProjection {
  readonly title: string;
  readonly status: "loading" | "ready" | "blocked";
  readonly rows?: readonly InspectValueRow[];
  /** User-facing confidence such as “Exact result” or “From authored values”. */
  readonly confidence?: string;
  readonly message?: string;
}

export interface InspectTwoTargetProjection {
  readonly status:
    | "idle"
    | "waiting-for-first"
    | "waiting-for-second"
    | "preview"
    | "complete"
    | "blocked";
  readonly firstTarget?: string;
  readonly secondTarget?: string;
  readonly prompt: string;
  readonly results?: readonly InspectValueRow[];
  readonly confidence?: string;
}

export interface InspectMeasurementsProjection {
  readonly object?: InspectMetricProjection;
  readonly body?: InspectMetricProjection;
  readonly generatedReference?: InspectMetricProjection;
  readonly twoTarget?: InspectTwoTargetProjection;
}

export interface InspectReadinessProjection {
  readonly status: "ready" | "needs-selection" | "blocked" | "pending";
  readonly message?: string;
}

export interface InspectReferenceProjection {
  readonly kindLabel: string;
  readonly name?: string;
  readonly health: InspectHealthProjection;
  readonly naming?: InspectReadinessProjection;
  readonly repair?: InspectReadinessProjection;
  readonly stability?: InspectReadinessProjection;
  readonly repairPreview?: InspectMetricProjection;
}

export interface InspectHealthProjection {
  readonly scope: "project" | "body" | "reference";
  readonly label: string;
  readonly statusLabel: string;
  readonly tone: InspectTone;
  readonly message?: string;
  readonly recovery?: string;
}

export interface InspectContextAction {
  readonly id: UiActionId;
  readonly label: string;
  readonly icon?: IconName;
  readonly availability: InspectReadinessProjection;
}

export interface InspectPanelProps {
  readonly selection?: InspectSelectionProjection;
  readonly measurements?: InspectMeasurementsProjection;
  readonly massProperties?: InspectMetricProjection;
  readonly reference?: InspectReferenceProjection;
  readonly health?: readonly InspectHealthProjection[];
  readonly actions?: readonly InspectContextAction[];
  readonly technicalDetails?: TechnicalDetailsModel;
  readonly onAction?: (actionId: UiActionId) => void;
  readonly onMeasureSelection?: () => void;
  readonly onBeginTwoTargetMeasurement?: () => void;
  readonly onClearTwoTargetMeasurement?: () => void;
  readonly onNameReference?: () => void;
  readonly onRepairReference?: () => void;
  readonly onSaveStableReference?: () => void;
  readonly onPreviewStableRepair?: () => void;
  readonly onRepairStableReference?: () => void;
}

/**
 * Focused V18 Inspect dock. All values are supplied as human-readable,
 * query-derived projections; this component never infers CAD eligibility.
 */
export function InspectPanel({
  selection,
  measurements,
  massProperties,
  reference,
  health = [],
  actions = [],
  technicalDetails,
  onAction,
  onMeasureSelection,
  onBeginTwoTargetMeasurement,
  onClearTwoTargetMeasurement,
  onNameReference,
  onRepairReference,
  onSaveStableReference,
  onPreviewStableRepair,
  onRepairStableReference
}: InspectPanelProps) {
  const headingId = useId();
  const hasSingleMeasurement = Boolean(
    measurements?.object ||
    measurements?.body ||
    measurements?.generatedReference
  );

  return (
    <aside className="pb-inspect-panel" aria-labelledby={headingId}>
      <header className="pb-inspect-panel__header">
        <div className="pb-inspect-panel__eyebrow">Inspect</div>
        <h2 id={headingId}>Selection details</h2>
      </header>

      {selection ? (
        <SelectionSummary selection={selection} />
      ) : (
        <section className="pb-inspect-empty" aria-label="Selection">
          <Icon name="inspect" size={20} />
          <div>
            <h3>Nothing selected</h3>
            <p>
              Select a body, supported face, or supported edge to inspect it.
            </p>
          </div>
        </section>
      )}

      {(hasSingleMeasurement ||
        measurements?.twoTarget ||
        onMeasureSelection ||
        onBeginTwoTargetMeasurement) && (
        <PanelSection title="Measurements" icon="measure">
          {measurements?.object ? (
            <MetricCard metric={measurements.object} />
          ) : null}
          {measurements?.body ? (
            <MetricCard metric={measurements.body} />
          ) : null}
          {measurements?.generatedReference ? (
            <MetricCard metric={measurements.generatedReference} />
          ) : null}
          {onMeasureSelection ? (
            <Button
              className="pb-inspect-panel__wide-action"
              density="dense"
              icon="measure"
              onClick={onMeasureSelection}
            >
              Measure selection
            </Button>
          ) : null}
          {measurements?.twoTarget ? (
            <TwoTargetMeasurement
              measurement={measurements.twoTarget}
              onBegin={onBeginTwoTargetMeasurement}
              onClear={onClearTwoTargetMeasurement}
            />
          ) : onBeginTwoTargetMeasurement ? (
            <Button
              className="pb-inspect-panel__wide-action"
              density="dense"
              onClick={onBeginTwoTargetMeasurement}
            >
              Measure between two targets
            </Button>
          ) : null}
        </PanelSection>
      )}

      {massProperties ? (
        <PanelSection title="Mass properties" icon="mass-properties">
          <MetricCard metric={massProperties} />
        </PanelSection>
      ) : null}

      {reference ? (
        <ReferenceSection
          reference={reference}
          onName={onNameReference}
          onRepair={onRepairReference}
          onSaveStable={onSaveStableReference}
          onPreviewStableRepair={onPreviewStableRepair}
          onRepairStable={onRepairStableReference}
        />
      ) : null}

      {health.length > 0 ? (
        <PanelSection title="Health" icon="success">
          <div className="pb-inspect-health-list">
            {health.map((item) => (
              <HealthSummary
                key={`${item.scope}-${item.label}`}
                health={item}
              />
            ))}
          </div>
        </PanelSection>
      ) : null}

      {actions.length > 0 ? (
        <PanelSection title="Available actions">
          <div className="pb-inspect-actions">
            {actions.map((action) => (
              <ReadinessButton
                key={action.id}
                label={action.label}
                icon={action.icon}
                readiness={action.availability}
                onInvoke={() => onAction?.(action.id)}
              />
            ))}
          </div>
        </PanelSection>
      ) : null}

      {technicalDetails ? (
        <TechnicalDetails details={technicalDetails} />
      ) : null}
    </aside>
  );
}

function SelectionSummary({
  selection
}: {
  readonly selection: InspectSelectionProjection;
}) {
  return (
    <section className="pb-inspect-selection" aria-label="Current selection">
      <div className="pb-inspect-selection__identity">
        <span className="pb-inspect-selection__kind">
          {selection.typeLabel}
        </span>
        <h3>{selection.name}</h3>
      </div>
      {selection.owner ? <OwnerRows owner={selection.owner} /> : null}
      {selection.properties && selection.properties.length > 0 ? (
        <ValueRows rows={selection.properties} />
      ) : null}
    </section>
  );
}

function OwnerRows({ owner }: { readonly owner: InspectOwnerProjection }) {
  const rows: InspectValueRow[] = [
    ...(owner.part ? [{ label: "Part", value: owner.part }] : []),
    ...(owner.body ? [{ label: "Body", value: owner.body }] : []),
    ...(owner.feature ? [{ label: "Feature", value: owner.feature }] : [])
  ];

  return rows.length > 0 ? <ValueRows rows={rows} /> : null;
}

function PanelSection({
  title,
  icon,
  children
}: {
  readonly title: string;
  readonly icon?: IconName;
  readonly children: ReactNode;
}) {
  return (
    <section className="pb-inspect-section">
      <h3>
        {icon ? <Icon name={icon} size={16} /> : null}
        {title}
      </h3>
      <div className="pb-inspect-section__content">{children}</div>
    </section>
  );
}

function MetricCard({ metric }: { readonly metric: InspectMetricProjection }) {
  return (
    <div className={`pb-inspect-metric is-${metric.status}`}>
      <div className="pb-inspect-metric__heading">
        <strong>{metric.title}</strong>
        {metric.confidence ? (
          <span className="pb-inspect-confidence">{metric.confidence}</span>
        ) : null}
      </div>
      {metric.status === "loading" ? (
        <p role="status">Calculating…</p>
      ) : metric.message ? (
        <p role={metric.status === "blocked" ? "alert" : undefined}>
          {metric.message}
        </p>
      ) : null}
      {metric.rows && metric.rows.length > 0 ? (
        <ValueRows rows={metric.rows} numeric />
      ) : null}
    </div>
  );
}

function TwoTargetMeasurement({
  measurement,
  onBegin,
  onClear
}: {
  readonly measurement: InspectTwoTargetProjection;
  readonly onBegin?: () => void;
  readonly onClear?: () => void;
}) {
  const active =
    measurement.status !== "idle" && measurement.status !== "waiting-for-first";
  return (
    <div className="pb-inspect-two-target" aria-label="Two-target measurement">
      <div className="pb-inspect-two-target__heading">
        <strong>Measure between</strong>
        <StatusPill
          tone={measurement.status === "blocked" ? "warning" : "neutral"}
        >
          {formatTwoTargetStatus(measurement.status)}
        </StatusPill>
      </div>
      <ol className="pb-inspect-targets">
        <li className={measurement.firstTarget ? "is-filled" : ""}>
          <span>1</span>
          {measurement.firstTarget ?? "Select the first target"}
        </li>
        <li className={measurement.secondTarget ? "is-filled" : ""}>
          <span>2</span>
          {measurement.secondTarget ?? "Select the second target"}
        </li>
      </ol>
      <p className="pb-inspect-guidance">{measurement.prompt}</p>
      {measurement.results && measurement.results.length > 0 ? (
        <ValueRows rows={measurement.results} numeric />
      ) : null}
      {measurement.confidence ? (
        <span className="pb-inspect-confidence">{measurement.confidence}</span>
      ) : null}
      <div className="pb-inspect-actions">
        {onBegin ? (
          <Button density="dense" onClick={onBegin}>
            {active ? "Start over" : "Start two-target measure"}
          </Button>
        ) : null}
        {active && onClear ? (
          <Button density="dense" tone="danger" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ReferenceSection({
  reference,
  onName,
  onRepair,
  onSaveStable,
  onPreviewStableRepair,
  onRepairStable
}: {
  readonly reference: InspectReferenceProjection;
  readonly onName?: () => void;
  readonly onRepair?: () => void;
  readonly onSaveStable?: () => void;
  readonly onPreviewStableRepair?: () => void;
  readonly onRepairStable?: () => void;
}) {
  return (
    <PanelSection title="Reference" icon="reference">
      <div className="pb-inspect-reference__identity">
        <span>{reference.kindLabel}</span>
        <strong>{reference.name ?? "Unnamed selection"}</strong>
      </div>
      <HealthSummary health={reference.health} />
      <div className="pb-inspect-actions">
        {reference.naming && onName ? (
          <ReadinessButton
            label={reference.name ? "Rename reference" : "Name reference"}
            icon="reference"
            readiness={reference.naming}
            onInvoke={onName}
          />
        ) : null}
        {reference.repair && onRepair ? (
          <ReadinessButton
            label="Repair reference"
            icon="repair"
            readiness={reference.repair}
            onInvoke={onRepair}
          />
        ) : null}
        {reference.stability && onSaveStable ? (
          <ReadinessButton
            label="Save stable reference"
            icon="reference"
            readiness={reference.stability}
            onInvoke={onSaveStable}
          />
        ) : null}
        {onPreviewStableRepair ? (
          <Button density="dense" onClick={onPreviewStableRepair}>
            Check repair candidates
          </Button>
        ) : null}
        {onRepairStable && reference.repairPreview?.status === "ready" ? (
          <Button density="dense" icon="repair" onClick={onRepairStable}>
            Repair saved reference
          </Button>
        ) : null}
      </div>
      {reference.repairPreview ? (
        <MetricCard metric={reference.repairPreview} />
      ) : null}
    </PanelSection>
  );
}

function HealthSummary({
  health
}: {
  readonly health: InspectHealthProjection;
}) {
  return (
    <div className={`pb-inspect-health is-${health.tone}`}>
      <div className="pb-inspect-health__heading">
        <strong>{health.label}</strong>
        <StatusPill tone={health.tone}>{health.statusLabel}</StatusPill>
      </div>
      {health.message ? <p>{health.message}</p> : null}
      {health.recovery ? (
        <p className="pb-inspect-health__recovery">{health.recovery}</p>
      ) : null}
    </div>
  );
}

function ReadinessButton({
  label,
  icon,
  readiness,
  onInvoke
}: {
  readonly label: string;
  readonly icon?: IconName;
  readonly readiness: InspectReadinessProjection;
  readonly onInvoke: () => void;
}) {
  const blocked = readiness.status === "blocked";
  const pending = readiness.status === "pending";
  return (
    <div className="pb-inspect-action">
      <Button
        density="dense"
        icon={icon}
        pending={pending}
        unavailableReason={
          blocked ? (readiness.message ?? "Unavailable") : undefined
        }
        onClick={onInvoke}
      >
        {label}
      </Button>
      {readiness.message && readiness.status !== "ready" ? (
        <span className="pb-inspect-action__message">{readiness.message}</span>
      ) : null}
    </div>
  );
}

function ValueRows({
  rows,
  numeric = false
}: {
  readonly rows: readonly InspectValueRow[];
  readonly numeric?: boolean;
}) {
  return (
    <dl className="pb-inspect-values">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <dt>{row.label}</dt>
          <dd className={numeric ? "pb-numeric" : undefined}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusPill({
  tone,
  children
}: {
  readonly tone: InspectTone;
  readonly children: ReactNode;
}) {
  return <span className={`pb-inspect-status is-${tone}`}>{children}</span>;
}

function formatTwoTargetStatus(
  status: InspectTwoTargetProjection["status"]
): string {
  switch (status) {
    case "idle":
      return "Not started";
    case "waiting-for-first":
      return "First target";
    case "waiting-for-second":
      return "Second target";
    case "preview":
      return "Preview";
    case "complete":
      return "Complete";
    case "blocked":
      return "Needs attention";
  }
}
