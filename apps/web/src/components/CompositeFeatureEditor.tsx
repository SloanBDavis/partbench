import type {
  CadFeatureEditProposal,
  CadFeatureSummary,
  FeatureEditabilityQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchPathRef,
  SketchProfileCandidatesQueryResponse,
  SketchProfileRef,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { useState } from "react";
import {
  choosePathCandidate,
  chooseProfileCandidate,
  describeSketchPathEndpoints,
  findPathCandidateSelection,
  findProfileCandidateKey,
  formatCandidateDiagnostics,
  formatSketchPathMembership,
  formatSketchProfileMembership,
  reverseSketchPath
} from "../v17ProductIntegration";

type EditableFeature = Extract<
  CadFeatureSummary,
  { readonly kind: "extrude" | "revolve" | "sweep" }
>;

export function CompositeFeatureEditor({
  disabled = false,
  feature,
  pathCandidatesBySketchId,
  profileCandidatesBySketchId,
  sketches,
  inspectProposal,
  onUpdateExtrudeProfile,
  onUpdateRevolveProfile,
  onUpdateSweepRefs
}: {
  readonly disabled?: boolean;
  readonly feature: EditableFeature;
  readonly pathCandidatesBySketchId: ReadonlyMap<
    string,
    SketchPathCandidatesQueryResponse
  >;
  readonly profileCandidatesBySketchId: ReadonlyMap<
    string,
    SketchProfileCandidatesQueryResponse
  >;
  readonly sketches: readonly SketchSnapshot[];
  readonly inspectProposal: (
    featureId: string,
    proposal: CadFeatureEditProposal
  ) => FeatureEditabilityQueryResponse | undefined;
  readonly onUpdateExtrudeProfile: (
    featureId: string,
    profile: SketchProfileRef
  ) => void;
  readonly onUpdateRevolveProfile: (
    featureId: string,
    profile: SketchProfileRef
  ) => void;
  readonly onUpdateSweepRefs: (
    featureId: string,
    profile: Extract<SketchProfileRef, { readonly kind: "entity" }>,
    path: SketchPathRef
  ) => void;
}) {
  const currentProfile = getFeatureProfile(feature);
  const currentPath = feature.kind === "sweep" ? feature.path : undefined;
  const initialProfileResponse = profileCandidatesBySketchId.get(
    currentProfile.sketchId
  );
  const initialPathResponse = currentPath
    ? pathCandidatesBySketchId.get(currentPath.sketchId)
    : undefined;
  const initialPathSelection = currentPath
    ? findPathCandidateSelection(initialPathResponse, currentPath)
    : undefined;
  const [profileSketchId, setProfileSketchId] = useState(
    currentProfile.sketchId
  );
  const [profileKey, setProfileKey] = useState<string | undefined>(() =>
    findProfileCandidateKey(initialProfileResponse, currentProfile)
  );
  const [pathSketchId, setPathSketchId] = useState(
    currentPath?.sketchId ?? sketches[0]?.id ?? ""
  );
  const [pathKey, setPathKey] = useState(initialPathSelection?.key);
  const [pathReversed, setPathReversed] = useState(
    initialPathSelection?.reversed ?? false
  );

  const profileResponse = profileCandidatesBySketchId.get(profileSketchId);
  const allProfileCandidates = profileResponse?.candidates ?? [];
  const eligibleProfileCandidates =
    feature.kind === "sweep"
      ? allProfileCandidates.filter(
          (candidate) => candidate.profile.kind === "entity"
        )
      : allProfileCandidates;
  const effectiveProfileResponse = profileResponse
    ? { ...profileResponse, candidates: eligibleProfileCandidates }
    : undefined;
  const profileChoice = chooseProfileCandidate(
    effectiveProfileResponse,
    profileKey
  );
  const proposedProfile = profileChoice.selected?.profile;
  const pathResponse = pathCandidatesBySketchId.get(pathSketchId);
  const pathChoice = choosePathCandidate(pathResponse, pathKey);
  const proposedPath = pathChoice.selected
    ? pathReversed
      ? reverseSketchPath(pathChoice.selected.path)
      : pathChoice.selected.path
    : undefined;
  const currentPathSketch = currentPath
    ? sketches.find((sketch) => sketch.id === currentPath.sketchId)
    : undefined;
  const proposedPathSketch = proposedPath
    ? sketches.find((sketch) => sketch.id === proposedPath.sketchId)
    : undefined;
  const currentEndpoints =
    currentPath && currentPathSketch
      ? describeSketchPathEndpoints(currentPathSketch, currentPath)
      : undefined;
  const proposedEndpoints =
    proposedPath && proposedPathSketch
      ? describeSketchPathEndpoints(proposedPathSketch, proposedPath)
      : undefined;
  const completeProposal =
    feature.kind === "sweep"
      ? proposedProfile?.kind === "entity" && proposedPath
        ? { kind: "sweep" as const, profile: proposedProfile, path: proposedPath }
        : undefined
      : proposedProfile
        ? { kind: feature.kind, profile: proposedProfile }
        : undefined;
  const hasChanges = completeProposal
    ? !refsEqual(proposedProfile, currentProfile) ||
      (feature.kind === "sweep" && !refsEqual(proposedPath, currentPath))
    : false;
  const proposalInspection =
    completeProposal && hasChanges
      ? inspectProposal(feature.id, completeProposal)
      : undefined;
  const blockers = proposalInspection
    ? proposalInspection.diagnostics.filter(
        (diagnostic) => diagnostic.severity === "blocker"
      )
    : [];
  const saveReady =
    Boolean(completeProposal && hasChanges) &&
    proposalInspection?.status === "editable" &&
    blockers.length === 0;

  function save() {
    if (!saveReady || !proposedProfile) return;
    if (feature.kind === "extrude") {
      onUpdateExtrudeProfile(feature.id, proposedProfile);
    } else if (feature.kind === "revolve") {
      onUpdateRevolveProfile(feature.id, proposedProfile);
    } else if (proposedProfile.kind === "entity" && proposedPath) {
      onUpdateSweepRefs(feature.id, proposedProfile, proposedPath);
    }
  }

  return (
    <section className="command-card nested" aria-label="Composite source editor">
      <div className="command-card-heading">
        <h3>{feature.kind === "sweep" ? "Sweep source" : "Composite profile"}</h3>
        <span>{hasChanges ? "Proposed" : "Current"}</span>
      </div>
      <SourceMembership
        label="Current profile"
        membership={formatSketchProfileMembership(currentProfile)}
      />
      {currentPath && (
        <SourceMembership
          label="Current path"
          membership={formatSketchPathMembership(currentPath)}
          endpoints={currentEndpoints}
          direction={formatPathDirection(currentPath)}
        />
      )}
      <label>
        Profile sketch
        <select
          value={profileSketchId}
          disabled={disabled}
          onChange={(event) => {
            setProfileSketchId(event.currentTarget.value);
            setProfileKey(undefined);
          }}
        >
          {sketches.map((sketch) => (
            <option key={sketch.id} value={sketch.id}>{sketch.name}</option>
          ))}
        </select>
      </label>
      <label>
        Query-returned profile
        <select
          value={profileChoice.selectedKey ?? ""}
          disabled={disabled || eligibleProfileCandidates.length === 0}
          onChange={(event) => setProfileKey(event.currentTarget.value)}
        >
          <option value="">
            {profileChoice.requiresExplicitChoice
              ? "Choose a profile"
              : "No ready profile"}
          </option>
          {eligibleProfileCandidates.map((candidate) => (
            <option key={candidate.sortKey} value={candidate.sortKey}>
              {formatSketchProfileMembership(candidate.profile)}
            </option>
          ))}
        </select>
      </label>
      {proposedProfile && (
        <SourceMembership
          label="Proposed profile"
          membership={formatSketchProfileMembership(proposedProfile)}
        />
      )}
      {!proposedProfile && profileResponse?.diagnostics.length ? (
        <DiagnosticList
          messages={formatCandidateDiagnostics(profileResponse.diagnostics)}
        />
      ) : null}

      {feature.kind === "sweep" && (
        <>
          <label>
            Path sketch
            <select
              value={pathSketchId}
              disabled={disabled}
              onChange={(event) => {
                setPathSketchId(event.currentTarget.value);
                setPathKey(undefined);
                setPathReversed(false);
              }}
            >
              {sketches.map((sketch) => (
                <option key={sketch.id} value={sketch.id}>{sketch.name}</option>
              ))}
            </select>
          </label>
          <label>
            Query-returned path
            <select
              value={pathChoice.selectedKey ?? ""}
              disabled={disabled || (pathResponse?.candidateCount ?? 0) === 0}
              onChange={(event) => {
                setPathKey(event.currentTarget.value);
                setPathReversed(false);
              }}
            >
              <option value="">
                {pathChoice.requiresExplicitChoice
                  ? "Choose a path"
                  : "No ready path"}
              </option>
              {(pathResponse?.candidates ?? []).map((candidate) => (
                <option key={candidate.sortKey} value={candidate.sortKey}>
                  {formatSketchPathMembership(candidate.path)}
                </option>
              ))}
            </select>
          </label>
          {proposedPath && (
            <>
              <SourceMembership
                label="Proposed path"
                membership={formatSketchPathMembership(proposedPath)}
                endpoints={proposedEndpoints}
                direction={formatPathDirection(proposedPath)}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPathReversed((current) => !current)}
              >
                Reverse submitted direction
              </button>
            </>
          )}
          {!proposedPath && pathResponse?.diagnostics.length ? (
            <DiagnosticList
              messages={formatCandidateDiagnostics(pathResponse.diagnostics)}
            />
          ) : null}
        </>
      )}

      {profileChoice.requiresExplicitChoice && (
        <p className="error-text">Choose an explicit profile candidate.</p>
      )}
      {feature.kind === "sweep" && pathChoice.requiresExplicitChoice && (
        <p className="error-text">Choose an explicit path candidate.</p>
      )}
      {proposalInspection && proposalInspection.status !== "editable" && (
        <DiagnosticList
          messages={proposalInspection.diagnostics.map(formatEditDiagnostic)}
        />
      )}
      <button type="button" disabled={disabled || !saveReady} onClick={save}>
        Save source references
      </button>
    </section>
  );
}

