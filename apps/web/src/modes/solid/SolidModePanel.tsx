import { type ChangeEvent, useMemo, useRef, useState } from "react";
import type {
  FeatureShellOpenFaceRef,
  LoftSection,
  MirrorPlaneRef,
  PatternDirectionRef,
  PatternRotationAxisRef
} from "@web-cad/cad-protocol";
import type {
  FeatureCircularPatternForm,
  FeatureCompositeExtrudeForm,
  FeatureCompositeRevolveForm,
  FeatureCompositeSweepForm,
  FeatureEdgeFinishForm,
  FeatureExtrudeForm,
  FeatureHoleForm,
  FeatureLinearPatternForm,
  FeatureLoftForm,
  FeatureMirrorForm,
  FeatureRevolveForm,
  FeatureShellForm,
  FeatureSweepForm,
  PrimitiveCommandForm,
  SketchCreateForm,
  TransformCommandForm
} from "../../cadCommands";
import {
  EditorFieldRow,
  FeatureEditorShell
} from "../../editors/FeatureEditorShell";
import { SelectionCollectorRow } from "../../editors/SelectionCollectorRow";
import type {
  FeatureEditorPhase,
  FeatureEditorValidation
} from "../../editors/featureEditorState";
import type { SelectionCollectorTarget } from "../../editors/selectionCollectorState";
import { Button } from "../../ui/Button";
import type {
  EdgeChoiceValue,
  SolidChoice,
  SolidCollectorRequest,
  SolidDraft,
  SolidEditorKind,
  SolidEditorRequest,
  SolidEditorSubmission,
  SweepPathChoiceValue
} from "./solidEditorTypes";
import { createSolidEditorSubmission } from "./solidEditorTypes";
import { applySolidDraftOnce, cancelSolidDraft } from "./solidEditorSession";
import "./solidModePanel.css";

export interface SolidModePanelProps {
  readonly activeEditor?: SolidEditorRequest;
  readonly onApply?: (
    submission: SolidEditorSubmission
  ) => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly onDelete?: (request: SolidEditorRequest) => void | Promise<void>;
  readonly onCollect?: (request: SolidCollectorRequest) => void;
}

/**
 * The sole Solid right-dock job. It owns only draft/collector UI state and
 * delegates every source mutation through injected callbacks.
 */
export function SolidModePanel({
  activeEditor,
  onApply,
  onCancel,
  onDelete,
  onCollect
}: SolidModePanelProps) {
  if (!activeEditor) {
    return (
      <section className="pb-solid-summary" aria-label="Solid inspector">
        <span>Solid</span>
        <h2>No active operation</h2>
        <p>
          Choose a feature from the ribbon, or select model geometry to inspect
          the actions available for it.
        </p>
      </section>
    );
  }

  return (
    <SolidDraftEditor
      key={activeEditor.key}
      request={activeEditor}
      onApply={onApply}
      onCancel={onCancel}
      onDelete={onDelete}
      onCollect={onCollect}
    />
  );
}

