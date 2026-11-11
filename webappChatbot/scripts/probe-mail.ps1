$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$settings=Get-Content (Join-Path $root '.local\mail-settings.json') -Raw | ConvertFrom-Json
$credential=Import-Clixml -LiteralPath (Join-Path $root '.local\mail-credential.xml')
$client=New-Object System.Net.Sockets.TcpClient
function Read-SmtpResponse($reader){
 $last=''
 do{$line=$reader.ReadLine();if($null -eq $line){throw 'SMTP server closed the connection.'};$last=$line}while($line.Length -gt 3 -and $line[3] -eq '-')
 return $last
}
function New-SmtpWriter($stream){
 $writer=New-Object System.IO.StreamWriter($stream,[System.Text.Encoding]::ASCII,1024,$true)
 $writer.NewLine="`r`n";$writer.AutoFlush=$true
 return $writer
}
try{
 $pending=$client.ConnectAsync($settings.Host,[int]$settings.Port)
 if(-not $pending.Wait(10000)){throw 'SMTP connection timed out.'}
 $stream=$client.GetStream();$stream.ReadTimeout=10000;$stream.WriteTimeout=10000
 $reader=New-Object System.IO.StreamReader($stream,[System.Text.Encoding]::ASCII,$false,1024,$true)
 $writer=New-SmtpWriter $stream
 $null=Read-SmtpResponse $reader
 $writer.WriteLine('EHLO compileon.local');$null=Read-SmtpResponse $reader
 $writer.WriteLine('STARTTLS');$response=Read-SmtpResponse $reader
 if(-not $response.StartsWith('220')){throw ('STARTTLS rejected: '+$response)}
 $reader.Dispose();$writer.Dispose()
 $tls=New-Object System.Net.Security.SslStream($stream,$false)
 $tls.ReadTimeout=10000;$tls.WriteTimeout=10000
 $tls.AuthenticateAsClient($settings.Host)
 $reader=New-Object System.IO.StreamReader($tls,[System.Text.Encoding]::ASCII,$false,1024,$true)
 $writer=New-SmtpWriter $tls
 $writer.WriteLine('EHLO compileon.local');$null=Read-SmtpResponse $reader
 $writer.WriteLine('AUTH LOGIN');$response=Read-SmtpResponse $reader
 if($response.StartsWith('334')){
  $writer.WriteLine([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($credential.UserName)))
  $response=Read-SmtpResponse $reader
  if($response.StartsWith('334')){
   $writer.WriteLine([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($credential.GetNetworkCredential().Password)))
   $response=Read-SmtpResponse $reader
  }
 }
 if($response.StartsWith('235')){
  @{Authenticated=$true;CheckedAt=[DateTimeOffset]::UtcNow.ToString('o');Detail='SMTP authentication succeeded.'} | ConvertTo-Json | Set-Content (Join-Path $root '.local\mail-probe.json') -Encoding UTF8
  Write-Output 'SMTP TLS connection and authentication succeeded. No email was sent by this probe.'
 }else{
  @{Authenticated=$false;CheckedAt=[DateTimeOffset]::UtcNow.ToString('o');Detail=$response} | ConvertTo-Json | Set-Content (Join-Path $root '.local\mail-probe.json') -Encoding UTF8
  Write-Output ('SMTP authentication was rejected: '+$response)
 }
 $writer.WriteLine('QUIT')
}catch{
 @{Authenticated=$false;CheckedAt=[DateTimeOffset]::UtcNow.ToString('o');Detail=$_.Exception.Message} | ConvertTo-Json | Set-Content (Join-Path $root '.local\mail-probe.json') -Encoding UTF8
 Write-Output ('SMTP verification failed: '+$_.Exception.Message)
}finally{$client.Dispose()}
