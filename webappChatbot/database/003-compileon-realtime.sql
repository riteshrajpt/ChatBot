SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.WebsiteChatSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WebsiteChatSessions (
        SessionId uniqueidentifier NOT NULL CONSTRAINT PK_WebsiteChatSessions PRIMARY KEY,
        ConversationId int IDENTITY(1000000000,1) NOT NULL CONSTRAINT UQ_WebsiteChatSessions_Conversation UNIQUE,
        TokenHash binary(32) NOT NULL,
        CreatedAt datetimeoffset NOT NULL CONSTRAINT DF_WebsiteChatSessions_Created DEFAULT SYSUTCDATETIME()
    );
END;
IF OBJECT_ID(N'dbo.WebsiteChatMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WebsiteChatMessages (
        MessageId uniqueidentifier NOT NULL CONSTRAINT PK_WebsiteChatMessages PRIMARY KEY,
        SessionId uniqueidentifier NOT NULL,
        UserText nvarchar(2000) NOT NULL,
        ReplyText nvarchar(4000) NOT NULL,
        SentAt datetimeoffset NOT NULL,
        CONSTRAINT FK_WebsiteChatMessages_Session FOREIGN KEY(SessionId) REFERENCES dbo.WebsiteChatSessions(SessionId)
    );
    CREATE INDEX IX_WebsiteChatMessages_Session ON dbo.WebsiteChatMessages(SessionId, SentAt);
END;
IF OBJECT_ID(N'dbo.WebsiteInquiries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WebsiteInquiries (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_WebsiteInquiries PRIMARY KEY,
        FullName nvarchar(120) NOT NULL,
        Email nvarchar(320) NOT NULL,
        Service nvarchar(80) NOT NULL,
        Brief nvarchar(4000) NOT NULL,
        ConsentAt datetimeoffset NOT NULL,
        CreatedAt datetimeoffset NOT NULL CONSTRAINT DF_WebsiteInquiries_Created DEFAULT SYSUTCDATETIME(),
        [Status] nvarchar(20) NOT NULL CONSTRAINT DF_WebsiteInquiries_Status DEFAULT N'New'
    );
END;

-- Company service scope confirmed by the user. No invented contact details or claims.
INSERT dbo.Qlist(Qlist, QUESTION, BOTRESPONSE)
SELECT seed.Question, 104, seed.Answer
FROM (VALUES
    (N'What does Compileon do?', N'Compileon Innovation Private Limited focuses on software development, AI automation, cloud engineering and connected applications. Tell us what you want to build, and use the project enquiry form to share your requirements.'),
    (N'Can you build a website or application?', N'Compileon can help plan and build company websites, web applications and custom software. Share your idea, intended users and key features in the project enquiry form.'),
    (N'How can AI help my business?', N'AI and automation can support workflows such as document processing, internal assistants and repetitive operational tasks. A useful first step is to identify a specific workflow and the data it needs.'),
    (N'Do you work with cloud and real-time applications?', N'Cloud engineering and connected applications are part of Compileon''s service focus, including APIs, cloud deployment and real-time experiences. Share your existing platform and requirements in a project enquiry.'),
    (N'How do I start a project?', N'Use the Start a project form on this website. Include your name, email, area of interest and a short brief. The enquiry will be saved for the team to review; this assistant cannot promise a price or response time.')
) AS seed(Question, Answer)
WHERE NOT EXISTS(SELECT 1 FROM dbo.Qlist existing WHERE existing.Qlist=seed.Question);
