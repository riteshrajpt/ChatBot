$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$connection=New-Object System.Data.SqlClient.SqlConnection((Get-ChatbotConnectionString))
$accounts=@(
 @{Email='rsinghfsd@gmail.com';Name='Super admin 1'},
 @{Email='compileon.directors@gmail.com';Name='Super admin 2'},
 @{Email='r.sritesh799@gmail.com';Name='Super admin 3'}
)
$credentialFile=Join-Path $root '.local\admin-bootstrap.xml'
$credentials=@()
if(Test-Path $credentialFile){$credentials=@(Import-Clixml -LiteralPath $credentialFile)}
try{
 $connection.Open()
 foreach($account in $accounts){
  $command=$connection.CreateCommand();$command.CommandText='SELECT COUNT(*) FROM dbo.SuperAdmins WHERE Email=@email;'
  [void]$command.Parameters.AddWithValue('@email',$account.Email)
  if([int]$command.ExecuteScalar() -eq 0){
   $random=[System.Security.Cryptography.RandomNumberGenerator]::Create()
   $salt=New-Object byte[] 16;$passwordBytes=New-Object byte[] 24
   try{$random.GetBytes($salt);$random.GetBytes($passwordBytes)}finally{$random.Dispose()}
   $password=[Convert]::ToBase64String($passwordBytes)
   $derive=New-Object System.Security.Cryptography.Rfc2898DeriveBytes($password,$salt,600000,[System.Security.Cryptography.HashAlgorithmName]::SHA256)
   try{$hash=$derive.GetBytes(32)}finally{$derive.Dispose()}
   $command=$connection.CreateCommand()
   $command.CommandText='INSERT dbo.SuperAdmins(Id,Email,DisplayName,PasswordHash,PasswordSalt,PasswordIterations,MustChangePassword) VALUES(NEWID(),@email,@name,@hash,@salt,600000,1);'
   [void]$command.Parameters.AddWithValue('@email',$account.Email);[void]$command.Parameters.AddWithValue('@name',$account.Name)
   $parameter=$command.Parameters.Add('@hash',[System.Data.SqlDbType]::Binary,32);$parameter.Value=$hash
   $parameter=$command.Parameters.Add('@salt',[System.Data.SqlDbType]::Binary,16);$parameter.Value=$salt
   [void]$command.ExecuteNonQuery()
   $credentials+=New-Object System.Management.Automation.PSCredential($account.Email,(ConvertTo-SecureString $password -AsPlainText -Force))
   Write-Output ('Created protected super-admin account: '+$account.Email)
  }else{Write-Output ('Preserved existing super-admin account: '+$account.Email)}
 }
 if($credentials.Count){$credentials | Export-Clixml -LiteralPath $credentialFile}
 Write-Output 'Initial passwords are encrypted locally. Use scripts/show-admin-bootstrap.ps1 in your own terminal to retrieve them; change each on first login.'
}finally{$connection.Dispose()}
