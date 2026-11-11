-- Reconstructed from the supplied API models and repository queries.
-- Creates missing objects only; does not replace existing tables or procedures.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Botlist', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Botlist (
        ID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Botlist PRIMARY KEY,
        BOTNAME nvarchar(150) NOT NULL,
        BOTAVATAR nvarchar(500) NULL,
        CLOSEMATCH int NULL,
        EXACTMATCH int NULL,
        CREATIONDATE datetime2(0) NOT NULL CONSTRAINT DF_Botlist_Creation DEFAULT SYSDATETIME(),
        CREATOR nvarchar(150) NULL,
        CREATORID nvarchar(64) NULL,
        BOTSTATUS bit NOT NULL CONSTRAINT DF_Botlist_Status DEFAULT 1,
        GREETING nvarchar(max) NULL
    );
END;

IF OBJECT_ID(N'dbo.Botknowledge', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Botknowledge (
        ID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Botknowledge PRIMARY KEY,
        BOTID int NOT NULL CONSTRAINT DF_Botknowledge_Bot DEFAULT 3,
        Q int NOT NULL CONSTRAINT DF_Botknowledge_Q DEFAULT 0,
        QUESTION int NOT NULL CONSTRAINT UQ_Botknowledge_Question UNIQUE,
        BOTRESPONSE nvarchar(max) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.Qlist', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Qlist (
        Qid int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Qlist PRIMARY KEY,
        Qlist nvarchar(450) NOT NULL CONSTRAINT UQ_Qlist_Text UNIQUE,
        QUESTION int NOT NULL CONSTRAINT DF_Qlist_Question DEFAULT 104,
        BOTRESPONSE nvarchar(max) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.BotConversationMain', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BotConversationMain (
        CONVERSATIONID int NOT NULL CONSTRAINT PK_BotConversationMain PRIMARY KEY,
        [TIMESTAMP] datetime2(0) NOT NULL CONSTRAINT DF_BotConversationMain_Time DEFAULT SYSDATETIME(),
        toggle bit NOT NULL CONSTRAINT DF_BotConversationMain_Toggle DEFAULT 0,
        [status] nvarchar(30) NOT NULL CONSTRAINT DF_BotConversationMain_Status DEFAULT N'Ticket is Open'
    );
END;

IF OBJECT_ID(N'dbo.botconversations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.botconversations (
        ID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_botconversations PRIMARY KEY,
        BOTID int NULL,
        CONVERSATIONID int NOT NULL,
        USERQUERY nvarchar(50) NULL,
        BOTRESPONSE nvarchar(max) NULL,
        BOTCONFIDENCE int NULL,
        USERNAME nvarchar(150) NULL,
        [TIMESTAMP] datetime2(0) NOT NULL CONSTRAINT DF_botconversations_Time DEFAULT SYSDATETIME(),
        REVIEWED bit NOT NULL CONSTRAINT DF_botconversations_Reviewed DEFAULT 0,
        UserEmail nvarchar(320) NULL,
        UserContactNo nvarchar(30) NULL,
        txtQuery nvarchar(max) NULL
    );
    CREATE INDEX IX_botconversations_Conversation ON dbo.botconversations(CONVERSATIONID, ID);
END;
GO

IF OBJECT_ID(N'dbo.usp_GetQueAnsList', N'P') IS NULL
BEGIN
    EXEC(N'CREATE PROCEDURE dbo.usp_GetQueAnsList @Qlist nvarchar(450)
    AS
    BEGIN
        SET NOCOUNT ON;
        SELECT Qid, Qlist, CONVERT(nvarchar(20), QUESTION) AS QUESTION, BOTRESPONSE
        FROM dbo.Qlist WHERE Qlist = @Qlist ORDER BY Qid;
    END;');
END;
