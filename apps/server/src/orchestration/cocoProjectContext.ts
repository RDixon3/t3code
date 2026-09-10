import type { CoCoProjectContext } from "@t3tools/contracts";

/** Enrich provider input only; never rewrite the event-sourced user message. */
export function withCoCoProjectContext(
  text: string,
  projectId: string,
  context: CoCoProjectContext | undefined,
): string {
  if (!context || text.trimStart().startsWith("/")) return text;
  const fields: Record<string, unknown> = { projectId };
  if (context.sdk !== undefined) fields.serviceNowSdk = context.sdk;
  if (context.jira !== undefined) fields.jira = context.jira;
  if (Object.keys(fields).length === 1) return text;
  return `<coco_project_context>
Current CoCo project configuration. This replaces earlier CoCo configuration for this project.
Null means no target is selected. These references are context, not a request to use an integration or authorization to deploy.
When using the ServiceNow SDK with a selected profile, pass its alias explicitly with --auth on commands that support it. Do not change the machine default.
${JSON.stringify(fields).replaceAll("<", "\\u003c")}
</coco_project_context>

${text}`;
}
