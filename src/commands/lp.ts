import { Command, InvalidArgumentError } from "commander";
import { writeFile } from "node:fs/promises";
import { ApiClient } from "../client.js";
import {
  displayLpEvaluateResult,
  displayLpRecommendResult,
  displayLpRunResult,
  displayLpScanResult,
} from "../lp-display.js";
import type {
  GlobalOptions,
  LpEvaluateResponse,
  LpRecommendResponse,
  LpRunResponse,
  LpScanResponse,
} from "../types.js";
import * as out from "../output.js";

interface LpScanOpts {
  profile?: string;
  sortBy?: string;
  tag?: string;
  minVolume?: number;
  minLiquidity?: number;
  maxLiquidity?: number;
  minRewardsDailyRate?: number;
  minDaysToEnd?: number;
  maxDaysToEnd?: number;
  maxMarketAgeHours?: number;
  liquidProfile?: string;
  limit?: number;
  strategyId?: string;
  output?: string;
}

interface LpRecommendOpts {
  strategyId?: string;
  scanId?: string;
  limit?: number;
  syncPnl?: boolean;
  output?: string;
}

interface LpEvaluateOpts {
  strategyId?: string;
  walletAddress?: string;
  syncPnl?: boolean;
  limit?: number;
  output?: string;
}

interface LpRunOpts {
  strategyId?: string;
  limit?: number;
  syncPnl?: boolean;
  output?: string;
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

function compact<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""),
  ) as T;
}

async function writeArtifact(path: string | undefined, data: unknown, jsonMode: boolean): Promise<void> {
  if (!path) return;
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  if (!jsonMode) {
    process.stderr.write(out.dim(`  Saved artifact to ${path}\n`));
  }
}

export function buildLpScanPayload(topic: string | undefined, opts: LpScanOpts) {
  return compact({
    topic: topic?.trim() || undefined,
    strategyId: opts.strategyId,
    profile: opts.profile,
    sortBy: opts.sortBy,
    tag: opts.tag,
    minVolume: opts.minVolume,
    minLiquidity: opts.minLiquidity,
    maxLiquidity: opts.maxLiquidity,
    minRewardsDailyRate: opts.minRewardsDailyRate,
    minDaysToEnd: opts.minDaysToEnd,
    maxDaysToEnd: opts.maxDaysToEnd,
    maxMarketAgeHours: opts.maxMarketAgeHours,
    liquidProfile: opts.liquidProfile,
    limit: opts.limit,
  });
}

export function buildLpRecommendPayload(opts: LpRecommendOpts) {
  return compact({
    strategyId: opts.strategyId,
    scanId: opts.scanId,
    limit: opts.limit,
    syncPnl: opts.syncPnl,
  });
}

export function buildLpEvaluatePayload(opts: LpEvaluateOpts) {
  return compact({
    strategyId: opts.strategyId,
    walletAddress: opts.walletAddress,
    syncPnl: opts.syncPnl,
    limit: opts.limit,
  });
}

export function buildLpRunPayload(opts: LpRunOpts) {
  return compact({
    strategyId: opts.strategyId,
    limit: opts.limit,
    syncPnl: opts.syncPnl,
  });
}

