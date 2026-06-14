import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { ApiClient } from "../client.js";
import { displayFeedResult } from "../feed-display.js";
import type { FeedResult, FeedResultMarket, GlobalOptions } from "../types.js";
import * as out from "../output.js";

interface FeedCmdOpts {
  profile?: string;
  sortBy?: string;
  preset?: string;
  tag?: string;
  minVolume?: string;
  minLiquidity?: string;
  maxLiquidity?: string;
  minRewardsDailyRate?: string;
  minDaysToEnd?: string;
  maxDaysToEnd?: string;
  maxMarketAgeHours?: string;
  liquidProfile?: string;
  limit?: string;
}

interface FeedEnsembleOpts {
  limit?: string;
  output?: string;
}

export interface EnsembleCandidate extends FeedResultMarket {
  ensembleScore: number;
  sourceProfiles: string[];
  sourceRanks: Record<string, number>;
}

export interface FeedEnsembleResult {
  generatedAt: string;
  outputPath: string;
  totalSources: number;
  totalRawMarkets: number;
  totalCandidates: number;
  marketsReturned: number;
  candidates: EnsembleCandidate[];
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not authenticated. Run `hl auth login` first.");
    process.exit(1);
  }
}

const PROFILE_CHOICES = ["lp-opportunity", "liquidity-provider", "liquid-new-or-long"] as const;

function isProfile(s: string | undefined): s is (typeof PROFILE_CHOICES)[number] {
  return s !== undefined && (PROFILE_CHOICES as readonly string[]).includes(s);
}

export function resolveFeedProfile(
  screening: string | undefined,
  profile: string | undefined,
  warn: (message: string) => void = () => undefined,
): string | undefined {
  if (profile && !isProfile(profile)) {
    throw new Error(`Unknown feed profile "${profile}". Use: ${PROFILE_CHOICES.join(" or ")}`);
  }

  if (!screening) return profile;

  if (!isProfile(screening)) {
    throw new Error(`Unknown screening "${screening}". Use: ${PROFILE_CHOICES.join(" or ")}`);
  }

  if (profile && profile !== screening) {
    warn(`Both positional and --profile set; using --profile (${profile}).`);
    return profile;
  }

  return profile ?? screening;
}

/**
 * Build query params for GET /api/feed. Omits undefined / empty string.
 */
function feedQueryParams(opts: {
  profile?: string;
  sortBy?: string;
  preset?: string;
  tag?: string;
  minVolume?: string;
  minLiquidity?: string;
  maxLiquidity?: string;
  minRewardsDailyRate?: string;
  minDaysToEnd?: string;
  maxDaysToEnd?: string;
  maxMarketAgeHours?: string;
  liquidProfile?: string;
  limit?: string;
}): Record<string, string> {
  const entries: [string, string][] = [];
  const add = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") entries.push([k, v]);
  };
  add("profile", opts.profile);
  add("sortBy", opts.sortBy);
  add("preset", opts.preset);
  add("tag", opts.tag);
  add("minVolume", opts.minVolume);
  add("minLiquidity", opts.minLiquidity);
  add("maxLiquidity", opts.maxLiquidity);
  add("minRewardsDailyRate", opts.minRewardsDailyRate);
  add("minDaysToEnd", opts.minDaysToEnd);
  add("maxDaysToEnd", opts.maxDaysToEnd);
  add("maxMarketAgeHours", opts.maxMarketAgeHours);
  add("liquidProfile", opts.liquidProfile);
  add("limit", opts.limit);
  return Object.fromEntries(entries);
}

const ENSEMBLE_SOURCES: Array<{ name: string; params: Record<string, string> }> = [
  { name: "liquid-new-or-long", params: { profile: "liquid-new-or-long", sortBy: "liquidity" } },
  { name: "liquidity-provider", params: { profile: "liquidity-provider", sortBy: "lpExpectedReturn" } },
  { name: "lp-opportunity", params: { profile: "lp-opportunity", sortBy: "rewardYield" } },
  { name: "movement", params: { sortBy: "movement", preset: "price-movers" } },
  { name: "spread", params: { sortBy: "spread", preset: "liquidity-provider" } },
  { name: "reward-yield", params: { sortBy: "rewardYield", preset: "rewards-optimizer", minRewardsDailyRate: "0.01" } },
];

