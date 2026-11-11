# Compileon deployment to Windows Server / IIS

Prepared 11 November 2026. These are two separate deployable applications on one
HTTPS origin. Assumptions: Windows x64, IIS 10 (Windows Server 2016 or later),
administrator access. No Node.js or .NET SDK is required on the server.

## Files and URLs

| Archive | Extract to (example) | IIS mapping |
| --- | --- | --- |
| frontend.zip | C:\Sites\Compileon\frontend | Root website |
| backend.zip | C:\Sites\Compileon\backend | Child application named api |
| server-setup.zip | C:\Deploy\Compileon-setup | Tools and schema files; keep outside both web roots |

Extract each archive's contents directly into its target folder. Keep the two
application folders separate. The backend ZIP includes the .NET 5.0.17 runtime,
native SQL client dependencies and a generated IIS web.config.

Public routes:
- Website: https://YOUR-DOMAIN/homepage
- Admin: https://YOUR-DOMAIN/admin
- REST example: https://YOUR-DOMAIN/api/api/admin/auth/me
- Customer SignalR: https://YOUR-DOMAIN/api/hubs/chat
- Admin SignalR: https://YOUR-DOMAIN/api/hubs/admin
- Swagger UI: https://YOUR-DOMAIN/api/swagger/index.html
- OpenAPI JSON: https://YOUR-DOMAIN/api/swagger/v1/swagger.json

The doubled `/api/api/` REST path is intentional: IIS alias plus the controller
route. Do not rename the child application. The Angular package uses relative
URLs and needs no domain edit. Hosting the frontend in a subfolder or the backend
on a separate origin requires a different frontend build/configuration.

## 1. Prepare IIS

1. Enable IIS with Static Content, Default Document, WebSocket Protocol,
   Application Initialization and IIS Management Console. Enable Anonymous
   Authentication for the website and API; application login protects admin data.
