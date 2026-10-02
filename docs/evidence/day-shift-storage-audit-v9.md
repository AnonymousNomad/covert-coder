# Day-shift storage and durable-audit investigation — v9

**Status: historical timeout OPEN / root cause UNKNOWN.** This capture did not reproduce the 29.995-second timeout and does not close it.

## Capture identity

- Repository: `AnonymousNomad/covert-coder`
- Branch: `nightshift/production-convergence-20260926`
- Exact source SHA under test: `cb44e41e7bfda676c5c7ac5b4032aa83eade6adf`
- Windows run: unchanged full `npm test`, started `2026-10-02T21:48:09.220Z`, ended `2026-10-02T21:52:13.120Z`, exit code `0`.
- Concurrent WPR DiskIO/FileIO capture: start/stop exit code `0`; 4,311,026 events processed, zero lost, 225 seconds.
- Passive app observer: test result records free physical RAM at 7,113 MiB before the run and a 6,520 MiB in-run sample; the latter is below the 6,656 MiB local-model start floor. No local model was started. Initial free commit was 15,803 MiB. Initial free space was 9.19 GiB on C: and 119.59 GiB on E:.
- Raw ETL, converted CSV, test log, and app trace remain local because they contain host, path, or process metadata. This report contains no raw path, PID, process name, or command line.

## Application-level reproduction

The unchanged full test run passed. Its passive observer recorded 234 completed calls for each generic `*.aide/cipher-state.jsonl` open, write, sync, and close stage. That suffix also matches fixture journals, so these totals are not the count for the canonical product journal. The maximum observed generic stage durations were open 1.258 ms, write 1.810 ms, sync 1,126.721 ms, and close 0.813 ms. No open crossed the observer's 1-second pending threshold.

In the captured test, `/api/plugins/presets` completed 1/1 with HTTP 200, artifacts completed 2/2 with HTTP 200, and Authority prepare completed 27/27 with HTTP 200. The historic v5 `GET /api/plugins/presets` 502 at 29.995 seconds did not recur. The v5 source SHA was not captured and remains UNKNOWN; its red remains open.

## Canonical journal to physical-disk join

WPR recorded 48 canonical journal create/open events in one Covert server process. A canonical `FileIo_Name`/rundown record identified one FileObject for that journal; no other file-name path was observed for that FileObject during this capture. The same FileObject joined to DiskIo TypeGroup1 completion records yielded 50 writes (221,184 bytes) and 16 reads (81,920 bytes). Maximum response was 4.6057 ms for a write and 128.0002 ms for a read. There were 48 matching FileIo flush, cleanup, and close records, and all 48 journal flushes matched an app-observed sync interval in that same process.

The pointer join follows Microsoft's documented `FileIo_Name.FileObject` to `DiskIo_TypeGroup1.FileObject` mapping. DiskIo's issuing-thread field was joined through Thread_V2 process/thread records. See [FileIo_Name](https://learn.microsoft.com/en-us/windows/win32/etw/fileio-name), [DiskIo_TypeGroup1](https://learn.microsoft.com/en-us/windows/win32/etw/diskio-typegroup1), and [Thread_V2_TypeGroup1](https://learn.microsoft.com/en-us/windows/win32/etw/thread-v2-typegroup1).

Four canonical app sync intervals exceeded 100 ms. Direct physical completions for the exact journal FileObject inside each interval were:

| App sync duration | Journal disk completions in interval | Longest journal completion |
|---:|---|---:|
| 576.110 ms | 1 write | 3.6292 ms |
| 147.881 ms | 1 read, 1 write | read 128.0002 ms; write 0.6429 ms |
| 1,060.791 ms | 1 write | 0.8608 ms |
| 1,126.721 ms | 1 write | 1.2393 ms |

Thus the 128 ms journal read accounts for most of one 148 ms sync interval. The other three long app sync intervals do not contain a comparably long physical completion for the journal FileObject.

## Device-wide events and limits

- The longest observed Disk 0 read/write response was 1,300.1876 ms at `2026-10-02T21:49:33.199Z`. It was outside all four slow canonical sync intervals, its issuer joined to an other-user-process class, and its file path remains unclassified because the observed name history changes across the event.
- A 1,007.2033 ms Disk 0 write completed at `2026-10-02T21:51:48.081Z`, 4 ms after the longest canonical sync ended at `2026-10-02T21:51:48.077Z`. Its issuer joined to the System class; its path was not established. It is not evidence that this write blocked that completed sync.
- Across the four slow intervals, the only Disk 0 read/write completion at or above 100 ms was the 128 ms canonical journal read in the 147.881 ms interval.
- The filtered System event-log query returned no matching disk/storage-provider warning or error events during the capture window. This is not a device-health verdict.

These observations do not establish a causal E: device fault, a Windows storage fault, or a Covert defect. In particular, the original v5 second audit-path open remained pending through its client timeout, while this passing run did not reproduce that open stall. The historical failure remains OPEN / CAUSE_UNKNOWN.

## Artifact hashes

SHA-256 values for local evidence artifacts:

| Artifact | SHA-256 |
|---|---|
| v9 WPR ETL | `7C0CE787E8096A9F4F369136385D48BA3AE053FE3B5F1E0BC18E214983DF5374` |
| v9 converted WPR CSV (local only) | `CFD2B4EB7303640E33B931259C39023109A0AE63A3552C11842715754E4927E8` |
| v9 full-test log | `8671803328F7CA37EF06DAB807435BCB53F1A3BE287FB487A7936817525C099D` |
| v9 passive app trace (local only) | `3E97F851EAB839694FD27E5AA2E64C39B431EE4DB5435A6F1B14AAB0BBE46467` |
| v9 capture result JSON | `D10B72F772970D29F0D38C4B799EC5F61EAB4ED1F1DD9D03625D9CA98E6A2782` |
| v9 WPR summary | `C9815A357B12448B24C372D62460106266B2192364BB4B1103FE71B86528F8E7` |
| passive tracer script | `AB90A8D1520097AE490E5701D1D3755096235DBFBD4938579BBD3AE819082517` |

## Change and checkpoint state

- No product source, durable-audit semantics, admission floor, pagefile, or power policy was changed. No process was terminated. No model runtime was started.
- The pre-existing desktop battery 9/9 evidence append is preserved. The untracked `design-lab/` remains preserved and untouched.
- This is an evidence-only checkpoint. Exact-SHA CI for the resulting documentation commit is pending until push; the full `npm test` result above is tied to the source SHA listed at the top.
- Next: continue a focused, unchanged reproduction around the historical presets timeout with the same passive application-stage and FileIO/DiskIO observers. Preserve UNKNOWN unless a time-bounded event join establishes cause.
