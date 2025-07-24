#!/usr/bin/env bun

/**
 * MCP OAuth Server Integration with mcpresso
 * 
 * This example demonstrates how to:
 * 1. Start the MCP OAuth server
 * 2. Create a mcpresso server with OAuth authentication
 * 3. Test the complete OAuth flow
 */

import { createMCPServer, createResource } from 'mcpresso'
import { z } from 'zod'
import { MCPOAuthServer } from '../src/oauth-server.js'
import { MCPOAuthHttpServer } from '../src/http-server.js'
import { MemoryStorage } from '../src/storage/memory-storage.js'
import type { MCPOAuthConfig, OAuthClient, OAuthUser } from '../src/types.js'
import { createHash } from 'crypto'

// ===== MCP OAuth Server Setup =====

const oauthConfig: MCPOAuthConfig = {
  issuer: 'http://localhost:3000',
  serverUrl: 'http://localhost:3000',
  authorizationEndpoint: 'http://localhost:3000/authorize',
  tokenEndpoint: 'http://localhost:3000/token',
  userinfoEndpoint: 'http://localhost:3000/userinfo',
  jwksEndpoint: 'http://localhost:3000/.well-known/jwks.json',
  introspectionEndpoint: 'http://localhost:3000/introspect',
  revocationEndpoint: 'http://localhost:3000/revoke',
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
  jwtSecret: 'your-super-secret-jwt-key-change-in-production',
  jwtAlgorithm: 'HS256',
  allowDynamicClientRegistration: true
}

// Demo data
const demoClient: OAuthClient = {
  id: 'mcpresso-client',
  secret: 'mcpresso-secret',
  name: 'MCPresso Integration Client',
  type: 'confidential',
  redirectUris: ['http://localhost:3002/callback'],
  scopes: ['read', 'write'],
  grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
  createdAt: new Date(),
  updatedAt: new Date()
}

const demoUser: OAuthUser = {
  id: 'demo-user',
  username: 'demo@example.com',
  email: 'demo@example.com',
  scopes: ['read', 'write'],
  createdAt: new Date(),
  updatedAt: new Date()
}

// ===== MCPresso Server Setup =====

// Define a simple user resource
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.date(),
  updatedAt: z.date()
})

const userResource = createResource({
  name: "user",
  schema: UserSchema,
  uri_template: "users/{id}",
  methods: {
    get: {
      handler: async ({ id }: { id: string }) => {
        // In a real app, you'd fetch from database
        return {
          id,
          name: "Demo User",
          email: "demo@example.com",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
    },
    create: {
      handler: async (data: any) => {
        return {
          id: `user-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
    },
    list: {
      handler: async () => {
        return [
          {
            id: "user-1",
            name: "Demo User",
            email: "demo@example.com",
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      },
    },
  },
})

// Create mcpresso server with OAuth authentication
const mcpressoServer = createMCPServer({
  name: "oauth_demo_server",
  serverUrl: "http://localhost:3001",
  resources: [userResource],
  exposeTypes: true,
  auth: {
    issuer: "http://localhost:3000",
    serverUrl: "http://localhost:3001",
    requireResourceIndicator: true,
    validateAudience: true
  },
  serverMetadata: {
    name: "OAuth Demo Server",
    version: "1.0.0",
    description: "A mcpresso server with MCP OAuth authentication",
    url: "http://localhost:3001",
    capabilities: {
      authentication: true,
      rateLimiting: false,
      retries: false,
      streaming: true,
    },
  },
})

// ===== Helper Functions =====

function generatePkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

async function testOAuthFlow() {
  console.log('🧪 Testing OAuth Flow...')
  
  // Step 1: Get authorization code
  const codeVerifier = 'test-verifier-123'
  const codeChallenge = generatePkceChallenge(codeVerifier)
  
  const authUrl = `http://localhost:3000/authorize?response_type=code&client_id=mcpresso-client&redirect_uri=http://localhost:3002/callback&scope=read&resource=http://localhost:3001&code_challenge=${codeChallenge}&code_challenge_method=S256`
  
  console.log('1. Authorization URL:', authUrl)
  console.log('   (In a real app, user would be redirected here)')
  
  const authResponse = await fetch(authUrl)
  const location = authResponse.headers.get('location')!
  const url = new URL(location)
  const authCode = url.searchParams.get('code')!
  
  console.log('2. Authorization Code:', authCode)
  
  // Step 2: Exchange code for tokens
  const tokenResponse = await fetch('http://localhost:3000/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'mcpresso-client',
      client_secret: 'mcpresso-secret',
      code: authCode,
      redirect_uri: 'http://localhost:3002/callback',
      resource: 'http://localhost:3001',
      code_verifier: codeVerifier
    })
  })
  
  const tokens = await tokenResponse.json()
  console.log('3. Access Token:', tokens.access_token.substring(0, 20) + '...')
  
  // Step 3: Use token with mcpresso server
  const mcpressoResponse = await fetch('http://localhost:3001', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.access_token}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    })
  })
  
  const mcpressoResult = await mcpressoResponse.json()
  console.log('4. MCPresso Response:', mcpressoResult)
  
  return tokens.access_token
}

// ===== Main Function =====

async function main() {
  console.log('🚀 Starting MCP OAuth + MCPresso Integration Demo...')
  console.log('')

  // Initialize OAuth server
  const storage = new MemoryStorage()
  await storage.createClient(demoClient)
  await storage.createUser(demoUser)
  
  const oauthServer = new MCPOAuthServer(oauthConfig, storage)
  const oauthHttpServer = new MCPOAuthHttpServer(oauthServer, oauthConfig)
  
  // Start OAuth server
  await oauthHttpServer.start(3000)
  
  // Start mcpresso server
  mcpressoServer.listen(3001, () => {
    console.log('✅ Servers started successfully!')
    console.log('')
    console.log('📋 Available Services:')
    console.log('  • OAuth Server: http://localhost:3000')
    console.log('  • MCPresso Server: http://localhost:3001')
    console.log('')
    console.log('🔍 Discovery Endpoints:')
    console.log('  • OAuth Metadata: http://localhost:3000/.well-known/oauth-authorization-server')
    console.log('  • MCP Resource Metadata: http://localhost:3001/.well-known/oauth-protected-resource-metadata')
    console.log('')
    console.log('🧪 Demo Credentials:')
    console.log('  • Client ID: mcpresso-client')
    console.log('  • Client Secret: mcpresso-secret')
    console.log('  • User: demo@example.com')
    console.log('')
    
    // Test the OAuth flow
    setTimeout(async () => {
      try {
        await testOAuthFlow()
        console.log('')
        console.log('✅ OAuth flow test completed successfully!')
        console.log('')
        console.log('📚 Next Steps:')
        console.log('  1. Test with Postman collection: bun run postman:test collection')
        console.log('  2. Run full test suite: bun test')
        console.log('  3. Integrate with your own mcpresso server')
        console.log('')
      } catch (error) {
        console.error('❌ OAuth flow test failed:', error)
      }
    }, 1000)
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down servers...')
    await oauthServer.cleanup()
    process.exit(0)
  })
}

main().catch((error) => {
  console.error('Failed to start integration demo:', error)
  process.exit(1)
}) 