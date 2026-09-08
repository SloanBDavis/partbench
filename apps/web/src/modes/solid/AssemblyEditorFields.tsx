import type { AssemblyMateFrameRef, Vec3 } from "@web-cad/cad-protocol";
import type {
  AssemblyInstancePoseForm,
  AssemblyRevoluteMateForm
} from "../../cadCommands";
import type { SolidChoice, SolidEditorChoices } from "./solidEditorTypes";
import { NumberField, SelectField, TextField } from "./solidFormFields";

import { defaultAssemblyFrame } from "./assemblyEditorDefaults";

export function AssemblyScalarFields({
  label,
  name,
  value,
  parameterId,
  parameters,
  unit,
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: number;
  readonly parameterId?: string;
  readonly parameters: readonly SolidChoice<string>[];
  readonly unit?: string;
  readonly onChange: (value: number, parameterId: string | undefined) => void;
}) {
  return (
    <>
      <SelectField
        label={`${label} source`}
        name={`${name}-source`}
        value={parameterId === undefined ? "literal" : "parameter"}
        options={[
          { value: "literal", label: "Value" },
          { value: "parameter", label: "Parameter" }
        ]}
        onChange={(source) =>
          onChange(value, source === "parameter" ? "" : undefined)
        }
      />
      {parameterId === undefined ? (
        <NumberField
          label={label}
          name={name}
          value={value}
          unit={unit}
          onChange={(next) => onChange(next, undefined)}
        />
      ) : (
        <SelectField
          label={`${label} parameter`}
          name={`${name}-parameter`}
          value={parameterId}
          options={[
            { value: "", label: "Choose parameter" },
            ...parameters.map(({ value, label }) => ({ value, label }))
          ]}
          onChange={(id) => onChange(value, id)}
        />
      )}
    </>
  );
}

function VectorFields({
  label,
  name,
  value,
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: Vec3;
  readonly onChange: (value: Vec3) => void;
}) {
  return (
    <>
      {(["X", "Y", "Z"] as const).map((axis, index) => (
        <NumberField
          key={axis}
          label={`${label} ${axis}`}
          name={`${name}-${axis.toLowerCase()}`}
          value={value[index]!}
          onChange={(number) =>
            onChange(
              value.map((old, item) => (item === index ? number : old)) as [
                number,
                number,
                number
              ]
            )
          }
        />
      ))}
    </>
  );
}

function MateFrameFields({
  label,
  name,
  value,
  assemblyId,
  choices,
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: AssemblyMateFrameRef;
  readonly assemblyId: string;
  readonly choices?: SolidEditorChoices;
  readonly onChange: (value: AssemblyMateFrameRef) => void;
}) {
  const frame = value.frame;
  const sketchFrames = choices?.assemblySketchFrames ?? [];
  return (
    <fieldset className="pb-solid-fieldset">
      <legend>{label} frame</legend>
      <SelectField
        label={`${label} instance`}
        name={`${name}-instance`}
        value={value.instanceId}
        options={[
          { value: "", label: "Choose instance" },
          ...(choices?.assemblyInstances ?? [])
            .filter((choice) => choice.value.assemblyId === assemblyId)
            .map((choice) => ({
              value: choice.value.instanceId,
              label: choice.label,
              disabled: choice.disabled
            }))
        ]}
        onChange={(instanceId) => onChange(defaultAssemblyFrame(instanceId))}
      />
      <SelectField
        label={`${label} frame source`}
        name={`${name}-source`}
        value={frame.kind}
        options={[
          { value: "local", label: "Local frame" },
          { value: "sketch", label: "Sketch circle or point" }
        ]}
        onChange={(kind) =>
          onChange(
            kind === "local"
              ? defaultAssemblyFrame(value.instanceId)
              : {
                  instanceId: value.instanceId,
                  frame: {
                    kind: "sketch",
                    sketchId: "",
                    entityId: "",
                    offset: 0
                  }
                }
          )
        }
      />
      {frame.kind === "local" ? (
        <>
          <VectorFields
            label={`${label} origin`}
            name={`${name}-origin`}
            value={frame.origin}
            onChange={(origin) =>
              onChange({ ...value, frame: { ...frame, origin } })
            }
          />
          <VectorFields
            label={`${label} X direction`}
            name={`${name}-x-direction`}
            value={frame.xDirection}
            onChange={(xDirection) =>
              onChange({ ...value, frame: { ...frame, xDirection } })
            }
          />
          <VectorFields
            label={`${label} Z direction`}
            name={`${name}-z-direction`}
            value={frame.zDirection}
            onChange={(zDirection) =>
              onChange({ ...value, frame: { ...frame, zDirection } })
            }
          />
        </>
      ) : (
        <>
          <SelectField
            label={`${label} sketch pivot`}
            name={`${name}-pivot`}
            value={
              sketchFrames.find(
                (choice) =>
                  choice.value.sketchId === frame.sketchId &&
                  choice.value.entityId === frame.entityId
              )?.key ?? ""
            }
            options={[
              { value: "", label: "Choose circle or point" },
              ...sketchFrames.map((choice) => ({
                value: choice.key,
                label: choice.label
              }))
            ]}
            onChange={(key) => {
              const selected = sketchFrames.find(
                (choice) => choice.key === key
              )?.value;
              onChange({
                ...value,
                frame: {
                  ...frame,
                  sketchId: selected?.sketchId ?? "",
                  entityId: selected?.entityId ?? ""
                }
              });
            }}
          />
          <NumberField
            label={`${label} sketch normal offset`}
            name={`${name}-normal-offset`}
            unit="mm"
            value={frame.offset ?? 0}
            onChange={(offset) =>
              onChange({ ...value, frame: { ...frame, offset } })
            }
          />
          <SelectField
            label={`${label} flip normal`}
            name={`${name}-flip`}
            value={frame.flip ? "yes" : "no"}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" }
            ]}
            onChange={(flip) =>
              onChange({ ...value, frame: { ...frame, flip: flip === "yes" } })
            }
          />
          <p className="pb-solid-field-note">
            Choose a pivot from this part's source sketches. X follows sketch U;
            Z follows the sketch normal.
          </p>
        </>
      )}
    </fieldset>
  );
}

