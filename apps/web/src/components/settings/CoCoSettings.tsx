import type { EnvironmentId } from "@t3tools/contracts";
import { useAtomValue, useAtomRefresh } from "@effect/atom-react";
import { useState } from "react";
import { cocoLibrary, cocoSkillsAction } from "../../state/coco";
import { useAtomCommand } from "../../state/use-atom-command";
import { usePrimaryEnvironment } from "../../state/environments";
import { Button } from "../ui/button";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";
function Library({ environmentId }: { environmentId: EnvironmentId }) {
  const atom = cocoLibrary({ environmentId, input: {} });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const action = useAtomCommand(cocoSkillsAction);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const act = async (choice: "enable" | "disable" | "retry" | "remove") => {
    setBusy(true);
    try {
      await action({ environmentId, input: { action: choice } });
    } finally {
      setBusy(false);
      setConfirmRemove(false);
      refresh();
    }
  };
  if (result._tag !== "Success")
    return (
      <div className="text-sm text-muted-foreground">
        {result._tag === "Failure" ? "Could not load agents and skills." : "Loading…"}
        <Button variant="ghost" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  const library = result.value;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {library.agents.map((agent) => (
          <div key={agent.id} className="rounded-lg border p-4">
            <div className="text-sm font-medium">{agent.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">View instructions</summary>
              <p className="mt-2 whitespace-pre-wrap">{agent.prompt}</p>
              {agent.skills.length > 0 && <p className="mt-2">Skills: {agent.skills.join(", ")}</p>}
            </details>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Native skills</h3>
        <p className="text-sm text-muted-foreground">
          Install CoCo skills into Codex, Claude and Cursor on this environment. They are also
          available outside CoCo. Enabled installations update automatically when CoCo starts;
          existing chats follow each harness’s normal skill-loading behavior.
        </p>
        <p className="text-sm">
          {library.enabled ? "Automatic updates enabled" : "Automatic updates disabled"} ·{" "}
          {library.installed} installed copies
        </p>
        {library.installed === 0 && (
          <p className="text-xs text-muted-foreground">
            No CoCo skills are installed on this environment.
          </p>
        )}
        {library.error && (
          <p role="alert" className="text-sm text-destructive">
            {library.error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void act(library.enabled ? "disable" : "enable")}
          >
            {library.enabled ? "Disable updates" : "Enable installation"}
          </Button>
          {library.enabled && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("retry")}>
              Check for updates
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Remove CoCo skills…
          </Button>
        </div>
        {confirmRemove && (
          <div className="rounded-lg border p-3 text-sm">
            <p>
              Remove installed CoCo skills and disable automatic updates? Other skills will remain.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void act("remove")}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmRemove(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Installation locations</summary>
          {library.destinations.map((path) => (
            <p key={path} className="mt-2 break-all">
              {path}
            </p>
          ))}
        </details>
      </div>
    </div>
  );
}
export function CoCoSettings() {
  const environment = usePrimaryEnvironment();
  return (
    <SettingsPageContainer>
      <SettingsSection title="Agents & Skills" id="agents">
        {environment ? (
          <Library environmentId={environment.environmentId} />
        ) : (
          <p>Connect an environment to manage its agents and skills.</p>
        )}
      </SettingsSection>
    </SettingsPageContainer>
  );
}
