# Compileon Innovation — local website setup

Angular 12.1 company website for Compileon Innovation Private Limited, with SignalR
chat, SQL-backed project enquiries and the existing conversation reports.
Its companion ASP.NET Core backend is `../APIchatbot/AChatBotApi.csproj`.

See [SIGNALR_SETUP.md](SIGNALR_SETUP.md) for the website features, hub configuration,
new database migration, integration tests and production reverse-proxy requirements.
See [ADMIN_SUPPORT_SETUP.md](ADMIN_SUPPORT_SETUP.md) for super-admin credentials,
live agent handling, email notifications and enquiry responses.

For separate Windows/IIS frontend and backend ZIPs, run
`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-server.ps1`.
See [DEPLOYMENT.md](deployment/DEPLOYMENT.md) for the `/api` child application setup,
server configuration and deployment checks.

## Setup status — 10 November 2026

- UI: <http://127.0.0.1:4200/> (redirects to `/homepage`).
- Reports: <http://127.0.0.1:4200/chat-bot-rpt>.
- Admin panel: <http://127.0.0.1:4200/admin>. Reports now require admin sign-in.
- API Swagger: <http://127.0.0.1:5000/swagger/index.html>.
- Local Node 14.21.3, npm 7.24.2 and ASP.NET Core 5.0.17 installed under `.tools/`.
- Production UI/API builds and 17 browser component/layout tests pass.
- Three super-admin accounts, private live-agent support and SMTP notifications are enabled.
- Database setup is complete on `tcp:87.76.165.37,1433`, database `DbChatBoxTest`.
  Legacy chat tables plus the SignalR session/message and project enquiry tables are ready.
  Five Compileon FAQs use the confirmed service areas; existing conversations are preserved.

See [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) for the full review and verification limits.

## Start

Open two PowerShell terminals in this folder; run one command in each:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-api.ps1
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-ui.ps1
```

For a hidden background frontend, add `-Background` to that command. Its process ID
is saved in `.local/ui-background.json`; logs are `.local/ui.stdout.log` and
`.local/ui.stderr.log`.

Both services bind to loopback only. Stop with Ctrl+C in their respective terminals.
The execution-policy flag applies only to that PowerShell process. No global Node
installation or Angular CLI is required.

The API runs from a copy in `.local/api/source`; the original companion backend is
not modified by restore/build. After editing backend code or its configuration, rebuild
the copy and restart:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-api.ps1 -Build
```

Building requires an installed .NET SDK on PATH. The local .NET 5 installation is a
runtime, not an SDK. The installed .NET 10 SDK successfully built this net5.0 project.

## Database

The companion API's `appsettings.json` now contains the server/database and TLS settings
without a password. `run-api.ps1` reads `.local/database-settings.json`, decrypts
`.local/database-credential.xml` with Windows user protection, and supplies the
`ConnectionStrings__Dbconnection` environment variable to the API process. The encrypted
credential works only for the same Windows user on this computer. Use the launcher;
for Visual Studio or another launcher, supply this environment variable through your
normal secrets configuration. Do not commit or share the local credential files.

Required objects include `Botlist`, `Botknowledge`, `Qlist`, `BotConversationMain`,
`botconversations`, and `usp_GetQueAnsList`. The API expects bot ID 3 and onboarding
question codes starting at 101. The database now contains bot ID 3, four prompts
(101-104), and three clearly labeled technical starter FAQs. Business knowledge still
needs to replace the starter content. `CommonMethods` now honors environment variables
as well as JSON, so its stored-procedure path shares the application's connection.

Schema and seed scripts are in `database/001-schema.sql` and
`database/002-starter-data.sql`. They create missing objects/rows without overwriting
existing data. Rerun setup with the encrypted local credentials:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-db.ps1 -SeedStarterData
```

With the API running, check database integration:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-db-integration.ps1
```

This checks metadata/FAQ access, onboarding, history and ticket updates. It creates a
uniquely tagged synthetic conversation and removes only that conversation afterward.
All checks and cleanup passed on 10 November 2026. Existing application-logic findings
in PROJECT_ANALYSIS.md remain separate from database setup.

To run the API as a hidden background process:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-api.ps1 -Background
```

Its PID is recorded in `.local/api-background.json`; output is in `.local/api.stdout.log`
and `.local/api.stderr.log`. Stop that instance before starting another on port 5000:

```powershell
$apiState = Get-Content .local\api-background.json -Raw | ConvertFrom-Json
$apiProcess = Get-Process -Id $apiState.ProcessId -ErrorAction Stop
if ($apiProcess.Path -ne $apiState.Runtime) { throw 'Recorded API process no longer matches.' }
Stop-Process -Id $apiProcess.Id
```

## Restore, build and test

Prepare a shell for direct commands:

```powershell
$env:PATH = (Join-Path $PWD '.tools\node-v14.21.3-win-x64') + ';' + $env:PATH
$env:NG_CLI_ANALYTICS = 'false'
$env:NO_UPDATE_NOTIFIER = '1'
$env:npm_config_cache = Join-Path $PWD '.tools\npm-cache'
New-Item -ItemType Directory -Path .local\temp -Force | Out-Null
$env:TEMP = Join-Path $PWD '.local\temp'
$env:TMP = $env:TEMP
```

Use local npm 7 to preserve the version-2 lockfile:

```powershell
node .tools\npm7\node_modules\npm\bin\npm-cli.js ci --no-audit --no-fund
npm.cmd run build
$env:CHROME_BIN = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd test -- --watch=false --browsers=ChromeHeadless --progress=false
```

Production output: `dist/ChatBotUi/`. Font optimization fetches Google Fonts and needs
internet access. Bundle/style budgets and external stylesheet/selector warnings remain;
they do not fail the build. Headless Chrome requires normal desktop process access;
the restricted execution sandbox blocked its subprocesses.

The six tests are smoke tests with mocked HTTP, not database integration tests.
The entirely commented-out `qlist` and archived `chat-bot-rpt-old` components are
excluded from both test compilation and test discovery.

## Development proxy and deployment

`proxy.conf.json` maps `/api/api/*` to `http://127.0.0.1:5000/api/*` in the development
serve configuration only. Change its target if the API port changes. A production host
must provide the same reverse proxy plus SPA fallback to `index.html` for both routes.
A static build does not start the API or include the development proxy.

This snapshot has no Git metadata, CI or configured e2e runner. Database setup and
API/database smoke-test scripts were added during local setup.
The legacy runtimes reproduce the existing app; modernization is a separate task.

## Local tools

Node was downloaded from `nodejs.org/dist/v14.21.3/` and verified against the official
SHA-256 manifest. ASP.NET Core 5.0.17 was downloaded using Microsoft's .NET 5 release
metadata and verified with SHA-512. npm 7.24.2 was installed under `.tools/npm7`.
`.tools/` and `.local/` are ignored artifacts; retain them to reuse this setup.
The API staging folder includes a local copy of its settings.
