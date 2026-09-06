import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerToolCommands } from "./commands/tools.js";

export function createProgram(version: string): Command {
  const program = new Command()
    .name("hl")
    .description("Hedge Layer — unified financial data and execution over HTTP. Results are JSON.")
    .version(version)
    .option("--api-url <url>", "API origin (or HL_API_URL)")
    .option("--token <token>", "API token (or HL_TOKEN)")
    .option("--verbose", "Log HTTP method, URL, and status to stderr");

  registerAuthCommands(program);
  registerToolCommands(program);
  return program;
}
