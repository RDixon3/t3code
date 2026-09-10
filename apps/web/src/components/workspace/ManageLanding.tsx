import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { JiraProjectBoard } from "./JiraProjectBoard";
import { isElectron } from "../../env";
import { SidebarInset } from "../ui/sidebar";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { useWorkspaceProject } from "./useWorkspaceProject";
import { ProjectJiraLink } from "../settings/ProjectJiraLink";

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
            {project && (
              <ProjectJiraLink
                key={`${project.workspace.environmentId}:${project.workspace.projectId}`}
                environmentId={project.workspace.environmentId}
                projectId={project.workspace.projectId}
              />
            )}
          </div>
          {project ? (
            <LinkedBoard
              key={`${project.workspace.environmentId}:${project.workspace.projectId}`}
              environmentId={project.workspace.environmentId}
              projectId={project.workspace.projectId}
            />
          ) : (
            <JiraProjectBoard jira={null} hasProject={false} />
          )}
        </div>
      </main>
    </SidebarInset>
  );
}

function LinkedBoard({
  environmentId,
  projectId,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
}) {
  const jira = useEnvironmentSettings(
    environmentId,
    (settings) => settings.cocoProjectContexts[projectId]?.jira ?? null,
  );
  return <JiraProjectBoard key={`${jira?.siteUrl}:${jira?.projectKey}`} jira={jira} hasProject />;
}
