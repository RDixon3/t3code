import { isElectron } from "../../env";
import { SidebarInset } from "../ui/sidebar";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { useWorkspaceProject } from "./useWorkspaceProject";

export function ManageLanding() {
  const { context: project } = useWorkspaceProject();

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <WorkspacePageHeader electron={isElectron}>
        <h1 className="text-sm font-medium">Manage</h1>
      </WorkspacePageHeader>
      <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="text-2xl font-semibold">{project?.name ?? "Project overview"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your project work and risks, together.
              </p>
            </div>
          </div>
          <div
            id="jira-connection-status"
            className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
          >
            <p className="font-medium">Jira issue loading coming soon</p>
            <p className="mt-1 text-muted-foreground">
              Jira connection setup is available in desktop Settings → Integrations. Loading project
              issues and risks here is not implemented yet.
            </p>
          </div>
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
              <div className="space-y-4 p-4">
                <p className="text-sm text-muted-foreground">
                  {project
                    ? "Jira issue loading is not implemented yet."
                    : "Select a project in the sidebar to view its work."}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {["To Do", "In Progress", "Done"].map((status) => (
                    <section
                      key={status}
                      aria-label={status}
                      className="min-h-56 rounded-lg bg-muted/30 p-3"
                    >
                      <h4 className="text-sm font-medium">{status}</h4>
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
              <div className="flex min-h-72 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {project
                  ? "Jira issues of type “Risk” will appear here."
                  : "Select a project to view its Jira “Risk” issues."}
              </div>
            </section>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
