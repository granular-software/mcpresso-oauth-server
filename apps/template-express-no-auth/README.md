# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

This template provides a simple MCP server without authentication, perfect for public APIs and development.

## Features

- ✅ No authentication required
- ✅ Express.js server
- ✅ Simple setup
- ✅ Perfect for public APIs
- ✅ Development-friendly
- ✅ TypeScript with full type safety

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### 1. Clone and Setup

```bash
# Clone this template
git clone https://github.com/granular-software/template-express-no-auth.git my-mcp-server
cd my-mcp-server

# Install dependencies
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
SERVER_URL=http://localhost:3000
PORT=3000
```

### 3. Development

```bash
# Start development server
npm run dev

# The server will be available at http://localhost:3000
# MCP Inspector: http://localhost:3000
```

### 4. Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Project Structure

```
├── src/
│   ├── server.ts              # Main server file
│   └── resources/
│       └── example.ts        # Example MCP resource
├── env.example               # Environment variables template
└── README.md                 # This file
```

## API Access

Since this template has no authentication, all API endpoints are publicly accessible. This makes it perfect for:

- Public data APIs
- Development and testing
- Internal services with network-level security
- Prototyping and demos

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SERVER_URL` | Base URL of your server | Yes | - |
| `PORT` | Server port | No | 3000 |

## Development

### Adding Resources

Create new MCP resources in `src/resources/`:

```typescript
import { z } from "zod";
import { createResource } from "mcpresso";

const MyResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... your schema
});

export const myResource = createResource({
  name: "my-resource",
  schema: MyResourceSchema,
  uri_template: "my-resources/{id}",
  methods: {
    get: {
      handler: async ({ id }) => {
        // Your implementation
      },
    },
    // ... other methods
  },
});
```

### Example Resource

The template includes an example note resource that demonstrates:

- CRUD operations (Create, Read, Update, Delete)
- Search functionality
- Schema validation with Zod
- Error handling

## Production Considerations

1. **Security**: Since there's no authentication, ensure network-level security
2. **Rate Limiting**: Consider adding rate limiting for public APIs
3. **SSL**: Ensure HTTPS is enabled in production
4. **Monitoring**: Add logging and monitoring
5. **CORS**: Configure CORS if needed for web clients

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Change `PORT` in `.env` if 3000 is in use
2. **CORS Issues**: Add CORS middleware if needed
3. **Network Access**: Ensure firewall allows connections

### Logs

Check logs for debugging:

```bash
# Application logs
npm run dev
```

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: https://github.com/granular-software/mcpresso
- Documentation: https://github.com/granular-software/mcpresso 