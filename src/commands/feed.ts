import { Command } from "commander";
import { ApiClient } from "../client.js";
import { displayFeedResult } from "../feed-display.js";
import type { FeedResult, GlobalOptions } from "../types.js";
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

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not authenticated. Run `hl auth login` first.");
    process.exit(1);
  }
}

const PROFILE_CHOICES = ["lp-opportunity", "liquid-new-or-long"] as const;

function isProfile(s: string | undefined): s is (typeof PROFILE_CHOICES)[number] {
  return s !== undefined && (PROFILE_CHOICES as readonly string[]).includes(s);
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

export function registerFeedCommand(program: Command): void {
  program
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
    .option("--sort-by <key>", "score | volume | liquidity | movement | spread | recency | extremity | rewards | rewardYield | horizon")
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
    .option("--limit <n>", "Max markets to return (1–100, default 15)", "15")
    .action(async (screening: string | undefined, o: FeedCmdOpts) => {
      const globalOpts = program.opts<GlobalOptions>();

      let profile = o.profile;
      if (screening) {
        if (!isProfile(screening)) {
          out.error(`Unknown screening "${screening}". Use: ${PROFILE_CHOICES.join(" or ")}`);
          process.exit(1);
        }
        if (profile && profile !== screening) {
          out.warn(`Both positional and --profile set; using --profile (${profile}).`);
        } else if (!profile) {
          profile = screening;
        }
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
