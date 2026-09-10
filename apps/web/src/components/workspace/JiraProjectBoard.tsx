import type { JiraIssue, JiraIssuePage, JiraTransition } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { JiraIssueCard } from "./JiraIssueCard";

const columns = [
  { category: "new", label: "To Do" },
  { category: "indeterminate", label: "In Progress" },
  { category: "done", label: "Done" },
] as const;
type BoardData = JiraIssuePage & { cloudId: string };

export function JiraProjectBoard({
  jira,
  hasProject,
}: {
  jira: { siteUrl: string; projectKey: string } | null;
  hasProject: boolean;
}) {
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(Boolean(jira && window.desktopBridge?.listJiraIssues));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = useRef<Promise<BoardData> | null>(null);
  const mounted = useRef(true);
  const bridge = window.desktopBridge;
  const siteUrl = jira?.siteUrl;
  const projectKey = jira?.projectKey;
  const fetchFirst = useCallback(async (): Promise<BoardData> => {
    if (!siteUrl || !projectKey || !bridge?.listJiraSites || !bridge.listJiraIssues)
      throw new Error("Open CoCo desktop to load Jira issues.");
    const sites = await bridge.listJiraSites();
    const site = sites.find((item) => item.url.replace(/\/$/, "") === siteUrl.replace(/\/$/, ""));
    if (!site)
      throw new Error(
        "The linked Jira site is not accessible with this connection. Relink the project or reconnect in Settings.",
      );
    return { ...(await bridge.listJiraIssues({ cloudId: site.id, projectKey })), cloudId: site.id };
  }, [siteUrl, projectKey, bridge]);
  // The parent keys this board by environment, project, and Jira link. Share the initial
  // request across Strict Mode effect replay without starting duplicate MCP sessions.
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (siteUrl && bridge?.listJiraIssues) {
      if (!initial.current) initial.current = fetchFirst();
      void initial.current
        .then(
          (result) => {
            if (active) setData(result);
          },
          (cause: unknown) => {
            if (active)
              setError(cause instanceof Error ? cause.message : "Could not load Jira issues.");
          },
        )
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [siteUrl, bridge?.listJiraIssues, fetchFirst]);
  const refresh = async (more = false) => {
    setLoading(true);
    setError(null);
    try {
      const result =
        more && data?.nextPageToken && jira && bridge?.listJiraIssues
          ? {
              ...(await bridge.listJiraIssues({
                cloudId: data.cloudId,
                projectKey: jira.projectKey,
                nextPageToken: data.nextPageToken,
              })),
              cloudId: data.cloudId,
            }
          : await fetchFirst();
      if (mounted.current)
        setData(
          more && data
            ? {
                ...result,
                issues: [
                  ...data.issues,
                  ...result.issues.filter(
                    (issue) => !data.issues.some((previous) => previous.id === issue.id),
                  ),
                ],
              }
            : result,
        );
      return true;
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : "Could not load Jira issues.");
      return false;
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  const transition = async (issue: JiraIssue, target: JiraTransition) => {
    if (!data || !bridge?.transitionJiraIssue || busy) return;
    setBusy(true);
    setError(null);
    try {
      await bridge.transitionJiraIssue({
        cloudId: data.cloudId,
        issueKey: issue.key,
        transitionId: target.id,
      });
      if (mounted.current && !(await refresh()))
        setError(
          "Status changed in Jira, but the board could not refresh. Refresh before making another change.",
        );
    } catch {
      if (mounted.current)
        setError(
          `Could not confirm the status change for ${issue.key}. Refresh to check its status, or open it in Jira if the transition requires additional fields.`,
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const risks = data?.issues.filter((issue) => issue.issueType.toLowerCase() === "risk") ?? [];
  const work = data?.issues.filter((issue) => issue.issueType.toLowerCase() !== "risk") ?? [];
  const guidance = !hasProject
    ? "Select a project in the sidebar to view its work and risks."
    : !jira
      ? "Link a Jira project to view its work and risks."
      : !bridge?.listJiraIssues
        ? "Open CoCo desktop to load Jira issues from your connected account."
        : null;
  const card = (issue: JiraIssue) => (
    <JiraIssueCard
      key={issue.id}
      issue={issue}
      siteUrl={jira!.siteUrl}
      cloudId={data!.cloudId}
      busy={busy || loading}
      onTransition={transition}
    />
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p role="status">
          {guidance ??
            (loading
              ? "Loading Jira issues…"
              : data
                ? `${data.issues.length} issues loaded${data.nextPageToken ? " · More available" : ""}`
                : "Jira issues")}
        </p>
        {jira && bridge?.listJiraIssues && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
          {data && " Previously loaded issues remain visible."}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section
          aria-labelledby="project-work-heading"
          className="overflow-hidden rounded-xl border border-border"
        >
          <div className="border-b border-border px-5 py-4">
            <h3 id="project-work-heading" className="font-medium">
              Project work
            </h3>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[30rem] grid-cols-3 gap-3">
              {columns.map(({ category, label }) => (
                <section
                  key={category}
                  aria-label={label}
                  className="min-h-56 space-y-3 rounded-lg bg-muted/30 p-3"
                >
                  <h4 className="flex items-center justify-between text-sm font-medium">
                    {label}
                    <span className="text-xs text-muted-foreground">
                      {work.filter((issue) => issue.category === category).length}
                    </span>
                  </h4>
                  {work.filter((issue) => issue.category === category).map(card)}
                  {data && !loading && !work.some((issue) => issue.category === category) && (
                    <p className="text-xs text-muted-foreground">
                      No {data.nextPageToken ? "loaded " : ""}issues
                    </p>
                  )}
                </section>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="risks-heading"
          className="overflow-hidden rounded-xl border border-border"
        >
          <div className="border-b border-border px-5 py-4">
            <h3 id="risks-heading" className="font-medium">
              Risks
            </h3>
          </div>
          <div className="space-y-3 p-4">
            {risks.map(card)}
            {data && !loading && risks.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {data.nextPageToken
                  ? "No Risk issues in the loaded results."
                  : "No issues of type Risk in this project."}
              </p>
            )}
          </div>
        </section>
      </div>
      {data?.nextPageToken && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || busy}
            onClick={() => void refresh(true)}
          >
            Load more
          </Button>
          <span>Work and risks show loaded issues only, most recently updated first.</span>
        </div>
      )}
    </div>
  );
}
