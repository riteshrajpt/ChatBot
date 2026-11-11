$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$connection=New-Object System.Data.SqlClient.SqlConnection((Get-ChatbotConnectionString))
try{
 $connection.Open();$command=$connection.CreateCommand()
 $command.CommandText=@'
SELECT Recipient,[Status],Attempts,LastError FROM dbo.EmailOutbox WHERE DedupeKey LIKE N'workspace-ready:%' ORDER BY Recipient;
SELECT COUNT(*) AS ActiveSuperAdmins FROM dbo.SuperAdmins WHERE IsActive=1 AND IsAssignable=1;
SELECT COUNT(*) AS RemainingSyntheticAdmins FROM dbo.SuperAdmins WHERE Email LIKE N'support-test-%@example.invalid' AND IsAssignable=0;
'@
 $adapter=New-Object System.Data.SqlClient.SqlDataAdapter($command);$data=New-Object System.Data.DataSet
 [void]$adapter.Fill($data)
 foreach($table in $data.Tables){$table | Format-Table -AutoSize | Out-String | Write-Output}
}finally{$connection.Dispose()}
