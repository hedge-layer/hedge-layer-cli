import { Command, InvalidArgumentError } from "commander";
import { readFile } from "node:fs/promises";
import chalk from "chalk";
import { ApiClient } from "../client.js";
import {
  allocationsFromDecisions,
  displayAllocatorCycleResult,
  feedMarketsToAllocatorMarkets,
} from "../allocator-display.js";
import type {
  AllocatorAllocationInput,
  AllocatorCycleApiResponse,
  AllocatorCycleRequest,
  AllocatorMarketInput,
  AllocatorStrategyInput,
  FeedResult,
  GlobalOptions,
} from "../types.js";
import * as out from "../output.js";

const PROFILE_CHOICES = ["lp-opportunity", "liquidity-provider", "liquid-new-or-long"] as const;

interface AllocatorCycleOpts {
  profile?: string;
  sortBy?: string;
  tag?: string;
  minVolume?: string;
  minLiquidity?: string;
  maxLiquidity?: string;
  minRewardsDailyRate?: string;
  minDaysToEnd?: string;
  maxDaysToEnd?: string;
  maxMarketAgeHours?: string;
  liquidProfile?: string;
  limit: string;
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
  markets?: string;
  allocations?: string;
  repeat?: boolean;
  paused?: boolean;
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not authenticated. Run `hl auth login` first.");
    process.exit(1);
  }
}

function isProfile(s: string | undefined): s is (typeof PROFILE_CHOICES)[number] {
  return s !== undefined && (PROFILE_CHOICES as readonly string[]).includes(s);
}

function parseNonNegative(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new InvalidArgumentError("Expected a non-negative number");
  }
  return n;
}

export function parsePositiveNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvalidArgumentError("Expected a positive number");
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

function maybeAdd(entries: [string, string][], key: string, value: string | undefined): void {
  if (value !== undefined && value !== "") entries.push([key, value]);
}

function feedQueryParams(profile: string | undefined, opts: AllocatorCycleOpts): Record<string, string> {
  const entries: [string, string][] = [];
  maybeAdd(entries, "profile", profile);
  maybeAdd(entries, "sortBy", opts.sortBy);
  maybeAdd(entries, "tag", opts.tag);
  maybeAdd(entries, "minVolume", opts.minVolume);
  maybeAdd(entries, "minLiquidity", opts.minLiquidity);
  maybeAdd(entries, "maxLiquidity", opts.maxLiquidity);
  maybeAdd(entries, "minRewardsDailyRate", opts.minRewardsDailyRate);
  maybeAdd(entries, "minDaysToEnd", opts.minDaysToEnd);
  maybeAdd(entries, "maxDaysToEnd", opts.maxDaysToEnd);
  maybeAdd(entries, "maxMarketAgeHours", opts.maxMarketAgeHours);
  maybeAdd(entries, "liquidProfile", opts.liquidProfile);
  maybeAdd(entries, "limit", opts.limit);
  return Object.fromEntries(entries);
}

function strategyFromOptions(opts: AllocatorCycleOpts): AllocatorStrategyInput {
  return {
    id: "cli-dry-run",
    name: "CLI dry-run LP strategy",
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

function validatePercentageSizing(opts: AllocatorCycleOpts): void {
  const usesPercentageSizing =
    opts.capitalLimitPct !== undefined || opts.perMarketLimitPct !== undefined;
  if (usesPercentageSizing && opts.totalHoldings === undefined) {
    out.error(
      "Percentage sizing requires --total-holdings so the allocator can convert percentages into dollar caps.",
    );
    process.exit(1);
  }
}

export async function readAllocations(path: string | undefined): Promise<AllocatorAllocationInput[]> {
  if (!path) return [];
  const raw = path === "-" ? await readStdin() : await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Allocations JSON must be an array");
  }
  return parsed as AllocatorAllocationInput[];
}

export async function readMarketPayload(path: string | undefined): Promise<AllocatorMarketInput[] | undefined> {
  if (!path) return undefined;
  const raw = path === "-" ? await readStdin() : await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as AllocatorMarketInput[];
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { markets?: unknown }).markets)) {
    return (parsed as { markets: AllocatorMarketInput[] }).markets;
  }
  throw new Error("Markets JSON must be an array or { markets: [...] }");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function runAllocatorCycle(
  client: ApiClient,
  payload: AllocatorCycleRequest,
): Promise<AllocatorCycleApiResponse> {
  return client.post<AllocatorCycleApiResponse>("/api/allocator/cycle", payload);
}