function SolidDraftEditor({
  request,
  onApply,
  onCancel,
  onDelete,
  onCollect
}: {
  readonly request: SolidEditorRequest;
  readonly onApply?: SolidModePanelProps["onApply"];
  readonly onCancel?: () => void;
  readonly onDelete?: SolidModePanelProps["onDelete"];
  readonly onCollect?: SolidModePanelProps["onCollect"];
}) {
  const [draft, setDraft] = useState<SolidDraft>(request.initialDraft);
  const [phase, setPhase] = useState<FeatureEditorPhase>(() =>
    request.blockedReason || !onApply
      ? "blocked"
      : phaseForValidation(
          validateSolidDraft(request.kind, request.initialDraft)
        )
  );
  const [applyError, setApplyError] = useState<string>();
  const [collecting, setCollecting] = useState<string>();
  const [deleteArmed, setDeleteArmed] = useState(false);
  const applyingRef = useRef({ pending: false });
  const initialSerialized = useMemo(
    () => stableSerialize(request.initialDraft),
    [request.initialDraft]
  );
  const dirty =
    request.mode !== "edit" || stableSerialize(draft) !== initialSerialized;
  const draftValidation = validateSolidDraft(request.kind, draft);
  const validation: FeatureEditorValidation = request.blockedReason
    ? { status: "blocked", message: request.blockedReason }
    : !onApply
      ? { status: "blocked", message: "This action is not connected." }
      : draftValidation;

  const displayedPhase =
    phase === "applying" || phase === "error"
      ? phase
      : phaseForValidation(validation);

  const changeDraft = (next: SolidDraft) => {
    if (applyingRef.current.pending) return;
    setDraft(next);
    setApplyError(undefined);
  };

  const collect = (
    collector: SolidCollectorRequest["collector"],
    acceptedKinds: readonly string[]
  ) => {
    const next = collecting === collector ? undefined : collector;
    setCollecting(next);
    if (next) {
      onCollect?.({ editorKey: request.key, collector, acceptedKinds });
    }
  };

  const apply = async () => {
    if (
      applyingRef.current.pending ||
      !onApply ||
      !dirty ||
      validation.status !== "ready"
    ) {
      return;
    }
    setPhase("applying");
    setApplyError(undefined);
    try {
      const applied = await applySolidDraftOnce(
        applyingRef.current,
        createSolidEditorSubmission(request.kind, draft),
        validation,
        dirty,
        onApply
      );
      if (applied) setPhase("editing");
    } catch (error) {
      setApplyError(
        error instanceof Error
          ? error.message
          : "The operation could not be applied."
      );
      setPhase("error");
    } finally {
      applyingRef.current.pending = false;
    }
  };

  const cancel = () => {
    if (applyingRef.current.pending) return;
    setDraft(cancelSolidDraft(request.initialDraft, onCancel));
    setCollecting(undefined);
    setApplyError(undefined);
  };

  return (
    <FeatureEditorShell
      title={request.title}
      kind={formatEditorKind(request.kind)}
      phase={displayedPhase}
      dirty={dirty}
      validation={validation}
      applyError={applyError}
      onApply={() => void apply()}
      onCancel={cancel}
      dangerArea={
        request.mode === "edit" && request.deletable && onDelete ? (
          <div className="pb-solid-danger-row">
            <div>
              <strong>Delete feature</strong>
              <small>This removes the authored feature from the model.</small>
            </div>
            <Button
              tone="danger"
              onClick={() => {
                if (!deleteArmed) {
                  setDeleteArmed(true);
                  return;
                }
                void onDelete(request);
              }}
            >
              {deleteArmed ? "Confirm delete" : "Delete"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <SolidDraftFields
        request={request}
        draft={draft}
        collecting={collecting}
        onCollect={collect}
        onChange={changeDraft}
      />
    </FeatureEditorShell>
  );
}

function SolidDraftFields({
  request,
  draft,
  collecting,
  onCollect,
  onChange
}: {
  readonly request: SolidEditorRequest;
  readonly draft: SolidDraft;
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    acceptedKinds: readonly string[]
  ) => void;
  readonly onChange: (draft: SolidDraft) => void;
}) {
  switch (request.kind) {
    case "box":
    case "cylinder":
    case "sphere":
    case "cone":
    case "torus":
      return (
        <PrimitiveFields
          kind={request.kind}
          draft={draft as PrimitiveCommandForm}
          onChange={onChange}
        />
      );
    case "sketch":
      return (
        <SketchFields draft={draft as SketchCreateForm} onChange={onChange} />
      );
    case "transform":
      return (
        <TransformFields
          draft={draft as TransformCommandForm}
          onChange={onChange}
        />
      );
    case "extrude":
      return (
        <ExtrudeFields
          draft={draft as FeatureExtrudeForm}
          choices={request.choices}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "compositeExtrude":
      return (
        <CompositeExtrudeFields
          draft={draft as FeatureCompositeExtrudeForm}
          choices={request.choices}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "revolve":
      return (
        <RevolveFields
          draft={draft as FeatureRevolveForm}
          choices={request.choices}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "compositeRevolve":
      return (
        <CompositeRevolveFields
          draft={draft as FeatureCompositeRevolveForm}
          choices={request.choices}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "sweep":
      return (
        <SweepFields
          draft={draft as FeatureSweepForm}
          choices={request.choices?.sweepPaths ?? []}
          collecting={collecting === "path"}
          onCollect={() => onCollect("path", ["line", "arc", "tangent path"])}
          onChange={onChange}
        />
      );
    case "compositeSweep":
      return (
        <CompositeSweepFields
          draft={draft as FeatureCompositeSweepForm}
          choices={request.choices}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "loft":
      return (
        <LoftFields
          draft={draft as FeatureLoftForm}
          choices={request.choices?.loftSections ?? []}
          collecting={collecting === "sections"}
          onCollect={() => onCollect("sections", ["closed sketch profile"])}
          onChange={onChange}
        />
      );
    case "hole":
      return (
        <HoleFields
          draft={draft as FeatureHoleForm}
          choices={request.choices?.targetBodies ?? []}
          collecting={collecting === "targetBody"}
          onCollect={() => onCollect("targetBody", ["body"])}
          onChange={onChange}
        />
      );
    case "fillet":
    case "chamfer":
      return (
        <EdgeFinishFields
          kind={request.kind}
          draft={draft as FeatureEdgeFinishForm}
          choices={request.choices?.edges ?? []}
          collecting={collecting === "edge"}
          onCollect={() => onCollect("edge", ["edge", "named edge"])}
          onChange={onChange}
        />
      );
    case "shell":
      return (
        <ShellFields
          draft={draft as FeatureShellForm}
          bodyChoices={request.choices?.targetBodies ?? []}
          faceChoices={request.choices?.openFaces ?? []}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "linearPattern":
      return (
        <LinearPatternFields
          draft={draft as FeatureLinearPatternForm}
          seedChoices={request.choices?.seedBodies ?? []}
          directionChoices={request.choices?.directions ?? []}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "circularPattern":
      return (
        <CircularPatternFields
          draft={draft as FeatureCircularPatternForm}
          seedChoices={request.choices?.seedBodies ?? []}
          axisChoices={request.choices?.rotationAxes ?? []}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
    case "mirror":
      return (
        <MirrorFields
          draft={draft as FeatureMirrorForm}
          seedChoices={request.choices?.seedBodies ?? []}
          planeChoices={request.choices?.mirrorPlanes ?? []}
          collecting={collecting}
          onCollect={onCollect}
          onChange={onChange}
        />
      );
  }
}

function PrimitiveFields({
  kind,
  draft,
  onChange
}: {
  readonly kind: "box" | "cylinder" | "sphere" | "cone" | "torus";
  readonly draft: PrimitiveCommandForm;
  readonly onChange: (draft: PrimitiveCommandForm) => void;
}) {
  return (
    <>
      {kind === "box" ? (
        <>
          <NumberField
            label="Width"
            name="width"
            value={draft.width}
            unit="mm"
            onChange={(width) => onChange({ ...draft, width })}
          />
          <NumberField
            label="Height"
            name="height"
            value={draft.height}
            unit="mm"
            onChange={(height) => onChange({ ...draft, height })}
          />
          <NumberField
            label="Depth"
            name="depth"
            value={draft.depth}
            unit="mm"
            onChange={(depth) => onChange({ ...draft, depth })}
          />
        </>
      ) : null}
      {kind === "cylinder" || kind === "cone" ? (
        <>
          <NumberField
            label="Radius"
            name="radius"
            value={draft.radius}
            unit="mm"
            onChange={(radius) => onChange({ ...draft, radius })}
          />
          <NumberField
            label="Height"
            name="height"
            value={draft.height}
            unit="mm"
            onChange={(height) => onChange({ ...draft, height })}
          />
        </>
      ) : null}
      {kind === "sphere" ? (
        <NumberField
          label="Radius"
          name="radius"
          value={draft.radius}
          unit="mm"
          onChange={(radius) => onChange({ ...draft, radius })}
        />
      ) : null}
      {kind === "torus" ? (
        <>
          <NumberField
            label="Major radius"
            name="major-radius"
            value={draft.majorRadius}
            unit="mm"
            onChange={(majorRadius) => onChange({ ...draft, majorRadius })}
          />
          <NumberField
            label="Minor radius"
            name="minor-radius"
            value={draft.minorRadius}
            unit="mm"
            onChange={(minorRadius) => onChange({ ...draft, minorRadius })}
          />
        </>
      ) : null}
      <fieldset className="pb-solid-fieldset">
        <legend>Position</legend>
        <NumberField
          label="X"
          name="translation-x"
          value={draft.translationX}
          unit="mm"
          onChange={(translationX) => onChange({ ...draft, translationX })}
        />
        <NumberField
          label="Y"
          name="translation-y"
          value={draft.translationY}
          unit="mm"
          onChange={(translationY) => onChange({ ...draft, translationY })}
        />
        <NumberField
          label="Z"
          name="translation-z"
          value={draft.translationZ}
          unit="mm"
          onChange={(translationZ) => onChange({ ...draft, translationZ })}
        />
      </fieldset>
    </>
  );
}

function SketchFields({
  draft,
  onChange
}: {
  readonly draft: SketchCreateForm;
  readonly onChange: (draft: SketchCreateForm) => void;
}) {
  return (
    <>
      <TextField
        label="Name"
        name="sketch-name"
        value={draft.name}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <SelectField
        label="Plane"
        name="sketch-plane"
        value={draft.plane}
        options={[
          { value: "XY", label: "XY plane" },
          { value: "XZ", label: "XZ plane" },
          { value: "YZ", label: "YZ plane" }
        ]}
        onChange={(plane) =>
          onChange({ ...draft, plane: plane as SketchCreateForm["plane"] })
        }
      />
    </>
  );
}

function TransformFields({
  draft,
  onChange
}: {
  readonly draft: TransformCommandForm;
  readonly onChange: (draft: TransformCommandForm) => void;
}) {
  const groups = [
    ["Translation", "mm", ["translationX", "translationY", "translationZ"]],
    ["Rotation", "°", ["rotationX", "rotationY", "rotationZ"]],
    ["Scale", undefined, ["scaleX", "scaleY", "scaleZ"]]
  ] as const;
  return (
    <>
      {groups.map(([label, unit, names]) => (
        <fieldset className="pb-solid-fieldset" key={label}>
          <legend>{label}</legend>
          {names.map((name, index) => (
            <NumberField
              key={name}
              label={["X", "Y", "Z"][index]!}
              name={name}
              value={draft[name]}
              unit={unit}
              onChange={(value) => onChange({ ...draft, [name]: value })}
            />
          ))}
        </fieldset>
      ))}
    </>
  );
}

function FeatureIdentityFields({
  draft,
  onChange
}: {
  readonly draft: { readonly name: string };
  readonly onChange: (name: string) => void;
}) {
  return (
    <TextField
      label="Feature name"
      name="feature-name"
      value={draft.name}
      onChange={onChange}
    />
  );
}

function ExtrudeFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureExtrudeForm;
  readonly choices: SolidEditorRequest["choices"];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureExtrudeForm) => void;
}) {
  const targetRequired = draft.operationMode !== "newBody";
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <SelectField
        label="Operation"
        name="extrude-operation"
        value={draft.operationMode}
        options={[
          { value: "newBody", label: "New body" },
          { value: "add", label: "Add" },
          { value: "cut", label: "Cut" }
        ]}
        onChange={(operationMode) =>
          onChange({
            ...draft,
            operationMode: operationMode as FeatureExtrudeForm["operationMode"],
            targetBodyId:
              operationMode === "newBody" ? undefined : draft.targetBodyId
          })
        }
      />
      {targetRequired ? (
        <ChoiceCollector
          label="Target body"
          acceptedKinds={["body"]}
          choices={choices?.targetBodies ?? []}
          selectedKey={findChoiceKey(choices?.targetBodies, draft.targetBodyId)}
          collecting={collecting === "targetBody"}
          required
          onCollect={() => onCollect("targetBody", ["body"])}
          onChange={(bodyId) => onChange({ ...draft, targetBodyId: bodyId })}
          onClear={() => onChange({ ...draft, targetBodyId: undefined })}
        />
      ) : null}
      <NumberField
        label="Depth"
        name="extrude-depth"
        value={draft.depth}
        unit="mm"
        onChange={(depth) => onChange({ ...draft, depth })}
      />
      <SelectField
        label="Side"
        name="extrude-side"
        value={draft.side}
        options={[
          { value: "positive", label: "Positive" },
          { value: "negative", label: "Negative" },
          { value: "symmetric", label: "Symmetric" }
        ]}
        onChange={(side) =>
          onChange({ ...draft, side: side as FeatureExtrudeForm["side"] })
        }
      />
    </>
  );
}

function CompositeExtrudeFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureCompositeExtrudeForm;
  readonly choices: SolidEditorRequest["choices"];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureCompositeExtrudeForm) => void;
}) {
  const profiles = choices?.profiles ?? [];
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Profile"
        acceptedKinds={["closed sketch profile"]}
        choices={profiles}
        selectedKey={findChoiceKey(profiles, draft.profile)}
        collecting={collecting === "profile"}
        required
        onCollect={() => onCollect("profile", ["closed sketch profile"])}
        onChange={(profile) => onChange({ ...draft, profile })}
        onClear={() => undefined}
      />
      <ExtrudeParameterFields
        draft={draft}
        targetChoices={choices?.targetBodies ?? []}
        collecting={collecting === "targetBody"}
        onCollect={() => onCollect("targetBody", ["body"])}
        onChange={onChange}
      />
    </>
  );
}

function ExtrudeParameterFields<Draft extends FeatureExtrudeForm>({
  draft,
  targetChoices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: Draft;
  readonly targetChoices: readonly SolidChoice<string>[];
  readonly collecting: boolean;
  readonly onCollect: () => void;
  readonly onChange: (draft: Draft) => void;
}) {
  return (
    <>
      <SelectField
        label="Operation"
        name="composite-extrude-operation"
        value={draft.operationMode}
        options={[
          { value: "newBody", label: "New body" },
          { value: "add", label: "Add" },
          { value: "cut", label: "Cut" }
        ]}
        onChange={(operationMode) =>
          onChange({
            ...draft,
            operationMode: operationMode as Draft["operationMode"],
            targetBodyId:
              operationMode === "newBody" ? undefined : draft.targetBodyId
          })
        }
      />
      {draft.operationMode !== "newBody" ? (
        <ChoiceCollector
          label="Target body"
          acceptedKinds={["body"]}
          choices={targetChoices}
          selectedKey={findChoiceKey(targetChoices, draft.targetBodyId)}
          collecting={collecting}
          required
          onCollect={onCollect}
          onChange={(targetBodyId) => onChange({ ...draft, targetBodyId })}
          onClear={() => onChange({ ...draft, targetBodyId: undefined })}
        />
      ) : null}
      <NumberField
        label="Depth"
        name="composite-extrude-depth"
        value={draft.depth}
        unit="mm"
        onChange={(depth) => onChange({ ...draft, depth })}
      />
      <SelectField
        label="Side"
        name="composite-extrude-side"
        value={draft.side}
        options={[
          { value: "positive", label: "Positive" },
          { value: "negative", label: "Negative" },
          { value: "symmetric", label: "Symmetric" }
        ]}
        onChange={(side) => onChange({ ...draft, side: side as Draft["side"] })}
      />
    </>
  );
}

function RevolveFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureRevolveForm;
  readonly choices: SolidEditorRequest["choices"];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureRevolveForm) => void;
}) {
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Axis line"
        acceptedKinds={["sketch line"]}
        choices={choices?.axes ?? []}
        selectedKey={findChoiceKey(choices?.axes, draft.axisEntityId)}
        collecting={collecting === "axis"}
        required
        onCollect={() => onCollect("axis", ["sketch line"])}
        onChange={(axisEntityId) => onChange({ ...draft, axisEntityId })}
        onClear={() => onChange({ ...draft, axisEntityId: "" })}
      />
      <NumberField
        label="Angle"
        name="revolve-angle"
        value={draft.angleDegrees}
        unit="°"
        onChange={(angleDegrees) => onChange({ ...draft, angleDegrees })}
      />
    </>
  );
}

function CompositeRevolveFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureCompositeRevolveForm;
  readonly choices: SolidEditorRequest["choices"];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureCompositeRevolveForm) => void;
}) {
  const profiles = choices?.profiles ?? [];
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Profile"
        acceptedKinds={["closed sketch profile"]}
        choices={profiles}
        selectedKey={findChoiceKey(profiles, draft.profile)}
        collecting={collecting === "profile"}
        required
        onCollect={() => onCollect("profile", ["closed sketch profile"])}
        onChange={(profile) => onChange({ ...draft, profile })}
        onClear={() => undefined}
      />
      <ChoiceCollector
        label="Axis line"
        acceptedKinds={["sketch line"]}
        choices={choices?.axes ?? []}
        selectedKey={findChoiceKey(choices?.axes, draft.axisEntityId)}
        collecting={collecting === "axis"}
        required
        onCollect={() => onCollect("axis", ["sketch line"])}
        onChange={(axisEntityId) => onChange({ ...draft, axisEntityId })}
        onClear={() => onChange({ ...draft, axisEntityId: "" })}
      />
      <NumberField
        label="Angle"
        name="composite-revolve-angle"
        value={draft.angleDegrees}
        unit="°"
        onChange={(angleDegrees) => onChange({ ...draft, angleDegrees })}
      />
    </>
  );
}

function SweepFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureSweepForm;
  readonly choices: readonly SolidChoice<SweepPathChoiceValue>[];
  readonly collecting: boolean;
  readonly onCollect: () => void;
  readonly onChange: (draft: FeatureSweepForm) => void;
}) {
  const selected = choices.find(
    (choice) =>
      choice.value.pathSketchId === draft.pathSketchId &&
      stableSerialize(choice.value.pathEntityIds) ===
        stableSerialize(draft.pathEntityIds)
  );
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Sweep path"
        acceptedKinds={["line", "arc", "tangent path"]}
        choices={choices}
        selectedKey={selected?.key}
        collecting={collecting}
        required
        onCollect={onCollect}
        onChange={(path) => onChange({ ...draft, ...path })}
        onClear={() =>
          onChange({ ...draft, pathSketchId: "", pathEntityIds: [] })
        }
      />
    </>
  );
}

function CompositeSweepFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureCompositeSweepForm;
  readonly choices: SolidEditorRequest["choices"];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureCompositeSweepForm) => void;
}) {
  const profiles = (choices?.profiles ?? []).filter(
    (choice): choice is SolidChoice<FeatureCompositeSweepForm["profile"]> =>
      choice.value.kind === "entity"
  );
  const paths = choices?.paths ?? [];
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Profile"
        acceptedKinds={["entity profile"]}
        choices={profiles}
        selectedKey={findChoiceKey(profiles, draft.profile)}
        collecting={collecting === "profile"}
        required
        onCollect={() => onCollect("profile", ["entity profile"])}
        onChange={(profile) => onChange({ ...draft, profile })}
        onClear={() => undefined}
      />
      <ChoiceCollector
        label="Sweep path"
        acceptedKinds={["line", "arc", "tangent path"]}
        choices={paths}
        selectedKey={findChoiceKey(paths, draft.path)}
        collecting={collecting === "path"}
        required
        onCollect={() => onCollect("path", ["line", "arc", "tangent path"])}
        onChange={(path) => onChange({ ...draft, path })}
        onClear={() => undefined}
      />
      <div className="pb-solid-inline-action">
        <Button
          onClick={() =>
            onChange({ ...draft, path: reverseSketchPath(draft.path) })
          }
        >
          Reverse submitted direction
        </Button>
      </div>
    </>
  );
}

