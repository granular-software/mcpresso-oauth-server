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

This template uses PostgreSQL for data storage. Before running the application, you need to initialize the database:

```bash
npm run db:init
```

### Database Structure

The initialization script creates the following tables:

- **users** - User accounts with UUID primary keys
- **sessions** - OAuth sessions and tokens
- **notes** - User notes with author relationships

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
├── resources/         # MCP resources
│   ├── users.ts       # User management
│   └── notes.ts       # Notes with author relationships
└── auth/              # OAuth configuration
    └── oauth.ts
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Server port | No | 3000 |
| SERVER_URL | Base URL of your server | Yes | - |
| JWT_SECRET | Secret key for JWT tokens | Yes | - |
| DATABASE_URL | PostgreSQL connection string | Yes | - |
| NODE_ENV | Environment mode | No | development |

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run typecheck` - Type check without building
- `npm run db:init` - Initialize database tables, functions, and indexes

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