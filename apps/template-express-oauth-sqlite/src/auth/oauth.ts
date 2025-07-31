import { MCPOAuthServer } from "mcpresso-oauth-server";
import { MemoryStorage } from "mcpresso-oauth-server";
import { SQLiteStorage } from "../storage/sqlite-storage.js";
import * as bcrypt from "bcryptjs";

// Resolve base URL (same logic as in server.ts)
const BASE_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

const dbPath = process.env.DB_PATH || "data/oauth.db";
const storage = new SQLiteStorage(dbPath);
await storage.initialize();
console.log("✅ Using SQLite storage for OAuth data");

// MCP auth configuration with integrated OAuth server
export const oauthConfig = {
	oauth: new MCPOAuthServer(
		{
			issuer: BASE_URL,
			serverUrl: BASE_URL,
			jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-this",
			allowDynamicClientRegistration: true,
			supportedScopes: ["read", "write"],
			supportedGrantTypes: ["authorization_code"],
			auth: {
				authenticateUser: async (credentials: { username: string; password: string }) => {
					// Authenticate against database users
					try {
						const user = await storage.getUserByEmail(credentials.username);
						if (!user) return null;

						const ok = await bcrypt.compare(credentials.password, user.hashedPassword);
						return ok ? user : null;
					} catch (error) {
						console.error("Authentication error:", error);
						return null;
					}
				},
				renderLoginPage: async (context: { clientId: string; redirectUri: string; scope?: string; resource?: string }, error?: string) => {
					const errorHtml = error ? `<div class="error">${error}</div>` : "";
					return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{PROJECT_NAME}} – Sign in</title>
    <style>
      :root { --primary:#2563eb; --bg:#f9fafb; --card-bg:#ffffff; --border:#e5e7eb; --radius:8px; --font:system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:var(--font); background:var(--bg); display:flex; align-items:center; justify-content:center; height:100vh; }
      .card { width:100%; max-width:420px; background:var(--card-bg); padding:32px 40px; border:1px solid var(--border); border-radius:var(--radius); box-shadow:0 4px 24px rgba(0,0,0,0.05); }
      h1 { margin-top:0; margin-bottom:24px; font-size:24px; text-align:center; }
      .form-group { margin-bottom:20px; }
      label { display:block; margin-bottom:6px; font-size:14px; color:#374151; }
      input { width:100%; padding:12px; font-size:16px; border:1px solid var(--border); border-radius:var(--radius); }
      button { width:100%; padding:12px; font-size:16px; border:none; border-radius:var(--radius); background:var(--primary); color:#fff; cursor:pointer; transition:background 0.2s ease; }
      button:hover { background:#1e4dd8; }
      .error { background:#fee2e2; color:#b91c1c; padding:12px; border-radius:var(--radius); margin-bottom:16px; text-align:center; }
    </style>
  </head>
  <body>
    <form class="card" method="POST" action="/authorize">
      <h1>Sign in to {{PROJECT_NAME}}</h1>
      ${errorHtml}
      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="client_id" value="${context.clientId}" />
      <input type="hidden" name="redirect_uri" value="${context.redirectUri}" />
      <input type="hidden" name="scope" value="${context.scope || ""}" />
      <input type="hidden" name="resource" value="${context.resource || ""}" />

      <div class="form-group">
        <label for="username">Email</label>
        <input type="email" id="username" name="username" required placeholder="you@example.com" />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required placeholder="••••••••" />
      </div>
      <button type="submit">Continue</button>
    </form>
  </body>
</html>`;
				},
			},
		},
		storage,
	),
	serverUrl: BASE_URL,
	userLookup: async (jwtPayload: any) => {
		// Look up full user profile from database
		try {
			const user = await storage.getUserById(jwtPayload.sub);
			return user
				? {
						id: user.id,
						username: user.username,
						email: user.email,
						scopes: user.scopes || ["read", "write"],
						profile: user.profile || {},
					}
				: null;
		} catch (error) {
			console.error("User lookup error:", error);
			return null;
		}
	},
};
