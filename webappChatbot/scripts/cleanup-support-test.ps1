$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$path=Join-Path $root '.local\support-test-state.json'
$state=Get-Content $path -Raw | ConvertFrom-Json
if($state.marker -notmatch '^__COMPILEON_SUPPORT_TEST__:[a-f0-9]{16}$' -or $state.testEmail -notmatch '^support-test-[a-f0-9]{16}@example.invalid$'){throw 'Invalid test ownership record.'}
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$connection=New-Object System.Data.SqlClient.SqlConnection((Get-ChatbotConnectionString))
try{
 $connection.Open();$tx=$connection.BeginTransaction()
 try{
  foreach($session in $state.sessions){
   $sha=[Security.Cryptography.SHA256]::Create();try{$hash=$sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($session.token))}finally{$sha.Dispose()}
   $cmd=$connection.CreateCommand();$cmd.Transaction=$tx
   $cmd.CommandText=@'
DECLARE @conversation int;
SELECT @conversation=ConversationId FROM dbo.WebsiteChatSessions WHERE SessionId=@id AND TokenHash=@hash;
IF @conversation IS NOT NULL
BEGIN
 IF EXISTS(SELECT 1 FROM dbo.SupportTickets WHERE SessionId=@id AND CustomerName<>@marker) THROW 50001,'Ticket marker mismatch.',1;
 DELETE FROM dbo.EmailOutbox WHERE EntityId IN(SELECT Id FROM dbo.SupportTickets WHERE SessionId=@id AND CustomerName=@marker);
 DELETE FROM dbo.SupportMessages WHERE TicketId IN(SELECT Id FROM dbo.SupportTickets WHERE SessionId=@id AND CustomerName=@marker);
 DELETE FROM dbo.SupportTickets WHERE SessionId=@id AND CustomerName=@marker;
 DELETE FROM dbo.WebsiteChatMessages WHERE SessionId=@id;
 DELETE FROM dbo.botconversations WHERE CONVERSATIONID=@conversation;
 DELETE FROM dbo.BotConversationMain WHERE CONVERSATIONID=@conversation;
 DELETE FROM dbo.WebsiteChatSessions WHERE SessionId=@id AND TokenHash=@hash;
END;
'@
   [void]$cmd.Parameters.AddWithValue('@id',[guid]$session.sessionId);[void]$cmd.Parameters.AddWithValue('@marker',$state.marker)
   $p=$cmd.Parameters.Add('@hash',[System.Data.SqlDbType]::Binary,32);$p.Value=$hash
   [void]$cmd.ExecuteNonQuery()
  }
  $cmd=$connection.CreateCommand();$cmd.Transaction=$tx
  $cmd.CommandText=@'
IF EXISTS(SELECT 1 FROM dbo.WebsiteInquiries WHERE Id=@inquiryId AND FullName=@marker)
BEGIN
 DELETE FROM dbo.EmailOutbox WHERE EntityId=@inquiryId;
 DELETE FROM dbo.InquiryResponses WHERE InquiryId=@inquiryId;
 DELETE FROM dbo.WebsiteInquiries WHERE Id=@inquiryId AND FullName=@marker;
END;
IF EXISTS(SELECT 1 FROM dbo.SuperAdmins WHERE Id=@adminId AND Email=@email AND DisplayName=@marker AND IsAssignable=0)
BEGIN
 DELETE FROM dbo.AdminSessions WHERE AdminId=@adminId;
 DELETE FROM dbo.SuperAdmins WHERE Id=@adminId AND Email=@email AND DisplayName=@marker AND IsAssignable=0;
END;
'@
  [void]$cmd.Parameters.AddWithValue('@inquiryId',[guid]$state.inquiryId);[void]$cmd.Parameters.AddWithValue('@adminId',[guid]$state.testAdminId)
  [void]$cmd.Parameters.AddWithValue('@email',$state.testEmail);[void]$cmd.Parameters.AddWithValue('@marker',$state.marker)
  [void]$cmd.ExecuteNonQuery();$tx.Commit()
 }catch{try{$tx.Rollback()}catch{};throw}
}finally{$connection.Dispose()}
Remove-Item -LiteralPath $path,(Join-Path $root '.local\support-test-admin.xml')
Write-Output 'Removed only the owned synthetic support sessions, enquiries, queued test emails and test admin.'
