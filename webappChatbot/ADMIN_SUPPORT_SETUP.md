# Compileon admin, agent chat and email

Completed locally on 10 November 2026 in the existing Angular/.NET projects.

## Open the applications

- Company website: <http://127.0.0.1:4200/homepage>
- Protected admin panel: <http://127.0.0.1:4200/admin>
- Legacy conversation reports: <http://127.0.0.1:4200/chat-bot-rpt> (admin sign-in required)
- API Swagger: <http://127.0.0.1:5000/swagger/index.html>

## Initial admin sign-in

Three active, assignable super-admin accounts were created:

| Account | Email |
| --- | --- |
| Super admin 1 | rsinghfsd@gmail.com |
| Super admin 2 | compileon.directors@gmail.com |
| Super admin 3 | r.sritesh799@gmail.com |

Initial passwords are random and stored with Windows user protection in the ignored
`.local/admin-bootstrap.xml`. They are not in source files, this document, or notification
emails. From this frontend project folder, the setup owner can display them in their
own terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\show-admin-bootstrap.ps1
```

Use the issued email/password at `/admin`. A different password of at least 12
characters is required before viewing customer data. Each initial password stops working
after its first password change. The database stores salted PBKDF2-SHA256 hashes with
600,000 iterations. Re-running `setup-superadmins.ps1` preserves existing credentials.

Admin sessions last eight hours. Logout revokes the session and disconnects its live
admin connection. Password changes revoke all prior sessions for that admin. Five failed
sign-ins lock the account for 15 minutes. There is no public account registration.

## Handling customer queries

1. Customer opens chat, chooses **Talk to an agent**, and supplies a name, short query
   and optional email. A private support ticket is saved.
2. The server randomly chooses one of the three active assignable admins, preferring
   those who are online and available. If all are offline, it still assigns the query
   and keeps it waiting. The customer can leave messages without a false online claim.
3. A notification is queued for **each of the three admins**, stating the selected
   assignee. Duplicate handoff requests do not create duplicate tickets or notifications.
4. The assignee accepts the query in the admin panel. Another super admin can explicitly
   take ownership, or transfer it to a different admin. Only the current owner can send
   live replies or resolve the ticket.
5. Customer/agent messages are delivered through private SignalR groups and saved to
   SQL. Agents can review the earlier assistant conversation for context. Away/offline
   status is reflected to the customer, and messages remain saved while an agent is away.
6. The admin can resolve the query, or the customer can end live chat. A later request
   can open a new ticket. The assistant resumes when there is no open live ticket.

Admin availability can be changed in the header. The Team tab shows all three accounts
and their presence. A connected admin sends a heartbeat every 30 seconds; presence is
also cleared on disconnect. Replies are not broadcast to unrelated customers.

## Project enquiry and response emails

The **Let’s build together** form validates and saves the full enquiry and consent
timestamp. The same SQL transaction queues:

- A receipt to the customer's supplied email.
- The project details to **compileon.directors@gmail.com**.

In **Project enquiries**, a super admin can review the brief, change review status,
and save a written response. Each response is stored in `InquiryResponses` and queues
the response to both the customer and the directors mailbox. Stable request IDs prevent
double-clicks/retries from inserting duplicate receipts or responses.

**Email delivery** shows actual queue states, attempts and sanitized failures. Failed
deliveries can be retried. A saved enquiry is not reported as delivered mail merely
because it was saved. `Sent` means the SMTP server accepted the message; inbox placement
or external bounces are outside this application's delivery acknowledgement.

## Mail configuration

The user explicitly confirmed that the existing `HolostikBi@holostik.com` Office 365
mailbox is authorized for Compileon notifications. TLS and authentication were verified.
Live SMTP mode is enabled. One deduplicated setup notification was accepted by SMTP
for each of the three super-admin recipients, with one attempt each.

The old hardcoded SMTP password was removed from the active API source. The credential
is Windows-encrypted in `.local/mail-credential.xml`; non-secret settings are in
`.local/mail-settings.json`. The API launcher passes the password in its process
environment and removes it from the launching process after background startup.

To replace the sender/credential in the future, use the secure prompt:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-mail.ps1 -HostName smtp.office365.com -Port 587 -Sender sender@example.com
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\probe-mail.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\enable-mail.ps1 -Mode Smtp
```

Restart the API afterward. The transport uses SMTP with STARTTLS (normally port 587).
No password needs to be pasted into source, configuration JSON or command arguments.
The encrypted files work only for the same Windows user on this machine.

`Mail:PublicSiteUrl` supplies links in notification emails. It currently points to the
local website. Before staff access the application from other machines, deploy it under
HTTPS, set the actual public URL, and configure the frontend/API origins and proxies.
Loopback URLs refer to the setup machine only.

## Schema and API

`database/004-admin-support.sql` creates missing admin/session, support ticket/message,
enquiry response and durable email outbox tables. Existing conversations and enquiries
are preserved. Re-run the normal setup script for a fresh database, then provision admins:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-db.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-superadmins.ps1
```

The API adds `/api/admin/auth/*`, protected `/api/admin/*` endpoints, and a separate
authorized `/hubs/admin`. The customer hub stays `/hubs/chat`. Anonymous users cannot
join the admin hub or access enquiry, ticket or legacy report data. Customer support
history/group membership requires the customer's random session ID and secret token.

Email outbox records are inserted transactionally with the originating enquiry/ticket/
response. A background worker leases pending rows, records acceptance/failure and retries
up to five times. Pending records survive a restart. Standard SMTP retries after an
ambiguous transport failure can still be delivered more than once; the application
deduplicates its own requests and queue entries.

## Company sections completed

- Expertise: four service areas, concrete capabilities and service-specific project CTAs.
- Possibilities: interactive product/automation/integration examples and relevant use cases.
- Our approach: discovery, planning, delivery and evolution with explicit deliverables.
- About us: company purpose, engineering principles and three engagement starting points.

No client names, business metrics, office address or unsupported company history were invented.

## Verification and operation

- 17 headless browser tests pass, including admin role/password-change gating, customer
  handoff, form states and mobile/tablet/desktop layouts.
- Full SDK/WebSocket integration passes for random assignment, three queued alerts,
  private two-way messaging, retries, ownership, transfer, resolution, customer end-chat,
  presence, enquiry/response recipients, logout revocation and lockout.
- Synthetic tests use a temporary **non-assignable** admin and uniquely tagged records.
  They remove only their test records; three real assignable admins remain.
- Angular production build and .NET API build pass. Existing legacy runtime/dependency
  and asset-size warnings remain documented in PROJECT_ANALYSIS.md.
- Native visual automation remains unavailable; browser DOM/layout and integration
  checks were used. Review the live pages for visual preferences.

Inspect setup notification delivery without printing secrets:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-support-setup.ps1
```

`test-support.ps1` and `test-realtime.ps1` deliberately refuse to run synthetic email
workflows while SMTP is enabled. To rerun them, temporarily set mail mode to Disabled
and restart the owned API, run the test, then re-enable Smtp and restart it again. The
test wrapper cleans up its own queued emails before live SMTP is restored.

Use the existing `run-api.ps1 -Background` / `run-ui.ps1 -Background` launchers. Process
IDs and logs remain under `.local/`. Do not start a second instance on an occupied port.

References: [Microsoft SignalR authorization](https://learn.microsoft.com/aspnet/core/signalr/authn-and-authz)
and [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
