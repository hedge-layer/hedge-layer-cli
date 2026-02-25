/**
 * Parses the Vercel AI SDK streaming response format.
 *
 * The AI SDK uses a line-based protocol where each line is prefixed with
 * a type code and colon. Key types:
 *   0: text delta (JSON-encoded string)
 *   9: tool call begin { toolCallId, toolName }
 *   a: tool call delta (partial JSON args)
 *   b: tool result { toolCallId, result }
 *   d: finish message data (array)
 *   e: error
 *   f: message annotations
 */

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, result: unknown) => void;
}

export interface StreamResult {
  assistantText: string;
  toolCalls: Array<{ name: string; args: unknown }>;
  hedgeBundle: Record<string, unknown> | null;
}

export async function parseStream(
  body: ReadableStream<Uint8Array>,
  callbacks: StreamCallbacks = {},
): Promise<StreamResult> {
  const decoder = new TextDecoder();
  const reader = body.getReader();

  let buffer = "";
  let assistantText = "";
  const toolCalls: Array<{ name: string; args: unknown }> = [];
  const activeToolCalls = new Map<string, { name: string; argStr: string }>();
  let hedgeBundle: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length < 2 || line[1] !== ":") continue;

      const type = line[0];
      const payload = line.slice(2);

      switch (type) {
        case "0": {
          try {
            const text = JSON.parse(payload) as string;
            assistantText += text;
            callbacks.onText?.(text);
          } catch {
            // skip malformed text delta
          }
          break;
        }

        case "9": {
          try {
            const data = JSON.parse(payload) as { toolCallId: string; toolName: string };
            activeToolCalls.set(data.toolCallId, { name: data.toolName, argStr: "" });
          } catch {
            // skip
          }
          break;
        }

        case "a": {
          try {
            const data = JSON.parse(payload) as { toolCallId: string; argsTextDelta: string };
            const active = activeToolCalls.get(data.toolCallId);
            if (active) active.argStr += data.argsTextDelta;
          } catch {
            // skip
          }
          break;
        }

        case "b": {
          try {
            const data = JSON.parse(payload) as { toolCallId: string; result: unknown };
            const active = activeToolCalls.get(data.toolCallId);
            if (active) {
              let args: unknown = undefined;
              try {
                args = JSON.parse(active.argStr);
              } catch {
                args = active.argStr;
              }
              toolCalls.push({ name: active.name, args });
              callbacks.onToolCall?.(active.name, args);
              callbacks.onToolResult?.(active.name, data.result);

              if (active.name === "buildHedgeBundle" && isHedgeBundle(data.result)) {
                hedgeBundle = data.result as Record<string, unknown>;
              }
              activeToolCalls.delete(data.toolCallId);
            }
          } catch {
            // skip
          }
          break;
        }

        case "d": {
          try {
            const finishData = JSON.parse(payload);
            if (Array.isArray(finishData)) {
              for (const item of finishData) {
                if (item && typeof item === "object" && "positions" in item) {
                  hedgeBundle = item as Record<string, unknown>;
                }
              }
            }
          } catch {
            // skip
          }
          break;
        }

        case "e": {
          try {
            const errData = JSON.parse(payload);
            throw new Error(
              typeof errData === "string" ? errData : JSON.stringify(errData),
            );
          } catch (e) {
            if (e instanceof Error && e.message !== payload) throw e;
          }
          break;
        }
      }
    }
  }

  return { assistantText, toolCalls, hedgeBundle };
}

function isHedgeBundle(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === "object" &&
    "positions" in (val as Record<string, unknown>) &&
    "totalCost" in (val as Record<string, unknown>)
  );
}
