# Jira connections

Open **Settings → Integrations → Jira**. CoCo offers independent **Atlassian Rovo MCP v1** and
**v2** connections. Each has its own SSO sign-in and encrypted credentials. Existing connections
remain under v1; connecting or disconnecting v2 does not change v1.

Use **Connect with SSO**, then **Test connection** to compare the endpoints. The checks initialize
MCP, read every page of advertised tools, and call the read-only resource-discovery tool when
available. They do not change Jira issues or verify every advertised tool.

If authentication succeeds but tools fail, expand **Connection diagnostics** and select
**Copy diagnostics**. The report includes HTTP statuses, request identifiers when returned,
server capabilities, tool schema summaries, and the failing stage and error. Tokens, authorization
codes, and raw issue content are omitted.

The latest report for each version is also saved in the local logs directory shown below the report.
Reports survive restarts and are replaced by the next Connect/Test run. After a restart, use
**Test connection** to verify current access; a saved sign-in alone does not establish that tools work.
