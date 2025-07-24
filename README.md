# mcpresso-oauth-server

A production-ready OAuth 2.1 server implementation designed specifically for Model Context Protocol (MCP) servers. Provides seamless authentication integration with `mcpresso` servers.

## Features

- ✅ **OAuth 2.1 Compliant** - Full implementation of OAuth 2.1 draft specification
- ✅ **MCP Integration** - Designed specifically for Model Context Protocol
- ✅ **PKCE Support** - Proof Key for Code Exchange (required for MCP)
- ✅ **Custom User Authentication** - Pluggable login logic and UI customization
- ✅ **Production Ready** - Security headers, rate limiting, compression, CORS
- ✅ **Flexible Deployment** - Run standalone or integrated with MCP servers
- ✅ **Dynamic Client Registration** - RFC 7591 compliant
- ✅ **Multiple Grant Types** - Authorization code, refresh token, client credentials
- ✅ **Token Introspection** - RFC 7662 compliant
- ✅ **Discovery Endpoints** - RFC 8414 and RFC 9728 compliant

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
  MemoryStorage 
} from 'mcpresso-oauth-server'

// Initialize storage with demo data
const storage = new MemoryStorage()
await storage.createClient({
  id: 'demo-client',
  secret: 'demo-secret',
  name: 'Demo Client',
  type: 'confidential',
  redirectUris: ['http://localhost:4000/callback'],
  scopes: ['read', 'write'],
  grantTypes: ['authorization_code']
})

// Create OAuth server with custom authentication
const oauthServer = new MCPOAuthServer({
  issuer: 'http://localhost:4000',
  serverUrl: 'http://localhost:4000',
  jwtSecret: 'your-secret-key',
  auth: {
    authenticateUser: async (credentials, context) => {
      // Your login logic here
      const user = users.find(u => u.username === credentials.username)
      return user && validatePassword(credentials.password, user.password) ? user : null
    },
    getCurrentUser: async (sessionData, context) => {
      // Check if user is already logged in via session/cookies
      return null // Force login for this example
    },
    renderLoginPage: async (context, error) => {
      // Optional: Customize login page
      return `<html>...custom login form...</html>`
    }
  }
}, storage)
```

## MCP Integration

### Two Deployment Modes

#### Mode 1: Integrated (Same Port)

Run OAuth and MCP server together:

```typescript
import { createMCPServer } from 'mcpresso'
import { MCPOAuthServer } from 'mcpresso-oauth-server'

// Create OAuth server
const oauthServer = new MCPOAuthServer({...}, storage)

// Create MCP server with integrated OAuth
const app = createMCPServer({
  name: "integrated_server",
  resources: [userResource],
  auth: {
    oauth: oauthServer,              // Integrate OAuth server
    userLookup: async (jwtPayload) => {
      // Fetch full user profiles from your database
      return await db.users.findById(jwtPayload.sub)
    }
  }
})

app.listen(4000) // Both OAuth and MCP on port 4000
```

**Architecture:**
```
┌─────────────────────────────────┐
│        Integrated Server        │
│         (Port 4000)             │
│                                 │
│ ┌─────────────┐ ┌─────────────┐ │
│ │OAuth Service│ │ MCP Service │ │
│ │• /authorize │ │• MCP API    │ │
│ │• /token     │ │• Resources  │ │
│ │• Login UI   │ │• Tools      │ │
│ └─────────────┘ └─────────────┘ │
└─────────────────────────────────┘
```

#### Mode 2: Separate Servers

Run OAuth and MCP on different ports:

```typescript
// OAuth Server (Port 4001)
const oauthApp = express()
oauthApp.use(cors()) // Important for cross-origin requests
registerOAuthEndpoints(oauthApp, oauthServer)
oauthApp.listen(4001)

