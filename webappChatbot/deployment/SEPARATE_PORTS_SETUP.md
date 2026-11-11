# Frontend port 82 to backend port 81

Use this setup when the frontend and backend are separate IIS websites on the
same Windows server, and there is no `/api` child application beneath the frontend.
Keep the existing backend website, configuration and application pool on port 81.

The original frontend ZIP expected the backend to be an IIS child application
named api under the frontend site. Hosting an independent website on port 81 does
not automatically make its endpoints available on port 82.

This alternate frontend web.config sends these requests through IIS ARR:

| Request to frontend | Request forwarded to backend |
| --- | --- |
| POST :82/api/api/admin/auth/login | POST :81/api/admin/auth/login |
| GET :82/api/api/admin/auth/me | GET :81/api/admin/auth/me |
| :82/api/hubs/chat | :81/hubs/chat |
| :82/api/hubs/admin | :81/hubs/admin |

One leading api segment is removed. The HTTP method, request body, query string
and Authorization header are forwarded. The browser continues using port 82.
No frontend rebuild or change to database/accounts is required.

The backend still needs server-side SQL settings. If WeatherForecast returns 200
but the SQL-backed FAQ endpoint returns 500 directly on port 81, run the standalone
SQL helper in an elevated Windows PowerShell session:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Configure-StandaloneDatabase.ps1 -BackendPort 81 -TrustServerCertificate
```

Enter the existing SQL Server login password when prompted. The helper locates
the actual backend pool, tests the supplied login/database and required tables,
and then sets only its database environment variable. Existing SQL overrides in
backend web.config are removed so they cannot mask that pool value; previous
settings are backed up with the server administrator's DPAPI protection. Mail
settings are preserved. IIS server configuration holds the active password, so
protect its permissions/backups. TrustServerCertificate matches the original
SQL setup, but bypasses certificate identity verification; omit it when SQL has
a trusted certificate with a matching server name. The SQL helper does not create
tables, reset users, send emails or perform an admin login.

## Apply on the RDP server

1. First open http://localhost:81/swagger/index.html to confirm the existing API
   website is running. If it is hosted below another path or port, this configuration
   must be adjusted to that actual API base address before use.
2. Install [Application Request Routing 3.0 x64](https://www.iis.net/downloads/microsoft/application-request-routing).
   URL Rewrite must already be installed. Enable the IIS WebSocket Protocol
   Windows feature for live chat if it is not enabled.
3. In Windows PowerShell as Administrator, enable ARR proxy forwarding and
   use the backend URL's hostname on internal requests (server-level ARR settings):

   ```powershell
   & "$env:windir\System32\inetsrv\appcmd.exe" set config -section:system.webServer/proxy /enabled:true /preserveHostHeader:false /commit:apphost
   ```

4. Back up `C:\inetpub\compileon-ui\web.config` outside the website directory.
   Extract the web.config from frontend-proxy-fix.zip and replace only that file.
   Keep the existing Angular JS/CSS/assets. This applies to the frontend website,
   never the backend folder. Preserve any unrelated custom server rules when merging.
5. Recycle only the frontend application pool, then refresh the admin page.

The proxy target must be `http://localhost:81/{R:1}` for this standalone layout.
Preserving a public frontend Host can produce Invalid Hostname when the internal
backend IIS binding only recognizes localhost. Do not change proxy behavior for
other deployments without reviewing their existing host binding requirements.

If an IIS application named api already exists beneath the frontend website,
inspect its backend physical path and dedicated pool first. That is the original
child-application architecture. Avoid layering this alternate proxy setup over
a separately configured child application.

## Verify without a login attempt

Run on the server in PowerShell:

```powershell
curl.exe -i http://localhost:81/api/admin/auth/me
curl.exe -i http://localhost:82/api/api/admin/auth/me
```

Both should return HTTP 401 for an anonymous request. That confirms the frontend
route reaches the protected API endpoint without testing or locking an account.
Then sign in normally through http://localhost:82/admin.

404 from port 81: check the backend path or deployed build. 404 only on port 82:
check that the proxy rule is first, the replacement web.config is in the actual
frontend site folder, and no api child application intercepts that path.
502 from port 82: check whether port 81 can be reached by IIS, its Host bindings,
and the backend site/application pool. A 500 error about proxy support indicates
ARR is missing or proxy forwarding is not enabled.

Swagger remains available directly at http://localhost:81/swagger/index.html.
For deployment beyond local testing, use HTTPS on the public frontend hostname.

## Rollback

Restore the previous frontend web.config and recycle the frontend pool. If you
also revert the server-level ARR settings, first check whether other sites use
them. This configuration package has not been applied or runtime-tested on the
user's RDP server; its XML and route transformations have been checked locally.