2. Install [IIS URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite).
3. Install the ASP.NET Core Hosting Bundle (provides AspNetCoreModuleV2). Install
   IIS first; repair the bundle if it was installed before IIS. Restart IIS/WAS
   after installation. The bundled runtime does not replace this IIS module.
   See [Microsoft's IIS hosting instructions](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/?view=aspnetcore-5.0).
4. Extract the files as above. Create a website named Compileon, physical path
   `C:\Sites\Compileon\frontend`, with its own frontend application pool.
5. Add an **application** under that website with alias `api`, physical path
   `C:\Sites\Compileon\backend`, and a new dedicated pool named `CompileonApi`.
   A virtual directory alone is insufficient. Use No Managed Code, 64-bit,
   Integrated pipeline, ApplicationPoolIdentity, one worker process.
6. Grant Read & Execute on the frontend folder to `IIS AppPool\Compileon` (or
   your actual frontend pool) and on the backend folder to
   `IIS AppPool\CompileonApi`. Do not grant broad write access to either web root.
7. Add the domain's HTTPS binding with a valid certificate. Point DNS to the
   server and allow inbound 443. Redirect HTTP to HTTPS at the site/server level
   if port 80 is used. Do not expose Kestrel development ports 4200 or 5000.
8. Enable Preload for the `/api` application (Advanced Settings). The helper
   below sets AlwaysRunning and disables idle timeout for its dedicated pool.

This is a compatibility release: .NET 5 reached end of support on 10 May 2022
([Microsoft](https://dotnet.microsoft.com/en-us/download/dotnet/5.0)). Angular 12
is also a legacy version. Plan framework upgrades before long-term public use;
self-contained publishing preserves the current runtime and its limitations.
This release patches System.Data.SqlClient to 4.8.6 and requires super-admin
authorization for the legacy bot create/update/delete endpoints.

## 2. Configure the backend on the server

Keep `server-setup` outside the website. In **Windows PowerShell as Administrator**:

```powershell
Set-Location C:\Deploy\Compileon-setup
powershell -NoProfile -ExecutionPolicy Bypass -File .\Configure-Backend.ps1 `
  -AppPoolName CompileonApi -PublicSiteUrl https://YOUR-DOMAIN `
  -SqlServer 'tcp:87.76.165.37,1433' -Database DbChatBoxTest `
  -SqlUsername sa -EnableMail -TrustServerCertificate
```

Replace YOUR-DOMAIN. Enter the existing SQL password and authorized Office 365
mailbox SMTP password when prompted. Sender defaults to HolostikBi@holostik.com
with smtp.office365.com:587 STARTTLS. Omit `-EnableMail` to keep delivery disabled
while validating; rerun with it to enable delivery. Enabling mail processes real
pending database outbox entries, so do not create fake customer requests.

The current SQL setup uses TrustServerCertificate. That switch keeps encryption
but skips certificate identity validation. Prefer a trusted SQL certificate and
matching server name, then omit the switch. Permit this server's outbound access
to SQL TCP 1433 and SMTP TCP 587, and restrict SQL inbound firewall access to
authorized application hosts. A dedicated SQL login with application-only
permissions is preferable to sa; pass its name with `-SqlUsername` if provisioned.

The helper stores app-pool-specific environment settings in IIS's administrator
configuration and recycles only the backend pool. IIS configuration contains
plaintext secrets: protect its ACLs and backups and restrict server admin access.
No passwords are written to the application folders or ZIPs. ASP.NET Core reads
these environment variables over the password-free appsettings.json. Local
DPAPI credential files are machine/user-bound and must not be copied to the RDP.

## 3. Database and cutover

Use the existing DbChatBoxTest database: customer records and the three admin
accounts/passwords stay there. Do not reset passwords or rerun seed/provisioning
scripts. No database backup or customer data is included in these archives.
The optional schema files in server-setup/database are for a deliberately chosen
new database: run 001, 003, 004 in that order, review scripts first; 002 contains
optional starter content. Schema alone does not provision admin accounts.

Run one active API instance/application pool worker. Agent presence is in memory;
multiple instances require a shared SignalR/presence design. At cutover stop the
local development backend and any other copies using the same database. Clients
reconnect after an API restart. The DB outbox preserves queued email across restarts.

## 4. Verify

1. Open `/homepage`, refresh `/admin`, and check CSS/images load.
2. GET `/api/WeatherForecast` should return JSON. GET `/api/api/admin/auth/me`
   without a token should return **401**, not the Angular HTML page.
3. Open browser Network: POST `/api/hubs/chat/negotiate?negotiateVersion=1`
   should return 200 with transport details. The chat connection should upgrade
   to WebSocket (101) when available. Admin hub requires a signed-in admin.
4. Sign in at `/admin` using an existing account. Change a temporary password
   if prompted. From another browser, submit a real inquiry and request an agent;
   verify assignment, two-way messages, saved inquiry and notification emails.
   Check Email delivery in admin; Sent means SMTP accepted the message, while
   final inbox delivery may still depend on spam filtering/provider policies.
5. Swagger is available in Production at `/api/swagger/index.html`; its OpenAPI
   document uses a relative URL compatible with the IIS `/api` child application.
   If hosting the backend directly at port 81, browse
   `http://localhost:81/swagger/index.html` instead. The backend root `/` has no
   page. Detailed developer exception pages remain restricted to Development.
   Swagger's Try it out buttons execute real API requests against the configured
   database and can trigger normal email notifications.

For 500.19, check URL Rewrite installation, config locking and application
configuration inheritance. For 500.30/500.31, check Hosting Bundle, x64 app pool
and Windows Application event log. For SQL errors verify credentials/firewall/TLS.
For chat check `/api` application mapping, WebSocket feature, HTTPS, and configured
origin. Avoid publishing detailed server exceptions or password-bearing logs.

## Updates and rollback

Back up the current application folders, database and protected IIS configuration.
Stop only CompileonApi while replacing backend files (or use app_offline.htm),
then start it and verify. Replace the complete frontend bundle so index.html and
hashed assets match. Keep environment settings outside the application directories.
Rollback by restoring both prior application packages and compatible configuration;
do not restore a database backup blindly over new customer records.

## Rebuild locally

From the original frontend checkout:
`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-server.ps1`

Add `-BackendOnly` to rebuild only the backend and server setup archives; reuse
the previously published frontend ZIP when its source has not changed.

The script creates a new timestamped folder under releases, with the three ZIPs,
expanded application folders and SHA256SUMS.txt. It builds from source-only backend
staging and sanitized configuration. It does not deploy, mutate the database,
send emails, reset accounts or stop existing development servers.