// MCP Server (Port 4000)
const mcpApp = createMCPServer({
  name: "api_server",
  resources: [userResource],
  auth: {
    issuer: "http://localhost:4001",      // OAuth server URL
    serverUrl: "http://localhost:4000",   // This MCP server URL
    jwtSecret: "shared-secret",           // Same secret as OAuth server
    userLookup: async (jwtPayload) => {
      return await db.users.findById(jwtPayload.sub)
    }
  }
})
mcpApp.listen(4000)
```

**Architecture:**
```
┌─────────────────┐    ┌──────────────────┐
│   OAuth Server  │    │    MCP Server    │
│   (Port 4001)   │    │   (Port 4000)    │
│                 │    │                  │
│ • /authorize    │    │ • MCP API        │
│ • /token        │    │ • Token Validation│
│ • Login UI      │    │ • Resources      │
└─────────────────┘    └──────────────────┘
```

## Custom Authentication

### User Authentication Callbacks

Implement your own user authentication logic:

```typescript
const oauthServer = new MCPOAuthServer({
  // ... other config
  auth: {
    // Required: Validate user credentials
    authenticateUser: async (credentials, context) => {
      const { username, password } = credentials
      
      // Example with database lookup
      const user = await db.users.findByEmail(username)
      if (!user) return null
      
      // Verify password (use bcrypt in production)
      const isValid = await bcrypt.compare(password, user.hashedPassword)
      if (!isValid) return null
      
      // Return user object
      return {
        id: user.id,
        username: user.email,
        email: user.email,
        scopes: user.permissions // e.g., ['read', 'write', 'admin']
      }
    },
    
    // Optional: Check existing sessions
    getCurrentUser: async (sessionData, context) => {
      if (sessionData?.userId) {
        return await db.users.findById(sessionData.userId)
      }
      return null
    },
    
    // Optional: Custom login page
    renderLoginPage: async (context, error) => {
      return `
        <!DOCTYPE html>
        <html>
          <head><title>Login - ${context.clientId}</title></head>
          <body>
            <h2>Login to ${context.clientId}</h2>
            ${error ? `<p style="color:red">${error}</p>` : ''}
            <form method="POST" action="/authorize">
              <!-- Hidden OAuth parameters -->
              <input type="hidden" name="response_type" value="code">
              <input type="hidden" name="client_id" value="${context.clientId}">
              <input type="hidden" name="redirect_uri" value="${context.redirectUri}">
              <input type="hidden" name="scope" value="${context.scope || ''}">
              
              <!-- Login form -->
              <div>
                <label>Email:</label>
                <input type="email" name="username" required>
              </div>
              <div>
                <label>Password:</label>
                <input type="password" name="password" required>
              </div>
              <button type="submit">Login</button>
            </form>
          </body>
        </html>
      `
    }
  }
}, storage)
```

### Integration Examples

#### With Supabase

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

const oauthServer = new MCPOAuthServer({
  auth: {
    authenticateUser: async ({ username, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      })
      
      if (error || !data.user) return null
      
      return {
        id: data.user.id,
        username: data.user.email,
        email: data.user.email,
        scopes: data.user.user_metadata?.scopes || ['read']
      }
    }
  }
})
```

#### With Firebase

```typescript
import { signInWithEmailAndPassword } from 'firebase/auth'

const oauthServer = new MCPOAuthServer({
  auth: {
    authenticateUser: async ({ username, password }) => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, username, password)
        const user = userCredential.user
        
        return {
          id: user.uid,
          username: user.email,
          email: user.email,
          scopes: user.customClaims?.scopes || ['read']
        }
      } catch (error) {
        return null
      }
    }
  }
})
```

## Configuration

### Environment Variables

Configure the server using environment variables:

```bash
# Server configuration
OAUTH_ISSUER=https://auth.yourdomain.com
OAUTH_SERVER_URL=https://auth.yourdomain.com
OAUTH_JWT_SECRET=your-super-secret-jwt-key

# CORS configuration (for separate server deployment)
CORS_ORIGIN=https://yourdomain.com,https://api.yourdomain.com
TRUST_PROXY=true

# Server port
PORT=4001
```

