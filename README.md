# MCP OAuth Server

A production-ready OAuth 2.1 server implementation for Model Context Protocol (MCP) with PKCE support, designed to work seamlessly with mcpresso.

## Features

- ✅ **OAuth 2.1 Compliant** - Full implementation of OAuth 2.1 draft specification
- ✅ **MCP Integration** - Designed specifically for Model Context Protocol
- ✅ **PKCE Support** - Proof Key for Code Exchange (required for MCP)
- ✅ **Production Ready** - Security headers, rate limiting, compression, CORS configuration
- ✅ **Dynamic Client Registration** - RFC 7591 compliant
- ✅ **Multiple Grant Types** - Authorization code, refresh token, client credentials
- ✅ **Token Introspection** - RFC 7662 compliant
- ✅ **Discovery Endpoints** - RFC 8414 and RFC 9728 compliant
- ✅ **Configurable CORS** - Flexible CORS configuration for production use
- ✅ **Environment Variables** - Production configuration via environment variables

## Quick Start

### Installation

```bash
npm install mcpresso-oauth-server
# or
bun add mcpresso-oauth-server
```

### Basic Usage

```typescript
import { 
  MCPOAuthServer, 
  MCPOAuthHttpServer, 
  MemoryStorage,
  createProductionOAuthServer 
} from 'mcpresso-oauth-server'

// Create production-ready configuration
const config = createProductionOAuthServer({
  issuer: 'https://your-oauth-server.com',
  serverUrl: 'https://your-oauth-server.com',
  jwtSecret: process.env.OAUTH_JWT_SECRET || 'your-secret-key'
})

// Initialize storage
const storage = new MemoryStorage()

// Create OAuth server
const oauthServer = new MCPOAuthServer(config, storage)

// Create HTTP server
const httpServer = new MCPOAuthHttpServer(oauthServer, config)

// Start server
await httpServer.start(3000)
```

### Environment Variables

Configure the server using environment variables:

```bash
# Server configuration
OAUTH_ISSUER=https://your-oauth-server.com
OAUTH_SERVER_URL=https://your-oauth-server.com
OAUTH_JWT_SECRET=your-super-secret-jwt-key

# CORS configuration
CORS_ORIGIN=https://your-client.com,https://another-client.com
TRUST_PROXY=true

# Server port
PORT=3000
```

## Configuration

### CORS Configuration

The server supports flexible CORS configuration:

```typescript
const config = createProductionOAuthServer({
  http: {
    cors: {
      origin: ['https://your-client.com', 'https://another-client.com'],
      credentials: true,
      exposedHeaders: ["mcp-session-id"],
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
  }
})
```

### Security Features

The server includes production-ready security features:

- **Helmet** - Security headers (enabled by default)
- **Rate Limiting** - Configurable rate limiting
- **Compression** - Response compression
- **Trust Proxy** - Support for load balancers
- **Input Validation** - Request size limits

```typescript
const config = createProductionOAuthServer({
  http: {
    enableHelmet: true,
    enableRateLimit: true,
    enableCompression: true,
    trustProxy: true,
    rateLimitConfig: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  }
})
```

## API Endpoints

### OAuth 2.1 Endpoints

- `GET /authorize` - Authorization endpoint
- `POST /token` - Token endpoint
- `POST /introspect` - Token introspection
- `POST /revoke` - Token revocation
- `GET /userinfo` - User info endpoint
- `POST /register` - Dynamic client registration

### Discovery Endpoints

- `GET /.well-known/oauth-authorization-server` - OAuth metadata (RFC 8414)
- `GET /.well-known/jwks.json` - JSON Web Key Set
- `GET /.well-known/oauth-protected-resource` - MCP protected resource metadata (RFC 9728)

### Admin Endpoints

- `GET /health` - Health check
- `GET /admin/clients` - List clients
- `GET /admin/users` - List users
- `GET /admin/stats` - Server statistics

## MCP Integration

### With mcpresso

Configure your mcpresso server to use this OAuth server:

```typescript
import { createMcpressoServer } from 'mcpresso'

const server = createMcpressoServer({
  auth: {
    issuer: 'https://your-oauth-server.com',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret'
  }
})
```

### MCP-Specific Features

- **Resource Indicators** - Support for MCP resource parameter
- **PKCE Required** - Proof Key for Code Exchange (MCP requirement)
- **Protected Resource Metadata** - RFC 9728 compliant discovery

## Testing

### Run Tests

```bash
bun test
```

### Manual Testing

1. **Authorization Code Flow with PKCE:**
```bash
curl -X GET "http://localhost:3000/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:3001/callback&scope=read&resource=http://localhost:3000&code_challenge=test-challenge&code_challenge_method=S256"
```

2. **Token Exchange:**
```bash
curl -X POST "http://localhost:3000/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=demo-client&client_secret=demo-secret&code=YOUR_CODE&redirect_uri=http://localhost:3001/callback&resource=http://localhost:3000&code_verifier=test-verifier"
```

3. **Client Credentials Flow:**
```bash
curl -X POST "http://localhost:3000/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=demo-client&client_secret=demo-secret&resource=http://localhost:3000"
```

## Storage

The package includes an in-memory storage implementation for development and testing. For production, implement the `MCPOAuthStorage` interface with your preferred database.

```typescript
import type { MCPOAuthStorage } from 'mcpresso-oauth-server'

class DatabaseStorage implements MCPOAuthStorage {
  // Implement all required methods
  async createClient(client: OAuthClient): Promise<void> { /* ... */ }
  async getClient(clientId: string): Promise<OAuthClient | null> { /* ... */ }
  // ... other methods
}
```

## Development

### Build

```bash
bun run build
```

### Start Development Server

```bash
bun run start:dev
```

### Clean

```bash
bun run clean
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Security

For production use:

1. **Change the JWT secret** - Use a strong, random secret
2. **Configure CORS properly** - Only allow trusted origins
3. **Use HTTPS** - Always use HTTPS in production
4. **Implement proper storage** - Use a production database
5. **Monitor logs** - Set up proper logging and monitoring
6. **Regular updates** - Keep dependencies updated

## Support

For issues and questions:

- [GitHub Issues](https://github.com/granular-software/mcpresso-oauth-server/issues)
- [Documentation](https://github.com/granular-software/mcpresso-oauth-server#readme) 