function getFeatureProfile(feature: EditableFeature): SketchProfileRef {
  if (feature.kind === "sweep") return feature.profile;
  return feature.profile ?? {
    kind: "entity",
    sketchId: feature.sketchId,
    entityId: feature.entityId
  };
}

function SourceMembership({
  direction,
  endpoints,
  label,
  membership
}: {
  readonly endpoints?: { readonly start: readonly [number, number]; readonly end: readonly [number, number] };
  readonly direction?: string;
  readonly label: string;
  readonly membership: string;
}) {
  return (
    <div className="candidate-health">
      <strong>{label}</strong>
      <small>{membership}</small>
      {direction && <small>Direction: {direction}</small>}
      {endpoints && (
        <small>
          Start {formatPoint(endpoints.start)} → end {formatPoint(endpoints.end)}
        </small>
      )}
    </div>
  );
}

function DiagnosticList({ messages }: { readonly messages: readonly string[] }) {
  return (
    <ul className="diagnostic-list" aria-label="Source edit blockers">
      {messages.map((message, index) => <li key={`${index}:${message}`}>{message}</li>)}
    </ul>
  );
}

function formatEditDiagnostic(
  diagnostic: FeatureEditabilityQueryResponse["diagnostics"][number]
) {
  const field = diagnostic.fieldPath ? ` (${diagnostic.fieldPath})` : "";
  const expected = diagnostic.expected ? ` Expected ${diagnostic.expected}.` : "";
  return `${diagnostic.message}${field}${expected}`;
}

function formatPoint(point: readonly [number, number]) {
  return `(${point[0].toPrecision(4)}, ${point[1].toPrecision(4)})`;
}

function formatPathDirection(path: SketchPathRef) {
  return path.kind === "entity"
    ? path.orientation
    : `${path.segments[0]?.orientation ?? "forward"} ordered chain`;
}

function refsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
