export interface CliOptions {
  readonly headless: boolean;
  readonly workspace: string;
  readonly help: boolean;
}

export function parseCliOptions(
  args: readonly string[],
  cwd = process.cwd()
): CliOptions {
  let headless = false;
  let workspace: string | undefined;
  let help = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--headless") headless = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--workspace") {
      const value = args[++index];
      if (!value || value.startsWith("--"))
        throw new Error("--workspace requires an existing directory path.");
      workspace = value;
    } else throw new Error(`Unknown option: ${arg}. Use --help for usage.`);
  }
  if (workspace && !headless)
    throw new Error("--workspace is available with --headless.");
  return { headless, workspace: workspace ?? cwd, help };
}

export const CLI_HELP = `Partbench MCP server (line-delimited JSON-RPC)

  node dist/stdio.js                         Connect an interactive browser
  node dist/stdio.js --headless               Run exact CAD without a browser
  node dist/stdio.js --headless --workspace DIR

Headless file access is confined to DIR (default: current directory).
DIR and any output subdirectories must already exist. Start with
cad.session_info, then cad.batch / cad.project_structure / cad.body_mass_properties.
Save .wcad with cad.project_save; write STEP with cad.project_export_file.
All protocol responses go to stdout; launcher diagnostics go to stderr.
`;
