SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.SuperAdmins',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.SuperAdmins(
  Id uniqueidentifier NOT NULL CONSTRAINT PK_SuperAdmins PRIMARY KEY,
  Email nvarchar(320) NOT NULL CONSTRAINT UQ_SuperAdmins_Email UNIQUE,
  DisplayName nvarchar(120) NOT NULL,
  PasswordHash binary(32) NOT NULL, PasswordSalt binary(16) NOT NULL,
  PasswordIterations int NOT NULL CONSTRAINT DF_AdminIterations DEFAULT 600000,
  MustChangePassword bit NOT NULL CONSTRAINT DF_AdminMustChange DEFAULT 1,
  IsActive bit NOT NULL CONSTRAINT DF_AdminActive DEFAULT 1,
  IsAssignable bit NOT NULL CONSTRAINT DF_AdminAssignable DEFAULT 1,
  IsAvailable bit NOT NULL CONSTRAINT DF_AdminAvailable DEFAULT 1,
  FailedLogins int NOT NULL CONSTRAINT DF_AdminFailures DEFAULT 0,
  LockedUntil datetimeoffset NULL, LastSeenAt datetimeoffset NULL,
  CreatedAt datetimeoffset NOT NULL CONSTRAINT DF_AdminCreated DEFAULT SYSUTCDATETIME()
 );
END;
IF OBJECT_ID(N'dbo.AdminSessions',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.AdminSessions(
  TokenHash binary(32) NOT NULL CONSTRAINT PK_AdminSessions PRIMARY KEY,
  AdminId uniqueidentifier NOT NULL CONSTRAINT FK_AdminSession_Admin REFERENCES dbo.SuperAdmins(Id),
  ExpiresAt datetimeoffset NOT NULL,
  RevokedAt datetimeoffset NULL,
  CreatedAt datetimeoffset NOT NULL CONSTRAINT DF_AdminSessionCreated DEFAULT SYSUTCDATETIME()
 );
END;
IF OBJECT_ID(N'dbo.SupportTickets',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.SupportTickets(
  Id uniqueidentifier NOT NULL CONSTRAINT PK_SupportTickets PRIMARY KEY,
  SessionId uniqueidentifier NOT NULL CONSTRAINT FK_SupportTicket_Session REFERENCES dbo.WebsiteChatSessions(SessionId),
  AssignedAdminId uniqueidentifier NOT NULL CONSTRAINT FK_SupportTicket_Admin REFERENCES dbo.SuperAdmins(Id),
  CustomerName nvarchar(120) NOT NULL, CustomerEmail nvarchar(320) NULL,
  Subject nvarchar(200) NOT NULL,
  [Status] nvarchar(20) NOT NULL CONSTRAINT CK_SupportTicket_Status CHECK([Status] IN(N'Waiting',N'Active',N'Closed')),
  CreatedAt datetimeoffset NOT NULL CONSTRAINT DF_SupportTicketCreated DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetimeoffset NOT NULL CONSTRAINT DF_SupportTicketUpdated DEFAULT SYSUTCDATETIME(),
  ClosedAt datetimeoffset NULL
 );
 CREATE UNIQUE INDEX UQ_SupportTicket_OpenSession ON dbo.SupportTickets(SessionId) WHERE [Status]<>N'Closed';
 CREATE INDEX IX_SupportTicket_Queue ON dbo.SupportTickets([Status],UpdatedAt DESC);
END;
IF OBJECT_ID(N'dbo.SupportMessages',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.SupportMessages(
  Id uniqueidentifier NOT NULL CONSTRAINT PK_SupportMessages PRIMARY KEY,
  TicketId uniqueidentifier NOT NULL CONSTRAINT FK_SupportMessage_Ticket REFERENCES dbo.SupportTickets(Id),
  SenderRole nvarchar(20) NOT NULL CONSTRAINT CK_SupportMessage_Role CHECK(SenderRole IN(N'customer',N'agent',N'system')),
  SenderName nvarchar(120) NOT NULL, AdminId uniqueidentifier NULL,
  [Text] nvarchar(2000) NOT NULL,
  SentAt datetimeoffset NOT NULL CONSTRAINT DF_SupportMessageTime DEFAULT SYSUTCDATETIME()
 );
 CREATE INDEX IX_SupportMessages_Thread ON dbo.SupportMessages(TicketId,SentAt);
END;
IF COL_LENGTH('dbo.WebsiteInquiries','UpdatedAt') IS NULL
 ALTER TABLE dbo.WebsiteInquiries ADD UpdatedAt datetimeoffset NULL;
IF OBJECT_ID(N'dbo.InquiryResponses',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.InquiryResponses(
  Id uniqueidentifier NOT NULL CONSTRAINT PK_InquiryResponses PRIMARY KEY,
  InquiryId uniqueidentifier NOT NULL CONSTRAINT FK_InquiryResponse_Inquiry REFERENCES dbo.WebsiteInquiries(Id),
  AdminId uniqueidentifier NOT NULL CONSTRAINT FK_InquiryResponse_Admin REFERENCES dbo.SuperAdmins(Id),
  Body nvarchar(4000) NOT NULL,
  CreatedAt datetimeoffset NOT NULL CONSTRAINT DF_InquiryResponseCreated DEFAULT SYSUTCDATETIME()
 );
END;
IF OBJECT_ID(N'dbo.EmailOutbox',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.EmailOutbox(
  Id uniqueidentifier NOT NULL CONSTRAINT PK_EmailOutbox PRIMARY KEY,
  EntityId uniqueidentifier NOT NULL,
  DedupeKey nvarchar(250) NOT NULL CONSTRAINT UQ_EmailOutbox_Dedupe UNIQUE,
  Recipient nvarchar(320) NOT NULL, Subject nvarchar(250) NOT NULL, Body nvarchar(max) NOT NULL,
  [Status] nvarchar(20) NOT NULL CONSTRAINT DF_OutboxStatus DEFAULT N'Pending',
  Attempts int NOT NULL CONSTRAINT DF_OutboxAttempts DEFAULT 0,
  NextAttemptAt datetimeoffset NOT NULL CONSTRAINT DF_OutboxNext DEFAULT SYSUTCDATETIME(),
  LeaseUntil datetimeoffset NULL, LastError nvarchar(1000) NULL,
  CreatedAt datetimeoffset NOT NULL CONSTRAINT DF_OutboxCreated DEFAULT SYSUTCDATETIME(),
  SentAt datetimeoffset NULL
 );
 CREATE INDEX IX_EmailOutbox_Pending ON dbo.EmailOutbox([Status],NextAttemptAt);
END;
