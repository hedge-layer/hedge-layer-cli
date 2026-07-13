import { Command, InvalidArgumentError } from "commander";
import { ApiClient } from "../client.js";
import {
  displayAllocatorCycleResult,
} from "../allocator-display.js";
import {
  parsePositiveNumber,
  readAllocations,
  readMarketPayload,
  readPnlContext,
} from "./allocator.js";
import type {
  GlobalOptions,
  AllocatorCycleApiResponse,
  AllocatorCycleRequest,
  AllocatorStrategyInput,
} from "../types.js";
import * as out from "../output.js";

interface LpAllocatorOpts {
  markets: string;
  allocations?: string;
  pnl?: string;
  totalHoldings?: number;
  capitalLimitPct?: number;
  perMarketLimitPct?: number;
  capitalLimit: number;
  perMarketLimit: number;
  minExpectedReturnDailyPct: number;
  maxInventoryImbalance: number;
  volatilityFillSpikeThreshold: number;
  eventNoQuoteMinutesBefore: number;
  eventNoQuoteMinutesAfter: number;
  allocatorMinLiquidity: number;
  maxSpread: number;
  allocatorMinDaysToEnd: number;
  maxMarkets: number;
  paused?: boolean;
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not authenticated. Run `hl auth login` first.");
    process.exit(1);
  }
}

function parseNonNegative(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new InvalidArgumentError("Expected a non-negative number");
  }
  return n;
}

function parsePositiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new InvalidArgumentError("Expected a positive integer");
  }
  return n;
}

function strategyFromAllocatorOptions(opts: LpAllocatorOpts): AllocatorStrategyInput {
  return {
    id: "cli-lp-allocator",
    name: "CLI LP allocator dry run",
    status: opts.paused ? "paused" : "dry_run",
    ...(opts.totalHoldings !== undefined && { total_holdings: opts.totalHoldings }),
    ...(opts.capitalLimitPct !== undefined && { capital_limit_pct: opts.capitalLimitPct }),
    ...(opts.perMarketLimitPct !== undefined && { per_market_limit_pct: opts.perMarketLimitPct }),
    capital_limit: opts.capitalLimit,
    per_market_limit: opts.perMarketLimit,
    min_expected_return_daily_pct: opts.minExpectedReturnDailyPct,
    max_inventory_imbalance: opts.maxInventoryImbalance,
    volatility_fill_spike_threshold: opts.volatilityFillSpikeThreshold,
    event_no_quote_minutes_before: opts.eventNoQuoteMinutesBefore,
    event_no_quote_minutes_after: opts.eventNoQuoteMinutesAfter,
    min_liquidity: opts.allocatorMinLiquidity,
    max_spread: opts.maxSpread,
    min_days_to_end: opts.allocatorMinDaysToEnd,
    max_markets: opts.maxMarkets,
  };
}

function validateAllocatorPercentageSizing(opts: LpAllocatorOpts): void {
  const usesPercentageSizing =
    opts.capitalLimitPct !== undefined || opts.perMarketLimitPct !== undefined;
  if (usesPercentageSizing && opts.totalHoldings === undefined) {
    out.error(
      "Percentage sizing requires --total-holdings so the allocator can convert percentages into dollar caps.",
    );
    process.exit(1);
  }
}

async function runAllocatorCycle(
  client: ApiClient,
  payload: AllocatorCycleRequest,
): Promise<AllocatorCycleApiResponse> {
  return client.post<AllocatorCycleApiResponse>("/api/lp/allocator", payload);
}

export function registerLpCommands(program: Command): void {
  const lp = program
    .command("lp")
    .description("Generate dry-run liquidity-provider allocation plans");

  lp
    .command("allocator")
    .description("Run the allocator agent on an explicit market list")
    .requiredOption("--markets <file>", "Candidate market JSON array or { markets }; use '-' to read stdin")
    .option("--allocations <file>", "Existing allocations JSON array or { allocations }; use '-' to read stdin")
    .option("--pnl <file>", "Per-market PnL context JSON array or { pnl_context } (external wallet/inventory export); use '-' to read stdin")
    .option("--total-holdings <usd>", "Total holdings / portfolio value used for percentage sizing", parsePositiveNumber)
    .option("--capital-limit-pct <pct>", "Portfolio-level allocation cap as a percent of total holdings", parsePositiveNumber)
    .option("--per-market-limit-pct <pct>", "Per-market target cap as a percent of total holdings", parsePositiveNumber)
    .option("--capital-limit <usd>", "Portfolio capital limit for this allocator request", parseNonNegative, 500)
    .option("--per-market-limit <usd>", "Per-market target cap", parseNonNegative, 100)
    .option("--min-expected-return-daily-pct <pct>", "Minimum expected daily return percent", parseNonNegative, 0.02)
    .option("--max-inventory-imbalance <ratio>", "Maximum inventory imbalance", parseNonNegative, 0.25)
    .option("--volatility-fill-spike-threshold <ratio>", "Fill-rate imbalance that switches quotes to defensive mode", parseNonNegative, 0.35)
    .option("--event-no-quote-minutes-before <n>", "No-quote window before scheduled events", parseNonNegative, 60)
    .option("--event-no-quote-minutes-after <n>", "No-quote window after scheduled events", parseNonNegative, 30)
    .option("--allocator-min-liquidity <usd>", "Allocator safety gate: minimum market liquidity", parseNonNegative, 500)
    .option("--max-spread <ratio>", "Allocator safety gate: maximum spread", parseNonNegative, 0.12)
    .option("--allocator-min-days-to-end <n>", "Allocator safety gate: minimum days to resolution", parseNonNegative, 3)
    .option("--max-markets <n>", "Maximum markets allocator may target", parsePositiveInt, 5)
    .option("--paused", "Send strategy status paused instead of dry_run")
    .action(async (opts: LpAllocatorOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);
      validateAllocatorPercentageSizing(opts);

      const markets = await readMarketPayload(opts.markets);
      if (!markets || markets.length === 0) {
        out.error("Markets JSON must include at least one market.");
        process.exit(1);
      }

      if (opts.allocations === "-" && opts.pnl === "-") {
        out.error("Only one of --allocations and --pnl can read from stdin.");
        process.exit(1);
      }

      const pnlContext = await readPnlContext(opts.pnl);
      const payload: AllocatorCycleRequest = {
        strategy: strategyFromAllocatorOptions(opts),
        markets,
        allocations: await readAllocations(opts.allocations),
        ...(pnlContext.length > 0 && { pnl_context: pnlContext }),
      };

      if (!globalOpts.json) {
        process.stderr.write(
          out.dim(`  Running allocator dry-run on ${markets.length} provided candidates...\n`),
        );
      }

      const response = await runAllocatorCycle(client, payload);
      if (globalOpts.json) {
        out.json(response);
      } else {
        displayAllocatorCycleResult(response.result ?? {}, globalOpts);
      }
    });

}
