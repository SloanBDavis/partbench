export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export const rendererPackage: PackageInfo = {
  name: "@web-cad/renderer",
  status: "ready"
};
