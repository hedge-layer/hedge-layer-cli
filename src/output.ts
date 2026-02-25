import chalk from "chalk";

export function json(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function table(rows: string[][], headers?: string[]): void {
  const allRows = headers ? [headers, ...rows] : rows;
  const colWidths: number[] = [];
  for (const row of allRows) {
    for (let i = 0; i < row.length; i++) {
      colWidths[i] = Math.max(colWidths[i] ?? 0, stripAnsi(row[i]).length);
    }
  }

  for (let r = 0; r < allRows.length; r++) {
    const row = allRows[r];
    const padded = row.map((cell, i) => {
      const bare = stripAnsi(cell);
      const pad = colWidths[i] - bare.length;
      return cell + " ".repeat(Math.max(0, pad));
    });
    process.stdout.write("  " + padded.join("  ") + "\n");

    if (r === 0 && headers) {
      const sep = colWidths.map((w) => "─".repeat(w)).join("──");
      process.stdout.write("  " + sep + "\n");
    }
  }
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function heading(text: string): void {
  process.stdout.write("\n" + chalk.bold(text) + "\n\n");
}

export function success(text: string): void {
  process.stdout.write(chalk.green("✓") + " " + text + "\n");
}

export function warn(text: string): void {
  process.stdout.write(chalk.yellow("⚠") + " " + text + "\n");
}

export function error(text: string): void {
  process.stderr.write(chalk.red("✗") + " " + text + "\n");
}

export function dim(text: string): string {
  return chalk.dim(text);
}

export function bold(text: string): string {
  return chalk.bold(text);
}

export function currency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function percent(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

export function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
