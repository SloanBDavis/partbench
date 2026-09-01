# Add a CADOps command

Add a command in this order. Do not skip a package.

1. `cad-protocol` — typed op and query schemas.
2. `cad-core` — eligibility, one transaction, structured semantic diff.
3. `apps/web` — Apply the same batch. React does not invent topology.
4. `agent-adapter` — pass the same CADOps through.
5. `mcp-adapter` — pass-through only. Do not add a new MCP tool.
6. One focused test for the command.

Human UI, scripts, tests, and MCP submit the same CADOps. The browser
does not invent a second command path.
