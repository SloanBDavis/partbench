export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export const corePackage: PackageInfo = {
  name: "@web-cad/cad-core",
  status: "ready"
};
