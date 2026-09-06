export function json(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}
