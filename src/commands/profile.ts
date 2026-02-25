import { Command } from "commander";
import { ApiClient } from "../client.js";
import type { UserProfile, GlobalOptions } from "../types.js";
import * as out from "../output.js";

export function registerProfileCommand(program: Command): void {
  program
    .command("profile")
    .description("Show your user profile")
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const profile = await client.get<UserProfile>("/api/profile");

      if (globalOpts.json) {
        out.json(profile);
        return;
      }

      out.heading("Profile");
      out.table([
        ["Handle", out.bold(profile.handle || "(none)")],
        ["User ID", profile.user_id],
        ["Created", new Date(profile.created_at).toLocaleDateString()],
      ]);
    });
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not logged in. Run " + out.bold("hl auth login") + " first.");
    process.exit(1);
  }
}
