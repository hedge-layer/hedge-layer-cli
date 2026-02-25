import { Command } from "commander";
import readline from "node:readline/promises";
import chalk from "chalk";
import { ApiClient } from "../client.js";
import { parseStream } from "../stream.js";
import type { Assessment, GlobalOptions } from "../types.js";
import * as out from "../output.js";

export function registerAssessCommands(program: Command): void {
  const assess = program.command("assess").description("AI-powered risk assessment");

  assess
    .command("start", { isDefault: true })
    .description("Start an interactive risk assessment chat")
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const { id } = await client.post<{ id: string }>("/api/assessments");

      out.heading("Risk Assessment");
      process.stderr.write(
        chalk.dim("  Describe the risks you want to hedge. Type /quit to exit.\n\n"),
      );

      const messages: { role: string; content: string }[] = [];
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const userInput = await rl.question(chalk.cyan("You: "));
          if (!userInput.trim()) continue;
          if (userInput.trim() === "/quit") break;

          messages.push({ role: "user", content: userInput });

          process.stderr.write(chalk.dim("\nAssistant: "));

          try {
            const body = await client.stream("/api/chat", {
              messages,
              assessmentId: id,
            });

            const result = await parseStream(body, {
              onText: (text) => process.stderr.write(text),
              onToolCall: (name, args) => {
                process.stderr.write(chalk.dim(`\n  [tool: ${name}]\n`));
                if (globalOpts.verbose) {
                  process.stderr.write(chalk.dim(`  ${JSON.stringify(args)}\n`));
                }
              },
              onToolResult: (name, result) => {
                if (globalOpts.verbose) {
                  process.stderr.write(chalk.dim(`  [result: ${name}] ${JSON.stringify(result).slice(0, 200)}\n`));
                }
              },
            });

            process.stderr.write("\n\n");

            if (result.assistantText) {
              messages.push({ role: "assistant", content: result.assistantText });
            }

            if (result.hedgeBundle) {
              displayHedgeBundle(result.hedgeBundle, globalOpts);
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

  assess
    .command("list")
    .description("List past assessments")
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
        out.warn("No assessments found.");
        return;
      }

      out.heading(`Assessments (${data.assessments.length})`);

      const rows = data.assessments.map((a) => {
        const status = formatStatus(a.status);
        const location = a.risk_profile?.location ?? "—";
        const cost = a.hedge_bundle ? out.currency(a.hedge_bundle.totalCost) : "—";
        return [a.id.slice(0, 8), status, location, cost, out.relativeTime(a.created_at)];
      });

      out.table(rows, ["ID", "Status", "Location", "Cost", "Created"]);
    });

  assess
    .command("show <id>")
    .description("Show assessment details")
    .action(async (id: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const assessment = await client.get<Assessment>(`/api/assessments/${id}`);

      if (globalOpts.json) {
        out.json(assessment);
        return;
      }

      out.heading("Assessment " + out.dim(assessment.id.slice(0, 8)));

      out.table([
        ["Status", formatStatus(assessment.status)],
        ["Created", new Date(assessment.created_at).toLocaleString()],
        ["Updated", new Date(assessment.updated_at).toLocaleString()],
      ]);

      if (assessment.risk_profile) {
        const rp = assessment.risk_profile;
        process.stdout.write("\n");
        out.table([
          ["Location", rp.location],
          ["Asset Type", rp.assetType],
          ["Asset Value", out.currency(rp.assetValue)],
          ["Risk Types", rp.riskTypes.join(", ")],
        ]);
      }

      if (assessment.hedge_bundle) {
        displayHedgeBundle(assessment.hedge_bundle, globalOpts);
      }
    });

  assess
    .command("delete <id>")
    .description("Delete an assessment")
    .action(async (id: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      await client.delete(`/api/assessments/${id}`);
      out.success("Assessment deleted.");
    });
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not logged in. Run " + out.bold("hl auth login") + " first.");
    process.exit(1);
  }
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

function displayHedgeBundle(
  bundle: { positions: Array<Record<string, unknown>>; totalCost: number; totalCoverage: number; hedgeEfficiency: number; assetValue: number },
  globalOpts: GlobalOptions,
): void {
  if (globalOpts.json) {
    out.json(bundle);
    return;
  }

  out.heading("Hedge Bundle");

  out.table([
    ["Asset Value", out.currency(bundle.assetValue)],
    ["Total Cost", out.currency(bundle.totalCost)],
    ["Total Coverage", out.currency(bundle.totalCoverage)],
    ["Efficiency", out.percent(bundle.hedgeEfficiency)],
  ]);

  if (bundle.positions.length > 0) {
    process.stdout.write("\n" + chalk.bold("  Positions") + "\n\n");
    const rows = bundle.positions.map((p) => {
      const market = (p.market as Record<string, string>)?.question ?? "Unknown";
      const cost = out.currency(Number(p.estimatedCost ?? 0));
      const payout = out.currency(Number(p.potentialPayout ?? 0));
      const price = Number(p.yesPrice ?? 0).toFixed(2);
      const capped = p.wasCapped ? chalk.yellow(" (capped)") : "";
      return [out.truncate(market, 40), price, cost, payout + capped];
    });
    out.table(rows, ["Market", "YES", "Cost", "Payout"]);
  }
}
