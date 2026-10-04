# ORT GenAI + QNN Artifact Package Design

**Status:** proposed packaging contract; no conversion or package build was run.
**Pilot scope:** one model, one Windows ARM64/QNN Genie profile, one exact device identity.
**Critical unresolved input:** `SC8380XP` versus `SC8480XP` target discrepancy documented in `ORT_QNN_PILOT_RESEARCH.md`.

## Identity rules

The model repository, a downloaded source checkpoint, a quantized/transformed ONNX graph, a Genie/QNN compiled package, and the runtime wheels are distinct identities. Never reuse the source repository revision/hash as the identity of a derived artifact. No artifact becomes `QUALIFIED` merely because all files download or a provider package installs.

Use SHA-256 for every file and a deterministic package-tree digest over normalized relative path + file size + file SHA-256. Reject symlinks, path traversal, duplicate normalized paths, unlisted files, missing files, and changes after verification. Hash the exact bytes Covert loads. Sign the top-level manifest in the later implementation lane with the release/owner key; this research branch does not create a signature or key.

## Proposed package structure

This is a Covert-owned *logical package contract*, not a claim that Olive emits these exact names. Preserve Olive's emitted model directory byte-for-byte beneath `model/`; enumerate actual names only after a successful conversion and review.

```text
covert-ort-qnn-phi4-<package-id>/
├── covert-manifest.json             # Covert package identity and all per-file hashes
├── model/                            # Exact Olive output tree, unmodified
│   ├── genai_config.json             # Expected by OGA; presence/content must be verified
│   ├── <actual tokenizer/config files>
│   ├── <actual EPContext ONNX file(s)>
│   ├── <actual referenced Genie DLC/context file(s)>
│   └── <actual external tensor data, if emitted>
├── provenance/
│   ├── source-model.json             # Repo, immutable revision, source files/hash inventory
│   ├── remote-code-review.json       # Exact code hashes and review disposition
│   ├── conversion-inputs.json        # Olive/toolchain/options/host/recipe/calibration identity
│   ├── conversion-log.txt            # Redacted reproducible command/log; no tokens/secrets
│   └── output-tree.json              # Actual file list, hashes, sizes, tree digest
├── licenses/
│   ├── ORT-GenAI-MIT.txt
│   ├── ORT-Core-MIT.txt
│   ├── ORT-QNN-MIT.txt
│   ├── NumPy-license-and-bundled-notices.txt
│   ├── ORT-third-party-notices.txt
│   ├── runtime-transitive-SBOM.json
│   ├── Qualcomm-AI-Stack-License.pdf # only if redistribution is approved
│   └── model-license-and-notices/    # only after exact model terms are verified
└── runtime-lock.json                 # Runtime package identities; wheels may remain separate
```

The upstream `onnxruntime-genai` 0.17.0 documentation also defines a `.ortpackage` manifest format with variant directories and content-addressed shared assets. The selected Olive README instead describes its output as an ORT GenAI-compatible directory. Do not wrap/rearrange Olive output into the OGA multi-variant format unless a later tested consumer requires it. If that format is used later, record both the untouched converter-output tree digest and the packaged/wrapped tree digest as separate derived objects.

Do not put the proprietary QAIRT preparation SDK in the end-user runtime package. Do not bundle QNN user-space DLLs until legal review confirms the Qualcomm AI Stack License permits that exact distribution and delivery method. A package can refer to a pinned runtime-lock and verified dependency cache instead.

## Preparation workflow and source pinning

The source recipe instructions at the pinned recipe commit describe this host workflow:

```bash
# Preparation host: Ubuntu 22.04, CPython 3.10.12.
# Work from a copy of the QAIRT recipe directory after pinning the source snapshot.
python3.10 -m venv .venv
. .venv/bin/activate
python -m pip install --no-deps -r requirements.txt
python -m pip install --no-build-isolation \
  git+https://github.com/microsoft/Olive.git@f7efd41ab24a2eb07be7edc6d84d0f6304b46598
python -m pip install --no-deps qairt-dev==0.8.1
qairt-vm fetch -v 2.45.40
export QAIRT_SDK_ROOT=/opt/qcom/aistack/qairt/2.45.40
olive run --config htp_sc8380xp.json
```

