export function makeJiraDiagnostics() {
  let lines: string[] = [];
  const secrets = new Set<string>();
  const redact = (value: string) => {
    let text = value;
    for (const secret of secrets) {
      text = text
        .replaceAll(secret, "[redacted]")
        .replaceAll(encodeURIComponent(secret), "[redacted]");
    }
    return text
      .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
      .replace(/(https?:\/\/[^\s?"'<>]+)\?[^\s"'<>]*/g, "$1?[redacted]")
      .replace(
        /((?:access_token|refresh_token|client_secret|code_verifier|authorization|cookie)\s*["']?\s*[:=]\s*["']?)[^\s,"'<>]+/gi,
        "$1[redacted]",
      )
      .slice(0, 8000);
  };
  return {
    reset: () => {
      lines = [];
      secrets.clear();
    },
    protect: (...values: (string | undefined)[]) => {
      for (const value of values) if (value) secrets.add(value);
    },
    add: (stage: string, message: string) => {
      // Keep startup context and the final outcome even for very large catalogs.
      if (lines.length >= 1000) lines.splice(50, 1);
      lines.push(`${stage}: ${redact(message)}`);
    },
    text: () => lines.map(redact).join("\n"),
  };
}
