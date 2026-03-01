import { Command } from "commander";
import chalk from "chalk";
import { ApiClient } from "../client.js";
import type { Orderbook, SlippageResult, GlobalOptions } from "../types.js";
import * as out from "../output.js";

export function registerMarketCommands(program: Command): void {
  const markets = program.command("markets").description("Polymarket orderbook tools");

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