These are the upstream recipe commands, not executed commands and not an approved package build. The recipe README says to authenticate to Hugging Face before download. Keep any token in its credential helper; never place a token in shell history, manifest, or logs.

Do not run the stock floating model reference for a governed build. The pinned Olive `HfLoadKwargs` supports passing a `revision` (the pinned source tests this), but this recipe's script makes its own `from_pretrained` calls and the checked-in recipe does not pin a model revision. After an immutable source commit is resolved, use a verified local snapshot for **every** model load or pass the exact revision through every loading path. Hash the modified recipe/script and record its diff as converter inputs. The current source host access denial prevents resolving that revision here.

The prep recipe's `requirements.txt` pins its own tool environment and includes older preparation-stack packages such as `onnxruntime==1.23.2`, `onnxruntime-genai==0.8.2`, and `numpy==1.24.4`. These are not the proposed Windows ARM64 target runtime pins. Keep prep and target environments separate; do not let those build requirements overwrite the target lock.

## Source identity

Before conversion, record:

```json
{
  "repository": "microsoft/Phi-4-mini-instruct",
  "revision": "<immutable upstream commit; UNKNOWN until retrieved>",
  "revision_resolved_at_utc": "<timestamp>",
  "source_files": [{"path": "<relative path>", "size": 0, "sha256": "<64 hex>"}],
  "license_files": [{"path": "<relative path>", "sha256": "<64 hex>"}],
  "remote_code": [{"path": "<file>", "sha256": "<64 hex>", "review": "required"}]
}
```

`trust_remote_code=true` appears in the pinned recipe configuration. The conversion operator must inspect and pin the exact loaded source code before execution; no floating model tag or branch is admissible. At the time of this audit, Hugging Face source metadata and Git were blocked; the model license and revision remain `UNKNOWN`.

## Converter identity and options

The candidate recipe is pinned to Olive Recipes commit `fe22c43adb56f2e43998dad6e279b7364441eaeb`. Record the exact file hashes:

| Input | SHA-256 |
|---|---|
| `microsoft-Phi-4-mini-instruct/QAIRT/README.md` | `d080ed1ebc62724f24e676468fc7639666cd3278ecfd8213a9707691f7b09d82` |
| `microsoft-Phi-4-mini-instruct/QAIRT/config/mixed_precision_config/exceptions.json` | `5200a722d9c1dcd40db8d2d1dc8259d82ffa255cb45cbdcaadf2cc3fe42cae31` |
| `microsoft-Phi-4-mini-instruct/QAIRT/genai_lib/common/debug/profiler.py` | `4c57523080b91e9d77c0d077c244598a8e405a15c0fb97298c598bcaa5e36f29` |
| `microsoft-Phi-4-mini-instruct/QAIRT/genai_lib/llm/model_preparation_utils.py` | `4c43e7b579564307565dbd651d9fa84b1c0741a8e08046c9f4429dd0c254706f` |
| `microsoft-Phi-4-mini-instruct/QAIRT/htp_quantsim_config_v73.json` | `9a1b05bfa4e5c850a795af4499a8dbd31116696b4487eebac7704cdba9fad203` |
| `microsoft-Phi-4-mini-instruct/QAIRT/htp_sc8380xp.json` | `a6aa30ba71da7c2a53e0daaaff6f18de6159822de9dc9efe29ea75dde3037e2b` |
| `microsoft-Phi-4-mini-instruct/QAIRT/llm_utils/forward_pass_wrapper.py` | `815dbe83011d61cdf78737cb88150513a95cc8d06e528d1bebc7348ea46ab3b0` |
| `microsoft-Phi-4-mini-instruct/QAIRT/llm_utils/mixed_precision_overrides.py` | `d5f69caf186980231fa687868668644990e531676d31f5056e269ef35412da14` |
| `microsoft-Phi-4-mini-instruct/QAIRT/llm_utils/qcphi4_adaptation.py` | `6de27c5d76296b89a131617fb63d1a9238288e808c176f8b47290ce0be945578` |
| `microsoft-Phi-4-mini-instruct/QAIRT/llm_utils/test_vectors.py` | `f704159b83a901c6b04f6384671758d769f0c57252d4e4930f6181d2e6de607f` |
| `microsoft-Phi-4-mini-instruct/QAIRT/llm_utils/wikitext_dataloader.py` | `3f0eda75d4a2d2bd7539e20f6c196b79913e0bf9f2801508ad019083487cda60` |
| `microsoft-Phi-4-mini-instruct/QAIRT/phi4_mini_script.py` | `18d2bf9190b8f16eb0bf45656f18f4123514452aea161946e3402987f5a35dce` |
| `microsoft-Phi-4-mini-instruct/QAIRT/requirements.txt` | `d7cc2b49cb3c39e53be1f2fb44e6697a4954d07441a8b1f87a97e1ce840808e6` |
| `microsoft-Phi-4-mini-instruct/QAIRT/utilities/nsptargets.py` | `73f3f646efbe6b217219b7b9cbf5fc109811f76274d3859bf672eabc0f250a1e` |

