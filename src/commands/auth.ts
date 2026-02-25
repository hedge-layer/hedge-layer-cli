import { Command } from "commander";
import readline from "node:readline/promises";
import { loadConfig, saveConfig, clearConfig, configPath, DEFAULT_API_URL } from "../config.js";
import { ApiClient } from "../client.js";
import type { UserProfile, GlobalOptions } from "../types.js";
import * as out from "../output.js";

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage API authentication");

  auth
    .command("login")
    .description("Authenticate with a Hedge Layer API token")
    .option("--api-url <url>", "API base URL", DEFAULT_API_URL)
    .action(async (cmdOpts: { apiUrl?: string }) => {
      const globalOpts = program.opts<GlobalOptions>();

      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
      try {
        out.heading("Hedge Layer CLI — Login");
        process.stderr.write(
          `Create an API token at ${out.bold("https://hedgelayer.ai/settings")} → API Tokens\n\n`,
        );

        const token = (await rl.question("Paste your API token: ")).trim();

        if (!token.startsWith("hl_") || token.length !== 43) {
          out.error('Invalid token format. Tokens start with "hl_" and are 43 characters.');
          process.exit(1);
        }

        const apiUrl = globalOpts.apiUrl ?? cmdOpts.apiUrl ?? DEFAULT_API_URL;
        const client = new ApiClient({ token, apiUrl });

        process.stderr.write("\nValidating token...");
        let profile: UserProfile;
        try {
          profile = await client.get<UserProfile>("/api/profile");
        } catch {
          process.stderr.write("\n");
          out.error("Token validation failed. Check your token and try again.");
          process.exit(1);
        }
        process.stderr.write(" done\n\n");

        saveConfig({ api_url: apiUrl, token });

        out.success(`Logged in as ${out.bold(profile.handle || profile.user_id)}`);
        process.stderr.write(`  Config saved to ${out.dim(configPath())}\n`);
      } finally {
        rl.close();
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const config = loadConfig();
      const token = globalOpts.token ?? config.token;

      if (!token) {
        out.warn("Not logged in. Run " + out.bold("hl auth login") + " to authenticate.");
        process.exit(1);
      }

      const client = new ApiClient(globalOpts);

      try {
        const profile = await client.get<UserProfile>("/api/profile");
        if (globalOpts.json) {
          out.json({
            authenticated: true,
            handle: profile.handle,
            user_id: profile.user_id,
            api_url: client.apiUrl,
          });
        } else {
          out.heading("Auth Status");
          out.table(
            [
              ["Handle", out.bold(profile.handle || "(none)")],
              ["User ID", profile.user_id],
              ["API URL", client.apiUrl],
              ["Config", configPath()],
            ],
          );
        }
      } catch {
        out.error("Token is invalid or expired. Run " + out.bold("hl auth login") + " to re-authenticate.");
        process.exit(1);
      }
    });

  auth
    .command("logout")
    .description("Remove stored API token")
    .action(() => {
      clearConfig();
      out.success("Logged out. Token removed from " + out.dim(configPath()));
    });
}
