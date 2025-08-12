// MCP OAuth 2.1 Types - Focused on Model Context Protocol requirements
// Based on: https://modelcontextprotocol.io/specification/draft/basic/authorization

import type { CorsOptions } from 'cors'

export interface OAuthClient {
  id: string
  secret?: string // Optional for public clients
  name: string
  type: 'confidential' | 'public'
  redirectUris: string[]
  scopes: string[]
  grantTypes: string[]
  createdAt: Date
  updatedAt: Date
}

export interface OAuthUser {
  id: string
  username: string
  email?: string
  scopes: string[]
  createdAt: Date
  updatedAt: Date
  // Add optional custom properties for extended user data
  [key: string]: any
}

// User authentication context passed to authentication callbacks
export interface UserAuthContext {
  clientId: string
  scope?: string
  resource?: string
  redirectUri: string
  ipAddress: string
  userAgent?: string
}

// User authentication callbacks for custom login logic
export interface UserAuthCallbacks {
  /**
   * Authenticate a user by username/email and password.
   * This callback is invoked when the user submits their credentials.
   * 
   * @param credentials - The user's login credentials
   * @param context - Authentication context (client, scope, etc.)
   * @returns Promise<OAuthUser | null> - The authenticated user or null if invalid
   */
  authenticateUser?: (
    credentials: { username: string; password: string },
    context: UserAuthContext
  ) => Promise<OAuthUser | null>

  /**
   * Get the currently authenticated user from session/context.
   * This callback is invoked during the authorization flow to determine
   * if a user is already logged in.
   * 
   * @param sessionData - Session data (cookies, tokens, etc.)
   * @param context - Authentication context
   * @returns Promise<OAuthUser | null> - The current user or null if not authenticated
   */
  getCurrentUser?: (
    sessionData: any,
    context: UserAuthContext
  ) => Promise<OAuthUser | null>

  /**
   * Render or redirect to a custom login page.
   * If not provided, a basic HTML login form will be used.
   * 
   * @param context - Authentication context
   * @param error - Optional error message to display
   * @returns Promise<string | { redirect: string }> - HTML content or redirect info
   */
  renderLoginPage?: (
    context: UserAuthContext,
    error?: string
  ) => Promise<string | { redirect: string }>

  /**
   * Render or redirect to a custom consent/authorization page.
   * If not provided, automatic consent will be granted.
   * 
   * @param user - The authenticated user
   * @param context - Authentication context
   * @returns Promise<boolean | string | { redirect: string }> - Consent result or custom page
   */
  renderConsentPage?: (
    user: OAuthUser,
    context: UserAuthContext
  ) => Promise<boolean | string | { redirect: string }>
}

export interface AuthorizationCode {
  code: string
  clientId: string
  userId: string
  redirectUri: string
  scope: string
  resource?: string;
  codeChallenge?: string
  codeChallengeMethod?: 'S256' | 'plain'
  expiresAt: Date
  createdAt: Date
}

export interface AccessToken {
  token: string
  clientId: string
  userId?: string // Optional for client credentials flow
  scope: string
  expiresAt: Date
  createdAt: Date
  // MCP-specific: Resource indicator for audience binding
  audience?: string
}

export interface RefreshToken {
  token: string
  accessTokenId: string
  clientId: string
  userId?: string
  scope: string
  expiresAt: Date
  createdAt: Date
  // MCP-specific: Resource indicator for audience binding
  audience?: string
}

// MCP OAuth Request/Response Types
export interface AuthorizationRequest {
  response_type: 'code'
  client_id: string
  redirect_uri: string
  scope?: string
  state?: string
  // MCP-specific: Resource indicator (REQUIRED)
  resource: string
  // PKCE (REQUIRED for MCP)
  code_challenge: string
  code_challenge_method: 'S256' | 'plain'
}

export interface TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token' | 'client_credentials'
  client_id: string
  client_secret?: string
  code?: string
  redirect_uri?: string
  refresh_token?: string
  scope?: string
  // MCP-specific: Resource indicator (REQUIRED)
  resource: string
  // PKCE verification (REQUIRED for authorization_code)
  code_verifier?: string
}

export type TokenType = 'Bearer'
export type CodeChallengeMethod = 'S256' | 'plain'

export interface TokenResponse {
  access_token: string
  token_type: TokenType
  expires_in: number
  refresh_token?: string
  scope: string
}

export interface TokenIntrospectionResponse {
  active: boolean
  scope?: string
  client_id?: string
  username?: string
  exp?: number
  aud?: string // MCP-specific: audience validation
}

export interface UserInfoResponse {
  sub: string
  name?: string
  email?: string
  scope?: string
}