function reverseSketchPath(
  path: FeatureCompositeSweepForm["path"]
): FeatureCompositeSweepForm["path"] {
  if (path.kind === "entity") {
    return {
      ...path,
      orientation: path.orientation === "forward" ? "reverse" : "forward"
    };
  }
  return {
    ...path,
    segments: [...path.segments].reverse().map((segment) => ({
      ...segment,
      orientation: segment.orientation === "forward" ? "reverse" : "forward"
    }))
  };
}

function LoftFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureLoftForm;
  readonly choices: readonly SolidChoice<LoftSection>[];
  readonly collecting: boolean;
  readonly onCollect: () => void;
  readonly onChange: (draft: FeatureLoftForm) => void;
}) {
  const selectedKeys = draft.sections
    .map((section) => findChoiceKey(choices, section))
    .filter((key): key is string => Boolean(key));
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <MultiChoiceCollector
        label="Sections"
        acceptedKinds={["closed sketch profile"]}
        choices={choices}
        selectedKeys={selectedKeys}
        collecting={collecting}
        required
        onCollect={onCollect}
        onChange={(sections) => onChange({ ...draft, sections })}
      />
    </>
  );
}

function HoleFields({
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureHoleForm;
  readonly choices: readonly SolidChoice<string>[];
  readonly collecting: boolean;
  readonly onCollect: () => void;
  readonly onChange: (draft: FeatureHoleForm) => void;
}) {
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Target body"
        acceptedKinds={["body"]}
        choices={choices}
        selectedKey={findChoiceKey(choices, draft.targetBodyId)}
        collecting={collecting}
        required
        onCollect={onCollect}
        onChange={(targetBodyId) => onChange({ ...draft, targetBodyId })}
        onClear={() => onChange({ ...draft, targetBodyId: "" })}
      />
      <SelectField
        label="Depth mode"
        name="hole-depth-mode"
        value={draft.depthMode}
        options={[
          { value: "blind", label: "Blind" },
          { value: "throughAll", label: "Through all" }
        ]}
        onChange={(depthMode) =>
          onChange({
            ...draft,
            depthMode: depthMode as FeatureHoleForm["depthMode"]
          })
        }
      />
      {draft.depthMode === "blind" ? (
        <NumberField
          label="Depth"
          name="hole-depth"
          value={draft.depth}
          unit="mm"
          onChange={(depth) => onChange({ ...draft, depth })}
        />
      ) : null}
      <SelectField
        label="Direction"
        name="hole-direction"
        value={draft.direction}
        options={[
          { value: "positive", label: "Positive" },
          { value: "negative", label: "Negative" }
        ]}
        onChange={(direction) =>
          onChange({
            ...draft,
            direction: direction as FeatureHoleForm["direction"]
          })
        }
      />
    </>
  );
}

function EdgeFinishFields({
  kind,
  draft,
  choices,
  collecting,
  onCollect,
  onChange
}: {
  readonly kind: "fillet" | "chamfer";
  readonly draft: FeatureEdgeFinishForm;
  readonly choices: readonly SolidChoice<EdgeChoiceValue>[];
  readonly collecting: boolean;
  readonly onCollect: () => void;
  readonly onChange: (draft: FeatureEdgeFinishForm) => void;
}) {
  const selected = choices.find((choice) =>
    edgeChoiceMatches(choice.value, draft)
  );
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Edge"
        acceptedKinds={["edge", "named edge"]}
        choices={choices}
        selectedKey={selected?.key}
        collecting={collecting}
        required
        onCollect={onCollect}
        onChange={(edge) =>
          onChange({
            ...draft,
            ...edge,
            edgeStableId: edge.edgeStableId,
            namedReference: edge.namedReference,
            topologyAnchorId: edge.topologyAnchorId,
            topologyAnchorProof: edge.topologyAnchorProof
          })
        }
        onClear={() =>
          onChange({
            ...draft,
            targetBodyId: "",
            edgeStableId: undefined,
            namedReference: undefined,
            topologyAnchorId: undefined,
            topologyAnchorProof: undefined
          })
        }
      />
      <NumberField
        label={kind === "fillet" ? "Radius" : "Distance"}
        name={`edge-${kind}-size`}
        value={kind === "fillet" ? draft.radius : draft.distance}
        unit="mm"
        onChange={(value) =>
          onChange(
            kind === "fillet"
              ? { ...draft, radius: value }
              : { ...draft, distance: value }
          )
        }
      />
    </>
  );
}

