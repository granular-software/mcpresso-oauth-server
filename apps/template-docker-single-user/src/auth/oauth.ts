import fs from "fs/promises";
import path from "path";
import { MCPOAuthServer } from "mcpresso-oauth-server";
import type { OAuthUser } from "mcpresso-oauth-server";
import { FileStorage } from "../storage/file-storage.js";

const BASE_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
const DATA_DIR = process.env.DATA_DIR || path.resolve("./data");
const API_KEY_FILE = process.env.API_KEY_FILE || path.join(DATA_DIR, "api_key.txt");

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function ensureApiKey(): Promise<string> {
  await ensureDataDir();
  try {
    const existing = (await fs.readFile(API_KEY_FILE, "utf8")).trim();
    if (existing.length > 0) return existing;
  } catch {}
  const key = generateApiKey();
  await fs.writeFile(API_KEY_FILE, key + "\n", { mode: 0o600 });
  return key;
}

function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString("base64url");
}

// Polyfill for crypto.getRandomValues in Node if needed
// @ts-ignore
const crypto = globalThis.crypto ?? (await import("node:crypto")).webcrypto;

const storage = new FileStorage(DATA_DIR);
await storage.initialize();

const apiKey = await ensureApiKey();
console.log("✅ Single-user API key generated and stored at:", API_KEY_FILE);

const SINGLE_USER: OAuthUser = {
  id: "single-user",
  username: "single-user",
  name: "Single User",
  email: "single-user@example.com",
  createdAt: new Date(),
  updatedAt: new Date(),
  scopes: ["read", "write"],
  profile: {},
};

export const oauthConfig = {
  oauth: new MCPOAuthServer(
    {
      issuer: BASE_URL,
      serverUrl: BASE_URL,
      jwtSecret: process.env.JWT_SECRET || "change-me",
      allowDynamicClientRegistration: true,
      supportedScopes: ["read", "write"],
      supportedGrantTypes: ["authorization_code"],
      auth: {
        authenticateUser: async (credentials: { username?: string; password?: string }) => {
          const provided = (credentials?.password || "").trim();
          if (provided && provided === apiKey) {
            return SINGLE_USER;
          }
          return null;
        },
        renderLoginPage: async (
          context: { clientId: string; redirectUri: string; scope?: string; resource?: string },
          error?: string,
        ) => {
          const errorHtml = error ? `<div class="error">${error}</div>` : "";
          const keyMasked = apiKey.replace(/.(?=.{4})/g, "•");
          return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>docker (single user) – API key</title>
    <style>
      :root { --primary:#2563eb; --bg:#f9fafb; --card-bg:#ffffff; --border:#e5e7eb; --radius:8px; --font:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:var(--font); background:var(--bg); display:flex; align-items:center; justify-content:center; height:100vh; }
      .card { width:100%; max-width:460px; background:var(--card-bg); padding:32px 40px; border:1px solid var(--border); border-radius:var(--radius); box-shadow:0 4px 24px rgba(0,0,0,0.05); }
      h1 { margin-top:0; margin-bottom:16px; font-size:24px; text-align:center; }
      p { color:#4b5563; font-size:14px; line-height:1.5; }
      .muted { color:#6b7280; font-size:13px; }
      .form-group { margin:16px 0 20px; }
      label { display:block; margin-bottom:6px; font-size:14px; color:#374151; }
      input { width:100%; padding:12px; font-size:16px; border:1px solid var(--border); border-radius:var(--radius); }
      button { width:100%; padding:12px; font-size:16px; border:none; border-radius:var(--radius); background:var(--primary); color:#fff; cursor:pointer; transition:background 0.2s ease; }
      button:hover { background:#1e4dd8; }
      .error { background:#fee2e2; color:#b91c1c; padding:12px; border-radius:var(--radius); margin-bottom:16px; text-align:center; }
      .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; background:#f3f4f6; padding:8px 10px; border-radius:6px; display:inline-block; }
    </style>
  </head>
  <body>
    <form class="card" method="POST" action="/authorize">
      <h1>Enter API key</h1>
      ${errorHtml}
      <p class="muted">Your API key file is available at <span class="code">${API_KEY_FILE}</span>. Copy its content and paste it below to continue.</p>
      <p class="muted">Preview: <span class="code">${keyMasked}</span></p>

      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="client_id" value="${context.clientId}" />
      <input type="hidden" name="redirect_uri" value="${context.redirectUri}" />
      <input type="hidden" name="scope" value="${context.scope || ""}" />
      <input type="hidden" name="resource" value="${context.resource || ""}" />

      <div class="form-group">
        <label for="password">API Key</label>
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
  userLookup: async (_jwt: unknown) => {
    return SINGLE_USER;
  },
};

