import type { ServiceNowSdkStatus } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { SettingsSection } from "./settingsLayout";

export function ServiceNowSdkSettings() {
  const bridge = window.desktopBridge;
  const available = Boolean(bridge?.checkServiceNowSdk && bridge?.installServiceNowSdk);
  const [status, setStatus] = useState<ServiceNowSdkStatus | null>(null);
  const [busy, setBusy] = useState<"checking" | "installing" | null>(available ? "checking" : null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const run = useCallback(
    async (action: "checking" | "installing") => {
      const command =
        action === "checking" ? bridge?.checkServiceNowSdk : bridge?.installServiceNowSdk;
      if (!command || pending.current) return;
      pending.current = true;
      setBusy(action);
      setError(null);
      if (action === "checking") setStatus(null);
      try {
        setStatus(await command());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        pending.current = false;
        setBusy(null);
      }
    },
    [bridge],
  );

  useEffect(() => {
    if (!bridge?.checkServiceNowSdk) return;
    let active = true;
    pending.current = true;
    void bridge
      .checkServiceNowSdk()
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) {
          pending.current = false;
          setBusy(null);
        }
      });
    return () => {
      active = false;
      pending.current = false;
    };
  }, [bridge]);

  return (
    <SettingsSection id="servicenow-sdk" title="ServiceNow">
      <div className="space-y-3 p-4">
        <p className="font-medium">ServiceNow SDK</p>
        <p className="text-sm text-muted-foreground">
          Global installation on this desktop machine, using your current npm environment. Applies
          to every project.
        </p>
        {!available ? (
          <p className="text-sm text-muted-foreground">Available in the desktop app.</p>
        ) : (
          <>
            <p role="status" className="text-sm">
              {busy === "installing"
                ? "Installing ServiceNow SDK…"
                : busy === "checking"
                  ? "Checking global installation…"
                  : status?.installed
                    ? `Installed globally · v${status.version}`
                    : status
                      ? "Not installed globally"
                      : "Installation status unavailable"}
            </p>
            {status && (
              <p className="break-all text-xs text-muted-foreground">
                Global packages: {status.globalRoot}
              </p>
            )}
            <code className="block break-all text-xs text-muted-foreground">
              npm install --global @servicenow/sdk
            </code>
            {error && (
              <pre
                role="alert"
                className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-destructive"
              >
                {error}
              </pre>
            )}
            <div className="flex gap-2">
              {status && !status.installed && (
                <Button size="sm" disabled={busy !== null} onClick={() => void run("installing")}>
                  {busy === "installing" ? "Installing…" : "Install SDK"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void run("checking")}
              >
                Check again
              </Button>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}
