import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { ApiClient } from "../client.js";
import { json } from "../output.js";
import type { GlobalOptions } from "../types.js";

interface ArgumentOptions {
  args?: string;
  file?: string;
  stdin?: boolean;
}

export async function readArguments(options: ArgumentOptions): Promise<Record<string, unknown>> {
  const sources = [options.args !== undefined, options.file !== undefined, Boolean(options.stdin)];
  if (sources.filter(Boolean).length > 1) {
    throw new Error("Use only one of --args, --file, or --stdin.");
  }
  let source = options.args ?? "{}";
  if (options.file !== undefined) source = await readFile(options.file, "utf8");
  if (options.stdin) {
    source = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) source += chunk.toString();
  }
  let args: unknown;
  try {
    args = JSON.parse(source);
  } catch {
    throw new Error("Tool arguments must be valid JSON.");
  }
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be a JSON object.");
  }
  return args as Record<string, unknown>;
}

export function registerToolCommands(program: Command): void {
  program.command("tools [name]")
    .description("List available tools and JSON Schemas, or show one tool")
    .action(async (name?: string) => {
      const catalog = await new ApiClient(program.opts<GlobalOptions>()).listTools();
      if (!name) return json(catalog);
      const tool = catalog.tools.find((tool) => tool.name === name);
      if (!tool) throw new Error(`Unknown tool: ${name}. Run hl tools to list available tools.`);
      json(tool);
    });

  program.command("call <name>")
    .description("Call a tool through the HTTP API; arguments default to {}")
    .option("--args <json>", "Tool arguments as a JSON object")
    .option("--file <path>", "Read tool arguments from a JSON file")
    .option("--stdin", "Read tool arguments from standard input")
    .action(async (name: string, options: ArgumentOptions) => {
      const args = await readArguments(options);
      const result = await new ApiClient(program.opts<GlobalOptions>()).callTool(name, args);
      json(result);
      if (result.isError) process.exitCode = 1;
    });
}
