$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$statePath = Join-Path $root '.local\signalr-test-state.json'
if (-not (Test-Path $statePath)) { throw 'No SignalR test ownership record exists.' }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ($state.marker -notmatch '^__COMPILEON_SIGNALR_TEST__:[a-f0-9]{16}$') { throw 'Invalid test marker.' }
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$connection = New-Object System.Data.SqlClient.SqlConnection((Get-ChatbotConnectionString))
try {
    $connection.Open()
    $transaction = $connection.BeginTransaction()
    try {
        $command = $connection.CreateCommand()
        $command.Transaction = $transaction
        $command.CommandText = 'SELECT COUNT(*) FROM dbo.WebsiteInquiries WHERE Id=@id AND FullName=@marker;'
        [void]$command.Parameters.AddWithValue('@id', [guid]$state.inquiryId)
        [void]$command.Parameters.AddWithValue('@marker', $state.marker)
        $inquiries = [int]$command.ExecuteScalar()
        if ($inquiries -gt 1) { throw 'Unexpected enquiry test row count.' }
        $command.CommandText = 'IF EXISTS(SELECT 1 FROM dbo.WebsiteInquiries WHERE Id=@id AND FullName=@marker) BEGIN DELETE FROM dbo.EmailOutbox WHERE EntityId=@id; DELETE FROM dbo.WebsiteInquiries WHERE Id=@id AND FullName=@marker; END;'
        [void]$command.ExecuteNonQuery()
        foreach ($session in $state.sessions) {
            $hasher = [System.Security.Cryptography.SHA256]::Create()
            try { $hash = $hasher.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($session.token)) } finally { $hasher.Dispose() }
            $command = $connection.CreateCommand()
            $command.Transaction = $transaction
            $command.CommandText = @'
DECLARE @conversationId int;
SELECT @conversationId=ConversationId FROM dbo.WebsiteChatSessions WHERE SessionId=@id AND TokenHash=@hash;
IF @conversationId IS NOT NULL
BEGIN
    IF EXISTS(SELECT 1 FROM dbo.WebsiteChatMessages WHERE SessionId=@id)
       AND NOT EXISTS(SELECT 1 FROM dbo.WebsiteChatMessages WHERE SessionId=@id AND LEFT(UserText,LEN(@marker))=@marker)
        THROW 50001, 'Test marker missing; refusing cleanup.', 1;
    DELETE FROM dbo.WebsiteChatMessages WHERE SessionId=@id;
    DELETE FROM dbo.botconversations WHERE CONVERSATIONID=@conversationId;
    DELETE FROM dbo.BotConversationMain WHERE CONVERSATIONID=@conversationId;
    DELETE FROM dbo.WebsiteChatSessions WHERE SessionId=@id AND TokenHash=@hash;
END;
'@
            [void]$command.Parameters.AddWithValue('@id', [guid]$session.sessionId)
            $parameter = $command.Parameters.Add('@hash', [System.Data.SqlDbType]::Binary, 32); $parameter.Value = $hash
            [void]$command.Parameters.AddWithValue('@marker', $state.marker)
            [void]$command.ExecuteNonQuery()
        }
        $transaction.Commit()
        Write-Output ('Removed only this run''s synthetic chat sessions and enquiry. Verified matching enquiry rows: '+$inquiries)
    } catch { try { $transaction.Rollback() } catch { }; throw }
} finally { $connection.Dispose() }
Remove-Item -LiteralPath $statePath