export function registerAllocatorCommands(program: Command): void {
  const allocator = program
    .command("allocator")
    .description("Run dry-run liquidity allocation cycles");

  allocator
    .command("cycle")
    .description("Run a dry-run allocator cycle from explicit markets or /api/feed candidates")
    .argument(
      "[screening]",
      `Optional screening preset: ${PROFILE_CHOICES.join(" | ")} (same as --profile)`,
      "lp-opportunity",
    )
    .option("--profile <name>", `Screening defaults: ${PROFILE_CHOICES.join(", ")}`)
    .option("--sort-by <key>", "score | volume | liquidity | movement | spread | rewards | rewardYield | lpExpectedReturn | horizon")
    .option("--tag <slug>", "Polymarket category tag, e.g. crypto, politics")
    .option("--min-volume <usd>", "Minimum 24h volume (USD)")
    .option("--min-liquidity <usd>", "Minimum displayed liquidity (USD)")
    .option("--max-liquidity <usd>", "Maximum displayed liquidity (USD)")
    .option("--min-rewards-daily-rate <usd>", "Minimum LP rewards USD/day")
    .option("--min-days-to-end <n>", "Feed filter: minimum days until resolution")
    .option("--max-days-to-end <n>", "Feed filter: maximum days until resolution")
    .option("--max-market-age-hours <n>", "With liquid-new-or-long: max age for the new branch")
    .option("--liquid-profile <mode>", "new-or-long (used by liquid-new-or-long screen)")
    .option("--limit <n>", "Max feed markets to fetch (1-100, default 15)", "15")
    .option("--total-holdings <usd>", "Total user holdings / portfolio value used for percentage sizing", parsePositiveNumber)
    .option("--capital-limit-pct <pct>", "Portfolio-level allocation cap as a percent of total holdings", parsePositiveNumber)
    .option("--per-market-limit-pct <pct>", "Per-market target cap as a percent of total holdings", parsePositiveNumber)
    .option("--capital-limit <usd>", "Portfolio capital limit for this cycle", parseNonNegative, 500)
    .option("--per-market-limit <usd>", "Per-market target cap", parseNonNegative, 100)
    .option("--min-expected-return-daily-pct <pct>", "Minimum expected daily return percent", parseNonNegative, 0.02)
    .option("--max-inventory-imbalance <ratio>", "Maximum inventory imbalance", parseNonNegative, 0.25)
    .option("--volatility-fill-spike-threshold <ratio>", "Fill-rate imbalance that switches quotes to defensive mode", parseNonNegative, 0.35)
    .option("--event-no-quote-minutes-before <n>", "Cancel/no-quote window before scheduled events", parseNonNegative, 60)
    .option("--event-no-quote-minutes-after <n>", "Cancel/no-quote window after scheduled events", parseNonNegative, 30)
    .option("--allocator-min-liquidity <usd>", "Allocator safety gate: minimum market liquidity", parseNonNegative, 500)
    .option("--max-spread <ratio>", "Allocator safety gate: maximum spread", parseNonNegative, 0.12)
    .option("--allocator-min-days-to-end <n>", "Allocator safety gate: minimum days to resolution", parseNonNegative, 3)
    .option("--max-markets <n>", "Maximum markets allocator may target", parsePositiveInt, 5)
    .option("--markets <file>", "Candidate market JSON array or { markets }; use '-' to read stdin")
    .option("--allocations <file>", "Existing allocations JSON array; use '-' to read stdin")
    .option("--repeat", "Run a second cycle using targets returned by the first cycle")
    .option("--paused", "Send strategy status paused instead of dry_run")
    .action(async (screening: string | undefined, o: AllocatorCycleOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);
      validatePercentageSizing(o);

      const allocations = await readAllocations(o.allocations);
      const explicitMarkets = await readMarketPayload(o.markets);
      let markets;
      let sourceLabel: string;

      if (explicitMarkets) {
        markets = explicitMarkets;
        sourceLabel = "provided";
      } else {
        let profile = o.profile ?? screening ?? "lp-opportunity";
        if (!isProfile(profile)) {
          out.error(`Unknown screening "${profile}". Use: ${PROFILE_CHOICES.join(" or ")}`);
          process.exit(1);
        }
        if (o.profile && screening && screening !== "lp-opportunity" && o.profile !== screening) {
          out.warn(`Both positional and --profile set; using --profile (${o.profile}).`);
          profile = o.profile;
        }

        const feed = await client.get<FeedResult>("/api/feed", feedQueryParams(profile, o));
        if (feed.error) {
          out.error(feed.error);
          process.exit(1);
        }
        if (feed.markets.length === 0) {
          out.warn("No feed markets matched the allocator criteria.");
          return;
        }
        markets = feedMarketsToAllocatorMarkets(feed.markets);
        sourceLabel = profile;
      }

      const payload: AllocatorCycleRequest = {
        strategy: strategyFromOptions(o),
        markets,
        allocations,
      };

      if (!globalOpts.json) {
        process.stderr.write(
          chalk.dim(
            `  Running allocator dry-run on ${markets.length} ${sourceLabel} candidates...\n`,
          ),
        );
      }

      const first = await runAllocatorCycle(client, payload);
      const firstResult = first.result ?? {};

      if (o.repeat) {
        const repeatPayload: AllocatorCycleRequest = {
          ...payload,
          allocations: allocationsFromDecisions(firstResult.decisions ?? []),
        };
        const second = await runAllocatorCycle(client, repeatPayload);
        if (globalOpts.json) {
          out.json({ initial: first, repeat: second });
        } else {
          displayAllocatorCycleResult(firstResult, globalOpts);
          process.stdout.write("\n" + chalk.bold("Repeated with target allocations") + "\n");
          displayAllocatorCycleResult(second.result ?? {}, globalOpts);
        }
        return;
      }

      if (globalOpts.json) {
        out.json(first);
      } else {
        displayAllocatorCycleResult(firstResult, globalOpts);
      }
    });
}
