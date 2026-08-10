import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import type {
  SketchProfileRegionCandidate,
  SketchProfileRegionCandidatesQuery,
  SketchProfileRegionValidateQueryResponse,
  SketchRegionsProfileRef,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type {
  SketchRegionCandidatesQueryResult,
  SketchRegionValidateQueryResult
} from "../../sketchRegionQueryClient";
import { TechnicalDetails } from "../../diagnostics/TechnicalDetailsView";
import {
  formatUserDiagnostic,
  translateUserDiagnostic,
  type StructuredDiagnosticInput
} from "../../diagnostics/userDiagnostic";
import { LiveRegion } from "../../ui/LiveRegion";
import { NumericInput } from "../../ui/NumericInput";
import type { SketchCurveEditSessionControl } from "./SketchCurveEditPanel";
import { useEscapeEditorContributor } from "../../actions/useEscapeEditorContributor";
import {
  SKETCH_REGION_CONSUMER_OPTIONS,
  createSketchEntitySemanticNames,
  createSelectedSketchRegionsProfile,
  formatSketchRegionCandidateName,
  isSketchRegionSelectionCountReady,
  type SketchRegionConsumerIntent
} from "./sketchRegionSelectionModel";

const PAGE_LIMIT = 100;
const CANDIDATE_WINDOW_SIZE = 12;
const AREA_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 4
});

export interface SketchRegionSelectionPanelProps {
  readonly disabled: boolean;
  readonly sketch: SketchSnapshot;
  readonly sourceAuthorityKey: string | number;
  readonly candidates: readonly SketchProfileRegionCandidate[];
  readonly selectedCandidateKeys: readonly string[];
  readonly hoveredCandidateKey?: string;
  readonly consumer: SketchRegionConsumerIntent;
  readonly targetBodies?: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly keyboardSuspended?: boolean;
  readonly queryCandidates: (
    query: SketchProfileRegionCandidatesQuery,
    signal: AbortSignal
  ) => Promise<SketchRegionCandidatesQueryResult>;
  readonly validateProfile: (
    profile: SketchRegionsProfileRef,
    signal: AbortSignal
  ) => Promise<SketchRegionValidateQueryResult>;
  readonly onCandidatesChange: (
    candidates: readonly SketchProfileRegionCandidate[]
  ) => void;
  readonly onToggleCandidate: (candidateKey: string) => void;
  readonly onHoverCandidate: (candidateKey: string | undefined) => void;
  readonly onConsumerChange: (consumer: SketchRegionConsumerIntent) => void;
  readonly onApplyReady: (
    profile: SketchRegionsProfileRef,
    response: SketchProfileRegionValidateQueryResponse,
    featureDraft: SketchRegionFeatureDraft
  ) => boolean | Promise<boolean>;
  readonly onCancel: (restoreFocus?: boolean) => void;
  readonly onRequestEscape?: (dirty: boolean) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly onSessionControlChange?: (
    control: SketchCurveEditSessionControl | undefined
  ) => void;
}

export type SketchRegionFeatureDraft =
  | {
      readonly consumer: "extrude-new-body";
      readonly operationMode: "newBody";
      readonly depth: number;
      readonly side: "positive" | "negative" | "symmetric";
    }
  | {
      readonly consumer: "extrude-add-cut";
      readonly operationMode: "add" | "cut";
      readonly targetBodyId: string;
      readonly depth: number;
      readonly side: "positive" | "negative" | "symmetric";
    }
  | {
      readonly consumer: "revolve-new-body";
      readonly operationMode: "newBody";
      readonly axisEntityId: string;
      readonly angleDegrees: number;
    };

interface RegionPageState {
  readonly status: "loading" | "ready" | "blocked" | "failed";
  readonly candidateCount: number;
  readonly hasMore: boolean;
  readonly nextAfterCandidateKey?: string;
  readonly sourceRevision?: string;
  readonly diagnostics: readonly StructuredDiagnosticInput[];
}

const INITIAL_PAGE_STATE: RegionPageState = {
  status: "loading",
  candidateCount: 0,
  hasMore: false,
  diagnostics: []
};

