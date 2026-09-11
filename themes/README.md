# CoCo theme

CoCo uses the orange, charcoal, white, and gray palette from [PwC US](https://www.pwc.com/us/en.html), with light and dark variants adapted for the app.

Fresh development checkouts automatically install and select CoCo when starting the local server or desktop with the default worktree `.t3` home. Existing settings and palettes are preserved. Packaged CoCo releases also install the theme automatically.

For an existing environment, import `coco.json` from **Settings → Appearance**, then select **CoCo**. To publish it from a T3 server and apply it to connected clients, run `t3 theme set ./themes/coco.json`. For isolated development, add `--base-dir ./.t3`.

The theme uses the existing T3 format and does not change layouts, fonts, or agent behavior.
