$ErrorActionPreference='Stop'
$repo='E:\covert-workstation-integration-saul-20261006'
$stage='C:\Users\Grey_\AppData\Local\Temp\covert-workstation-runtime-20261007-1732'
$expected='7b9be38614aab669cba5aaeee8320ad4a5501a10'
Set-Location $repo
$env:TEMP=$stage;$env:TMP=$stage
$env:NODE_OPTIONS='--max-old-space-size=1024'
$env:AIDE_PLAYWRIGHT_CHANNEL='msedge'
function Assert-Source {
 $head=git rev-parse HEAD; if($LASTEXITCODE -ne 0 -or $head -ne $expected){throw 'SOURCE_HEAD_CHANGED'}
 $dirty=@(git status --porcelain); if($LASTEXITCODE -ne 0 -or (($dirty -join "`n") -ne " M browser/src/desktop/layout.ts`n M browser/src/panels/terminal.ts`n M browser/src/services/ws.ts`n M tests/e2e/workstation-dual-terminals.spec.ts`n M tests/e2e/workstation-real-mutation.spec.ts`n M tests/unit/test-terminal-panel-isolation.test.mjs`n?? tests/unit/test-event-subscription-readiness.mjs")){throw 'SOURCE_DIRTY_CHANGED'}
 $fingerprints=@{'browser/src/desktop/layout.ts'='E4192315F1204B05157D1F6037F2D2839D75BA90F2038E50D9F0551ED98BFE7F';'browser/src/panels/terminal.ts'='1B0316F43272843DE06C2D5B130C607056FCB389623331F59A1AB21BF033EFEC';'browser/src/services/ws.ts'='63A6D979E871637CC09A16225862876E7CDA9B2016E8BB5AFB188BAD8A6C8D9F';'tests/e2e/workstation-dual-terminals.spec.ts'='A251C9686AC39E781F64D24D69A19BFC6DEEA3E5748A4DFB304376B38BDD42D8';'tests/e2e/workstation-real-mutation.spec.ts'='D3D34432CC7B735A51BB5C957A69E7AF61DAFB1A300D9A72F84F987112632F2D';'tests/unit/test-terminal-panel-isolation.test.mjs'='31FCD50CB4A83E44CC5C2A33796B5FF5293423BC9A5E37A4CABE3FAF0D6A8555';'tests/unit/test-event-subscription-readiness.mjs'='5223664091B0D9339D0E0DC1A0F9046D789F9109845AF03CDA9CF2A4E80C272F'}
 foreach($path in $fingerprints.Keys){if((Get-FileHash $path -Algorithm SHA256).Hash -ne $fingerprints[$path]){throw "SOURCE_FINGERPRINT_CHANGED_$path"}}
}
function Wait-Gate([string]$phase) {
 $deadline=(Get-Date).AddMinutes(20)
 do {
  Assert-Source
  $os=Get-CimInstance Win32_OperatingSystem
  $mem=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
  $physical=[math]::Floor($os.FreePhysicalMemory/1024)
  $freeCommit=[math]::Floor(($mem.CommitLimit-$mem.CommittedBytes)/1MB)
  $sample=[pscustomobject]@{utc=(Get-Date).ToUniversalTime().ToString('o');phase=$phase;physicalMiB=$physical;freeCommitMiB=$freeCommit;open=($physical -ge 3072 -and $freeCommit -gt 5120);head=$expected}
  $sample | ConvertTo-Json -Compress | Add-Content -Encoding UTF8 "$stage\resource-gate.jsonl"
  if($sample.open){Write-Output ("GATE_OPEN "+($sample|ConvertTo-Json -Compress));return}
  if((Get-Date) -ge $deadline){throw "RESOURCE_WINDOW_NOT_AVAILABLE_$phase"}
  Start-Sleep -Seconds 10
 }while($true)
}
function Step([string]$name,[string[]]$nodeArgs) {
 Wait-Gate $name
 Write-Output "START $name"
 $process=Start-Process -FilePath (Get-Command node).Source -ArgumentList $nodeArgs -NoNewWindow -PassThru -Wait -RedirectStandardOutput "$stage\$name.stdout.log" -RedirectStandardError "$stage\$name.stderr.log"
 $result=$process.ExitCode
 Get-Content "$stage\$name.stdout.log","$stage\$name.stderr.log" | Set-Content -Encoding UTF8 "$stage\$name.log"
 [pscustomobject]@{utc=(Get-Date).ToUniversalTime().ToString('o');phase=$name;exit=$result;head=$expected}|ConvertTo-Json -Compress|Add-Content -Encoding UTF8 "$stage\results.jsonl"
 Write-Output "EXIT $name $result"
 if($result -ne 0){Get-Content "$stage\$name.log" -Tail 60;throw "FAILED_$name"}
}
try {
 Remove-Item Env:\WSL_UTF8 -ErrorAction SilentlyContinue
 Step 'closure-2310-node-types' @('node_modules/typescript/bin/tsc','-p','tsconfig.node.json','--noEmit')
 Step 'closure-2310-browser-types' @('node_modules/typescript/bin/tsc','-p','browser/tsconfig.browser.json')
 Step 'closure-2310-production-build' @('node_modules/vite/bin/vite.js','build','--config','browser/vite.config.ts')
 Step 'closure-2310-workstation-journey' @('scripts/run-workstation-e2e.mjs','--max-failures=1','--output',"$stage\closure-2310-workstation-results")
 Write-Output 'SERIAL_RUNTIME_PIPELINE_COMPLETE'
}catch{Write-Output $_.Exception.Message;exit 1}