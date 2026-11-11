using AChatBotApi.Repository;
using AChatBotApi.Hubs;
using AChatBotApi.Security;
using AChatBotApi.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.OpenApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AChatBotApi
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {

            services.AddControllers();
            services.AddScoped<CompileonWebsiteRepository>();
            services.AddScoped<AdminAuthService>();
            services.AddScoped<SupportRepository>();
            services.AddSingleton<AgentPresence>();
            services.AddSingleton<SupportEvents>();
            services.AddHostedService<EmailDeliveryWorker>();
            services.AddAuthentication("AdminToken").AddScheme<AuthenticationSchemeOptions,AdminAuthenticationHandler>("AdminToken",options=>{});
            services.AddAuthorization();
            services.AddSignalR(options => { options.MaximumReceiveMessageSize = 16384; options.EnableDetailedErrors = false; });
            var allowedOrigins = Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?? new[] { "http://127.0.0.1:4200", "http://localhost:4200" };
            services.AddCors(cors => {
                cors.AddPolicy("WebsiteHub", builder => builder.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials());
                cors.AddPolicy("MyPolicy", builder => builder.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
            });
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "AChatBotApi", Version = "v1" });
            });




            Global.ConnectionString = Configuration.GetConnectionString("Dbconnection");
            

        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            // Swagger is available on the server; detailed errors stay development-only.
            app.UseSwagger();
            app.UseSwaggerUI(c => c.SwaggerEndpoint("v1/swagger.json", "AChatBotApi v1"));

            app.UseRouting();

            app.UseCors("MyPolicy");

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
                endpoints.MapHub<CompileonChatHub>("/hubs/chat").RequireCors("WebsiteHub");
                endpoints.MapHub<AdminSupportHub>("/hubs/admin").RequireCors("WebsiteHub");
            });
        }
    }
}