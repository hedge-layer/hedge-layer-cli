import { Command, InvalidArgumentError } from "commander";
import { dirname, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ApiClient } from "../client.js";
import { displaySignalAnalysis } from "../signal-display.js";
import type {
  FeedResultMarket,
  GlobalOptions,
  SignalAnalysis,
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

interface SignalPlanOpts {
  candidates: string;
  out?: string;
  json?: boolean;
  quiet?: boolean;
}

export type RecommendedPlanAction =
  | "SKIP"
  | "WATCH"
  | "REVIEW_BUY_YES"
  | "REVIEW_BUY_NO";

export interface SignalPlanRow {
  market_slug: string;
  market_name: string;
  market_link?: string;
  candidate: FeedResultMarket;
  signal: SignalAnalysis | null;
  priority_score: number;
  recommended_action: RecommendedPlanAction;
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

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function confidenceWeight(confidence: unknown): number {
  const value = String(confidence ?? "");
  if (value.startsWith("High")) return 1;
  if (value.startsWith("Medium")) return 0.75;
  return 0.5;
}

export function extractPlanCandidates(raw: unknown): FeedResultMarket[] {
  if (Array.isArray(raw)) return raw as FeedResultMarket[];
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as { candidates?: unknown; markets?: unknown };
  if (Array.isArray(payload.candidates)) return payload.candidates as FeedResultMarket[];
  if (Array.isArray(payload.markets)) return payload.markets as FeedResultMarket[];
  return [];
}

export function signalPayloadForCandidate(candidate: FeedResultMarket): SignalAnalysisRequest {
  return {
    url: candidate.polymarketUrl,
  };
}

export function firstSignalAnalysis(response: SignalAnalysisApiResponse): SignalAnalysis | null {
  const result = response.result;
  if (!result) return null;
  if (result.analysis) return result.analysis;
  const first = result.analyses?.find((item) => item.analysis);
  return first?.analysis ?? null;
}

export function recommendedPlanAction(signal: SignalAnalysis | null): RecommendedPlanAction {
  if (!signal) return "SKIP";
  if (signal.signal_strength !== "strong") return "WATCH";
  const gap = signal.probability_gap;
  if (gap === null || gap === undefined || gap === 0) return "WATCH";
  return gap > 0 ? "REVIEW_BUY_YES" : "REVIEW_BUY_NO";
}

export function signalPlanPriority(candidate: FeedResultMarket, signal: SignalAnalysis | null): number {
  const gap = signal?.probability_gap;
  if (gap === null || gap === undefined) return 0;
  const movementPenalty = Math.abs(num(candidate.oneDayPriceChange)) * 0.5;
  const score = Math.abs(gap) * confidenceWeight(signal.confidence) - movementPenalty;
  return Math.round(Math.max(0, score) * 10_000) / 10_000;
}

async function writeSignalPlanArtifacts(
  outPath: string,
  candidates: FeedResultMarket[],
  rows: SignalPlanRow[],
  candidatesPath: string,
): Promise<Record<string, string>> {
  const dir = dirname(outPath);
  const artifacts = {
    candidates: join(dir, "candidates.json"),
    signals: join(dir, "signals.json"),
    plan: outPath,
  };
  await mkdir(dir, { recursive: true });
  const plan = {
    generated_at: new Date().toISOString(),
    mode: "dry_run",
    candidates_path: candidatesPath,
    artifacts,
    rows,
  };
  await writeFile(artifacts.candidates, JSON.stringify({ candidates }, null, 2) + "\n", "utf8");
  await writeFile(artifacts.signals, JSON.stringify(rows.map((row) => ({ candidate: row.candidate, signal: row.signal })), null, 2) + "\n", "utf8");
  await writeFile(artifacts.plan, JSON.stringify(plan, null, 2) + "\n", "utf8");
  return artifacts;
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

  signal
    .command("plan")
    .description("Build a dry-run signal-ranked plan from feed ensemble candidates")
    .requiredOption("--candidates <file>", "Candidate JSON from `hl feed ensemble`")
    .option("--out <file>", "Output plan JSON path", "plan.json")
    .option("--json", "Print machine-readable plan")
    .option("--quiet", "Only print the output path")
    .action(async (o: SignalPlanOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      try {
        const raw = JSON.parse(await readFile(o.candidates, "utf8")) as unknown;
        const candidates = extractPlanCandidates(raw);
        if (candidates.length === 0) {
          throw new Error("Candidates JSON must contain a candidates or markets array.");
        }

        const rows: SignalPlanRow[] = [];
        for (const candidate of candidates) {
          if (!o.quiet && !globalOpts.json) {
            process.stderr.write(out.dim(`  Analyzing ${candidate.slug}...\n`));
          }
          const signal = firstSignalAnalysis(await runSignalAnalysis(client, signalPayloadForCandidate(candidate)));
          rows.push({
            market_slug: candidate.slug,
            market_name: candidate.question,
            market_link: candidate.polymarketUrl,
            candidate,
            signal,
            priority_score: signalPlanPriority(candidate, signal),
            recommended_action: recommendedPlanAction(signal),
          });
        }

        rows.sort((a, b) => b.priority_score - a.priority_score);
        const artifacts = await writeSignalPlanArtifacts(o.out ?? "plan.json", candidates, rows, o.candidates);
        const plan = JSON.parse(await readFile(artifacts.plan, "utf8")) as unknown;

        if (o.json || globalOpts.json) {
          out.json(plan);
          return;
        }
        if (o.quiet) {
          process.stdout.write(`${artifacts.plan}\n`);
          return;
        }
        out.heading(`Signal Plan — ${rows.length} candidates`);
        out.table(
          rows.slice(0, 15).map((row) => [
            row.priority_score.toFixed(4),
            row.recommended_action,
            out.truncate(row.market_name, 48),
            row.signal?.probability_gap === null || row.signal?.probability_gap === undefined
              ? "n/a"
              : `${(row.signal.probability_gap * 100).toFixed(2)}%`,
            String(row.signal?.confidence ?? "n/a"),
          ]),
          ["Score", "Action", "Market", "Gap", "Conf"],
        );
        out.success(`Wrote ${artifacts.plan}`);
      } catch (e) {
        out.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    });
}
