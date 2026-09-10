// @effect-diagnostics nodeBuiltinImport:off globalFetch:off globalDate:off -- MCP SDK adapter owns a Node loopback callback and uses the SDK's Fetch/Promise interfaces.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  OAuthClientInformationSchema,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JiraConnectionStatus } from "@t3tools/contracts";
import * as NodeCrypto from "node:crypto";
import { listenForOAuth } from "./oauthCallback.ts";
import { makeJiraDiagnostics } from "./jiraDiagnostics.ts";

export const listenForJiraOAuth = (state: string, signal: AbortSignal) =>
  listenForOAuth(state, signal, { path: "/jira/callback", port: 0, name: "Jira" });

type Credentials = {
  redirectUrl: string;
  client?: ReturnType<typeof OAuthClientInformationSchema.parse> | undefined;
  tokens?: ReturnType<typeof OAuthTokensSchema.parse> | undefined;
};

/** One app connection, independent of agent providers and project/thread state. */
export function makeJiraConnection(deps: {
  read: () => Promise<string | undefined>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  probe?: (provider: OAuthClientProvider, signal: AbortSignal) => Promise<void>;
  finishAuth?: (provider: OAuthClientProvider, code: string, signal: AbortSignal) => Promise<void>;
}) {
  const endpoint = "https://mcp.atlassian.com/v1/mcp";
  const diagnostics = makeJiraDiagnostics();
  let stage = "idle";
  let pending: { abort: AbortController; done: Promise<JiraConnectionStatus> } | undefined;
  let checkedAt: string | null = null;
  const load = async (): Promise<Credentials | undefined> => {
    const raw = await deps.read();
    if (!raw) return undefined;
    const value = JSON.parse(raw);
    const redirect = new URL(value.redirectUrl);
    if (
      redirect.protocol !== "http:" ||
      redirect.hostname !== "127.0.0.1" ||
      redirect.pathname !== "/jira/callback"
    ) {
      throw new Error("Saved Jira connection is invalid. Disconnect and sign in again.");
    }
    return {
      redirectUrl: redirect.href,
      client: OAuthClientInformationSchema.parse(value.client),
      tokens: OAuthTokensSchema.parse(value.tokens),
    };
  };
  const status = async (): Promise<JiraConnectionStatus> => ({
    connected: Boolean(await load()),
    checkedAt,
  });
  const transport = (provider: OAuthClientProvider, signal: AbortSignal) =>
    new StreamableHTTPClientTransport(new URL(endpoint), {
      authProvider: provider,
      fetch: async (url, init) => {
        const address = new URL(url instanceof Request ? url.url : String(url));
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(30_000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        });
        diagnostics.add(
          "HTTP",
          `${init?.method ?? "GET"} ${address.origin}${address.pathname} → ${response.status}; protocol=${new Headers(init?.headers).get("mcp-protocol-version") ?? "negotiating"}; content-type=${response.headers.get("content-type") ?? "none"}; request-id=${response.headers.get("x-request-id") ?? response.headers.get("atl-traceid") ?? "none"}`,
        );
        return response;
      },
    });
  const probe =
    deps.probe ??
    (async (provider, signal) => {
      const client = new Client({ name: "t3-code-jira", version: "1.0.0" });
      try {
        stage = "initialize";
        // SDK 1.x's concrete transport declares optional members as T | undefined.
        await client.connect(transport(provider, signal) as Transport, { signal, timeout: 30_000 });
        diagnostics.add(
          stage,
          JSON.stringify({
            server: client.getServerVersion(),
            capabilities: client.getServerCapabilities(),
          }),
        );
        stage = "tools/list";
        let cursor: string | undefined;
        const cursors = new Set<string>();
        const tools = [];
        do {
          const page = await client.listTools(cursor ? { cursor } : {}, {
            signal,
            timeout: 30_000,
          });
          diagnostics.add(
            stage,
            `page=${cursors.size + 1}; tools=${page.tools.length}; more=${Boolean(page.nextCursor)}`,
          );
          for (const tool of page.tools) {
            diagnostics.add(
              "tool",
              JSON.stringify({
                name: tool.name,
                inputType: tool.inputSchema.type,
                properties: Object.keys(tool.inputSchema.properties ?? {}),
                required: tool.inputSchema.required ?? [],
                outputSchema: Boolean(tool.outputSchema),
                annotations: tool.annotations,
              }),
            );
            tools.push(tool);
          }
          cursor = page.nextCursor;
          if (cursor && (cursors.has(cursor) || cursors.size >= 49))
            throw new Error("Tool discovery returned a repeated cursor or exceeded 50 pages.");
          if (cursor) cursors.add(cursor);
        } while (cursor);
        diagnostics.add(
          stage,
          `Complete: ${tools.length} advertised tools. Discovery does not verify every tool invocation.`,
        );
        const resourcesTool = tools.find((tool) => tool.name === "getAccessibleAtlassianResources");
        if (resourcesTool && !resourcesTool.inputSchema.required?.length) {
          stage = "tools/call getAccessibleAtlassianResources";
          const result = await client.callTool(
            { name: resourcesTool.name, arguments: {} },
            undefined,
            { signal, timeout: 30_000 },
          );
          diagnostics.add(
            stage,
            `isError=${Boolean(result.isError)}; resultKeys=${Object.keys(result).join(",")}`,
          );
          if (result.isError) {
            const content = Array.isArray(result.content) ? result.content : [];
            for (const item of content)
              if (item.type === "text" && typeof item.text === "string")
                diagnostics.add("tool error", item.text);
            throw new Error("Atlassian resource discovery returned a tool error. See diagnostics.");
          }
        } else
          diagnostics.add(
            "tools/call",
            "Skipped: no parameter-free resource discovery tool advertised. No issue tools were invoked.",
          );
      } finally {
        await client.close();
      }
    });
  const finishAuth =
    deps.finishAuth ??
    (async (provider, code, signal) => {
      const connection = transport(provider, signal);
      try {
        await connection.finishAuth(code);
      } finally {
        await connection.close();
      }
    });
  const run = (interactive: boolean): Promise<JiraConnectionStatus> => {
    if (pending) return pending.done;
    const abort = new AbortController();
    const signal = AbortSignal.any([
      abort.signal,
      AbortSignal.timeout(interactive ? 300_000 : 45_000),
    ]);
    const done = (async () => {
      checkedAt = null;
      diagnostics.reset();
      stage = "credentials";
      diagnostics.add(
        "run",
        `${new Date().toISOString()} ${interactive ? "Connect" : "Test"} ${endpoint}`,
      );
      const saved = interactive ? undefined : await load();
      diagnostics.add(
        "credentials",
        saved ? "Using stored credentials for this endpoint." : "Starting fresh authorization.",
      );
      if (!interactive && !saved) throw new Error("Connect to Jira first.");
      const state = NodeCrypto.randomUUID();
      const callback = interactive ? await listenForJiraOAuth(state, signal) : undefined;
      const credentials: Credentials = saved ?? { redirectUrl: callback!.redirectUrl };
      diagnostics.protect(
        state,
        credentials.tokens?.access_token,
        credentials.tokens?.refresh_token,
        credentials.client?.client_id,
        credentials.client?.client_secret,
      );
      let verifier: string | undefined;
      let redirected = false;
      const provider: OAuthClientProvider = {
        redirectUrl: credentials.redirectUrl,
        clientMetadata: {
          client_name: "CoCo Jira v1",
          redirect_uris: [credentials.redirectUrl],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        state: () => state,
        clientInformation: () => credentials.client,
        saveClientInformation: (client) => {
          diagnostics.protect(client.client_id, client.client_secret);
          credentials.client = client;
        },
        tokens: () => credentials.tokens,
        saveTokens: async (tokens) => {
          signal.throwIfAborted();
          credentials.tokens = tokens;
          diagnostics.protect(tokens.access_token, tokens.refresh_token);
          // Persist rotated refresh tokens even if a subsequent MCP probe fails.
          await deps.write(JSON.stringify(credentials));
          diagnostics.add("OAuth", "Tokens received and saved. MCP verification pending.");
        },
        saveCodeVerifier: (value) => {
          diagnostics.protect(value);
          verifier = value;
        },
        codeVerifier: () => {
          if (!verifier) throw new Error("Jira sign-in expired. Try again.");
          return verifier;
        },
        redirectToAuthorization: async (url) => {
          if (!interactive) throw new Error("Jira sign-in expired. Reconnect to continue.");
          if (
            url.protocol !== "https:" ||
            !(url.hostname === "atlassian.com" || url.hostname.endsWith(".atlassian.com"))
          ) {
            throw new Error("Unexpected Atlassian sign-in address.");
          }
          redirected = true;
          diagnostics.add("OAuth", "Opening Atlassian authorization in browser.");
          await deps.openExternal(url.href);
        },
      };
      try {
        try {
          await probe(provider, signal);
        } catch (error) {
          if (!(error instanceof UnauthorizedError) || !redirected || !callback) throw error;
          stage = "OAuth token exchange";
          const code = await callback.code;
          diagnostics.protect(code);
          await finishAuth(provider, code, signal);
          await probe(provider, signal);
        }
        signal.throwIfAborted();
        if (!credentials.tokens || !credentials.client)
          throw new Error("Atlassian did not complete authorization.");
        checkedAt = new Date().toISOString();
        diagnostics.add("result", "MCP checks passed.");
        return { connected: true, checkedAt };
      } finally {
        callback?.close();
      }
    })()
      .catch((cause: unknown) => {
        diagnostics.add(
          `FAILED ${stage}`,
          cause instanceof Error ? `${cause.name}: ${cause.message}` : "Unknown failure",
        );
        if (cause && typeof cause === "object" && "code" in cause)
          diagnostics.add("error code", String(cause.code));
        throw new Error(
          `Jira failed at ${stage}. ${
            diagnostics
              .text()
              .split("\n")
              .findLast((line) => line.startsWith("FAILED")) ?? "See diagnostics."
          }`,
        );
      })
      .finally(() => {
        pending = undefined;
      });
    pending = { abort, done };
    return done;
  };
  return {
    diagnostics: diagnostics.text,
    status,
    connect: () => run(true),
    test: () => run(false),
    disconnect: async (): Promise<JiraConnectionStatus> => {
      const current = pending;
      current?.abort.abort();
      await current?.done.catch(() => {});
      await deps.remove();
      checkedAt = null;
      return { connected: false, checkedAt };
    },
  };
}
