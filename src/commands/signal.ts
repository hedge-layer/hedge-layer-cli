import { Command, InvalidArgumentError } from "commander";
import { readFile } from "node:fs/promises";
import { ApiClient } from "../client.js";
import { displaySignalAnalysis } from "../signal-display.js";
import type {
  GlobalOptions,
  SignalAnalysisApiResponse,
  SignalAnalysisRequest,
  SignalMarketInput,
} from "../types.js";
import * as out from "../output.js";

interface SignalAnalyzeOpts {
  url?: string[];
  market?: string;
  context?: string;
  question?: string;
  description?: string;
  yesProb?: number;
  noProb?: number;
  slug?: string;
  link?: string;
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not authenticated. Run `hl auth login` first.");
    process.exit(1);
  }
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function parseProbability(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new InvalidArgumentError("Expected a probability between 0 and 100");
  }
  return n;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readMarketPayload(path: string | undefined): Promise<{
  market?: SignalMarketInput;
  markets?: SignalMarketInput[];
}> {
  if (!path) return {};
  const raw = path === "-" ? await readStdin() : await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return { markets: parsed as SignalMarketInput[] };
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { markets?: unknown }).markets)) {
    return { markets: (parsed as { markets: SignalMarketInput[] }).markets };
  }
  if (parsed && typeof parsed === "object" && (parsed as { market?: unknown }).market) {
    return { market: (parsed as { market: SignalMarketInput }).market };
  }
  if (parsed && typeof parsed === "object") {
    return { market: parsed as SignalMarketInput };
  }
  throw new Error("Market JSON must be an object, an array, or { market | markets }");
}

function inlineMarketFromOptions(opts: SignalAnalyzeOpts): SignalMarketInput | undefined {
  const market: SignalMarketInput = {};
  if (opts.question) market.question = opts.question;
  if (opts.description) market.description = opts.description;
  if (opts.yesProb !== undefined) market.yesPrice = opts.yesProb;
  if (opts.noProb !== undefined) market.noPrice = opts.noProb;
  if (opts.slug) market.slug = opts.slug;
  if (opts.link) market.link = opts.link;
  return Object.keys(market).length > 0 ? market : undefined;
}

export async function buildSignalPayload(
  positionalUrl: string | undefined,
  opts: SignalAnalyzeOpts,
): Promise<SignalAnalysisRequest> {
  const urls = [positionalUrl, ...(opts.url ?? [])].filter(
    (value): value is string => Boolean(value),
  );
  const filePayload = await readMarketPayload(opts.market);
  const inlineMarket = inlineMarketFromOptions(opts);
  const hasMarketInput = Boolean(filePayload.market || filePayload.markets || inlineMarket);

  if (urls.length > 0 && hasMarketInput) {
    throw new Error("Use either URL input or market JSON/options, not both.");
  }
  if (filePayload.market && inlineMarket) {
    throw new Error("Use either --market or inline market options, not both.");
  }
  if (filePayload.markets && inlineMarket) {
    throw new Error("Use either --market or inline market options, not both.");
  }
  if (urls.length === 0 && !hasMarketInput) {
    throw new Error("Provide a Polymarket URL or a market payload.");
  }

  const payload: SignalAnalysisRequest =
    urls.length === 1
      ? { url: urls[0] }
      : urls.length > 1
        ? { urls }
        : filePayload.market
          ? { market: filePayload.market }
          : filePayload.markets
            ? { markets: filePayload.markets }
            : { market: inlineMarket };

  if (opts.context) {
    payload.previous_analysis_context = opts.context;
  }
  return payload;
}

async function runSignalAnalysis(
  client: ApiClient,
  payload: SignalAnalysisRequest,
): Promise<SignalAnalysisApiResponse> {
  return client.post<SignalAnalysisApiResponse>("/api/signal/analyze", payload);
}

export function registerSignalCommands(program: Command): void {
  const signal = program
    .command("signal")
    .description("Analyze Polymarket probability gaps with the signal agent");

  signal
    .command("analyze")
    .description("Estimate true YES probability and compare it with market pricing")
    .argument("[url]", "Polymarket market/event URL to analyze")
    .option("--url <url>", "Additional Polymarket URL; repeat for multiple markets", collect, [])
    .option("--market <file>", "Inline market JSON object/array; use '-' to read stdin")
    .option("--context <text>", "Prior search notes or analysis context for the agent")
    .option("--question <text>", "Inline market question when not using a URL")
    .option("--description <text>", "Inline market description or resolution criteria")
    .option("--yes-prob <prob>", "Current YES probability or price, e.g. 0.52 or 52", parseProbability)
    .option("--no-prob <prob>", "Current NO probability or price, e.g. 0.48 or 48", parseProbability)
    .option("--slug <slug>", "Inline market slug")
    .option("--link <url>", "Inline market link")
    .action(async (url: string | undefined, o: SignalAnalyzeOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      let payload: SignalAnalysisRequest;
      try {
        payload = await buildSignalPayload(url, o);
      } catch (e) {
        out.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }

      if (!globalOpts.json) {
        process.stderr.write(out.dim("  Running signal analysis...\n"));
      }

      const result = await runSignalAnalysis(client, payload);
      displaySignalAnalysis(result, globalOpts);
    });
}
