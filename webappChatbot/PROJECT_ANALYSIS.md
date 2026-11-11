# Project analysis and verification

Reviewed on 10 November 2026. The user confirmed `../APIchatbot` is the backend.
This is an extracted source snapshot with no `.git` directory.

## Admin and human-support update — 10 November 2026

The requested three super-admin accounts, protected admin inbox, random live-query
assignment, private customer/agent messaging, enquiry responses and durable SMTP queue
are now implemented. The original legacy report endpoints also require super-admin
authentication. Passwords use salted PBKDF2-SHA256, first-login changes, session expiry/
revocation and lockout. SMTP credentials were removed from active source and protected
locally; the user confirmed the existing Office 365 sender is authorized. Three setup
notifications were accepted by SMTP, one for each requested admin.

Seventeen browser tests and the full support SDK/WebSocket integration pass. Synthetic
test records and test admins were removed. Expertise, possibilities, approach and about
content were expanded with concrete capabilities, use cases, deliverables and engagement
models. ADMIN_SUPPORT_SETUP.md is the current operation/verification reference. Earlier
findings below describe the historical versions and should be read with these updates.

## Compileon website and SignalR update — 10 November 2026

The original company landing/chat screen has been replaced with the Compileon
Innovation Private Limited website. The user confirmed software development, AI
automation, cloud engineering and connected applications as the company service focus.
The responsive site includes interactive expertise/solution sections, a working project
enquiry form, locally hosted typography and a custom private SignalR chat panel.

The .NET backend now contains CompileonChatHub and CompileonWebsiteRepository. Five
company FAQs and three website chat/enquiry tables were added without replacing
existing data. Real SDK/WebSocket tests passed for private replies, repeated questions,
idempotent retries, session ownership, history after a new connection and enquiry
validation/persistence. Synthetic test records were removed. Twelve browser tests cover
company content, keyboard tabs, form states, duplicate replies and 360/390/768/1280px
layouts. The original REST endpoints/reports remain available.

Development connects directly to the local hub because the legacy Angular WebSocket
proxy reset connections in testing. Production uses the same-origin /hubs/chat path.
See SIGNALR_SETUP.md for complete configuration, test and deployment notes. Desktop
visual inspection could not be completed because browser/app automation was unavailable.
Earlier source-review findings below describe the original legacy chat and report code;
the new website chat uses a separate validated SignalR path. Legacy framework and
original report/API access-control concerns remain relevant before public deployment.

## Database setup update — 10 November 2026

The original database connectivity blocker below has been resolved using the SQL
Server supplied by the user: `tcp:87.76.165.37,1433`, database `DbChatBoxTest`.
The server had no chatbot database. A fresh schema was reconstructed from the API
models/queries: five tables and `dbo.usp_GetQueAnsList`. It contains one bot (ID 3),
four onboarding prompts (101-104), and three clearly labeled technical starter FAQs.
No original business knowledge or conversation history was restored.

`../APIchatbot/appsettings.json` now contains password-free server/database/TLS settings.
`CommonMethods.GetConnectionString()` was updated to honor environment variables, so
the FAQ procedure path uses the same connection as ASP.NET configuration. The supplied
password is stored with Windows user protection in an ignored local credential file
and passed only in the launched API process environment. Use the documented launcher;
direct Visual Studio/DLL startup also needs the connection environment variable.

Database connection, idempotent schema/seed rerun, bot metadata, FAQ menu, stored-procedure
answers, onboarding 101 -> 104, history persistence and ticket close/reopen all passed.
The uniquely tagged synthetic conversation was removed, leaving zero conversation rows
after verification. The API was rebuilt and started in a hidden background process.
Scripts and restart details are in README.md. Source-level application/security findings
below remain, except for the database-connectivity and split-configuration issues fixed
in this update. The initial review results below describe the pre-database-setup state.

## Architecture

| Layer | Implementation | Role |
| --- | --- | --- |
| Frontend | Angular/CLI 12.1.4, TypeScript 4.3.x, RxJS 6.6.x | SPA, forms and HTTP |
| UI libraries | Bootstrap 4.6, jQuery, Popper, PrimeNG toast, Font Awesome CDN | Layout, modals, carousel, alerts |
| Chat | `src/app/chat-box/` | Marketing page, chat modal, onboarding, FAQ menu |
| Reports | `src/app/chat-bot-rpt/` | Search, history modal, ticket changes, XLSX export |
| Integration | `src/app/Shared/chatbot.service.ts` | Same-origin `/api/api/` requests |
| Backend | `../APIchatbot`, ASP.NET Core 5, Dapper, SqlClient | Controllers, SQL access, Swagger |
| Database | Remote SQL Server database `DbChatBoxTest` | Bot metadata, predefined answers, conversations and tickets |

