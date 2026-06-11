import { InvalidArgumentError } from "commander";
import { readFile } from "node:fs/promises";
import type {
  AllocatorAllocationInput,
  AllocatorMarketInput,
  AllocatorPnlInput,
} from "../types.js";

export function parsePositiveNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvalidArgumentError("Expected a positive number");
  }
  return n;
}

export function parseAllocationsInput(parsed: unknown): AllocatorAllocationInput[] {
  const rows = extractArray<AllocatorAllocationInput>(parsed, "allocations");
  if (!rows) {
    throw new Error("Allocations JSON must be an array or { allocations: [...] }");
  }
  return rows;
}

export function parsePnlContextInput(parsed: unknown): AllocatorPnlInput[] {
  const rows = extractArray<AllocatorPnlInput>(parsed, "pnl_context");
  if (!rows) {
    throw new Error("PnL JSON must be an array or { pnl_context: [...] }");
  }
  return rows;
}

export async function readAllocations(path: string | undefined): Promise<AllocatorAllocationInput[]> {
  if (!path) return [];
  return parseAllocationsInput(await readJsonInput(path));
}

export async function readPnlContext(path: string | undefined): Promise<AllocatorPnlInput[]> {
  if (!path) return [];
  return parsePnlContextInput(await readJsonInput(path));
}

export async function readMarketPayload(path: string | undefined): Promise<AllocatorMarketInput[] | undefined> {
  if (!path) return undefined;
  const parsed = await readJsonInput(path);
  const rows = extractArray<AllocatorMarketInput>(parsed, "markets");
  if (!rows) {
    throw new Error("Markets JSON must be an array or { markets: [...] }");
  }
  return rows;
}

function extractArray<T>(parsed: unknown, key: string): T[] | undefined {
  if (Array.isArray(parsed)) {
    return parsed as T[];
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>)[key])) {
    return (parsed as Record<string, unknown>)[key] as T[];
  }
  return undefined;
}

async function readJsonInput(path: string): Promise<unknown> {
  const raw = path === "-" ? await readStdin() : await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
