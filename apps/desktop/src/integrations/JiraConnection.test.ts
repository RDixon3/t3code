// @effect-diagnostics globalFetch:off -- Exercises the real OAuth loopback callback; no external network or account access.
import { describe, expect, it, vi } from "vite-plus/test";
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { listenForJiraOAuth, makeJiraConnection } from "./JiraConnection.ts";

const saved = JSON.stringify({
  redirectUrl: "http://127.0.0.1:12345/jira/callback",
  client: { client_id: "test-client" },
  tokens: { access_token: "old-token", refresh_token: "refresh-token", token_type: "Bearer" },
});

function fixture(initial?: string) {
  let value = initial;
  let opened = 0;
  const deps = {
    read: async () => value,
    write: async (next: string) => {
      value = next;
    },
    remove: async () => {
      value = undefined;
    },
    openExternal: async () => {
      opened++;
    },
  };
  return { deps, value: () => value, opened: () => opened };
}

describe("Jira connection", () => {
  it.each(["success", "tool-error", "invalid-schema"])(
    "reports post-auth discovery and tool outcomes: %s",
    async (outcome) => {
      const f = fixture(saved);
      const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        if (init?.method === "GET") return new Response(null, { status: 405 });
        const message = JSON.parse(String(init?.body));
        if (message.method === "notifications/initialized")
          return new Response(null, { status: 202 });
        let result: unknown;
        if (message.method === "initialize")
          result = {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "atlassian-test", version: "2" },
          };
        else if (message.method === "tools/list") {
          result =
            outcome === "invalid-schema"
              ? { tools: [{ name: "broken", inputSchema: { type: "string" } }] }
              : message.params?.cursor
                ? { tools: [{ name: "other", inputSchema: { type: "object" } }] }
                : {
                    tools: [
                      {
                        name: "getAccessibleAtlassianResources",
                        inputSchema: { type: "object", properties: {} },
                      },
                    ],
                    nextCursor: "next",
                  };
        } else if (message.method === "tools/call")
          result = {
            isError: outcome === "tool-error",
            content: [
              {
                type: "text",
                text: outcome === "tool-error" ? "MCP permission denied; Bearer do-not-log" : "[]",
              },
            ],
          };
        else throw new Error(`Unexpected method ${message.method}`);
        return Response.json(
          { jsonrpc: "2.0", id: message.id, result },
          { headers: { "x-request-id": "test-request-id" } },
        );
      });
      try {
        const connection = makeJiraConnection(f.deps);
        if (outcome === "success") expect((await connection.test()).checkedAt).not.toBeNull();
        else {
          await expect(connection.test()).rejects.toThrow(
            outcome === "tool-error" ? "tools/call" : "tools/list",
          );
          expect(await connection.status()).toEqual({ connected: true, checkedAt: null });
        }
        const log = connection.diagnostics();
        expect(log).toContain("atlassian-test");
        expect(log).toContain("test-request-id");
        if (outcome !== "invalid-schema") {
          expect(log).toContain("Complete: 2 advertised tools");
          expect(log).toContain("getAccessibleAtlassianResources");
        }
        if (outcome === "tool-error") expect(log).toContain("MCP permission denied");
        expect(log).not.toContain("old-token");
        expect(log).not.toContain("do-not-log");
      } finally {
        mock.mockRestore();
      }
    },
  );

  it("runs v1 discovery, PKCE exchange and tools probe end to end", async () => {
    const f = fixture();
    const nativeFetch = globalThis.fetch;
    let redirectUri = "";
    let tokenExchanged = false;
    const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "127.0.0.1") return nativeFetch(input, init);
      if (url.pathname.includes("oauth-protected-resource"))
        return Response.json({
          resource: `https://mcp.atlassian.com/v1/mcp`,
          authorization_servers: ["https://auth.atlassian.com"],
        });
      if (url.pathname.includes("oauth-authorization-server"))
        return Response.json({
          issuer: "https://auth.atlassian.com",
          authorization_endpoint: "https://auth.atlassian.com/authorize",
          token_endpoint: "https://auth.atlassian.com/token",
          registration_endpoint: "https://auth.atlassian.com/register",
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
        });
      if (url.pathname === "/register") {
        const metadata = JSON.parse(String(init?.body));
        redirectUri = metadata.redirect_uris[0];
        return Response.json({ ...metadata, client_id: "test-client" });
      }
      if (url.pathname === "/token") {
        const form = new URLSearchParams(String(init?.body));
        expect(form.get("code")).toBe("authorized-code");
        expect(form.get("code_verifier")).toBeTruthy();
        expect(form.get("redirect_uri")).toBe(redirectUri);
        tokenExchanged = true;
        return Response.json({
          access_token: "access",
          refresh_token: "refresh",
          token_type: "Bearer",
        });
      }
      if (url.pathname === `/v1/mcp`) {
        if (new Headers(init?.headers).get("authorization") !== "Bearer access") {
          return new Response(null, {
            status: 401,
            headers: {
              "WWW-Authenticate": `Bearer resource_metadata="https://mcp.atlassian.com/.well-known/oauth-protected-resource/v1/mcp"`,
            },
          });
        }
        if (init?.method === "GET") return new Response(null, { status: 405 });
        const message = JSON.parse(String(init?.body));
        if (message.method === "notifications/initialized")
          return new Response(null, { status: 202 });
        return Response.json({
          jsonrpc: "2.0",
          id: message.id,
          result:
            message.method === "initialize"
              ? {
                  protocolVersion: "2025-03-26",
                  capabilities: { tools: {} },
                  serverInfo: { name: "test-atlassian", version: "1" },
                }
              : { tools: [] },
        });
      }
      throw new Error(`Unexpected request to ${url.origin}${url.pathname}`);
    });
    try {
      const connection = makeJiraConnection({
        ...f.deps,
        openExternal: async (address) => {
          const authorization = new URL(address);
          expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
          const callback = new URL(redirectUri);
          callback.searchParams.set("state", authorization.searchParams.get("state")!);
          callback.searchParams.set("code", "authorized-code");
          await nativeFetch(callback);
        },
      });
      expect((await connection.connect()).checkedAt).not.toBeNull();
      expect(tokenExchanged).toBe(true);
      expect((await connection.test()).connected).toBe(true);
      expect(connection.diagnostics()).toContain(`/v1/mcp`);
      expect(connection.diagnostics()).toContain("tools/list: Complete");
    } finally {
      mock.mockRestore();
    }
  });
  it("starts disconnected and does not open sign-in when testing without credentials", async () => {
    const f = fixture();
    const connection = makeJiraConnection(f.deps);
    expect(await connection.status()).toEqual({ connected: false, checkedAt: null });
    await expect(connection.test()).rejects.toThrow("Connect to Jira first");
    expect(f.opened()).toBe(0);
  });

  it("retains rotated tokens after a failed probe without claiming verified access", async () => {
    const f = fixture(saved);
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (provider) => {
        expect((await provider.tokens())?.access_token).toBe("old-token");
        await provider.saveTokens({
          access_token: "new-token",
          refresh_token: "rotated",
          token_type: "Bearer",
        });
        throw new Error("MCP unavailable");
      },
    });
    await expect(connection.test()).rejects.toThrow("MCP unavailable");
    expect(JSON.parse(f.value()!).tokens.refresh_token).toBe("rotated");
    expect(await connection.status()).toEqual({ connected: true, checkedAt: null });
    expect(f.opened()).toBe(0);
  });

  it("reconnects with fresh SSO credentials and verifies MCP before reporting connected", async () => {
    const f = fixture(saved);
    let provider: OAuthClientProvider;
    let probes = 0;
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (next) => {
        provider = next;
        if (++probes === 1) {
          expect(await provider.tokens()).toBeUndefined();
          expect(await provider.clientInformation()).toBeUndefined();
          await provider.saveClientInformation!({ client_id: "test-client" });
          await provider.saveCodeVerifier("test-verifier");
          await provider.redirectToAuthorization(new URL("https://auth.atlassian.com/authorize"));
          throw new UnauthorizedError();
        }
        expect((await provider.tokens())?.access_token).toBe("access");
      },
      openExternal: async () => {
        const callback = new URL(String(provider.redirectUrl));
        callback.searchParams.set("state", await provider.state!());
        callback.searchParams.set("code", "test-code");
        expect((await fetch(callback)).status).toBe(200);
      },
      finishAuth: async (next, code) => {
        expect(code).toBe("test-code");
        expect(await next.codeVerifier()).toBe("test-verifier");
        await next.saveTokens({ access_token: "access", token_type: "Bearer" });
      },
    });
    const status = await connection.connect();
    expect(status.connected).toBe(true);
    expect(status.checkedAt).not.toBeNull();
    expect(probes).toBe(2);
    expect(f.value()).not.toContain("test-verifier");
    expect(await connection.disconnect()).toEqual({ connected: false, checkedAt: null });
    expect(f.value()).toBeUndefined();
  });

  it("ignores mismatched state and accepts only its own callback", async () => {
    const callback = await listenForJiraOAuth("expected", new AbortController().signal);
    try {
      expect((await fetch(`${callback.redirectUrl}?state=wrong&code=bad`)).status).toBe(400);
      expect((await fetch(`${callback.redirectUrl}?state=expected&code=good`)).status).toBe(200);
      expect(await callback.code).toBe("good");
    } finally {
      callback.close();
    }
  });

  it("reports declined sign-in and closes an aborted callback listener", async () => {
    const controller = new AbortController();
    const callback = await listenForJiraOAuth("expected", controller.signal);
    await fetch(`${callback.redirectUrl}?state=expected&error=access_denied`);
    await expect(callback.code).rejects.toThrow("declined");
    controller.abort();
    await expect(fetch(callback.redirectUrl)).rejects.toThrow();
  });

  it("cancels an in-flight sign-in and removes credentials after it settles", async () => {
    const f = fixture(saved);
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (provider, signal) => {
        started();
        await new Promise<void>((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }),
        );
        await provider.saveTokens({ access_token: "must-not-save", token_type: "Bearer" });
      },
    });
    const connecting = connection.connect();
    expect(connection.connect()).toBe(connecting);
    const rejected = expect(connecting).rejects.toThrow("cancelled");
    await ready;
    await connection.disconnect();
    await rejected;
    expect(f.value()).toBeUndefined();
  });

  it("requires reconnect instead of opening a browser during Test connection", async () => {
    const f = fixture(saved);
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (provider) => {
        await provider.redirectToAuthorization(new URL("https://auth.atlassian.com/authorize"));
      },
    });
    await expect(connection.test()).rejects.toThrow("Reconnect");
    expect(f.opened()).toBe(0);
  });
});
