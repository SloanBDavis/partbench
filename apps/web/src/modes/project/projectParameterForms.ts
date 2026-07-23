import type {
  CadParameterSnapshot,
  ProjectParameterEvaluationQueryResponse
} from "@web-cad/cad-protocol";
import type { ParameterCreateForm, ParameterEditForm } from "../../cadCommands";

export function createParameterEditForm(
  parameter: CadParameterSnapshot | undefined
): ParameterEditForm {
  return {
    name: parameter?.name ?? "",
    value: parameter?.value ?? 1,
    expression: parameter?.expression ?? "",
    description: parameter?.description ?? ""
  };
}

export function getCreateParameterIssue(
  form: ParameterCreateForm
): string | undefined {
  if (!form.name.trim()) {
    return "Enter a parameter name.";
  }
  return Number.isFinite(form.value) ? undefined : "Enter a finite value.";
}

export function getEditParameterIssue(
  form: ParameterEditForm
): string | undefined {
  if (!form.name.trim()) {
    return "Enter a parameter name.";
  }
  return form.expression.trim() || Number.isFinite(form.value)
    ? undefined
    : "Enter a finite value or an expression.";
}

export function getParameterExpressionStatus(
  parameter: CadParameterSnapshot,
  evaluation: ProjectParameterEvaluationQueryResponse | undefined
): string {
  if (!parameter.expression) {
    return "Literal";
  }
  const node = evaluation?.nodes.find(
    (candidate) => candidate.parameterId === parameter.id
  );
  if (!node) {
    return "Not checked";
  }
  if (
    node.diagnostics.some(
      (item) => item.code === "PARAMETER_CIRCULAR_REFERENCE"
    )
  ) {
    return "Circular reference";
  }
  return node.diagnostics.length > 0 ? "Invalid" : "Valid";
}
