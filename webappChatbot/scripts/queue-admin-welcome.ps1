$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$connection=New-Object System.Data.SqlClient.SqlConnection((Get-ChatbotConnectionString))
try{
 $connection.Open();$tx=$connection.BeginTransaction()
 try{
  $command=$connection.CreateCommand();$command.Transaction=$tx
  $command.CommandText=@'
INSERT dbo.EmailOutbox(Id,EntityId,DedupeKey,Recipient,Subject,Body)
SELECT NEWID(),a.Id,N'workspace-ready:'+CONVERT(nvarchar(36),a.Id),a.Email,
 N'Compileon support workspace is ready',
 N'Hello '+a.DisplayName+N','+CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10)+
 N'Your super-admin account for Compileon Innovation Private Limited is ready.'+CHAR(13)+CHAR(10)+
 N'You can handle customer queries, join private live conversations, transfer ownership, and respond to project enquiries.'+CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10)+
 N'New agent requests are randomly assigned, preferring online available admins, and notify all three super admins.'+CHAR(13)+CHAR(10)+
 N'Project receipts and responses are copied to the customer and compileon.directors@gmail.com.'+CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10)+
 N'The admin panel is at /admin on the company website. The current build runs on the setup machine; ask the setup owner for access and your temporary credentials. Change the password on first sign-in.'+CHAR(13)+CHAR(10)+CHAR(13)+CHAR(10)+
 N'This message confirms SMTP delivery from the authorized mailbox. It contains no password.'
FROM dbo.SuperAdmins a WHERE a.IsActive=1 AND a.IsAssignable=1
 AND NOT EXISTS(SELECT 1 FROM dbo.EmailOutbox o WHERE o.DedupeKey=N'workspace-ready:'+CONVERT(nvarchar(36),a.Id));
SELECT COUNT(*) FROM dbo.EmailOutbox WHERE DedupeKey LIKE N'workspace-ready:%';
'@
  $count=$command.ExecuteScalar();$tx.Commit();Write-Output ('Super-admin setup notifications queued (deduplicated total): '+$count)
 }catch{try{$tx.Rollback()}catch{};throw}
}finally{$connection.Dispose()}
