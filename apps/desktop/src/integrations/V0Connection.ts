// @effect-diagnostics nodeBuiltinImport:off globalFetch:off globalDate:off -- Promise-based MCP/OAuth adapter uses a desktop loopback callback.
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
import type { V0ConnectionStatus } from "@t3tools/contracts";
import * as NodeCrypto from "node:crypto";
import { listenForOAuth } from "./oauthCallback.ts";
import { describeV0Error, makeV0Diagnostics, V0ConnectionError } from "./v0Diagnostics.ts";

export const V0_MCP_ENDPOINT = "https://v0.app/api/mcp";
export const listenForV0OAuth = (state: string, signal: AbortSignal) =>
  listenForOAuth(state, signal, { path: "/v0/callback", port: 0, name: "v0" });

type Credentials = {
  redirectUrl: string;
  client?: ReturnType<typeof OAuthClientInformationSchema.parse> | undefined;
  tokens?: ReturnType<typeof OAuthTokensSchema.parse> | undefined;
};

/** Desktop-owned authorization, independent of agent provider and project state. */
export function makeV0Connection(deps: {
  fetch?: typeof globalThis.fetch;
  read: () => Promise<string | undefined>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  listenForAuth?: typeof listenForV0OAuth;
  probe?: (provider: OAuthClientProvider, signal: AbortSignal) => Promise<void>;
  finishAuth?: (provider: OAuthClientProvider, code: string, signal: AbortSignal) => Promise<void>;
}) {
  const diagnostics = makeV0Diagnostics();
  let checkedAt: string | null = null;
  let needsReauthentication = false;
  let generation = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let active: AbortController | undefined;
  let stopping: Promise<V0ConnectionStatus> | undefined;
  let removeOnStop = false;
  let stage = "idle";

  const load = async (): Promise<Credentials | undefined> => {
    const raw = await deps.read();
    if (!raw) return undefined;
    const value = JSON.parse(raw);
    const redirect = new URL(value.redirectUrl);
    if (
      redirect.protocol !== "http:" ||
      redirect.hostname !== "127.0.0.1" ||
      redirect.pathname !== "/v0/callback" ||
      redirect.username ||
      redirect.password ||
      redirect.search ||
      redirect.hash
    )
      throw new V0ConnectionError("Saved v0 connection is invalid. Disconnect and sign in again.");
    return {
      redirectUrl: redirect.href,
      client: value.client ? OAuthClientInformationSchema.parse(value.client) : undefined,
      tokens: value.tokens ? OAuthTokensSchema.parse(value.tokens) : undefined,
    };
  };
  const status = async (): Promise<V0ConnectionStatus> => {
    const saved = await load();
    return {
      connected: Boolean(saved?.tokens && saved.client),
      checkedAt,
      needsReauthentication: needsReauthentication || Boolean(saved?.client && !saved.tokens),
    };
  };
  const transport = (provider: OAuthClientProvider, signal: AbortSignal) =>
    new StreamableHTTPClientTransport(new URL(V0_MCP_ENDPOINT), {
      authProvider: provider,
      fetch: async (url, init) => {
        const address = new URL(url instanceof Request ? url.url : String(url));
        const label = `${init?.method ?? "GET"} ${address.origin}${address.pathname}`;
        try {
          const response = await (deps.fetch ?? globalThis.fetch)(url, {
            ...init,
            signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]),
          });
          diagnostics.add("HTTP", `${label}; status=${response.status}`);
          return response;
        } catch (error) {
          diagnostics.add("HTTP failed", `${label}; ${describeV0Error(error)}`);
          throw error;
        }
      },
    });
  const probe =
    deps.probe ??
    (async (provider, signal) => {
      const client = new Client({ name: "coco-v0", version: "1.0.0" });
      try {
        stage = "initialize";
        await client.connect(transport(provider, signal) as Transport, { signal, timeout: 30_000 });
        diagnostics.add(stage, "MCP initialization succeeded.");
        const cursors = new Set<string>();
        let cursor: string | undefined;
        let count = 0;
        do {
          stage = "tools/list";
          const page = await client.listTools(cursor ? { cursor } : {}, {
            signal,
            timeout: 30_000,
          });
          count += page.tools.length;
          for (const tool of page.tools)
            diagnostics.add(
              "tool",
              JSON.stringify({
                name: tool.name,
                properties: Object.keys(tool.inputSchema.properties ?? {}),
                required: tool.inputSchema.required ?? [],
                readOnly: tool.annotations?.readOnlyHint === true,
              }),
            );
          cursor = page.nextCursor;
          if (cursor && (cursors.has(cursor) || cursors.size >= 49))
            throw new V0ConnectionError(
              "v0 tool discovery repeated a cursor or exceeded 50 pages.",
            );
          if (cursor) cursors.add(cursor);
        } while (cursor);
        diagnostics.add(
          stage,
          `${count} tools discovered. No generation or tool invocation was started.`,
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

  const run = (interactive: boolean): Promise<V0ConnectionStatus> => {
    if (stopping)
      return Promise.reject(new V0ConnectionError("v0 is disconnecting. Try again afterwards."));
    const expectedGeneration = generation;
    const done = queue
      .catch(() => {})
      .then(async () => {
        if (generation !== expectedGeneration) throw new V0ConnectionError("v0 request cancelled.");
        const abort = new AbortController();
        active = abort;
        const signal = AbortSignal.any([
          abort.signal,
          AbortSignal.timeout(interactive ? 300_000 : 60_000),
        ]);
        diagnostics.reset();
        checkedAt = null;
        stage = "credentials";
        diagnostics.add(
          "run",
          `${new Date().toISOString()} ${interactive ? "Connect" : "Test"} ${V0_MCP_ENDPOINT}`,
        );
        let callback: Awaited<ReturnType<typeof listenForV0OAuth>> | undefined;
        try {
          const saved = interactive ? undefined : await load();
          signal.throwIfAborted();
          if (!interactive && !saved?.tokens) throw new V0ConnectionError("Connect to v0 first.");
          const state = NodeCrypto.randomUUID();
          callback = interactive
            ? await (deps.listenForAuth ?? listenForV0OAuth)(state, signal)
            : undefined;
          signal.throwIfAborted();
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
          const persist = async () => {
            signal.throwIfAborted();
            await deps.write(JSON.stringify(credentials));
            signal.throwIfAborted();
          };
          const provider: OAuthClientProvider = {
            redirectUrl: credentials.redirectUrl,
            clientMetadata: {
              client_name: "CoCo v0",
              redirect_uris: [credentials.redirectUrl],
              grant_types: ["authorization_code", "refresh_token"],
              response_types: ["code"],
              token_endpoint_auth_method: "none",
              scope: "mcp",
            },
            state: () => state,
            clientInformation: () => credentials.client,
            saveClientInformation: (client) => {
              signal.throwIfAborted();
              diagnostics.protect(client.client_id, client.client_secret);
              credentials.client = client;
            },
            tokens: () => credentials.tokens,
            saveTokens: async (tokens) => {
              signal.throwIfAborted();
              diagnostics.protect(tokens.access_token, tokens.refresh_token);
              credentials.tokens = tokens;
              // Keep rotated refresh tokens even when a later discovery request fails.
              await persist();
              needsReauthentication = false;
              diagnostics.add("OAuth", "Credentials saved. MCP verification pending.");
            },
            saveCodeVerifier: (value) => {
              diagnostics.protect(value);
              verifier = value;
            },
            codeVerifier: () => {
              if (!verifier) throw new V0ConnectionError("v0 sign-in expired. Try again.");
              return verifier;
            },
            redirectToAuthorization: async (url) => {
              signal.throwIfAborted();
              if (!interactive) {
                needsReauthentication = true;
                throw new V0ConnectionError("v0 sign-in expired. Reconnect in Settings.");
              }
              if (
                url.origin !== "https://v0.app" ||
                url.pathname !== "/api/mcp/oauth/authorize" ||
                url.username ||
                url.password
              )
                throw new V0ConnectionError("Unexpected v0 authorization address.");
              redirected = true;
              diagnostics.add("OAuth", "Waiting for browser authorization.");
              await deps.openExternal(url.href);
            },
            invalidateCredentials: async (scope) => {
              signal.throwIfAborted();
              if (scope === "all" || scope === "tokens") {
                credentials.tokens = undefined;
                needsReauthentication = true;
              }
              if (scope === "all" || scope === "client") credentials.client = undefined;
              if (scope === "all" || scope === "verifier") verifier = undefined;
              if (scope !== "discovery" && scope !== "verifier") await persist();
            },
          };
          try {
            await probe(provider, signal);
          } catch (error) {
            if (!(error instanceof UnauthorizedError) || !redirected || !callback) throw error;
            stage = "OAuth token exchange";
            const code = await callback.code;
            diagnostics.protect(code);
            signal.throwIfAborted();
            await finishAuth(provider, code, signal);
            await probe(provider, signal);
          }
          signal.throwIfAborted();
          if (!credentials.tokens || !credentials.client)
            throw new V0ConnectionError("v0 did not complete authorization.");
          needsReauthentication = false;
          checkedAt = new Date().toISOString();
          diagnostics.add("result", "MCP discovery passed.");
          return { connected: true, checkedAt, needsReauthentication: false };
        } catch (error) {
          diagnostics.add(
            `FAILED ${stage}`,
            describeV0Error(
              signal.aborted
                ? new V0ConnectionError("v0 operation cancelled or timed out.")
                : error,
            ),
          );
          const detail = diagnostics
            .text()
            .split("\n")
            .findLast((line) => line.startsWith("FAILED"));
          throw new V0ConnectionError(`v0 failed at ${stage}. ${detail ?? "See diagnostics."}`);
        } finally {
          callback?.close();
          if (active === abort) active = undefined;
        }
      });
    queue = done;
    return done;
  };
  const stop = (removeCredentials: boolean): Promise<V0ConnectionStatus> => {
    removeOnStop ||= removeCredentials;
    if (stopping) return stopping;
    generation++;
    active?.abort();
    const done = queue
      .catch(() => {})
      .then(async () => {
        checkedAt = null;
        needsReauthentication = false;
        let removed = false;
        for (;;) {
          if (removeOnStop && !removed) {
            await deps.remove();
            removed = true;
          }
          const result = await status();
          // Disconnect can supersede cancellation while the saved status is being read.
          if (removeOnStop && !removed) continue;
          return result;
        }
      })
      .finally(() => {
        if (stopping === done) stopping = undefined;
        removeOnStop = false;
      });
    stopping = done;
    return done;
  };
  return {
    status,
    diagnostics: diagnostics.text,
    connect: () => run(true),
    test: () => run(false),
    cancel: () => stop(false),
    disconnect: () => stop(true),
  };
}
