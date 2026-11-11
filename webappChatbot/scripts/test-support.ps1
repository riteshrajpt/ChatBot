$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
if(Test-Path .local\support-test-state.json){& powershell -NoProfile -ExecutionPolicy Bypass -File scripts\cleanup-support-test.ps1;if($LASTEXITCODE -ne 0){throw 'Prior test cleanup failed.'}}
& powershell -NoProfile -ExecutionPolicy Bypass -File scripts\prepare-support-test.ps1
if($LASTEXITCODE -ne 0){throw 'Test preparation failed.'}
$credential=Import-Clixml .local\support-test-admin.xml
$env:COMPILEON_TEST_ADMIN_EMAIL=$credential.UserName
$env:COMPILEON_TEST_ADMIN_PASSWORD=$credential.GetNetworkCredential().Password
$code=0
try{& .\.tools\node-v14.21.3-win-x64\node.exe scripts\test-support.cjs;$code=$LASTEXITCODE}
finally{
 Remove-Item Env:\COMPILEON_TEST_ADMIN_EMAIL,Env:\COMPILEON_TEST_ADMIN_PASSWORD -ErrorAction SilentlyContinue
 & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\cleanup-support-test.ps1
 if($LASTEXITCODE -ne 0){$code=1}
}
exit $code
