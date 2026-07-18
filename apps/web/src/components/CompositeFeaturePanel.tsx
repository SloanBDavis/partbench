import type {
  SketchPathCandidatesQueryResponse,
  SketchPathRef,
  SketchProfileCandidatesQueryResponse,
  SketchProfileRef,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { useMemo, useState } from "react";
import type {
  FeatureCompositeExtrudeForm,
  FeatureCompositeRevolveForm,
  FeatureCompositeSweepForm
} from "../cadCommands";
import type { BooleanTargetBodyOption } from "../sketchPanelUi";
import {
  choosePathCandidate,
  chooseProfileCandidate,
  describeSketchPathEndpoints,
  formatCandidateDiagnostics,
  formatSketchPathMembership,
  formatSketchProfileMembership,
  reverseSketchPath
} from "../v17ProductIntegration";

export function CompositeFeaturePanel({
  addTargetBodies = [],
  cutTargetBodies = [],
  disabled = false,
  pathCandidatesBySketchId,
  profileCandidatesBySketchId,
  sketches,
  onCreateExtrude,
  onCreateRevolve,
  onCreateSweep
}: {
  readonly addTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly cutTargetBodies?: readonly BooleanTargetBodyOption[];
  readonly disabled?: boolean;
  readonly pathCandidatesBySketchId: ReadonlyMap<
    string,
    SketchPathCandidatesQueryResponse
  >;
  readonly profileCandidatesBySketchId: ReadonlyMap<
    string,
    SketchProfileCandidatesQueryResponse
  >;
  readonly sketches: readonly SketchSnapshot[];
  readonly onCreateExtrude: (form: FeatureCompositeExtrudeForm) => void;
  readonly onCreateRevolve: (form: FeatureCompositeRevolveForm) => void;
  readonly onCreateSweep: (form: FeatureCompositeSweepForm) => void;
}) {
  const [mode, setMode] = useState<"extrude" | "revolve" | "sweep">(
    "extrude"
  );
  const [profileSketchId, setProfileSketchId] = useState(sketches[0]?.id ?? "");
  const [profileKey, setProfileKey] = useState<string>();
  const [pathSketchId, setPathSketchId] = useState(sketches[0]?.id ?? "");
  const [pathKey, setPathKey] = useState<string>();
  const [pathReversed, setPathReversed] = useState(false);
  const [depth, setDepth] = useState(1);
  const [angleDegrees, setAngleDegrees] = useState(360);
  const [side, setSide] = useState<"positive" | "negative" | "symmetric">(
    "positive"
  );
  const [operationMode, setOperationMode] = useState<
    "newBody" | "add" | "cut"
  >("newBody");
  const [targetBodyId, setTargetBodyId] = useState("");
  const [axisEntityId, setAxisEntityId] = useState("");

  const profileResponse = profileCandidatesBySketchId.get(profileSketchId);
  const profileChoice = chooseProfileCandidate(profileResponse, profileKey);
  const pathResponse = pathCandidatesBySketchId.get(pathSketchId);
  const pathChoice = choosePathCandidate(pathResponse, pathKey);
  const selectedPath = pathChoice.selected
    ? pathReversed
      ? reverseSketchPath(pathChoice.selected.path)
      : pathChoice.selected.path
    : undefined;
  const profileSketch = sketches.find((sketch) => sketch.id === profileSketchId);
  const pathSketch = sketches.find((sketch) => sketch.id === pathSketchId);
  const pathEndpoints =
    pathSketch && selectedPath
      ? describeSketchPathEndpoints(pathSketch, selectedPath)
      : undefined;
  const axisOptions = useMemo(
    () =>
      profileSketch?.entities.filter((entity) => entity.kind === "line") ?? [],
    [profileSketch]
  );
  const targetOptions =
    operationMode === "add"
      ? addTargetBodies
      : operationMode === "cut"
        ? cutTargetBodies
        : [];
  const selectedProfile = profileChoice.selected?.profile;
  const sweepProfile =
    selectedProfile?.kind === "entity" ? selectedProfile : undefined;
  const modeReady =
    mode === "extrude"
      ? Boolean(selectedProfile) && Number.isFinite(depth) && depth > 0
      : mode === "revolve"
        ? Boolean(selectedProfile && axisEntityId) &&
          Number.isFinite(angleDegrees) &&
          angleDegrees > 0 &&
          angleDegrees <= 360
        : Boolean(sweepProfile && selectedPath);
  const targetReady = operationMode === "newBody" || Boolean(targetBodyId);

  function submit() {
    if (!selectedProfile || !modeReady) return;
    if (mode === "extrude") {
      onCreateExtrude({
        id: "",
        bodyId: "",
        name: "",
        profile: selectedProfile,
        depth,
        side,
        operationMode,
        ...(operationMode === "newBody" ? {} : { targetBodyId })
      });
      return;
    }
    if (mode === "revolve") {
      onCreateRevolve({
        id: "",
        bodyId: "",
        name: "",
        profile: selectedProfile,
        axisEntityId,
        angleDegrees
      });
      return;
    }
    if (sweepProfile && selectedPath) {
      onCreateSweep({
        id: "",
        bodyId: "",
        name: "",
        profile: sweepProfile,
        path: selectedPath
      });
    }
  }

  return (
    <section className="command-card" aria-label="Composite features">
      <div className="command-card-heading">
        <h3>Composite features</h3>
        <span>V17</span>
      </div>
      <div className="segmented-control" aria-label="Composite feature type">
        {(["extrude", "revolve", "sweep"] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={mode === candidate ? "selected" : undefined}
            disabled={disabled}
            onClick={() => setMode(candidate)}
          >
            {candidate[0]!.toUpperCase() + candidate.slice(1)}
          </button>
        ))}
      </div>
      <label>
        Profile sketch
        <select
          value={profileSketchId}
          disabled={disabled}
          onChange={(event) => {
            setProfileSketchId(event.currentTarget.value);
            setProfileKey(undefined);
            setAxisEntityId("");
          }}
        >
          {sketches.map((sketch) => (
            <option key={sketch.id} value={sketch.id}>{sketch.name}</option>
          ))}
        </select>
      </label>
      <CandidateSelect
        label="Profile candidate"
        value={profileChoice.selectedKey ?? ""}
        disabled={disabled || (profileResponse?.candidateCount ?? 0) === 0}
        options={(profileResponse?.candidates ?? []).map((candidate) => ({
          key: candidate.sortKey,
          label: `${candidate.candidateIndex + 1}: ${formatSketchProfileMembership(candidate.profile)}`
        }))}
        placeholder={
          profileChoice.requiresExplicitChoice
            ? "Choose a profile"
            : "No ready profiles"
        }
        onChange={setProfileKey}
      />
      {profileChoice.selected && (
        <div className="candidate-health" aria-label="Profile candidate health">
          <strong>Ready · {profileChoice.selected.area.toPrecision(5)} area</strong>
          <small>{formatSketchProfileMembership(profileChoice.selected.profile)}</small>
          <small>{profileChoice.selected.joinCount} healthy joins · clear intersections</small>
        </div>
      )}
      {(profileResponse?.diagnostics.length ?? 0) > 0 && !selectedProfile && (
        <Diagnostics diagnostics={formatCandidateDiagnostics(profileResponse!.diagnostics)} />
      )}

      {mode === "extrude" && (
        <>
          <label>Operation
            <select value={operationMode} disabled={disabled} onChange={(event) => {
              setOperationMode(event.currentTarget.value as typeof operationMode);
              setTargetBodyId("");
            }}>
              <option value="newBody">New body</option>
              <option value="add">Add</option>
              <option value="cut">Cut</option>
            </select>
          </label>
          {operationMode !== "newBody" && (
            <label>Target body
              <select value={targetBodyId} disabled={disabled || targetOptions.length === 0} onChange={(event) => setTargetBodyId(event.currentTarget.value)}>
                <option value="">Choose a target</option>
                {targetOptions.map((target) => <option key={target.bodyId} value={target.bodyId}>{target.label}</option>)}
              </select>
            </label>
          )}
          <NumberInput label="Depth" value={depth} disabled={disabled} onChange={setDepth} />
          <label>Side
            <select value={side} disabled={disabled} onChange={(event) => setSide(event.currentTarget.value as typeof side)}>
              <option value="positive">Positive</option><option value="negative">Negative</option><option value="symmetric">Symmetric</option>
            </select>
          </label>
        </>
      )}
      {mode === "revolve" && (
        <>
          <label>Axis line
            <select value={axisEntityId} disabled={disabled || axisOptions.length === 0} onChange={(event) => setAxisEntityId(event.currentTarget.value)}>
              <option value="">Choose an axis</option>
              {axisOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.id}{entity.construction ? " · construction" : ""}</option>)}
            </select>
          </label>
          <NumberInput label="Angle (deg)" value={angleDegrees} disabled={disabled} onChange={setAngleDegrees} />
        </>
      )}
      {mode === "sweep" && (
        <>
          {!sweepProfile && selectedProfile && <p className="error-text">Sweep profiles must be one rectangle or circle candidate.</p>}
          <label>Path sketch
            <select value={pathSketchId} disabled={disabled} onChange={(event) => { setPathSketchId(event.currentTarget.value); setPathKey(undefined); setPathReversed(false); }}>
              {sketches.map((sketch) => <option key={sketch.id} value={sketch.id}>{sketch.name}</option>)}
            </select>
          </label>
          <CandidateSelect
            label="Path candidate"
            value={pathChoice.selectedKey ?? ""}
            disabled={disabled || (pathResponse?.candidateCount ?? 0) === 0}
            options={(pathResponse?.candidates ?? []).map((candidate) => ({ key: candidate.sortKey, label: `${candidate.candidateIndex + 1}: ${formatSketchPathMembership(candidate.path)}` }))}
            placeholder={pathChoice.requiresExplicitChoice ? "Choose a path" : "No ready paths"}
            onChange={(key) => { setPathKey(key); setPathReversed(false); }}
          />
          {selectedPath && (
            <div className="candidate-health" aria-label="Path candidate health">
              <strong>Ready · {pathChoice.selected?.length.toPrecision(5)} length</strong>
              <small>{formatSketchPathMembership(selectedPath)}</small>
              {pathEndpoints && <small>Start {formatPoint(pathEndpoints.start)} → end {formatPoint(pathEndpoints.end)}</small>}
              <button type="button" disabled={disabled} onClick={() => setPathReversed((value) => !value)}>Reverse submitted direction</button>
            </div>
          )}
          {(pathResponse?.diagnostics.length ?? 0) > 0 && !selectedPath && <Diagnostics diagnostics={formatCandidateDiagnostics(pathResponse!.diagnostics)} />}
        </>
      )}
      {!modeReady && (
        <p className="error-text">
          {profileChoice.requiresExplicitChoice
            ? "Choose an explicit query-returned profile candidate."
            : mode === "sweep" && pathChoice.requiresExplicitChoice
              ? "Choose an explicit query-returned path candidate."
              : "Complete the required ready inputs before creating the feature."}
        </p>
      )}
      {!targetReady && <p className="error-text">Choose one ready target body for this boolean operation.</p>}
      <button type="button" disabled={disabled || !modeReady || !targetReady} onClick={submit}>Create {mode}</button>
    </section>
  );
}

function CandidateSelect({ label, value, disabled, options, placeholder, onChange }: {
  readonly label: string; readonly value: string; readonly disabled: boolean;
  readonly options: readonly { readonly key: string; readonly label: string }[];
  readonly placeholder: string; readonly onChange: (key: string) => void;
}) {
  return <label>{label}<select value={value} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>;
}

function NumberInput({ label, value, disabled, onChange }: { readonly label: string; readonly value: number; readonly disabled: boolean; readonly onChange: (value: number) => void }) {
  return <label>{label}<input type="number" value={value} disabled={disabled} onChange={(event) => onChange(event.currentTarget.valueAsNumber)} /></label>;
}

function Diagnostics({ diagnostics }: { readonly diagnostics: readonly string[] }) {
  return <ul className="diagnostic-list" aria-label="Blocked diagnostics">{diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}</ul>;
}

function formatPoint(point: readonly [number, number]) {
  return `(${point[0].toPrecision(4)}, ${point[1].toPrecision(4)})`;
}
