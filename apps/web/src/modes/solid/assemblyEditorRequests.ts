import type {
  AssemblySnapshot,
  CadParameterSnapshot,
  SketchSnapshotV21
} from "@web-cad/cad-protocol";
import type {
  AssemblyDistanceMateForm,
  AssemblyInstancePoseForm
} from "../../cadCommands";
import type {
  SolidEditorChoices,
  SolidEditorRequest
} from "./solidEditorTypes";
import { defaultAssemblyFrame } from "./assemblyEditorDefaults";

export function canEditAssemblyInstancePose(
  assembly: AssemblySnapshot,
  instanceId: string
): boolean {
  return (
    Boolean(
      assembly.mates?.some(
        (mate) => mate.kind === "fixed" && mate.instanceId === instanceId
      )
    ) ||
    !assembly.mates?.some(
      (mate) =>
        mate.kind !== "fixed" &&
        (mate.primary.instanceId === instanceId ||
          mate.secondary.instanceId === instanceId)
    )
  );
}

export function createAssemblyEditorRequest(input: {
  readonly key: string;
  readonly actionId:
    | "solid.revolute-mate"
    | "solid.instance-pose"
    | "solid.distance-mate";
  readonly assemblies: readonly AssemblySnapshot[];
  readonly sketches: readonly Pick<
    SketchSnapshotV21,
    "id" | "name" | "datumId" | "attachment" | "entities"
  >[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly selection?: {
    readonly kind: string;
    readonly id: string;
    readonly assemblyId?: string;
  };
}): SolidEditorRequest {
  const { key, actionId, assemblies, sketches, parameters, selection } = input;
  const selectedAssemblyId =
    selection?.kind === "assembly" ? selection.id : selection?.assemblyId;
  const assembly =
    assemblies.find((item) => item.id === selectedAssemblyId) ??
    assemblies.find((item) => item.instances.length >= 2) ??
    assemblies[0];
  const availableInstances = (assembly?.instances ?? []).filter(
    (instance) =>
      actionId !== "solid.revolute-mate" ||
      instance.transform.scale.every((scale) => scale === 1)
  );
  const primaryId =
    (selection?.kind === "assembly-instance" &&
    availableInstances.some((instance) => instance.id === selection.id)
      ? selection.id
      : availableInstances[0]?.id) ?? "";
  const secondaryId =
    availableInstances.find((instance) => instance.id !== primaryId)?.id ?? "";
  const choices: SolidEditorChoices = {
    assemblies: assemblies.map((item) => ({
      value: item.id,
      key: item.id,
      label: item.name,
      kind: "assembly"
    })),
    parameters: parameters.map((item) => ({
      value: item.id,
      key: item.id,
      label: item.name,
      kind: "parameter"
    })),
    assemblyInstances: assemblies.flatMap((item) =>
      item.instances.map((instance) => ({
        value: { assemblyId: item.id, instanceId: instance.id },
        key: `${item.id}:${instance.id}`,
        label: `${item.name} · ${instance.name}`,
        kind: "assembly-instance",
        ...(actionId === "solid.revolute-mate" &&
        instance.transform.scale.some((scale) => scale !== 1)
          ? { disabled: true }
          : {})
      }))
    ),
    assemblySketchFrames: sketches
      .filter((sketch) => !sketch.attachment && !sketch.datumId)
      .flatMap((sketch) =>
        sketch.entities
          .filter(
            (entity) => entity.kind === "circle" || entity.kind === "point"
          )
          .map((entity) => ({
            value: { sketchId: sketch.id, entityId: entity.id },
            key: `${sketch.id}:${entity.id}`,
            label: `${sketch.name} · ${`${entity.kind} ${entity.id}`}`,
            kind: "sketch-pivot"
          }))
      ),
    revoluteMates: assemblies.flatMap((item) =>
      (item.mates ?? []).flatMap((mate) =>
        mate.kind !== "revolute"
          ? []
          : [
              {
                key: `${item.id}:${mate.id}`,
                label: mate.name,
                kind: "assembly-mate",
                value: { ...mate, id: "", mateId: mate.id, assemblyId: item.id }
              }
            ]
      )
    ),
    distanceMates: assemblies.flatMap((item) =>
      (item.mates ?? []).flatMap((mate) =>
        mate.kind !== "distance"
          ? []
          : [
              {
                key: `${item.id}:${mate.id}`,
                label: mate.name,
                kind: "assembly-mate",
                value: {
                  id: "",
                  mateId: mate.id,
                  name: mate.name,
                  assemblyId: item.id,
                  distance: mate.distance,
                  distanceParameterId: mate.distanceParameterId,
                  primary: {
                    ...mate.primary,
                    offset: mate.primary.offset ?? 0,
                    flip: mate.primary.flip ?? false
                  },
                  secondary: {
                    ...mate.secondary,
                    offset: mate.secondary.offset ?? 0,
                    flip: mate.secondary.flip ?? false
                  }
                }
              }
            ]
      )
    ),
    assemblyPoseInstances: assemblies.flatMap((item) =>
      item.instances.map((instance) => ({
        key: `${item.id}:${instance.id}`,
        label: `${item.name} · ${instance.name}${canEditAssemblyInstancePose(item, instance.id) ? "" : " (edit its mate)"}`,
        kind: "assembly-instance",
        disabled: !canEditAssemblyInstancePose(item, instance.id),
        value: {
          assemblyId: item.id,
          instanceId: instance.id,
          translationX: instance.transform.translation[0],
          translationY: instance.transform.translation[1],
          translationZ: instance.transform.translation[2],
          rotationX: (instance.transform.rotation[0] * 180) / Math.PI,
          rotationY: (instance.transform.rotation[1] * 180) / Math.PI,
          rotationZ: (instance.transform.rotation[2] * 180) / Math.PI
        }
      }))
    )
  };
  if (actionId === "solid.instance-pose") {
    const eligible =
      choices.assemblyPoseInstances?.filter((choice) => !choice.disabled) ?? [];
    const initialDraft =
      eligible.find(
        (choice) =>
          choice.value.instanceId === primaryId &&
          choice.value.assemblyId === assembly?.id
      )?.value ??
      eligible[0]?.value ??
      ({
        assemblyId: "",
        instanceId: "",
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0
      } satisfies AssemblyInstancePoseForm);
    return {
      key,
      kind: "instancePose",
      title: "Instance Pose",
      mode: "edit",
      initialDraft,
      choices,
      ...(eligible.length === 0
        ? {
            blockedReason:
              "Create a free or grounded instance. Move constrained children by editing their mates."
          }
        : {})
    };
  }
  const blockedReason = !assemblies.some(
    (item) =>
      item.instances.filter(
        (instance) =>
          actionId !== "solid.revolute-mate" ||
          instance.transform.scale.every((scale) => scale === 1)
      ).length >= 2
  )
    ? "Create an assembly with at least two supported instances to mate. Revolute mates require unit scale."
    : undefined;
  if (actionId === "solid.distance-mate") {
    const existing =
      selection?.kind === "assembly-mate"
        ? choices.distanceMates?.find(
            (choice) =>
              choice.value.mateId === selection.id &&
              choice.value.assemblyId === assembly?.id
          )?.value
        : undefined;
    const initialDraft: AssemblyDistanceMateForm = existing ?? {
      id: "",
      name: "Distance",
      assemblyId: assembly?.id ?? "",
      primary: { instanceId: primaryId, plane: "XY", offset: 0, flip: false },
      secondary: {
        instanceId: secondaryId,
        plane: "XY",
        offset: 0,
        flip: false
      },
      distance: 30
    };
    return {
      key,
      kind: "distanceMate",
      title: "Distance Mate",
      initialDraft,
      choices,
      blockedReason
    };
  }
  const existing =
    selection?.kind === "assembly-mate"
      ? choices.revoluteMates?.find(
          (choice) =>
            choice.value.mateId === selection.id &&
            choice.value.assemblyId === assembly?.id
        )?.value
      : undefined;
  return {
    key,
    kind: "revoluteMate",
    title: "Revolute Mate",
    initialDraft: existing ?? {
      id: "",
      name: "Revolute",
      assemblyId: assembly?.id ?? "",
      primary: defaultAssemblyFrame(primaryId),
      secondary: defaultAssemblyFrame(secondaryId),
      angleDegrees: 0,
      offset: 0
    },
    choices,
    blockedReason
  };
}
