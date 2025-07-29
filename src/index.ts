/**
 * Production-ready OAuth 2.1 Server Package
 * 
 * A complete OAuth 2.1 implementation with PKCE support for Model Context Protocol (MCP)
 * 
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
 * @see https://modelcontextprotocol.io/specification/draft/basic/authorization
 */

// Core OAuth server
export { MCPOAuthServer } from './oauth-server.js'
export { MCPOAuthHttpServer } from './http-server.js'

// Storage implementations
export { MemoryStorage } from './storage/memory-storage.js'

// Utilities
export * from './utils/pkce.js'
export * from './utils/tokens.js'

// Types and interfaces
export * from './types.js'

// Default configuration for production use
export const DEFAULT_OAUTH_CONFIG = {
  // Server configuration
  issuer: process.env.OAUTH_ISSUER || 'http://localhost:3000',
  serverUrl: process.env.OAUTH_SERVER_URL || 'http://localhost:3000',
  
  // Endpoints
  authorizationEndpoint: '/authorize',
  tokenEndpoint: '/token',
  userinfoEndpoint: '/userinfo',
  jwksEndpoint: '/.well-known/jwks.json',
  revocationEndpoint: '/revoke',
  introspectionEndpoint: '/introspect',
  
  // MCP-specific settings
  requireResourceIndicator: false, // Made optional for easier development
  requirePkce: true,
  allowRefreshTokens: true,
  
  // Dynamic client registration
  allowDynamicClientRegistration: true,
  
  // Token lifetimes (in seconds)
  accessTokenLifetime: 3600, // 1 hour
  refreshTokenLifetime: 2592000, // 30 days
  authorizationCodeLifetime: 600, // 10 minutes
  
  // Supported features
  supportedGrantTypes: [
    'authorization_code',
    'refresh_token',
    'client_credentials'
  ],
  supportedResponseTypes: ['code'],
  supportedScopes: [
    'read',
    'write',
    'admin',
    'openid',
    'profile',
    'email'
  ],
  supportedCodeChallengeMethods: ['S256', 'plain'],
  
  // Security
  jwtSecret: process.env.OAUTH_JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtAlgorithm: 'HS256',
  
  // HTTP server configuration
  http: {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
      credentials: true,
      exposedHeaders: ["mcp-session-id"],
      allowedHeaders: ["Content-Type", "mcp-session-id", "accept", "last-event-id", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    },
    trustProxy: process.env.TRUST_PROXY === 'true',
    jsonLimit: '10mb',
    urlencodedLimit: '10mb',
    enableCompression: true,
    enableHelmet: true,
    enableRateLimit: true,
    rateLimitConfig: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }
  }
}

/**
 * Create a production-ready OAuth server with proper configuration
 */
export function createProductionOAuthServer(config: Partial<typeof DEFAULT_OAUTH_CONFIG> = {}) {
  const finalConfig = { ...DEFAULT_OAUTH_CONFIG, ...config }
  
  // Ensure serverUrl is properly set
  if (!finalConfig.serverUrl) {
    finalConfig.serverUrl = finalConfig.issuer
  }
  
  // Build full endpoint URLs
  const baseUrl = finalConfig.serverUrl.replace(/\/$/, '')
  finalConfig.authorizationEndpoint = `${baseUrl}${finalConfig.authorizationEndpoint}`
  finalConfig.tokenEndpoint = `${baseUrl}${finalConfig.tokenEndpoint}`
  finalConfig.userinfoEndpoint = `${baseUrl}${finalConfig.userinfoEndpoint}`
  finalConfig.jwksEndpoint = `${baseUrl}${finalConfig.jwksEndpoint}`
  finalConfig.revocationEndpoint = `${baseUrl}${finalConfig.revocationEndpoint}`
  finalConfig.introspectionEndpoint = `${baseUrl}${finalConfig.introspectionEndpoint}`
  
  return finalConfig
}

/**
 * Create a demo client for testing
 */
export function createDemoClient() {
  return {
    id: 'demo-client',
    secret: 'demo-secret',
    name: 'Demo Client',
    type: 'confidential' as const,
    redirectUris: ['http://localhost:3001/callback'],
    scopes: ['read', 'write', 'admin'],
    grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
} 