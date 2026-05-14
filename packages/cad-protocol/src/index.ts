export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export const protocolPackage: PackageInfo = {
  name: "@web-cad/cad-protocol",
  status: "ready"
};
