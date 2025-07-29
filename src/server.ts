#!/usr/bin/env bun

import { 
  MCPOAuthServer, 
  MCPOAuthHttpServer, 
  MemoryStorage, 
  createProductionOAuthServer,
  createDemoClient,
  type MCPOAuthConfig,
  type OAuthUser 
} from './index.js'

async function main() {
  console.log('🚀 Starting Production MCP OAuth Server...')
  console.log('')

  // Create production-ready configuration
  const config = createProductionOAuthServer()
  
  // Initialize storage
  const storage = new MemoryStorage()
  
  // Add demo client and user for testing
  const demoClient = createDemoClient()
  const demoUser: OAuthUser = {
    id: 'demo-user',
    username: 'demo@example.com',
    email: 'demo@example.com',
    scopes: ['read', 'write'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  await storage.createClient(demoClient)
  await storage.createUser(demoUser)
  
  console.log('✅ Demo data loaded:')
  console.log(`   • Client: ${demoClient.name} (${demoClient.id})`)
  console.log(`   • User: ${demoUser.username} (${demoUser.id})`)
  console.log('')

  // Create OAuth server
  const oauthServer = new MCPOAuthServer(config, storage)
  
  // Create HTTP server
  const httpServer = new MCPOAuthHttpServer(oauthServer, config)
  
  // Start server
  const port = parseInt(process.env.PORT || '3000')
  await httpServer.start(port)
  
  console.log('')
  console.log('🎯 Production MCP OAuth Server is ready!')
  console.log('')
  console.log('📖 Quick Test Guide:')
  console.log('')
  console.log('1. Test Authorization Code Flow with PKCE:')
  console.log(`   curl -X GET "http://localhost:${port}/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:3001/callback&scope=read&resource=http://localhost:3000&code_challenge=test-challenge&code_challenge_method=S256"`)
  console.log('')
  console.log('2. Test Token Exchange:')
  console.log(`   curl -X POST "http://localhost:${port}/token" \\`)
  console.log('     -H "Content-Type: application/x-www-form-urlencoded" \\')
  console.log('     -d "grant_type=authorization_code&client_id=demo-client&client_secret=demo-secret&code=YOUR_CODE&redirect_uri=http://localhost:3001/callback&resource=http://localhost:3000&code_verifier=test-verifier"')
  console.log('')
  console.log('3. Test Client Credentials Flow:')
  console.log(`   curl -X POST "http://localhost:${port}/token" \\`)
  console.log('     -H "Content-Type: application/x-www-form-urlencoded" \\')
  console.log('     -d "grant_type=client_credentials&client_id=demo-client&client_secret=demo-secret&resource=http://localhost:3000"')
  console.log('')
  console.log('4. Test Token Introspection:')
  console.log(`   curl -X POST "http://localhost:${port}/introspect" \\`)
  console.log('     -H "Content-Type: application/json" \\')
  console.log('     -d \'{"token":"YOUR_ACCESS_TOKEN"}\'')
  console.log('')
  console.log('5. Test User Info:')
  console.log(`   curl -X GET "http://localhost:${port}/userinfo" \\`)
  console.log('     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"')
  console.log('')
  console.log('🔍 Discovery Endpoints:')
  console.log(`   • OAuth Metadata: http://localhost:${port}/.well-known/oauth-authorization-server`)
  console.log(`   • JWKS: http://localhost:${port}/.well-known/jwks.json`)
  console.log(`   • Protected Resource: http://localhost:${port}/.well-known/oauth-protected-resource`)
  console.log('')
  console.log('📊 Admin Endpoints:')
  console.log(`   • Health: http://localhost:${port}/health`)
  console.log(`   • Clients: http://localhost:${port}/admin/clients`)
  console.log(`   • Users: http://localhost:${port}/admin/users`)
  console.log(`   • Stats: http://localhost:${port}/admin/stats`)
  console.log('')
  console.log('🧪 Run Tests:')
  console.log('   bun run test')
  console.log('')
  console.log('📚 Integration with mcpresso:')
  console.log('   This OAuth server is designed to work seamlessly with mcpresso.')
  console.log('   Configure your mcpresso server with:')
  console.log('   auth: { issuer: "http://localhost:3000" }')
  console.log('')
  console.log('🔧 Environment Variables:')
  console.log('   • OAUTH_ISSUER: OAuth issuer URL')
  console.log('   • OAUTH_SERVER_URL: Server URL')
  console.log('   • OAUTH_JWT_SECRET: JWT signing secret')
  console.log('   • CORS_ORIGIN: Comma-separated list of allowed origins')
  console.log('   • TRUST_PROXY: Enable trust proxy (true/false)')
  console.log('   • PORT: Server port (default: 3000)')
  console.log('')

  // Setup cleanup interval
  setInterval(async () => {
    try {
      await oauthServer.cleanup()
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  }, 5 * 60 * 1000) // Clean up every 5 minutes

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down MCP OAuth Server...')
    await oauthServer.cleanup()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down MCP OAuth Server...')
    await oauthServer.cleanup()
    process.exit(0)
  })
}

main().catch((error) => {
  console.error('Failed to start MCP OAuth Server:', error)
  process.exit(1)
}) 