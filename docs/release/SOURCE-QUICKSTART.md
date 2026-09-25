# Covert source-release quickstart

This is the source path for the certified core. It is not a packaged desktop
installer and it does not bundle model weights.

## Prerequisites

- Windows, macOS, or Linux with a supported Node.js installation. Node.js
  `26.4.0` is the pinned CI environment used for this candidate; the package
  declares `>=20`, but compatibility with Node 20 is not established by that
  declaration alone.
- Git on `PATH` for repository operations.
- A writable checkout and enough disk space for dependencies.
- For local chat: a compatible `llama-server` binary and a verified local GGUF
  or Safetensors artifact. No model weights are included in this source tree.

## Install and inspect readiness

```powershell
git clone https://github.com/AnonymousNomad/covert-coder.git
Set-Location covert-coder
npm ci
npm run doctor
```

`doctor` is an installation preflight. It can pass while reporting warnings
for optional local runtime/model artifacts. Do not interpret a doctor pass as a
claim that a model is `READY`.

## Start the source workbench

```powershell
npm start
```

Keep that terminal open. Open `http://127.0.0.1:4173/` in a browser and follow
the pairing prompt presented by the running source stack. The exact source
startup path owns the local services; do not start a second copy on the same
ports.

## Local model path

Set the runtime and model artifact explicitly before starting a local model:

```powershell
$env:AIDE_LLAMA_SERVER = 'C:\path\to\llama-server.exe'
$env:AIDE_MODEL_PATH = 'C:\path\to\verified-model.gguf'
npm run doctor
npm start
```

The source release does not download private model assets automatically. Model
license and checksum requirements belong to the selected model, not to this
source archive.

## Optional providers

External providers are optional, explicit, and consent-gated. Keep provider
credentials in the supported local configuration path; never place credentials
in Git, Memory, logs, evidence, screenshots, or issue reports.

## Verification boundary

The certified candidate proves the governed source core, including evidence-
backed verification, workflow continuity, restart behavior, and isolation within
the certified scope. The permanent Resident qualification, packaged installer,
Capability Fabric runtime, and delegation runtime are not included in this
source-release status. See [known limitations](KNOWN-LIMITATIONS.md).
