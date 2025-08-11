# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

This template is a Docker-first MCP server that uses a single user with a generated API key.
No database is required. OAuth2.1 endpoints are still implemented to satisfy MCP requirements,
but the login page simply asks for the API key.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Features

- Docker-ready
- Single user, API-key based login page (OAuth2.1 compatible surface)
- No database required; tokens and codes are stored in a JSON file under `DATA_DIR`
- TypeScript support, dev and prod builds

## Project Structure

```
src/
├── server.ts             # Main server file
├── auth/
│   └── oauth.ts          # Shows an API key login page; verifies the key
├── storage/
│   └── file-storage.ts   # Persists OAuth tokens/codes/users in a JSON file
└── resources/
    ├── schemas/          # Resource schemas
    │   └── Note.ts
    └── handlers/
        └── note.ts
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Server port | No | 3000 |
| SERVER_URL | Base URL of your server | Yes | - |
| DATA_DIR | Directory where api_key and oauth state are stored | No | ./data |
| API_KEY_FILE | Optional path to API key file | No | <DATA_DIR>/api_key.txt |

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run typecheck` - Type check without building

## License

MIT
