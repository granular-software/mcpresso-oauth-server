import { SignJWT, jwtVerify } from 'jose'
import { randomBytes, createHash } from 'crypto'
import type { 
  MCPOAuthConfig, 
  MCPOAuthConfigInput, 
  MCPOAuthStorage,
  OAuthClient,
  OAuthUser,
  AuthorizationCode,
  AccessToken,
  RefreshToken,
  AuthorizationRequest,
  TokenRequest,
  TokenResponse,
  TokenIntrospectionResponse,
  UserInfoResponse,
  OAuthError,
  MCPProtectedResourceMetadata,
  MCPAuthorizationServerMetadata,
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  UserAuthContext,
  UserAuthCallbacks
} from './types.js'

const DEFAULTS = {
  supportedScopes: ['read', 'write', 'openid', 'profile', 'email'],
  supportedGrantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
  supportedResponseTypes: ['code'],
  supportedCodeChallengeMethods: ['S256', 'plain'],
};

function normalizeConfig(config: any) {
  return {
    ...config,
    supportedScopes: config.supportedScopes ?? DEFAULTS.supportedScopes,
    supportedGrantTypes: config.supportedGrantTypes ?? DEFAULTS.supportedGrantTypes,
    supportedResponseTypes: config.supportedResponseTypes ?? DEFAULTS.supportedResponseTypes,
    supportedCodeChallengeMethods: config.supportedCodeChallengeMethods ?? DEFAULTS.supportedCodeChallengeMethods,
  };
}

export class MCPOAuthServer {
  private config: MCPOAuthConfig
  private storage: MCPOAuthStorage

  constructor(config: MCPOAuthConfigInput, storage: MCPOAuthStorage) {
    // Fill in required fields with defaults if missing
    const baseServerUrl = config.serverUrl || config.issuer;
    const fullConfig: MCPOAuthConfig = normalizeConfig({
      ...config,
      serverUrl: baseServerUrl,
      authorizationEndpoint: config.authorizationEndpoint ?? config.issuer + "/authorize",
      tokenEndpoint: config.tokenEndpoint ?? config.issuer + "/token",
      userinfoEndpoint: config.userinfoEndpoint ?? config.issuer + "/userinfo",
      jwksEndpoint: config.jwksEndpoint ?? config.issuer + "/.well-known/jwks.json",
      introspectionEndpoint: config.introspectionEndpoint ?? config.issuer + "/introspect",
      revocationEndpoint: config.revocationEndpoint ?? config.issuer + "/revoke",
      requireResourceIndicator: config.requireResourceIndicator ?? false,
      requirePkce: config.requirePkce ?? false,
      allowRefreshTokens: config.allowRefreshTokens ?? false,
      allowDynamicClientRegistration: config.allowDynamicClientRegistration ?? false,
      accessTokenLifetime: config.accessTokenLifetime ?? 3600,
      refreshTokenLifetime: config.refreshTokenLifetime ?? 3600,
      authorizationCodeLifetime: config.authorizationCodeLifetime ?? 600,
      supportedGrantTypes: config.supportedGrantTypes ?? DEFAULTS.supportedGrantTypes,
      supportedResponseTypes: config.supportedResponseTypes ?? DEFAULTS.supportedResponseTypes,
      supportedScopes: config.supportedScopes ?? DEFAULTS.supportedScopes,
      supportedCodeChallengeMethods: config.supportedCodeChallengeMethods ?? DEFAULTS.supportedCodeChallengeMethods,
      jwtAlgorithm: config.jwtAlgorithm ?? 'HS256',
      http: config.http,
    });
    this.config = fullConfig;
    this.storage = storage;
  }

  // ===== USER AUTHENTICATION =====

