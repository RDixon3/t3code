# CoCo

CoCo is a desktop-focused fork of [T3 Code](https://github.com/pingdotgg/t3code), supporting Windows x64 and macOS Apple Silicon. The Electron app embeds the web client and local server; the web client is also available for development testing.

## Installation

Download available CoCo installers from [this repository’s releases](https://github.com/RDixon3/t3code/releases). The current published pilot is for Apple Silicon; Windows packaging is retained for development. Install and authenticate your coding-provider CLI separately. Upstream package-manager installs and `npx t3` install stock T3, not CoCo.

## Development

Node 24 is required. Use `vp run dev:desktop` for Electron or `vp run dev` for the web client and server. Follow the [development runbook](docs/operations/development.md) for isolated state and pairing.

For a smaller download, clone with `--depth 1`. Maintainers integrating upstream history can use a full clone or deepen it later. Removed source remains in Git history.

## Documentation

See [user and contributor docs](docs/README.md), [contribution guidance](CONTRIBUTING.md), and the [CoCo release runbook](docs/operations/release.md). Upstream runtime compatibility and license notices are preserved.

### Install `vp`

T3 Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```
