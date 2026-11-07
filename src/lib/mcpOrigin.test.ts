import { describe, expect, it } from "vitest";
import { MCP_ORIGIN, MCP_URL, mcpOriginFor } from "./mcpOrigin";

const forHost = (host: string) => mcpOriginFor({ headers: new Headers({ host }) });

describe("mcpOriginFor", () => {
  it("uses criticaldash.com for the primary domain and for any other host", () => {
    expect(forHost("www.criticaldash.com")).toBe("https://www.criticaldash.com");
    expect(forHost("localhost:3000")).toBe(MCP_ORIGIN);
  });

  it("keeps the old domain for connectors already added there", () => {
    expect(forHost("lean.incrementic.com")).toBe("https://lean.incrementic.com");
  });

  it("publishes the MCP URL on criticaldash.com", () => {
    expect(MCP_URL).toBe("https://www.criticaldash.com/api/mcp");
  });
});
