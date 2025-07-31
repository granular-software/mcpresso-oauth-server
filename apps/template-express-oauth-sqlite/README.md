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

This template uses SQLite for data storage. The database is automatically created when you run the initialization script:

```bash
npm run db:init
```

### Database Structure

The initialization script creates the following tables:

- **users** - User accounts with authentication
- **sessions** - OAuth sessions and tokens  
- **notes** - User notes with author relationships

### Database Features

- ✅ **SQLite file-based storage** - No external database required
- ✅ **Foreign key constraints** - Maintains data integrity
- ✅ **Optimized indexes** - Fast lookups for common queries
- ✅ **Automatic timestamps** - Created/updated tracking
- ✅ **OAuth integration** - Session and token management

### Database Location

The SQLite database is stored at:
```
data/app.db
```

You can customize the location by setting the `DATABASE_PATH` environment variable.

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
├── resources/         # MCP resources
│   ├── example.ts
└── auth/              # OAuth configuration
    └── oauth.ts
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Server port | No | 3000 |
| SERVER_URL | Base URL of your server | Yes | - |
| JWT_SECRET | Secret key for JWT tokens | Yes | - |
| DATABASE_PATH | SQLite database file path | No | data/app.db |

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run typecheck` - Type check without building
- `npm run db:init` - Initialize database tables and indexes

## User Management

Create and manage users with secure password hashing:

- `npm run user:create` - Create a user with default credentials
- `npm run user:create <username> <email> <password>` - Create a user with custom credentials
- `npm run user:test-password` - Test password verification functionality
- `npm run user:test-auth` - Test OAuth authentication flow

For detailed user management documentation, see [USER_MANAGEMENT.md](./USER_MANAGEMENT.md).

## License

MIT 