Also pin and hash Olive commit `f7efd41ab24a2eb07be7edc6d84d0f6304b46598` (as referenced in the recipe README), `qairt-dev==0.8.1`, QAIRT SDK `2.45.40`, Python `3.10.12`, Ubuntu host image digest, every resolved Python wheel, environment variables, all recipe overrides, and any input/calibration data. The recipe says the output folder is `models/phi4-mini-instruct-hamoa`; `no_artifacts=true` is set in the JSON. The conversion log must show the exact command and output inventory. A rerun workaround documented upstream for an occasional Pydantic error must never overwrite the first failed log; preserve the first failure and record any subsequent attempt separately.

Important recipe values to serialize exactly include:

- model repo identifier and `trust_remote_code=true`;
- target `chipset:SC8380XP` (currently blocked by the README contradiction);
- HTP backend, `hvx_threads=8`, `vtcm_size_in_mb=8`, `extended_udma=false`;
- `sequence_lengths=[1,128]`, `native_kv=false`, `multi_graph=true`;
- `QairtEncapsulation` thread count 3, CPU mask `0xe0`, shared-buffer memory, weight sharing enabled, reused I/O limit 100 MB;
- Genie/EOS and RoPE overrides from the exact JSON;
- source script context candidate 4096 and all model-specific transformation settings.

These are conversion options, not a runtime resource guarantee. If any are changed, the output is a new artifact identity and must be requalified.

## Runtime dependency lock

Candidate target set (not yet jointly exercised):

