param([string]$ApiRoot = 'http://127.0.0.1:5000/api')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$connection = New-Object System.Data.SqlClient.SqlConnection((Get-ChatbotConnectionString))
$connection.Open()
$conversationId = Get-Random -Minimum 1000000000 -Maximum 2000000000
$marker = '__DB_SETUP_SMOKE__:' + [guid]::NewGuid().ToString('N')
try {
    $check = $connection.CreateCommand()
    $check.CommandText = 'SELECT COUNT(*) FROM dbo.BotConversationMain WHERE CONVERSATIONID=@id;'
    [void]$check.Parameters.AddWithValue('@id', $conversationId)
    if ([int]$check.ExecuteScalar() -ne 0) { throw 'Test ID collision; retry with a new ID.' }

    $bot = Invoke-RestMethod -Uri ($ApiRoot + '/ChatBot') -TimeoutSec 15
    if (-not ($bot | Where-Object { $_.id -eq 3 })) { throw 'Expected bot ID 3.' }
    $faqs = Invoke-RestMethod -Uri ($ApiRoot + '/Botknowledge/Qulist') -TimeoutSec 15
    if (@($faqs).Count -lt 1) { throw 'FAQ menu is empty.' }
    $faqQuestion = [uri]::EscapeDataString($faqs[0].qlist)
    $answer = Invoke-RestMethod -Uri ($ApiRoot + '/Botknowledge/queAnsList?Qlist=' + $faqQuestion) -TimeoutSec 15
    if (-not $answer[0].botresponse) { throw 'Stored-procedure FAQ returned no response.' }
    Write-Output 'PASS: bot metadata, FAQ menu and stored-procedure answer.'

    $steps = @(
        @{ State = '101'; Text = $marker; Expected = '102' },
        @{ State = '102'; Text = 'db-setup@example.com'; Expected = '103' },
        @{ State = '103'; Text = '0000000000'; Expected = '104' }
    )
    foreach ($step in $steps) {
        $body = @{ userQuery = $step.State; txtQuery = $step.Text; CONVERSATIONID = $conversationId } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri ($ApiRoot + '/Botknowledge/GetQuestion') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 15
        if (-not $response.botresponse -or [string]$response.question -ne $step.Expected) {
            throw ('Onboarding response/state failed at ' + $step.State)
        }
    }
    Write-Output 'PASS: onboarding transitions 101 -> 102 -> 103 -> 104.'

    $details = Invoke-RestMethod -Uri ($ApiRoot + '/Botknowledge/GetChatReport?CONVERSATIONID=' + $conversationId) -TimeoutSec 15
    if (@($details).Count -ne $steps.Count) { throw 'Conversation history row count mismatch.' }
    $reports = Invoke-RestMethod -Uri ($ApiRoot + '/Botknowledge/GetChatConversationID') -TimeoutSec 15
    $ticket = $reports | Where-Object { [string]$_.conversationid -eq [string]$conversationId }
    if ($ticket.status -ne 'Ticket is Open') { throw 'Expected new open ticket.' }
    Write-Output 'PASS: conversation history and open ticket persisted.'

    foreach ($status in @('Ticket is Closed', 'Ticket is Open')) {
        $body = @{ CONVERSATIONID = [string]$conversationId; status = $status } | ConvertTo-Json
        $null = Invoke-RestMethod -Uri ($ApiRoot + '/Botknowledge/UpdateChatTickets') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 15
        $reports = Invoke-RestMethod -Uri ($ApiRoot + '/Botknowledge/GetChatConversationID') -TimeoutSec 15
        $ticket = $reports | Where-Object { [string]$_.conversationid -eq [string]$conversationId }
        if ($ticket.status -ne $status) { throw 'Ticket status did not persist.' }
    }
    Write-Output 'PASS: ticket close and reopen persisted.'
} finally {
    # Delete only this invocation's synthetic conversation, identified by its exact
    # random ID AND the unique marker posted as the first user message.
    $cleanup = $connection.CreateCommand()
    $cleanup.CommandText = @'
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS (SELECT 1 FROM dbo.botconversations WHERE CONVERSATIONID=@id AND USERQUERY=N'101' AND txtQuery=@marker)
BEGIN
    DELETE FROM dbo.botconversations WHERE CONVERSATIONID=@id;
    DELETE FROM dbo.BotConversationMain WHERE CONVERSATIONID=@id;
END;
COMMIT;
SELECT (SELECT COUNT(*) FROM dbo.botconversations WHERE CONVERSATIONID=@id)
     + (SELECT COUNT(*) FROM dbo.BotConversationMain WHERE CONVERSATIONID=@id);
'@
    [void]$cleanup.Parameters.AddWithValue('@id', $conversationId)
    [void]$cleanup.Parameters.AddWithValue('@marker', $marker)
    try {
        if ([int]$cleanup.ExecuteScalar() -ne 0) { throw 'Synthetic conversation cleanup needs attention.' }
        Write-Output 'PASS: synthetic conversation cleaned up.'
    } finally { $connection.Dispose() }
}