export function RevoluteMateFields({
  draft,
  choices,
  onChange
}: {
  readonly draft: AssemblyRevoluteMateForm;
  readonly choices?: SolidEditorChoices;
  readonly onChange: (draft: AssemblyRevoluteMateForm) => void;
}) {
  const mates = (choices?.revoluteMates ?? []).filter(
    (choice) => choice.value.assemblyId === draft.assemblyId
  );
  return (
    <>
      <SelectField
        label="Assembly"
        name="revolute-mate-assembly"
        value={draft.assemblyId}
        options={[
          { value: "", label: "Choose assembly" },
          ...(choices?.assemblies ?? [])
        ]}
        onChange={(assemblyId) =>
          onChange({
            ...draft,
            assemblyId,
            mateId: undefined,
            primary: defaultAssemblyFrame(""),
            secondary: defaultAssemblyFrame("")
          })
        }
      />
      <SelectField
        label="Joint"
        name="revolute-mate-existing"
        value={draft.mateId ?? ""}
        options={[
          { value: "", label: "Create new joint" },
          ...mates.map((choice) => ({
            value: choice.value.mateId!,
            label: choice.label
          }))
        ]}
        onChange={(mateId) =>
          onChange(
            mates.find((choice) => choice.value.mateId === mateId)?.value ?? {
              ...draft,
              mateId: undefined,
              name: "Revolute"
            }
          )
        }
      />
      <TextField
        label="Name"
        name="revolute-mate-name"
        value={draft.name}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <MateFrameFields
        label="Primary"
        name="revolute-primary"
        value={draft.primary}
        assemblyId={draft.assemblyId}
        choices={choices}
        onChange={(primary) => onChange({ ...draft, primary })}
      />
      <MateFrameFields
        label="Secondary"
        name="revolute-secondary"
        value={draft.secondary}
        assemblyId={draft.assemblyId}
        choices={choices}
        onChange={(secondary) => onChange({ ...draft, secondary })}
      />
      <AssemblyScalarFields
        label="Angle"
        name="revolute-angle"
        value={draft.angleDegrees}
        parameterId={draft.angleParameterId}
        parameters={choices?.parameters ?? []}
        unit="deg"
        onChange={(angleDegrees, angleParameterId) =>
          onChange({ ...draft, angleDegrees, angleParameterId })
        }
      />
      <AssemblyScalarFields
        label="Offset"
        name="revolute-offset"
        value={draft.offset}
        parameterId={draft.offsetParameterId}
        parameters={choices?.parameters ?? []}
        unit="mm"
        onChange={(offset, offsetParameterId) =>
          onChange({ ...draft, offset, offsetParameterId })
        }
      />
      <p className="pb-solid-field-note">
        Positive angles rotate about primary Z by the right-hand rule. Offset
        follows primary Z. Instances must have unit scale.
      </p>
    </>
  );
}

export function InstancePoseFields({
  draft,
  choices,
  onChange
}: {
  readonly draft: AssemblyInstancePoseForm;
  readonly choices?: SolidEditorChoices;
  readonly onChange: (draft: AssemblyInstancePoseForm) => void;
}) {
  const instances = choices?.assemblyPoseInstances ?? [];
  return (
    <>
      <SelectField
        label="Instance"
        name="instance-pose-instance"
        value={`${draft.assemblyId}:${draft.instanceId}`}
        options={[
          { value: ":", label: "Choose free or grounded instance" },
          ...instances.map((choice) => ({
            value: choice.key,
            label: choice.label,
            disabled: choice.disabled
          }))
        ]}
        onChange={(key) => {
          const next = instances.find((choice) => choice.key === key);
          if (next && !next.disabled) onChange(next.value);
        }}
      />
      {(["X", "Y", "Z"] as const).map((axis) => (
        <NumberField
          key={axis}
          label={`Position ${axis}`}
          name={`instance-pose-position-${axis.toLowerCase()}`}
          unit="mm"
          value={draft[`translation${axis}`]}
          onChange={(value) =>
            onChange({ ...draft, [`translation${axis}`]: value })
          }
        />
      ))}
      {(["X", "Y", "Z"] as const).map((axis) => (
        <NumberField
          key={axis}
          label={`Rotation ${axis} (degrees)`}
          name={`instance-pose-rotation-${axis.toLowerCase()}`}
          unit="deg"
          value={draft[`rotation${axis}`]}
          onChange={(value) =>
            onChange({ ...draft, [`rotation${axis}`]: value })
          }
        />
      ))}
      <p className="pb-solid-field-note">
        World position. Rotation applies X, then Y, then Z. Edit the mate to
        move a constrained child.
      </p>
    </>
  );
}
