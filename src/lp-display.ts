import chalk from "chalk";
import { displayAllocatorCycleResult } from "./allocator-display.js";
import type {
  GlobalOptions,
  LpEvaluateResponse,
  LpRecommendResponse,
  LpRunResponse,
  LpScanResponse,
} from "./types.js";
import * as out from "./output.js";

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function signedCurrency(value: number): string {
  const formatted = out.currency(Math.abs(value));
  if (value > 0) return chalk.green(`+${formatted}`);
  if (value < 0) return chalk.yellow(`-${formatted}`);
  return chalk.dim("$0.00");
}

function actionSummary(actions: Record<string, unknown> | undefined): string {
  if (!actions) return "none";
  return Object.entries(actions)
    .filter(([, count]) => num(count) > 0)
    .map(([action, count]) => `${action}:${num(count)}`)
    .join(" ");
}

export function displayLpScanResult(result: LpScanResponse, globalOpts: GlobalOptions): void {
  if (globalOpts.json) {
    out.json(result);
    return;
  }

  out.heading("LP Scan");
  process.stdout.write(
    chalk.dim(
      `  scan ${result.scanId} · strategy ${result.strategyId} · ${result.evidenceSaved} evidence rows saved\n`,
    ),
  );
  process.stdout.write(
    chalk.dim(
      `  ${result.totalScanned.toLocaleString()} scanned · ${result.totalAfterFilter.toLocaleString()} after filters · profile ${result.profile}\n\n`,
    ),
  );

  if (result.markets.length === 0) {
    out.warn("No markets matched the LP scan.");
    return;
  }

  out.table(
    result.markets.slice(0, 10).map((market) => [
      String(market.rank),
      out.truncate(market.question, 46),
      String(Math.round(num(market.score))),
      out.compactCurrency(num(market.liquidity)),
      out.compactCurrency(num(market.rewardsDailyRate)) + "/day",
      `${num(market.lpExpectedReturnDailyPct).toFixed(3)}%`,
    ]),
    ["#", "Market", "Score", "Liq", "Rewards", "Exp/day"],
  );
}

export function displayLpRecommendResult(
  result: LpRecommendResponse,
  globalOpts: GlobalOptions,
): void {
  if (globalOpts.json) {
    out.json(result);
    return;
  }

  out.heading("LP Recommendations");
  process.stdout.write(
    chalk.dim(
      `  cycle ${result.cycleId} · strategy ${result.strategyId} · ${result.candidatesSubmitted} markets · ${result.allocationsSubmitted} current allocations\n`,
    ),
  );
  process.stdout.write(
    chalk.dim(
      `  PnL context ${result.pnlContextCount} rows${result.pnlSynced ? " · synced" : ""} · approvals required\n\n`,
    ),
  );
  displayAllocatorCycleResult(result.result ?? { decisions: result.decisions }, globalOpts);
}

export function displayLpEvaluateResult(
  result: LpEvaluateResponse,
  globalOpts: GlobalOptions,
): void {
  if (globalOpts.json) {
    out.json(result);
    return;
  }

  out.heading("LP Evaluation");
  process.stdout.write(
    chalk.dim(
      `  strategy ${result.strategyId} · ${result.summary.snapshots} snapshots · ${result.summary.markets} markets`,
    ),
  );
  if (result.pnlSynced) process.stdout.write(chalk.dim(" · synced"));
  process.stdout.write("\n\n");
  if (result.syncError) out.warn(result.syncError);

  out.table(
    [
      ["Realized PnL", signedCurrency(result.summary.realizedPnl)],
      ["Unrealized PnL", signedCurrency(result.summary.unrealizedPnl)],
      ["Net PnL", signedCurrency(result.summary.netPnl)],
      ["Capital locked", out.currency(result.summary.capitalLocked)],
      ["Current value", out.currency(result.summary.currentValue)],
      ["Outcomes", actionSummary(result.summary.outcomes)],
    ],
  );

  if (result.lessons.length === 0) {
    out.warn("No PnL lessons available yet.");
    return;
  }

  process.stdout.write("\n");
  out.table(
    result.lessons.slice(0, 8).map((lesson) => [
      out.truncate(String(lesson.market_slug ?? "portfolio"), 26),
      String(lesson.outcome ?? "flat"),
      signedCurrency(num(lesson.net_pnl)),
      out.truncate(String(lesson.lesson ?? "no lesson"), 64),
    ]),
    ["Market", "Outcome", "Net", "Lesson"],
  );
}

export function displayLpRunResult(
  result: { run: LpRunResponse; evaluation?: LpEvaluateResponse | null },
  globalOpts: GlobalOptions,
): void {
  if (globalOpts.json) {
    out.json(result);
    return;
  }

  out.heading("LP Run");
  process.stdout.write(
    chalk.dim(
      `  cycle ${result.run.cycleId} · scan ${result.run.scanId ?? "n/a"} · strategy ${result.run.strategyId}\n`,
    ),
  );
  process.stdout.write(
    chalk.dim(
      `  ${result.run.opportunitiesFound} opportunities · PnL ${result.run.pnlSynced ? "synced" : "not synced"} · approvals required\n\n`,
    ),
  );
  displayAllocatorCycleResult(result.run.result, globalOpts);

  if (result.evaluation) {
    process.stdout.write("\n");
    process.stdout.write(
      chalk.dim(
        `  Evaluation: ${signedCurrency(result.evaluation.summary.netPnl)} net PnL across ${result.evaluation.summary.markets} markets\n`,
      ),
    );
  }
}
