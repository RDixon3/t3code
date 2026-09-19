import { BrowserWindow, net } from "electron";
import { V0ConnectionStatusSchema } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { DesktopEnvironment } from "../../app/DesktopEnvironment.ts";
import { ElectronSafeStorage } from "../../electron/ElectronSafeStorage.ts";
import { ElectronShell } from "../../electron/ElectronShell.ts";
import { makeV0Connection } from "../../integrations/V0Connection.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import * as Channels from "../channels.ts";

class V0ConnectionError extends Schema.TaggedError<V0ConnectionError>()("V0ConnectionError", {
  message: Schema.String,
}) {}

export const installV0Ipc = Effect.fn("desktop.ipc.installV0")(function* () {
  const environment = yield* DesktopEnvironment;
  const fs = yield* FileSystem.FileSystem;
  const storage = yield* ElectronSafeStorage;
  const shell = yield* ElectronShell;
  const ipc = yield* DesktopIpc.DesktopIpc;
  const credentialsPath = environment.path.join(environment.stateDir, "v0-credentials.enc");
  const diagnosticsPath = environment.path.join(environment.logDir, "v0-diagnostics.log");
  const requireEncryption = Effect.gen(function* () {
    const available = yield* storage.isEncryptionAvailable;
    const backend = yield* storage.selectedStorageBackend;
    if (!available || Option.getOrNull(backend) === "basic_text")
      return yield* new V0ConnectionError({
        message: "Secure credential storage is unavailable on this machine.",
      });
  });
  const connection = makeV0Connection({
    // Chromium honors the desktop's corporate proxy and system certificate configuration.
    fetch: (input, init) => net.fetch(input instanceof URL ? input.href : input, init),
    read: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const bytes = yield* fs
            .readFile(credentialsPath)
            .pipe(
              Effect.catch((error) =>
                error.reason._tag === "NotFound" ? Effect.succeed(undefined) : Effect.fail(error),
              ),
            );
          if (!bytes) return undefined;
          yield* requireEncryption;
          return yield* storage.decryptString(bytes);
        }),
      ),
    write: (value) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* requireEncryption;
          const bytes = yield* storage.encryptString(value);
          yield* fs.makeDirectory(environment.stateDir, { recursive: true });
          const temporaryPath = `${credentialsPath}.tmp`;
          yield* fs.writeFile(temporaryPath, bytes, { mode: 0o600 });
          yield* fs.rename(temporaryPath, credentialsPath);
        }),
      ),
    remove: () => Effect.runPromise(fs.remove(credentialsPath, { force: true })),
    openExternal: (url) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* requireEncryption;
          if (!(yield* shell.openExternal(url)))
            return yield* new V0ConnectionError({
              message: "Could not open v0 sign-in in your browser.",
            });
        }),
      ),
  });
  const saveDiagnostics = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* fs.makeDirectory(environment.logDir, { recursive: true });
        yield* fs.writeFileString(diagnosticsPath, connection.diagnostics(), { mode: 0o600 });
      }),
    ).catch(() => {});

  for (const [channel, action] of [
    [Channels.V0_STATUS_CHANNEL, "status"],
    [Channels.V0_CONNECT_CHANNEL, "connect"],
    [Channels.V0_TEST_CHANNEL, "test"],
    [Channels.V0_CANCEL_CHANNEL, "cancel"],
    [Channels.V0_DISCONNECT_CHANNEL, "disconnect"],
  ] as const)
    yield* ipc.handle(
      DesktopIpc.makeIpcMethod({
        channel,
        payload: Schema.Void,
        result: V0ConnectionStatusSchema,
        handler: () =>
          Effect.tryPromise({
            try: async () => {
              try {
                const result = await connection[action]();
                const diagnostics =
                  connection.diagnostics() ||
                  (await Effect.runPromise(fs.readFileString(diagnosticsPath)).catch(() => ""));
                return { ...result, diagnostics, diagnosticsPath };
              } finally {
                if (action !== "status") {
                  await saveDiagnostics();
                  for (const window of BrowserWindow.getAllWindows())
                    window.webContents.send(Channels.V0_CHANGED_CHANNEL);
                }
              }
            },
            catch: (cause) =>
              new V0ConnectionError({
                message: cause instanceof Error ? cause.message : "v0 connection failed.",
              }),
          }),
      }),
    );
});
