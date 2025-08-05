import { z } from 'zod';

export interface GenerateOptions {
  source: string;
  outputDir: string;
  serverName: string;
  verbose?: boolean;
  format?: boolean;
}

export interface ParsedOpenAPI {
  operations: OpenAPIOperation[];
  schemas: OpenAPISchema[];
  info: OpenAPIInfo;
}

export interface OpenAPIOperation {
  method: string;
  path: string;
  operation: {
    operationId?: string;
    summary?: string;
    description?: string;
    requestBody?: {
      content?: {
        'application/json'?: {
          schema?: any;
        };
      };
    };
    responses?: Record<string, {
      content?: {
        'application/json'?: {
          schema?: any;
        };
      };
    }>;
    parameters?: Array<{
      name: string;
      in: string;
      required?: boolean;
      schema?: any;
    }>;
  };
}

export interface OpenAPISchema {
  name: string;
  schema: any;
}

export interface OpenAPIInfo {
  title?: string;
  version?: string;
  description?: string;
}

export interface GeneratedSchema {
  name: string;
  zodSchema: z.ZodTypeAny;
  fileName: string;
  typeName: string;
  warnings: string[];
}

export interface GeneratedResource {
  name: string;
  fileName: string;
  operations: OpenAPIOperation[];
  primarySchema?: string;
  methods: Record<string, ResourceMethod>;
}

export interface ResourceMethod {
  description: string;
  inputSchema?: z.ZodTypeAny;
  inputSchemaName?: string;
  handler: string;
}

export interface GeneratedCode {
  server: string;
  types: string;
  packageJson: string;
  readme: string;
  apiClient: string;
  schemaFiles: Record<string, string>;
  resourceFiles: Record<string, string>;
}

export interface ResourceGroup {
  name: string;
  operations: OpenAPIOperation[];
} 