| Wheel filename | SHA-256 | Bytes |
|---|---|---:|
| `coloredlogs-15.0.1-py2.py3-none-any.whl` | `612ee75c546f53e92e70049c9dbfcc18c935a2b9a53b66085ce9ef6a6e5c0934` | 46,018 |
| `flatbuffers-25.12.19-py2.py3-none-any.whl` | `7634f50c427838bb021c2d66a3d1168e9d199b0607e6329399f04846d42e20b4` | 26,661 |
| `humanfriendly-10.0-py2.py3-none-any.whl` | `1697e1a8a8f550fd43c2865cd84542fc175a61dcb779b6fee18cf6b6ccba1477` | 86,794 |
| `mpmath-1.3.0-py3-none-any.whl` | `a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c` | 536,198 |
| `numpy-2.3.3-cp312-cp312-win_arm64.whl` | `ca0309a18d4dfea6fc6262a66d06c26cfe4640c3926ceec90e57791a82b6eee5` | 10,195,936 |
| `onnxruntime-1.30.0-cp312-cp312-win_arm64.whl` | `dc4c706f1935ebb62356e6a095b047859badd854482c40560888e95c328ed262` | 14,175,072 |
| `onnxruntime_genai-0.17.0-cp312-cp312-win_arm64.whl` | `3953c5ec530084b76af91b12d6fea56d9522d9c16d573af0a90d703274976321` | 4,064,122 |
| `onnxruntime_qnn-2.6.0-cp312-cp312-win_arm64.whl` | `c8b9e43d131d2a00c3062aaf9e6e5f13c6028707ee103fb3f13bec1d7395a0bf` | 59,225,752 |
| `packaging-26.3-py3-none-any.whl` | `d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c` | 129,956 |
| `protobuf-7.36.2-py3-none-any.whl` | `bdb3a345d48db958e6ce1f18e508beb0cc981d64f24088427549c866cd039f1e` | 179,806 |
| `sympy-1.14.0-py3-none-any.whl` | `e091cc3e99d2141a0ba2847328f5479b05d94a6635cb96148ccb3f34671bd8f5` | 6,299,353 |

The exact candidate wheel set above was resolved and downloaded for the target tags using:

```bash
python -m pip download --only-binary=:all: \
  --platform win_arm64 --python-version 312 --implementation cp --abi cp312 \
  --dest <wheelhouse> \
  onnxruntime-genai==0.17.0 onnxruntime-qnn==2.6.0 \
  onnxruntime==1.30.0 numpy==2.3.3
```

All 11 wheel SHA-256 values matched the corresponding PyPI JSON file digests. This proves target-tagged artifacts and resolver closure were available on 2026-10-04; it does **not** prove installation or ABI/runtime interaction on Windows ARM64. QNN 2.6 docs state ORT `>=1.24.1` compatibility and show tested ORT 1.27.0 + QAIRT 2.50.40; OGA 0.17 requires ORT `>=1.30.0`. Thus ORT 1.30.0 is metadata-compatible but the combined runtime tuple is not release-certified. The first proposed NumPy pin (`1.26.4`) was not installable for this platform: PyPI had no CPython 3.12 Windows ARM64 wheel, and a platform-constrained `pip download --only-binary` failed. It was corrected to `2.3.3`. Install and physical integration remain required; do not allow future resolution to float versions.

The 11-wheel target wheelhouse totals `94,965,668` compressed bytes. The QNN wheel expands to `160,127,612` bytes across 28 members, including the 89.8 MB `QnnHtpPrepare.dll`. These are observed runtime dependency sizes only; model package, install overhead, temporary files, logs, backups and recovery space are not included. They are not sufficient by themselves to set an admission floor.

The exact registry `Requires-Dist` constraints observed for these packages are: OGA 0.17.0 requires `numpy>=1.21.6` and `onnxruntime>=1.30.0`; QNN 2.6.0 requires `coloredlogs`, `flatbuffers`, `numpy>=1.21.6`, `onnxruntime>=1.24.2`, `packaging`, `protobuf`, and `sympy`; ORT 1.30.0 requires `flatbuffers`, `numpy>=1.21.6`, `packaging`, and `protobuf>=4.25.8`. The wheel metadata's QNN ORT floor (`>=1.24.2`) is stricter than the pinned QNN docs' compatibility sentence (`>=1.24.1`); selected ORT 1.30.0 satisfies both. The pinned QNN source README says Python 3.11.x, while PyPI publishes the selected CPython 3.12 ARM64 wheel. Record this documentation discrepancy and the exact downloaded wheel in the eventual lock evidence.

### Candidate runtime wheel license inventory

This reflects wheel metadata/license files in the resolved 11-wheel candidate set. It is an inventory input, not legal approval.

