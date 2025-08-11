import fs from "fs/promises";
import path from "path";
import type {
  MCPOAuthStorage,
  OAuthClient,
  OAuthUser,
  AuthorizationCode,
  AccessToken,
  RefreshToken,
} from "mcpresso-oauth-server";

type TableName =
  | "clients"
  | "users"
  | "authorizationCodes"
  | "accessTokens"
  | "refreshTokens";

type Tables = Record<TableName, Record<string, unknown>>;

export class FileStorage implements MCPOAuthStorage {
  private dir: string;
  private file: string;
  private data: Tables = {
    clients: {},
    users: {},
    authorizationCodes: {},
    accessTokens: {},
    refreshTokens: {},
  };

  constructor(dataDir: string) {
    this.dir = dataDir;
    this.file = path.join(this.dir, "oauth.json");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      const raw = await fs.readFile(this.file, "utf8");
      this.data = JSON.parse(raw) as Tables;
    } catch {
      await this.flush();
    }
  }

  private async flush() {
    const tmp = this.file + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
    await fs.rename(tmp, this.file);
  }

  private set<T extends object>(table: TableName, key: string, value: T) {
    (this.data[table] as Record<string, T>)[key] = value;
  }
  private get<T extends object>(table: TableName, key: string): T | null {
    return ((this.data[table] as Record<string, T>)[key] as T) || null;
  }
  private del(table: TableName, key: string) {
    delete (this.data[table] as Record<string, unknown>)[key];
  }
  private all<T extends object>(table: TableName): T[] {
    return Object.values(this.data[table] as Record<string, T>);
  }

  // Clients
  async createClient(client: OAuthClient): Promise<void> {
    this.set("clients", client.id, client);
    await this.flush();
  }
  async getClient(clientId: string): Promise<OAuthClient | null> {
    return this.get("clients", clientId);
  }
  async listClients(): Promise<OAuthClient[]> {
    return this.all("clients") as OAuthClient[];
  }
  async updateClient(clientId: string, updates: Partial<OAuthClient>): Promise<void> {
    const existing = await this.getClient(clientId);
    if (!existing) return;
    this.set("clients", clientId, { ...existing, ...updates, updatedAt: new Date() });
    await this.flush();
  }
  async deleteClient(clientId: string): Promise<void> {
    this.del("clients", clientId);
    await this.flush();
  }

  // Users
  async createUser(user: OAuthUser): Promise<void> {
    this.set("users", user.id, user);
    await this.flush();
  }
  async getUser(userId: string): Promise<OAuthUser | null> {
    return this.get("users", userId);
  }
  async getUserByUsername(username: string): Promise<OAuthUser | null> {
    return (
      (this.all("users") as OAuthUser[]).find((u) => u.username === username) || null
    );
  }
  async listUsers(): Promise<OAuthUser[]> {
    return this.all("users") as OAuthUser[];
  }
  async updateUser(userId: string, updates: Partial<OAuthUser>): Promise<void> {
    const existing = await this.getUser(userId);
    if (!existing) return;
    this.set("users", userId, { ...existing, ...updates, updatedAt: new Date() });
    await this.flush();
  }
  async deleteUser(userId: string): Promise<void> {
    this.del("users", userId);
    await this.flush();
  }

  // Authorization codes
  async createAuthorizationCode(code: AuthorizationCode): Promise<void> {
    this.set("authorizationCodes", code.code, code);
    await this.flush();
  }
  async getAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
    return this.get("authorizationCodes", code);
  }
  async deleteAuthorizationCode(code: string): Promise<void> {
    this.del("authorizationCodes", code);
    await this.flush();
  }
  async cleanupExpiredCodes(): Promise<void> {
    const now = new Date();
    for (const [code, obj] of Object.entries(this.data.authorizationCodes)) {
      const c = obj as AuthorizationCode;
      if (c.expiresAt < now) delete this.data.authorizationCodes[code];
    }
    await this.flush();
  }

  // Access tokens
  async createAccessToken(token: AccessToken): Promise<void> {
    this.set("accessTokens", token.token, token);
    await this.flush();
  }
  async getAccessToken(token: string): Promise<AccessToken | null> {
    return this.get("accessTokens", token);
  }
  async deleteAccessToken(token: string): Promise<void> {
    this.del("accessTokens", token);
    await this.flush();
  }
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    for (const [t, obj] of Object.entries(this.data.accessTokens)) {
      const a = obj as AccessToken;
      if (a.expiresAt < now) delete this.data.accessTokens[t];
    }
    await this.flush();
  }

  // Refresh tokens
  async createRefreshToken(token: RefreshToken): Promise<void> {
    this.set("refreshTokens", token.token, token);
    await this.flush();
  }
  async getRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.get("refreshTokens", token);
  }
  async deleteRefreshToken(token: string): Promise<void> {
    this.del("refreshTokens", token);
    await this.flush();
  }
  async deleteRefreshTokensByAccessToken(accessTokenId: string): Promise<void> {
    for (const [t, obj] of Object.entries(this.data.refreshTokens)) {
      const r = obj as RefreshToken;
      if (r.accessTokenId === accessTokenId) delete this.data.refreshTokens[t];
    }
    await this.flush();
  }
  async cleanupExpiredRefreshTokens(): Promise<void> {
    const now = new Date();
    for (const [t, obj] of Object.entries(this.data.refreshTokens)) {
      const r = obj as RefreshToken;
      if (r.expiresAt < now) delete this.data.refreshTokens[t];
    }
    await this.flush();
  }

  // Utility (optional but used by dashboards)
  getStats() {
    return {
      clients: Object.keys(this.data.clients).length,
      users: Object.keys(this.data.users).length,
      authorizationCodes: Object.keys(this.data.authorizationCodes).length,
      accessTokens: Object.keys(this.data.accessTokens).length,
      refreshTokens: Object.keys(this.data.refreshTokens).length,
    };
  }
}

