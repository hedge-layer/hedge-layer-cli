import { Command } from "commander";
import chalk from "chalk";
import { ApiClient } from "../client.js";
import { parseNdjsonStream } from "../stream.js";
import type { MarketBrief, BriefRequest, BriefRequestFilters, GlobalOptions } from "../types.js";
import * as out from "../output.js";

export function registerBriefCommands(program: Command): void {
  program
    .command("brief <query>")
    .description("Generate a Market Brief for a topic (non-interactive)")
    .option("-l, --location <location>", "Geographic context (e.g. 'Middle East', 'US')")
    .option("-t, --time-horizon <horizon>", "Time frame (e.g. '3 months', '2026')")
    .option("--tags <tags>", "Comma-separated focus area tags (e.g. 'geopolitics,energy')")
    .option("--min-volume <n>", "Minimum market volume in USD", parseFloat)
    .option("--max-yes-price <n>", "Maximum YES price (0-1)", parseFloat)
    .action(async (query: string, cmdOpts: BriefCmdOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const filters = buildFilters(cmdOpts);
      const body: BriefRequest = {
        query,
        ...(cmdOpts.location && { location: cmdOpts.location }),
        ...(cmdOpts.timeHorizon && { timeHorizon: cmdOpts.timeHorizon }),
        ...(filters && { filters }),
        stream: true,
      };

      await runStreaming(client, body, globalOpts);
    });
}

// ---------------------------------------------------------------------------
// Command option types
// ---------------------------------------------------------------------------

interface BriefCmdOpts {
  location?: string;
  timeHorizon?: string;
  tags?: string;
  minVolume?: number;
  maxYesPrice?: number;
}

function buildFilters(opts: BriefCmdOpts): BriefRequestFilters | undefined {
  const tags = opts.tags?.split(",").map((t) => t.trim()).filter(Boolean);
  const hasFilters = opts.minVolume != null || opts.maxYesPrice != null || (tags && tags.length > 0);
  if (!hasFilters) return undefined;
  return {
    ...(opts.minVolume != null && { minVolume: opts.minVolume }),
    ...(opts.maxYesPrice != null && { maxYesPrice: opts.maxYesPrice }),
    ...(tags && tags.length > 0 && { tags }),
  };
}

// ---------------------------------------------------------------------------
// Streaming mode (default)
// ---------------------------------------------------------------------------

async function runStreaming(client: ApiClient, body: BriefRequest, globalOpts: GlobalOptions): Promise<void> {
  const startTime = Date.now();
  process.stderr.write(chalk.dim(`  Generating brief for "${out.truncate(body.query, 50)}"...\n`));

  const stream = await client.streamNdjson("/api/brief", body);
  const result = await parseNdjsonStream(stream, {
    onProgress: (step, message) => {
      process.stderr.write(chalk.dim(`  [${step}] `) + message + "\n");
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result.error) {
    out.error(`Brief failed (${result.error.code}): ${result.error.message}`);
    process.exit(1);
  }

  if (!result.brief) {
    out.error("No Market Brief was produced.");
    process.exit(1);
  }

  process.stderr.write(chalk.dim(`  Done (${elapsed}s)\n\n`));
  displayBrief(result.brief as unknown as MarketBrief, globalOpts);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function displayBrief(brief: MarketBrief, globalOpts: GlobalOptions): void {
  if (globalOpts.json) {
    out.json(brief);
    return;
  }

  out.heading("Market Brief");

  process.stdout.write("  " + chalk.bold(brief.title) + "\n\n");
  process.stdout.write("  " + chalk.italic(brief.thesis) + "\n");

  if (brief.markets.length > 0) {
    process.stdout.write("\n" + chalk.bold("  Markets") + "\n\n");
    const rows = brief.markets.map((m) => {
      const prob = out.percent(m.yesPrice);
      const signals = m.signals.length > 0 ? m.signals.join(", ") : "—";
      const liq = m.liquidity ? out.currency(m.liquidity) : "—";
      return [out.truncate(m.question, 40), prob, signals, liq];
    });
    out.table(rows, ["Market", "Prob", "Signals", "Liq"]);

    process.stdout.write("\n");
    for (const m of brief.markets) {
      process.stdout.write("  " + chalk.dim("▸ ") + out.truncate(m.question, 50) + "\n");
      process.stdout.write("    " + chalk.dim("Causal link: ") + m.causalLink + "\n");
      process.stdout.write("    " + chalk.dim("Polymarket: ") + m.polymarketUrl + "\n");
    }
  }

  if (brief.gaps.length > 0) {
    process.stdout.write("\n" + chalk.bold("  Coverage Gaps") + "\n\n");
    for (const gap of brief.gaps) {
      process.stdout.write("  " + chalk.yellow("▸") + " " + gap + "\n");
    }
  }

  const marketCount = brief.marketCount ?? brief.markets.length;
  process.stdout.write("\n  " + chalk.dim(`${marketCount} markets · ${brief.gaps.length} coverage gaps`) + "\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not logged in. Run " + out.bold("hl auth login") + " first.");
    process.exit(1);
  }
}
