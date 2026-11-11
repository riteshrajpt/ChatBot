$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$path=Join-Path $root '.local\admin-bootstrap.xml'
if(-not(Test-Path $path)){throw 'Bootstrap credentials are unavailable for this Windows user.'}
Write-Host 'Temporary super-admin credentials. Keep them private and change them at first sign-in.'
Import-Clixml -LiteralPath $path | ForEach-Object {
 Write-Host ('Email: '+$_.UserName)
 Write-Host ('Temporary password: '+$_.GetNetworkCredential().Password)
 Write-Host ''
}
