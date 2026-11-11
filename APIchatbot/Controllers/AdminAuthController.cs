using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AChatBotApi.Security;
using AChatBotApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AChatBotApi.Controllers
{
    [ApiController,Route("api/admin/auth")]
    public class AdminAuthController:ControllerBase
    {
        private readonly AdminAuthService auth;
        private readonly AgentPresence presence;
        public AdminAuthController(AdminAuthService auth,AgentPresence presence){this.auth=auth;this.presence=presence;}
        [HttpPost("login"),AllowAnonymous]
        public async Task<IActionResult> Login(AdminLogin request)
        {
            var result=await auth.LoginAsync(request);
            if(result==null)return Unauthorized(new{message="Email or password is incorrect, or the account is temporarily locked."});
            return Ok(result);
        }
        [HttpGet("me"),Authorize]
        public async Task<IActionResult> Me(){return Ok(await auth.ValidatePrincipalAsync(User));}
        [HttpPost("logout"),Authorize]
        public async Task<IActionResult> Logout(){await auth.LogoutAsync(User);presence.RevokeSession(User.FindFirstValue("sessionHash"));return NoContent();}
        [HttpPost("change-password"),Authorize]
        public async Task<IActionResult> ChangePassword(AdminPasswordChange request)
        {
            var result=await auth.ChangePasswordAsync(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)),request);
            if(result==null)return BadRequest(new{message="Check your current password and use a different new password of at least 12 characters."});
            presence.RevokeAdmin(result.User.Id);
            return Ok(result);
        }
    }
}