  /**
   * Handles user authentication during the authorization flow.
   * This method should be called before generating authorization codes.
   */
  async authenticateUserForAuthFlow(
    credentials: { username: string; password: string } | null,
    sessionData: any,
    context: UserAuthContext
  ): Promise<OAuthUser | null> {
    // If custom authentication callbacks are provided, use them
    if (this.config.auth) {
      // First, try to get current user from session
      if (this.config.auth.getCurrentUser) {
        const currentUser = await this.config.auth.getCurrentUser(sessionData, context)
        if (currentUser) {
          return currentUser
        }
      }

      // If credentials provided, try to authenticate
      if (credentials && this.config.auth.authenticateUser) {
        return await this.config.auth.authenticateUser(credentials, context)
      }
    }

    // Fallback: For demo/development purposes, return demo user if no auth callbacks
    // In production, this should require proper authentication
    if (!this.config.auth && credentials?.username === 'demo@example.com') {
      const demoUser = await this.storage.getUser('demo-user')
      return demoUser
    }

    return null
  }

  /**
   * Renders the login page for user authentication.
   */
  async renderLoginPage(context: UserAuthContext, error?: string): Promise<string> {
    if (this.config.auth?.renderLoginPage) {
      const result = await this.config.auth.renderLoginPage(context, error)
      if (typeof result === 'string') {
        return result
      }
      // Handle redirect case in the HTTP layer
    }

    // Default basic login page
    return this.generateDefaultLoginPage(context, error)
  }

  /**
   * Handles consent/authorization for authenticated users.
   */
  async handleUserConsent(user: OAuthUser, context: UserAuthContext): Promise<boolean> {
    if (this.config.auth?.renderConsentPage) {
      const result = await this.config.auth.renderConsentPage(user, context)
      if (typeof result === 'boolean') {
        return result
      }
      // Handle custom page/redirect case in the HTTP layer
      return true // Default to approved for now
    }

    // Default: auto-approve consent
    return true
  }

