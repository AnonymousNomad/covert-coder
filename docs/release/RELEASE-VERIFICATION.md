# Source-release verification

The source release is traceable through this chain:

```text
source archive
  -> candidate SHA dc0d30ee226e7ff822592e3a800f064b4441b7af
  -> AIDE CI run 35869659152
  -> independent certification record
```

## Verify the source identity

```powershell
git rev-parse HEAD
git show -s --format='%H%n%P%n%s' dc0d30ee226e7ff822592e3a800f064b4441b7af
```

The first line must be the certified SHA when verifying a checkout. The source
archive was produced with `git archive` from that exact object, not from a dirty
worktree.

## Verify artifact hashes

Use the published `SHA256SUMS.txt` from the same release artifact set:

```powershell
Get-FileHash .\covert-source-dc0d30ee.zip -Algorithm SHA256
Get-FileHash .\covert-source-dc0d30ee.sbom.cdx.json -Algorithm SHA256
Get-FileHash .\covert-source-dc0d30ee.provenance.json -Algorithm SHA256
Get-FileHash .\covert-source-dc0d30ee.release-manifest.json -Algorithm SHA256
```

Compare each result to the corresponding line in `SHA256SUMS.txt`. The SBOM is
an inventory and provenance artifact; it is not evidence that the dependency
set has no vulnerabilities.

## Reproduce the source preflight

```powershell
npm ci
npm run doctor
```

Record warnings honestly. The candidate source tree does not include GGUF
weights or a packaged installer.

## Evidence and limitations

- [Certification record](SOURCE-CERTIFICATION-RECORD.md)
- [Certified dependency baseline](DEPENDENCY-BASELINE-CERTIFIED.md)
- [Known limitations](KNOWN-LIMITATIONS.md)
- [Claim matrix](RELEASE-CLAIM-MATRIX.md)
