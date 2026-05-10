import chalk from "chalk";
import type { FeedResult, FeedResultMarket, GlobalOptions } from "./types.js";
import * as out from "./output.js";

const SORT_LABELS: Record<string, string> = {
  score: "attention score",
  volume: "24h volume",
  liquidity: "liquidity",
  movement: "price movement",
  spread: "spread tightness",
  recency: "recency",
  extremity: "uncertainty",
  rewards: "rewards",
  rewardYield: "reward yield (per $ liq)",
  horizon: "time to resolution",
};

function scoreBar(score: number): string {
  const width = 15;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 70 ? chalk.green : score >= 45 ? chalk.yellow : chalk.dim;
  return color("█".repeat(filled)) + chalk.dim("░".repeat(empty)) + ` ${Math.round(score)}`;
}

export function displayFeedResult(feed: FeedResult, globalOpts: GlobalOptions): void {
  if (globalOpts.json) {
    out.json(feed);
    return;
  }

  const sortLabel = SORT_LABELS[feed.sortedBy] ?? feed.sortedBy;
  out.heading(`Market Feed — ${feed.marketsReturned} markets by ${sortLabel}`);
  process.stdout.write(
    chalk.dim(
      `  ${feed.totalScanned.toLocaleString()} scanned · ${feed.totalAfterFilter.toLocaleString()} after filters · preset ${feed.preset}\n\n`,
    ),
  );

  if (feed.markets.length === 0) {
    out.warn("No markets matched the criteria.");
    return;
  }

  const rows = feed.markets.map((m: FeedResultMarket) => {
    const prob = out.percent(m.yesPrice);
    const change = m.oneDayPriceChange;
    const changeStr =
      change > 0
        ? chalk.green(`+${(change * 100).toFixed(1)}%`)
        : change < 0
          ? chalk.red(`${(change * 100).toFixed(1)}%`)
          : chalk.dim("0.0%");
    return [
      String(m.rank),
      out.truncate(m.question, 42),
      prob,
      String(Math.round(m.score)),
      out.compactCurrency(m.volume24h),
      out.compactCurrency(m.liquidity),
      changeStr,
    ];
  });

  out.table(rows, ["#", "Market", "Prob", "Score", "24h Vol", "Liq", "Chg"]);

  process.stdout.write("\n");
  for (const m of feed.markets.slice(0, 5)) {
    const url = m.polymarketUrl;
    process.stdout.write("  " + chalk.dim("▸ ") + out.truncate(m.question, 55) + "\n");
    process.stdout.write("    " + chalk.dim("Score: ") + scoreBar(m.score) + "  ");
    process.stdout.write(chalk.dim("Spread: ") + m.spread.toFixed(3) + "  ");
    if (m.rewardsDailyRate > 0) {
      process.stdout.write(chalk.dim("Rewards: ") + `$${m.rewardsDailyRate.toFixed(2)}/day`);
    }
    process.stdout.write("\n");
    process.stdout.write("    " + chalk.dim("Polymarket: ") + url + "\n");
  }

  if (feed.markets.length > 5) {
    process.stdout.write(chalk.dim(`\n  … and ${feed.markets.length - 5} more\n`));
  }
}
