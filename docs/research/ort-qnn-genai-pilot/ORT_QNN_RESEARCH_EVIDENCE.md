# ORT GenAI + QNN Research Evidence

**Checked:** 2026-10-04 UTC
**Method:** inspect pinned upstream source, release pages and package metadata; preserve access failures; no source model download, model conversion, runtime install, device run, implementation, or dependency change was performed.

## Primary source ledger

| Source | Exact ref/date checked | Claim supported | Confidence / limits |
|---|---|---|---|
| [Microsoft ONNX Runtime GenAI source](https://github.com/microsoft/onnxruntime-genai/tree/v0.17.0) | Tag `v0.17.0`, commit `1d67be30e5b1ed0c264f6f41c598f85157e8288b`, release commit dated 2026-09-25 | OGA 0.17.0 code/docs and Python API source; wheel metadata requires ORT >=1.30.0 | High for pinned source/metadata; not runtime evidence. |
| [OGA QNN guide](https://github.com/microsoft/onnxruntime-genai/blob/v0.17.0/docs/qnn.md) | Same OGA tag | QNN plugin registration before model loading; QNN-prepared ONNX/GenAI config; token-by-token generation; package helper APIs | High for documented integration; no exact candidate device run. |
| [OGA model package docs](https://github.com/microsoft/onnxruntime-genai/blob/v0.17.0/docs/model_package.md) | Same OGA tag | ORT GenAI package/variant structure and `manifest.json` option | High; Olive recipe output is described separately as a compatible model directory. |
| [OGA privacy docs](https://github.com/microsoft/onnxruntime-genai/blob/v0.17.0/docs/Privacy.md) | Same OGA tag | Telemetry enabled by default; `ORT_DISABLE_TELEMETRY=1` before initialization disables uploader/events/persistent identifier for process life | High; must still test actual egress in Covert process. |
| [OGA constrained-decoding docs](https://github.com/microsoft/onnxruntime-genai/blob/v0.17.0/docs/ConstrainedDecoding.md) | Same OGA tag | JSON/schema/grammar constrained-generation surface | High for API docs; QNN/Genie and candidate model combination untested. |
| [OGA Engine C API spec](https://github.com/microsoft/onnxruntime-genai/blob/v0.17.0/docs/engine_c_api_spec.md) and [Python binding source](https://github.com/microsoft/onnxruntime-genai/blob/v0.17.0/src/python/python.cpp) | Same OGA tag | Separate Engine/Request cancellation API exists; Python standard Generator binding lacks cancellation member | High for source surface; Engine + QNN Genie interoperability unknown. |
| [Qualcomm/Microsoft ORT QNN EP source](https://github.com/onnxruntime/onnxruntime-qnn/tree/v2.6.0) | Tag `v2.6.0`, peeled commit `7332461750cb7fefc6444a674ebe34ce5c9c0d01`; tag commit dated 2026-09-09 | Plugin package, install matrix, version and license docs | High for pinned source; no Covert deployment evidence. |
| [QNN EP release README](https://github.com/onnxruntime/onnxruntime-qnn/blob/v2.6.0/README.md) | Same QNN tag | Python wheel Windows ARM64 inference, Windows x64 AOT; README requirements text lists Python 3.11.x and NumPy constraints; plugin install flow | High for pinned source content; the PyPI wheel listing includes CPython 3.12 ARM64 despite the README's narrower Python line (documentation discrepancy; cause unknown). |
| [QNN EP provider docs](https://github.com/onnxruntime/onnxruntime-qnn/blob/v2.6.0/docs/execution_providers/QNN-ExecutionProvider.md) | Same QNN tag | QNN 2.6.0 tested with QAIRT 2.50.40 and ORT 1.27.0; docs claim ORT >=1.24.1 compatibility; Genie Windows ARM64 path requires QAIRT >=2.45.40 / Genie API >=1.17; EPContext/DLC behavior, KV rewind and EP details | High for docs; chosen OGA+QNN+ORT tuple is not stated as jointly tested. |
| [QNN QDC device list](https://github.com/onnxruntime/onnxruntime-qnn/blob/v2.6.0/qcom/scripts/all/qdc_runner.py) | QNN tag `v2.6.0` | Source labels `Hamoa SC8380XP` and `Glymur SC8480XP`; one Hamoa CI device is commented out and the QDC entry identifies Glymur | High for the repository's labels only; not an OEM SKU or authoritative support mapping. |
| [PyPI `onnxruntime-genai` 0.17.0](https://pypi.org/project/onnxruntime-genai/0.17.0/) | PyPI JSON and file metadata checked 2026-10-04 | CPython 3.12 Windows ARM64 wheel name, SHA/size; ORT core minimum | High for published registry metadata. |
| [PyPI `onnxruntime-qnn` 2.6.0](https://pypi.org/project/onnxruntime-qnn/2.6.0/) | PyPI JSON and downloaded wheel checked 2026-10-04 | CPython 3.12 Windows ARM64 wheel, SHA/size; plugin and embedded files including Genie/QNN DLLs and license materials | High for exact artifact bytes and metadata; redistribution must follow included terms. |
| [PyPI `onnxruntime` 1.30.0](https://pypi.org/project/onnxruntime/1.30.0/) | PyPI metadata checked 2026-10-04 | CPython 3.12 Windows ARM64 core wheel and SHA/size | High for file metadata; exact tuple untested. |
| [Microsoft Olive Recipes](https://github.com/microsoft/olive-recipes/tree/fe22c43adb56f2e43998dad6e279b7364441eaeb) | Commit `fe22c43adb56f2e43998dad6e279b7364441eaeb`, dated 2026-09-30 | Candidate Phi-4 model recipe, HTP options, preparation requirements and conflicting SoC statements | High that the contradiction is present in pinned files; root cause unknown. |
| [Pinned Olive Hugging Face config](https://github.com/microsoft/Olive/blob/f7efd41ab24a2eb07be7edc6d84d0f6304b46598/olive/model/config/hf_config.py) and [HF model tests](https://github.com/microsoft/Olive/blob/f7efd41ab24a2eb07be7edc6d84d0f6304b46598/test/model/test_hf_model.py) | Olive commit `f7efd41ab24a2eb07be7edc6d84d0f6304b46598` | Olive `load_kwargs` passes through `revision`; tests exercise a pinned revision. The Phi-4 recipe script also makes independent HF loads and needs equivalent pinning/local snapshot treatment. | High for Olive API behavior; no assertion that every recipe load is pinned today. |
| [Pinned Phi-4 QAIRT recipe README](https://github.com/microsoft/olive-recipes/blob/fe22c43adb56f2e43998dad6e279b7364441eaeb/microsoft-Phi-4-mini-instruct/QAIRT/README.md) | Same Olive Recipes commit | Ubuntu 22.04/Python 3.10.12/qairt-dev 0.8.1/QAIRT2.45.40 preparation; README says target SC8480XP and points X Elite to SC8380XP config | High for exact README content; no hardware validation independently reproduced. |
| [Phi-4 QAIRT recipe JSON](https://github.com/microsoft/olive-recipes/blob/fe22c43adb56f2e43998dad6e279b7364441eaeb/microsoft-Phi-4-mini-instruct/QAIRT/htp_sc8380xp.json) | Same Olive Recipes commit; SHA-256 `a6aa30ba71da7c2a53e0daaaff6f18de6159822de9dc9efe29ea75dde3037e2b` | Model ID, `trust_remote_code`, SC8380XP target, HTP/sequence/VTCM/encapsulation options | High for checked bytes; conversion output unknown. |
| [Phi-4 HTP quantization config](https://github.com/microsoft/olive-recipes/blob/fe22c43adb56f2e43998dad6e279b7364441eaeb/microsoft-Phi-4-mini-instruct/QAIRT/htp_quantsim_config_v73.json) | Same Olive Recipes commit; SHA-256 `9a1b05bfa4e5c850a795af4499a8dbd31116696b4487eebac7704cdba9fad203` | Recipe helper selects a V73 quantization configuration | High for source bytes; not proof that a retail SoC/driver is V73 or supported. |
| [Phi-4 preparation script](https://github.com/microsoft/olive-recipes/blob/fe22c43adb56f2e43998dad6e279b7364441eaeb/microsoft-Phi-4-mini-instruct/QAIRT/phi4_mini_script.py) | Same Olive Recipes commit; SHA-256 `18d2bf9190b8f16eb0bf45656f18f4123514452aea161946e3402987f5a35dce` | Script sets context candidate 4096; loads source/model code and saves tokenizer/config during preparation | High for source; no converter output exists here. |
| [Phi-3.5 QAIRT/QNN fallback recipe](https://github.com/microsoft/olive-recipes/tree/fe22c43adb56f2e43998dad6e279b7364441eaeb/microsoft-Phi-3.5-mini-instruct/QNN) | Same Olive Recipes commit | Older recipe exists; README dependency line uses old QNN `1.23.2` path | High for presence; not compatible evidence for QNN2.6/Genie. |
| [Qualcomm AI Stack License included in QNN wheel](https://pypi.org/project/onnxruntime-qnn/2.6.0/) | Extracted `onnxruntime_qnn/Qualcomm_LICENSE.pdf` from exact wheel; PDF dated/versioned by package, SHA is covered by parent wheel | License grants development use and object-code distribution only when incorporated into an application; no standalone redistribution grant; legal obligations apply | High for text in bundled license; legal counsel must assess Covert distribution facts. |
| [QNN EP MIT license](https://github.com/onnxruntime/onnxruntime-qnn/blob/v2.6.0/LICENSE) | QNN tag | Source repo MIT license | High for project license; separate binaries/Qualcomm license remain. |
| [Olive MIT license](https://github.com/microsoft/Olive/blob/f7efd41ab24a2eb07be7edc6d84d0f6304b46598/LICENSE) and [Olive Recipes MIT license](https://github.com/microsoft/olive-recipes/blob/fe22c43adb56f2e43998dad6e279b7364441eaeb/LICENSE) | Pinned commits above | Preparation tooling/repository license declarations | High for those source repositories; their dependency binaries and QAIRT/model terms remain separate. |
| [PyPI NumPy 2.3.3 metadata](https://pypi.org/project/numpy/2.3.3/) | PyPI JSON/wheel checked 2026-10-04 | BSD license text and notices for bundled components; exact wheel hash is listed above | High for package metadata/wheel; final distribution still needs dependency-level notice inventory. |
| [GitHub advisory GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Advisory page checked 2026-10-04 | Candidate moderate `brace-expansion` issue, CVE-2026-102277, fixed version 5.0.12 | High for the public advisory text; does not identify the repository's blocked Dependabot alert. |
| [Microsoft Phi-4 mini source page](https://huggingface.co/microsoft/Phi-4-mini-instruct) | Attempted metadata and Git access 2026-10-04 | Would establish exact revision/model card/license | Unavailable; both API and Git transport received CONNECT 403. Model revision/license remain `UNKNOWN`. |
| [Microsoft Phi-3.5 mini source page](https://huggingface.co/microsoft/Phi-3.5-mini-instruct) | Attempted metadata 2026-10-04 | Would establish exact revision/model card/license | Unavailable; CONNECT 403. Source revision/license remain `UNKNOWN`. |
| [Qualcomm QNN supported-device documentation](https://docs.qualcomm.com/doc/80-63442-10/topic/QNN_general_overview.html#supported-snapdragon-devices) | Attempted 2026-10-04, URL linked from pinned QNN docs | Authoritative mapping of raw SoC model numbers to supported devices | CONNECT 403; cannot resolve Olive recipe mismatch. |
| Lenovo Yoga Slim 7x PSREF and Microsoft Surface technical specs | Attempted 2026-10-04 | Would verify a retail SKU and processor/device identity | Both blocked at CONNECT with 403; no exact retail SKU is established. |

### Exact package checksums observed

| File | SHA-256 | Bytes |
|---|---|---:|
| `onnxruntime_genai-0.17.0-cp312-cp312-win_arm64.whl` | `3953c5ec530084b76af91b12d6fea56d9522d9c16d573af0a90d703274976321` | 4,064,122 |
| `onnxruntime_qnn-2.6.0-cp312-cp312-win_arm64.whl` | `c8b9e43d131d2a00c3062aaf9e6e5f13c6028707ee103fb3f13bec1d7395a0bf` | 59,225,752 |
| `onnxruntime-1.30.0-cp312-cp312-win_arm64.whl` | `dc4c706f1935ebb62356e6a095b047859badd854482c40560888e95c328ed262` | 14,175,072 |
| `numpy-2.3.3-cp312-cp312-win_arm64.whl` | `ca0309a18d4dfea6fc6262a66d06c26cfe4640c3926ceec90e57791a82b6eee5` | 10,195,936 |

The QNN wheel contains `onnxruntime_providers_qnn.dll`, `Genie.dll`, `QnnGpu.dll`, `QnnHtp.dll`, `QnnHtpNetRunExtensions.dll`, `QnnHtpPrepare.dll`, HTP V68/V73/V81 stubs, other QNN DLLs, `Qualcomm_LICENSE.pdf`, and `ThirdPartyNotices.txt`. Its `onnxruntime_qnn/build_and_package_info.py` states `qnn_version = '2.50.40'`. This list is from the downloaded wheel. Hash every extracted runtime file in an eventual Covert lock; wheel SHA alone is the download identity.

The complete high-impact QNN plugin/Genie/HTP DLL and license-notice member hashes were computed from the wheel and are recorded in `ORT_QNN_ARTIFACT_PACKAGE.md`. In particular, its bundled `QnnHtpPrepare.dll` is 89,803,984 bytes; this contributes to disk/package sizing. Those hashes say nothing about OEM driver/firmware installed on the Snapdragon device.

## Key unknowns preserved

| Question | Status | What would resolve it |
|---|---|---|
| Is Phi-4 QAIRT recipe target SC8380XP or SC8480XP? | `OPEN / CAUSE_UNKNOWN` | Corrected authoritative recipe plus Qualcomm supported-device mapping and exact physical-device report. |
| Which Windows OEM SKU should be selected? | `UNKNOWN` | Accessible OEM spec that binds retail SKU, SoC raw ID, Windows ARM64 and supported HTP driver. |
| Which exact model commit/license is allowed? | `UNKNOWN` | Official Hugging Face/API or Microsoft model release metadata; source hashes and license review. |
| Which exact files and hashes will QAIRT produce? | `UNKNOWN` | Successful pinned conversion; inventory and hash the complete output tree. |
| Does OGA 0.17 + ORT 1.30 + QNN 2.6 work together on target? | `UNKNOWN` | Physical integration run on the exact Windows ARM64 device and package. |
| Which driver/firmware floor is required? | `UNKNOWN` | Qualcomm/OEM primary support matrix and measured device package. |
| Is Generator cancellation available for the Genie pathway? | `UNKNOWN`/not in standard binding | Physical cancellation tests; source-compatible API or owned-child termination that reliably resets NPU. |
| How are NPU/HTP memory/thermals reported? | `UNKNOWN` | Validate device/OS/vendor counters and their units on selected SKU. |
| Can Covert redistribute the QNN wheel/runtime assets? | `BLOCKED pending legal review` | Qualcomm legal review of included AI Stack License and exact packaging/delivery model. |

## Dependabot read-only evidence

### First red: exact alert endpoint

Read-only request made against `AnonymousNomad/covert-coder`:

```text
GET /repos/AnonymousNomad/covert-coder/dependabot/alerts?state=open&per_page=100
```

`gh api` returned `403 Forbidden`, exit 1. `gh auth status` reported it could not log in with the configured token. Anonymous GET of the repository Dependabot UI returned 404; GitHub can obscure private/unauthorized security pages, so this does not prove absence. No tokens were read or printed. The original request, environment, exit code and state impact are recorded at `/tmp/DEPENDABOT_ALERT_API_FIRST_RED_20261004.md` outside the repository workspace; no product state changed.

### Default-branch current lock cross-check

- Remote default ref was read as `covert-production` SHA `81aff88b924db05c689dc734aa3e67605f4b18ce`; only that remote-tracking ref was fetched. Work remained on research branch.
- Only `package.json` and `package-lock.json` were copied to `/tmp/covert-dependabot-triage-81aff88`; no dependencies were installed or modified.
- `npm audit --json` exit 1 reported 2 items: zero moderate, one high and one low. `brace-expansion@5.0.9` is `dev:true`, via `minimatch@10.2.6` (`dev:true`); root package only gets minimatch through dev-tool dependency edges. npm reports a moderate `GHSA-q2hr-2g5m-vwhr` / `CVE-2026-102277` patched at `5.0.12`, plus two high advisories for the package. `dompurify@3.4.13` is production/transitive through Monaco and reports a low GHSA; `npm audit --omit=dev` shows only that low finding.
- The repository source has no direct `minimatch`/`brace-expansion` import. `rg` search of tracked source produced no matches. The lock and audit show a dev/build graph edge, not a direct runtime dependency. No attacker-controlled brace pattern path was identified in source; this is not proof that all build-tool paths are unreachable.
- Public GHSA page information supports the advisory's affected/fixed range, but not that it is the exact repository alert. Its moderate/high aggregate differs from GitHub's reported “one moderate.”

**Conclusion:** exact dependency/advisory/installed/fixed values for the single reported GitHub alert are not observable in this environment. The `brace-expansion` tuple is a candidate correlation only; do not attribute it to that alert without alert metadata. If confirmed, the package fix is routine at the lock level (`>=5.0.12` for the moderate GHSA), but the higher-severity advisories need the normal dependency owner to choose a fully patched version. No dependency was changed or alert dismissed.

## Preserved research execution issues

The full earlier first-red log is preserved at `/tmp/ORT_QNN_RESEARCH_FIRST_REDS_20261004.md`. Material records:

- Hugging Face model metadata/Git, Qualcomm supported-device docs, Lenovo PSREF and Microsoft device pages returned CONNECT 403; affected claims remain unknown.
- An OGA source query initially used a nonexistent `include/` path and a pipeline that masked `rg` failure; the source tree was inspected and queried at actual paths. That initial output was not treated as evidence.
- A QNN source query asked for OGA's `docs/qnn.md` in the wrong checkout; corrected by reading the pinned OGA checkout.
- Olive's optional `QAIRT/info.yml` did not exist; generated output contents remain unclaimed.
- A skill lookup used an unregistered package alias on its first attempt; it returned “package is not available”; corrected using the listed package ID. No repository state changed.

All source acquisition failures are bounded to this research environment; none was presented as runtime success. The SC8380XP/SC8480XP contradiction and GitHub alert API denial remain open blockers.

### Runtime dependency pin first red and correction

- Initial candidate pin: `numpy==1.26.4`, selected from QNN's documented `1.25.2 or >=1.26.4` constraint without first checking wheel tags.
- Reproduction: PyPI JSON for NumPy 1.26.4 contained no `cp312-cp312-win_arm64` artifact. `python3 -m pip download --no-deps --only-binary=:all: --platform win_arm64 --python-version 312 --implementation cp --abi cp312 --dest /tmp/ort-qnn-numpy-probe-20261004 numpy==1.26.4` exited 1. Exact relevant output: `ERROR: Ignored the following yanked versions: 2.4.0`; `ERROR: Could not find a version that satisfies the requirement numpy==1.26.4`; `ERROR: No matching distribution found for numpy==1.26.4`. Full command output is also preserved at `/tmp/ORT_QNN_NUMPY_1_26_4_FIRST_RED_20261004.log` in the cloud workspace.
- Root cause: QNN's minimum-version statement is not a platform wheel-availability guarantee; the candidate pin lacked a native wheel for the selected CPython/Windows ARM64 target.
- Repair: changed the candidate to NumPy 2.3.3, which satisfies the documented `>=1.26.4` range and has a Windows ARM64 CPython 3.12 wheel. Platform-constrained `pip download` succeeded; SHA-256 `ca0309a18d4dfea6fc6262a66d06c26cfe4640c3926ceec90e57791a82b6eee5`, size 10,195,936 bytes.
- Status: wheel availability verified; tuple installation, ABI interaction, and physical inference remain unverified. The first red is preserved; no package was installed into the project or on a device.

### Candidate target-tagged dependency closure

- Command: `python3 -m pip download --only-binary=:all: --platform win_arm64 --python-version 312 --implementation cp --abi cp312 --dest /tmp/ort-qnn-runtime-wheelhouse-20261004 onnxruntime-genai==0.17.0 onnxruntime-qnn==2.6.0 onnxruntime==1.30.0 numpy==2.3.3`.
- Result: exit 0; pip resolved and downloaded 11 wheels, including all four pinned direct runtime packages and the QNN/ORT transitive dependencies.
- Verification: each wheel's SHA-256 was recomputed locally and matched the `digests.sha256` value for the exact filename/version in PyPI's JSON API. Hashes and byte sizes are in `ORT_QNN_ARTIFACT_PACKAGE.md`.
- Size observation: the 11-wheel compressed wheelhouse is 94,965,668 bytes. The QNN wheel has 28 members and expands to 160,127,612 bytes, including `QnnHtpPrepare.dll` at 89,803,984 bytes.
- Boundary: this is download/metadata resolution for target tags only. It did not install packages, import native libraries, verify wheel ABI together, or execute inference on Windows ARM64/QNN hardware. The result does not close runtime qualification.

### Capability matrix CSV first red and correction

- First validator result: 25 records, header width 7; rows 18 and 19 parsed as width 8. The surplus cells split after unquoted commas in the notes for Linux ARM64 Genie support and Windows x64 AOT support.
- Root cause: free-text CSV fields containing commas were authored without RFC 4180 quoting.
- Repair: quoted both complete notes fields; no capability classification or wording changed.
- Regression check: rerun `csv.DictReader`; require every row to match the header width, statuses to be in `SUPPORTED`, `PARTIAL`, `EXPERIMENTAL`, `NOT SUPPORTED`, `UNKNOWN`, and evidence URLs to be nonempty.
- Later cross-artifact validator red: an ad hoc assertion expected 35 matrix records and failed because the completed matrix has 34. The CSV parsed as 34 records with 7 fields each and valid statuses; the hard-coded expected count was an incorrect validator assumption, not a malformed artifact. The validator was corrected to require a nonempty dataset and schema/status/evidence validity. It then passed alongside wheel/provider/source hash checks.

### Cross-artifact validator harness corrections

- A content checker first searched for a stale heading label (`Exact recipe input hashes observed`) that was not present in the artifact; it stopped with `IndexError` before comparing hashes. Inspection showed the actual section label, “The candidate recipe is pinned.”
- The next version guessed 13 recipe files, while the pinned subtree and manifest table each contain 14. It stopped on the incorrect count before hash comparison. This was another validator assumption, not a recipe/package failure.
- The final validator enumerates wheelhouse files, QNN wheel assets, and the pinned Olive recipe subtree rather than assuming counts. It passed: exactly 5 deliverables; all local Markdown links valid; 11 wheel entries match file/hash/size; 15 QNN DLL/license/build metadata entries match wheel contents; all 14 recipe-subtree files are listed and hash-matched; capability matrix parses as 34 rows × 7 columns with valid status/evidence fields.
- Staged `git diff --cached --check` then found seven trailing double-space Markdown line endings in document metadata. Root cause: CommonMark hard-break formatting conflicts with this repository's whitespace invariant. Removed only the trailing spaces; no wording changed.
- A later all-evidence rerun closed the QNN wheel ZIP context before hashing its members and raised `ValueError: Attempt to use ZIP archive that was already closed`. Root cause: the validator's archive lifetime ended before the member loop. Correct the validator to perform member reads inside the open context, then rerun the complete check.
