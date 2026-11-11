using System;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using System.Data.SqlClient;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AChatBotApi.Security
{
    public class AdminUser
    {
        public Guid Id { get; set; }
        public string Email { get; set; }
        public string DisplayName { get; set; }
        public bool MustChangePassword { get; set; }
        public DateTimeOffset? SessionExpiresAt { get; set; }
    }
    public class AdminLogin { public string Email { get; set; } public string Password { get; set; } }
    public class AdminPasswordChange { public string CurrentPassword { get; set; } public string NewPassword { get; set; } }
    public class AdminAuthResult
    {
        public string Token { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
        public AdminUser User { get; set; }
    }
    public class AdminAuthService
    {
        private readonly string connectionString;
        public AdminAuthService(IConfiguration configuration) { connectionString=configuration.GetConnectionString("Dbconnection"); }
        public static byte[] HashToken(string token)
        { using var hash=SHA256.Create(); return hash.ComputeHash(Encoding.UTF8.GetBytes(token)); }
        public static byte[] PasswordHash(string password,byte[] salt,int iterations)
        { using var derive=new Rfc2898DeriveBytes(password,salt,iterations,HashAlgorithmName.SHA256); return derive.GetBytes(32); }
        private static byte[] RandomBytes(int count)
        { var bytes=new byte[count];using var rng=RandomNumberGenerator.Create();rng.GetBytes(bytes);return bytes; }

        public async Task<AdminAuthResult> LoginAsync(AdminLogin request)
        {
            if(request==null || string.IsNullOrWhiteSpace(request.Email) || request.Email.Length>320 || string.IsNullOrEmpty(request.Password) || request.Password.Length>256) return null;
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();
            using var tx=connection.BeginTransaction();
            var row=await connection.QuerySingleOrDefaultAsync<PasswordRow>("SELECT * FROM dbo.SuperAdmins WITH(UPDLOCK,HOLDLOCK) WHERE Email=@email AND IsActive=1;",new{email=request.Email.Trim().ToLowerInvariant()},tx);
            var candidate=PasswordHash(request.Password,row?.PasswordSalt ?? new byte[16],row?.PasswordIterations ?? 600000);
            if(row==null){tx.Commit();return null;}
            if(row.LockedUntil>DateTimeOffset.UtcNow){tx.Commit();return null;}
            if(!CryptographicOperations.FixedTimeEquals(candidate,row.PasswordHash))
            {
                await connection.ExecuteAsync(@"UPDATE dbo.SuperAdmins SET FailedLogins=FailedLogins+1,
                    LockedUntil=CASE WHEN FailedLogins+1>=5 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE LockedUntil END WHERE Id=@Id;",row,tx);
                tx.Commit();return null;
            }
            await connection.ExecuteAsync("UPDATE dbo.SuperAdmins SET FailedLogins=0,LockedUntil=NULL WHERE Id=@Id;",row,tx);
            var result=await IssueAsync(connection,tx,row);tx.Commit();return result;
        }
        private static async Task<AdminAuthResult> IssueAsync(SqlConnection connection,SqlTransaction tx,AdminUser user)
        {
            var token=Convert.ToBase64String(RandomBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_');
            var expires=DateTimeOffset.UtcNow.AddHours(8);
            await connection.ExecuteAsync("INSERT dbo.AdminSessions(TokenHash,AdminId,ExpiresAt) VALUES(@hash,@Id,@expires);",new{hash=HashToken(token),user.Id,expires},tx);
            return new AdminAuthResult{Token=token,ExpiresAt=expires,User=new AdminUser{Id=user.Id,Email=user.Email,DisplayName=user.DisplayName,MustChangePassword=user.MustChangePassword}};
        }
        public async Task<AdminUser> ValidateAsync(byte[] tokenHash)
        {
            using var connection=new SqlConnection(connectionString);
            return await connection.QuerySingleOrDefaultAsync<AdminUser>(@"SELECT a.Id,a.Email,a.DisplayName,a.MustChangePassword,s.ExpiresAt AS SessionExpiresAt
                FROM dbo.AdminSessions s JOIN dbo.SuperAdmins a ON a.Id=s.AdminId
                WHERE s.TokenHash=@tokenHash AND s.ExpiresAt>SYSUTCDATETIME() AND s.RevokedAt IS NULL AND a.IsActive=1;",new{tokenHash});
        }
        public async Task<AdminUser> ValidatePrincipalAsync(ClaimsPrincipal principal)
        {
            try{return await ValidateAsync(Convert.FromBase64String(principal.FindFirstValue("sessionHash")??""));}
            catch(FormatException){return null;}
        }
        public async Task LogoutAsync(ClaimsPrincipal principal)
        {
            var hash=Convert.FromBase64String(principal.FindFirstValue("sessionHash"));
            using var connection=new SqlConnection(connectionString);
            await connection.ExecuteAsync("UPDATE dbo.AdminSessions SET RevokedAt=SYSUTCDATETIME() WHERE TokenHash=@hash;",new{hash});
        }
        public async Task<AdminAuthResult> ChangePasswordAsync(Guid adminId,AdminPasswordChange request)
        {
            if(request==null || string.IsNullOrEmpty(request.CurrentPassword) || request.CurrentPassword.Length>256 ||
               string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length<12 || request.NewPassword.Length>256 || request.CurrentPassword==request.NewPassword) return null;
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var tx=connection.BeginTransaction();
            var row=await connection.QuerySingleOrDefaultAsync<PasswordRow>("SELECT * FROM dbo.SuperAdmins WITH(UPDLOCK,HOLDLOCK) WHERE Id=@adminId AND IsActive=1;",new{adminId},tx);
            if(row==null || !CryptographicOperations.FixedTimeEquals(PasswordHash(request.CurrentPassword,row.PasswordSalt,row.PasswordIterations),row.PasswordHash)){tx.Commit();return null;}
            var salt=RandomBytes(16);var hash=PasswordHash(request.NewPassword,salt,600000);
            await connection.ExecuteAsync(@"UPDATE dbo.SuperAdmins SET PasswordSalt=@salt,PasswordHash=@hash,PasswordIterations=600000,MustChangePassword=0,FailedLogins=0,LockedUntil=NULL WHERE Id=@adminId;
                UPDATE dbo.AdminSessions SET RevokedAt=SYSUTCDATETIME() WHERE AdminId=@adminId;",new{salt,hash,adminId},tx);
            row.MustChangePassword=false;var result=await IssueAsync(connection,tx,row);tx.Commit();return result;
        }
        private class PasswordRow:AdminUser
        {
            public byte[] PasswordHash { get; set; }
            public byte[] PasswordSalt { get; set; }
            public int PasswordIterations { get; set; }
            public DateTimeOffset? LockedUntil { get; set; }
        }
    }
    public class AdminAuthenticationHandler:AuthenticationHandler<AuthenticationSchemeOptions>
    {
        private readonly AdminAuthService auth;
        public AdminAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,ILoggerFactory logger,UrlEncoder encoder,ISystemClock clock,AdminAuthService auth):base(options,logger,encoder,clock){this.auth=auth;}
        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var authorization=Request.Headers["Authorization"].ToString();
            string token=authorization.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)?authorization.Substring(7).Trim():null;
            if(string.IsNullOrEmpty(token) && Request.Path.StartsWithSegments("/hubs/admin")) token=Request.Query["access_token"];
            if(string.IsNullOrEmpty(token)) return AuthenticateResult.NoResult();
            if(token.Length>200) return AuthenticateResult.Fail("Invalid session.");
            var hash=AdminAuthService.HashToken(token);var user=await auth.ValidateAsync(hash);
            if(user==null) return AuthenticateResult.Fail("Session expired.");
            var identity=new ClaimsIdentity(new[]{
                new Claim(ClaimTypes.NameIdentifier,user.Id.ToString()),new Claim(ClaimTypes.Name,user.DisplayName),
                new Claim(ClaimTypes.Email,user.Email),new Claim(ClaimTypes.Role,user.MustChangePassword?"PasswordChange":"SuperAdmin"),
                new Claim("sessionHash",Convert.ToBase64String(hash)),new Claim("sessionExpires",user.SessionExpiresAt.Value.ToString("o"))
            },Scheme.Name);
            return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity),Scheme.Name));
        }
    }
}
