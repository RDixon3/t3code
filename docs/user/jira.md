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
categories rather than a board or sprint. Issues with the **Risk** type appear in a compact section above the board.
Results load 100 at a time, most recently updated first; **Load more** includes additional work and risks.
Counts reflect loaded issues. Use **Refresh** to retrieve changes made elsewhere.

Drag a work card into another column to change its Jira status. If several transitions lead to that column, choose one; cancel to keep its current status. Cards update after Jira confirms the change. Dragging does not change issue ranking.

Open a work card's menu and choose **Change status**, or select a risk's status, to choose an available Jira transition. This changes the issue in Jira;
transitions requiring additional fields may need to be completed there. Select the summary to open
the issue in Jira. If refreshing fails, previously loaded issues stay visible with an error message.

Manage keeps your normal project chat beside the board. Drag the divider to resize chat; narrow
windows provide **Project work** and **Chat** tabs. Switching between Manage and Build keeps the
current conversation selected. The board follows the project that owns that conversation.
Use **Add to chat draft** on an issue or risk to append its reference to your message without sending it.

Jira tools are also available through T3’s existing agent connection for Codex, Claude, and Cursor
while the connected local desktop remains open. Settings shows when chat tools are ready. If a
chat started before the connection was ready and does not discover the tools, start a new chat.
Browser access can stay disabled. The linked project is context, not an access restriction:
Jira still uses your signed-in account’s permissions. Remote/WSL environments do not receive this
desktop’s connection. If a write times out or disconnects, check Jira before retrying.

Use **Suggested focus → Refresh briefing** in Manage for an executive-level briefing covering overall status, delivery, and risks. Each refresh checks up to 500 Jira issues independently of the board's loaded pages. Coverage limits are marked. It generates a new briefing only when the input changes, using the **Text generation model** in **Settings → General** (Codex, Claude, or Cursor). The briefing uses issue fields, without descriptions, comments, deadlines, or project goals. **Jira checked** and **Briefing generated** show separate timestamps. Failures keep the previous briefing. **Discuss in chat** adds a section and its evidence to the same project's draft without sending it.

CoCo automatically refreshes linked local projects when their last refresh is over 24 hours old, including after reopening the app. Projects without a saved briefing receive an initial refresh. Switching tabs or projects does not reset the timer or trigger a fresh request. Jira is checked again, but the model only runs if the input changed. Failed attempts keep the previous briefing and wait 24 hours before another automatic attempt; manual refresh remains available. Briefings and refresh times are saved on this device and are not shared with teammates or other machines. Automatic refresh requires CoCo desktop to be open and connected to its local environment.