function num(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function scoreCandidate(candidate: FeedResultMarket, sourceCount: number): number {
  const liquidityScore = Math.min(25, Math.log1p(Math.max(0, candidate.liquidity)) / Math.log1p(1_000_000) * 25);
  const volumeScore = Math.min(25, Math.log1p(Math.max(0, candidate.volume24h)) / Math.log1p(1_000_000) * 25);
  const spreadScore = Math.max(0, Math.min(15, (0.12 - Math.max(0, candidate.spread)) / 0.12 * 15));
  const movementPenalty = Math.min(20, Math.abs(candidate.oneDayPriceChange) * 100);
  const days = candidate.daysToEnd ?? null;
  const horizonScore = days === null
    ? 2
    : days < 3
      ? 0
      : Math.min(10, Math.log1p(days) / Math.log1p(365) * 10);
  const rewardScore = Math.max(
    0,
    Math.min(20, num(candidate.components?.rewardYield) * 0.1 + Math.max(0, num(candidate.lpExpectedReturnDailyPct)) * 50),
  );
  const sourceScore = Math.min(16, sourceCount * 4);
  return Math.round((liquidityScore + volumeScore + spreadScore + horizonScore + rewardScore + sourceScore - movementPenalty) * 10) / 10;
}

export function buildFeedEnsemble(
  sourceResults: Array<{ source: string; result: FeedResult }>,
  limit: number,
  outputPath = "candidates.json",
  generatedAt = new Date().toISOString(),
): FeedEnsembleResult {
  const bySlug = new Map<string, EnsembleCandidate>();
  let totalRawMarkets = 0;

  for (const { source, result } of sourceResults) {
    for (const market of result.markets ?? []) {
      totalRawMarkets++;
      const existing = bySlug.get(market.slug);
      if (!existing) {
        bySlug.set(market.slug, {
          ...market,
          ensembleScore: 0,
          sourceProfiles: [source],
          sourceRanks: { [source]: market.rank },
        });
        continue;
      }

      existing.sourceProfiles.push(source);
      existing.sourceRanks[source] = market.rank;
      if (market.score > existing.score) existing.score = market.score;
      existing.volume24h = Math.max(existing.volume24h, market.volume24h);
      existing.liquidity = Math.max(existing.liquidity, market.liquidity);
      existing.rewardsDailyRate = Math.max(existing.rewardsDailyRate, market.rewardsDailyRate);
      existing.lpExpectedReturnDailyPct = Math.max(
        num(existing.lpExpectedReturnDailyPct),
        num(market.lpExpectedReturnDailyPct),
      );
      existing.lpRiskFlags = [...new Set([...(existing.lpRiskFlags ?? []), ...(market.lpRiskFlags ?? [])])];
    }
  }

  const candidates = [...bySlug.values()]
    .map((candidate) => ({
      ...candidate,
      sourceProfiles: [...new Set(candidate.sourceProfiles)],
      ensembleScore: scoreCandidate(candidate, new Set(candidate.sourceProfiles).size),
    }))
    .sort((a, b) => b.ensembleScore - a.ensembleScore || b.score - a.score)
    .slice(0, limit);

  return {
    generatedAt,
    outputPath,
    totalSources: sourceResults.length,
    totalRawMarkets,
    totalCandidates: bySlug.size,
    marketsReturned: candidates.length,
    candidates,
  };
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, parsed));
}

