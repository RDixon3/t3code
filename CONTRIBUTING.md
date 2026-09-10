# Contributing to CoCo

See the [development runbook](docs/operations/development.md#first-checkout) and [AGENTS.md](AGENTS.md).

Keep changes focused on CoCo’s desktop use case and easy to rebase against [upstream T3 Code](https://github.com/pingdotgg/t3code). Preserve stock agent, provider, session and remote-environment behavior unless a change explicitly requires otherwise.

Run focused tests and typechecks for affected workspaces. UI changes need verification in the appropriate client with isolated development state. Do not commit generated installers, screenshots used only for review, dependency directories, or implementation plans.
