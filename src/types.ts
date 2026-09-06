export interface GlobalOptions {
  apiUrl?: string;
  token?: string;
  verbose?: boolean;
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolCatalog {
  tools: Tool[];
}

export interface ToolResult {
  content: unknown[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}
