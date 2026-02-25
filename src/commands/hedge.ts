import { Command } from "commander";
import { readFileSync } from "node:fs";
import chalk from "chalk";
import { ApiClient } from "../client.js";
import type { HedgeBundle, RiskProfile, GlobalOptions } from "../types.js";
import * as out from "../output.js";

export function registerHedgeCommand(program: Command): void {
  program
    .command("hedge [file]")
    .description("Calculate hedge positions from a risk profile JSON")
    .addHelpText(
      "after",
      `
Example risk profile JSON:
  {
    "location": "33109",
    "assetType": "residential",
    "riskTypes": ["hurricane", "flood"],
    "assetValue": 500000
  }

Usage:
  hl hedge profile.json            Read from file
  echo '{"location":...}' | hl hedge -    Read from stdin`,
    )
    .action(async (file: string | undefined) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);

      let raw: string;
      if (!file || file === "-") {
        raw = await readStdin();
      } else {
        try {
          raw = readFileSync(file, "utf-8");
        } catch (e) {
          out.error(`Cannot read file: ${file} — ${e instanceof Error ? e.message : e}`);
          process.exit(1);
        }
      }

      let profile: RiskProfile;
      try {
        profile = JSON.parse(raw);
      } catch {
        out.error("Invalid JSON input. Expected a RiskProfile object.");
        process.exit(1);
      }

      if (!profile.location || !profile.assetValue || !profile.riskTypes?.length) {
        out.error("Risk profile must include location, assetValue, and at least one riskType.");
        process.exit(1);
      }

      process.stderr.write(chalk.dim("Searching markets and calculating hedge...\n"));

      const messages = [
        {
          role: "user",
          content: `I need to hedge a ${profile.assetType ?? "residential"} property worth $${profile.assetValue.toLocaleString()} in ${profile.location} against ${profile.riskTypes.join(", ")} risks. Please search for relevant markets and build a hedge bundle.`,
        },
      ];

      try {
        const stream = await client.stream("/api/chat", { messages });
        let bundleJson: Record<string, unknown> | null = null;

        const decoder = new TextDecoder();
        const reader = stream.getReader();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("d:")) continue;
            try {
              const parsed = JSON.parse(line.slice(2));
              if (parsed && typeof parsed === "object" && "positions" in parsed) {
                bundleJson = parsed as Record<string, unknown>;
              }
            } catch {
              // not JSON, skip
            }
          }
        }

        if (bundleJson) {
          displayBundle(bundleJson as unknown as HedgeBundle, globalOpts);
        } else {
          out.warn("No hedge bundle was produced. Try the interactive assessment: hl assess");
        }
      } catch (e) {
        out.error(`Hedge calculation failed: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }
    });
}

function displayBundle(bundle: HedgeBundle, globalOpts: GlobalOptions): void {
  if (globalOpts.json) {
    out.json(bundle);
    return;
  }

  out.heading("Hedge Bundle");

  out.table([
    ["Asset Value", out.currency(bundle.assetValue)],
    ["Total Cost", out.currency(bundle.totalCost)],
    ["Total Coverage", out.currency(bundle.totalCoverage)],
    ["Efficiency", out.percent(bundle.hedgeEfficiency)],
  ]);

  if (bundle.positions?.length > 0) {
    process.stdout.write("\n" + chalk.bold("  Positions") + "\n\n");
    const rows = bundle.positions.map((p) => {
      const market = p.market?.question ?? "Unknown";
      const cost = out.currency(p.estimatedCost);
      const payout = out.currency(p.potentialPayout);
      const price = p.yesPrice.toFixed(2);
      const capped = p.wasCapped ? chalk.yellow(" (capped)") : "";
      return [out.truncate(market, 40), price, cost, payout + capped];
    });
    out.table(rows, ["Market", "YES", "Cost", "Payout"]);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
