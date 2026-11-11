param([ValidateSet('Smtp','Disabled','Pickup')][string]$Mode='Smtp')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$path=Join-Path $root '.local\mail-settings.json'
$settings=Get-Content $path -Raw | ConvertFrom-Json
if($Mode -eq 'Smtp'){
 $probe=Get-Content (Join-Path $root '.local\mail-probe.json') -Raw | ConvertFrom-Json
 if(-not $probe.Authenticated){throw 'SMTP authentication has not been verified. Run scripts/probe-mail.ps1 first.'}
}
$settings.Mode=$Mode
$settings | ConvertTo-Json | Set-Content $path -Encoding UTF8
Write-Output ('Configured mail mode: '+$Mode+'. Restart the API to apply it.')
