# sqlite

A mcpresso MCP server

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Initialize the database**
   ```bash
   npm run db:init
   ```
   This will create the SQLite database with all necessary tables and indexes.

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Database Setup

This template uses SQLite for authentication data storage (users, sessions, tokens, etc.). The database file is created automatically on init, and the init script creates the full schema.

Initialize the schema:

```bash
npm run db:init
```

### Database Structure

The initialization script creates the following tables:

- **oauth_users** - User accounts (username/email, hashed_password, scopes, profile)
- **oauth_clients** - OAuth client registry (redirect URIs, scopes, grant types)
- **oauth_authorization_codes** - Authorization codes (with PKCE fields)
- **oauth_access_tokens** - Access tokens with expiry
- **oauth_refresh_tokens** - Refresh tokens with expiry
- **notes** - Example resource (user-authored notes)

### Database Features

- ✅ **SQLite file-based storage** - No external database required
- ✅ **Foreign key constraints** - Maintains data integrity
- ✅ **Optimized indexes** - Fast lookups for common queries
- ✅ **Automatic timestamps** - Created/updated tracking
- ✅ **OAuth integration** - Session and token management

### Database Location

- Default path: `data/app.db`
- To customize, set `DATABASE_PATH` in `.env` before running init.

## Features

- OAuth2.1 authentication with SQLite
- User management and sessions
- Notes resource with author relationships
- TypeScript support
- Development and production builds
- Environment variable configuration

## Project Structure

```
src/
├── server.ts          # Main server file
├── auth/              # OAuth configuration
│   └── oauth.ts
├── resources/         # MCP resources
│   ├── schemas/       # Resource schemas
│   │   └── Note.ts    # Note data model
│   └── handlers/      # Resource handlers
│       └── note.ts    # Notes with author relationships
└── storage/           # Database layer
    └── sqlite-storage.ts
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Server port | No | 3000 |
| SERVER_URL | Base URL of your server | Yes | - |
| JWT_SECRET | Secret key for JWT tokens | Yes | - |
| DATABASE_PATH | SQLite database file path | No | data/app.db |

## JWT Secret

Generate a secure JWT secret for token signing.

Option A — script (uses `openssl` under the hood):
```bash
npm run secret:generate
```

Option B — manual (with openssl):
```bash
JWT_SECRET=$(openssl rand -hex 64)
echo "JWT_SECRET=$JWT_SECRET" >> .env   # or replace existing JWT_SECRET in .env
```

Keep this value secret. Rotating it will invalidate existing tokens.

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run typecheck` - Type check without building
- `npm run db:init` - Initialize SQLite database and full schema
- `npm run secret:generate` - Generate secure JWT secret

## User Management

Create and manage users with secure password hashing:

- `npm run user:create` - Create a user with default credentials
- `npm run user:create <username> <email> <password>` - Create a user with custom credentials
- `npm run user:test-password` - Test password verification functionality
- `npm run user:test-auth` - Test OAuth authentication flow

For detailed user management documentation, see [USER_MANAGEMENT.md](./USER_MANAGEMENT.md).

## License

MIT 