$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if((Test-Path (Join-Path $root '.local\mail-credential.xml')) -and (Test-Path (Join-Path $root '.local\mail-settings.json'))){Write-Output 'Encrypted SMTP configuration already exists. Use configure-mail.ps1 to change it.';exit 0}
$source=Get-Content (Join-Path (Split-Path $root -Parent) 'APIchatbot\CommonMethods.cs') -Raw
$credentials=[regex]::Match($source,'NetworkCredential\("([^"]+)",\s*"([^"]+)"\)')
$hostMatch=[regex]::Match($source,'smtp\.Host\s*=\s*"([^"]+)"')
$portMatch=[regex]::Match($source,'smtp\.Port\s*=\s*(\d+)')
if(-not $credentials.Success -or -not $hostMatch.Success -or -not $portMatch.Success){throw 'Expected SMTP configuration was not found.'}
if($credentials.Groups[1].Value -ne 'HolostikBi@holostik.com'){throw 'The configured mailbox differs from the sender authorized by the user.'}
$credential=New-Object System.Management.Automation.PSCredential($credentials.Groups[1].Value,(ConvertTo-SecureString $credentials.Groups[2].Value -AsPlainText -Force))
$credential | Export-Clixml -LiteralPath (Join-Path $root '.local\mail-credential.xml')
@{Host=$hostMatch.Groups[1].Value;Port=[int]$portMatch.Groups[1].Value;Username=$credential.UserName;FromAddress=$credential.UserName;FromName='Compileon Innovation';EnableSsl=$true;Mode='Disabled';PublicSiteUrl='http://127.0.0.1:4200'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root '.local\mail-settings.json') -Encoding UTF8
Write-Output 'Authorized SMTP credentials encrypted locally. Delivery remains paused until verification is complete.'
