import { Command } from "commander";
import chalk from "chalk";
import { ApiClient } from "../client.js";
import type { Market, Orderbook, SlippageResult, GlobalOptions } from "../types.js";
import * as out from "../output.js";

export function registerMarketCommands(program: Command): void {
  const markets = program.command("markets").description("Browse Polymarket prediction markets");

  markets
    .command("search <query>")
    .description("Search for markets by keyword")
    .option("-l, --limit <n>", "Max results", "10")
    .action(async (query: string, cmdOpts: { limit: string }) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);

      const data = await client.get<{ markets: Market[]; total: number }>("/api/markets", {
        q: query,
        limit: cmdOpts.limit,
      });

      if (globalOpts.json) {
        out.json(data);
        return;
      }

      if (data.markets.length === 0) {
        out.warn(`No markets found for "${query}"`);
        return;
      }

      out.heading(`Markets matching "${query}" (${data.total} total)`);

      const rows = data.markets.map((m) => {
        const prices = parseOutcomePrices(m.outcomePrices);
        const yesPrice = prices ? out.percent(prices[0]) : "—";
        const vol = formatVolume(m.volume);
        const end = m.endDate ? formatDate(m.endDate) : "—";
        const status = m.closed ? chalk.red("closed") : chalk.green("active");
        return [out.truncate(m.question, 50), yesPrice, vol, end, status];
      });

      out.table(rows, ["Market", "YES", "Volume", "Ends", "Status"]);
    });

  markets
    .command("orderbook <tokenId>")
    .description("Show orderbook spread and depth for a CLOB token")
    .option("-s, --size <n>", "Size for slippage calculation")
    .action(async (tokenId: string, cmdOpts: { size?: string }) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);

      const params: Record<string, string> = { tokenId };
      if (cmdOpts.size) params.size = cmdOpts.size;

      const data = await client.get<{
        book: Orderbook;
        spread: { bid: number; ask: number; spread: number } | null;
        askDepth: number;
        slippage: SlippageResult | null;
      }>("/api/orderbook", params);

      if (globalOpts.json) {
        out.json(data);
        return;
      }

      out.heading("Orderbook");

      if (data.spread) {
        out.table([
          ["Best Bid", data.spread.bid.toFixed(4)],
          ["Best Ask", data.spread.ask.toFixed(4)],
          ["Spread", out.percent(data.spread.spread)],
          ["Ask Depth", out.currency(data.askDepth)],
        ]);
      } else {
        out.warn("No spread data available (empty orderbook)");
      }

      if (data.slippage) {
        process.stdout.write("\n");
        out.table([
          ["Avg Fill Price", data.slippage.avgPrice.toFixed(4)],
          ["Worst Price", data.slippage.worstPrice.toFixed(4)],
          ["Slippage", out.percent(data.slippage.slippage)],
          ["Fillable Size", out.currency(data.slippage.fillableSize)],
        ]);
      }

      if (data.book.asks.length > 0) {
        process.stdout.write("\n" + chalk.dim("  Top 5 asks:") + "\n");
        const askRows = data.book.asks.slice(0, 5).map((l) => [l.price, l.size]);
        out.table(askRows, ["Price", "Size"]);
      }

      if (data.book.bids.length > 0) {
        process.stdout.write("\n" + chalk.dim("  Top 5 bids:") + "\n");
        const bidRows = data.book.bids.slice(0, 5).map((l) => [l.price, l.size]);
        out.table(bidRows, ["Price", "Size"]);
      }
    });
}

function parseOutcomePrices(raw: string): [number, number] | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) {
      return [Number(parsed[0]), Number(parsed[1])];
    }
  } catch {
    // ignore
  }
  return null;
}

function formatVolume(vol: string): string {
  const n = Number(vol);
  if (isNaN(n)) return vol;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
