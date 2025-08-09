# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

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
   This will create the PostgreSQL database with all necessary tables, functions, and indexes.

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

This template uses PostgreSQL. You must set a connection string and initialize the entire schema via the init script.

### 1) Configure the connection string

Option A — interactive (recommended):
```bash
npm run db:init
```
You will be prompted for `DATABASE_URL` (example: `postgresql://postgres:postgres@localhost:5432/mcpresso`). The script will write it to `.env` and run the schema setup.

Option B — manual:
1. Copy env file: `cp .env.example .env`
2. Edit `.env` and set:
```
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB
```
3. Initialize full schema:
```bash
node scripts/init-db.js
```

### 2) Database Structure

The initialization script creates the following tables:

- **users** - User accounts with UUID primary keys (email, username, hashed_password, scopes, profile)
- **oauth_clients** - OAuth client registry (redirect URIs, scopes, grant types)
- **oauth_authorization_codes** - Authorization codes (with PKCE fields)
- **oauth_access_tokens** - Access tokens with expiry
- **oauth_refresh_tokens** - Refresh tokens with expiry
- **notes** - Example resource (user-authored notes)

### Database Features

- ✅ **PostgreSQL with UUID primary keys** - Scalable and secure
- ✅ **Foreign key constraints** - Maintains data integrity
- ✅ **Optimized indexes** - Fast lookups for common queries
- ✅ **Automatic timestamps** - Created/updated tracking with triggers
- ✅ **OAuth integration** - Session and token management
- ✅ **Database functions and triggers** - Automatic updated_at maintenance

### Database Requirements

- PostgreSQL 12+ with UUID extension
- Connection string in `DATABASE_URL` environment variable
- SSL support for production deployments

## Features

- OAuth2.1 authentication with PostgreSQL
- User management and sessions
- Notes resource with author relationships
- TypeScript support
- Development and production builds
- Environment variable configuration
- Docker support with docker-compose

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
    └── postgres-storage.ts
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Server port | No | 3000 |
| SERVER_URL | Base URL of your server | Yes | - |
| JWT_SECRET | Secret key for JWT tokens | Yes | - |
| DATABASE_URL | PostgreSQL connection string | Yes | - |
| NODE_ENV | Environment mode | No | development |

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
- `npm run db:init` - Interactive database setup (prompts for connection string and initializes the full schema)
- `npm run secret:generate` - Generate secure JWT secret
- `npm run user:create` - Create a new user account

## Create a Test User

After the DB is initialized and `JWT_SECRET` is set, create a user:

```bash
npm run user:create "John Doe" "john@example.com" "strongpassword"
```

The script validates uniqueness and hashes the password before insert.

## Docker Deployment

This template includes Docker support:

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build manually
npm run docker:build
npm run docker:run
```

## License

MIT 