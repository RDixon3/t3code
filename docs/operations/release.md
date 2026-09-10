# CoCo releases

The `CoCo macOS Release` GitHub workflow builds an Apple Silicon DMG and publishes
a draft-then-final GitHub Release. Dispatch it with a new semantic version from
the intended commit. It applies CoCo branding only in the build checkout, uses
ad-hoc signing, verifies the mounted app signature and DMG integrity, and publishes
the installer with its checksum. A workflow run publishes a release; do not use
it solely to test packaging.

This pilot is not Developer ID signed or notarized. Installation may require a
macOS security exception or organization approval. Updates are manual, and CoCo
uses `~/.coco` rather than stock T3's data directory.

Windows x64 packaging is retained, but there is no CoCo Windows release workflow.
For packaging validation in a disposable build checkout with the required Rust,
Python and MSVC tools installed:

```sh
node scripts/update-release-package-versions.ts <version>
node scripts/prepare-coco-release.mjs
vp run dist:desktop:artifact --platform win --target nsis --arch x64 --build-version <version>
```

Do not run the branding overlay in a development checkout: it rewrites source
and manifest inputs for packaging. Build outputs go to the ignored `release/`
directory. The overlay is applied once per clean build checkout.

Windows packages contain a separate server payload. WSL additionally requires
a Linux node-pty prebuild supplied through `--wsl-prebuild` or
`T3CODE_DESKTOP_WSL_PREBUILD`; without it the packaged WSL backend is unavailable.
Retain the packager's payload/hash verification and test installation on a clean
Windows machine before distributing a Windows build.

Run focused tests and relevant typechecks before publishing. Validate the
packaged app on its target OS; a successful bundle build alone does not prove
installation or launch. Never publish test artifacts automatically.
