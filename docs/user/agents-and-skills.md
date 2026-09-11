# Agents and skills

Choose an agent beside the model picker before sending a new chat. Manage and Build default to their matching agents; Pursuit is also available. **Default** uses the harness without a CoCo persona. The initial personas are neutral placeholders.

A chat keeps its agent instructions when resumed. Start a new chat to change agents or pick up revised instructions. Changing the page or project does not change an existing chat's agent.

In **Settings → Agents & Skills**, enable native skill installation for the primary environment. CoCo installs its bundled skills into the native Codex, Claude, and Cursor locations on that environment, including their supporting files. These skills are also available when using those harnesses outside CoCo. The initial library has no specialized skills yet.

Once enabled, CoCo checks its bundled library at startup. **Check for updates** applies library changes without restarting CoCo. Skill changes follow the harness's normal loading behavior; a running chat may need a new session to see them. Unlike agent instructions, skill contents are not frozen per chat.

Disabling updates leaves installed skills in place. **Remove CoCo skills** removes only CoCo-managed packages and disables automatic updates. Other installed skills remain untouched. Installation problems appear on the same page and can be retried.
