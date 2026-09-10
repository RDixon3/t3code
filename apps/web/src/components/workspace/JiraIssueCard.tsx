import type { JiraIssue, JiraTransition } from "@t3tools/contracts";
import { useState } from "react";
import {
  BugIcon,
  CheckSquareIcon,
  BookmarkIcon,
  TriangleAlertIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "../ui/menu";

export function JiraIssueCard({
  issue,
  siteUrl,
  cloudId,
  busy,
  onTransition,
}: {
  issue: JiraIssue;
  siteUrl: string;
  cloudId: string;
  busy: boolean;
  onTransition: (issue: JiraIssue, transition: JiraTransition) => Promise<void>;
}) {
  const [transitions, setTransitions] = useState<ReadonlyArray<JiraTransition>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = issue.issueType.toLowerCase();
  const Icon =
    type === "risk"
      ? TriangleAlertIcon
      : type === "bug"
        ? BugIcon
        : type === "story"
          ? BookmarkIcon
          : CheckSquareIcon;
  const color =
    type === "risk"
      ? "text-orange-500"
      : type === "bug"
        ? "text-red-500"
        : type === "story"
          ? "text-green-500"
          : "text-blue-500";
  const url = `${siteUrl}/browse/${encodeURIComponent(issue.key)}`;
  const load = async () => {
    if (!window.desktopBridge?.getJiraTransitions) return;
    setLoading(true);
    setTransitions([]);
    setError(null);
    try {
      setTransitions(
        await window.desktopBridge.getJiraTransitions({ cloudId, issueKey: issue.key }),
      );
    } catch {
      setError("Could not load available statuses. Reopen to retry.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <article className="space-y-3 rounded-md border border-border bg-background p-3 shadow-xs">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block text-sm leading-snug hover:underline"
        onClick={(event) => {
          if (window.desktopBridge) {
            event.preventDefault();
            void window.desktopBridge.openExternal(url);
          }
        }}
      >
        {issue.summary}
      </a>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`size-3.5 shrink-0 ${color}`} aria-label={issue.issueType} />
        <span>{issue.key}</span>
        {issue.priority && (
          <span className="ml-auto truncate" aria-label={`Priority: ${issue.priority}`}>
            {issue.priority}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Menu
          onOpenChange={(open) => {
            if (open) void load();
          }}
        >
          <MenuTrigger
            disabled={busy}
            className="flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
            aria-label={`Change status of ${issue.key}`}
          >
            <span className="truncate">{issue.status}</span>
            <ChevronDownIcon className="size-3 shrink-0" />
          </MenuTrigger>
          <MenuPopup align="start" className="w-56">
            {loading && (
              <p className="p-2 text-xs text-muted-foreground" role="status">
                Loading statuses…
              </p>
            )}
            {error && (
              <p className="p-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            {!loading && !error && transitions.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">No available transitions.</p>
            )}
            {transitions.map((transition) => (
              <MenuItem
                key={transition.id}
                disabled={busy}
                onClick={() => void onTransition(issue, transition)}
              >
                {transition.name}
              </MenuItem>
            ))}
          </MenuPopup>
        </Menu>
        <span className="truncate text-xs text-muted-foreground">
          {issue.assignee ?? "Unassigned"}
        </span>
      </div>
    </article>
  );
}
