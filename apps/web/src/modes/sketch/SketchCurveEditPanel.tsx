import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction
} from "react";
import type {
  PreparedSketchCurveEditOp,
  SketchCurveEditConstraintImpact,
  SketchCurveEditDimensionImpact,
  SketchCurveEditImpact,
  SketchCurveEditPreview,
  SketchCurveEditProposal,
  SketchCurveEditReadinessQueryResponse,
  SketchEntitySnapshot,
  SketchSnapshot,
  Vec2
} from "@web-cad/cad-protocol";
import {
  applySketchCurveEditViewportChoice,
  buildSketchCurveEditProposal,
  commitSketchCurveEditDraftChange,
  createSketchCurveEditDraft,
  createSketchCurveEditPreviewDraft,
  createSketchCurveEditReadinessAuthorityKey,
  discoverSketchExtendHitChoices,
  discoverSketchExtendHitChoicesAsync,
  discoverSketchTrimIntervalChoices,
  discoverSketchTrimIntervalChoicesAsync,
  formatCurveEditDiagnostic,
  getCurveEditKeyboardCommand,
  getNextCurveEditCollector,
  getSketchOffsetSideChoices,
  getSketchCurveEditKindLabel,
  getSketchEntitySemanticLabel,
  handleSketchCurveEditWindowShortcut,
  hasCollectedSketchCurveEditChoices,
  isEligibleCurveEditBoundary,
  isEligibleCurveEditTarget,
  projectSketchCurveEditReadiness,
  summarizeCurveEditImpact,
  type SketchCurveEditDraft,
  type SketchCurveEditKind,
  type SketchCurveEditViewportChoice,
  type SketchExtendHitChoice,
  type SketchTrimIntervalChoice
} from "./sketchCurveEditModel";

const CURVE_TARGET_WINDOW_SIZE = 12;

export type SketchCurveEditAsyncReadinessReader = (
  proposal: SketchCurveEditProposal,
  signal: AbortSignal
) => Promise<SketchCurveEditReadinessQueryResponse>;

export interface SketchCurveEditPanelProps {
  readonly disabled: boolean;
  readonly kind: SketchCurveEditKind;
  readonly sketch: SketchSnapshot;
  readonly selectedEntityId?: string;
  readonly sourceAuthorityKey: string | number;
  readonly viewportChoice?: SketchCurveEditViewportChoice;
  readonly viewportHoverChoice?: SketchCurveEditViewportChoice;
  readonly keyboardSuspended?: boolean;
  readonly readReadiness?: (
    proposal: SketchCurveEditProposal
  ) => SketchCurveEditReadinessQueryResponse;
  readonly readReadinessAsync?: SketchCurveEditAsyncReadinessReader;
  readonly onSelectEntity?: (entityId: string) => void;
  readonly onApply: (
    operation: PreparedSketchCurveEditOp
  ) => boolean | Promise<boolean>;
  readonly onCancel: (restoreFocus?: boolean) => void;
  readonly onRequestEscape?: (dirty: boolean) => void;
  readonly onChoiceRejected?: (message: string) => void;
  readonly onClearHoverPreview?: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly onSessionControlChange?: (
    control: SketchCurveEditSessionControl | undefined
  ) => void;
}

export interface SketchCurveEditSessionControl {
  readonly apply: (options?: {
    readonly restoreFocusOnSuccess?: boolean;
  }) => Promise<boolean>;
  readonly focus: () => void;
  readonly getReturnFocusTarget?: () => HTMLElement | null;
  readonly closeLocalDraft?: () => void;
}

