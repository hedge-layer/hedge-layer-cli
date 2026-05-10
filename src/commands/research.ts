import { Command } from "commander";
import readline from "node:readline/promises";
import chalk from "chalk";
import { ApiClient } from "../client.js";
import { parseStream } from "../stream.js";
import type { Assessment, MarketBrief, FeedResult, GlobalOptions } from "../types.js";
import { displayFeedResult } from "../feed-display.js";
import * as out from "../output.js";

export function registerResearchCommands(program: Command): void {
  const research = program.command("research").description("AI-powered market research");

  research
    .command("start", { isDefault: true })
    .description("Start an interactive market research session")
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const { id } = await client.post<{ id: string }>("/api/assessments");

      out.heading("Market Research");
      process.stderr.write(
        chalk.dim("  Describe a topic or thesis to explore. Type /quit to exit.\n\n"),
      );

      let msgCounter = 0;
      const uiMsg = (role: string, content: string) => ({
        id: `msg-${++msgCounter}`,
        role,
        content,
        parts: [{ type: "text" as const, text: content }],
      });

      const messages: ReturnType<typeof uiMsg>[] = [];
      let firstMessageTs: number | null = null;
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

      try {
        while (true) {
          const userInput = await rl.question(chalk.cyan("You: "));
          if (!userInput.trim()) continue;
          if (userInput.trim() === "/quit") break;

          if (firstMessageTs === null) firstMessageTs = Date.now();
          messages.push(uiMsg("user", userInput));

          process.stderr.write(chalk.dim("\nAssistant: "));

          try {
            const body = await client.stream("/api/chat", {
              messages,
              assessmentId: id,
            });

            const result = await parseStream(body, {
              onText: (text) => process.stderr.write(text),
              onToolCall: (name) => {
                process.stderr.write(chalk.dim(`\n  [tool: ${name}]\n`));
              },
              onToolResult: (name, toolResult) => {
                if (globalOpts.verbose) {
                  process.stderr.write(chalk.dim(`  [result: ${name}] ${JSON.stringify(toolResult).slice(0, 200)}\n`));
                }
              },
            });

            process.stderr.write("\n\n");

            if (result.assistantText) {
              messages.push(uiMsg("assistant", result.assistantText));
            }

            try {
              await persistAssessment(client, id, messages, result.marketBrief, firstMessageTs);
            } catch (persistErr) {
              out.warn(
                `Could not save session: ${persistErr instanceof Error ? persistErr.message : String(persistErr)}`,
              );
            }

            if (result.feedResult) {
              displayFeedResult(result.feedResult as unknown as FeedResult, globalOpts);
            }

            if (result.marketBrief) {
              displayMarketBrief(result.marketBrief as unknown as MarketBrief, globalOpts);
              break;
            }
          } catch (e) {
            process.stderr.write("\n");
            out.error(`Chat error: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } finally {
        rl.close();
      }
    });

  research
    .command("run <query>")
    .description("Run research on a topic and return the final Market Brief as JSON (via /api/brief)")
    .action(async (query: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      process.stderr.write(chalk.dim(`  Researching "${out.truncate(query, 60)}"...\n`));
      const startTime = Date.now();

      const { brief, durationMs, stepsCompleted, toolsUsed } = await client.postBriefSync(query);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stderr.write(chalk.dim(`  Done (${elapsed}s)\n\n`));

      const looksLikeBrief =
        brief &&
        typeof brief === "object" &&
        Array.isArray((brief as { markets?: unknown }).markets) &&
        typeof (brief as { title?: unknown }).title === "string";

      if (looksLikeBrief) {
        out.json(brief as unknown as MarketBrief);
      } else {
        process.stderr.write(chalk.yellow("No market brief was produced.\n"));
        out.json({
          brief: null,
          text: null,
          metadata: {
            model: "",
            stepsUsed: stepsCompleted ?? 0,
            toolsUsed,
            durationMs: durationMs ?? Date.now() - startTime,
          },
          raw: brief,
        });
      }
    });

  research
    .command("list")
    .description("List past research sessions")
    .option("-s, --status <status>", "Filter by status")
    .action(async (cmdOpts: { status?: string }) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const params: Record<string, string> = { list: "true" };
      if (cmdOpts.status) params.status = cmdOpts.status;

      const data = await client.get<{ assessments: Assessment[] }>("/api/assessments", params);

      if (globalOpts.json) {
        out.json(data.assessments);
        return;
      }

      if (data.assessments.length === 0) {
        out.warn("No research sessions found.");
        return;
      }

      out.heading(`Research Sessions (${data.assessments.length})`);

      const rows = data.assessments.map((a) => {
        const status = formatStatus(a.status);
        const brief = a.market_brief?.title ?? "—";
        const markets = a.market_brief ? String(a.market_brief.marketCount) : "—";
        return [a.id.slice(0, 8), status, out.truncate(brief, 30), markets, out.relativeTime(a.created_at)];
      });

      out.table(rows, ["ID", "Status", "Brief", "Markets", "Created"]);
    });

  research
    .command("show <id>")
    .description("Show research session details")
    .action(async (id: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const assessment = await client.get<Assessment>(`/api/assessments/${id}`);

      if (globalOpts.json) {
        out.json(assessment);
        return;
      }

      out.heading("Research Session " + out.dim(assessment.id.slice(0, 8)));

      out.table([
        ["Status", formatStatus(assessment.status)],
        ["Created", new Date(assessment.created_at).toLocaleString()],
        ["Updated", new Date(assessment.updated_at).toLocaleString()],
      ]);

      if (assessment.market_brief) {
        displayMarketBrief(assessment.market_brief, globalOpts);
      }
    });

  research
    .command("delete <id>")
    .description("Delete a research session")
    .action(async (id: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      await client.delete(`/api/assessments/${id}`);
      out.success("Research session deleted.");
    });
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not logged in. Run " + out.bold("hl auth login") + " first.");
    process.exit(1);
  }
}

/** Mirrors web ChatInterface assessment PATCH (simplified metadata without tool-part extraction). */
function buildAssessmentPatch(
  messages: unknown[],
  marketBrief: Record<string, unknown> | null,
  firstMessageTs: number | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { messages };
  const meta: Record<string, unknown> = {
    timeToBriefMs: null,
    searchQueries: [],
    searchResultCounts: [],
    coverageHit: false,
    completedAt: null,
  };

  if (
    marketBrief &&
    typeof marketBrief === "object" &&
    Array.isArray((marketBrief as { markets?: unknown }).markets)
  ) {
    const markets = (marketBrief as { markets: unknown[] }).markets;
    patch.market_brief = marketBrief;
    patch.status = "completed";
    meta.timeToBriefMs = firstMessageTs != null ? Date.now() - firstMessageTs : null;
    meta.coverageHit = markets.length > 0;
    meta.completedAt = new Date().toISOString();
  }

  patch.metadata = meta;
  return patch;
}

async function persistAssessment(
  client: ApiClient,
  assessmentId: string,
  messages: unknown[],
  marketBrief: Record<string, unknown> | null,
  firstMessageTs: number | null,
): Promise<void> {
  await client.patch(`/api/assessments/${assessmentId}`, buildAssessmentPatch(messages, marketBrief, firstMessageTs));
}

function formatStatus(status: string): string {
  switch (status) {
    case "completed":
      return chalk.green(status);
    case "in_progress":
      return chalk.yellow(status);
    case "abandoned":
      return chalk.red(status);
    default:
      return status;
  }
}

function displayMarketBrief(brief: MarketBrief, globalOpts: GlobalOptions): void {
  if (globalOpts.json) {
    out.json(brief);
    return;
  }

  out.heading("Market Brief");

  process.stdout.write("  " + chalk.bold(brief.title) + "\n\n");
  process.stdout.write("  " + chalk.italic(brief.thesis) + "\n");

  if (brief.markets.length > 0) {
    process.stdout.write("\n" + chalk.bold("  Markets") + "\n\n");
    const rows = brief.markets.map((m) => {
      const prob = out.percent(m.yesPrice);
      const signals = m.signals.length > 0 ? m.signals.join(", ") : "—";
      const liq = m.liquidity ? out.currency(m.liquidity) : "—";
      return [out.truncate(m.question, 40), prob, signals, liq];
    });
    out.table(rows, ["Market", "Prob", "Signals", "Liq"]);

    process.stdout.write("\n");
    for (const m of brief.markets) {
      process.stdout.write("  " + chalk.dim("▸ ") + out.truncate(m.question, 50) + "\n");
      process.stdout.write("    " + chalk.dim("Causal link: ") + m.causalLink + "\n");
      process.stdout.write("    " + chalk.dim("Polymarket: ") + m.polymarketUrl + "\n");
    }
  }

  if (brief.gaps.length > 0) {
    process.stdout.write("\n" + chalk.bold("  Coverage Gaps") + "\n\n");
    for (const gap of brief.gaps) {
      process.stdout.write("  " + chalk.yellow("▸") + " " + gap + "\n");
    }
  }

  process.stdout.write("\n  " + chalk.dim(`${brief.marketCount} markets · ${brief.gaps.length} coverage gaps`) + "\n");
}