This is a sequential, database-driven FAQ chatbot. No LLM provider or model
configuration is present. Onboarding begins at question 101 and collects name,
email and phone. The API advances the question code and returns a predefined
response. FAQ answers use a stored procedure. Conversation IDs are client-generated
random integers. The UI pairs sent/received messages by array index.

`/` redirects to `/homepage`; `/chat-bot-rpt` hosts reports. `qlist` is entirely
commented out, `chat-bot-rpt-old` is an archived copy, and neither is declared in
AppModule. `src/app/chat.service.ts` is empty. Several bundled vendor files and
packages appear unused; removing them requires a separate usage review.

## UI/API contract

The development proxy strips one `/api` prefix when forwarding to port 5000.

| Suffix after `/api/api/` | Method | Purpose |
| --- | --- | --- |
| `ChatBot` | GET | Bot metadata/greeting |
| `Botknowledge` | GET | Knowledge rows |
| `Botknowledge/GetQuestion` | POST | Save input and return next response/state |
| `Botknowledge/Qulist` | GET | FAQ menu |
| `Botknowledge/queAnsList?Qlist=...` | GET | FAQ answer through stored procedure |
| `Botknowledge/GetChatConversationID` | GET | Conversation/ticket summary |
| `Botknowledge/GetChatReport?CONVERSATIONID=...` | GET | Chat detail |
| `Botknowledge/UpdateChatTickets` | POST | Ticket update |
| `BotConversations/SentMsg` | POST | Legacy conversation insert |

The service also contains an apparently unused general POST to `Botknowledge`,
which the supplied controller does not implement.

## Setup changes

1. Installed checksum-verified Node 14.21.3 and ASP.NET Core 5.0.17 locally, plus
   npm 7.24.2 to preserve the existing version-2 lockfile.
2. Installed dependencies. Declared the existing locked jQuery 3.6.0 and Popper
   1.16.1 versions directly because angular.json requires their scripts. They were
   previously peer-only lock entries and were not installed by npm 6.
3. Added the development-only API proxy and removed a nonexistent stylesheet link.
4. Repaired active test fixtures with module/providers and mocked initialization
   HTTP, and replaced the obsolete root title-rendering assertion with a router-outlet check.
5. Excluded the unimplemented/archived components consistently from test compilation
   and discovery. No active application tests were disabled.
6. Added launch scripts, local-artifact ignore rules and setup documentation.
   Backend restore/build uses `.local/api/source`; original backend files were not edited.

## Verification

| Check | Result | Limits |
| --- | --- | --- |
| Angular development compile | PASS | Serving on loopback port 4200 |
| Angular production build | PASS | Output in `dist/ChatBotUi`, warnings remain |
| Karma/Jasmine active tests | PASS: 6/6 | Smoke tests with mocked HTTP |
| Companion API build | PASS | Original net5.0 target; nine warnings |
| `/`, `/homepage`, `/chat-bot-rpt` | HTTP 200 | HTML Accept header; verifies delivery/SPA fallback, not visual appearance |
| Chat avatar asset | HTTP 200 | Local image delivery |
| API Swagger document | HTTP 200 | API startup/endpoint discovery |
| Proxied GET to POST-only GetQuestion | HTTP 405, expected | Confirms rewrite/routing without database writes |
| Configured database connection | FAIL | Network/instance connection error outside sandbox too |
| Live bot metadata request | FAIL/timeout | Needs database connectivity |
| Visual browser inspection | NOT COMPLETED | Computer-use stopped because the browser URL could not be determined confidently |

Production initial assets total approximately 1.02 MB against a 500 kB warning
budget. Chat-box CSS is 11.26 kB against a 2 kB warning budget. Angular also warns
about external CDN stylesheets and one Bootstrap selector. Font inlining requires
internet access. Both source builds succeeded after setup; full database integration
was not verified and no live conversation/ticket data was intentionally written.

## Blocker: database availability

