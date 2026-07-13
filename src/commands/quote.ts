import { Command, InvalidArgumentError } from "commander";
import { ApiClient } from "../client.js";
import type {
  GlobalOptions,
  QuoteAction,
  QuoteOutcome,
  QuotePreview,
  QuotePreviewRequest,
  QuoteRoute,
} from "../types.js";
import * as out from "../output.js";

export interface QuoteCommandOptions {
  action: QuoteAction;
  outcome: QuoteOutcome;
  cash?: number;
  shares?: number;
  signalId?: string;
  capital?: number;
  route: QuoteRoute;
  save?: boolean;
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not authenticated. Run `hl auth login` first.");
    process.exit(1);
  }
}

export function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("Expected a positive number");
  }
  return parsed;
}

export function parseQuoteAction(value: string): QuoteAction {
  const normalized = value.trim().toUpperCase();
  if (normalized !== "BUY" && normalized !== "SELL") {
    throw new InvalidArgumentError("Expected buy or sell");
  }
  return normalized;
}

export function parseQuoteOutcome(value: string): QuoteOutcome {
  const normalized = value.trim().toUpperCase();
  if (normalized !== "YES" && normalized !== "NO") {
    throw new InvalidArgumentError("Expected yes or no");
  }
  return normalized;
}

export function parseQuoteRoute(value: string): QuoteRoute {
  const normalized = value.trim().toLowerCase();
  if (normalized !== "auto" && normalized !== "aggressive" && normalized !== "passive") {
    throw new InvalidArgumentError("Expected auto, aggressive, or passive");
  }
  return normalized;
}

export function buildQuotePayload(
  instrument: string,
  opts: QuoteCommandOptions,
): QuotePreviewRequest {
  const normalizedInstrument = instrument.trim();
  if (!normalizedInstrument) {
    throw new Error("Provide a Polymarket slug or URL.");
  }

  const hasCash = opts.cash !== undefined;
  const hasShares = opts.shares !== undefined;
  if (hasCash === hasShares) {
    throw new Error("Provide exactly one of --cash or --shares.");
  }
  if (opts.action === "SELL" && hasCash) {
    throw new Error("SELL quotes require --shares; --cash is BUY-only.");
  }

  return {
    instrument: normalizedInstrument,
    action: opts.action,
    outcome: opts.outcome,
    size: hasCash
      ? { type: "cash", amount_usd: opts.cash as number }
      : { type: "shares", shares: opts.shares as number },
    ...(opts.signalId && { signal_forecast_id: opts.signalId }),
    ...(opts.capital !== undefined && { portfolio_capital_usd: opts.capital }),
    route: opts.route,
    persist: Boolean(opts.save),
  };
}

function formatNumber(value: unknown, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: digits })
    : "n/a";
}

function formatUsd(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? out.currency(value)
    : "n/a";
}

