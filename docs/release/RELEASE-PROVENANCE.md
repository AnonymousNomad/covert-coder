# Release provenance

The source-release provenance chain is deliberately explicit:

| Element | Value |
| --- | --- |
| Source SHA | `dc0d30ee226e7ff822592e3a800f064b4441b7af` |
| Source branch | `audit/wiring-ledger` |
| Parent | `93470116536718c9af089dc7e2a7e9509eced31f` |
| CI | [AIDE CI run 35869659152](https://github.com/AnonymousNomad/covert-coder/actions/runs/35869659152) |
| Certification | [source certification record](SOURCE-CERTIFICATION-RECORD.md) |
| Lockfile | SHA-256 recorded in [the dependency baseline](DEPENDENCY-BASELINE-CERTIFIED.md) |
| SBOM | Generated from the candidate lockfile with npm SBOM/CycloneDX; hash is in the release manifest |
| Checksums | SHA-256 for the actual source archive and release metadata artifacts |
| Claims | [certified claim matrix](RELEASE-CLAIM-MATRIX.md) |
| Limitations | [known limitations](KNOWN-LIMITATIONS.md) |

The public artifact invariant is:

```text
PUBLIC ARTIFACT -> EXACT SOURCE SHA -> EXACT TEST/CERTIFICATION EVIDENCE
```

The release manifest and machine-readable provenance companion are generated in
the separate release artifact set. They are not part of the immutable candidate
and do not alter its SHA.