// Dynamic Client Registration (RFC 7591)
export interface ClientRegistrationRequest {
  redirect_uris: string[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
  scope?: string
  grant_types?: string[]
  response_types?: string[]
  token_endpoint_auth_method?: string
  token_endpoint_auth_signing_alg?: string
  contacts?: string[]
  policy_uri?: string
  terms_of_service_uri?: string
  jwks_uri?: string
  jwks?: any
  software_id?: string
  software_version?: string
}

export interface ClientRegistrationResponse {
  client_id: string
  client_secret?: string
  client_id_issued_at?: number
  client_secret_expires_at?: number
  redirect_uris: string[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
  scope?: string
  grant_types?: string[]
  response_types?: string[]
  token_endpoint_auth_method?: string
  token_endpoint_auth_signing_alg?: string
  contacts?: string[]
  policy_uri?: string
  terms_of_service_uri?: string
  jwks_uri?: string
  jwks?: any
  software_id?: string
  software_version?: string
}

// MCP OAuth Error Types
export interface OAuthError {
  error: string
  error_description?: string
  error_uri?: string
  state?: string
}

// HTTP Server Configuration
export interface HTTPServerConfig {
  cors?: CorsOptions
  trustProxy?: boolean | string | string[] | number
  jsonLimit?: string
  urlencodedLimit?: string
  enableCompression?: boolean
  enableHelmet?: boolean
  enableRateLimit?: boolean
  rateLimitConfig?: {
    windowMs?: number
    max?: number
    message?: string
    standardHeaders?: boolean
    legacyHeaders?: boolean
  }
}

/**
 * Configuration for the MCP OAuth 2.1 Server.
 *
 * @property issuer - The OAuth 2.1 issuer URL (should be the public base URL of your auth server). Example: 'https://auth.example.com'.
 * @property serverUrl - The public base URL of your OAuth server (used for discovery and resource indicators).
 * @property authorizationEndpoint - Full URL to the /authorize endpoint. Example: 'https://auth.example.com/authorize'.
 * @property tokenEndpoint - Full URL to the /token endpoint.
 * @property userinfoEndpoint - Full URL to the /userinfo endpoint.
 * @property jwksEndpoint - Full URL to the JWKS endpoint.
 * @property introspectionEndpoint - Full URL to the /introspect endpoint.
 * @property revocationEndpoint - Full URL to the /revoke endpoint.
 * @property requireResourceIndicator - If true, the 'resource' parameter is required in all auth/token requests (MCP best practice). Default: true for MCP, false for dev.
 * @property requirePkce - If true, PKCE is required for all authorization code flows. Default: true (MCP requirement).
 * @property allowRefreshTokens - If true, refresh tokens are issued and accepted. Default: true.
 * @property allowDynamicClientRegistration - If true, clients can register via the /register endpoint (RFC 7591). Default: true for dev, false for prod.
 * @property accessTokenLifetime - Access token lifetime in seconds. Default: 3600 (1 hour).
 * @property refreshTokenLifetime - Refresh token lifetime in seconds. Default: 2592000 (30 days).
 * @property authorizationCodeLifetime - Authorization code lifetime in seconds. Default: 600 (10 minutes).
 * @property supportedGrantTypes - List of supported OAuth grant types. Example: ['authorization_code', 'refresh_token', 'client_credentials'].
 * @property supportedResponseTypes - List of supported OAuth response types. Example: ['code'].
 * @property supportedScopes - List of supported scopes. Example: ['read', 'write', 'admin'].
 * @property supportedCodeChallengeMethods - Supported PKCE code challenge methods. Example: ['S256', 'plain'].
 * @property jwtSecret - Secret for signing JWTs (use a strong, random value in production!).
 * @property jwtAlgorithm - JWT signing algorithm. Example: 'HS256'.
 * @property http - HTTP server configuration (CORS, rate limiting, etc). See HTTPServerConfig.
 */
export interface MCPOAuthConfig {
  /** OAuth 2.1 issuer URL (public base URL of your auth server). */
  issuer: string
  /** Public base URL of your OAuth server (used for discovery and resource indicators). */
  serverUrl: string
  /** Full URL to the /authorize endpoint. */
  authorizationEndpoint: string
  /** Full URL to the /token endpoint. */
  tokenEndpoint: string
  /** Full URL to the /userinfo endpoint. */
  userinfoEndpoint: string
  /** Full URL to the JWKS endpoint. */
  jwksEndpoint: string
  /** Full URL to the /introspect endpoint. */
  introspectionEndpoint: string
  /** Full URL to the /revoke endpoint. */
  revocationEndpoint: string
  /** Require 'resource' parameter in all auth/token requests (MCP best practice). */
  requireResourceIndicator: boolean
  /** Require PKCE for all authorization code flows (MCP requirement). */
  requirePkce: boolean
  /** Issue and accept refresh tokens. */
  allowRefreshTokens: boolean
  /** Allow dynamic client registration via /register (RFC 7591). */
  allowDynamicClientRegistration: boolean
  /** Access token lifetime in seconds. */
  accessTokenLifetime: number
  /** Refresh token lifetime in seconds. */
  refreshTokenLifetime: number
  /** Authorization code lifetime in seconds. */
  authorizationCodeLifetime: number
  /** Supported OAuth grant types. */
  supportedGrantTypes: readonly string[]
  /** Supported OAuth response types. */
  supportedResponseTypes: readonly string[]
  /** Supported scopes. */
  supportedScopes: readonly string[]
  /** Supported PKCE code challenge methods. */
  supportedCodeChallengeMethods: readonly string[]
  /** Secret for signing JWTs (use a strong, random value in production!). */
  jwtSecret: string
  /** JWT signing algorithm. */
  jwtAlgorithm: string
  /** HTTP server configuration (CORS, rate limiting, etc). */
  http?: HTTPServerConfig
  /** User authentication callbacks for custom login logic. */
  auth?: UserAuthCallbacks
}

/**
 * Input type for MCPOAuthServer: only issuer, serverUrl, and jwtSecret are required, all others are optional.
 */
export type MCPOAuthConfigInput = Pick<MCPOAuthConfig, 'issuer' | 'serverUrl' | 'jwtSecret'> & Partial<Omit<MCPOAuthConfig, 'issuer' | 'serverUrl' | 'jwtSecret'>>;

/**
 * HTTP server configuration for the MCP OAuth server.
 *
 * @property cors - CORS configuration (see 'cors' package for options).
 * @property trustProxy - Trust proxy headers (true if behind a reverse proxy).
 * @property jsonLimit - Max JSON body size (e.g. '10mb').
 * @property urlencodedLimit - Max urlencoded body size (e.g. '10mb').
 * @property enableCompression - Enable gzip compression. Default: true.
 * @property enableHelmet - Enable helmet security headers. Default: true.
 * @property enableRateLimit - Enable rate limiting. Default: true.
 * @property rateLimitConfig - Rate limiting options (windowMs, max, etc).
 */
export interface HTTPServerConfig {
  /** CORS configuration (see 'cors' package for options). */
  cors?: import('cors').CorsOptions
  /** Trust proxy headers (true if behind a reverse proxy). */
  trustProxy?: boolean | string | string[] | number
  /** Max JSON body size (e.g. '10mb'). */
  jsonLimit?: string
  /** Max urlencoded body size (e.g. '10mb'). */
  urlencodedLimit?: string
  /** Enable gzip compression. Default: true. */
  enableCompression?: boolean
  /** Enable helmet security headers. Default: true. */
  enableHelmet?: boolean
  /** Enable rate limiting. Default: true. */
  enableRateLimit?: boolean
  /** Rate limiting options (windowMs, max, etc). */
  rateLimitConfig?: {
    /** Time window in ms. Default: 15 minutes. */
    windowMs?: number
    /** Max requests per window. Default: 100. */
    max?: number
    /** Message to return when rate limited. */
    message?: string
    /** Use standard rate limit headers. */
    standardHeaders?: boolean
    /** Use legacy rate limit headers. */
    legacyHeaders?: boolean
  }
}

// MCP Protected Resource Metadata (RFC 9728)
export interface MCPProtectedResourceMetadata {
  resource: string
  authorization_servers: string[]
  scopes_supported?: string[]
  bearer_methods_supported?: string[]
}

// MCP Authorization Server Metadata (RFC 8414)
export interface MCPAuthorizationServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  jwks_uri: string
  revocation_endpoint?: string
  introspection_endpoint?: string
  registration_endpoint?: string // Dynamic client registration
  grant_types_supported: string[]
  response_types_supported: string[]
  scopes_supported: string[]
  token_endpoint_auth_methods_supported: string[]
  code_challenge_methods_supported: string[]
  resource_indicators_supported?: boolean
}

// Storage interface for MCP OAuth server
export interface MCPOAuthStorage {
  // Client management
  createClient(client: OAuthClient): Promise<void>
  getClient(clientId: string): Promise<OAuthClient | null>
  listClients(): Promise<OAuthClient[]>
  updateClient(clientId: string, updates: Partial<OAuthClient>): Promise<void>
  deleteClient(clientId: string): Promise<void>
  
