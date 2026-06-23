import type {
  BodyId,
  CadGeneratedReference,
  CadTopologyAnchorEntityKind,
  PartId
} from "@web-cad/cad-protocol";

import {
  createBodyGeneratedReferences,
  type GeneratedReferencesDocument
} from "./generatedReferences";

export type TopologyAnchorGeneratedReferenceResolution =
  | {
      readonly status: "resolved";
      readonly stableId: string;
      readonly reference: CadGeneratedReference;
    }
  | {
      readonly status: "missing";
    }
  | {
      readonly status: "ambiguous";
      readonly stableIds: readonly string[];
    };

export function resolveTopologyAnchorGeneratedReferenceFromSourceRole(options: {
  readonly document: GeneratedReferencesDocument;
  readonly ownerPartId: PartId;
  readonly bodyId: BodyId;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly sourceSemanticRole?: string;
}): TopologyAnchorGeneratedReferenceResolution {
  if (!options.sourceSemanticRole) {
    return { status: "missing" };
  }

  const references = createBodyGeneratedReferences(
    options.document,
    options.bodyId,
    options.ownerPartId
  );

  if (!references) {
    return { status: "missing" };
  }

  const roleKey = normalizeTopologySemanticRole(options.sourceSemanticRole);
  const candidates = [
    references.body,
    ...references.faces,
    ...references.edges,
    ...references.vertices,
    ...references.axes
  ].filter(
    (reference) =>
      reference.kind === options.entityKind &&
      createGeneratedReferenceRoleAliases(reference).some(
        (alias) => normalizeTopologySemanticRole(alias) === roleKey
      )
  );

  if (candidates.length === 1) {
    const reference = candidates[0]!;
    return {
      status: "resolved",
      stableId: reference.stableId,
      reference
    };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      stableIds: candidates.map((candidate) => candidate.stableId)
    };
  }

  return { status: "missing" };
}

function createGeneratedReferenceRoleAliases(
  reference: CadGeneratedReference
): readonly string[] {
  const roleReference = reference as CadGeneratedReference & {
    readonly role?: string;
  };

  if (!roleReference.role) {
    return [];
  }

  const role = roleReference.role;
  const humanRole = humanizeGeneratedReferenceRole(role);
  const aliases = [role, humanRole];

  if (reference.kind === "face") {
    aliases.push(`${humanRole} face`);
    if (role.startsWith("side:")) {
      const sideRole = humanizeGeneratedReferenceRole(role.slice(5));
      aliases.push(`${sideRole} side`, `${sideRole} side face`);
    }
  } else if (reference.kind === "edge") {
    aliases.push(`${humanRole} edge`);
  } else if (reference.kind === "vertex") {
    aliases.push(`${humanRole} vertex`);
  } else if (reference.kind === "axis") {
    aliases.push(`${humanRole} axis`);
  }

  return aliases;
}

function humanizeGeneratedReferenceRole(role: string): string {
  return role.replace(/:/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function normalizeTopologySemanticRole(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
