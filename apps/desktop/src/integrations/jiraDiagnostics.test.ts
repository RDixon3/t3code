import { expect, it } from "vite-plus/test";
import { makeJiraDiagnostics } from "./jiraDiagnostics.ts";

it("redacts credentials and auth URLs while retaining useful errors", () => {
  const log = makeJiraDiagnostics();
  log.protect("secret/token", "oauth-code");
  log.add(
    "FAILED tools/list",
    'MCP error -32602: invalid schema; Bearer anything; access_token="abc123" https://auth.atlassian.com/token?code=oauth-code&state=abc secret/token secret%2Ftoken',
  );
  expect(log.text()).toContain("MCP error -32602: invalid schema");
  for (const secret of [
    "anything",
    "abc123",
    "oauth-code",
    "state=abc",
    "secret/token",
    "secret%2Ftoken",
  ])
    expect(log.text()).not.toContain(secret);
});

it("bounds reports and starts a fresh report on reset", () => {
  const log = makeJiraDiagnostics();
  for (let i = 0; i < 1100; i++) log.add("HTTP", "200");
  expect(log.text().split("\n")).toHaveLength(1000);
  log.reset();
  expect(log.text()).toBe("");
});
