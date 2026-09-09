import type { ServiceNowSdkStatus } from "@t3tools/contracts";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { DesktopEnvironment } from "../app/DesktopEnvironment.ts";

export class ServiceNowSdkError extends Schema.TaggedError<ServiceNowSdkError>()(
  "ServiceNowSdkError",
  {
    message: Schema.String,
  },
) {}

const PackageMetadata = Schema.Struct({
  name: Schema.Literal("@servicenow/sdk"),
  version: Schema.NonEmptyString,
});
const decodePackageMetadata = Schema.decodeUnknownEffect(Schema.fromJsonString(PackageMetadata));
const isServiceNowSdkError = Schema.is(ServiceNowSdkError);
const installLock = Semaphore.makeUnsafe(1);

export function makeServiceNowSdk(deps: {
  runNpm: (args: ReadonlyArray<string>) => Effect.Effect<string, ServiceNowSdkError>;
  readPackage: (globalRoot: string) => Effect.Effect<string | null, ServiceNowSdkError>;
}) {
  const check = Effect.gen(function* () {
    const globalRoot = (yield* deps.runNpm(["root", "--global"])).trim();
    if (!globalRoot)
      return yield* new ServiceNowSdkError({
        message: "npm did not return a global package directory.",
      });
    const raw = yield* deps.readPackage(globalRoot);
    if (raw === null)
      return { installed: false, version: null, globalRoot } satisfies ServiceNowSdkStatus;
    const metadata = yield* decodePackageMetadata(raw).pipe(
      Effect.mapError(
        () =>
          new ServiceNowSdkError({
            message: "The global ServiceNow SDK package metadata is invalid.",
          }),
      ),
    );
    return { installed: true, version: metadata.version, globalRoot } satisfies ServiceNowSdkStatus;
  });
  const install = installLock.withPermits(1)(
    Effect.gen(function* () {
      const current = yield* check;
      if (current.installed) return current;
      yield* deps.runNpm(["install", "--global", "@servicenow/sdk"]);
      const result = yield* check;
      if (!result.installed)
        return yield* new ServiceNowSdkError({
          message: "npm finished, but the SDK was not found in its global package directory.",
        });
      return result;
    }),
  );
  return { check, install };
}

export const serviceNowSdk = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment;
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const runNpm = Effect.fn("desktop.serviceNowSdk.npm")(function* (args: ReadonlyArray<string>) {
    const command = yield* resolveSpawnCommand("npm", args);
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const child = yield* spawner.spawn(
          ChildProcess.make(command.command, command.args, {
            shell: command.shell,
            cwd: environment.homeDirectory,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
          }),
        );
        const tail = (stream: typeof child.stdout) =>
          stream.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (text, chunk) => (text + chunk).slice(-16000),
            ),
          );
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [tail(child.stdout), tail(child.stderr), child.exitCode],
          { concurrency: "unbounded" },
        );
        if (Number(exitCode) !== 0)
          return yield* new ServiceNowSdkError({
            message: `npm exited with code ${exitCode}. ${stderr || stdout}`.trim(),
          });
        return stdout;
      }),
    ).pipe(
      Effect.timeout(args[0] === "install" ? "10 minutes" : "15 seconds"),
      Effect.mapError((error) =>
        isServiceNowSdkError(error)
          ? error
          : new ServiceNowSdkError({
              message: `Could not run npm: ${error.message}. Ensure Node.js and npm are available to the desktop app.`,
            }),
      ),
    );
  });
  return makeServiceNowSdk({
    runNpm,
    readPackage: (globalRoot) =>
      fs
        .readFileString(environment.path.join(globalRoot, "@servicenow", "sdk", "package.json"))
        .pipe(
          Effect.catch((error) =>
            error.reason._tag === "NotFound"
              ? Effect.succeed(null)
              : Effect.fail(
                  new ServiceNowSdkError({
                    message: `Could not read the global SDK package: ${error.message}`,
                  }),
                ),
          ),
        ),
  });
});
