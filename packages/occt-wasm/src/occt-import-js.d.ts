declare module "occt-import-js" {
  export default function initialize(options: {
    locateFile: (name: string) => string;
  }): Promise<{
    ReadStepFile(
      bytes: Uint8Array,
      options: {
        linearUnit: string;
        linearDeflectionType: string;
        linearDeflection: number;
        angularDeflection: number;
      }
    ): {
      success: boolean;
      meshes: {
        name: string;
        attributes: { position: { array: number[] } };
        index: { array: number[] };
      }[];
    };
  }>;
}
