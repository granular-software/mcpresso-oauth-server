import type { 
  MCPOAuthStorage,
  OAuthClient,
  OAuthUser,
  AuthorizationCode,
  AccessToken,
  RefreshToken
} from '../types.js'

export class MemoryStorage implements MCPOAuthStorage {
  private clients = new Map<string, OAuthClient>()
  private users = new Map<string, OAuthUser>()
  private authorizationCodes = new Map<string, AuthorizationCode>()
  private accessTokens = new Map<string, AccessToken>()
  private refreshTokens = new Map<string, RefreshToken>()

  // ===== CLIENT MANAGEMENT =====

  async createClient(client: OAuthClient): Promise<void> {
    this.clients.set(client.id, client)
  }

  async getClient(clientId: string): Promise<OAuthClient | null> {
    return this.clients.get(clientId) || null
  }

  async listClients(): Promise<OAuthClient[]> {
    return Array.from(this.clients.values())
  }

  async updateClient(clientId: string, updates: Partial<OAuthClient>): Promise<void> {
    const client = this.clients.get(clientId)
    if (client) {
      this.clients.set(clientId, { ...client, ...updates, updatedAt: new Date() })
    }
  }

  async deleteClient(clientId: string): Promise<void> {
    this.clients.delete(clientId)
  }

  // ===== USER MANAGEMENT =====

  async createUser(user: OAuthUser): Promise<void> {
    this.users.set(user.id, user)
  }

  async getUser(userId: string): Promise<OAuthUser | null> {
    return this.users.get(userId) || null
  }

  async getUserByUsername(username: string): Promise<OAuthUser | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user
      }
    }
    return null
  }

  async listUsers(): Promise<OAuthUser[]> {
    return Array.from(this.users.values())
  }

  async updateUser(userId: string, updates: Partial<OAuthUser>): Promise<void> {
    const user = this.users.get(userId)
    if (user) {
      this.users.set(userId, { ...user, ...updates, updatedAt: new Date() })
    }
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId)
  }

  // ===== AUTHORIZATION CODES =====

  async createAuthorizationCode(code: AuthorizationCode): Promise<void> {
    this.authorizationCodes.set(code.code, code)
  }

  async getAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
    return this.authorizationCodes.get(code) || null
  }

  async deleteAuthorizationCode(code: string): Promise<void> {
    this.authorizationCodes.delete(code)
  }

  async cleanupExpiredCodes(): Promise<void> {
    const now = new Date()
    for (const [code, authCode] of this.authorizationCodes.entries()) {
      if (authCode.expiresAt < now) {
        this.authorizationCodes.delete(code)
      }
    }
  }

  // ===== ACCESS TOKENS =====

  async createAccessToken(token: AccessToken): Promise<void> {
    this.accessTokens.set(token.token, token)
  }

  async getAccessToken(token: string): Promise<AccessToken | null> {
    return this.accessTokens.get(token) || null
  }

  async deleteAccessToken(token: string): Promise<void> {
    this.accessTokens.delete(token)
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date()
    for (const [token, accessToken] of this.accessTokens.entries()) {
      if (accessToken.expiresAt < now) {
        this.accessTokens.delete(token)
      }
    }
  }

  // ===== REFRESH TOKENS =====

  async createRefreshToken(token: RefreshToken): Promise<void> {
    this.refreshTokens.set(token.token, token)
  }

  async getRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokens.get(token) || null
  }

  async deleteRefreshToken(token: string): Promise<void> {
    this.refreshTokens.delete(token)
  }

  async deleteRefreshTokensByAccessToken(accessTokenId: string): Promise<void> {
    for (const [token, refreshToken] of this.refreshTokens.entries()) {
      if (refreshToken.accessTokenId === accessTokenId) {
        this.refreshTokens.delete(token)
      }
    }
  }

  async cleanupExpiredRefreshTokens(): Promise<void> {
    const now = new Date()
    for (const [token, refreshToken] of this.refreshTokens.entries()) {
      if (refreshToken.expiresAt < now) {
        this.refreshTokens.delete(token)
      }
    }
  }

  // ===== UTILITY METHODS =====

  getStats() {
    return {
      clients: this.clients.size,
      users: this.users.size,
      authorizationCodes: this.authorizationCodes.size,
      accessTokens: this.accessTokens.size,
      refreshTokens: this.refreshTokens.size
    }
  }
} 