import { createServer } from 'mcpresso';
import { z } from 'zod';
import express from 'express';
import { notesResource } from './resources/example.js';

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create MCP server
const server = createServer({
  name: '{{PROJECT_NAME}}',
  version: '1.0.0',
  resources: [notesResource]
});

// Start server
server.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
});
