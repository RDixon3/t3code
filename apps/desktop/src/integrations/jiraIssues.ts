import { JiraTransitionSchema } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const decodeIssues = Schema.decodeUnknownSync(
  Schema.Struct({
    issues: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        key: Schema.String,
        fields: Schema.Struct({
          summary: Schema.String,
          issuetype: Schema.Struct({ name: Schema.String }),
          status: Schema.Struct({
            name: Schema.String,
            statusCategory: Schema.Struct({
              key: Schema.Literals(["new", "indeterminate", "done"]),
            }),
          }),
          assignee: Schema.optionalKey(
            Schema.NullOr(Schema.Struct({ displayName: Schema.String })),
          ),
          priority: Schema.optionalKey(Schema.NullOr(Schema.Struct({ name: Schema.String }))),
        }),
      }),
    ),
    nextPageToken: Schema.optionalKey(Schema.NullOr(Schema.String)),
    isLast: Schema.optionalKey(Schema.Boolean),
    total: Schema.optionalKey(Schema.Number),
  }),
);
const decodeTransitions = Schema.decodeUnknownSync(
  Schema.Struct({ transitions: Schema.Array(JiraTransitionSchema) }),
);

export function jiraProjectQuery(projectKey: string) {
  if (!/^[A-Z][A-Z0-9_]*$/i.test(projectKey))
    throw new Error("Invalid Jira project key. Relink this project.");
  return `project = "${projectKey}" ORDER BY updated DESC, key ASC`;
}

export function parseJiraIssues(value: unknown, previousToken?: string) {
  try {
    const page = decodeIssues(value);
    const nextPageToken = page.isLast === true ? null : page.nextPageToken || null;
    if (nextPageToken && (nextPageToken === previousToken || page.issues.length === 0))
      throw new Error();
    if (
      !nextPageToken &&
      (page.isLast === false ||
        (page.isLast !== true &&
          !previousToken &&
          page.total !== undefined &&
          page.total > page.issues.length))
    )
      throw new Error();
    return {
      issues: page.issues.map(({ id, key, fields }) => ({
        id,
        key,
        summary: fields.summary,
        issueType: fields.issuetype.name,
        status: fields.status.name,
        category: fields.status.statusCategory.key,
        assignee: fields.assignee?.displayName ?? null,
        priority: fields.priority?.name ?? null,
      })),
      nextPageToken,
    };
  } catch {
    throw new Error(
      "Jira returned an unsupported issue page or status category. Refresh or check the connection diagnostics.",
    );
  }
}

export function parseJiraTransitions(value: unknown) {
  try {
    return decodeTransitions(value).transitions;
  } catch {
    throw new Error("Jira returned an unrecognized transition list.");
  }
}
