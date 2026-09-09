import { JiraConnectionStatusSchema } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import { DesktopEnvironment } from "../../app/DesktopEnvironment.ts";
import { ElectronSafeStorage } from "../../electron/ElectronSafeStorage.ts";
import { ElectronShell } from "../../electron/ElectronShell.ts";
import { makeJiraConnection } from "../../integrations/JiraConnection.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import * as Channels from "../channels.ts";

class JiraConnectionError extends Schema.TaggedError<JiraConnectionError>()("JiraConnectionError", {
  message: Schema.String,
}) {}

export const installJiraIpc = Effect.fn("desktop.ipc.installJira")(function* () {
  const environment = yield* DesktopEnvironment;
  const fs = yield* FileSystem.FileSystem;
  const storage = yield* ElectronSafeStorage;
  const shell = yield* ElectronShell;
  const ipc = yield* DesktopIpc.DesktopIpc;
  const credentialsPath = environment.path.join(environment.stateDir, "jira-credentials.enc");
  const requireEncryption = Effect.gen(function* () {
    const available = yield* storage.isEncryptionAvailable;
    const backend = yield* storage.selectedStorageBackend;
    if (!available || Option.getOrNull(backend) === "basic_text") {
      return yield* Effect.fail(
        new JiraConnectionError({
          message: "Secure credential storage is unavailable on this machine.",
        }),
      );
    }
  });
  const connection = makeJiraConnection({
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
          const encrypted = yield* storage.encryptString(value);
          yield* fs.makeDirectory(environment.stateDir, { recursive: true });
          const temporaryPath = `${credentialsPath}.tmp`;
          yield* fs.writeFile(temporaryPath, encrypted, { mode: 0o600 });
          yield* fs.rename(temporaryPath, credentialsPath);
        }),
      ),
    remove: () => Effect.runPromise(fs.remove(credentialsPath, { force: true })),
    openExternal: (url) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* requireEncryption;
          if (!(yield* shell.openExternal(url))) {
            return yield* Effect.fail(
              new JiraConnectionError({
                message: "Could not open Atlassian sign-in in your browser.",
              }),
            );
          }
        }),
      ),
  });
  for (const [channel, action] of [
    [Channels.JIRA_STATUS_CHANNEL, connection.status],
    [Channels.JIRA_CONNECT_CHANNEL, connection.connect],
    [Channels.JIRA_TEST_CHANNEL, connection.test],
    [Channels.JIRA_DISCONNECT_CHANNEL, connection.disconnect],
  ] as const) {
    yield* ipc.handle(
      DesktopIpc.makeIpcMethod({
        channel,
        payload: Schema.Void,
        result: JiraConnectionStatusSchema,
        handler: () =>
          Effect.tryPromise({
            try: action,
            catch: (cause) =>
              new JiraConnectionError({
                message: cause instanceof Error ? cause.message : "Jira connection failed.",
              }),
          }),
      }),
    );
  }
});
