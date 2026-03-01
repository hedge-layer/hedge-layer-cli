import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerMarketCommands } from "./commands/markets.js";
import { registerProfileCommand } from "./commands/profile.js";
import { registerAssessCommands } from "./commands/assess.js";
import { registerHedgeCommand } from "./commands/hedge.js";
import * as out from "./output.js";

const program = new Command();

program
  .name("hl")
  .description("Hedge Layer CLI — hedge real-world risks on Polymarket")
  .version(__VERSION__)
  .option("--json", "Output as JSON (machine-readable)")
  .option("--api-url <url>", "Override API base URL")
  .option("--token <token>", "Override stored API token")
  .option("--verbose", "Show HTTP request details")
  .option("--no-color", "Disable colored output");

registerAuthCommands(program);
registerMarketCommands(program);
registerProfileCommand(program);
registerAssessCommands(program);
registerHedgeCommand(program);

program.hook("preAction", (_thisCommand, actionCommand) => {
  const opts = program.opts();
  if (opts.color === false) {
    process.env.FORCE_COLOR = "0";
  }
  // Pass verbose state down for debugging
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