function ShellFields({
  draft,
  bodyChoices,
  faceChoices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureShellForm;
  readonly bodyChoices: readonly SolidChoice<string>[];
  readonly faceChoices: readonly SolidChoice<FeatureShellOpenFaceRef>[];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureShellForm) => void;
}) {
  const selectedFaceKeys = draft.openFaceRefs
    .map((face) => findChoiceKey(faceChoices, face))
    .filter((key): key is string => Boolean(key));
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Target body"
        acceptedKinds={["body"]}
        choices={bodyChoices}
        selectedKey={findChoiceKey(bodyChoices, draft.targetBodyId)}
        collecting={collecting === "targetBody"}
        required
        onCollect={() => onCollect("targetBody", ["body"])}
        onChange={(targetBodyId) => onChange({ ...draft, targetBodyId })}
        onClear={() => onChange({ ...draft, targetBodyId: "" })}
      />
      <MultiChoiceCollector
        label="Open faces"
        acceptedKinds={["face", "named face"]}
        choices={faceChoices}
        selectedKeys={selectedFaceKeys}
        collecting={collecting === "openFaces"}
        onCollect={() => onCollect("openFaces", ["face", "named face"])}
        onChange={(openFaceRefs) => onChange({ ...draft, openFaceRefs })}
      />
      <NumberField
        label="Wall thickness"
        name="shell-thickness"
        value={draft.wallThickness}
        unit="mm"
        onChange={(wallThickness) => onChange({ ...draft, wallThickness })}
      />
    </>
  );
}

function LinearPatternFields({
  draft,
  seedChoices,
  directionChoices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureLinearPatternForm;
  readonly seedChoices: readonly SolidChoice<string>[];
  readonly directionChoices: readonly SolidChoice<PatternDirectionRef>[];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureLinearPatternForm) => void;
}) {
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Seed body"
        acceptedKinds={["authored body"]}
        choices={seedChoices}
        selectedKey={findChoiceKey(seedChoices, draft.seedBodyId)}
        collecting={collecting === "seedBody"}
        required
        onCollect={() => onCollect("seedBody", ["authored body"])}
        onChange={(seedBodyId) => onChange({ ...draft, seedBodyId })}
        onClear={() => onChange({ ...draft, seedBodyId: "" })}
      />
      <ChoiceCollector
        label="Direction"
        acceptedKinds={["axis", "edge", "named reference"]}
        choices={directionChoices}
        selectedKey={findChoiceKey(directionChoices, draft.direction)}
        collecting={collecting === "direction"}
        required
        onCollect={() =>
          onCollect("direction", ["axis", "edge", "named reference"])
        }
        onChange={(direction) => onChange({ ...draft, direction })}
        onClear={() => undefined}
      />
      <NumberField
        label="Spacing"
        name="linear-spacing"
        value={draft.spacing}
        unit="mm"
        onChange={(spacing) => onChange({ ...draft, spacing })}
      />
      <NumberField
        label="Instances"
        name="linear-count"
        value={draft.instanceCount}
        min={2}
        step={1}
        onChange={(instanceCount) => onChange({ ...draft, instanceCount })}
      />
    </>
  );
}

function CircularPatternFields({
  draft,
  seedChoices,
  axisChoices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureCircularPatternForm;
  readonly seedChoices: readonly SolidChoice<string>[];
  readonly axisChoices: readonly SolidChoice<PatternRotationAxisRef>[];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureCircularPatternForm) => void;
}) {
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Seed body"
        acceptedKinds={["authored body"]}
        choices={seedChoices}
        selectedKey={findChoiceKey(seedChoices, draft.seedBodyId)}
        collecting={collecting === "seedBody"}
        required
        onCollect={() => onCollect("seedBody", ["authored body"])}
        onChange={(seedBodyId) => onChange({ ...draft, seedBodyId })}
        onClear={() => onChange({ ...draft, seedBodyId: "" })}
      />
      <ChoiceCollector
        label="Rotation axis"
        acceptedKinds={["axis", "edge", "named reference"]}
        choices={axisChoices}
        selectedKey={findChoiceKey(axisChoices, draft.rotationAxis)}
        collecting={collecting === "rotationAxis"}
        required
        onCollect={() =>
          onCollect("rotationAxis", ["axis", "edge", "named reference"])
        }
        onChange={(rotationAxis) => onChange({ ...draft, rotationAxis })}
        onClear={() => undefined}
      />
      <NumberField
        label="Total angle"
        name="circular-angle"
        value={draft.totalAngleDegrees}
        unit="°"
        onChange={(totalAngleDegrees) =>
          onChange({ ...draft, totalAngleDegrees })
        }
      />
      <NumberField
        label="Instances"
        name="circular-count"
        value={draft.instanceCount}
        min={2}
        step={1}
        onChange={(instanceCount) => onChange({ ...draft, instanceCount })}
      />
    </>
  );
}

function MirrorFields({
  draft,
  seedChoices,
  planeChoices,
  collecting,
  onCollect,
  onChange
}: {
  readonly draft: FeatureMirrorForm;
  readonly seedChoices: readonly SolidChoice<string>[];
  readonly planeChoices: readonly SolidChoice<MirrorPlaneRef>[];
  readonly collecting?: string;
  readonly onCollect: (
    collector: SolidCollectorRequest["collector"],
    accepted: readonly string[]
  ) => void;
  readonly onChange: (draft: FeatureMirrorForm) => void;
}) {
  return (
    <>
      <FeatureIdentityFields
        draft={draft}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <ChoiceCollector
        label="Seed body"
        acceptedKinds={["authored body"]}
        choices={seedChoices}
        selectedKey={findChoiceKey(seedChoices, draft.seedBodyId)}
        collecting={collecting === "seedBody"}
        required
        onCollect={() => onCollect("seedBody", ["authored body"])}
        onChange={(seedBodyId) => onChange({ ...draft, seedBodyId })}
        onClear={() => onChange({ ...draft, seedBodyId: "" })}
      />
      <ChoiceCollector
        label="Mirror plane"
        acceptedKinds={["standard plane", "face", "named reference"]}
        choices={planeChoices}
        selectedKey={findChoiceKey(planeChoices, draft.plane)}
        collecting={collecting === "mirrorPlane"}
        required
        onCollect={() =>
          onCollect("mirrorPlane", [
            "standard plane",
            "face",
            "named reference"
          ])
        }
        onChange={(plane) => onChange({ ...draft, plane })}
        onClear={() => undefined}
      />
      <label className="pb-editor-toggle">
        <input
          type="checkbox"
          checked={draft.includeOriginal}
          onChange={(event) =>
            onChange({ ...draft, includeOriginal: event.currentTarget.checked })
          }
        />
        <span>Keep original body</span>
      </label>
    </>
  );
}

