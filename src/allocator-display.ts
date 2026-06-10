import chalk from "chalk";
import type {
  AllocatorAllocationInput,
  AllocatorCycleResult,
  AllocatorDecision,
  FeedResultMarket,
  GlobalOptions,
} from "./types.js";
import * as out from "./output.js";

function actionColor(action: string): string {
  switch (action) {
    case "ALLOCATE":
    case "INCREASE":
      return chalk.green(action);
    case "REDUCE":
    case "EXIT":
      return chalk.yellow(action);
    case "SKIP":
      return chalk.dim(action);
    case "WATCH":
      return chalk.cyan(action);
    default:
      return action;
  }
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function feedMarketsToAllocatorMarkets(markets: FeedResultMarket[]) {
  return markets.slice(0, 25).map((m) => {
    const probability = num(m.probability ?? m.yesPrice, 0.5);
    const daysToEnd =
      m.daysToEnd == null || m.daysToEnd === undefined ? undefined : num(m.daysToEnd);
    return {
      slug: String(m.slug ?? ""),
      question: String(m.question ?? ""),
      yesTokenId: m.yesTokenId ? String(m.yesTokenId) : undefined,
      noTokenId: m.noTokenId ? String(m.noTokenId) : undefined,
      yesPrice: num(m.yesPrice, probability),
      noPrice: num(m.noPrice, 1 - probability),
      liquidity: num(m.liquidity),
      volume24h: num(m.volume24h),
      spread: num(m.spread),
      rewardsDailyRate: num(m.rewardsDailyRate),
      oneDayPriceChange: num(m.oneDayPriceChange),
      ...(daysToEnd !== undefined && { daysToEnd }),
      active: m.active == null ? true : Boolean(m.active),
    };
  });
}

export function allocationsFromDecisions(
  decisions: AllocatorDecision[],
): AllocatorAllocationInput[] {
  return decisions
    .filter((d) => String(d.market_slug ?? ""))
    .map((d) => ({
      market_slug: String(d.market_slug),
      status: String(d.action ?? "planned").toLowerCase(),
      allocated_capital: num(d.target_capital),
      locked_capital: 0,
      inventory_yes: 0,
      inventory_no: 0,
      open_order_notional: Array.isArray(d.order_plan)
        ? d.order_plan.reduce((sum, order) => sum + num(order.notional), 0)
        : 0,
    }));
}

export function displayAllocatorCycleResult(
  result: AllocatorCycleResult,
  globalOpts: GlobalOptions,
): void {
  if (globalOpts.json) {
    out.json(result);
    return;
  }

  const decisions = Array.isArray(result.decisions) ? result.decisions : [];
  const summary = result.summary ?? {};
  const dryRun = result.dry_run === false ? "live" : "dry run";

  out.heading(`Allocator Cycle — ${dryRun}`);
  process.stdout.write(
    chalk.dim(
      `  ${num(result.total_markets, decisions.length)} markets · ${out.currency(
        num(summary.target_capital),
      )} target capital · ${num(summary.orders_planned)} planned orders · ` +
        `${num(summary.cancels_planned)} cancels · ${num(summary.hedges_planned)} hedges\n\n`,
    ),
  );

  if (decisions.length === 0) {
    out.warn("No allocator decisions returned.");
    return;
  }

  const rows = decisions.map((d) => {
    const action = String(d.action ?? "UNKNOWN");
    const score = num(d.score?.score);
    const expected = num(d.score?.expected_return_daily_pct);
    const orders = Array.isArray(d.order_plan) ? d.order_plan.length : 0;
    const cancels = Array.isArray(d.cancel_plan) ? d.cancel_plan.length : 0;
    const hedges = Array.isArray(d.hedge_plan)
      ? d.hedge_plan.filter((hedge) => hedge.status === "recommended").length
      : 0;
    const failedChecks = Array.isArray(d.safety_checks)
      ? d.safety_checks.filter((check) => check.passed === false).length
      : 0;
    return [
      out.truncate(String(d.question ?? d.market_slug ?? "—"), 42),
      actionColor(action),
      out.currency(num(d.target_capital)),
      signedCurrency(num(d.capital_delta)),
      `${expected.toFixed(3)}%`,
      regimeLabel(String(d.quote_regime ?? "—")),
      String(Math.round(score)),
      String(orders),
      cancels === 0 ? chalk.dim("0") : chalk.yellow(String(cancels)),
      hedges === 0 ? chalk.dim("0") : chalk.cyan(String(hedges)),
      failedChecks === 0 ? chalk.green("0") : chalk.yellow(String(failedChecks)),
    ];
  });

  out.table(rows, [
    "Market",
    "Action",
    "Target",
    "Delta",
    "Exp/day",
    "Regime",
    "Score",
    "Orders",
    "Cxl",
    "Hedge",
    "Fails",
  ]);

  process.stdout.write("\n");
  for (const decision of decisions.slice(0, 5)) {
    const action = String(decision.action ?? "UNKNOWN");
    process.stdout.write("  " + chalk.dim("▸ ") + out.truncate(String(decision.question ?? decision.market_slug ?? "—"), 65) + "\n");
    process.stdout.write("    " + chalk.dim("Action: ") + actionColor(action));
    if (decision.rationale) {
      process.stdout.write("  " + chalk.dim("Rationale: ") + out.truncate(decision.rationale, 120));
    }
    process.stdout.write("\n");

    const orders = Array.isArray(decision.order_plan) ? decision.order_plan : [];
    const economics = decision.economics ?? {};
    if (
      economics.realized_spread_pnl !== undefined ||
      economics.reward_income !== undefined ||
      economics.net_realized_pnl !== undefined
    ) {
      process.stdout.write(
        "    " +
          chalk.dim("Economics: ") +
          `spread ${signedCurrency(num(economics.realized_spread_pnl))}, ` +
          `rewards ${signedCurrency(num(economics.reward_income))}, ` +
          `net ${signedCurrency(num(economics.net_realized_pnl))}` +
          "\n",
      );
    }
    for (const order of orders.slice(0, 2)) {
      process.stdout.write(
        "    " +
          chalk.dim("Order: ") +
          `${String(order.side ?? "BUY")} ${String(order.outcome ?? "?")} @ ${num(order.price).toFixed(3)} ` +
          `for ${out.currency(num(order.notional))}` +
          "\n",
      );
    }
    if (orders.length > 2) {
      process.stdout.write(chalk.dim(`    … ${orders.length - 2} more orders\n`));
    }
    const cancels = Array.isArray(decision.cancel_plan) ? decision.cancel_plan : [];
    if (cancels.length > 0) {
      process.stdout.write(chalk.dim(`    Cancel: ${cancels.length} resting order intent(s)\n`));
    }
    const hedges = Array.isArray(decision.hedge_plan) ? decision.hedge_plan : [];
    for (const hedge of hedges.slice(0, 1)) {
      if (hedge.status !== "recommended") continue;
      process.stdout.write(
        "    " +
          chalk.dim("Hedge: ") +
          `${String(hedge.direction ?? "?")} ${String(hedge.instrument ?? hedge.venue ?? "?")} ` +
          `for ${out.currency(num(hedge.estimated_notional))}` +
          "\n",
      );
    }
  }

  if (decisions.length > 5) {
    process.stdout.write(chalk.dim(`\n  … and ${decisions.length - 5} more decisions\n`));
  }
}

function regimeLabel(value: string): string {
  switch (value) {
    case "reward_optimized":
      return chalk.green("reward");
    case "defensive":
      return chalk.yellow("defense");
    case "no_quote":
      return chalk.red("no quote");
    default:
      return chalk.dim(value);
  }
}

function signedCurrency(value: number): string {
  const formatted = out.currency(Math.abs(value));
  if (value > 0) return chalk.green(`+${formatted}`);
  if (value < 0) return chalk.yellow(`-${formatted}`);
  return chalk.dim("$0.00");
}
