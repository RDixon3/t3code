export function isHostLocalSdkEnvironment(
  target: { _tag: string; httpBaseUrl?: string } | undefined,
  serverOs: string | undefined,
  clientOs: string | undefined,
  pageUrl: string,
): boolean {
  if (target?._tag !== "PrimaryConnectionTarget" || !clientOs || serverOs !== clientOs)
    return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(target.httpBaseUrl || pageUrl, pageUrl).hostname,
    );
  } catch {
    return false;
  }
}
