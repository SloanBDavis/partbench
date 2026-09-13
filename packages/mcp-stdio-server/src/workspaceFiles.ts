import { randomUUID } from "node:crypto";
import {
  link,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep
} from "node:path";

export class ProjectFileError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export type ExchangeFileFormat = "step" | "dxf" | "svg";
export const WORKSPACE_FILE_LIMITS = {
  wcad: 256 * 1024 * 1024,
  step: 256 * 1024 * 1024,
  dxf: 20_000_000,
  svg: 20_000_000
} as const;
const extensions: Record<"wcad" | ExchangeFileFormat, readonly string[]> = {
  wcad: [".wcad"],
  step: [".step", ".stp"],
  dxf: [".dxf"],
  svg: [".svg"]
};

/** All file operations resolve inside one explicit existing workspace directory. */
export class WorkspaceFiles {
  private constructor(readonly root: string) {}

  static async create(directory: string): Promise<WorkspaceFiles> {
    const root = await realpath(resolve(directory));
    if (!(await stat(root)).isDirectory()) {
      throw new ProjectFileError(
        "INVALID_WORKSPACE",
        "--workspace must name an existing directory."
      );
    }
    return new WorkspaceFiles(root);
  }

  async readNative(path: string): Promise<{ path: string; bytes: Uint8Array }> {
    return this.#read(path, "wcad");
  }

  async readExchange(
    path: string,
    format?: ExchangeFileFormat
  ): Promise<{ path: string; bytes: Uint8Array; format: ExchangeFileFormat }> {
    const extension = extname(path).toLowerCase();
    const inferred = Object.entries(extensions).find(
      ([name, suffixes]) => name !== "wcad" && suffixes.includes(extension)
    )?.[0] as ExchangeFileFormat | undefined;
    if (!inferred || (format !== undefined && format !== inferred))
      throw new ProjectFileError(
        "INVALID_FILE_EXTENSION",
        "Import paths must match the requested format: .step/.stp, .dxf, or .svg. Open native .wcad projects with cad.project_open."
      );
    return { ...(await this.#read(path, inferred)), format: inferred };
  }

  async #read(
    path: string,
    format: "wcad" | ExchangeFileFormat
  ): Promise<{ path: string; bytes: Uint8Array }> {
    this.#requireExtension(path, extensions[format]);
    const canonical = await realpath(this.#resolve(path));
    this.#requireInside(canonical);
    const info = await stat(canonical);
    if (!info.isFile())
      throw new ProjectFileError(
        "NOT_A_FILE",
        "Choose an input file, not a directory."
      );
    if (info.size > WORKSPACE_FILE_LIMITS[format])
      throw new ProjectFileError(
        "FILE_TOO_LARGE",
        `${format.toUpperCase()} files must be no larger than ${WORKSPACE_FILE_LIMITS[format]} bytes.`
      );
    const bytes = await readFile(canonical);
    if (bytes.byteLength > WORKSPACE_FILE_LIMITS[format])
      throw new ProjectFileError(
        "FILE_TOO_LARGE",
        "The input file grew beyond the import size limit while it was being read."
      );
    return { path: canonical, bytes };
  }

  async outputPath(
    path: string,
    format: "wcad" | ExchangeFileFormat,
    overwrite = false
  ): Promise<string> {
    this.#requireExtension(path, extensions[format]);
    const candidate = this.#resolve(path);
    const parent = await realpath(dirname(candidate));
    this.#requireInside(parent);
    const canonical = resolve(parent, basename(candidate));
    try {
      this.#requireInside(await realpath(canonical));
      if (!overwrite)
        throw new ProjectFileError(
          "FILE_EXISTS",
          "The output file already exists. Choose another path or set overwrite: true."
        );
      if (!(await stat(canonical)).isFile())
        throw new ProjectFileError(
          "NOT_A_FILE",
          "The output path must name a file."
        );
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error;
    }
    return canonical;
  }

  async write(
    path: string,
    bytes: Uint8Array,
    overwrite = false
  ): Promise<void> {
    // Write beside the destination, then atomically publish complete file bytes.
    const temporary = resolve(dirname(path), `.partbench-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      if (overwrite) await rename(temporary, path);
      else await link(temporary, path);
    } catch (error) {
      if (hasCode(error, "EEXIST"))
        throw new ProjectFileError(
          "FILE_EXISTS",
          "The output file already exists. Choose another path or set overwrite: true."
        );
      throw error;
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  #resolve(path: string): string {
    const candidate = resolve(this.root, path);
    this.#requireInside(candidate);
    return candidate;
  }

  #requireInside(path: string): void {
    const within = relative(this.root, path);
    if (
      within === ".." ||
      within.startsWith(`..${sep}`) ||
      isAbsolute(within)
    ) {
      throw new ProjectFileError(
        "PATH_OUTSIDE_WORKSPACE",
        "Choose a file inside this session's workspace. Parent traversal and symlinks outside it are not allowed."
      );
    }
  }

  #requireExtension(path: string, extensions: readonly string[]): void {
    if (!extensions.includes(extname(path).toLowerCase())) {
      throw new ProjectFileError(
        "INVALID_FILE_EXTENSION",
        `The path must end in ${extensions.join(" or ")}.`
      );
    }
  }
}

export function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
