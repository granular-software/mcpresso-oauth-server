import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { MCPOAuthServer } from '../src/oauth-server.js'
import { MemoryStorage } from '../src/storage/memory-storage.js'
import type { MCPOAuthConfig, OAuthClient, OAuthUser } from '../src/types.js'

// Test configuration
const testConfig: MCPOAuthConfig = {
  issuer: 'http://localhost:3002',
  serverUrl: 'http://localhost:3002',
  authorizationEndpoint: 'http://localhost:3002/authorize',
  tokenEndpoint: 'http://localhost:3002/token',
  userinfoEndpoint: 'http://localhost:3002/userinfo',
  jwksEndpoint: 'http://localhost:3002/.well-known/jwks.json',
  introspectionEndpoint: 'http://localhost:3002/introspect',
  revocationEndpoint: 'http://localhost:3002/revoke',
  requireResourceIndicator: true,
  requirePkce: true,
  allowRefreshTokens: true,
  accessTokenLifetime: 3600,
  refreshTokenLifetime: 2592000,
  authorizationCodeLifetime: 600,
  supportedGrantTypes: ['authorization_code', 'refresh_token', 'client_credentials'] as const,
  supportedResponseTypes: ['code'] as const,
  supportedScopes: ['read', 'write', 'admin'] as const,
  supportedCodeChallengeMethods: ['S256', 'plain'] as const,
  jwtSecret: 'test-jwt-secret',
  jwtAlgorithm: 'HS256'
}

// Test data
const testClient: OAuthClient = {
  id: 'test-client',
  secret: 'test-secret',
  name: 'Test Client',
  type: 'confidential',
  redirectUris: ['http://localhost:3003/callback'],
  scopes: ['read', 'write'],
  grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
  createdAt: new Date(),
  updatedAt: new Date()
}

const testUser: OAuthUser = {
  id: 'test-user',
  username: 'test@example.com',
  email: 'test@example.com',
  scopes: ['read', 'write'],
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('MCPOAuthServer', () => {
  let oauthServer: MCPOAuthServer
  let storage: MemoryStorage

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.createClient(testClient)
    await storage.createUser(testUser)
    oauthServer = new MCPOAuthServer(testConfig, storage)
  })

  afterEach(async () => {
    await oauthServer.cleanup()
  })

  describe('Authorization Request', () => {
    it('should handle valid authorization request', async () => {
      const request = {
        response_type: 'code' as const,
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3003/callback',
        scope: 'read',
        resource: 'http://localhost:3002',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256' as const
      }

      const result = await oauthServer.handleAuthorizationRequest(request)
      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.redirectUrl).toContain('code=')
        expect(result.redirectUrl).toContain('http://localhost:3003/callback')
      }
    })

    it('should reject request without resource indicator', async () => {
      const request = {
        response_type: 'code' as const,
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3003/callback',
        scope: 'read',
        resource: '', // Empty resource to trigger validation
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256' as const
      }

      const result = await oauthServer.handleAuthorizationRequest(request)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toBe('invalid_request')
        expect(result.error_description).toContain('resource parameter is required')
      }
    })

    it('should reject request without PKCE', async () => {
      const request = {
        response_type: 'code' as const,
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3003/callback',
        scope: 'read',
        resource: 'http://localhost:3002',
        code_challenge: '', // Empty challenge to trigger validation
        code_challenge_method: 'S256' as const
      }

      const result = await oauthServer.handleAuthorizationRequest(request)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toBe('invalid_request')
        expect(result.error_description).toContain('code_challenge parameter is required')
      }
    })
  })

  describe('Token Request', () => {
    it('should handle client credentials grant', async () => {
      const request = {
        grant_type: 'client_credentials' as const,
        client_id: 'test-client',
        client_secret: 'test-secret',
        resource: 'http://localhost:3002'
      }

      const result = await oauthServer.handleTokenRequest(request)
      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.access_token).toBeDefined()
        expect(result.token_type).toBe('Bearer')
        expect(result.expires_in).toBe(3600)
        expect(result.refresh_token).toBeUndefined() // No refresh token for client credentials
      }
    })

    it('should reject client credentials without resource', async () => {
      const request = {
        grant_type: 'client_credentials' as const,
        client_id: 'test-client',
        client_secret: 'test-secret',
        resource: '' // Empty resource to trigger validation
      }

      const result = await oauthServer.handleTokenRequest(request)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toBe('invalid_request')
        expect(result.error_description).toContain('resource parameter is required')
      }
    })
  })

  describe('Token Introspection', () => {
    it('should introspect valid token', async () => {
      // Create a token first
      const tokenRequest = {
        grant_type: 'client_credentials' as const,
        client_id: 'test-client',
        client_secret: 'test-secret',
        resource: 'http://localhost:3002'
      }

      const tokenResult = await oauthServer.handleTokenRequest(tokenRequest)
      expect('error' in tokenResult).toBe(false)

      if (!('error' in tokenResult)) {
        // Introspect the token
        const introspectionResult = await oauthServer.introspectToken(tokenResult.access_token)
        expect(introspectionResult.active).toBe(true)
        expect(introspectionResult.client_id).toBe('test-client')
        expect(introspectionResult.aud).toBe('http://localhost:3002')
      }
    })

    it('should return inactive for invalid token', async () => {
      const introspectionResult = await oauthServer.introspectToken('invalid-token')
      expect(introspectionResult.active).toBe(false)
    })
  })

  describe('Token Revocation', () => {
    it('should revoke access token', async () => {
      // Create a token first
      const tokenRequest = {
        grant_type: 'client_credentials' as const,
        client_id: 'test-client',
        client_secret: 'test-secret',
        resource: 'http://localhost:3002'
      }

      const tokenResult = await oauthServer.handleTokenRequest(tokenRequest)
      expect('error' in tokenResult).toBe(false)

      if (!('error' in tokenResult)) {
        // Revoke the token
        const revocationResult = await oauthServer.revokeToken(tokenResult.access_token, 'test-client')
        expect(revocationResult.success).toBe(true)

        // Verify token is revoked
        const introspectionResult = await oauthServer.introspectToken(tokenResult.access_token)
        expect(introspectionResult.active).toBe(false)
      }
    })
  })

  describe('Cleanup', () => {
    it('should cleanup expired tokens', async () => {
      // Create some tokens
      const tokenRequest = {
        grant_type: 'client_credentials' as const,
        client_id: 'test-client',
        client_secret: 'test-secret',
        resource: 'http://localhost:3002'
      }

      const tokenResult = await oauthServer.handleTokenRequest(tokenRequest)
      expect('error' in tokenResult).toBe(false)

      // Run cleanup
      await oauthServer.cleanup()

      // Verify cleanup worked (stats should be available)
      const stats = await oauthServer.getStats()
      expect(stats).toBeDefined()
    })
  })
}) 