export function SketchCurveEditPanel(props: SketchCurveEditPanelProps) {
  const {
    disabled,
    kind,
    sketch,
    selectedEntityId,
    sourceAuthorityKey,
    viewportChoice,
    viewportHoverChoice,
    keyboardSuspended = false,
    readReadiness,
    readReadinessAsync,
    onSelectEntity,
    onApply,
    onCancel,
    onRequestEscape,
    onChoiceRejected,
    onClearHoverPreview,
    onDirtyChange,
    onSessionControlChange
  } = props;
  const [initialDraft] = useState(() =>
    createSketchCurveEditDraft(kind, sketch, selectedEntityId)
  );
  const [draft, setDraft] = useState(initialDraft);
  const changeDraft = useCallback(
    (action: SetStateAction<SketchCurveEditDraft>) =>
      commitSketchCurveEditDraftChange(onClearHoverPreview, () =>
        setDraft(action)
      ),
    [onClearHoverPreview]
  );
  const [applying, setApplying] = useState(false);
  const [readinessRefresh, setReadinessRefresh] = useState(0);
  const editorRef = useRef<HTMLFormElement>(null);
  const applyRef = useRef<
    (options?: { readonly restoreFocusOnSuccess?: boolean }) => Promise<boolean>
  >(async () => false);
  const lastViewportSequence = useRef<number | undefined>(undefined);
  const lastSelectedEntityId = useRef(selectedEntityId);
  const readinessAuthorityKey = createSketchCurveEditReadinessAuthorityKey(
    sourceAuthorityKey,
    readinessRefresh
  );
  const committedProposal = useMemo(
    () => buildSketchCurveEditProposal(sketch.id, draft),
    [draft, sketch.id]
  );
  const committedReadinessResult = useCurveEditReadinessQuery(
    committedProposal,
    readinessAuthorityKey,
    readReadiness,
    readReadinessAsync
  );
  const committedReadiness = committedReadinessResult.readiness;
  const previewDraft = useMemo(
    () => createSketchCurveEditPreviewDraft(draft, viewportHoverChoice, sketch),
    [draft, sketch, viewportHoverChoice]
  );
  const hoverProposal = useMemo(
    () => buildSketchCurveEditProposal(sketch.id, previewDraft),
    [previewDraft, sketch.id]
  );
  const hoverReadinessResult = useCurveEditReadinessQuery(
    viewportHoverChoice ? hoverProposal : undefined,
    readinessAuthorityKey,
    readReadiness,
    readReadinessAsync
  );
  const hoverReadiness = hoverReadinessResult.readiness;
  const readinessProjection = useMemo(
    () => projectSketchCurveEditReadiness(committedReadiness, hoverReadiness),
    [committedReadiness, hoverReadiness]
  );
  const readiness = readinessProjection.displayReadiness;
  const target = sketch.entities.find(
    (entity) =>
      entity.id ===
      (draft.kind === "offset" && draft.offsetSourceMode === "chain"
        ? draft.offsetSegments[0]?.entityId
        : draft.targetEntityId)
  );
  const targetOptions = useMemo(
    () =>
      sketch.entities.filter((entity) =>
        isEligibleCurveEditTarget(kind, entity)
      ),
    [kind, sketch.entities]
  );
  const selectedTargetIndex = targetOptions.findIndex(
    (entity) => entity.id === draft.targetEntityId
  );
  const selectedTargetWindowStart =
    selectedTargetIndex < 0
      ? 0
      : Math.floor(selectedTargetIndex / CURVE_TARGET_WINDOW_SIZE) *
        CURVE_TARGET_WINDOW_SIZE;
  const targetWindowAuthorityKey = `${sketch.id}\u0000${kind}\u0000${
    draft.targetEntityId
  }\u0000${targetOptions.map((entity) => entity.id).join("\u0001")}`;
  const [targetWindow, setTargetWindow] = useState(() => ({
    authorityKey: targetWindowAuthorityKey,
    start: selectedTargetWindowStart
  }));
  const targetWindowStart =
    targetWindow.authorityKey === targetWindowAuthorityKey
      ? targetWindow.start
      : selectedTargetWindowStart;
  function updateTargetWindowStart(update: (current: number) => number) {
    setTargetWindow({
      authorityKey: targetWindowAuthorityKey,
      start: update(targetWindowStart)
    });
  }
  const visibleTargetOptions = targetOptions.slice(
    targetWindowStart,
    targetWindowStart + CURVE_TARGET_WINDOW_SIZE
  );
  const boundaryOptions = useMemo(
    () =>
      sketch.entities.filter((entity) =>
        isEligibleCurveEditBoundary(draft.targetEntityId, entity)
      ),
    [draft.targetEntityId, sketch.entities]
  );
  const trimChoiceRequest = useMemo(() => {
    if (
      kind !== "trim" ||
      !target ||
      (target.kind !== "line" &&
        target.kind !== "arc" &&
        target.kind !== "circle") ||
      draft.boundaryEntityIds.length === 0
    ) {
      return undefined;
    }
    return {
      sketch,
      target,
      boundaryEntityIds: draft.boundaryEntityIds
    };
  }, [draft.boundaryEntityIds, kind, sketch, target]);
  const trimChoiceResult = useSketchTrimIntervalChoices(
    trimChoiceRequest,
    readinessAuthorityKey,
    readReadiness,
    readReadinessAsync
  );
  const trimIntervalChoices = trimChoiceResult.choices;
  const extendChoiceRequest = useMemo(() => {
    if (
      kind !== "extend" ||
      !target ||
      (target.kind !== "line" && target.kind !== "arc") ||
      draft.boundaryEntityIds.length === 0
    ) {
      return undefined;
    }
    return {
      sketch,
      target,
      boundaryEntityIds: draft.boundaryEntityIds
    };
  }, [draft.boundaryEntityIds, kind, sketch, target]);
  const extendChoiceResult = useSketchExtendHitChoices(
    extendChoiceRequest,
    readinessAuthorityKey,
    readReadiness,
    readReadinessAsync
  );
  const extendHitChoices = extendChoiceResult.choices;
  const readinessError =
    committedReadinessResult.error ??
    hoverReadinessResult.error ??
    trimChoiceResult.error ??
    extendChoiceResult.error;
  const canApply =
    readinessProjection.applyOperation !== undefined && !disabled && !applying;
  const focusTarget =
    kind === "offset"
      ? draft.offsetSourceMode === "entity"
        ? draft.targetEntityId.length === 0
        : draft.offsetSegments.length === 0
      : target === undefined;
  const focusBoundary =
    target !== undefined &&
    (kind === "trim" || kind === "extend") &&
    draft.boundaryEntityIds.length === 0;
  const focusTrimPoint =
    target !== undefined &&
    kind === "trim" &&
    draft.boundaryEntityIds.length > 0 &&
    draft.pickPoint === undefined;
  const focusExtendEndpoint =
    target !== undefined &&
    kind === "extend" &&
    draft.boundaryEntityIds.length > 0 &&
    draft.endpoint === undefined;
  const focusSplitPoint =
    target !== undefined && kind === "split" && draft.splitPoints.length === 0;
  const focusOffsetSide = kind === "offset" && draft.offsetSide === undefined;
  const focusOffsetWitness =
    kind === "offset" &&
    draft.offsetUseReferencePoint &&
    draft.offsetReferencePoint === undefined;
  const focusApply =
    !focusTarget &&
    !focusBoundary &&
    !focusTrimPoint &&
    !focusExtendEndpoint &&
    !focusSplitPoint &&
    !focusOffsetSide &&
    !focusOffsetWitness;
  const focusReviewTarget = focusTarget || (focusApply && !canApply);

  async function apply(
    options: { readonly restoreFocusOnSuccess?: boolean } = {}
  ): Promise<boolean> {
    const operation = readinessProjection.applyOperation;
    if (!operation || disabled || applying) return false;
    setApplying(true);
    try {
      if (await onApply(operation)) {
        onCancel(options.restoreFocusOnSuccess ?? true);
        return true;
      }
      setReadinessRefresh((current) => current + 1);
      return false;
    } finally {
      setApplying(false);
    }
  }
  useEffect(() => {
    applyRef.current = apply;
  });

  const dirty = hasCollectedSketchCurveEditChoices(draft, initialDraft);

  useEffect(() => {
    focusCurveEditInitialControl(editorRef.current);
  }, []);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onSessionControlChange?.({
      apply: (options) => applyRef.current(options),
      focus: () => focusCurveEditInitialControl(editorRef.current)
    });
    return () => onSessionControlChange?.(undefined);
  }, [onSessionControlChange]);

  useEffect(() => {
    if (
      viewportChoice === undefined ||
      viewportChoice.sequence === lastViewportSequence.current
    ) {
      return;
    }
    lastViewportSequence.current = viewportChoice.sequence;
    changeDraft((current) => {
      const next = applySketchCurveEditViewportChoice(
        current,
        viewportChoice,
        sketch
      );
      if (next === current && viewportChoice.entityId) {
        onChoiceRejected?.(
          "That curve is not eligible for the active edit choice."
        );
      }
      return next;
    });
  }, [changeDraft, onChoiceRejected, sketch, viewportChoice]);

  useEffect(() => {
    if (selectedEntityId === lastSelectedEntityId.current) return;
    lastSelectedEntityId.current = selectedEntityId;
    if (selectedEntityId === undefined) return;
    changeDraft((current) => {
      const next = applySketchCurveEditViewportChoice(
        current,
        { sequence: -2, entityId: selectedEntityId },
        sketch
      );
      if (next === current) {
        onChoiceRejected?.(
          "That curve is not eligible for the active edit choice."
        );
      }
      return next;
    });
  }, [changeDraft, onChoiceRejected, selectedEntityId, sketch]);

  useEffect(() => {
    if (keyboardSuspended) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      handleSketchCurveEditWindowShortcut({
        event,
        suspended: keyboardSuspended,
        dirty,
        canApply,
        onApply: () => void applyRef.current(),
        onCancel: () => onCancel(true),
        onDirtyEscape: () =>
          onRequestEscape ? onRequestEscape(true) : onCancel()
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canApply, dirty, keyboardSuspended, onCancel, onRequestEscape]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void apply();
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (
      getCurveEditKeyboardCommand(event.nativeEvent) === "next-collector" &&
      event.target === event.currentTarget
    ) {
      event.preventDefault();
      changeDraft((current) => ({
        ...current,
        collector: getNextCurveEditCollector(current)
      }));
    }
  }

  function chooseTarget(entityId: string) {
    const entity = sketch.entities.find(
      (candidate) => candidate.id === entityId
    );
    if (!entity) return;
    changeDraft((current) =>
      applySketchCurveEditViewportChoice(
        { ...current, collector: "target" },
        { sequence: -1, entityId },
        sketch
      )
    );
    lastSelectedEntityId.current = entityId;
    onSelectEntity?.(entityId);
  }

  return (
    <form
      ref={editorRef}
      className="pb-sketch-section pb-curve-edit"
      aria-label={`${getSketchCurveEditKindLabel(kind)} sketch geometry`}
      onSubmit={submit}
      onKeyDown={handleEditorKeyDown}
    >
      <div className="pb-curve-edit__scroll">
        <div className="pb-sketch-section__heading">
          <div>
            <p className="pb-sketch-eyebrow">Modify</p>
            <h3>{getSketchCurveEditKindLabel(kind)}</h3>
          </div>
          <span>{readiness?.status ?? "collecting"}</span>
        </div>

        <p className="pb-curve-edit__guidance">
          {getCollectorGuidance(draft)}
          {readinessProjection.displayingHoverPreview
            ? " Hover preview is active and cannot be applied until the choice is clicked."
            : ""}
        </p>

        <div
          className="pb-curve-edit__collector"
          role="group"
          aria-label="Viewport collector"
        >
          {getCollectors(draft).map((collector) => (
            <button
              key={collector}
              type="button"
              className="pb-button pb-button--dense"
              aria-pressed={draft.collector === collector}
              disabled={disabled}
              onClick={() => changeDraft({ ...draft, collector })}
            >
              {formatCollector(collector)}
            </button>
          ))}
        </div>

        {kind === "offset" ? (
          <fieldset className="pb-curve-edit__choices">
            <legend>Source type</legend>
            {(["entity", "chain"] as const).map((sourceMode) => (
              <label key={sourceMode} className="pb-sketch-check">
                <input
                  type="radio"
                  name="offset-source-mode"
                  checked={draft.offsetSourceMode === sourceMode}
                  disabled={disabled}
                  onChange={() =>
                    changeDraft({
                      ...draft,
                      offsetSourceMode: sourceMode,
                      collector: sourceMode === "entity" ? "target" : "chain",
                      offsetSide: undefined,
                      offsetReferencePoint: undefined
                    })
                  }
                />
                {sourceMode === "entity"
                  ? "Individual entity"
                  : "Ordered chain"}
              </label>
            ))}
          </fieldset>
        ) : null}

        {kind !== "offset" || draft.offsetSourceMode === "entity" ? (
          <label className="pb-sketch-field">
            <span>{kind === "offset" ? "Source entity" : "Target"}</span>
            <select
              data-drawer-initial-focus={focusReviewTarget ? "" : undefined}
              className="pb-field"
              value={draft.targetEntityId}
              disabled={disabled}
              onChange={(event) => chooseTarget(event.currentTarget.value)}
            >
              <option value="">Choose target…</option>
              {visibleTargetOptions.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {getSketchEntitySemanticLabel(entity, sketch)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {(kind !== "offset" || draft.offsetSourceMode === "entity") &&
        targetOptions.length > CURVE_TARGET_WINDOW_SIZE ? (
          <div
            className="pb-curve-edit__target-window"
            aria-label="Curve edit target rows"
          >
            <button
              type="button"
              className="pb-button"
              disabled={targetWindowStart === 0}
              onClick={() =>
                updateTargetWindowStart((current) =>
                  Math.max(0, current - CURVE_TARGET_WINDOW_SIZE)
                )
              }
            >
              Previous targets
            </button>
            <span>
              {targetWindowStart + 1}–
              {Math.min(
                targetWindowStart + CURVE_TARGET_WINDOW_SIZE,
                targetOptions.length
              )}{" "}
              of {targetOptions.length}
            </span>
            <button
              type="button"
              className="pb-button"
              disabled={
                targetWindowStart + CURVE_TARGET_WINDOW_SIZE >=
                targetOptions.length
              }
              onClick={() =>
                updateTargetWindowStart((current) =>
                  Math.min(
                    Math.floor(
                      (targetOptions.length - 1) / CURVE_TARGET_WINDOW_SIZE
                    ) * CURVE_TARGET_WINDOW_SIZE,
                    current + CURVE_TARGET_WINDOW_SIZE
                  )
                )
              }
            >
              Next targets
            </button>
          </div>
        ) : null}

        {kind === "offset" && draft.offsetSourceMode === "chain" ? (
          <fieldset className="pb-curve-edit__choices">
            <legend>Ordered chain source</legend>
            <p>
              Select segments in traversal order. Each selected row exposes its
              exact orientation.
            </p>
            {sketch.entities
              .filter(
                (entity) => entity.kind === "line" || entity.kind === "arc"
              )
              .map((entity) => {
                const selectedIndex = draft.offsetSegments.findIndex(
                  (segment) => segment.entityId === entity.id
                );
                const selectedSegment = draft.offsetSegments[selectedIndex];
                return (
                  <div key={entity.id} className="pb-curve-edit__chain-row">
                    <label className="pb-sketch-check">
                      <input
                        type="checkbox"
                        checked={selectedIndex >= 0}
                        disabled={disabled}
                        onChange={() =>
                          changeDraft((current) =>
                            applySketchCurveEditViewportChoice(
                              { ...current, collector: "chain" },
                              { sequence: -1, entityId: entity.id },
                              sketch
                            )
                          )
                        }
                      />
                      {selectedIndex >= 0 ? `${selectedIndex + 1}. ` : ""}
                      {getSketchEntitySemanticLabel(entity, sketch)}
                    </label>
                    {selectedSegment ? (
                      <select
                        className="pb-field"
                        aria-label={`Orientation for ${getSketchEntitySemanticLabel(entity, sketch)}`}
                        value={selectedSegment.orientation}
                        disabled={disabled}
                        onChange={(event) =>
                          changeDraft({
                            ...draft,
                            offsetSegments: draft.offsetSegments.map(
                              (segment) =>
                                segment.entityId === entity.id
                                  ? {
                                      ...segment,
                                      orientation: event.currentTarget.value as
                                        | "forward"
                                        | "reverse"
                                    }
                                  : segment
                            )
                          })
                        }
                      >
                        <option value="forward">Forward</option>
                        <option value="reverse">Reverse</option>
                      </select>
                    ) : null}
                  </div>
                );
              })}
            <label className="pb-sketch-check">
              <input
                type="checkbox"
                checked={draft.offsetClosed}
                disabled={disabled}
                onChange={(event) =>
                  changeDraft({
                    ...draft,
                    offsetClosed: event.currentTarget.checked,
                    offsetSide: undefined,
                    offsetReferencePoint: undefined
                  })
                }
              />
              Closed loop
            </label>
          </fieldset>
        ) : null}

        {kind === "offset" ? (
          <>
            <NumberField
              label="Distance"
              value={draft.offsetDistance}
              disabled={disabled}
              onChange={(offsetDistance) =>
                changeDraft({
                  ...draft,
                  offsetDistance,
                  offsetReferencePoint: undefined
                })
              }
            />
            <fieldset className="pb-curve-edit__choices">
              <legend>Side</legend>
              {getSketchOffsetSideChoices(draft, sketch).map(
                ({ side, witnessPoint }, index) => (
                  <button
                    key={side}
                    type="button"
                    className="pb-curve-edit__choice-row"
                    aria-pressed={draft.offsetSide === side}
                    disabled={disabled}
                    data-drawer-initial-focus={
                      focusOffsetSide && index === 0 ? "" : undefined
                    }
                    onClick={() =>
                      changeDraft({
                        ...draft,
                        offsetSide: side,
                        collector: draft.offsetUseReferencePoint
                          ? "witness"
                          : "side",
                        offsetReferencePoint: witnessPoint
                      })
                    }
                  >
                    <span>
                      {side[0]!.toLocaleUpperCase()}
                      {side.slice(1)}
                    </span>
                    {witnessPoint ? (
                      <small>Witness {formatPoint(witnessPoint)}</small>
                    ) : null}
                  </button>
                )
              )}
            </fieldset>
            <label className="pb-sketch-check pb-sketch-check--boxed">
              <input
                type="checkbox"
                checked={draft.offsetUseReferencePoint}
                disabled={disabled}
                onChange={(event) =>
                  changeDraft({
                    ...draft,
                    offsetUseReferencePoint: event.currentTarget.checked,
                    collector: event.currentTarget.checked ? "witness" : "side"
                  })
                }
              />
              Use model-space witness evidence
            </label>
            {draft.offsetUseReferencePoint ? (
              <PointFields
                legend="Reference witness"
                point={draft.offsetReferencePoint ?? [0, 0]}
                disabled={disabled}
                initialFocus={focusOffsetWitness}
                onChange={(offsetReferencePoint) =>
                  changeDraft({ ...draft, offsetReferencePoint })
                }
              />
            ) : null}
          </>
        ) : null}

        {kind === "trim" || kind === "extend" ? (
          <fieldset className="pb-curve-edit__choices">
            <legend>Boundaries</legend>
            {boundaryOptions.length === 0 ? (
              <p>No supported boundary curves are available.</p>
            ) : (
              boundaryOptions.map((entity, index) => (
                <label key={entity.id} className="pb-sketch-check">
                  <input
                    type="checkbox"
                    checked={draft.boundaryEntityIds.includes(entity.id)}
                    disabled={disabled}
                    data-drawer-initial-focus={
                      focusBoundary && index === 0 ? "" : undefined
                    }
                    onChange={() =>
                      changeDraft((current) =>
                        applySketchCurveEditViewportChoice(
                          { ...current, collector: "boundaries" },
                          { sequence: -1, entityId: entity.id },
                          sketch
                        )
                      )
                    }
                  />
                  {getSketchEntitySemanticLabel(entity, sketch)}
                </label>
              ))
            )}
          </fieldset>
        ) : null}

        {kind === "trim" && trimIntervalChoices.length > 0 ? (
          <fieldset className="pb-curve-edit__choices">
            <legend>Query-derived removal intervals</legend>
            <p>
              Choose a model-space witness point. The same exact point is
              submitted by Apply.
            </p>
            {trimIntervalChoices.map((choice, index) => (
              <button
                key={choice.key}
                type="button"
                className="pb-curve-edit__choice-row"
                disabled={disabled}
                data-drawer-initial-focus={
                  focusTrimPoint && index === 0 ? "" : undefined
                }
                aria-pressed={
                  draft.pickPoint?.[0] === choice.witnessPoint[0] &&
                  draft.pickPoint?.[1] === choice.witnessPoint[1]
                }
                onClick={() =>
                  changeDraft({
                    ...draft,
                    pickPoint: choice.witnessPoint,
                    collector: "pick"
                  })
                }
              >
                <span>{choice.label}</span>
                <small>Witness {formatPoint(choice.witnessPoint)}</small>
              </button>
            ))}
          </fieldset>
        ) : null}

        {kind === "extend" && extendHitChoices.length > 0 ? (
          <fieldset className="pb-curve-edit__choices">
            <legend>Query-derived finite boundary hits</legend>
            <p>
              Choose one endpoint and hit. Apply submits its exact boundary and
              endpoint.
            </p>
            {extendHitChoices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                className="pb-curve-edit__choice-row"
                disabled={disabled}
                aria-pressed={
                  draft.endpoint === choice.endpoint &&
                  draft.boundaryEntityIds.length === 1 &&
                  draft.boundaryEntityIds[0] === choice.boundaryEntityId
                }
                onClick={() =>
                  changeDraft({
                    ...draft,
                    endpoint: choice.endpoint,
                    boundaryEntityIds: [choice.boundaryEntityId],
                    collector: "boundaries"
                  })
                }
              >
                <span>{choice.label}</span>
                <small>Finite hit {formatPoint(choice.hitPoint)}</small>
              </button>
            ))}
          </fieldset>
        ) : null}

        {kind === "extend" ? (
          <fieldset className="pb-curve-edit__choices">
            <legend>Endpoint</legend>
            {(["start", "end"] as const).map((endpoint, index) => (
              <label key={endpoint} className="pb-sketch-check">
                <input
                  type="radio"
                  name="extend-endpoint"
                  checked={draft.endpoint === endpoint}
                  disabled={disabled}
                  data-drawer-initial-focus={
                    focusExtendEndpoint && index === 0 ? "" : undefined
                  }
                  onChange={() => changeDraft({ ...draft, endpoint })}
                />
                {endpoint === "start" ? "Start endpoint" : "End endpoint"}
              </label>
            ))}
          </fieldset>
        ) : null}

        {kind === "trim" ? (
          <PointFields
            legend="Point on interval to remove"
            point={draft.pickPoint ?? [0, 0]}
            disabled={disabled}
            initialFocus={focusTrimPoint && trimIntervalChoices.length === 0}
            onChange={(pickPoint) => changeDraft({ ...draft, pickPoint })}
          />
        ) : null}

        {kind === "split" ? (
          <SplitPointEditor
            draft={draft}
            disabled={disabled}
            initialFocus={focusSplitPoint}
            onChange={changeDraft}
          />
        ) : null}

        {target ? (
          <p className="pb-sketch-callout" role="status">
            Editing {getSketchEntitySemanticLabel(target, sketch)}. The preview
            below is derived from the current committed sketch.
          </p>
        ) : null}

        {readinessError ? (
          <p className="pb-curve-edit__readiness" role="alert">
            Curve-edit preview is temporarily unavailable. {readinessError}
          </p>
        ) : null}
        <CurveEditReadiness readiness={readiness} sketch={sketch} />
      </div>

      <footer className="pb-curve-edit__footer">
        <div className="pb-sketch-actions pb-curve-edit__actions">
          <button
            type="submit"
            className="pb-button pb-button--primary"
            disabled={!canApply}
            data-drawer-initial-focus={focusApply && canApply ? "" : undefined}
          >
            {applying
              ? "Applying…"
              : `Apply ${getSketchCurveEditKindLabel(kind)}`}
          </button>
          <button
            type="button"
            className="pb-button"
            disabled={applying}
            onClick={() => onCancel(true)}
          >
            Cancel
          </button>
        </div>
        <p className="pb-curve-edit__shortcut">
          Ctrl/Cmd+Enter applies a ready edit. Escape cancels without changing
          the sketch.
        </p>
      </footer>
    </form>
  );
}

function SplitPointEditor({
  draft,
  disabled,
  initialFocus,
  onChange
}: {
  readonly draft: SketchCurveEditDraft;
  readonly disabled: boolean;
  readonly initialFocus: boolean;
  readonly onChange: (draft: SketchCurveEditDraft) => void;
}) {
  return (
    <div
      className="pb-curve-edit__choices"
      role="group"
      aria-label="Split points"
    >
      <strong>Split points</strong>
      <PointFields
        legend="New split point"
        point={draft.pendingSplitPoint}
        disabled={disabled}
        initialFocus={initialFocus}
        onChange={(pendingSplitPoint) =>
          onChange({ ...draft, pendingSplitPoint })
        }
      />
      <button
        type="button"
        className="pb-button pb-button--dense"
        disabled={disabled}
        onClick={() =>
          onChange({
            ...draft,
            splitPoints: appendPoint(draft.splitPoints, draft.pendingSplitPoint)
          })
        }
      >
        Add split point
      </button>
      {draft.splitPoints.length === 0 ? (
        <p>No split points collected.</p>
      ) : (
        <ol className="pb-curve-edit__point-list">
          {draft.splitPoints.map((point, index) => (
            <li key={`${point[0]}:${point[1]}:${index}`}>
              <span>{formatPoint(point)}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove split point ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...draft,
                    splitPoints: draft.splitPoints.filter(
                      (_, candidateIndex) => candidateIndex !== index
                    )
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PointFields({
  legend,
  point,
  disabled,
  initialFocus = false,
  onChange
}: {
  readonly legend: string;
  readonly point: Vec2;
  readonly disabled: boolean;
  readonly initialFocus?: boolean;
  readonly onChange: (point: Vec2) => void;
}) {
  return (
    <fieldset className="pb-curve-edit__choices">
      <legend>{legend}</legend>
      <div className="pb-sketch-field-grid">
        <NumberField
          label="X"
          value={point[0]}
          disabled={disabled}
          initialFocus={initialFocus}
          onChange={(value) => onChange([value, point[1]])}
        />
        <NumberField
          label="Y"
          value={point[1]}
          disabled={disabled}
          onChange={(value) => onChange([point[0], value])}
        />
      </div>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  disabled,
  initialFocus = false,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly disabled: boolean;
  readonly initialFocus?: boolean;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <input
        className="pb-field"
        type="number"
        step="any"
        value={value}
        disabled={disabled}
        data-drawer-initial-focus={initialFocus ? "" : undefined}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function CurveEditReadiness({
  readiness,
  sketch
}: {
  readonly readiness: SketchCurveEditReadinessQueryResponse | undefined;
  readonly sketch: SketchSnapshot;
}) {
  if (!readiness) {
    return (
      <div className="pb-curve-edit__readiness" role="status">
        <strong>Complete the edit choices</strong>
        <p>The sketch is unchanged until a ready preview is applied.</p>
      </div>
    );
  }
  if (readiness.status === "blocked") {
    return (
      <div
        className="pb-curve-edit__readiness pb-curve-edit__readiness--blocked"
        role="alert"
      >
        <strong>Edit needs attention</strong>
        {readiness.diagnostics.length === 0 ? (
          <p>
            This edit is not ready. Review the selected geometry and try again.
          </p>
        ) : (
          <ul>
            {readiness.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}:${index}`}>
                {formatCurveEditDiagnostic(diagnostic)}
              </li>
            ))}
          </ul>
        )}
        {readiness.preview ? (
          <CurveEditPreviewView
            preview={readiness.preview}
            sketch={sketch}
            candidateOnly
          />
        ) : null}
        {readiness.impact ? (
          <CurveEditImpactView
            impact={readiness.impact}
            sketch={sketch}
            resultEntities={readiness.preview?.resultEntities ?? []}
          />
        ) : null}
        <details>
          <summary>Technical details</summary>
          <ul>
            {readiness.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}:technical:${index}`}>
                {diagnostic.code}
                {diagnostic.fieldPath ? ` · ${diagnostic.fieldPath}` : ""}
                {diagnostic.expected
                  ? ` · expected ${diagnostic.expected}`
                  : ""}
                {diagnostic.received
                  ? ` · received ${diagnostic.received}`
                  : ""}
                {diagnostic.recoveryAction
                  ? ` · recovery ${diagnostic.recoveryAction}`
                  : ""}
                {formatDiagnosticReferences(diagnostic)}
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }
  return (
    <div
      className="pb-curve-edit__readiness pb-curve-edit__readiness--ready"
      role="status"
    >
      <strong>Ready to apply</strong>
      <p>
        Apply submits this exact preview and every listed consequence as one
        undoable transaction.
      </p>
      <CurveEditPreviewView preview={readiness.preview} sketch={sketch} />
      <CurveEditImpactView
        impact={readiness.impact}
        sketch={sketch}
        resultEntities={readiness.preview.resultEntities}
      />
    </div>
  );
}

function CurveEditPreviewView({
  preview,
  sketch,
  candidateOnly = false
}: {
  readonly preview: SketchCurveEditPreview;
  readonly sketch: SketchSnapshot;
  readonly candidateOnly?: boolean;
}) {
  return (
    <div className="pb-curve-edit__preview">
      <h4>{candidateOnly ? "Candidate evidence" : "Geometry preview"}</h4>
      {candidateOnly ? (
        <p>Choose an exact interval or finite hit to preview a result.</p>
      ) : (
        <p>
          {preview.resultEntityCount} result{" "}
          {preview.resultEntityCount === 1 ? "entity" : "entities"}
        </p>
      )}
      {preview.intersections.length > 0 ? (
        <ul>
          {preview.intersections.map((intersection, index) => {
            const boundary = sketch.entities.find(
              (entity) => entity.id === intersection.boundaryEntityId
            );
            return (
              <li key={`${intersection.boundaryEntityId}:${index}`}>
                {boundary
                  ? getSketchEntitySemanticLabel(boundary, sketch)
                  : `Boundary ${index + 1}`}{" "}
                at {formatPoint(intersection.point)}
              </li>
            );
          })}
        </ul>
      ) : null}
      {preview.resultEntities.length > 0 ? (
        <ol>
          {preview.resultEntities.map((entity, index) => (
            <li key={`${entity.id}:${index}`}>
              Result {index + 1}: {formatResultEntity(entity)}
            </li>
          ))}
        </ol>
      ) : null}
      {preview.projectedSplitParameters.length > 0 ? (
        <details>
          <summary>Technical details</summary>
          <p>
            Projected curve parameters:{" "}
            {preview.projectedSplitParameters
              .map((parameter) => formatNumber(parameter))
              .join(", ")}
          </p>
        </details>
      ) : null}
    </div>
  );
}

function CurveEditImpactView({
  impact,
  sketch,
  resultEntities
}: {
  readonly impact: SketchCurveEditImpact;
  readonly sketch: SketchSnapshot;
  readonly resultEntities: readonly SketchEntitySnapshot[];
}) {
  return (
    <div className="pb-curve-edit__impact">
      <h4>Consequences</h4>
      <ul>
        {summarizeCurveEditImpact(impact).map((summary) => (
          <li key={summary}>{summary}</li>
        ))}
      </ul>
      <div>
        <h5>Geometry replacements</h5>
        <ol>
          {impact.replacements.map((replacement) => {
            const source = sketch.entities.find(
              (entity) => entity.id === replacement.sourceEntityId
            );
            return (
              <li key={replacement.sourceEntityId}>
                {source
                  ? getSketchEntitySemanticLabel(source, sketch)
                  : "Source curve"}
                : {formatDisposition(replacement.disposition)} →{" "}
                {replacement.resultEntityIds.length === 0
                  ? "no result curves"
                  : replacement.resultEntityIds
                      .map((id, index) =>
                        formatReplacementResult(
                          id,
                          index,
                          replacement.preservedResultEntityId,
                          sketch,
                          resultEntities
                        )
                      )
                      .join(", ")}
              </li>
            );
          })}
        </ol>
      </div>
      {impact.constraintImpacts.length > 0 ? (
        <ImpactRecords
          title="Constraints"
          records={impact.constraintImpacts}
          sketch={sketch}
        />
      ) : null}
      {impact.dimensionImpacts.length > 0 ? (
        <ImpactRecords
          title="Dimensions"
          records={impact.dimensionImpacts}
          sketch={sketch}
        />
      ) : null}
      {impact.requiredDeleteConstraintIds.length > 0 ||
      impact.requiredDeleteDimensionIds.length > 0 ? (
        <p className="pb-curve-edit__warning">
          Applying also removes {impact.requiredDeleteConstraintIds.length}{" "}
          invalid constraint
          {impact.requiredDeleteConstraintIds.length === 1 ? "" : "s"} and{" "}
          {impact.requiredDeleteDimensionIds.length} invalid dimension
          {impact.requiredDeleteDimensionIds.length === 1 ? "" : "s"}.
        </p>
      ) : null}
      <details>
        <summary>Technical details</summary>
        <p>Sketch: {impact.sketchId}</p>
        <p>
          Required constraint deletions:{" "}
          {impact.requiredDeleteConstraintIds.join(", ") || "none"}
        </p>
        <p>
          Required dimension deletions:{" "}
          {impact.requiredDeleteDimensionIds.join(", ") || "none"}
        </p>
        <p>
          Affected feature IDs: {impact.affectedFeatureIds.join(", ") || "none"}
        </p>
        {impact.replacements.map((replacement) => (
          <p key={`replacement:${replacement.sourceEntityId}`}>
            Replacement {replacement.sourceEntityId}: {replacement.disposition}{" "}
            → {replacement.resultEntityIds.join(", ") || "none"}
          </p>
        ))}
        {impact.constraintImpacts.map((record) => (
          <p key={`constraint:${record.id}`}>
            Constraint {record.id}: {record.residualFamily ?? "no residual"}
            {record.residual === undefined
              ? ""
              : ` ${formatNumber(record.residual)}`}
            {" · "}before {JSON.stringify(record.before)}
            {" · "}after {JSON.stringify(record.after ?? null)}
          </p>
        ))}
        {impact.dimensionImpacts.map((record) => (
          <p key={`dimension:${record.id}`}>
            Dimension {record.id}: {record.residualFamily ?? "no residual"}
            {record.residual === undefined
              ? ""
              : ` ${formatNumber(record.residual)}`}
            {" · "}before {JSON.stringify(record.before)}
            {" · "}after {JSON.stringify(record.after ?? null)}
          </p>
        ))}
      </details>
    </div>
  );
}

function ImpactRecords({
  title,
  records,
  sketch
}: {
  readonly title: string;
  readonly records: readonly (
    | SketchCurveEditConstraintImpact
    | SketchCurveEditDimensionImpact
  )[];
  readonly sketch: SketchSnapshot;
}) {
  return (
    <div>
      <h5>{title}</h5>
      <ol>
        {records.map((record, index) => (
          <li key={record.id}>
            {record.before.name || `${title.slice(0, -1)} ${index + 1}`}:{" "}
            {formatDisposition(record.disposition)} ·{" "}
            {formatRecordTarget(record.before, sketch)}
            {record.after
              ? ` → ${formatRecordTarget(record.after, sketch)}`
              : " → removed"}
          </li>
        ))}
      </ol>
    </div>
  );
}

function getCollectors(
  draft: SketchCurveEditDraft
): readonly SketchCurveEditDraft["collector"][] {
  switch (draft.kind) {
    case "trim":
      return ["target", "boundaries", "pick"];
    case "extend":
      return ["target", "boundaries"];
    case "split":
      return ["target", "splitPoints"];
    case "explodeRectangle":
      return ["target"];
    case "offset":
      return [
        draft.offsetSourceMode === "entity" ? "target" : "chain",
        "side",
        ...(draft.offsetUseReferencePoint ? (["witness"] as const) : [])
      ];
  }
}

function getCollectorGuidance(draft: SketchCurveEditDraft): string {
  switch (draft.collector) {
    case "target":
      return "Choose the curve to edit in the viewport or Target list.";
    case "boundaries":
      return "Choose every boundary explicitly. Select a boundary again to remove it.";
    case "pick":
      return "Choose the interval to remove in the viewport or enter its point below.";
    case "splitPoints":
      return "Choose split points in the viewport or enter exact coordinates below.";
    case "chain":
      return "Choose line or arc segments in exact traversal order.";
    case "side":
      return "Choose the explicit offset side. The preview is evaluated in model space.";
    case "witness":
      return "Choose a model-space reference witness in the viewport or enter exact coordinates.";
  }
}

function formatCollector(collector: SketchCurveEditDraft["collector"]): string {
  switch (collector) {
    case "target":
      return "Collect target";
    case "boundaries":
      return "Collect boundaries";
    case "pick":
      return "Collect removal point";
    case "splitPoints":
      return "Collect split points";
    case "chain":
      return "Collect chain";
    case "side":
      return "Choose side";
    case "witness":
      return "Collect witness";
  }
}

function appendPoint(points: readonly Vec2[], point: Vec2): readonly Vec2[] {
  return points.some(
    (candidate) => candidate[0] === point[0] && candidate[1] === point[1]
  )
    ? points
    : [...points, point];
}

function formatPoint(point: Vec2): string {
  return `(${formatNumber(point[0])}, ${formatNumber(point[1])})`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

function formatDisposition(disposition: string): string {
  switch (disposition) {
    case "modified":
      return "modified";
    case "deleted":
      return "deleted";
    case "preserved":
      return "preserved";
    case "retargeted":
      return "retargeted to the replacement geometry";
    case "invalid":
      return "must be removed";
    case "deleted-by-request":
      return "will be removed";
    case "unaffected":
      return "unaffected";
    default:
      return "updated";
  }
}

function formatReplacementResult(
  entityId: string,
  index: number,
  preservedResultEntityId: string | undefined,
  sketch: SketchSnapshot,
  resultEntities: readonly SketchEntitySnapshot[]
): string {
  const existing = sketch.entities.find((entity) => entity.id === entityId);
  const result = resultEntities.find((entity) => entity.id === entityId);
  const label = existing
    ? getSketchEntitySemanticLabel(existing, sketch)
    : result
      ? `${formatResultEntityKind(result)} result ${index + 1}`
      : `Result curve ${index + 1}`;
  return entityId === preservedResultEntityId
    ? `${label} (identity preserved)`
    : label;
}

function formatResultEntityKind(entity: SketchEntitySnapshot): string {
  switch (entity.kind) {
    case "point":
      return "Point";
    case "line":
      return "Line";
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
    case "arc":
      return "Arc";
  }
}

function formatRecordTarget(
  record: {
    readonly kind?: string;
    readonly target?: unknown;
  },
  sketch: SketchSnapshot
): string {
  const entityIds = collectEntityIds(record);
  const entityLabels = entityIds.map((id) => {
    const entity = sketch.entities.find((candidate) => candidate.id === id);
    return entity
      ? getSketchEntitySemanticLabel(entity, sketch)
      : "result curve";
  });
  const target =
    record.target && typeof record.target === "object"
      ? (record.target as Record<string, unknown>)
      : undefined;
  const role =
    typeof target?.role === "string"
      ? target.role
      : typeof target?.measurement === "string"
        ? target.measurement
        : typeof target?.kind === "string"
          ? target.kind
          : record.kind;
  const purpose = role ? formatTechnicalToken(role) : "geometry target";
  return entityLabels.length > 0
    ? `${purpose} on ${entityLabels.join(" and ")}`
    : purpose;
}

function collectEntityIds(value: unknown): readonly string[] {
  const ids = new Set<string>();
  const visit = (candidate: unknown, key = "") => {
    if (typeof candidate === "string") {
      if (key.toLocaleLowerCase().endsWith("entityid")) ids.add(candidate);
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, key));
      return;
    }
    Object.entries(candidate).forEach(([childKey, child]) =>
      visit(child, childKey)
    );
  };
  visit(value);
  return [...ids];
}

function formatTechnicalToken(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .toLocaleLowerCase();
}

function formatDiagnosticReferences(
  diagnostic: Parameters<typeof formatCurveEditDiagnostic>[0]
): string {
  return [
    diagnostic.sketchId ? `sketch ${diagnostic.sketchId}` : undefined,
    diagnostic.sketchEntityId
      ? `entity ${diagnostic.sketchEntityId}`
      : undefined,
    diagnostic.sketchConstraintId
      ? `constraint ${diagnostic.sketchConstraintId}`
      : undefined,
    diagnostic.sketchDimensionId
      ? `dimension ${diagnostic.sketchDimensionId}`
      : undefined,
    diagnostic.featureId ? `feature ${diagnostic.featureId}` : undefined,
    diagnostic.bodyId ? `body ${diagnostic.bodyId}` : undefined,
    diagnostic.targetBodyId
      ? `target body ${diagnostic.targetBodyId}`
      : undefined,
    diagnostic.stableId ? `stable ref ${diagnostic.stableId}` : undefined,
    diagnostic.referenceName
      ? `named ref ${diagnostic.referenceName}`
      : undefined
  ]
    .filter((value): value is string => value !== undefined)
    .map((value) => ` · ${value}`)
    .join("");
}

function formatResultEntity(entity: SketchEntitySnapshot): string {
  switch (entity.kind) {
    case "line":
      return `line ${formatPoint(entity.start)} to ${formatPoint(entity.end)}`;
    case "arc":
      return `arc centered at ${formatPoint(entity.center)}, radius ${formatNumber(entity.radius)}, sweep ${formatNumber(entity.sweepAngleDegrees)}°`;
    case "circle":
      return `circle centered at ${formatPoint(entity.center)}, radius ${formatNumber(entity.radius)}`;
    case "rectangle":
      return `rectangle centered at ${formatPoint(entity.center)}, ${formatNumber(entity.width)} × ${formatNumber(entity.height)}`;
    case "point":
      return `point ${formatPoint(entity.point)}`;
  }
}

interface CurveEditReadinessResult {
  readonly readiness?: SketchCurveEditReadinessQueryResponse;
  readonly error?: string;
}

interface CurveEditAsyncReadinessState {
  readonly proposal: SketchCurveEditProposal;
  readonly authorityKey: string | number;
  readonly readiness?: SketchCurveEditReadinessQueryResponse;
  readonly error?: string;
}

function useCurveEditReadinessQuery(
  proposal: SketchCurveEditProposal | undefined,
  authorityKey: string | number,
  readReadiness:
    | ((
        proposal: SketchCurveEditProposal
      ) => SketchCurveEditReadinessQueryResponse)
    | undefined,
  readReadinessAsync: SketchCurveEditAsyncReadinessReader | undefined
): CurveEditReadinessResult {
  const synchronousReadiness = useMemo(() => {
    void authorityKey;
    if (readReadinessAsync || !readReadiness || !proposal) return undefined;
    return readReadiness(proposal);
  }, [authorityKey, proposal, readReadiness, readReadinessAsync]);
  const [asyncState, setAsyncState] = useState<
    CurveEditAsyncReadinessState | undefined
  >(undefined);

  useEffect(() => {
    if (!readReadinessAsync || !proposal) return undefined;
    const controller = new AbortController();
    void readReadinessAsync(proposal, controller.signal).then(
      (readiness) => {
        if (!controller.signal.aborted) {
          setAsyncState({ proposal, authorityKey, readiness });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setAsyncState({
            proposal,
            authorityKey,
            error: formatReadinessError()
          });
        }
      }
    );
    return () => controller.abort();
  }, [authorityKey, proposal, readReadinessAsync]);

  if (!readReadinessAsync) {
    return { readiness: synchronousReadiness };
  }
  if (
    !asyncState ||
    asyncState.proposal !== proposal ||
    asyncState.authorityKey !== authorityKey
  ) {
    return {};
  }
  return {
    readiness: asyncState.readiness,
    error: asyncState.error
  };
}

interface SketchTrimChoiceRequest {
  readonly sketch: SketchSnapshot;
  readonly target: Extract<
    SketchEntitySnapshot,
    { readonly kind: "line" | "arc" | "circle" }
  >;
  readonly boundaryEntityIds: readonly string[];
}

interface SketchTrimAsyncChoiceState {
  readonly request: SketchTrimChoiceRequest;
  readonly authorityKey: string | number;
  readonly choices: readonly SketchTrimIntervalChoice[];
  readonly error?: string;
}

function useSketchTrimIntervalChoices(
  request: SketchTrimChoiceRequest | undefined,
  authorityKey: string | number,
  readReadiness:
    | ((
        proposal: SketchCurveEditProposal
      ) => SketchCurveEditReadinessQueryResponse)
    | undefined,
  readReadinessAsync: SketchCurveEditAsyncReadinessReader | undefined
): {
  readonly choices: readonly SketchTrimIntervalChoice[];
  readonly error?: string;
} {
  const synchronousChoices = useMemo(() => {
    void authorityKey;
    if (readReadinessAsync || !readReadiness || !request) return [];
    return discoverSketchTrimIntervalChoices({
      ...request,
      readReadiness
    });
  }, [authorityKey, readReadiness, readReadinessAsync, request]);
  const [asyncState, setAsyncState] = useState<
    SketchTrimAsyncChoiceState | undefined
  >(undefined);

  useEffect(() => {
    if (!readReadinessAsync || !request) return undefined;
    const controller = new AbortController();
    void discoverSketchTrimIntervalChoicesAsync({
      ...request,
      readReadiness: readReadinessAsync,
      signal: controller.signal
    }).then(
      (choices) => {
        if (!controller.signal.aborted) {
          setAsyncState({ request, authorityKey, choices });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setAsyncState({
            request,
            authorityKey,
            choices: [],
            error: formatReadinessError()
          });
        }
      }
    );
    return () => controller.abort();
  }, [authorityKey, readReadinessAsync, request]);

  if (!readReadinessAsync) return { choices: synchronousChoices };
  if (
    !asyncState ||
    asyncState.request !== request ||
    asyncState.authorityKey !== authorityKey
  ) {
    return { choices: [] };
  }
  return { choices: asyncState.choices, error: asyncState.error };
}

interface SketchExtendChoiceRequest {
  readonly sketch: SketchSnapshot;
  readonly target: Extract<
    SketchEntitySnapshot,
    { readonly kind: "line" | "arc" }
  >;
  readonly boundaryEntityIds: readonly string[];
}

interface SketchExtendAsyncChoiceState {
  readonly request: SketchExtendChoiceRequest;
  readonly authorityKey: string | number;
  readonly choices: readonly SketchExtendHitChoice[];
  readonly error?: string;
}

function useSketchExtendHitChoices(
  request: SketchExtendChoiceRequest | undefined,
  authorityKey: string | number,
  readReadiness:
    | ((
        proposal: SketchCurveEditProposal
      ) => SketchCurveEditReadinessQueryResponse)
    | undefined,
  readReadinessAsync: SketchCurveEditAsyncReadinessReader | undefined
): {
  readonly choices: readonly SketchExtendHitChoice[];
  readonly error?: string;
} {
  const synchronousChoices = useMemo(() => {
    void authorityKey;
    if (readReadinessAsync || !readReadiness || !request) return [];
    return discoverSketchExtendHitChoices({
      ...request,
      readReadiness
    });
  }, [authorityKey, readReadiness, readReadinessAsync, request]);
  const [asyncState, setAsyncState] = useState<
    SketchExtendAsyncChoiceState | undefined
  >(undefined);

  useEffect(() => {
    if (!readReadinessAsync || !request) return undefined;
    const controller = new AbortController();
    void discoverSketchExtendHitChoicesAsync({
      ...request,
      readReadiness: readReadinessAsync,
      signal: controller.signal
    }).then(
      (choices) => {
        if (!controller.signal.aborted) {
          setAsyncState({ request, authorityKey, choices });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setAsyncState({
            request,
            authorityKey,
            choices: [],
            error: formatReadinessError()
          });
        }
      }
    );
    return () => controller.abort();
  }, [authorityKey, readReadinessAsync, request]);

  if (!readReadinessAsync) return { choices: synchronousChoices };
  if (
    !asyncState ||
    asyncState.request !== request ||
    asyncState.authorityKey !== authorityKey
  ) {
    return { choices: [] };
  }
  return { choices: asyncState.choices, error: asyncState.error };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatReadinessError(): string {
  return "Retry preview.";
}

function focusCurveEditInitialControl(editor: HTMLFormElement | null): void {
  editor?.querySelector<HTMLElement>("[data-drawer-initial-focus]")?.focus();
}
