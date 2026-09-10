# Effect reference subset

Copied unchanged from the vendored Effect tree in CoCo commit
`84f7dfce3da957d50899b395db50522a6f2bb5e2`. The complete source tree object was
`648a01b9c249448716e1a9474f511b17898f9d93`; its latest update is recorded as
`chore(refs): sync Effect reference to rc.112 (#10653)`. An upstream commit SHA
was not recorded in that commit message; do not infer one from the package version.

Retained: `LLMS.md`, `LICENSE`, and `ai-docs/src/`. These are documentation and
examples only, excluded from application builds and checks.

When upgrading Effect, inspect the matching version of
<https://github.com/Effect-TS/effect> in an external checkout. Copy only the retained
guide, examples, and license, preserve their relative paths, verify the guide's
relative links, and update this provenance with the actual source commit.
Do not reintroduce the full source tree or use `git subtree` for this subset.
