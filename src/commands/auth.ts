import { Command } from "commander";
import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { saveConfig, clearConfig, configPath } from "../config.js";
import { ApiClient } from "../client.js";
import type { GlobalOptions } from "../types.js";
import { json } from "../output.js";

interface HiddenPromptOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  createInterface?: typeof readline.createInterface;
}

export async function promptHidden(
  prompt: string,
  options: HiddenPromptOptions = {},
): Promise<string> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stderr;
  const createInterface = options.createInterface ?? readline.createInterface;
  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({
    input,
    output: mutedOutput,
    terminal: Boolean((input as NodeJS.ReadStream).isTTY),
  });

  output.write(prompt);
  try {
    return (await rl.question("")).trim();
  } finally {
    output.write("\n");
    rl.close();
  }
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage API authentication");

  auth.command("login")
    .description("Validate and save an API token (hidden prompt, --token, or HL_TOKEN)")
    .action(async () => {
      const options = program.opts<GlobalOptions>();
      let token = options.token ?? process.env.HL_TOKEN;
      if (token === undefined) {
        if (!process.stdin.isTTY) {
          throw new Error("Interactive login requires a terminal. Set HL_TOKEN for scripts.");
        }
        process.stderr.write("Create an API token in Hedge Layer account settings.\n");
        token = await promptHidden("Paste your API token: ");
      }
      token = token.trim();
      if (!token) throw new Error("API token cannot be empty.");
      const client = new ApiClient({ ...options, token });
      await client.listTools();
      saveConfig({ api_url: client.apiUrl, token });
      json({ authenticated: true, api_url: client.apiUrl, config: configPath() });
    });

  auth.command("status")
    .description("Validate the current API token")
    .action(async () => {
      const client = new ApiClient(program.opts<GlobalOptions>());
      if (!client.isAuthenticated) {
        throw new Error("No API token configured. Run hl auth login or set HL_TOKEN.");
      }
      await client.listTools();
      json({ authenticated: true, api_url: client.apiUrl });
    });

  auth.command("logout")
    .description("Remove the saved API token (HL_TOKEN and --token still apply)")
    .action(() => {
      clearConfig();
      json({ removed: true, config: configPath() });
    });
}
