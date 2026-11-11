function Get-ChatbotConnectionString {
    param([string]$Database = 'DbChatBoxTest')
    $root = Split-Path $PSScriptRoot -Parent
    $settingsPath = Join-Path $root '.local\database-settings.json'
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder($settings.ConnectionString)
    $builder['Initial Catalog'] = $Database
    $credential = Import-Clixml -LiteralPath (Join-Path $root $settings.CredentialFile)
    $builder['User ID'] = $credential.UserName
    $builder['Password'] = $credential.GetNetworkCredential().Password
    return $builder.ConnectionString
}