export function registerFeedCommand(program: Command): void {
  const feed = program
    .command("feed")
    .description(
      "Rank active Polymarket markets (same engine as chat getFeed / GET /api/feed). " +
        "Use --profile for curated screens.",
    )
    .argument(
      "[screening]",
      `Optional screening preset: ${PROFILE_CHOICES.join(" | ")} (same as --profile)`,
    )
    .option(
      "--profile <name>",
      `Screening defaults: ${PROFILE_CHOICES.join(", ")} — explicit flags override`,
    )
    .option("--sort-by <key>", "score | volume | liquidity | movement | spread | recency | extremity | rewards | rewardYield | lpExpectedReturn | horizon")
    .option("--preset <name>", "Attention weight preset (default, volume-hunter, lp-opportunity, …)")
    .option("--tag <slug>", "Polymarket category tag, e.g. crypto, politics")
    .option("--min-volume <usd>", "Minimum 24h volume (USD)")
    .option("--min-liquidity <usd>", "Minimum displayed liquidity (USD)")
    .option("--max-liquidity <usd>", "Maximum displayed liquidity (USD)")
    .option("--min-rewards-daily-rate <usd>", "Minimum LP rewards USD/day")
    .option("--min-days-to-end <n>", "Min calendar days until resolution")
    .option("--max-days-to-end <n>", "Max calendar days until resolution")
    .option("--max-market-age-hours <n>", "With liquid-new-or-long: max age (hours) for the \"new\" branch")
    .option("--liquid-profile <mode>", "new-or-long (used by liquid-new-or-long screen)")
    .option("--limit <n>", "Max markets to return (1–100, default 15)", "15");

  feed
    .command("ensemble")
    .description("Run multiple feed screens, merge by slug, and write ranked candidates JSON")
    .option("--limit <n>", "Max candidates to return/write (1-100, default 25)", "25")
    .option("--output <file>", "Output JSON path", "candidates.json")
    .action(async (o: FeedEnsembleOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const perSourceLimit = "100";
      const sourceResults: Array<{ source: string; result: FeedResult }> = [];
      try {
        for (const source of ENSEMBLE_SOURCES) {
          const result = await client.get<FeedResult>("/api/feed", {
            ...source.params,
            limit: perSourceLimit,
          });
          if (result.error) {
            throw new Error(result.error);
          }
          sourceResults.push({ source: source.name, result });
        }
        const outputPath = o.output ?? "candidates.json";
        const ensemble = buildFeedEnsemble(sourceResults, parseLimit(o.limit, 25), outputPath);
        await writeFile(outputPath, JSON.stringify(ensemble, null, 2) + "\n", "utf8");
        if (globalOpts.json) {
          out.json(ensemble);
          return;
        }
        out.heading(`Feed Ensemble — ${ensemble.marketsReturned} candidates`);
        out.table(
          ensemble.candidates.slice(0, 15).map((m) => [
            String(Math.round(m.ensembleScore)),
            out.truncate(m.question, 48),
            `${Math.round(m.yesPrice * 100)}%`,
            out.compactCurrency(m.volume24h),
            out.compactCurrency(m.liquidity),
            m.sourceProfiles.join(","),
          ]),
          ["Score", "Market", "YES", "24h Vol", "Liq", "Sources"],
        );
        out.success(`Wrote ${outputPath}`);
      } catch (e) {
        out.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    });

  feed
    .action(async (screening: string | undefined, o: FeedCmdOpts) => {
      const globalOpts = program.opts<GlobalOptions>();

      let profile: string | undefined;
      try {
        profile = resolveFeedProfile(screening, o.profile, out.warn);
      } catch (e) {
        out.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }

      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const params = feedQueryParams({
        profile,
        sortBy: o.sortBy,
        preset: o.preset,
        tag: o.tag,
        minVolume: o.minVolume,
        minLiquidity: o.minLiquidity,
        maxLiquidity: o.maxLiquidity,
        minRewardsDailyRate: o.minRewardsDailyRate,
        minDaysToEnd: o.minDaysToEnd,
        maxDaysToEnd: o.maxDaysToEnd,
        maxMarketAgeHours: o.maxMarketAgeHours,
        liquidProfile: o.liquidProfile,
        limit: o.limit,
      });

      try {
        const result = await client.get<FeedResult>("/api/feed", params);
        if (result.error) {
          out.error(result.error);
          process.exit(1);
        }
        displayFeedResult(result, globalOpts);
      } catch (e) {
        out.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    });
}