export function SketchRegionSelectionPanel(
  props: SketchRegionSelectionPanelProps
) {
  const {
    disabled,
    sketch,
    sourceAuthorityKey,
    candidates,
    selectedCandidateKeys,
    hoveredCandidateKey,
    consumer,
    targetBodies = [],
    keyboardSuspended = false,
    queryCandidates,
    validateProfile,
    onCandidatesChange,
    onToggleCandidate,
    onHoverCandidate,
    onConsumerChange,
    onApplyReady,
    onCancel,
    onRequestEscape,
    onDirtyChange,
    onSessionControlChange
  } = props;
  const [page, setPage] = useState<RegionPageState>(INITIAL_PAGE_STATE);
  const [applying, setApplying] = useState(false);
  const [operationMode, setOperationMode] = useState<"add" | "cut">("add");
  const [targetBodyId, setTargetBodyId] = useState("");
  const [depth, setDepth] = useState(10);
  const [side, setSide] = useState<"positive" | "negative" | "symmetric">(
    "positive"
  );
  const [axisEntityId, setAxisEntityId] = useState("");
  const [angleDegrees, setAngleDegrees] = useState(360);
  const [validationMessages, setValidationMessages] = useState<
    readonly StructuredDiagnosticInput[]
  >([]);
  const [candidateWindow, setCandidateWindow] = useState(() => ({
    authorityKey: sourceAuthorityKey,
    start: 0
  }));
  const maximumCandidateWindowStart = Math.max(
    0,
    Math.floor((candidates.length - 1) / CANDIDATE_WINDOW_SIZE) *
      CANDIDATE_WINDOW_SIZE
  );
  const candidateWindowStart =
    candidateWindow.authorityKey === sourceAuthorityKey
      ? Math.min(candidateWindow.start, maximumCandidateWindowStart)
      : 0;
  function updateCandidateWindowStart(update: (current: number) => number) {
    setCandidateWindow({
      authorityKey: sourceAuthorityKey,
      start: update(candidateWindowStart)
    });
  }
  const formRef = useRef<HTMLFormElement>(null);
  const queryAbortRef = useRef<AbortController | undefined>(undefined);
  const validationAbortRef = useRef<AbortController | undefined>(undefined);
  const applyRef = useRef<
    (options?: { readonly restoreFocusOnSuccess?: boolean }) => Promise<boolean>
  >(async () => false);
  const effectiveTargetBodyId = targetBodies.some(
    (target) => target.id === targetBodyId
  )
    ? targetBodyId
    : "";
  const dirty =
    selectedCandidateKeys.length > 0 ||
    consumer !== "extrude-new-body" ||
    operationMode !== "add" ||
    effectiveTargetBodyId !== "" ||
    depth !== 10 ||
    side !== "positive" ||
    axisEntityId !== "" ||
    angleDegrees !== 360;
  const selectionCountReady = isSketchRegionSelectionCountReady(
    selectedCandidateKeys.length,
    consumer
  );
  const selectedBoundaryEntityIds = useMemo(
    () =>
      new Set(
        candidates
          .filter((candidate) =>
            selectedCandidateKeys.includes(candidate.candidateKey)
          )
          .flatMap((candidate) => [
            ...candidate.outerEntityIds,
            ...candidate.holeEntityIds.flat()
          ])
      ),
    [candidates, selectedCandidateKeys]
  );
  const axisOptions = useMemo(
    () =>
      sketch.entities.filter(
        (entity) =>
          entity.kind === "line" && !selectedBoundaryEntityIds.has(entity.id)
      ),
    [selectedBoundaryEntityIds, sketch.entities]
  );
  const effectiveAxisEntityId = axisOptions.some(
    (entity) => entity.id === axisEntityId
  )
    ? axisEntityId
    : "";
  const featureInputReady =
    consumer === "revolve-new-body"
      ? effectiveAxisEntityId.length > 0 &&
        Number.isFinite(angleDegrees) &&
        angleDegrees > 0 &&
        angleDegrees <= 360
      : Number.isFinite(depth) &&
        depth > 0 &&
        (consumer !== "extrude-add-cut" || effectiveTargetBodyId.length > 0);
  const canApply =
    page.status === "ready" &&
    selectionCountReady &&
    featureInputReady &&
    !disabled &&
    !applying;
  const entityNames = useMemo(
    () => createSketchEntitySemanticNames(sketch),
    [sketch]
  );
  const visibleCandidates = useMemo(
    () =>
      candidates.slice(
        candidateWindowStart,
        candidateWindowStart + CANDIDATE_WINDOW_SIZE
      ),
    [candidateWindowStart, candidates]
  );
  const candidateNames = useMemo(
    () =>
      new Map(
        visibleCandidates.map((candidate) => [
          candidate.candidateKey,
          formatSketchRegionCandidateName(candidate, entityNames)
        ])
      ),
    [entityNames, visibleCandidates]
  );
  const selectedKeys = useMemo(
    () => new Set(selectedCandidateKeys),
    [selectedCandidateKeys]
  );

  const readPage = useCallback(
    async (
      cursor:
        | {
            readonly afterCandidateKey: string;
            readonly sourceRevision: string;
          }
        | undefined
    ) => {
      queryAbortRef.current?.abort();
      const abortController = new AbortController();
      queryAbortRef.current = abortController;
      setPage((current) => ({
        ...current,
        status: "loading",
        diagnostics: []
      }));
      try {
        const response = await queryCandidates(
          {
            query: "sketch.profileRegionCandidates",
            sketchId: sketch.id,
            limit: PAGE_LIMIT,
            ...(cursor ?? {})
          },
          abortController.signal
        );
        if (abortController.signal.aborted) return;
        if (!response.ok) {
          setPage({
            status: "failed",
            candidateCount: 0,
            hasMore: false,
            diagnostics: [withTechnicalContext(response.error)]
          });
          if (!cursor) onCandidatesChange([]);
          return;
        }
        const merged = cursor
          ? mergeCandidatePages(candidates, response.candidates)
          : response.candidates;
        onCandidatesChange(merged);
        setPage({
          status: response.status,
          candidateCount: response.candidateCount,
          hasMore: response.hasMore,
          ...(response.nextAfterCandidateKey
            ? { nextAfterCandidateKey: response.nextAfterCandidateKey }
            : {}),
          sourceRevision: response.sourceRevision,
          diagnostics: response.diagnostics.map(withTechnicalContext)
        });
      } catch (error) {
        if (abortController.signal.aborted) return;
        setPage({
          status: "failed",
          candidateCount: 0,
          hasMore: false,
          diagnostics: [
            {
              severity: "error",
              message: "Region discovery could not be evaluated.",
              detail: error
            }
          ]
        });
        if (!cursor) onCandidatesChange([]);
      }
    },
    [candidates, onCandidatesChange, queryCandidates, sketch.id]
  );
  const refreshCandidates = useEffectEvent(() => {
    onCandidatesChange([]);
    onHoverCandidate(undefined);
    void readPage(undefined);
  });

  useEffect(() => {
    void sourceAuthorityKey;
    const timeout = window.setTimeout(refreshCandidates, 0);
    return () => {
      window.clearTimeout(timeout);
      queryAbortRef.current?.abort();
    };
  }, [sketch.id, sourceAuthorityKey]);

  async function apply(
    options: { readonly restoreFocusOnSuccess?: boolean } = {}
  ): Promise<boolean> {
    if (!canApply) return false;
    const profile = createSelectedSketchRegionsProfile(
      sketch.id,
      candidates,
      selectedCandidateKeys
    );
    if (!profile) {
      setValidationMessages([
        {
          message: "Select a complete valid set of whole-loop material regions."
        }
      ]);
      return false;
    }

    validationAbortRef.current?.abort();
    const abortController = new AbortController();
    validationAbortRef.current = abortController;
    setApplying(true);
    setValidationMessages([]);
    try {
      const response = await validateProfile(profile, abortController.signal);
      if (abortController.signal.aborted) return false;
      if (!response.ok) {
        setValidationMessages([withTechnicalContext(response.error)]);
        return false;
      }
      if (response.status !== "ready" || !response.normalizedProfile) {
        setValidationMessages(response.diagnostics.map(withTechnicalContext));
        return false;
      }
      const featureDraft: SketchRegionFeatureDraft =
        consumer === "revolve-new-body"
          ? {
              consumer,
              operationMode: "newBody",
              axisEntityId: effectiveAxisEntityId,
              angleDegrees
            }
          : consumer === "extrude-add-cut"
            ? {
                consumer,
                operationMode,
                targetBodyId: effectiveTargetBodyId,
                depth,
                side
              }
            : {
                consumer,
                operationMode: "newBody",
                depth,
                side
              };
      const committed = await onApplyReady(
        response.normalizedProfile,
        response,
        featureDraft
      );
      if (!committed) {
        setValidationMessages([
          {
            message:
              "The exact region selection is valid, but the feature command did not commit."
          }
        ]);
        return false;
      }
      onCancel(options.restoreFocusOnSuccess ?? true);
      return true;
    } catch (error) {
      if (abortController.signal.aborted) return false;
      setValidationMessages([
        {
          severity: "error",
          message: "The selected regions could not be validated.",
          detail: error
        }
      ]);
      return false;
    } finally {
      if (!abortController.signal.aborted) setApplying(false);
    }
  }
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onSessionControlChange?.({
      apply: (options) => applyRef.current(options),
      focus: () => focusRegionInitialControl(formRef.current),
      canApply
    });
    return () => onSessionControlChange?.(undefined);
  }, [canApply, onSessionControlChange]);

  useEffect(() => {
    focusRegionInitialControl(formRef.current);
  }, []);

  useEscapeEditorContributor({
    id: "sketch-region-selection",
    suspended: keyboardSuspended,
    state: dirty ? "dirty" : "clean",
    onCancelClean: () => onCancel(true),
    onRequestDirtyGuard: () =>
      onRequestEscape ? onRequestEscape(true) : onCancel(true)
  });

  useEffect(
    () => () => {
      queryAbortRef.current?.abort();
      validationAbortRef.current?.abort();
      onHoverCandidate(undefined);
    },
    [onHoverCandidate]
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    void apply();
  }

  return (
    <form
      ref={formRef}
      className="pb-sketch-section pb-region-select"
      aria-label="Select sketch material regions"
      onSubmit={submit}
    >
      <div className="pb-region-select__scroll">
        <div className="pb-sketch-section__heading">
          <div>
            <p className="pb-sketch-eyebrow">Profile</p>
            <h3>Material regions</h3>
          </div>
          <span>{page.status}</span>
        </div>

        <p className="pb-region-select__guidance">
          Select exact whole-loop cells. Candidate shading is derived; Apply
          revalidates the explicit loop references and submits the same typed
          feature command used by every caller.
        </p>

        <label className="pb-sketch-field">
          <span>Prospective consumer</span>
          <select
            className="pb-field"
            data-drawer-initial-focus=""
            value={consumer}
            disabled={disabled}
            onChange={(event) =>
              onConsumerChange(
                event.currentTarget.value as SketchRegionConsumerIntent
              )
            }
          >
            {SKETCH_REGION_CONSUMER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} · {option.countLabel}
              </option>
            ))}
          </select>
        </label>

        {consumer === "extrude-add-cut" ? (
          <>
            <label className="pb-sketch-field">
              <span>Operation</span>
              <select
                className="pb-field"
                value={operationMode}
                disabled={disabled}
                onChange={(event) =>
                  setOperationMode(event.currentTarget.value as "add" | "cut")
                }
              >
                <option value="add">Add</option>
                <option value="cut">Cut</option>
              </select>
            </label>
            <label className="pb-sketch-field">
              <span>Target body</span>
              <select
                className="pb-field"
                value={effectiveTargetBodyId}
                required
                disabled={disabled}
                onChange={(event) => setTargetBodyId(event.currentTarget.value)}
              >
                <option value="">Choose a target body</option>
                {targetBodies.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {consumer !== "revolve-new-body" ? (
          <>
            <label className="pb-sketch-field">
              <span>Depth</span>
              <NumericInput
                className="pb-field"
                name="region-extrude-depth"
                min="0.000001"
                step="0.1"
                value={depth}
                disabled={disabled}
                onValueChange={setDepth}
              />
            </label>
            <label className="pb-sketch-field">
              <span>Side</span>
              <select
                className="pb-field"
                value={side}
                disabled={disabled}
                onChange={(event) =>
                  setSide(
                    event.currentTarget.value as
                      | "positive"
                      | "negative"
                      | "symmetric"
                  )
                }
              >
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="symmetric">Symmetric</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="pb-sketch-field">
              <span>Axis line</span>
              <select
                className="pb-field"
                value={effectiveAxisEntityId}
                required
                disabled={disabled}
                onChange={(event) => setAxisEntityId(event.currentTarget.value)}
              >
                <option value="">Choose an axis line</option>
                {axisOptions.map((axis) => (
                  <option key={axis.id} value={axis.id}>
                    {entityNames.get(axis.id) ?? "Line"}
                    {axis.construction ? " · Construction" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="pb-sketch-field">
              <span>Angle</span>
              <NumericInput
                className="pb-field"
                name="region-revolve-angle"
                min="0.000001"
                max="360"
                step="1"
                value={angleDegrees}
                disabled={disabled}
                onValueChange={setAngleDegrees}
              />
            </label>
          </>
        )}

        <div className="pb-region-select__summary" role="status">
          <strong>{selectedCandidateKeys.length} selected</strong>
          <span>
            {SKETCH_REGION_CONSUMER_OPTIONS.find(
              (option) => option.value === consumer
            )?.countLabel ?? "Exactly 1 region"}
          </span>
        </div>

        <fieldset
          className="pb-region-select__candidates"
          data-loaded-candidate-count={candidates.length}
        >
          <legend>Whole-loop material cells</legend>
          {page.status === "loading" && candidates.length === 0 ? (
            <p>Discovering bounded cells…</p>
          ) : null}
          {page.status !== "loading" && candidates.length === 0 ? (
            <p>No valid whole-loop material cells were discovered.</p>
          ) : null}
          {visibleCandidates.map((candidate, index) => (
            <RegionCandidateRow
              key={candidate.candidateKey}
              candidate={candidate}
              index={candidateWindowStart + index}
              names={candidateNames.get(candidate.candidateKey)!}
              selected={selectedKeys.has(candidate.candidateKey)}
              hovered={hoveredCandidateKey === candidate.candidateKey}
              disabled={disabled}
              onToggleCandidate={onToggleCandidate}
              onHoverCandidate={onHoverCandidate}
            />
          ))}
        </fieldset>

        {candidates.length > CANDIDATE_WINDOW_SIZE ? (
          <div
            className="pb-region-select__window"
            aria-label="Loaded candidate rows"
          >
            <button
              type="button"
              className="pb-button"
              disabled={candidateWindowStart === 0}
              onClick={() =>
                updateCandidateWindowStart((current) =>
                  Math.max(0, current - CANDIDATE_WINDOW_SIZE)
                )
              }
            >
              Previous rows
            </button>
            <span>
              {candidateWindowStart + 1}–
              {Math.min(
                candidateWindowStart + CANDIDATE_WINDOW_SIZE,
                candidates.length
              )}{" "}
              of {candidates.length}
            </span>
            <button
              type="button"
              className="pb-button"
              disabled={
                candidateWindowStart + CANDIDATE_WINDOW_SIZE >=
                candidates.length
              }
              onClick={() =>
                updateCandidateWindowStart((current) =>
                  Math.min(
                    Math.max(
                      0,
                      Math.floor(
                        (candidates.length - 1) / CANDIDATE_WINDOW_SIZE
                      ) * CANDIDATE_WINDOW_SIZE
                    ),
                    current + CANDIDATE_WINDOW_SIZE
                  )
                )
              }
            >
              Next rows
            </button>
          </div>
        ) : null}

        {page.hasMore && page.nextAfterCandidateKey && page.sourceRevision ? (
          <button
            type="button"
            className="pb-button"
            disabled={disabled || page.status === "loading"}
            onClick={() =>
              void readPage({
                afterCandidateKey: page.nextAfterCandidateKey!,
                sourceRevision: page.sourceRevision!
              })
            }
          >
            {page.status === "loading" ? "Loading…" : "Load next page"}
          </button>
        ) : null}

        {[...page.diagnostics, ...validationMessages].length > 0 ? (
          <div className="pb-region-select__diagnostics" role="alert">
            <strong>Region diagnostics</strong>
            <ul>
              {[...page.diagnostics, ...validationMessages].map(
                (diagnostic, index) => (
                  <li key={`${index}:${diagnostic.code ?? "message"}`}>
                    {formatRegionDiagnostic(diagnostic)}
                    {diagnostic.code ||
                    diagnostic.detail !== undefined ||
                    diagnostic.context ? (
                      <TechnicalDetails diagnostic={diagnostic} />
                    ) : null}
                  </li>
                )
              )}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="pb-curve-edit__footer">
        <p className="pb-curve-edit__shortcut">
          Ctrl/Cmd+Enter applies · Escape cancels
        </p>
        <div>
          <button
            type="button"
            className="pb-button"
            disabled={applying}
            onClick={() => onCancel(true)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="pb-button pb-button--primary"
            disabled={!canApply}
          >
            {applying
              ? "Applying…"
              : consumer === "revolve-new-body"
                ? "Create revolve"
                : "Create extrude"}
          </button>
        </div>
      </div>
      <LiveRegion urgency={validationMessages.length ? "assertive" : "polite"}>
        {(validationMessages[0]
          ? formatRegionDiagnostic(validationMessages[0])
          : undefined) ??
          (canApply
            ? "Selected regions are ready to apply."
            : `${selectedCandidateKeys.length} regions selected.`)}
      </LiveRegion>
    </form>
  );
}

const RegionCandidateRow = memo(function RegionCandidateRow({
  candidate,
  index,
  names,
  selected,
  hovered,
  disabled,
  onToggleCandidate,
  onHoverCandidate
}: {
  readonly candidate: SketchProfileRegionCandidate;
  readonly index: number;
  readonly names: {
    readonly outer: string;
    readonly holes: readonly string[];
  };
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly disabled: boolean;
  readonly onToggleCandidate: (candidateKey: string) => void;
  readonly onHoverCandidate: (candidateKey: string | undefined) => void;
}) {
  const blocked = candidate.status !== "valid";
  const rowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const findOverlayCell = () =>
      [
        ...document.querySelectorAll<SVGPathElement>(".sketch-region-cell")
      ].find((cell) => cell.dataset.candidateKey === candidate.candidateKey);
    const publishHover = () => {
      row.dataset.hovered = "true";
      findOverlayCell()?.classList.add("sketch-region-cell-hovered");
      onHoverCandidate(candidate.candidateKey);
    };
    const clearHover = () => {
      delete row.dataset.hovered;
      findOverlayCell()?.classList.remove("sketch-region-cell-hovered");
      onHoverCandidate(undefined);
    };
    row.addEventListener("pointermove", publishHover);
    row.addEventListener("pointerleave", clearHover);
    return () => {
      row.removeEventListener("pointermove", publishHover);
      row.removeEventListener("pointerleave", clearHover);
    };
  }, [candidate.candidateKey, onHoverCandidate]);

  const diagnostic = candidate.diagnostics[0];
  return (
    <div className="pb-region-select__candidate-wrap">
      <button
        ref={rowRef}
        type="button"
        className="pb-region-select__candidate"
        aria-pressed={selected}
        data-candidate-key={candidate.candidateKey}
        data-hovered={hovered || undefined}
        disabled={disabled || blocked}
        onClick={() => onToggleCandidate(candidate.candidateKey)}
        onFocus={() => onHoverCandidate(candidate.candidateKey)}
        onBlur={() => onHoverCandidate(undefined)}
        onPointerEnter={() => onHoverCandidate(candidate.candidateKey)}
        onPointerMove={() => onHoverCandidate(candidate.candidateKey)}
        onPointerLeave={() => onHoverCandidate(undefined)}
      >
        <span className="pb-region-select__candidate-title">
          <strong>Region {index + 1}</strong>
          <span>{formatArea(candidate.materialArea)}²</span>
        </span>
        <span>Outer · {names.outer}</span>
        <small>
          {names.holes.length
            ? `Holes · ${names.holes.join(" | ")}`
            : "No inner voids"}
        </small>
        {diagnostic ? (
          <small className="pb-region-select__candidate-error">
            {formatRegionDiagnostic(diagnostic)}
          </small>
        ) : null}
      </button>
      {diagnostic ? (
        <TechnicalDetails diagnostic={withTechnicalContext(diagnostic)} />
      ) : null}
    </div>
  );
});

function mergeCandidatePages(
  current: readonly SketchProfileRegionCandidate[],
  incoming: readonly SketchProfileRegionCandidate[]
): readonly SketchProfileRegionCandidate[] {
  const byKey = new Map(
    current.map((candidate) => [candidate.candidateKey, candidate])
  );
  for (const candidate of incoming)
    byKey.set(candidate.candidateKey, candidate);
  return [...byKey.values()];
}

function focusRegionInitialControl(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => {
    form
      ?.querySelector<HTMLElement>(
        "[data-drawer-initial-focus], button:not([disabled]), select:not([disabled])"
      )
      ?.focus();
  });
}

function formatArea(area: number): string {
  return AREA_FORMATTER.format(area);
}

function formatRegionDiagnostic(diagnostic: StructuredDiagnosticInput): string {
  return formatUserDiagnostic(translateUserDiagnostic(diagnostic));
}

function withTechnicalContext<T extends StructuredDiagnosticInput>(
  diagnostic: T
): StructuredDiagnosticInput {
  return {
    ...diagnostic,
    context:
      diagnostic.context ??
      (diagnostic as unknown as Readonly<Record<string, unknown>>)
  };
}
