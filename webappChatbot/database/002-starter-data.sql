-- Starter onboarding and technical FAQs, not restored company/business knowledge.
-- Existing rows are never overwritten.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.Botlist WHERE ID = 3)
BEGIN
    SET IDENTITY_INSERT dbo.Botlist ON;
    INSERT dbo.Botlist (ID, BOTNAME, BOTAVATAR, CLOSEMATCH, EXACTMATCH, CREATOR, BOTSTATUS, GREETING)
    VALUES (3, N'SureAssure Assistant (Starter)', N'assets/images/user.png', 0, 100,
            N'Database setup', 1, N'Welcome. This chatbot is using starter content while business FAQs are configured.');
    SET IDENTITY_INSERT dbo.Botlist OFF;
END;

INSERT dbo.Botknowledge (BOTID, Q, QUESTION, BOTRESPONSE)
SELECT 3, 0, seed.QUESTION, seed.BOTRESPONSE
FROM (VALUES
    (101, N'Thank you. Please enter your email address.'),
    (102, N'Please enter your 10-digit mobile number.'),
    (103, N'Thank you. Choose a question from the main menu.'),
    (104, N'This database contains starter content. Please choose a question from the main menu.')
) AS seed(QUESTION, BOTRESPONSE)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Botknowledge existing WHERE existing.QUESTION = seed.QUESTION);

INSERT dbo.Qlist (Qlist, QUESTION, BOTRESPONSE)
SELECT seed.Qlist, 104, seed.BOTRESPONSE
FROM (VALUES
    (N'About this chatbot (starter)', N'This chatbot uses predefined questions and answers stored in SQL Server. Replace this starter content with your approved business information.'),
    (N'Is the database connected? (starter)', N'This response was loaded from the chatbot SQL database.'),
    (N'How do I add business questions? (starter)', N'Replace starter FAQs in dbo.Qlist with approved questions and responses. Business content has not been imported.')
) AS seed(Qlist, BOTRESPONSE)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Qlist existing WHERE existing.Qlist = seed.Qlist);
