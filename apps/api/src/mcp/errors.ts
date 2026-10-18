import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import { ApiError } from '../http/errors';
import { logger } from '../http/logger';
import { scrubSecrets } from '../lib/secrets';

// Every tool is declared through `tool()`: a contract input schema, a contract output schema, the service call, and
// one mapping of the service's ApiError to a tool error the assistant can read (adr-0016). Nothing else differs
// between tools, so nothing else is written per tool.

export interface ToolSpec<In extends z.ZodObject, Out extends z.ZodType<Record<string, unknown>>> {
  title: string;
  description: string;
  input: In;
  output: Out;
  /** Reads nothing but the database. */
  readOnly?: boolean;
  /** Repeating the call with the same arguments changes nothing more. */
  idempotent?: boolean;
  /** Deletes or cancels: Claude Code asks the creator before every call (`anthropic/requiresUserInteraction`). */
  confirm?: boolean;
}

/** The service's refusal as the assistant reads it: the code, the text, and the details when there are any. */
function failure(err: unknown): CallToolResult {
  if (err instanceof ApiError) {
    const details = err.details === undefined ? '' : `\n${JSON.stringify(err.details)}`;
    return { isError: true, content: [{ type: 'text', text: `${err.code}: ${err.message}${details}` }] };
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err: scrubSecrets(err instanceof Error ? (err.stack ?? message) : message) }, 'mcp tool failed');
  return { isError: true, content: [{ type: 'text', text: `INTERNAL: ${scrubSecrets(message)}` }] };
}

export function tool<In extends z.ZodObject, Out extends z.ZodType<Record<string, unknown>>>(
  server: McpServer,
  name: string,
  spec: ToolSpec<In, Out>,
  run: (args: z.output<In>, extra: Parameters<ToolCallback<In>>[1]) => z.input<Out> | Promise<z.input<Out>>,
): void {
  server.registerTool(
    name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.input,
      outputSchema: spec.output,
      annotations: {
        readOnlyHint: spec.readOnly ?? false,
        destructiveHint: spec.confirm ?? false,
        idempotentHint: spec.idempotent ?? spec.readOnly ?? false,
        openWorldHint: false,
      },
      ...(spec.confirm ? { _meta: { 'anthropic/requiresUserInteraction': true } } : {}),
    },
    (async (args: z.output<In>, extra: Parameters<ToolCallback<In>>[1]): Promise<CallToolResult> => {
      try {
        const result = (await run(args, extra)) as Record<string, unknown>;
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result };
      } catch (err) {
        return failure(err);
      }
    }) as ToolCallback<In>,
  );
}

/** Where the studio shows a thing, for an assistant that has a studio address to prefix it with. */
export const studioPath = {
  drama: (dramaId: number, tab?: 'story' | 'assets') => (tab ? `/drama/${dramaId}?tab=${tab}` : `/drama/${dramaId}`),
  episode: (dramaId: number, episodeNumber: number) => `/drama/${dramaId}/episode/${episodeNumber}`,
};
