$ErrorActionPreference='Stop'
Set-Location 'E:\covert-workstation-integration-saul-20261006'
$env:NODE_OPTIONS='--max-old-space-size=384';$env:TEMP='C:\Users\Grey_\AppData\Local\Temp\covert-ui-closure-20261007-1625';$env:TMP='C:\Users\Grey_\AppData\Local\Temp\covert-ui-closure-20261007-1625'
node --experimental-strip-types --test --test-concurrency=1 tests/unit/test-cipher-laptop-panel.test.mjs tests/unit/test-desktop-launcher-view.test.mjs tests/unit/test-desktop-theme-voice.test.mjs tests/unit/test-desktop-window-manager.test.mjs tests/unit/test-terminal-panel-isolation.test.mjs tests/unit/test-terminal-replay-boundary.test.mjs tests/unit/test-terminal-view-bindings.test.mjs tests/unit/test-connections-window-recovery.test.mjs tests/unit/test-resource-monitor-recovery.test.mjs *> 'C:\Users\Grey_\AppData\Local\Temp\covert-ui-closure-20261007-1625\closure-regression.log'
Write-Output "TEST_EXIT $LASTEXITCODE";Get-Content 'C:\Users\Grey_\AppData\Local\Temp\covert-ui-closure-20261007-1625\closure-regression.log' -Tail 14
if($LASTEXITCODE -ne 0){exit 1}
node node_modules/eslint/bin/eslint.js browser/src/cockpit/SystemTelemetry.ts browser/src/desktop/window-manager-view.ts browser/src/workstation/WorkstationShell.ts browser/src/services/api.ts browser/src/panels/cipher-laptop.ts *> 'C:\Users\Grey_\AppData\Local\Temp\covert-ui-closure-20261007-1625\closure-lint.log'
Write-Output "LINT_EXIT $LASTEXITCODE";Get-Content 'C:\Users\Grey_\AppData\Local\Temp\covert-ui-closure-20261007-1625\closure-lint.log' -Tail 40
if($LASTEXITCODE -ne 0){exit 1}
git diff --check;Write-Output "DIFF_EXIT $LASTEXITCODE"