| Package(s) | Observed license / notice | Redistribution consequence |
|---|---|---|
| `onnxruntime-genai`, `onnxruntime`, `onnxruntime-qnn` | MIT metadata/licenses | Include copyright/license and the QNN wheel's `ThirdPartyNotices.txt`; the QNN wheel also contains the separate Qualcomm AI Stack License below. |
| `numpy` | BSD 3-Clause license text; wheel license file contains additional bundled-component notices, including OpenBLAS/LAPACK and other upstream notices | Preserve the complete NumPy license file and all wheel notices. Do not reduce this to one SPDX label without reviewing the embedded notices. |
| `coloredlogs`, `humanfriendly` | MIT | Include license files. |
| `flatbuffers` | Apache 2.0 | Include license and any applicable notices. |
| `mpmath`, `protobuf` | BSD family; protobuf metadata says 3-Clause BSD | Include exact wheel license files. |
| `packaging` | Apache-2.0 OR BSD-2-Clause | Preserve the package's dual-license notice. |
| `sympy` | BSD | Include exact wheel license file. |
| QNN DLLs/provider assets in `onnxruntime-qnn` | `Qualcomm_LICENSE.pdf` — Qualcomm AI Stack License, in addition to open-source package notices | It allows object-code distribution only when incorporated in an application and states no standalone distribution grant. Covert packaging is blocked pending legal review of the exact installer/runtime delivery design. |

The target-tagged resolver closure is exact for this date, but a release artifact must regenerate a lock from the approved registry snapshot, inspect every wheel's license/notices, compare hashes, and produce an SBOM. A wheel hash does not itself authorize distribution.

The QNN package wheel embeds the QNN EP DLL, `Genie.dll`, QNN backend DLLs and HTP architecture stubs. Record every contained file hash from the selected wheel. Device-installed OEM NPU driver/firmware is outside that wheel and must be measured and recorded independently. Exact minimum OEM driver/firmware package/version is `UNKNOWN` in available primary sources.

The following hashes were computed from the contents of the exact QNN wheel above. They distinguish bundled user-mode provider assets from the separately installed OEM driver/firmware, whose identity remains unknown.

| Wheel member | SHA-256 | Bytes |
|---|---|---:|
| `onnxruntime_qnn/onnxruntime_providers_qnn.dll` | `21da14e009b36eee070e2c84ff00c2b75d5b5af9adc4b8e85271e5c99d561540` | 3,672,784 |
| `onnxruntime_qnn/Genie.dll` | `b985141c7fd69a039c2a0340b480795c22bbd3cd76a2c2ef57fd126003322140` | 9,912,016 |
| `onnxruntime_qnn/QnnHtp.dll` | `2a4406653fd6cf2cbe83d544aa3066776a5d1b99b4cf2d73a446ce841c427e12` | 3,427,536 |
| `onnxruntime_qnn/QnnHtpPrepare.dll` | `89b3db51ff1a72582315e790abc86c1f9fd72aff894a4fb375a66bfed4d8d38b` | 89,803,984 |
| `onnxruntime_qnn/QnnHtpNetRunExtensions.dll` | `ccc9315d8f0e9621d591154ba035698d0bcbb68e3f7d9443102c5a92eacfaa2f` | 946,384 |
| `onnxruntime_qnn/QnnHtpV68Stub.dll` | `2fb50f48b903122b2640c565cb612b7e5b578ec8f94239e71a38087fe8d027c5` | 556,752 |
| `onnxruntime_qnn/QnnHtpV73Stub.dll` | `e29df2cc6833118246917b2d2c749eccdd0674bdb422c24487c1843013b0beab` | 574,160 |
| `onnxruntime_qnn/QnnHtpV81Stub.dll` | `970ab0c026183610964dc376f5eee981338942667c76bff0e5472ac3396b010b` | 573,648 |
| `onnxruntime_qnn/QnnGpu.dll` | `ce35fab18156bd4acf322bf2fd021b4da0fb3e07be1eea84723d155d790632b5` | 7,681,232 |
| `onnxruntime_qnn/QnnIr.dll` | `89bd0b09bf275f2628e13827f3b2ca0baf3811de240cd7b3ce1dc4e209357201` | 1,654,480 |
| `onnxruntime_qnn/QnnSaver.dll` | `d505c94b8ce40bd5e1bae3e674a1e1a43e397bbd6629a855b0e36aa50118006e` | 600,272 |
| `onnxruntime_qnn/QnnSystem.dll` | `0b6daf4691a1ae8cd171911fa2466f3bbac220145bcfc7321b54a6a44fa29aba` | 3,570,896 |
| `onnxruntime_qnn/Qualcomm_LICENSE.pdf` | `ec1dccfdcba5c6e64126e84199b8362bf4999107bfa567ebe831dbb4c461692b` | 147,577 |
| `onnxruntime_qnn/ThirdPartyNotices.txt` | `d039f057d20690116daa1fc65165cd0221ee168208d770062a84c1b4d579abb1` | 69,810 |
| `onnxruntime_qnn/build_and_package_info.py` | `8e5f4dd9df163df0c3a95dea6cd6ea4f2e4cbdf65773481f2d4da47bf9356cc4` | 79 |

