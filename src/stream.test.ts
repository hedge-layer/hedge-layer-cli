import { describe, it, expect } from "vitest";
import { parseStream } from "./stream.js";
import type { StreamCallbacks } from "./stream.js";

function makeStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = lines.join("\n") + "\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

describe("parseStream", () => {
  it("collects text deltas into assistantText", async () => {
    const stream = makeStream([
      'data: {"type":"text-delta","delta":"Hello"}',
      'data: {"type":"text-delta","delta":" world"}',
      "data: [DONE]",
    ]);

    const result = await parseStream(stream);
    expect(result.assistantText).toBe("Hello world");
    expect(result.toolCalls).toEqual([]);
    expect(result.marketBrief).toBeNull();
  });

  it("invokes onText callback for each delta", async () => {
    const stream = makeStream([
      'data: {"type":"text-delta","delta":"Hi"}',
      'data: {"type":"text-delta","delta":"!"}',
    ]);

    const texts: string[] = [];
    await parseStream(stream, { onText: (t) => texts.push(t) });
    expect(texts).toEqual(["Hi", "!"]);
  });

  it("tracks tool calls through the full lifecycle", async () => {
    const stream = makeStream([
      'data: {"type":"tool-input-start","toolCallId":"tc1","toolName":"searchMarkets"}',
      'data: {"type":"tool-input-delta","toolCallId":"tc1","inputTextDelta":"{\\"q\\":"}',
      'data: {"type":"tool-input-delta","toolCallId":"tc1","inputTextDelta":"\\"flood\\"}"}',
      'data: {"type":"tool-input-available","toolCallId":"tc1","toolName":"searchMarkets","input":{"q":"flood"}}',
      'data: {"type":"tool-output-available","toolCallId":"tc1","output":{"results":[]}}',
    ]);

    const toolNames: string[] = [];
    const resultNames: string[] = [];
    const callbacks: StreamCallbacks = {
      onToolCall: (name) => toolNames.push(name),
      onToolResult: (name) => resultNames.push(name),
    };

    const result = await parseStream(stream, callbacks);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("searchMarkets");
    expect(toolNames).toEqual(["searchMarkets"]);
    expect(resultNames).toEqual(["searchMarkets"]);
  });

  it("detects market brief from buildMarketBrief tool output", async () => {
    const brief = {
      title: "Hurricane Season Intelligence",
      thesis: "Markets are pricing moderate hurricane risk for 2026.",
      markets: [{ question: "Will a Category 4+ hurricane hit the US in 2026?" }],
      gaps: ["No direct market for Southeast US flooding"],
      marketCount: 1,
      createdAt: "2026-03-29T00:00:00Z",
    };

    const stream = makeStream([
      'data: {"type":"tool-input-start","toolCallId":"tc2","toolName":"buildMarketBrief"}',
      'data: {"type":"tool-input-available","toolCallId":"tc2","toolName":"buildMarketBrief","input":{}}',
      `data: {"type":"tool-output-available","toolCallId":"tc2","output":${JSON.stringify(brief)}}`,
    ]);

    const result = await parseStream(stream);
    expect(result.marketBrief).not.toBeNull();
    expect(result.marketBrief!.title).toBe("Hurricane Season Intelligence");
    expect(result.marketBrief!.marketCount).toBe(1);
  });

  it("throws on error events", async () => {
    const stream = makeStream([
      'data: {"type":"error","errorText":"Something broke"}',
    ]);

    await expect(parseStream(stream)).rejects.toThrow("Something broke");
  });

  it("ignores comment lines and empty lines", async () => {
    const stream = makeStream([
      ": this is a comment",
      "",
      'data: {"type":"text-delta","delta":"ok"}',
    ]);

    const result = await parseStream(stream);
    expect(result.assistantText).toBe("ok");
  });

  it("ignores malformed JSON payloads gracefully", async () => {
    const stream = makeStream([
      "data: not-json-at-all",
      'data: {"type":"text-delta","delta":"fine"}',
    ]);

    const result = await parseStream(stream);
    expect(result.assistantText).toBe("fine");
  });

  it("detects feed result from getFeed tool output", async () => {
    const feed = {
      totalScanned: 1500,
      totalAfterFilter: 1200,
      marketsReturned: 3,
      sortedBy: "volume",
      preset: "default",
      markets: [
        { rank: 1, score: 85.2, question: "Will X happen?", slug: "will-x", yesPrice: 0.65, volume24h: 500000 },
        { rank: 2, score: 72.1, question: "Will Y happen?", slug: "will-y", yesPrice: 0.32, volume24h: 250000 },
        { rank: 3, score: 60.5, question: "Will Z happen?", slug: "will-z", yesPrice: 0.80, volume24h: 100000 },
      ],
    };

    const stream = makeStream([
      'data: {"type":"tool-input-start","toolCallId":"tc3","toolName":"getFeed"}',
      'data: {"type":"tool-input-available","toolCallId":"tc3","toolName":"getFeed","input":{"sortBy":"volume"}}',
      `data: {"type":"tool-output-available","toolCallId":"tc3","output":${JSON.stringify(feed)}}`,
    ]);

    const result = await parseStream(stream);
    expect(result.feedResult).not.toBeNull();
    expect(result.feedResult!.sortedBy).toBe("volume");
    expect(result.feedResult!.totalScanned).toBe(1500);
    expect((result.feedResult!.markets as unknown[]).length).toBe(3);
    expect(result.marketBrief).toBeNull();
  });

  it("returns null feedResult when no getFeed tool is called", async () => {
    const stream = makeStream([
      'data: {"type":"text-delta","delta":"No feed here"}',
      "data: [DONE]",
    ]);

    const result = await parseStream(stream);
    expect(result.feedResult).toBeNull();
  });
});