### Security Configuration

The server includes production-ready security features:

```typescript
const oauthServer = new MCPOAuthServer({
  // ... OAuth config
  http: {
    cors: {
      origin: ['https://yourdomain.com'],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS']
    },
    enableHelmet: true,
    enableRateLimit: true,
    rateLimitConfig: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // requests per window
    }
  }
})
```

## API Endpoints

### OAuth 2.1 Endpoints

- `GET /authorize` - Authorization endpoint (shows login page)
- `POST /authorize` - Authorization endpoint (processes login)
- `POST /token` - Token endpoint
- `POST /introspect` - Token introspection
- `POST /revoke` - Token revocation
- `GET /userinfo` - User info endpoint
- `POST /register` - Dynamic client registration

### Discovery Endpoints

- `GET /.well-known/oauth-authorization-server` - OAuth metadata (RFC 8414)
- `GET /.well-known/jwks.json` - JSON Web Key Set
- `GET /.well-known/oauth-protected-resource` - MCP protected resource metadata

### Admin Endpoints

- `GET /health` - Health check
- `GET /admin/clients` - List clients
- `GET /admin/users` - List users
- `GET /admin/stats` - Server statistics

## Storage

The package includes an in-memory storage implementation for development. For production, implement the `MCPOAuthStorage` interface:

```typescript
import type { MCPOAuthStorage } from 'mcpresso-oauth-server'

class DatabaseStorage implements MCPOAuthStorage {
  async createClient(client: OAuthClient): Promise<void> {
    // Store client in your database
  }
  
  async getClient(clientId: string): Promise<OAuthClient | null> {
    // Fetch client from your database
  }
  
  // ... implement all required methods
}
```

## Examples

See complete working examples:

- **Integrated OAuth**: [`mcpresso/examples/oauth2-simple-demo.ts`](https://github.com/granular-software/mcpresso/tree/main/examples/oauth2-simple-demo.ts)
- **Separate Servers**: [`mcpresso/examples/separate-servers-demo.ts`](https://github.com/granular-software/mcpresso/tree/main/examples/separate-servers-demo.ts)

## Testing

### Manual OAuth Flow Testing

1. **Get Authorization Code:**
```bash
# Open in browser or use curl
curl "http://localhost:4001/authorize?response_type=code&client_id=demo-client&redirect_uri=http://localhost:4001/callback&scope=read&resource=http://localhost:4000"
```

2. **Exchange for Token:**
```bash
curl -X POST "http://localhost:4001/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=demo-client&client_secret=demo-secret&code=YOUR_CODE&redirect_uri=http://localhost:4001/callback&resource=http://localhost:4000"
```

3. **Use Token with MCP API:**
```bash
curl -X POST "http://localhost:4000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"whoami_user","arguments":{}}}'
```

## Development

### Build & Test

```bash
# Install dependencies
bun install

# Build the package
bun run build

# Run tests
bun test

# Start development server
bun run dev
```

## Security Best Practices

For production deployments:

1. **Use Strong JWT Secrets** - Generate cryptographically secure secrets
2. **Configure CORS Properly** - Only allow trusted origins
3. **Enable HTTPS** - Always use HTTPS in production
4. **Implement Proper Storage** - Use a production database, not memory storage
5. **Monitor & Log** - Set up proper logging and monitoring
6. **Keep Dependencies Updated** - Regularly update packages
7. **Rate Limiting** - Configure appropriate rate limits
8. **Input Validation** - Validate all user inputs

## Support

- **Documentation**: [mcpresso documentation](https://github.com/granular-software/mcpresso)
- **Issues**: [GitHub Issues](https://github.com/granular-software/mcpresso-oauth-server/issues)
- **Examples**: [Working examples](https://github.com/granular-software/mcpresso/tree/main/examples)

## License

MIT - See LICENSE file for details. 