  // User management
  createUser(user: OAuthUser): Promise<void>
  getUser(userId: string): Promise<OAuthUser | null>
  getUserByUsername(username: string): Promise<OAuthUser | null>
  listUsers(): Promise<OAuthUser[]>
  updateUser(userId: string, updates: Partial<OAuthUser>): Promise<void>
  deleteUser(userId: string): Promise<void>
  
  // Authorization codes
  createAuthorizationCode(code: AuthorizationCode): Promise<void>
  getAuthorizationCode(code: string): Promise<AuthorizationCode | null>
  deleteAuthorizationCode(code: string): Promise<void>
  cleanupExpiredCodes(): Promise<void>
  
  // Access tokens
  createAccessToken(token: AccessToken): Promise<void>
  getAccessToken(token: string): Promise<AccessToken | null>
  deleteAccessToken(token: string): Promise<void>
  cleanupExpiredTokens(): Promise<void>
  
  // Refresh tokens
  createRefreshToken(token: RefreshToken): Promise<void>
  getRefreshToken(token: string): Promise<RefreshToken | null>
  deleteRefreshToken(token: string): Promise<void>
  deleteRefreshTokensByAccessToken(accessTokenId: string): Promise<void>
  cleanupExpiredRefreshTokens(): Promise<void>
  
  // Utility methods
  getStats(): {
    clients: number
    users: number
    authorizationCodes: number
    accessTokens: number
    refreshTokens: number
  }
} 