export function registerLpCommands(program: Command): void {
  const lp = program
    .command("lp")
    .description("Run persisted liquidity-provider scan, recommendation, and evaluation workflows");

  lp
    .command("scan")
    .description("Scan LP candidates and persist them as evidence")
    .argument("[topic]", "Human label for this scan, e.g. liquidity opportunities")
    .option("--profile <name>", "lp-opportunity | liquidity-provider | liquid-new-or-long", "liquidity-provider")
    .option("--sort-by <key>", "score | volume | liquidity | movement | spread | rewards | rewardYield | lpExpectedReturn | horizon")
    .option("--tag <slug>", "Polymarket category tag, e.g. crypto, politics")
    .option("--min-volume <usd>", "Minimum 24h volume (USD)", parseNonNegative)
    .option("--min-liquidity <usd>", "Minimum displayed liquidity (USD)", parseNonNegative)
    .option("--max-liquidity <usd>", "Maximum displayed liquidity (USD)", parseNonNegative)
    .option("--min-rewards-daily-rate <usd>", "Minimum LP rewards USD/day", parseNonNegative)
    .option("--min-days-to-end <n>", "Minimum days until resolution", parseNonNegative)
    .option("--max-days-to-end <n>", "Maximum days until resolution", parseNonNegative)
    .option("--max-market-age-hours <n>", "With liquid-new-or-long: max age for the new branch", parseNonNegative)
    .option("--liquid-profile <mode>", "new-or-long")
    .option("--limit <n>", "Max markets to scan/save (1-100, default 15)", parsePositiveInt, 15)
    .option("--strategy-id <uuid>", "LP strategy id")
    .option("--output <file>", "Write the evidence JSON response to a local file")
    .action(async (topic: string | undefined, opts: LpScanOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const result = await client.post<LpScanResponse>(
        "/api/lp/scan",
        buildLpScanPayload(topic, opts),
      );
      await writeArtifact(opts.output, result, Boolean(globalOpts.json));
      displayLpScanResult(result, globalOpts);
    });

  lp
    .command("recommend")
    .description("Run allocator recommendations from saved LP evidence and current allocations")
    .option("--strategy-id <uuid>", "LP strategy id")
    .option("--scan-id <uuid>", "Use candidates from a specific saved scan")
    .option("--limit <n>", "Max saved candidates to submit (1-25, default 15)", parsePositiveInt, 15)
    .option("--sync-pnl", "Refresh wallet PnL before recommending")
    .option("--output <file>", "Write the recommendation JSON response to a local file")
    .action(async (opts: LpRecommendOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const result = await client.post<LpRecommendResponse>(
        "/api/lp/recommend",
        buildLpRecommendPayload(opts),
      );
      await writeArtifact(opts.output, result, Boolean(globalOpts.json));
      displayLpRecommendResult(result, globalOpts);
    });

  lp
    .command("evaluate")
    .description("Evaluate LP performance and return compact lessons")
    .option("--strategy-id <uuid>", "LP strategy id")
    .option("--wallet-address <address>", "Wallet address to sync PnL from")
    .option("--no-sync-pnl", "Use existing PnL snapshots without refreshing")
    .option("--limit <n>", "Max PnL snapshots to evaluate (1-100, default 50)", parsePositiveInt, 50)
    .option("--output <file>", "Write the evaluation JSON response to a local file")
    .action(async (opts: LpEvaluateOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const result = await client.post<LpEvaluateResponse>(
        "/api/lp/evaluate",
        buildLpEvaluatePayload(opts),
      );
      await writeArtifact(opts.output, result, Boolean(globalOpts.json));
      displayLpEvaluateResult(result, globalOpts);
    });

  lp
    .command("run")
    .description("Run scan, recommendation, and evaluation as one dry-run chain")
    .option("--strategy-id <uuid>", "LP strategy id")
    .option("--limit <n>", "Max candidates to scan/recommend (1-25, default 15)", parsePositiveInt, 15)
    .option("--no-sync-pnl", "Use existing PnL snapshots without refreshing")
    .option("--output <file>", "Write the chained run JSON response to a local file")
    .action(async (opts: LpRunOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const run = await client.post<LpRunResponse>(
        "/api/lp/run",
        buildLpRunPayload(opts),
      );
      let evaluation: LpEvaluateResponse | null = null;
      try {
        evaluation = await client.post<LpEvaluateResponse>("/api/lp/evaluate", {
          strategyId: run.strategyId,
          syncPnl: false,
        });
      } catch (error) {
        if (!globalOpts.json) {
          out.warn(
            `Could not load evaluation summary: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const combined = { run, evaluation };
      await writeArtifact(opts.output, combined, Boolean(globalOpts.json));
      displayLpRunResult(combined, globalOpts);
    });
}
