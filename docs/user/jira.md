# Jira connections

Open **Settings → Integrations → Jira** and connect to Atlassian Rovo MCP with SSO.
CoCo uses the v1 endpoint and stores credentials encrypted on this desktop.

Use **Test connection** to verify access. The checks initialize
MCP, read every page of advertised tools, and call the read-only resource-discovery tool when
available. They do not change Jira issues or verify every advertised tool.

If authentication succeeds but tools fail, expand **Connection diagnostics** and select
**Copy diagnostics**. The report includes HTTP statuses, request identifiers when returned,
server capabilities, tool schema summaries, and the failing stage and error. Tokens, authorization
codes, and raw issue content are omitted.

The latest report is also saved in the local logs directory shown below the report.
Reports survive restarts and are replaced by connection checks or site/project discovery. After a restart, use
**Test connection** to verify current access; a saved sign-in alone does not establish that tools work.

In **Project Settings → Jira project**, choose a site and then a project from your connected account.
With one accessible site, CoCo goes straight to its projects. Selection saves immediately and applies
across Pursue, Manage and Build. Choose **None** to unlink, or **Refresh** to update the available choices.
The same picker is available in Manage. Linking also supplies project context to Build chats.
Jira discovery and issue loading require the desktop app.

Manage shows linked project issues in **To Do**, **In Progress**, and **Done**, using Jira's status
categories rather than a board or sprint. Issues with the **Risk** type appear separately on the right.
Results load 100 at a time, most recently updated first; **Load more** includes additional work and risks.
Counts reflect loaded issues. Use **Refresh** to retrieve changes made elsewhere.

Select a card's status to choose an available Jira transition. This changes the issue in Jira;
transitions requiring additional fields may need to be completed there. Select the summary to open
the issue in Jira. If refreshing fails, previously loaded issues stay visible with an error message.