function ChoiceCollector<Value>({
  label,
  acceptedKinds,
  choices,
  selectedKey,
  collecting,
  required,
  onCollect,
  onChange,
  onClear
}: {
  readonly label: string;
  readonly acceptedKinds: readonly string[];
  readonly choices: readonly SolidChoice<Value>[];
  readonly selectedKey?: string;
  readonly collecting: boolean;
  readonly required?: boolean;
  readonly onCollect: () => void;
  readonly onChange: (value: Value) => void;
  readonly onClear: () => void;
}) {
  const selected = choices.find((choice) => choice.key === selectedKey);
  const targets: readonly SelectionCollectorTarget<Value>[] = selected
    ? [{ value: selected.value, label: selected.label, kind: selected.kind }]
    : [];
  return (
    <div className="pb-solid-collector">
      <SelectionCollectorRow
        label={label}
        acceptedKinds={acceptedKinds}
        targets={targets}
        collecting={collecting}
        required={required}
        onStartCollecting={onCollect}
        onStopCollecting={onCollect}
        onRemove={onClear}
        onClear={onClear}
      />
      <label>
        <span className="pb-visually-hidden">Choose {label.toLowerCase()}</span>
        <select
          className="pb-field"
          value={selectedKey ?? ""}
          onChange={(event) => {
            const choice = choices.find(
              (candidate) => candidate.key === event.currentTarget.value
            );
            if (choice) onChange(choice.value);
          }}
        >
          <option value="">Choose from eligible targets</option>
          {choices.map((choice) => (
            <option key={choice.key} value={choice.key}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function MultiChoiceCollector<Value>({
  label,
  acceptedKinds,
  choices,
  selectedKeys,
  collecting,
  required,
  onCollect,
  onChange
}: {
  readonly label: string;
  readonly acceptedKinds: readonly string[];
  readonly choices: readonly SolidChoice<Value>[];
  readonly selectedKeys: readonly string[];
  readonly collecting: boolean;
  readonly required?: boolean;
  readonly onCollect: () => void;
  readonly onChange: (values: readonly Value[]) => void;
}) {
  const selected = choices.filter((choice) =>
    selectedKeys.includes(choice.key)
  );
  const targets = selected.map((choice) => ({
    value: choice.value,
    label: choice.label,
    kind: choice.kind
  }));
  const update = (keys: readonly string[]) =>
    onChange(
      keys
        .map((key) => choices.find((choice) => choice.key === key)?.value)
        .filter((value): value is Value => value !== undefined)
    );
  return (
    <div className="pb-solid-collector">
      <SelectionCollectorRow
        label={label}
        acceptedKinds={acceptedKinds}
        targets={targets}
        collecting={collecting}
        required={required}
        onStartCollecting={onCollect}
        onStopCollecting={onCollect}
        onRemove={(value) =>
          update(
            selected
              .filter((choice) => choice.value !== value)
              .map((choice) => choice.key)
          )
        }
        onClear={() => update([])}
      />
      <div className="pb-solid-choice-list">
        {choices.map((choice) => (
          <label key={choice.key}>
            <input
              type="checkbox"
              checked={selectedKeys.includes(choice.key)}
              onChange={(event) =>
                update(
                  event.currentTarget.checked
                    ? [...selectedKeys, choice.key]
                    : selectedKeys.filter((key) => key !== choice.key)
                )
              }
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  label,
  name,
  value,
  unit,
  min,
  step = "any",
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: number;
  readonly unit?: string;
  readonly min?: number;
  readonly step?: number | "any";
  readonly onChange: (value: number) => void;
}) {
  const id = `solid-${name}`;
  return (
    <EditorFieldRow label={label} htmlFor={id} unit={unit} required>
      <input
        id={id}
        className="pb-field pb-numeric"
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </EditorFieldRow>
  );
}

function TextField({
  label,
  name,
  value,
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const id = `solid-${name}`;
  return (
    <EditorFieldRow label={label} htmlFor={id}>
      <input
        id={id}
        className="pb-field"
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </EditorFieldRow>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly onChange: (value: string) => void;
}) {
  const id = `solid-${name}`;
  return (
    <EditorFieldRow label={label} htmlFor={id}>
      <select
        id={id}
        className="pb-field"
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.currentTarget.value)
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </EditorFieldRow>
  );
}

export function validateSolidDraft(
  kind: SolidEditorKind,
  draft: SolidDraft
): FeatureEditorValidation {
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  if (kind === "box") {
    const form = draft as PrimitiveCommandForm;
    return positive(form.width) && positive(form.height) && positive(form.depth)
      ? ready()
      : blocked("Width, height, and depth must be greater than zero.");
  }
  if (kind === "cylinder" || kind === "cone") {
    const form = draft as PrimitiveCommandForm;
    return positive(form.radius) && positive(form.height)
      ? ready()
      : blocked("Radius and height must be greater than zero.");
  }
  if (kind === "sphere")
    return positive((draft as PrimitiveCommandForm).radius)
      ? ready()
      : blocked("Radius must be greater than zero.");
  if (kind === "torus") {
    const form = draft as PrimitiveCommandForm;
    return positive(form.majorRadius) &&
      positive(form.minorRadius) &&
      form.majorRadius > form.minorRadius
      ? ready()
      : blocked("Major radius must be greater than the positive minor radius.");
  }
  if (kind === "sketch")
    return (draft as SketchCreateForm).name.trim()
      ? ready()
      : blocked("Enter a sketch name.");
  if (kind === "transform") {
    const form = draft as TransformCommandForm;
    return [
      form.translationX,
      form.translationY,
      form.translationZ,
      form.rotationX,
      form.rotationY,
      form.rotationZ,
      form.scaleX,
      form.scaleY,
      form.scaleZ
    ].every(Number.isFinite) &&
      form.scaleX !== 0 &&
      form.scaleY !== 0 &&
      form.scaleZ !== 0
      ? ready()
      : blocked("Transform values must be finite and scale cannot be zero.");
  }
  if (kind === "extrude" || kind === "compositeExtrude") {
    const form = draft as FeatureExtrudeForm;
    if (
      kind === "compositeExtrude" &&
      !(draft as FeatureCompositeExtrudeForm).profile
    )
      return collecting("Select a closed sketch profile.");
    if (!positive(form.depth))
      return blocked("Depth must be greater than zero.");
    return form.operationMode !== "newBody" && !form.targetBodyId
      ? collecting("Select a target body.")
      : ready();
  }
  if (kind === "revolve" || kind === "compositeRevolve") {
    const form = draft as FeatureRevolveForm;
    if (
      kind === "compositeRevolve" &&
      !(draft as FeatureCompositeRevolveForm).profile
    )
      return collecting("Select a closed sketch profile.");
    if (!form.axisEntityId) return collecting("Select an axis line.");
    return positive(form.angleDegrees) && form.angleDegrees <= 360
      ? ready()
      : blocked("Angle must be greater than zero and no more than 360°.");
  }
  if (kind === "sweep") {
    const form = draft as FeatureSweepForm;
    return form.pathSketchId && form.pathEntityIds.length > 0
      ? ready()
      : collecting("Select a supported sweep path.");
  }
  if (kind === "compositeSweep") {
    const form = draft as FeatureCompositeSweepForm;
    if (!form.profile) return collecting("Select an entity profile.");
    return form.path ? ready() : collecting("Select a supported sweep path.");
  }
  if (kind === "loft")
    return (draft as FeatureLoftForm).sections.length >= 2
      ? ready()
      : collecting("Select at least two sections.");
  if (kind === "hole") {
    const form = draft as FeatureHoleForm;
    if (!form.targetBodyId) return collecting("Select a target body.");
    return form.depthMode === "throughAll" || positive(form.depth)
      ? ready()
      : blocked("Blind depth must be greater than zero.");
  }
  if (kind === "fillet" || kind === "chamfer") {
    const form = draft as FeatureEdgeFinishForm;
    if (
      !form.targetBodyId ||
      (!form.edgeStableId && !form.namedReference && !form.topologyAnchorId)
    )
      return collecting("Select a supported edge.");
    return positive(kind === "fillet" ? form.radius : form.distance)
      ? ready()
      : blocked(
          `${kind === "fillet" ? "Radius" : "Distance"} must be greater than zero.`
        );
  }
  if (kind === "shell") {
    const form = draft as FeatureShellForm;
    if (!form.targetBodyId) return collecting("Select a target body.");
    return positive(form.wallThickness)
      ? ready()
      : blocked("Wall thickness must be greater than zero.");
  }
  if (kind === "linearPattern") {
    const form = draft as FeatureLinearPatternForm;
    if (!form.seedBodyId) return collecting("Select an authored seed body.");
    return positive(form.spacing) &&
      Number.isInteger(form.instanceCount) &&
      form.instanceCount >= 2
      ? ready()
      : blocked(
          "Spacing must be positive and instances must be a whole number of at least two."
        );
  }
  if (kind === "circularPattern") {
    const form = draft as FeatureCircularPatternForm;
    if (!form.seedBodyId) return collecting("Select an authored seed body.");
    return positive(form.totalAngleDegrees) &&
      form.totalAngleDegrees <= 360 &&
      Number.isInteger(form.instanceCount) &&
      form.instanceCount >= 2
      ? ready()
      : blocked(
          "Angle must be within 360° and instances must be a whole number of at least two."
        );
  }
  return (draft as FeatureMirrorForm).seedBodyId
    ? ready()
    : collecting("Select an authored seed body.");
}

function ready(): FeatureEditorValidation {
  return { status: "ready" };
}
function blocked(message: string): FeatureEditorValidation {
  return { status: "blocked", message };
}
function collecting(message: string): FeatureEditorValidation {
  return { status: "collecting", message };
}
function phaseForValidation(
  validation: FeatureEditorValidation
): FeatureEditorPhase {
  return validation.status === "ready" ? "ready" : validation.status;
}
function stableSerialize(value: unknown): string {
  return JSON.stringify(value);
}
function findChoiceKey<Value>(
  choices: readonly SolidChoice<Value>[] | undefined,
  value: Value | undefined
): string | undefined {
  return value === undefined
    ? undefined
    : choices?.find(
        (choice) => stableSerialize(choice.value) === stableSerialize(value)
      )?.key;
}
function edgeChoiceMatches(
  choice: EdgeChoiceValue,
  draft: FeatureEdgeFinishForm
): boolean {
  return (
    choice.targetBodyId === draft.targetBodyId &&
    choice.edgeStableId === draft.edgeStableId &&
    choice.namedReference === draft.namedReference &&
    choice.topologyAnchorId === draft.topologyAnchorId
  );
}
function formatEditorKind(kind: SolidEditorKind): string {
  return (
    (
      {
        compositeExtrude: "Extrude",
        compositeRevolve: "Revolve",
        compositeSweep: "Sweep",
        linearPattern: "Linear pattern",
        circularPattern: "Circular pattern"
      } as Partial<Record<SolidEditorKind, string>>
    )[kind] ?? `${kind[0]?.toUpperCase()}${kind.slice(1)}`
  );
}
