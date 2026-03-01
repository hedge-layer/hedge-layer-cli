/**
 * Parses the Vercel AI SDK UI Message Stream protocol (SSE format).
 *
 * The server sends Server-Sent Events where each `data:` line contains
 * a JSON object with a `type` field:
 *   text-delta:           { type, id, delta }
 *   tool-input-start:     { type, toolCallId, toolName }
 *   tool-input-delta:     { type, toolCallId, inputTextDelta }
 *   tool-input-available: { type, toolCallId, toolName, input }
 *   tool-output-available:{ type, toolCallId, output }
 *   error:                { type, errorText }
 *   [DONE]:               stream termination sentinel
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
    if (!done) {
      buffer += decoder.decode(value, { stream: true });
    }

    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;

      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();

      if (payload === "[DONE]") continue;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(payload);
      } catch {
        continue;
      }

      const type = msg.type as string;

      switch (type) {
        case "text-delta": {
          const delta = msg.delta as string;
          if (delta) {
            assistantText += delta;
            callbacks.onText?.(delta);
          }
          break;
        }

        case "tool-input-start": {
          const id = msg.toolCallId as string;
          const name = msg.toolName as string;
          if (id && name) {
            activeToolCalls.set(id, { name, argStr: "" });
          }
          break;
        }

        case "tool-input-delta": {
          const id = msg.toolCallId as string;
          const active = activeToolCalls.get(id);
          if (active) {
            active.argStr += msg.inputTextDelta as string;
          }
          break;
        }

        case "tool-input-available": {
          const id = msg.toolCallId as string;
          const active = activeToolCalls.get(id);
          if (active) {
            const args = msg.input ?? active.argStr;
            toolCalls.push({ name: active.name, args });
            callbacks.onToolCall?.(active.name, args);
          }
          break;
        }

        case "tool-output-available": {
          const id = msg.toolCallId as string;
          const active = activeToolCalls.get(id);
          if (active) {
            callbacks.onToolResult?.(active.name, msg.output);
            if (active.name === "buildHedgeBundle" && isHedgeBundle(msg.output)) {
              hedgeBundle = msg.output as Record<string, unknown>;
            }
            activeToolCalls.delete(id);
          }
          break;
        }

        case "error": {
          throw new Error((msg.errorText as string) ?? "Unknown stream error");
        }
      }
    }

    if (done) break;
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
