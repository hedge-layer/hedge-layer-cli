import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerBriefCommands } from "./commands/brief.js";

import { registerProfileCommand } from "./commands/profile.js";
import { registerResearchCommands } from "./commands/research.js";
import { registerFeedCommand } from "./commands/feed.js";
import { registerAllocatorCommands } from "./commands/allocator.js";
import { registerLpCommands } from "./commands/lp.js";
import * as out from "./output.js";

const program = new Command();

program
  .name("hl")
  .description("Hedge Layer CLI — prediction market intelligence from the terminal")
  .version(__VERSION__)
  .option("--json", "Output as JSON (machine-readable)")
  .option("--api-url <url>", "Override API base URL")
  .option("--token <token>", "Override stored API token")
  .option("--verbose", "Show HTTP request details")
  .option("--no-color", "Disable colored output");

registerAuthCommands(program);
registerBriefCommands(program);

registerProfileCommand(program);
registerResearchCommands(program);
registerFeedCommand(program);
registerLpCommands(program);
registerAllocatorCommands(program);

program.hook("preAction", (_thisCommand, actionCommand) => {
  const opts = program.opts();
  if (opts.color === false) {
    process.env.FORCE_COLOR = "0";
  }
  if (opts.verbose) {
    const cmdName = actionCommand.name();
    process.stderr.write(out.dim(`[verbose] Running: hl ${cmdName}\n`));
  }
});

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    if (e instanceof Error && e.message.includes("API error")) {
      out.error(e.message);
    } else {
      out.error(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
      if (program.opts().verbose) {
        console.error(e);
      }
    }
    process.exit(1);
  }
}

main();
