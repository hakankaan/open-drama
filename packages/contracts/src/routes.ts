/** Base path of the HTTP API (adr-0007). */
export const API_BASE = '/api/v1';

/** Path under which the API serves the storage root. Media paths are stored relative (`static/…`). */
export const STATIC_PREFIX = '/static';

/** The assistant endpoint (adr-0016): MCP over Streamable HTTP on the API's own port, outside the versioned base. */
export const MCP_PATH = '/mcp';
