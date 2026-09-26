# Covert release integrity contract

Status: source audit and future requirements only. No signing or updater configuration changed.

## Current source truth

The desktop source defines Tauri bundle targets as all and configures PNG/ICO identity assets, but the repository does not establish an actual signed release artifact in this lane. The installed executable and uninstaller in the frozen preflight were NotSigned. That fact applies to that unknown installed build only.

The current Tauri config has no explicit Windows bundle settings, publisher, stable MSI upgradeCode, updater plugin/configuration, updater public key, or signed update metadata. No SBOM output or source-to-artifact provenance chain was verified. package-lock.json and desktop/Cargo.lock exist, but lockfile presence does not prove dependency scanning, license review, or a reproducible release.

The source includes historical manifest scripts, but the existing release manifest script is tied to a prior fixed candidate and is not a general artifact-directory manifest. The new qualification manifest tool records file name, relative path, byte size, and SHA-256. Caller-supplied source SHA, version, product identity, and timestamp are marked as supplied and not independently verified. Signing and SBOM fields remain UNVERIFIED.

## Required release record

Every candidate release record must bind:

1. Exact source commit and clean-tree evidence.
2. Candidate version, product identity, installer target/type, build environment, and build timestamp.
3. Installer and packaged executable filenames, relative paths, sizes, and SHA-256 values.
4. Authenticode status and signer identity for executable and installer, independently verified against release policy.
5. SBOM and dependency/license/security scan results tied to lockfile and artifact hashes.
6. Update metadata and signature verification, including rollback behavior and minimum version policy.
7. Upgrade identity, install scope, WebView2 prerequisite/deployment, and uninstall behavior.
8. Evidence that published bytes match the qualified manifest.

Unknown or unavailable fields must remain UNVERIFIED. Hashing proves byte identity, not publisher authenticity or source provenance.

## Updater decision

No updater is currently configured. Tauri’s updater requires a trusted update signature and a public verification key in app configuration; the signing private key must remain secret and loss of that key can prevent future updates. Do not enable an updater until the release owner chooses a deployment channel and private signing-key custody model. Private keys must remain outside the repository, be access-controlled, and have documented rotation and recovery. An updater must reject unsigned, wrong-key, wrong-product, wrong-version, and wrong-hash payloads before replacing the installed build. [Tauri updater plugin](https://v2.tauri.app/plugin/updater/).

## Release acceptance

- Verify stable product and upgrade identity across at least two signed candidates.
- Verify signatures on the executable, installer, and update payload.
- Verify update metadata is authenticated and binds exact artifact hashes.
- Test interrupted update, invalid signature, downgrade, rollback, repair, uninstall, and reinstall on a disposable standard-user profile.
- Preserve user/project state by explicit policy and verify credential handling without exposing secret values.
- Retain signed provenance, SBOM, scan reports, release notes, and the exact manifest for each published version.
