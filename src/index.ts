import { createProgram } from "./program.js";

try {
  await createProgram(__VERSION__).parseAsync(process.argv);
} catch (error) {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exitCode = 1;
}
