import { randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { API_BASE, MCP_PATH, type AssistantConnection } from '@open-drama/contracts';
import { db } from '../../db/client';
import { appSettings } from '../../db/schema';
import { env } from '../../env';
import { precondition } from '../../http/errors';
import { rememberSecret } from '../../lib/secrets';

// The assistant endpoint's bearer token (adr-0016): one shared secret the server issues, read by either interface.

const KEY = 'assistantToken';
const PREFIX = '[open-drama assistant]';

const generate = () => randomBytes(32).toString('base64url');

const stored = () => db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).get()?.value ?? null;

const store = (value: string) =>
  db
    .insert(appSettings)
    .values({ key: KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date().toISOString() } })
    .run();

/**
 * The address this server is reached at: the public address when one is configured, else the studio's origin (the
 * web proxy forwards /mcp and /api), else, with the web interface off, the API's own listening address.
 */
export function publicOrigin(): string {
  return env.PUBLIC_BASE_URL ? env.PUBLIC_BASE_URL.replace(/\/+$/, '') : localOrigin();
}

export const assistantEndpoint = () => `${publicOrigin()}${MCP_PATH}`;

/**
 * The address the API answers at on its own machine: the studio's origin (the web proxy forwards /api), else the
 * API's listening address. The public address is not used: a reverse proxy may publish /mcp alone.
 */
export function localOrigin(): string {
  if (env.OPEN_DRAMA_WEB_UI) return env.WEB_ORIGIN.replace(/\/+$/, '');
  const host = env.HOST === '0.0.0.0' || env.HOST === '::' ? 'localhost' : env.HOST;
  return `http://${host}:${env.PORT}`;
}

/** Where the creator's own terminal reaches the REST API from the server's machine (the key command). */
export const apiBaseUrl = () => `${localOrigin()}${API_BASE}`;

/** The token in force: the environment's, else the stored one, generated silently when none exists yet. */
function currentToken(): string {
  if (env.OPEN_DRAMA_ASSISTANT_TOKEN) return env.OPEN_DRAMA_ASSISTANT_TOKEN;
  const existing = stored();
  if (existing) return existing;
  const token = generate();
  store(token);
  rememberSecret(token);
  return token;
}

/** The one place a token is printed: stdout, outside the logger, so a boot log holds it exactly once. */
function printConnectLine(token: string) {
  const lines = [
    `${PREFIX} An access token for AI assistants was generated. Connect with:`,
    `${PREFIX}   claude mcp add --transport http open-drama ${assistantEndpoint()} --header "Authorization: Bearer ${token}"`,
    `${PREFIX} It is shown again in Settings › Assistant and by GET ${apiBaseUrl()}/settings/assistant.`,
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

/**
 * Boot: the token exists before the first request. An environment token is used as is; a stored one is kept; otherwise
 * one is generated and printed once. Both are registered with the scrubber, so an echo of them never reaches a log
 * or an error shown in the studio.
 */
export function ensureAssistantToken(): { enabled: boolean; source: AssistantConnection['source'] | 'none' } {
  if (!env.OPEN_DRAMA_ASSISTANT) return { enabled: false, source: 'none' };
  if (env.OPEN_DRAMA_ASSISTANT_TOKEN) {
    rememberSecret(env.OPEN_DRAMA_ASSISTANT_TOKEN);
    return { enabled: true, source: 'environment' };
  }
  const existing = stored();
  if (existing) {
    rememberSecret(existing);
    return { enabled: true, source: 'generated' };
  }
  const token = generate();
  store(token);
  rememberSecret(token);
  printConnectLine(token);
  return { enabled: true, source: 'generated' };
}

/** `Authorization: Bearer <token>` against the token in force, compared in constant time. */
export function assistantTokenMatches(header: string | undefined): boolean {
  if (!env.OPEN_DRAMA_ASSISTANT || !header) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) return false;
  const given = Buffer.from(match[1] ?? '', 'utf8');
  const expected = Buffer.from(currentToken(), 'utf8');
  if (given.length !== expected.length) {
    // Same work as a real comparison, so the length is not told apart by timing; the answer is still no.
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(given, expected);
}

/** AssistantConnection: what the studio's card and `GET /settings/assistant` show. */
export function getAssistantConnection(): AssistantConnection {
  const enabled = env.OPEN_DRAMA_ASSISTANT;
  return {
    enabled,
    token: enabled ? currentToken() : null,
    source: env.OPEN_DRAMA_ASSISTANT_TOKEN ? 'environment' : 'generated',
    endpoint: assistantEndpoint(),
  };
}

/** RotateAssistantToken: a new generated token; every connected client must be given it. Prints nothing. */
export function rotateAssistantToken(): AssistantConnection {
  if (!env.OPEN_DRAMA_ASSISTANT) throw precondition('The assistant endpoint is off (OPEN_DRAMA_ASSISTANT=0); there is no token to rotate');
  if (env.OPEN_DRAMA_ASSISTANT_TOKEN) {
    throw precondition('The token comes from OPEN_DRAMA_ASSISTANT_TOKEN; change it in the environment and restart');
  }
  const token = generate();
  store(token);
  rememberSecret(token);
  return getAssistantConnection();
}
