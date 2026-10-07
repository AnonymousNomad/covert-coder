$ErrorActionPreference='Stop'
Set-Location 'E:\covert-workstation-integration-saul-20261006'
$taskEvidence='E:\covert-tooling\workstation-continuation-20261007-0145'
& node scripts/contracts.mjs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& node scripts/build-facade-map.mjs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& node scripts/build-c1-02-route-ownership-decisions.mjs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$taskRuns=@(
 @{Label='nightshift-latest-focused';Args=@('--test','--test-concurrency=1','tests/arch/cipher-notebook.test.ts','tests/arch/shared-capability-seat.test.ts','tests/arch/covert-pack.test.ts','tests/arch/resident-policy.test.ts','tests/arch/cipher-laptop-routes.test.ts','tests/arch/cipher-ledger.test.ts','tests/arch/cipher-authority-lineage.test.ts','tests/arch/execution-authority.test.ts','tests/arch/route-authority-coverage.test.ts','tests/arch/agent-execution-integrity.test.ts','tests/arch/agent-task-ownership.test.ts','tests/arch/terminal-session-routes.test.ts','tests/arch/file-routes.test.ts','tests/arch/search-routes.test.ts','tests/arch/workspace-routes.test.ts','tests/arch/helix-wiring-runtime.test.ts','tests/unit/test-cipher-laptop-panel.test.mjs')},
 @{Label='nightshift-latest-node-types';Args=@('--max-old-space-size=1024','node_modules/typescript/bin/tsc','-p','tsconfig.node.json')},
 @{Label='nightshift-latest-browser-types';Args=@('--max-old-space-size=512','node_modules/typescript/bin/tsc','-p','browser/tsconfig.browser.json')},
 @{Label='nightshift-latest-lint';Args=@('node_modules/eslint/bin/eslint.js','common/security/private-platform-state.mjs','node/src/services/workspace.ts','node/src/routes/fs.ts','node/src/services/agent-tools.mjs','common/contracts/cipher-notebook.ts','common/contracts/capability-seat.ts','common/platform/covert-pack.ts','common/platform/resident-policy.ts','node/src/services/cipher-notebook.ts','tests/arch/cipher-notebook.test.ts','tests/arch/shared-capability-seat.test.ts','tests/arch/covert-pack.test.ts','tests/arch/resident-policy.test.ts','common/contracts/cipher-laptop.ts','common/security/operation-policy.mjs','node/src/services/cipher-ledger.ts','node/src/services/cipher-authority-recorder.ts','node/src/services/execution-authority.mjs','node/src/routes/cipher-laptop.ts','node/src/server.ts','node/src/openapi.ts','browser/src/panels/cipher-laptop.ts','browser/src/services/api.ts','browser/src/cockpit/CockpitShell.ts','browser/src/desktop/app-registry.ts','browser/src/store/state.ts','browser/src/shell/shell.ts','tests/arch/cipher-ledger.test.ts','tests/arch/cipher-authority-lineage.test.ts','tests/arch/cipher-laptop-routes.test.ts','tests/unit/test-cipher-laptop-panel.test.mjs','tests/e2e/workstation-cipher-laptop.spec.ts','tests/e2e/workstation-test-server.mjs','playwright.workstation.config.ts','scripts/run-workstation-e2e.mjs')}
 @{Label='nightshift-latest-contract-drift';Args=@('--test','--test-concurrency=1','tests/arch/openapi-drift.test.ts','tests/arch/route-drift.test.ts')}
)
foreach($taskRun in $taskRuns){
 $taskOs=Get-CimInstance Win32_OperatingSystem
 $taskMemory=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
 $taskPhysical=[math]::Round($taskOs.FreePhysicalMemory/1024)
 $taskCommit=[math]::Round(($taskMemory.CommitLimit-$taskMemory.CommittedBytes)/1MB)
 if($taskPhysical -lt 3072 -or $taskCommit -le 5120){throw "Resource gate blocked $($taskRun.Label): physical=$taskPhysical commit=$taskCommit"}
 $taskWatch=[Diagnostics.Stopwatch]::StartNew()
 & node @($taskRun.Args) *> "$taskEvidence\$($taskRun.Label).log"
 $taskExit=$LASTEXITCODE;$taskWatch.Stop()
 [pscustomobject]@{Label=$taskRun.Label;ExitCode=$taskExit;Seconds=$taskWatch.Elapsed.TotalSeconds;PhysicalMiB=$taskPhysical;FreeCommitMiB=$taskCommit;At=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress|Tee-Object -FilePath "$taskEvidence\nightshift-verification-receipts.jsonl" -Append
 Get-Content "$taskEvidence\$($taskRun.Label).log" -Tail 20
 if($taskExit -ne 0){exit $taskExit}
}