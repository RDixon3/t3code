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

export const JIRA_MCP_URL = "https://mcp.atlassian.com/v2/mcp";

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
    new StreamableHTTPClientTransport(new URL(JIRA_MCP_URL), {
      authProvider: provider,
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(30_000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        }),
    });
  const probe =
    deps.probe ??
    (async (provider, signal) => {
      const client = new Client({ name: "t3-code-jira", version: "1.0.0" });
      try {
        // SDK 1.x's concrete transport declares optional members as T | undefined.
        await client.connect(transport(provider, signal) as Transport, { signal, timeout: 30_000 });
        await client.listTools({}, { signal, timeout: 30_000 });
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
      const saved = interactive ? undefined : await load();
      if (!interactive && !saved) throw new Error("Connect to Jira first.");
      const state = NodeCrypto.randomUUID();
      const callback = interactive ? await listenForJiraOAuth(state, signal) : undefined;
      const credentials: Credentials = saved ?? { redirectUrl: callback!.redirectUrl };
      let verifier: string | undefined;
      let redirected = false;
      const provider: OAuthClientProvider = {
        redirectUrl: credentials.redirectUrl,
        clientMetadata: {
          client_name: "T3 Code Jira",
          redirect_uris: [credentials.redirectUrl],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        state: () => state,
        clientInformation: () => credentials.client,
        saveClientInformation: (client) => {
          credentials.client = client;
        },
        tokens: () => credentials.tokens,
        saveTokens: async (tokens) => {
          signal.throwIfAborted();
          credentials.tokens = tokens;
          // Persist rotated refresh tokens even if a subsequent MCP probe fails.
          await deps.write(JSON.stringify(credentials));
        },
        saveCodeVerifier: (value) => {
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
          await deps.openExternal(url.href);
        },
      };
      try {
        try {
          await probe(provider, signal);
        } catch (error) {
          if (!(error instanceof UnauthorizedError) || !redirected || !callback) throw error;
          await finishAuth(provider, await callback.code, signal);
          await probe(provider, signal);
        }
        signal.throwIfAborted();
        if (!credentials.tokens || !credentials.client)
          throw new Error("Atlassian did not complete authorization.");
        checkedAt = new Date().toISOString();
        return { connected: true, checkedAt };
      } finally {
        callback?.close();
      }
    })().finally(() => {
      pending = undefined;
    });
    pending = { abort, done };
    return done;
  };
  return {
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