function formatPrice(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${value.toFixed(4)}`
    : "n/a";
}

function formatPercent(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? out.percent(value)
    : "n/a";
}

export function displayQuotePreview(preview: QuotePreview, globalOpts: GlobalOptions): void {
  if (globalOpts.json) {
    out.json(preview);
    return;
  }
  if (preview.error) {
    out.error(preview.error);
    return;
  }

  const request = preview.request;
  const instrument = preview.instrument;
  const market = preview.market ?? {};
  const fill = preview.fill ?? {};
  const economics = preview.economics ?? {};
  const signal = preview.signal ?? {};
  const sizing = preview.sizing_suggestion ?? {};

  out.heading(`Quote Preview — ${preview.status ?? "UNAVAILABLE"}`);
  out.table([
    ["Market", instrument.question ?? instrument.slug ?? "n/a"],
    ["Venue", preview.venue ?? "polymarket"],
    ["Action", `${request.action ?? "n/a"} ${request.outcome ?? "n/a"}`],
    ["Route", `${request.route_selected ?? "n/a"} (requested ${request.route_requested ?? "auto"})`],
    ["Observed", preview.observed_at ? new Date(preview.observed_at).toLocaleString() : "n/a"],
    ["Expires", preview.expires_at ? new Date(preview.expires_at).toLocaleString() : "n/a"],
  ]);

  process.stdout.write("\n");
  out.table([
    ["Best bid", formatPrice(market.best_bid)],
    ["Best ask", formatPrice(market.best_ask)],
    ["Spread", formatPrice(market.spread)],
    ["Bid depth", `${formatNumber(market.bid_depth_shares, 4)} shares`],
    ["Ask depth", `${formatNumber(market.ask_depth_shares, 4)} shares`],
    ["Requested cash", formatUsd(fill.requested_cash_usd)],
    ["Requested shares", formatNumber(fill.requested_shares, 4)],
    ["Fillable shares", formatNumber(fill.fillable_shares, 4)],
    ["Safety-capped shares", formatNumber(fill.safety_capped_shares, 4)],
    ["Fill ratio", formatPercent(fill.fill_ratio)],
    ["Average price", formatPrice(fill.average_price)],
    ["Worst price", formatPrice(fill.worst_price)],
    ["Passive limit", formatPrice(fill.passive_limit_price)],
    ["Slippage", typeof fill.slippage_bps === "number" ? `${formatNumber(fill.slippage_bps)} bps` : "n/a"],
  ], ["Quote", "Value"]);

  process.stdout.write("\n");
  out.table([
    ["Gross notional", formatUsd(economics.gross_notional_usd)],
    ["Venue fee", formatUsd(economics.venue_fee_usd)],
    ["Fee source", economics.fee_source ?? "unavailable"],
    [request.action === "SELL" ? "Net proceeds" : "All-in cost", formatUsd(
      request.action === "SELL" ? economics.net_proceeds_usd : economics.all_in_cost_usd,
    )],
    ["Max loss", formatUsd(economics.max_loss_usd)],
    ["Max payout", formatUsd(economics.max_payout_usd)],
    ["Profit at payout", formatUsd(economics.max_profit_usd)],
    ["Foregone payout", request.action === "SELL" ? formatUsd(economics.foregone_payout_usd) : "n/a"],
    ["Break-even probability", formatPercent(economics.break_even_probability)],
  ], ["Economics", "Value"]);

  if (preview.signal) {
    process.stdout.write("\n");
    out.table([
      ["Forecast YES", formatPercent(signal.forecast_yes)],
      ["Forecast interval", `${formatPercent(signal.lower_bound)} – ${formatPercent(signal.upper_bound)}`],
      ["Midpoint edge", formatPercent(signal.midpoint_edge)],
      ["Conservative edge", formatPercent(signal.conservative_edge)],
    ], ["Signal", "Value"]);
  }

  if (preview.sizing_suggestion) {
    process.stdout.write("\n");
    out.table([
      ["Suggested cash", formatUsd(sizing.suggested_max_spend_usd)],
      ["Suggested shares", formatNumber(sizing.suggested_shares, 4)],
      ["Capital fraction", formatPercent(sizing.allocation_fraction)],
    ], ["Non-binding sizing", "Value"]);
  }

  if (preview.risks?.length) {
    process.stdout.write("\n");
    for (const risk of preview.risks) out.warn(risk);
  }

  if (preview.id) {
    process.stdout.write("\n" + out.dim(`  Saved preview: ${preview.id}\n`));
  }
  process.stdout.write("\n");
  out.warn("Preview only — no order was signed or submitted.");
  const marketUrl = instrument.market_url;
  if (marketUrl) process.stdout.write(out.dim(`  Market: ${marketUrl}\n`));
}

export function registerQuoteCommand(program: Command): void {
  program
    .command("quote")
    .description("Preview the cost, liquidity, and risk of a Polymarket trade")
    .argument("<slug-or-url>", "Polymarket market slug or URL")
    .requiredOption("--action <action>", "buy | sell", parseQuoteAction)
    .requiredOption("--outcome <outcome>", "yes | no", parseQuoteOutcome)
    .option("--cash <usd>", "Maximum cash to spend (BUY only)", parsePositiveNumber)
    .option("--shares <shares>", "Number of outcome shares", parsePositiveNumber)
    .option("--signal-id <uuid>", "Saved Signal forecast to include in edge calculations")
    .option("--capital <usd>", "Manual portfolio capital for non-binding BUY sizing", parsePositiveNumber)
    .option("--route <route>", "auto | aggressive | passive", parseQuoteRoute, "auto")
    .option("--save", "Save a freshly generated preview to quote history")
    .action(async (instrument: string, opts: QuoteCommandOptions) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      let payload: QuotePreviewRequest;
      try {
        payload = buildQuotePayload(instrument, opts);
      } catch (error) {
        out.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      if (!globalOpts.json) {
        process.stderr.write(out.dim("  Refreshing public market data and order book...\n"));
      }
      const preview = await client.post<QuotePreview>("/api/quote", payload);
      displayQuotePreview(preview, globalOpts);
    });
}
