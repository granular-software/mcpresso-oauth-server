import { GeneratedCode, GeneratedSchema, GeneratedResource, ParsedOpenAPI } from './types.js';
import { toCamelCase, toPascalCase, toValidIdentifier, toSnakeCase } from './utils.js';

export class FileGenerator {
  /**
   * Generate all output files
   */
  generateFiles(
    serverName: string,
    schemas: GeneratedSchema[],
    resources: GeneratedResource[],
    parsed: ParsedOpenAPI
  ): GeneratedCode {
    return {
      server: this.generateServerFile(serverName, resources),
      types: this.generateTypesFile(schemas),
      packageJson: this.generatePackageJson(serverName),
      readme: this.generateReadme(serverName, resources, schemas, parsed),
      apiClient: this.generateApiClient(),
      schemaFiles: this.generateSchemaFiles(schemas),
      resourceFiles: this.generateResourceFiles(resources)
    };
  }

  /**
   * Generate main server file
   */
  private generateServerFile(serverName: string, resources: GeneratedResource[]): string {
    const resourceImports = resources.map(resource => {
      const camelCaseName = toCamelCase(resource.name);
      const pascalCaseName = toPascalCase(resource.name);
      return `import { ${camelCaseName}Resource } from './resources/${pascalCaseName}Resource.js';`;
    }).join('\n');

    const resourceArray = resources.map(resource => {
      const camelCaseName = toCamelCase(resource.name);
      return `    ${camelCaseName}Resource`;
    }).join(',\n');

    return `import { createMCPServer } from 'mcpresso';
${resourceImports}

// Create the MCP server
const server = createMCPServer({
  name: '${serverName}',
  resources: [
${resourceArray}
  ],
  exposeTypes: true,
  serverMetadata: {
    name: '${serverName}',
    version: '1.0.0',
    description: 'Generated MCPresso server from OpenAPI specification',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
});

// Start the server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3080;
server.listen(port, () => {
  console.log(\`🚀 Generated MCPresso server running on http://localhost:\${port}\`);
  console.log('📖 Server metadata available at: http://localhost:' + port);
});`;
  }

