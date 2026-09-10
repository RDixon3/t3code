import type { EnvironmentId, ProjectId, ServiceNowSdkProfile } from "@t3tools/contracts";
import { useRef, useState } from "react";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { useEnvironmentPresentation } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { isHostLocalSdkEnvironment } from "./serviceNowSdkHost";

export function ServiceNowSdkProfilePicker({
  environmentId,
  projectId,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
}) {
  const bridge = window.desktopBridge;
  const { presentation } = useEnvironmentPresentation(environmentId);
  const selection = useEnvironmentSettings(
    environmentId,
    (settings) => settings.cocoProjectContexts[projectId]?.sdk ?? null,
  );
  const update = useAtomCommand(serverEnvironment.updateSettings, { reportFailure: false });
  const [profiles, setProfiles] = useState<ReadonlyArray<ServiceNowSdkProfile> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discoveryId = useRef(0);
  const local = isHostLocalSdkEnvironment(
    presentation?.entry.target,
    presentation?.serverConfig?.environment.platform.os,
    bridge?.getClientPlatform?.(),
    window.location.href,
  );
  if (!local || !bridge?.listServiceNowSdkProfiles) return null;

  const refresh = async () => {
    const id = ++discoveryId.current;
    setLoading(true);
    setError(null);
    setProfiles(null);
    try {
      const result = await bridge.listServiceNowSdkProfiles!();
      if (id === discoveryId.current) setProfiles(result);
    } catch (cause) {
      if (id === discoveryId.current)
        setError(cause instanceof Error ? cause.message : "Could not list SDK profiles.");
    } finally {
      if (id === discoveryId.current) setLoading(false);
    }
  };
  const select = async (sdk: ServiceNowSdkProfile | null) => {
    setSaving(true);
    setError(null);
    try {
      const result = await update({
        environmentId,
        input: { patch: { cocoProjectContexts: { [projectId]: { sdk } } } },
      });
      if (result._tag === "Failure")
        setError("Profile not saved. Check the environment connection and try again.");
      else setOpen(false);
    } catch {
      setError("Profile not saved. Check the environment connection and try again.");
    } finally {
      setSaving(false);
    }
  };
  const missing =
    selection &&
    profiles &&
    !profiles.some(
      (profile) =>
        profile.alias === selection.alias && profile.instanceUrl === selection.instanceUrl,
    );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refresh();
      }}
    >
      <PopoverTrigger
        className="max-w-40 truncate rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
        title={`ServiceNow SDK: ${selection?.alias ?? "None"}. Applies to this project.${selection ? ` ${selection.instanceUrl}` : ""}`}
      >
        SDK: {selection?.alias ?? "None"}
      </PopoverTrigger>
      <PopoverPopup className="w-80 p-3" align="start">
        <p className="text-sm font-medium">ServiceNow SDK</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Applies to this project. Changes apply to the next turn.
        </p>
        {selection && (
          <p className="mb-2 break-all text-xs">
            {selection.alias} · {selection.instanceUrl}
          </p>
        )}
        <div className="max-h-60 space-y-1 overflow-y-auto">
          <Button
            variant="ghost"
            className="w-full justify-start"
            disabled={saving}
            onClick={() => void select(null)}
          >
            None
          </Button>
          {profiles?.map((profile) => (
            <Button
              key={profile.alias}
              variant="ghost"
              className="h-auto w-full justify-start py-2 text-left"
              disabled={saving}
              onClick={() => void select(profile)}
            >
              <span className="min-w-0">
                <span className="block truncate">{profile.alias}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {profile.instanceUrl}
                </span>
              </span>
            </Button>
          ))}
        </div>
        {profiles?.length === 0 && (
          <p className="my-2 text-xs text-muted-foreground">
            No profiles found. Add one with the SDK CLI, then refresh.
          </p>
        )}
        {missing && (
          <p role="status" className="my-2 text-xs text-amber-600">
            The saved profile is missing or its instance changed. Select a profile to update it.
          </p>
        )}
        {error && (
          <p role="alert" className="my-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={loading || saving}
          onClick={() => void refresh()}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </PopoverPopup>
    </Popover>
  );
}
