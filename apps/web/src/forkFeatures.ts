/** Presentation switches for this fork. Keep upstream drivers and persisted data intact. */
export const forkFeatures = {
  pullRequests: false,
  hiddenProviders: ["grok", "opencode", "antigravity"] as readonly string[],
  hiddenVersionControlSystems: ["jj"] as readonly string[],
  hiddenSourceControlProviders: ["gitlab", "bitbucket"] as readonly string[],
};

export const isProviderVisible = (driver: string) => !forkFeatures.hiddenProviders.includes(driver);
export const isVersionControlVisible = (kind: string) =>
  !forkFeatures.hiddenVersionControlSystems.includes(kind);
export const isSourceControlVisible = (kind: string) =>
  !forkFeatures.hiddenSourceControlProviders.includes(kind);