  /**
   * Generate types file
   */
  private generateTypesFile(schemas: GeneratedSchema[]): string {
    const typeImports = schemas.map(schema => 
      `import { ${schema.typeName} } from './schemas/${schema.typeName}.js';`
    ).join('\n');

    const typeExports = schemas.map(schema => 
      `export type { ${schema.typeName} };`
    ).join('\n');

    return `${typeImports}

${typeExports}
`;
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(serverName: string): string {
    return `{
  "name": "${serverName}",
  "version": "1.0.0",
  "description": "Generated MCPresso server from OpenAPI specification",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "tsx server.js",
    "dev": "tsx --watch server.js",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "mcpresso": "^0.3.0",
    "zod": "^3.23.8",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.7.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`;
  }

  /**
   * Generate README
   */
  private generateReadme(
    serverName: string, 
    resources: GeneratedResource[], 
    schemas: GeneratedSchema[],
    parsed: ParsedOpenAPI
  ): string {
    const resourceList = resources.map(resource => 
      `- ${resource.name} (${resource.operations.length} operations)`
    ).join('\n');

    const schemaList = schemas.map(schema => 
      `- ${schema.name}`
    ).join('\n');

    const operationList = parsed.operations.map(op => 
      `- ${op.operation.operationId || op.method + ' ' + op.path}`
    ).join('\n');

    return `# ${serverName}

This is a generated MCPresso server created from an OpenAPI specification.

## Features

- Generated from OpenAPI specification
- Type-safe with Zod schemas
- MCP-compliant resource definitions
- HTTP handlers that call the original API endpoints
- Ready to run

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure the API client:
   Set environment variables:
   - \`API_BASE_URL\`: Base URL of your API (default: http://localhost:3000)
   - \`API_TOKEN\`: Authentication token (optional)
   - \`PORT\`: Server port (default: 3080)

3. Start the server:
   \`\`\`bash
   npm start
   \`\`\`

4. The server will be available at \`http://localhost:3080\`

## Generated Resources

This server includes the following generated resources:

${resourceList}

## Generated Schemas

This server includes the following generated schemas:

${schemaList}

## API Operations

The following operations are available:

${operationList}

## Customization

You can customize the generated code by:
1. Modifying the API client configuration in \`apiClient.ts\`
2. Adding custom authentication logic
3. Modifying the server configuration
4. Adding rate limiting or retries

## Development

To run in development mode with auto-restart:
\`\`\`bash
npm run dev
\`\`\`

## Environment Variables

- \`API_BASE_URL\`: Base URL for API calls
- \`API_TOKEN\`: Authentication token
- \`PORT\`: Server port (default: 3080)
`;
  }

  /**
   * Generate API client
   */
  private generateApiClient(): string {
    return `import axios from 'axios';

// Configure the API client
const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication if needed
apiClient.interceptors.request.use((config) => {
  // Add auth token if available
  const token = process.env.API_TOKEN;
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
);

export default apiClient;`;
  }

  /**
   * Generate schema files
   */
  private generateSchemaFiles(schemas: GeneratedSchema[]): Record<string, string> {
    const files: Record<string, string> = {};
    
    for (const schema of schemas) {
      const fileName = `schemas/${schema.fileName}`;
      files[fileName] = this.generateSchemaFileContent(schema);
    }
    
    return files;
  }

  /**
   * Generate schema file content
   */
  private generateSchemaFileContent(schema: GeneratedSchema): string {
    const { typeName, warnings } = schema;
    const schemaVar = `${toValidIdentifier(schema.name)}Schema`;
    
    const warningComments = warnings.length > 0 ? 
      `\n${warnings.join('\n')}\n` : '';
    
    return `import { z } from 'zod';${warningComments}

export const ${schemaVar} = ${this.serializeZodSchema(schema.zodSchema)};

export type ${typeName} = z.infer<typeof ${schemaVar}>;
`;
  }

  /**
   * Generate resource files
   */
  private generateResourceFiles(resources: GeneratedResource[]): Record<string, string> {
    const files: Record<string, string> = {};
    
    for (const resource of resources) {
      const fileName = `resources/${resource.fileName}`;
      files[fileName] = this.generateResourceFileContent(resource);
    }
    
    return files;
  }

  /**
   * Generate resource file content
   */
  private generateResourceFileContent(resource: GeneratedResource): string {
    const { name, methods, primarySchema } = resource;
    const snakeCaseName = toSnakeCase(name);
    const camelCaseName = toCamelCase(snakeCaseName);
    
    // Generate schema imports
    const schemaImports = this.generateSchemaImports(resource);
    
    // Generate schema reference - use actual schema instead of fallback
    const schemaRef = primarySchema ? 
      `${toValidIdentifier(primarySchema)}Schema` : 
      'z.object({})';

    // Generate methods
    const methodEntries: string[] = [];
    
    for (const [methodName, method] of Object.entries(methods)) {
      let inputSchema = '';
      if (method.inputSchemaName) {
        inputSchema = `,\n      inputSchema: ${toValidIdentifier(method.inputSchemaName)}Schema`;
      } else if (method.inputSchema) {
        inputSchema = `,\n      inputSchema: ${this.serializeZodSchema(method.inputSchema)}`;
      }
      
      methodEntries.push(`    ${methodName}: {
      description: "${method.description}"${inputSchema},
      handler: ${method.handler}
    }`);
    }

    return `import { z } from 'zod';
import { createResource } from 'mcpresso';
import apiClient from '../apiClient.js';
${schemaImports}

export const ${camelCaseName}Resource = createResource({
  name: "${snakeCaseName}",
  schema: ${schemaRef},
  uri_template: "${snakeCaseName}/{id}",
  methods: {
${methodEntries.join(',\n')}
  }
});`;
  }

  /**
   * Generate schema imports for a resource
   */
  private generateSchemaImports(resource: GeneratedResource): string {
    const imports = new Set<string>();
    
    // Add primary schema import
    if (resource.primarySchema) {
      const typeName = toPascalCase(resource.primarySchema);
      imports.add(`import { ${toValidIdentifier(resource.primarySchema)}Schema } from '../schemas/${typeName}.js';`);
    }

    // Add imports for method input schemas
    for (const method of Object.values(resource.methods)) {
      if (method.inputSchemaName && method.inputSchemaName !== resource.primarySchema) {
        const typeName = toPascalCase(method.inputSchemaName);
        imports.add(`import { ${toValidIdentifier(method.inputSchemaName)}Schema } from '../schemas/${typeName}.js';`);
      }
    }

    return Array.from(imports).join('\n');
  }

  /**
   * Serialize Zod schema to string representation
   */
  private serializeZodSchema(schema: any): string {
    const typeName = schema._def.typeName;
    
    switch (typeName) {
      case 'ZodString':
        return 'z.string()';
      case 'ZodNumber':
        return 'z.number()';
      case 'ZodBoolean':
        return 'z.boolean()';
      case 'ZodArray':
        const itemType = this.serializeZodSchema(schema._def.type);
        return `z.array(${itemType})`;
      case 'ZodOptional':
        const innerType = this.serializeZodSchema(schema._def.innerType);
        return `${innerType}.optional()`;
      case 'ZodObject':
        const shape = schema._def.shape();
        const properties: string[] = [];
        
        for (const [key, value] of Object.entries(shape)) {
          const serialized = this.serializeZodSchema(value as any);
          properties.push(`  ${key}: ${serialized}`);
        }
        
        return `z.object({\n${properties.join(',\n')}\n})`;
      case 'ZodUnion':
        const options = schema._def.options?.map((opt: any) => this.serializeZodSchema(opt)) || [];
        return `z.union([${options.join(', ')}])`;
      case 'ZodIntersection':
        const intersectionTypes = schema._def.options?.map((opt: any) => this.serializeZodSchema(opt)) || [];
        return `z.intersection(${intersectionTypes.join(', ')})`;
      case 'ZodLiteral':
        const value = schema._def.value;
        if (typeof value === 'string') {
          return `z.literal("${value}")`;
        }
        return `z.literal(${value})`;
      case 'ZodEnum':
        const enumValues = schema._def.values || [];
        return `z.enum([${enumValues.map((v: string) => `"${v}"`).join(', ')}])`;
      case 'ZodLazy':
        return 'z.lazy(() => z.any())'; // Simplified for now
      default:
        return 'z.any()';
    }
  }
} 