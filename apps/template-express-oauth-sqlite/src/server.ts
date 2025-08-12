import "dotenv/config";
import { z } from "zod";
import { createMCPServer } from "mcpresso";
import { oauthConfig } from "./auth/oauth.js";
import { Express } from "express";
// Import your resources
import { noteResource } from "./resources/handlers/note.js";

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
		url: process.env.SERVER_URL || "https://your-server.com",
		license: {
			name: "MIT",
			url: "https://opensource.org/licenses/MIT",
		},
		capabilities: {
			authentication: true,
			rateLimiting: false,
			retries: true,
			streaming: true,
		},
	},
});

// Export for Node.js
export default expressApp as Express;

// Local development server
if (process.argv[1] === new URL(import.meta.url).pathname) {
	const port = process.env.PORT || 3000;
	console.log("Starting mcpresso server on port " + port);
	console.log("Server URL: " + BASE_URL);

	expressApp.listen(port, () => {
		console.log("Server running on http://localhost:" + port);
	});
}
