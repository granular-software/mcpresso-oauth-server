import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { MCPOAuthServer } from '../src/oauth-server.js'
import { MCPOAuthHttpServer } from '../src/http-server.js'
import { MemoryStorage } from '../src/storage/memory-storage.js'
import { createProductionOAuthServer, createDemoClient } from '../src/index.js'
import type { OAuthUser } from '../src/types.js'
import { createHash } from 'crypto'

// Helper function to generate PKCE challenge
function generatePkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// Helper function to find available port
async function findAvailablePort(startPort: number = 3001): Promise<number> {
  const net = await import('net')
  
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(startPort, () => {
      const port = (server.address() as any).port
      server.close(() => resolve(port))
    })
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1))
    })
  })
}

describe('MCP OAuth Flow Tests', () => {
  let server: any
  let baseUrl: string
  let port: number

  beforeAll(async () => {
    // Find available port
    port = await findAvailablePort()
    baseUrl = `http://localhost:${port}`
    
    // Create production-ready configuration
    const config = createProductionOAuthServer({
      issuer: baseUrl,
      serverUrl: baseUrl,
      requireResourceIndicator: true, // Enable for testing
      jwtSecret: 'test-jwt-secret'
    })
    
    // Initialize storage
    const storage = new MemoryStorage()
    
    // Add demo client and user for testing
    const testClient = createDemoClient()
    const testUser: OAuthUser = {
      id: 'test-user',
      username: 'test@example.com',
      email: 'test@example.com',
      scopes: ['read', 'write'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await storage.createClient(testClient)
    await storage.createUser(testUser)

    // Create OAuth server
    const oauthServer = new MCPOAuthServer(config, storage)
    const httpServer = new MCPOAuthHttpServer(oauthServer, config)

    // Start server
    await httpServer.start(port)
    server = httpServer
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    if (server) {
      // Express server will be closed by process signals
      // No need to manually stop it
    }
  })

  describe('Discovery Endpoints', () => {
    it('should provide OAuth authorization server metadata', async () => {
      const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
      expect(response.status).toBe(200)
      
      const metadata = await response.json()
      expect(metadata.issuer).toBe(baseUrl)
      expect(metadata.authorization_endpoint).toBe(`${baseUrl}/authorize`)
      expect(metadata.token_endpoint).toBe(`${baseUrl}/token`)
      expect(metadata.resource_indicators_supported).toBe(true)
      expect(metadata.code_challenge_methods_supported).toContain('S256')
    })

    it('should provide JWKS endpoint', async () => {
      const response = await fetch(`${baseUrl}/.well-known/jwks.json`)
      expect(response.status).toBe(200)
      
      const jwks = await response.json()
      expect(jwks).toHaveProperty('keys')
    })
  })

  describe('Authorization Code Flow with PKCE', () => {
    it('should require resource indicator parameter', async () => {
      const response = await fetch(`${baseUrl}/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:3002/callback`)
      expect(response.status).toBe(400)
      
      const error = await response.json()
      expect(error.error).toBe('invalid_request')
      expect(error.error_description).toContain('resource parameter is required')
    })

    it('should require PKCE code challenge', async () => {
      const response = await fetch(`${baseUrl}/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:3002/callback&resource=${baseUrl}`)
      expect(response.status).toBe(400)
      
      const error = await response.json()
      expect(error.error).toBe('invalid_request')
      expect(error.error_description).toContain('code_challenge parameter is required')
    })

    it('should successfully create authorization code with valid parameters', async () => {
      const codeVerifier = 'test-verifier-123'
      const codeChallenge = generatePkceChallenge(codeVerifier)
      
      const response = await fetch(
        `${baseUrl}/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:3001/callback&scope=read&resource=${baseUrl}&code_challenge=${codeChallenge}&code_challenge_method=S256`
      )
      
      expect(response.status).toBe(302) // Redirect
      expect(response.headers.get('location')).toContain('code=')
      expect(response.headers.get('location')).toContain('http://localhost:3001/callback')
    })
  })

  describe('Token Exchange', () => {
    let authCode: string
    let accessToken: string
    let refreshToken: string

    beforeAll(async () => {
      // Get authorization code
      const codeVerifier = 'test-verifier-123'
      const codeChallenge = generatePkceChallenge(codeVerifier)
      
      const authResponse = await fetch(
        `${baseUrl}/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:3001/callback&scope=read&resource=${baseUrl}&code_challenge=${codeChallenge}&code_challenge_method=S256`
      )
      
      const location = authResponse.headers.get('location')!
      const url = new URL(location)
      authCode = url.searchParams.get('code')!
    })

    it('should require resource indicator in token request', async () => {
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          code: authCode,
          redirect_uri: 'http://localhost:3001/callback',
          code_verifier: 'test-verifier-123'
        })
      })
      
      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error.error).toBe('invalid_request')
      expect(error.error_description).toContain('resource parameter is required')
    })

    it('should successfully exchange authorization code for tokens', async () => {
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          code: authCode,
          redirect_uri: 'http://localhost:3001/callback',
          resource: baseUrl,
          code_verifier: 'test-verifier-123'
        })
      })
      
      expect(response.status).toBe(200)
      const tokenResponse = await response.json()
      
      expect(tokenResponse).toHaveProperty('access_token')
      expect(tokenResponse).toHaveProperty('token_type', 'Bearer')
      expect(tokenResponse).toHaveProperty('expires_in')
      expect(tokenResponse).toHaveProperty('scope')
      
      accessToken = tokenResponse.access_token
      refreshToken = tokenResponse.refresh_token
    })

    it('should validate PKCE code verifier', async () => {
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          code: authCode,
          redirect_uri: 'http://localhost:3001/callback',
          resource: baseUrl,
          code_verifier: 'wrong-verifier'
        })
      })
      
      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error.error).toBe('invalid_grant')
      expect(error.error_description).toContain('Invalid code verifier')
    })
  })

  describe('Token Introspection', () => {
    let testToken: string

    beforeAll(async () => {
      // Get a token for testing
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          resource: baseUrl
        })
      })
      
      const tokenResponse = await response.json()
      testToken = tokenResponse.access_token
    })

    it('should successfully introspect valid token', async () => {
      const response = await fetch(`${baseUrl}/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: testToken })
      })
      
      expect(response.status).toBe(200)
      const introspection = await response.json()
      
      expect(introspection.active).toBe(true)
      expect(introspection).toHaveProperty('client_id')
      expect(introspection).toHaveProperty('exp')
      expect(introspection).toHaveProperty('aud', baseUrl)
    })

    it('should return inactive for invalid token', async () => {
      const response = await fetch(`${baseUrl}/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token' })
      })
      
      expect(response.status).toBe(200)
      const introspection = await response.json()
      
      expect(introspection.active).toBe(false)
    })
  })

  describe('User Info', () => {
    let testToken: string

    beforeAll(async () => {
      // Get a token with user context
      const codeVerifier = 'user-verifier-123'
      const codeChallenge = generatePkceChallenge(codeVerifier)
      
      const authResponse = await fetch(
        `${baseUrl}/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:3001/callback&scope=read&resource=${baseUrl}&code_challenge=${codeChallenge}&code_challenge_method=S256`
      )
      
      const location = authResponse.headers.get('location')!
      const url = new URL(location)
      const authCode = url.searchParams.get('code')!
      
      const tokenResponse = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          code: authCode,
          redirect_uri: 'http://localhost:3001/callback',
          resource: baseUrl,
          code_verifier: 'user-verifier-123'
        })
      })
      
      const tokens = await tokenResponse.json()
      testToken = tokens.access_token
    })

    it('should return user info for valid token', async () => {
      const response = await fetch(`${baseUrl}/userinfo`, {
        headers: { 'Authorization': `Bearer ${testToken}` }
      })
      
      expect(response.status).toBe(200)
      const userInfo = await response.json()
      
      expect(userInfo).toHaveProperty('sub')
      expect(userInfo).toHaveProperty('name')
      expect(userInfo).toHaveProperty('email')
    })

    it('should reject invalid token', async () => {
      const response = await fetch(`${baseUrl}/userinfo`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      })
      
      expect(response.status).toBe(401)
      const error = await response.json()
      expect(error.error).toBe('invalid_token')
    })
  })

  describe('Token Revocation', () => {
    let testToken: string

    beforeAll(async () => {
      // Get a token for testing
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          resource: baseUrl
        })
      })
      
      const tokenResponse = await response.json()
      testToken = tokenResponse.access_token
    })

    it('should successfully revoke token', async () => {
      const response = await fetch(`${baseUrl}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: testToken,
          client_id: 'demo-client'
        })
      })
      
      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
    })

    it('should return inactive for revoked token', async () => {
      const response = await fetch(`${baseUrl}/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: testToken })
      })
      
      expect(response.status).toBe(200)
      const introspection = await response.json()
      expect(introspection.active).toBe(false)
    })
  })

  describe('Client Credentials Flow', () => {
    it('should require resource indicator in client credentials flow', async () => {
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'demo-client',
          client_secret: 'demo-secret'
        })
      })
      
      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error.error).toBe('invalid_request')
      expect(error.error_description).toContain('resource parameter is required')
    })

    it('should successfully issue access token for client credentials', async () => {
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          resource: baseUrl
        })
      })
      
      expect(response.status).toBe(200)
      const tokenResponse = await response.json()
      
      expect(tokenResponse).toHaveProperty('access_token')
      expect(tokenResponse).toHaveProperty('token_type', 'Bearer')
      expect(tokenResponse).toHaveProperty('expires_in')
      expect(tokenResponse).toHaveProperty('scope')
    })
  })

  describe('Dynamic Client Registration', () => {
    it('should register new client', async () => {
      const response = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: ['http://localhost:3003/callback'],
          client_name: 'Test Registration Client',
          scope: 'read write'
        })
      })
      
      expect(response.status).toBe(201)
      const client = await response.json()
      
      expect(client).toHaveProperty('client_id')
      expect(client).toHaveProperty('client_secret')
      expect(client).toHaveProperty('redirect_uris')
      expect(client.redirect_uris).toContain('http://localhost:3003/callback')
    })
  })

  describe('Health and Admin Endpoints', () => {
    it('should provide health check', async () => {
      const response = await fetch(`${baseUrl}/health`)
      expect(response.status).toBe(200)
      
      const health = await response.json()
      expect(health.status).toBe('ok')
      expect(health.service).toBe('mcp-oauth-server')
    })

    it('should list clients', async () => {
      const response = await fetch(`${baseUrl}/admin/clients`)
      expect(response.status).toBe(200)
      
      const clients = await response.json()
      expect(clients.length).toBeGreaterThan(0)
      expect(clients[0].id).toBe('demo-client')
    })

    it('should list users', async () => {
      const response = await fetch(`${baseUrl}/admin/users`)
      expect(response.status).toBe(200)
      
      const users = await response.json()
      expect(users.length).toBeGreaterThan(0)
      expect(users[0].id).toBe('test-user')
    })

    it('should provide server statistics', async () => {
      const response = await fetch(`${baseUrl}/admin/stats`)
      expect(response.status).toBe(200)
      
      const stats = await response.json()
      expect(stats).toHaveProperty('clients')
      expect(stats).toHaveProperty('users')
      expect(stats).toHaveProperty('authorizationCodes')
      expect(stats).toHaveProperty('accessTokens')
      expect(stats).toHaveProperty('refreshTokens')
    })
  })
}) 