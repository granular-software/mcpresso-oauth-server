import "dotenv/config";
import { createMCPServer } from "mcpresso";
import { noteResource } from "./resources/handlers/note.js";
import { oauthConfig } from "./auth/oauth.js";

// Resolve the canonical base URL of this server for both dev and production.
const BASE_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

// Create the MCP server (Express version)
const expressApp = createMCPServer({
  name: "{{PROJECT_NAME}}",
  serverUrl: BASE_URL,
  resources: [noteResource],
  auth: oauthConfig,
  exposeTypes: true,
  serverMetadata: {
    name: "{{PROJECT_NAME}}",
    version: "1.0.0",
    description: "{{PROJECT_DESCRIPTION}}",
  },
});

// Export for Node.js
export default expressApp;

// Local development server
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = process.env.PORT || 3000;
  console.log("Starting mcpresso server on port " + port);
  console.log("MCP Inspector URL: http://localhost:" + port);
  
  expressApp.listen(port, () => {
    console.log("Server running on http://localhost:" + port);
  });
}