## Post-conversion manifest requirements

The eventual manifest must include at least:

```json
{
  "schema": "covert.model-package/v1",
  "package_id": "sha256:<tree digest>",
  "created_at_utc": "<timestamp>",
  "source": {"repo": "microsoft/Phi-4-mini-instruct", "revision": "<immutable SHA>", "tree_sha256": "<digest>"},
  "converter": {"repo": "microsoft/olive-recipes", "revision": "fe22c43adb56f2e43998dad6e279b7364441eaeb", "recipe_sha256": "a6aa30ba71da7c2a53e0daaaff6f18de6159822de9dc9efe29ea75dde3037e2b", "script_sha256": "18d2bf9190b8f16eb0bf45656f18f4123514452aea161946e3402987f5a35dce", "olive_revision": "f7efd41ab24a2eb07be7edc6d84d0f6304b46598", "qairt_dev": "0.8.1", "qairt_sdk": "2.45.40", "host": "<exact OS/image/Python>"},
  "options_sha256": "<canonicalized options JSON digest>",
  "target": {"soc_id": "SC8380XP", "htp_arch": "<measured/validated>", "status": "UNRESOLVED_UNTIL_PRIMARY_MAPPING"},
  "files": [{"path": "<relative path>", "size": 0, "sha256": "<64 hex>"}],
  "runtime_lock_sha256": "<digest>",
  "license_review": {"model": "BLOCKED_UNTIL_PINNED", "qualcomm_runtime_redistribution": "BLOCKED_PENDING_LEGAL_REVIEW"}
}
```

Use canonical JSON serialization for `options_sha256`; define the serialization algorithm and schema revision before implementation. Never use this illustrative `SC8380XP` value as a qualification claim while the upstream target conflict is open.

## Acquisition/verification sequence for a future implementation

1. Resolve model source revision/license and Qualcomm target identity before acquisition.
2. Stage source and converter in a reproducible offline-capable preparation environment; do not place model/provider credentials in shell history or logs.
3. Preserve the first conversion failure, if any. A later success does not erase it.
4. Generate into a fresh output directory; produce file list, hashes, size totals, package-tree digest, and build log.
5. Validate every path/hash, manifest schema, `genai_config.json`, tokenizer consistency, EPContext metadata, and referenced Genie DLC existence. Reject undeclared files.
6. Independently install only the approved runtime-lock on the target from verified wheels; hash plugin/provider assets and capture installed versions.
7. Verify actual selected device/HTP provider and no fallback; run qualification in a disposable child process.
8. Sign/promote the artifact only after all physical-device gates pass. Installation, hash verification, or load success alone remains `DOWNLOADED`/`REGISTERED`, never `QUALIFIED` or `READY`.
