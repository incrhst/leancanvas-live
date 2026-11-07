// The www host is the primary domain: the bare criticaldash.com redirects to it, and MCP clients
// don't reliably follow redirects or keep the Authorization header across them.
export const MCP_ORIGIN = "https://www.criticaldash.com";
export const MCP_URL = `${MCP_ORIGIN}/api/mcp`;

const LEGACY_HOST = "lean.incrementic.com";

/**
 * The origin to advertise in OAuth and MCP metadata for a request. Clients check that the metadata
 * matches the URL they connected to, so connectors added on the old domain keep getting that domain.
 */
export function mcpOriginFor(req: { headers: Headers }): string {
  return req.headers.get("host") === LEGACY_HOST ? `https://${LEGACY_HOST}` : MCP_ORIGIN;
}
