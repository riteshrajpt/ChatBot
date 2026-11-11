$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$settings=Get-Content (Join-Path $root '.local\mail-settings.json') -Raw | ConvertFrom-Json
if($settings.Mode -ne 'Disabled'){throw 'Pause outbound SMTP before running synthetic support tests.'}
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$suffix=[guid]::NewGuid().ToString('N').Substring(0,16)
$marker='__COMPILEON_SUPPORT_TEST__:'+$suffix
$email='support-test-'+$suffix+'@example.invalid'
$id=[guid]::NewGuid()
$random=[Security.Cryptography.RandomNumberGenerator]::Create();$salt=New-Object byte[] 16;$bytes=New-Object byte[] 24
try{$random.GetBytes($salt);$random.GetBytes($bytes)}finally{$random.Dispose()}
$password=[Convert]::ToBase64String($bytes)
$derive=New-Object Security.Cryptography.Rfc2898DeriveBytes($password,$salt,600000,[Security.Cryptography.HashAlgorithmName]::SHA256)
try{$hash=$derive.GetBytes(32)}finally{$derive.Dispose()}
$connection=New-Object System.Data.SqlClient.SqlConnection((Get-ChatbotConnectionString))
try{
 $connection.Open();$command=$connection.CreateCommand()
 $command.CommandText='INSERT dbo.SuperAdmins(Id,Email,DisplayName,PasswordHash,PasswordSalt,PasswordIterations,MustChangePassword,IsAssignable) VALUES(@id,@email,@name,@hash,@salt,600000,1,0);'
 [void]$command.Parameters.AddWithValue('@id',$id);[void]$command.Parameters.AddWithValue('@email',$email);[void]$command.Parameters.AddWithValue('@name',$marker)
 $p=$command.Parameters.Add('@hash',[System.Data.SqlDbType]::Binary,32);$p.Value=$hash
 $p=$command.Parameters.Add('@salt',[System.Data.SqlDbType]::Binary,16);$p.Value=$salt
 [void]$command.ExecuteNonQuery()
}finally{$connection.Dispose()}
$credential=New-Object System.Management.Automation.PSCredential($email,(ConvertTo-SecureString $password -AsPlainText -Force))
$credential | Export-Clixml -LiteralPath (Join-Path $root '.local\support-test-admin.xml')
@{marker=$marker;testAdminId=$id.ToString();testEmail=$email;sessions=@();inquiryId=[guid]::NewGuid().ToString()} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root '.local\support-test-state.json') -Encoding UTF8
Write-Output 'Created a synthetic, non-assignable test admin. Real admin passwords and routing eligibility are unchanged.'
