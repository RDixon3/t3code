// Build-only branding overlay. Each replacement fails loudly if upstream moves its extension point.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
async function replace(file, before, after) {
  const target = path.join(root, file);
  const source = await readFile(target, "utf8");
  if (source.split(before).length !== 2)
    throw new Error(`Expected one branding anchor in ${file}: ${before}`);
  await writeFile(target, source.replace(before, after));
}

const packagePath = path.join(root, "apps/desktop/package.json");
const desktopPackage = JSON.parse(await readFile(packagePath, "utf8"));
desktopPackage.productName = "CoCo";
await writeFile(packagePath, JSON.stringify(desktopPackage, null, 2) + "\n");
await replace(
  "scripts/build-desktop-artifact.ts",
  'const DESKTOP_APP_ID = "com.t3tools.t3code";',
  'const DESKTOP_APP_ID = "io.github.rdixon3.coco";',
);
await replace(
  "scripts/build-desktop-artifact.ts",
  'artifactName: "T3-Code-${version}-${arch}.${ext}"',
  'artifactName: "CoCo-${version}-${arch}.${ext}"',
);
await replace(
  "scripts/build-desktop-artifact.ts",
  "macIconPng: BRAND_ASSET_PATHS.productionMacIconPng,",
  'macIconPng: "apps/desktop/resources/coco-icon.png",',
);
await replace(
  "scripts/build-desktop-artifact.ts",
  "if (!isDesktopPreviewVersion(version)) {",
  "buildConfig.publish = null;\n  if (false) { // CoCo pilot uses manual updates.",
);
await replace(
  "apps/desktop/src/app/DesktopEnvironment.ts",
  'const APP_BASE_NAME = "T3 Code";',
  'const APP_BASE_NAME = "CoCo";',
);
await replace(
  "apps/desktop/src/app/DesktopEnvironment.ts",
  'isDevelopment ? "t3code-dev" : "t3code";',
  'isDevelopment ? "coco-dev" : "coco";',
);
await replace(
  "apps/desktop/src/app/DesktopEnvironment.ts",
  'isDevelopment ? "T3 Code (Dev)" : "T3 Code (Alpha)";',
  'isDevelopment ? "CoCo (Dev)" : "CoCo (Alpha)";',
);
await replace(
  "apps/desktop/src/app/DesktopEnvironment.ts",
  'isDevelopment ? "com.t3tools.t3code.dev" : "com.t3tools.t3code",',
  'isDevelopment ? "io.github.rdixon3.coco.dev" : "io.github.rdixon3.coco",',
);

const theme = JSON.parse(await readFile(path.join(root, "themes/coco.json"), "utf8"));
const bootstrap = `// Generated only for packaged CoCo releases.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { app } from "electron";
if (app.isPackaged) {
  process.env.T3CODE_HOME ||= path.join(os.homedir(), ".coco");
  const state = path.join(process.env.T3CODE_HOME, "userdata");
  fs.mkdirSync(path.join(state, "themes"), { recursive: true });
  const seed = (name: string, value: unknown) => {
    try { fs.writeFileSync(path.join(state, name), JSON.stringify(value), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  };
  seed("themes/coco.json", ${JSON.stringify(theme)});
  seed("settings.json", { defaultTheme: "coco", defaultThemeSetAt: "2026-09-09T00:00:00.000Z" });
}
`;
await writeFile(path.join(root, "apps/desktop/src/cocoReleaseBootstrap.ts"), bootstrap);
const mainPath = path.join(root, "apps/desktop/src/main.ts");
await writeFile(
  mainPath,
  'import "./cocoReleaseBootstrap.ts";\n' + (await readFile(mainPath, "utf8")),
);

// Original vector artwork, rendered through the existing Sharp dependency.
const svg =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<rect x="56" y="56" width="912" height="912" rx="208" fill="#171717"/>
<path d="M700 303 A290 290 0 1 0 700 721" fill="none" stroke="#fd5108" stroke-width="116" stroke-linecap="round"/>
<circle cx="732" cy="512" r="58" fill="#ffffff"/></svg>`);
await sharp(svg).png().toFile(path.join(root, "apps/desktop/resources/coco-icon.png"));
console.log("Prepared CoCo identity, isolated data, bundled theme, icon, and manual updates.");
