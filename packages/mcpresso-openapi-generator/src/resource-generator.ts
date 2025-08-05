import { z } from 'zod';
import { OpenAPIOperation, GeneratedSchema, GeneratedResource, ResourceMethod, ResourceGroup } from './types.js';
import { toCamelCase, toSnakeCase, toPascalCase, toValidIdentifier, cleanDescription, extractRefName } from './utils.js';

export class ResourceGenerator {
  private schemas: GeneratedSchema[];
  private schemaMap: Map<string, GeneratedSchema>;

  constructor(schemas: GeneratedSchema[]) {
    this.schemas = schemas;
    this.schemaMap = new Map(schemas.map(s => [s.name, s]));
  }

  /**
   * Generate resources from OpenAPI operations
   */
  generateResources(operations: OpenAPIOperation[]): GeneratedResource[] {
    const resourceGroups = this.groupOperationsByResource(operations);
    const resources: GeneratedResource[] = [];

    for (const [resourceName, group] of Object.entries(resourceGroups)) {
      try {
        const resource = this.createResource(resourceName, group);
        resources.push(resource);
      } catch (error) {
        console.warn(`Failed to create resource '${resourceName}': ${error}`);
      }
    }

    return resources;
  }

  /**
   * Group operations by resource name based on path structure
   */
  private groupOperationsByResource(operations: OpenAPIOperation[]): Record<string, ResourceGroup> {
    const groups: Record<string, ResourceGroup> = {};

    for (const operation of operations) {
      const resourceName = this.extractResourceName(operation.path);
      
      if (!groups[resourceName]) {
        groups[resourceName] = {
          name: resourceName,
          operations: []
        };
      }
      
      groups[resourceName].operations.push(operation);
    }

    return groups;
  }