The remote SQL Server is unreachable. Swagger is independent of the database, but
chat/FAQ/report features require it. No chatbot backup, migrations, seeds or stored
procedure scripts are included. Required objects found in the code are `Botlist`,
`Botknowledge`, `Qlist`, `BotConversationMain`, `botconversations`, and
`usp_GetQueAnsList`. Bot metadata expects ID 3; onboarding expects codes from 101.
Empty replacement tables will not reproduce the original behavior.

`CommonMethods` separately reads/caches the JSON connection string; other paths use
`Global.ConnectionString` initialized through ASP.NET configuration. This makes
environment-variable overrides inconsistent. See README.md for configuration/rebuild steps.

## High-priority findings

- **Secrets:** supplied backend settings contain database credentials, and
  CommonMethods.cs contains a fixed encryption key. Values are omitted here. Move
  secrets out of source and rotate exposed credentials through the project's owner.
- **Access control:** no authentication/authorization requirement was found on
  reports, ticket updates or bot CRUD endpoints. The report UI has no guard.
  `UseAuthorization()` alone does not protect endpoints without policies/requirements.
- **CORS:** every origin, method and header is permitted. Restrict shared deployments
  and enforce conversation/report access in the API.
- **Legacy stack:** Angular 12, Node 14 and .NET 5 are unsupported. These matching
  versions reproduce the app; they are not a production modernization solution.
  NuGet reported moderate/high SqlClient 4.8.3 advisories GHSA-8g2p-5pqh-5jmc and
  GHSA-98g6-xh36-x2p7. A full npm security audit was not performed.
- **Contact-data logging:** client form/response logging and debugger statements
  remain throughout the application. Onboarding includes contact details.

## Correctness findings from source review

- `enableDisableRule()` submits a status, then overwrites local status using `toggle`.
  The report API does not supply `toggle`; the displayed status can disagree with
  persisted data. Request failure also leaves the optimistic local change in place.
- Export `prep()` enumerates object keys rather than mapping the defined column
  fields. Reordered or extra response fields can misalign XLSX headings and data.
- FAQ text and IDs are interpolated into query strings without URL encoding.
  Text containing `&`, `#`, `+` or `?` can change the request's meaning.
- Chat lacks pending-request protection, empty-input checks, null-response handling
  and useful failure feedback. Overlapping/failed calls can misalign message arrays.
- Code mutates `ChatbotForm.value` directly instead of controls. FAQ selection starts
  independent requests and assumes successful state transitions.
- Email validation permits only short TLDs and string escaping needs review. Form
  reset can leave txtQuery null before `.match()`. Timestamps are initialized once
  instead of captured for each message.
- Backend GetQueryAns inserts records and reads answers without a transaction or
  missing-knowledge guard. Duplicate submissions can duplicate conversation metadata;
  database constraints cannot be verified without the schema.
- BotConversationsRepostory.Add has an INSERT column/value mismatch and a
  textQuery/txtQuery mismatch. Its catch block logs rather than propagating failure,
  allowing apparent success without persistence.
- The unused general POST to Botknowledge disagrees with the controller contract.

These are source-review findings, not database-verified reproductions. Application
logic fixes were not included in setup. Reviewed SQL primarily uses Dapper parameters;
the presence of SQL text is not evidence of a SQL-injection issue.

## Maintainability and deployment

Types are mostly `any` and API contracts are loosely shared. Six smoke tests do not
exercise a complete conversation. No backend tests, CI, database migrations or working
end-to-end runner were found in the chatbot folders.

Bootstrap CSS loads from npm and a different CDN version; Font Awesome loads twice.
Remote fonts/icons affect offline operation and reproducibility. The production host
needs SPA fallback and an API reverse proxy; the development proxy is not emitted
into static build output. Bundled unused assets and duplicate styles warrant review.

## Follow-up order

1. Restore database connectivity/schema/data and verify a full conversation, report,
   ticket change and export using designated test records.
2. Protect reports/API access and move credentials out of source.
3. Repair ticket state, export mapping, request encoding, chat failure handling and
   legacy inserts with focused behavioral tests.
4. Upgrade frameworks/runtimes in a separate tested change; then consolidate styles,
   strengthen shared API types and add integration/CI coverage.

References: [Angular compatibility](https://angular.dev/reference/versions) documents
historical Angular 12 runtime requirements; the [Node 14.21.3 archive](https://nodejs.org/en/download/archive/v14.21.3)
provides the matching legacy runtime and marks it out of maintenance.
