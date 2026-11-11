# Compileon website and real-time chat

Implemented in the existing Angular 12 / ASP.NET Core 5 projects. This is the local
website implementation; no public hosting or DNS changes were made.

The admin/live-agent/email extension is complete. See [ADMIN_SUPPORT_SETUP.md](ADMIN_SUPPORT_SETUP.md)
for the protected `/admin` panel, the three issued accounts, agent assignment and mail setup.

## Local website

- Website: <http://127.0.0.1:4200/homepage>
- Existing conversation reports: <http://127.0.0.1:4200/chat-bot-rpt>
- API Swagger: <http://127.0.0.1:5000/swagger/index.html>
- SignalR hub: `http://127.0.0.1:5000/hubs/chat`

The website has custom Compileon branding, a responsive illustrated hero, interactive
service and solution tabs, a process/story section, an FAQ accordion, a working enquiry
form and a private chat panel. It supports keyboard navigation and reduced-motion
preferences. Manrope is stored locally with its OFL license; no font/icon CDN is needed.
Solution previews are explicitly illustrative, with no invented customers, testimonials,
business statistics, address, phone number or email address.

The service areas were confirmed by the user: software development, AI automation,
cloud engineering and connected applications. Public contact details have not been
provided; the project enquiry form is the contact route.

## Start/restart

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-api.ps1 -Background
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-ui.ps1 -Background
```

Use `-Build` on the API launcher after changing backend source. Stop an existing
instance before starting another on the same port. Owned process IDs are saved in
`.local/api-background.json` and `.local/ui-background.json`; logs use the corresponding
`api.stdout.log`, `api.stderr.log`, `ui.stdout.log` and `ui.stderr.log` names.
The existing encrypted SQL credential/launcher configuration is retained.

## SignalR configuration

Angular's `RealtimeChatService` uses `@microsoft/signalr` 5.0.17 and the `chatHubUrl`
property in `src/environments/environment.ts` / `environment.prod.ts`.

- Development uses the direct local API URL. The legacy Angular 12 development
  WebSocket proxy reset connections during testing, so it is not used for this hub.
- Production uses `/api/hubs/chat` on the same origin, with IIS hosting the backend
  as the `/api` child application. See `deployment/DEPLOYMENT.md` for server packages.
- The existing `/api/api/*` development REST proxy is unchanged.
- `../APIchatbot/Startup.cs` registers `CompileonChatHub` at `/hubs/chat` and its
  repository with DI. SignalR is supplied by the ASP.NET Core shared framework.
- CORS origins are configured through `Cors:AllowedOrigins`. Local development
  defaults to `http://127.0.0.1:4200` and `http://localhost:4200`; the server helper
  sets the public HTTPS origin for both hub and REST policies.
- Incoming hub messages are limited to 16 KB. Detailed hub errors are disabled.
- Connection state is visible in chat. Automatic reconnect uses delays of 0, 2, 5
  and 10 seconds; the visitor can reconnect manually after retries are exhausted.

## Privacy, sessions and persistence

The guided FAQ assistant uses SQL-backed company answers and intent routing. Customers
can now request a real super-admin agent, with private messages, persisted history and
availability indicators. It makes no price or response-time promises.

`OpenSession` creates a random session ID and 256-bit token. Only a SHA-256 token hash
is stored on the server. The client keeps session credentials in this browser tab's
sessionStorage. `GetHistory` requires both; replies are sent with `Clients.Caller`,
never broadcast to other visitors. Starting a new chat does not delete the old report.

Each request has a stable UUID. Retrying a chat message returns the stored result
instead of inserting a duplicate. The new tables are:

| Table | Purpose |
| --- | --- |
| WebsiteChatSessions | Session/token hash and legacy report conversation ID |
| WebsiteChatMessages | Message UUID, user text, reply and timestamp |
| WebsiteInquiries | Project brief, contact details, consent timestamp and review status |

New chat messages also populate `BotConversationMain` / `botconversations`, so the
existing reports continue to show them. The migration creates missing tables and
adds five Compileon service FAQs without replacing any existing conversations/data.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-db.ps1
```

`SubmitInquiry` validates name, email, brief length and consent on the server, then
saves the enquiry. Success displays its reference only after the database operation.
It now queues receipts to the customer and directors. Admin-written responses are also
saved and queued to both. The protected admin panel reviews enquiries and tracks real
mail-delivery status; public endpoints do not expose the contact details.

## Validation

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-realtime.ps1
```

The real SDK/WebSocket integration checks two clients, company FAQ suggestions,
caller-only replies, repeated questions, duplicate-message idempotency, token-protected
history, history after a new connection, invalid requests, enquiry validation and
idempotent enquiry submission. Synthetic records are tagged; the wrapper removes
only its matching test sessions/messages/enquiry. Existing user conversations remain.

Angular's Karma tests also cover the company content, service keyboard controls,
invalid/valid/failed enquiry states, duplicate reply rendering and responsive layout.
Run the browser suite with the environment preparation in README.md:

```powershell
npm.cmd test -- --watch=false --browsers=ChromeHeadless --progress=false
npm.cmd run build
```

Desktop preview automation was unavailable (browser host unavailable and native app
approval timed out). Browser DOM/layout tests and HTTP/SDK integration checks were used;
the final appearance still benefits from the user's visual review in the live site.

The legacy runtime/dependency warnings documented in PROJECT_ANALYSIS.md remain.
The new admin APIs/hub and legacy report data now require authenticated super-admin
access. Public deployment still needs HTTPS/public-origin configuration and a review
of the remaining legacy stack findings in PROJECT_ANALYSIS.md.

References: [Microsoft SignalR JavaScript client](https://learn.microsoft.com/aspnet/core/signalr/javascript-client)
and [SignalR hubs](https://learn.microsoft.com/aspnet/core/signalr/hubs).
