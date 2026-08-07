import { PassThrough, Writable } from "node:stream";
import readline from "node:readline/promises";
import { describe, expect, it, vi } from "vitest";

import * as auth from "./auth.js";

type PromptHidden = (
  prompt: string,
  options: {
    input: PassThrough;
    output: Writable;
    createInterface: typeof readline.createInterface;
  },
) => Promise<string>;

describe("promptHidden", () => {
  it("returns the token without writing token characters to the terminal", async () => {
    const secret = `hl_${"a".repeat(40)}`;
    let terminalOutput = "";
    const output = new Writable({
      write(chunk, _encoding, callback) {
        terminalOutput += chunk.toString();
        callback();
      },
    });
    const close = vi.fn();
    const createInterface = vi.fn(({ output: promptOutput }) => ({
      question: async () => {
        promptOutput.write(secret);
        return `  ${secret}  `;
      },
      close,
    })) as unknown as typeof readline.createInterface;

    const promptHidden = (auth as unknown as { promptHidden?: PromptHidden }).promptHidden;
    expect(promptHidden).toBeTypeOf("function");

    const token = await promptHidden!("Paste your API token: ", {
      input: new PassThrough(),
      output,
      createInterface,
    });

    expect(token).toBe(secret);
    expect(terminalOutput).toBe("Paste your API token: \n");
    expect(terminalOutput).not.toContain(secret);
    expect(close).toHaveBeenCalledOnce();
  });
});
