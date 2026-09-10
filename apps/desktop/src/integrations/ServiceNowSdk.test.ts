import { describe, expect } from "vite-plus/test";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeServiceNowSdk, ServiceNowSdkError } from "./ServiceNowSdk.ts";

const metadata = JSON.stringify({ name: "@servicenow/sdk", version: "1.2.3" });

function fixture(initial: string | null, installResult: string | null = metadata) {
  let raw = initial;
  const commands: ReadonlyArray<string>[] = [];
  const paths: string[] = [];
  const sdk = makeServiceNowSdk({
    runSdk: () => Effect.succeed("No credentials found"),
    runNpm: (args) =>
      Effect.sync(() => {
        commands.push(args);
        if (args[0] === "install") {
          raw = installResult;
          return "installed";
        }
        return "/global/node_modules\n";
      }),
    readPackage: (root) =>
      Effect.sync(() => {
        paths.push(root);
        return raw;
      }),
  });
  return { sdk, commands, paths };
}

describe("global ServiceNow SDK", () => {
  it.effect("lists existing global profiles and propagates discovery failures", () =>
    Effect.gen(function* () {
      const roots: string[] = [];
      let fail = false;
      const sdk = makeServiceNowSdk({
        runNpm: () => Effect.succeed("/global/node_modules"),
        readPackage: () => Effect.succeed(metadata),
        runSdk: (root) => {
          roots.push(root);
          return fail
            ? Effect.fail(new ServiceNowSdkError({ message: "SDK failed" }))
            : Effect.succeed("[dev]\n host = https://dev.service-now.com");
        },
      });
      expect(yield* sdk.listProfiles).toEqual([
        { alias: "dev", instanceUrl: "https://dev.service-now.com" },
      ]);
      expect(roots).toEqual(["/global/node_modules"]);
      fail = true;
      expect(yield* Effect.flip(sdk.listProfiles)).toMatchObject({ message: "SDK failed" });
    }),
  );
  it.effect("checks only npm's global root and reports the installed version", () =>
    Effect.gen(function* () {
      const { sdk, commands, paths } = fixture(metadata);
      expect(yield* sdk.check).toEqual({
        installed: true,
        version: "1.2.3",
        globalRoot: "/global/node_modules",
      });
      expect(commands).toEqual([["root", "--global"]]);
      expect(paths).toEqual(["/global/node_modules"]);
    }),
  );

  it.effect("reports a missing global package without installing during a check", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(null);
      expect((yield* sdk.check).installed).toBe(false);
      expect(commands).toEqual([["root", "--global"]]);
    }),
  );

  it.effect("uses the fixed global install command, rechecks, and avoids duplicate installs", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(null);
      const results = yield* Effect.all([sdk.install, sdk.install], { concurrency: "unbounded" });
      expect(results.every((result) => result.installed)).toBe(true);
      expect(commands.filter((args) => args[0] === "install")).toEqual([
        ["install", "--global", "@servicenow/sdk"],
      ]);
      expect(commands.filter((args) => args[0] === "root")).toHaveLength(3);
    }),
  );

  it.effect("does not overwrite an existing global installation", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(metadata);
      yield* sdk.install;
      expect(commands).toEqual([["root", "--global"]]);
    }),
  );

  it.effect(
    "does not report success when npm exits successfully but the SDK is still missing",
    () =>
      Effect.gen(function* () {
        const { sdk } = fixture(null, null);
        const error = yield* Effect.flip(sdk.install);
        expect(error.message).toContain("was not found");
      }),
  );

  it.effect("distinguishes unavailable npm and corrupt metadata from a missing SDK", () =>
    Effect.gen(function* () {
      const unavailable = makeServiceNowSdk({
        runSdk: () => Effect.succeed("No credentials found"),
        runNpm: () => Effect.fail(new ServiceNowSdkError({ message: "npm unavailable" })),
        readPackage: () => Effect.succeed(null),
      });
      expect((yield* Effect.flip(unavailable.check)).message).toBe("npm unavailable");
      expect((yield* Effect.flip(fixture("invalid json").sdk.check)).message).toContain(
        "metadata is invalid",
      );
    }),
  );
});