  private generateDefaultLoginPage(context: UserAuthContext, error?: string): string {
    const errorHtml = error ? `<div style="color: red; margin-bottom: 16px;">${error}</div>` : ''
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Login - OAuth Authorization</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 16px; }
            label { display: block; margin-bottom: 4px; font-weight: bold; }
            input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .client-info { background: #f8f9fa; padding: 16px; border-radius: 4px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="client-info">
            <h3>Authorization Request</h3>
            <p><strong>Client:</strong> ${context.clientId}</p>
            <p><strong>Scope:</strong> ${context.scope || 'Default'}</p>
          </div>
          
          ${errorHtml}
          
          <form method="POST" action="/authorize">
            <input type="hidden" name="response_type" value="code">
            <input type="hidden" name="client_id" value="${context.clientId}">
            <input type="hidden" name="redirect_uri" value="${context.redirectUri}">
            <input type="hidden" name="scope" value="${context.scope || ''}">
            <input type="hidden" name="resource" value="${context.resource || ''}">
            
            <div class="form-group">
              <label for="username">Username or Email:</label>
              <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
              <label for="password">Password:</label>
              <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit">Login & Authorize</button>
          </form>
        </body>
      </html>
    `
  }

  // ===== AUTHORIZATION ENDPOINT =====
  
  async handleAuthorizationRequest(
    params: AuthorizationRequest, 
    credentials?: { username: string; password: string },
    sessionData?: any,
    requestContext?: { ipAddress: string; userAgent?: string }
  ): Promise<{ redirectUrl: string } | { loginPage: string } | OAuthError> {
    try {
      // Validate required MCP parameters
      if (this.config.requireResourceIndicator && !params.resource) {
        return { error: 'invalid_request', error_description: 'resource parameter is required' }
      }

      // Use default resource if not provided and not required
      if (!params.resource && !this.config.requireResourceIndicator) {
        params.resource = this.config.serverUrl
      }

      if (this.config.requirePkce && !params.code_challenge) {
        return { error: 'invalid_request', error_description: 'code_challenge parameter is required' }
      }

      // Validate client
      const client = await this.storage.getClient(params.client_id)
      if (!client) {
        return { error: 'invalid_client', error_description: 'Client not found' }
      }

      // Validate redirect URI (allow sub-paths)
      if (
        client.redirectUris.length > 0 &&
        !client.redirectUris.some((base) => params.redirect_uri.startsWith(base))
      ) {
        return {
          error: 'invalid_request',
          error_description: 'Invalid redirect URI',
        };
      }

      // Validate grant type support
      if (!client.grantTypes.includes('authorization_code')) {
        return { error: 'unauthorized_client', error_description: 'Client not authorized for authorization_code grant' }
      }

      // Validate scope
      if (params.scope && !this.validateScope(params.scope, client.scopes)) {
        return { error: 'invalid_scope', error_description: 'Invalid scope' }
      }

      // Create authentication context
      const authContext: UserAuthContext = {
        clientId: params.client_id,
        scope: params.scope,
        resource: params.resource,
        redirectUri: params.redirect_uri,
        ipAddress: requestContext?.ipAddress || '0.0.0.0',
        userAgent: requestContext?.userAgent
      }

      // Authenticate user
      const user = await this.authenticateUserForAuthFlow(credentials || null, sessionData, authContext)
      
      if (!user) {
        // User not authenticated, return login page
        const loginPage = await this.renderLoginPage(authContext)
        return { loginPage }
      }

      // Check user consent
      const hasConsent = await this.handleUserConsent(user, authContext)
      if (!hasConsent) {
        return { error: 'access_denied', error_description: 'User denied authorization' }
      }

      // Generate authorization code
      const code = this.generateCode()
      const expiresAt = new Date(Date.now() + this.config.authorizationCodeLifetime * 1000)

      const authCode: AuthorizationCode = {
        code,
        clientId: params.client_id,
        userId: user.id, // Now using the actual authenticated user ID
        redirectUri: params.redirect_uri,
        scope: params.scope || 'read',
        resource: params.resource,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method,
        expiresAt,
        createdAt: new Date()
      }

      await this.storage.createAuthorizationCode(authCode)

      // Build redirect URL
      const redirectUrl = new URL(params.redirect_uri)
      redirectUrl.searchParams.set('code', code)
      if (params.state) {
        redirectUrl.searchParams.set('state', params.state)
      }

      return { redirectUrl: redirectUrl.toString() }
    } catch (error) {
      console.error('Authorization request error:', error)
      return { error: 'server_error', error_description: 'Internal server error' }
    }
  }

  // ===== TOKEN ENDPOINT =====

  async handleTokenRequest(params: TokenRequest): Promise<TokenResponse | OAuthError> {
    try {
      // Validate required MCP parameters
      if (this.config.requireResourceIndicator && !params.resource) {
        return { error: 'invalid_request', error_description: 'resource parameter is required' }
      }

      // Use default resource if not provided and not required
      if (!params.resource && !this.config.requireResourceIndicator) {
        params.resource = this.config.serverUrl
      }

      switch (params.grant_type) {
        case 'authorization_code':
          return this.handleAuthorizationCodeGrant(params)
        case 'refresh_token':
          return this.handleRefreshTokenGrant(params)
        case 'client_credentials':
          return this.handleClientCredentialsGrant(params)
        default:
          return { error: 'unsupported_grant_type', error_description: 'Grant type not supported' }
      }
    } catch (error) {
      console.error('Token request error:', error)
      return { error: 'server_error', error_description: 'Internal server error' }
    }
  }

  private async handleAuthorizationCodeGrant(params: TokenRequest): Promise<TokenResponse | OAuthError> {
    if (!params.code) {
      return { error: 'invalid_request', error_description: 'code parameter is required' }
    }

    if (this.config.requirePkce && !params.code_verifier) {
      return { error: 'invalid_request', error_description: 'code_verifier parameter is required' }
    }

    // Get and validate authorization code
    const authCode = await this.storage.getAuthorizationCode(params.code)
    if (!authCode) {
      return { error: 'invalid_grant', error_description: 'Invalid authorization code' }
    }

    if (authCode.expiresAt < new Date()) {
      await this.storage.deleteAuthorizationCode(params.code)
      return { error: 'invalid_grant', error_description: 'Authorization code expired' }
    }

    // Validate client
    const client = await this.storage.getClient(authCode.clientId)
    if (!client) {
      return { error: 'invalid_client', error_description: 'Client not found' }
    }

    // Validate PKCE
    if (authCode.codeChallenge) {
      if (!params.code_verifier) {
        return { error: 'invalid_request', error_description: 'code_verifier is required' }
      }

      const expectedChallenge = authCode.codeChallengeMethod === 'S256' 
        ? this.generateCodeChallenge(params.code_verifier)
        : params.code_verifier

      if (authCode.codeChallenge !== expectedChallenge) {
        return { error: 'invalid_grant', error_description: 'Invalid code verifier' }
      }
    }

    // Validate redirect URI if provided
    if (params.redirect_uri && params.redirect_uri !== authCode.redirectUri) {
      return { error: 'invalid_grant', error_description: 'Redirect URI mismatch' }
    }

    // Clean up authorization code
    await this.storage.deleteAuthorizationCode(params.code)

    // Generate access token
    const audience = params.resource || authCode.resource || this.config.serverUrl;
    const accessToken = await this.generateAccessToken(client.id, authCode.userId, authCode.scope, audience)
    
    // Generate refresh token if enabled
    let refreshToken: string | undefined
    if (this.config.allowRefreshTokens) {
      refreshToken = await this.generateRefreshToken(accessToken.token, client.id, authCode.userId, authCode.scope, audience)
    }

    return {
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenLifetime,
      refresh_token: refreshToken,
      scope: authCode.scope
    }
  }

  private async handleRefreshTokenGrant(params: TokenRequest): Promise<TokenResponse | OAuthError> {
    if (!params.refresh_token) {
      return { error: 'invalid_request', error_description: 'refresh_token parameter is required' }
    }

    // Get and validate refresh token
    const refreshToken = await this.storage.getRefreshToken(params.refresh_token)
    if (!refreshToken) {
      return { error: 'invalid_grant', error_description: 'Invalid refresh token' }
    }

    if (refreshToken.expiresAt < new Date()) {
      await this.storage.deleteRefreshToken(params.refresh_token)
      return { error: 'invalid_grant', error_description: 'Refresh token expired' }
    }

    // Validate client
    const client = await this.storage.getClient(refreshToken.clientId)
    if (!client) {
      return { error: 'invalid_client', error_description: 'Client not found' }
    }

    // Validate resource indicator
    if (params.resource && refreshToken.audience && params.resource !== refreshToken.audience) {
      return { error: 'invalid_grant', error_description: 'Resource indicator mismatch' }
    }

    // Clean up old tokens
    await this.storage.deleteRefreshToken(params.refresh_token)
    await this.storage.deleteRefreshTokensByAccessToken(refreshToken.accessTokenId)

    // Generate new tokens
    const accessToken = await this.generateAccessToken(client.id, refreshToken.userId, refreshToken.scope, params.resource)
    
    let newRefreshToken: string | undefined
    if (this.config.allowRefreshTokens) {
      newRefreshToken = await this.generateRefreshToken(accessToken.token, client.id, refreshToken.userId, refreshToken.scope, params.resource)
    }

    return {
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenLifetime,
      refresh_token: newRefreshToken,
      scope: refreshToken.scope
    }
  }

  private async handleClientCredentialsGrant(params: TokenRequest): Promise<TokenResponse | OAuthError> {
    // Validate client credentials
    const client = await this.storage.getClient(params.client_id)
    if (!client) {
      return { error: 'invalid_client', error_description: 'Client not found' }
    }

    if (client.type === 'confidential' && client.secret !== params.client_secret) {
      return { error: 'invalid_client', error_description: 'Invalid client secret' }
    }

    if (!client.grantTypes.includes('client_credentials')) {
      return { error: 'unauthorized_client', error_description: 'Client not authorized for client_credentials grant' }
    }

    // Generate access token (no refresh token for client credentials)
    const accessToken = await this.generateAccessToken(client.id, undefined, params.scope || 'read', params.resource)

    return {
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenLifetime,
      scope: accessToken.scope
    }
  }

  // ===== TOKEN INTROSPECTION =====

  async introspectToken(token: string): Promise<TokenIntrospectionResponse> {
    try {
      const accessToken = await this.storage.getAccessToken(token)
      if (!accessToken || accessToken.expiresAt < new Date()) {
        return { active: false }
      }

      const client = await this.storage.getClient(accessToken.clientId)
      const user = accessToken.userId ? await this.storage.getUser(accessToken.userId) : undefined

      return {
        active: true,
        scope: accessToken.scope,
        client_id: accessToken.clientId,
        username: user?.username,
        exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
        aud: accessToken.audience // MCP-specific: audience for validation
      }
    } catch (error) {
      console.error('Token introspection error:', error)
      return { active: false }
    }
  }

  // ===== TOKEN REVOCATION =====

  async revokeToken(token: string, clientId: string): Promise<{ success: boolean }> {
    try {
      const accessToken = await this.storage.getAccessToken(token)
      if (!accessToken || accessToken.clientId !== clientId) {
        return { success: false }
      }

      await this.storage.deleteAccessToken(token)
      await this.storage.deleteRefreshTokensByAccessToken(token)

      return { success: true }
    } catch (error) {
      console.error('Token revocation error:', error)
      return { success: false }
    }
  }

  // ===== USER INFO =====

  async getUserInfo(token: string): Promise<UserInfoResponse | OAuthError> {
    try {
      const accessToken = await this.storage.getAccessToken(token)
      if (!accessToken || accessToken.expiresAt < new Date()) {
        return { error: 'invalid_token', error_description: 'Invalid or expired token' }
      }

      if (!accessToken.userId) {
        return { error: 'invalid_token', error_description: 'Token does not contain user information' }
      }

      const user = await this.storage.getUser(accessToken.userId)
      if (!user) {
        return { error: 'invalid_token', error_description: 'User not found' }
      }

      return {
        sub: user.id,
        name: user.username,
        email: user.email,
        scope: accessToken.scope
      }
    } catch (error) {
      console.error('User info error:', error)
      return { error: 'server_error', error_description: 'Internal server error' }
    }
  }

  // ===== DYNAMIC CLIENT REGISTRATION (RFC 7591) =====

  async registerClient(request: ClientRegistrationRequest): Promise<ClientRegistrationResponse | OAuthError> {
    try {
      if (!this.config.allowDynamicClientRegistration) {
        return { error: 'access_denied', error_description: 'Dynamic client registration is not supported' }
      }

      // Validate required fields
      if (!request.redirect_uris || request.redirect_uris.length === 0) {
        return { error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }
      }

      // Generate client ID and secret
      const clientId = this.generateClientId()
      const clientSecret = this.generateClientSecret()

      // Create client object
      const client: OAuthClient = {
        id: clientId,
        secret: clientSecret,
        name: request.client_name || `Dynamic Client ${clientId}`,
        type: 'confidential', // Default to confidential for dynamic registration
        redirectUris: request.redirect_uris,
        scopes: request.scope ? request.scope.split(' ') : ['read'],
        grantTypes: request.grant_types || ['authorization_code'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Store client
      await this.storage.createClient(client)

      // Return registration response
      const response: ClientRegistrationResponse = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0, // No expiration for now
        redirect_uris: request.redirect_uris,
        client_name: request.client_name,
        client_uri: request.client_uri,
        logo_uri: request.logo_uri,
        scope: request.scope,
        grant_types: request.grant_types,
        response_types: request.response_types,
        token_endpoint_auth_method: request.token_endpoint_auth_method,
        token_endpoint_auth_signing_alg: request.token_endpoint_auth_signing_alg,
        contacts: request.contacts,
        policy_uri: request.policy_uri,
        terms_of_service_uri: request.terms_of_service_uri,
        jwks_uri: request.jwks_uri,
        jwks: request.jwks,
        software_id: request.software_id,
        software_version: request.software_version
      }

      return response
    } catch (error) {
      console.error('Client registration error:', error)
      return { error: 'server_error', error_description: 'Internal server error' }
    }
  }

  // ===== MCP METADATA ENDPOINTS =====

  getProtectedResourceMetadata(): MCPProtectedResourceMetadata {
    return {
      resource: this.config.serverUrl,
      authorization_servers: [this.config.issuer],
      scopes_supported: [...this.config.supportedScopes],
      bearer_methods_supported: ['Authorization header']
    }
  }

  getAuthorizationServerMetadata(): MCPAuthorizationServerMetadata {
    return {
      issuer: this.config.issuer,
      authorization_endpoint: this.config.authorizationEndpoint,
      token_endpoint: this.config.tokenEndpoint,
      userinfo_endpoint: this.config.userinfoEndpoint,
      jwks_uri: this.config.jwksEndpoint,
      revocation_endpoint: this.config.revocationEndpoint,
      introspection_endpoint: this.config.introspectionEndpoint,
      registration_endpoint: this.config.allowDynamicClientRegistration ? `${this.config.issuer}/register` : undefined,
      grant_types_supported: [...this.config.supportedGrantTypes],
      response_types_supported: [...this.config.supportedResponseTypes],
      scopes_supported: [...this.config.supportedScopes],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: [...this.config.supportedCodeChallengeMethods],
      resource_indicators_supported: this.config.requireResourceIndicator
    }
  }

  // ===== UTILITY METHODS =====

  private generateCode(): string {
    return randomBytes(32).toString('base64url')
  }

  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url')
  }

  private generateClientId(): string {
    return `client_${randomBytes(16).toString('hex')}`
  }

  private generateClientSecret(): string {
    return randomBytes(32).toString('base64url')
  }

  private async generateAccessToken(clientId: string, userId?: string, scope?: string, audience?: string): Promise<AccessToken> {
    const now = Math.floor(Date.now() / 1000)

    const payload: Record<string, any> = {
      iss: this.config.issuer,
      sub: userId || clientId,
      aud: audience || this.config.serverUrl,
      iat: now,
      exp: now + this.config.accessTokenLifetime,
      scope: scope || 'read',
      client_id: clientId,
    }

    const secret = new TextEncoder().encode(this.config.jwtSecret)

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: this.config.jwtAlgorithm || 'HS256' })
      .sign(secret)

    const accessToken: AccessToken = {
      token: jwt,
      clientId,
      userId,
      scope: payload.scope,
      expiresAt: new Date((now + this.config.accessTokenLifetime) * 1000),
      createdAt: new Date(),
      audience: payload.aud,
    }

    await this.storage.createAccessToken(accessToken)
    return accessToken
  }

  private async generateRefreshToken(accessTokenId: string, clientId: string, userId?: string, scope?: string, audience?: string): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + this.config.refreshTokenLifetime * 1000)

    const refreshToken: RefreshToken = {
      token,
      accessTokenId,
      clientId,
      userId,
      scope: scope || 'read',
      expiresAt,
      createdAt: new Date(),
      audience // MCP-specific: store audience for validation
    }

    await this.storage.createRefreshToken(refreshToken)
    return token
  }

  private validateScope(requestedScope: string, allowedScopes: string[]): boolean {
    const requestedScopes = requestedScope.split(' ')
    return requestedScopes.every(scope => allowedScopes.includes(scope))
  }

  // ===== CLEANUP =====

  async cleanup(): Promise<void> {
    await Promise.all([
      this.storage.cleanupExpiredCodes(),
      this.storage.cleanupExpiredTokens(),
      this.storage.cleanupExpiredRefreshTokens()
    ])
  }

  // ===== ADMIN METHODS =====

  async getStats() {
    return this.storage.getStats()
  }

  // Public methods for admin access
  async listClients() {
    return this.storage.listClients()
  }

  async listUsers() {
    return this.storage.listUsers()
  }
} 