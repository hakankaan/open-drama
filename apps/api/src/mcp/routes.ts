import { StreamableHTTPTransport } from '@hono/mcp';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { unauthorized } from '../http/errors';
import { checkedLang } from '../modules/agents/workspace/files';
import { assistantTokenMatches } from '../modules/configuration/assistant';
import { createMcpServer } from './server';

/**
 * The assistant endpoint (adr-0016). Mounted after the request guard, so the Host and page-origin checks have passed.
 * Only POST carries MCP here (stateless: no session, so no GET stream and nothing to DELETE); the bearer token is
 * checked before the transport sees a byte; each request gets its own server and transport, closed when answered.
 * Answers are plain JSON rather than SSE, so a long wait_for_job passes the web proxy unbuffered.
 */
export async function mcpHandler(c: Context): Promise<Response> {
  if (c.req.method !== 'POST') {
    c.header('Allow', 'POST');
    return c.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'The assistant endpoint takes POST requests only' } }, 405);
  }
  if (!assistantTokenMatches(c.req.header('authorization'))) {
    c.header('WWW-Authenticate', 'Bearer realm="open-drama"');
    throw unauthorized('A valid assistant token is required: Authorization: Bearer <token> (Settings › Assistant, or GET /api/v1/settings/assistant)');
  }
  const lang = checkedLang(c.req.query('lang') ?? 'en');
  const server = createMcpServer(lang, c.req.raw.signal);
  const transport = new StreamableHTTPTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return (await transport.handleRequest(c)) ?? c.body(null, 202);
  } catch (err) {
    // The transport answers a malformed body or a wrong Accept header with a JSON-RPC error of its own; the API's
    // envelope would hide it from the client.
    if (err instanceof HTTPException && err.res) return err.getResponse();
    throw err;
  } finally {
    await transport.close();
    await server.close();
  }
}
