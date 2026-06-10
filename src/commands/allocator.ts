import { InvalidArgumentError } from "commander";
import { readFile } from "node:fs/promises";
import type {
  AllocatorAllocationInput,
  AllocatorMarketInput,
} from "../types.js";

export function parsePositiveNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvalidArgumentError("Expected a positive number");
  }
  return n;
}

export async function readAllocations(path: string | undefined): Promise<AllocatorAllocationInput[]> {
  if (!path) return [];
  const raw = path === "-" ? await readStdin() : await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Allocations JSON must be an array");
  }
  return parsed as AllocatorAllocationInput[];
}

export async function readMarketPayload(path: string | undefined): Promise<AllocatorMarketInput[] | undefined> {
  if (!path) return undefined;
  const raw = path === "-" ? await readStdin() : await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as AllocatorMarketInput[];
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { markets?: unknown }).markets)) {
    return (parsed as { markets: AllocatorMarketInput[] }).markets;
  }
  throw new Error("Markets JSON must be an array or { markets: [...] }");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
