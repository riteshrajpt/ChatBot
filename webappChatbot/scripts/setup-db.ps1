param(
    [string]$Database = 'DbChatBoxTest',
    [switch]$SeedStarterData
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$settingsPath = Join-Path $projectRoot '.local\database-settings.json'
if ($Database -notmatch '^[A-Za-z][A-Za-z0-9_]{0,127}$') { throw 'Invalid database name.' }
if (-not (Test-Path $settingsPath)) { throw 'Missing ignored local database connection settings.' }
. (Join-Path $PSScriptRoot 'database-connection.ps1')
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder((Get-ChatbotConnectionString -Database $Database))
$builder['Initial Catalog'] = 'master'
$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
try {
    $connection.Open()
    $command = $connection.CreateCommand()
    $command.CommandTimeout = 60
    $command.CommandText = 'SELECT DB_ID(@databaseName);'
    [void]$command.Parameters.AddWithValue('@databaseName', $Database)
    $databaseId = $command.ExecuteScalar()
    if ($databaseId -is [DBNull] -or $null -eq $databaseId) {
        $command.Parameters.Clear()
        $command.CommandText = 'CREATE DATABASE [' + $Database + '];'
        [void]$command.ExecuteNonQuery()
        Write-Output ('Created database: ' + $Database)
    } else {
        Write-Output ('Using existing database: ' + $Database)
    }
} finally { $connection.Dispose() }

$builder['Initial Catalog'] = $Database
$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
try {
    $connection.Open()
    $transaction = $connection.BeginTransaction()
    try {
        $scripts = @('001-schema.sql')
        if ($SeedStarterData) { $scripts += '002-starter-data.sql' }
        $scripts += '003-compileon-realtime.sql'
        $scripts += '004-admin-support.sql'
        foreach ($script in $scripts) {
            $sql = Get-Content -LiteralPath (Join-Path $projectRoot ('database\' + $script)) -Raw
            foreach ($batch in [regex]::Split($sql, '(?im)^\s*GO\s*(?:--[^\r\n]*)?$')) {
                if ([string]::IsNullOrWhiteSpace($batch)) { continue }
                $command = $connection.CreateCommand()
                $command.Transaction = $transaction
                $command.CommandTimeout = 60
                $command.CommandText = $batch
                [void]$command.ExecuteNonQuery()
            }
            Write-Output ('Applied: ' + $script)
        }
        $transaction.Commit()
    } catch {
        try { $transaction.Rollback() } catch { }
        throw
    }
    $command = $connection.CreateCommand()
    $command.CommandText = "SELECT 'Botlist' AS ObjectName, COUNT_BIG(*) AS [RowCount] FROM dbo.Botlist UNION ALL SELECT 'Botknowledge', COUNT_BIG(*) FROM dbo.Botknowledge UNION ALL SELECT 'Qlist', COUNT_BIG(*) FROM dbo.Qlist UNION ALL SELECT 'BotConversationMain', COUNT_BIG(*) FROM dbo.BotConversationMain UNION ALL SELECT 'botconversations', COUNT_BIG(*) FROM dbo.botconversations;"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
    $table = New-Object System.Data.DataTable
    [void]$adapter.Fill($table)
    $table | Format-Table -AutoSize | Out-String | Write-Output
} finally { $connection.Dispose() }
