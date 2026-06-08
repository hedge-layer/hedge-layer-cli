import chalk from "chalk";
import type {
  GlobalOptions,
  SignalAnalysis,
  SignalAnalysisApiResponse,
  SignalAnalysisItem,
  SignalAnalysisResult,
} from "./types.js";
import * as out from "./output.js";

function pctFromSignalValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatProbability(value: number | null | undefined): string {
  const pct = pctFromSignalValue(value);
  return pct === null ? "n/a" : `${pct.toFixed(1)}%`;
}

function formatGap(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  const points = Math.abs(value) <= 1 ? value * 100 : value;
  const formatted = `${points >= 0 ? "+" : ""}${points.toFixed(1)}pp`;
  if (points > 0) return chalk.green(formatted);
  if (points < 0) return chalk.red(formatted);
  return chalk.dim(formatted);
}

function formatStrength(value: string | undefined): string {
  if (value === "strong") return chalk.green("strong");
  if (value === "weak") return chalk.yellow("weak");
  return value ? chalk.dim(value) : "n/a";
}

function analysisItems(result: SignalAnalysisResult | undefined): SignalAnalysisItem[] {
  if (!result) return [];
  if (result.analysis) return [result];
  return result.analyses ?? [];
}

function titleFor(analysis: SignalAnalysis): string {
  return analysis.market_name || analysis.market_slug || "market";
}

export function displaySignalAnalysis(
  response: SignalAnalysisApiResponse,
  globalOpts: GlobalOptions,
): void {
  if (globalOpts.json) {
    out.json(response);
    return;
  }

  if (response.error) {
    out.error(response.error);
    return;
  }

  const result = response.result;
  if (result?.error) {
    out.error(result.error);
    return;
  }

  const items = analysisItems(result);
  if (items.length === 0) {
    out.warn("No signal analysis returned.");
    return;
  }

  out.heading(
    items.length === 1
      ? "Signal Analysis"
      : `Signal Analysis — ${items.length} markets`,
  );

  const rows = items.map((item) => {
    const analysis = item.analysis ?? {};
    return [
      out.truncate(titleFor(analysis), 44),
      formatProbability(analysis.current_yes_prob),
      formatProbability(analysis.predicted_prob),
      formatGap(analysis.probability_gap),
      formatStrength(analysis.signal_strength),
      analysis.confidence ?? "n/a",
    ];
  });
  out.table(rows, ["Market", "Market YES", "Agent YES", "Gap", "Signal", "Conf"]);

  for (const item of items.slice(0, 3)) {
    const analysis = item.analysis;
    if (!analysis) continue;
    process.stdout.write("\n  " + chalk.bold(out.truncate(titleFor(analysis), 76)) + "\n");
    if (analysis.market_link) {
      process.stdout.write("  " + chalk.dim("Polymarket: ") + analysis.market_link + "\n");
    }
    if (analysis.key_factors && analysis.key_factors.length > 0) {
      process.stdout.write("  " + chalk.dim("Key factors: ") + analysis.key_factors.slice(0, 4).join("; ") + "\n");
    }
    if (analysis.research_findings) {
      process.stdout.write(
        "  " + chalk.dim("Research: ") + out.truncate(analysis.research_findings, 180) + "\n",
      );
    }
  }

  if (items.length > 3) {
    process.stdout.write(chalk.dim(`\n  ... and ${items.length - 3} more\n`));
  }

  if (result?.strong_signal_count !== undefined) {
    process.stdout.write(
      chalk.dim(`\n  Strong signals: ${result.strong_signal_count}\n`),
    );
  }
}