  /**
   * Extract resource name from path
   */
  private extractResourceName(path: string): string {
    const parts = path.replace(/^\//, '').split('/');
    
    // Handle different path patterns
    if (parts.length === 1) {
      // Simple resource like /users
      return parts[0].toLowerCase();
    } else if (parts.length === 2 && parts[1].startsWith('{')) {
      // Resource with ID like /users/{username}
      return parts[0].toLowerCase();
    } else if (parts.length >= 3 && parts[1].startsWith('{') && !parts[2].startsWith('{')) {
      // Sub-resource like /users/{username}/packages
      return `${parts[0]}_${parts[2]}`.toLowerCase();
    } else if (parts.length >= 3 && parts[2].startsWith('{')) {
      // Sub-resource with ID like /users/{username}/packages/{package_name}
      return `${parts[0]}_${parts[1]}`.toLowerCase();
    } else if (parts.length >= 4 && parts[1].startsWith('{') && parts[3].startsWith('{')) {
      // Resource with multiple IDs like /gists/{gist_id}/{sha}
      // Use the base resource name (first part)
      return parts[0].toLowerCase();
    }
    
    // Fallback to first part
    return parts[0].toLowerCase();
  }

  /**
   * Create a resource from a group of operations
   */
  private createResource(resourceName: string, group: ResourceGroup): GeneratedResource {
    const snakeCaseName = toSnakeCase(resourceName);
    const sanitizedResourceName = toValidIdentifier(snakeCaseName);
    const fileName = `${toPascalCase(sanitizedResourceName)}Resource.ts`;
    
    // Find primary schema for this resource
    const primarySchema = this.findPrimarySchema(group.operations);
    
    // Group operations by HTTP method
    const operationsByMethod = this.groupOperationsByMethod(group.operations);
    
    // Create methods
    const methods: Record<string, ResourceMethod> = {};
    
    // Map HTTP methods to MCPresso methods
    const methodMap: Record<string, string> = {
      get: 'get',
      post: 'create', 
      put: 'update',
      delete: 'delete'
    };

    for (const [httpMethod, mcpMethod] of Object.entries(methodMap)) {
      if (operationsByMethod[httpMethod] && operationsByMethod[httpMethod].length > 0) {
        const operation = operationsByMethod[httpMethod][0];
        const method = this.createMethod(operation, httpMethod, primarySchema);
        methods[mcpMethod] = method;
      }
    }

    return {
      name: sanitizedResourceName,
      fileName,
      operations: group.operations,
      primarySchema,
      methods
    };
  }

  /**
   * Group operations by HTTP method
   */
  private groupOperationsByMethod(operations: OpenAPIOperation[]): Record<string, OpenAPIOperation[]> {
    const groups: Record<string, OpenAPIOperation[]> = {
      get: [],
      post: [],
      put: [],
      delete: []
    };

    for (const operation of operations) {
      const method = operation.method.toLowerCase();
      if (method in groups) {
        groups[method].push(operation);
      }
    }

    return groups;
  }

  /**
   * Create a method for a resource
   */
  private createMethod(operation: OpenAPIOperation, httpMethod: string, primarySchema?: string): ResourceMethod {
    const description = operation.operation.description || 
                      operation.operation.summary || 
                      `${httpMethod.toUpperCase()} ${operation.path}`;
    
    const cleanedDescription = cleanDescription(description);
    
    // Find appropriate schema for this method
    const methodSchema = this.findSchemaForMethod(operation, httpMethod, primarySchema);
    const methodSchemaName = this.findSchemaNameForMethod(operation, httpMethod, primarySchema);
    
    // Generate handler code
    const handler = this.generateHandler(operation, httpMethod);

    return {
      description: cleanedDescription,
      inputSchema: methodSchema,
      inputSchemaName: methodSchemaName,
      handler
    };
  }

  /**
   * Find the primary schema for a resource based on its operations
   */
  private findPrimarySchema(operations: OpenAPIOperation[]): string | undefined {
    // Look for schemas in response bodies first
    for (const operation of operations) {
      const responses = operation.operation.responses;
      if (!responses) continue;

      // Look for 200 responses first
      if (responses['200']?.content?.['application/json']?.schema) {
        const schemaName = this.extractSchemaName(responses['200'].content['application/json'].schema);
        if (schemaName && this.schemaMap.has(schemaName)) {
          return schemaName;
        }
      }

      // Fallback to any success response
      for (const [statusCode, response] of Object.entries(responses)) {
        if (statusCode.startsWith('2') && statusCode !== '200' && 
            response.content?.['application/json']?.schema) {
          const schemaName = this.extractSchemaName(response.content['application/json'].schema);
          if (schemaName && this.schemaMap.has(schemaName)) {
            return schemaName;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Find schema for a specific method
   */
  private findSchemaForMethod(operation: OpenAPIOperation, httpMethod: string, primarySchema?: string): z.ZodTypeAny | undefined {
    // For GET operations, use response schemas
    if (httpMethod.toLowerCase() === 'get') {
      const responses = operation.operation.responses;
      if (!responses) return undefined;

      if (responses['200']?.content?.['application/json']?.schema) {
        const schemaName = this.extractSchemaName(responses['200'].content['application/json'].schema);
        if (schemaName && this.schemaMap.has(schemaName)) {
          return this.schemaMap.get(schemaName)!.zodSchema;
        }
      }
    }

    // For POST/PUT operations, use request body schemas
    if (httpMethod.toLowerCase() === 'post' || httpMethod.toLowerCase() === 'put') {
      const requestBody = operation.operation.requestBody;
      if (requestBody?.content?.['application/json']?.schema) {
        const schemaName = this.extractSchemaName(requestBody.content['application/json'].schema);
        if (schemaName && this.schemaMap.has(schemaName)) {
          return this.schemaMap.get(schemaName)!.zodSchema;
        }
      }
    }

    // Fallback to primary schema
    if (primarySchema && this.schemaMap.has(primarySchema)) {
      return this.schemaMap.get(primarySchema)!.zodSchema;
    }

    return undefined;
  }

  /**
   * Find schema name for a specific method
   */
  private findSchemaNameForMethod(operation: OpenAPIOperation, httpMethod: string, primarySchema?: string): string | undefined {
    // For GET operations, use response schemas
    if (httpMethod.toLowerCase() === 'get') {
      const responses = operation.operation.responses;
      if (!responses) return undefined;

      if (responses['200']?.content?.['application/json']?.schema) {
        const schemaName = this.extractSchemaName(responses['200'].content['application/json'].schema);
        if (schemaName && this.schemaMap.has(schemaName)) {
          return schemaName;
        }
      }
    }

    // For POST/PUT operations, use request body schemas
    if (httpMethod.toLowerCase() === 'post' || httpMethod.toLowerCase() === 'put') {
      const requestBody = operation.operation.requestBody;
      if (requestBody?.content?.['application/json']?.schema) {
        const schemaName = this.extractSchemaName(requestBody.content['application/json'].schema);
        if (schemaName && this.schemaMap.has(schemaName)) {
          return schemaName;
        }
      }
    }

    // Fallback to primary schema
    if (primarySchema && this.schemaMap.has(primarySchema)) {
      return primarySchema;
    }

    return undefined;
  }

  /**
   * Extract schema name from a schema reference or object
   */
  private extractSchemaName(schema: any): string | undefined {
    if (schema.$ref) {
      return extractRefName(schema.$ref);
    }
    
    if (schema.type === 'array' && schema.items?.$ref) {
      return extractRefName(schema.items.$ref);
    }

    return undefined;
  }

  /**
   * Generate handler code for an operation
   */
  private generateHandler(operation: OpenAPIOperation, httpMethod: string): string {
    // Process the URL to replace path parameters with args
    let processedUrl = operation.path;
    const pathParams = operation.path.match(/\{([^}]+)\}/g);
    
    if (pathParams) {
      for (const param of pathParams) {
        const paramName = param.slice(1, -1); // Remove { and }
        processedUrl = processedUrl.replace(param, `\${args.${paramName}}`);
      }
    }

    // Handle query parameters
    const queryParams = operation.operation.parameters?.filter(p => p.in === 'query') || [];
    let queryStringBlock = '';
    let urlVar = 'url';
    if (queryParams.length > 0) {
      // Build query string in the generated handler function
      queryStringBlock = `\n    let query = [];\n`;
      for (const param of queryParams) {
        queryStringBlock += `    if (args.${param.name} !== undefined) query.push('${param.name}=' + args.${param.name});\n`;
      }
      queryStringBlock += `    const url = '${processedUrl.replace(/'/g, "\\'")}' + (query.length ? '?' + query.join('&') : '');\n`;
      urlVar = 'url';
    } else {
      urlVar = `'${processedUrl.replace(/'/g, "\\'")}'`;
    }

    return `async (args) => {\n  try {${queryStringBlock}    const response = await apiClient({\n      method: '${httpMethod.toUpperCase()}',\n      url: ${urlVar},\n      ${httpMethod.toLowerCase() !== 'get' ? 'data: args,' : ''}\n      ${httpMethod.toLowerCase() !== 'get' ? 'params: args,' : ''}\n    });\n    return response.data;\n  } catch (error: unknown) {\n    if (error && typeof error === 'object' && 'response' in error) {\n      const apiError = error as { response: { status: number; data: any } };\n      console.error('API Error:', apiError.response.status, apiError.response.data);\n      throw new Error(\`API Error: \${apiError.response.status} - \${JSON.stringify(apiError.response.data)}\`);\n    } else if (error && typeof error === 'object' && 'request' in error) {\n      const networkError = error as { request: any };\n      console.error('Network Error:', networkError.request);\n      throw new Error('Network Error: No response received');\n    } else {\n      const generalError = error as Error;\n      console.error('Error:', generalError.message);\n      throw new Error(\`Request Error: \${generalError.message}\`);\n    }\n  }\n}`;
  }

  /**
   * Generate resource file content
   */
  generateResourceFile(resource: GeneratedResource): string {
    const { name, methods, primarySchema, operations } = resource;
    const snakeCaseName = toSnakeCase(name);
    const camelCaseName = toCamelCase(snakeCaseName);
    
    // Generate schema imports
    const schemaImports = this.generateSchemaImports(resource);
    
    // Generate schema reference
    const schemaRef = primarySchema ? 
      `${toValidIdentifier(primarySchema)}Schema` : 
      'z.object({})';

    // Generate URI template based on the first operation's path
    let uriTemplate = snakeCaseName;
    if (operations.length > 0) {
      const firstOp = operations[0];
      const pathParams = firstOp.path.match(/\{([^}]+)\}/g);
      if (pathParams) {
        const paramNames = pathParams.map(p => p.slice(1, -1));
        // For paths with multiple parameters, use the actual path structure
        if (paramNames.length > 1) {
          // Replace the resource name part with the actual path structure
          const pathParts = firstOp.path.replace(/^\//, '').split('/');
          const templateParts = pathParts.map(part => {
            if (part.startsWith('{') && part.endsWith('}')) {
              return part; // Keep the parameter as is
            }
            return part;
          });
          uriTemplate = templateParts.join('/');
        } else {
          uriTemplate = `${snakeCaseName}/{${paramNames[0]}}`;
        }
      } else {
        uriTemplate = `${snakeCaseName}/{id}`;
      }
    } else {
      uriTemplate = `${snakeCaseName}/{id}`;
    }

    // Generate methods
    const methodEntries: string[] = [];
    
    for (const [methodName, method] of Object.entries(methods)) {
      const inputSchema = method.inputSchema ? 
        `,\n      inputSchema: ${this.serializeZodSchema(method.inputSchema)}` : '';
      
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
  uri_template: "${uriTemplate}",
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

    // Add imports for method schemas
    for (const method of Object.values(resource.methods)) {
      if (method.inputSchema) {
        // This would need to be enhanced to track which schemas are used
        // For now, we'll rely on the primary schema
      }
    }

    return Array.from(imports).join('\n');
  }

  /**
   * Serialize Zod schema to string representation
   */
  private serializeZodSchema(schema: z.ZodTypeAny): string {
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
          const serialized = this.serializeZodSchema(value as z.ZodTypeAny);
          properties.push(`  ${key}: ${serialized}`);
        }
        
        return `z.object({\n${properties.join(',\n')}\n})`;
      default:
        return 'z.any()';
    }
  }
} 