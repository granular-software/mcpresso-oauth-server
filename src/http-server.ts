import express from 'express'
import cors, { CorsOptions } from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { MCPOAuthServer } from './oauth-server.js'
import type { MCPOAuthConfig, HTTPServerConfig } from './types.js'

export function registerOAuthEndpoints(app: express.Application, oauthServer: MCPOAuthServer, basePath = "") {
  // Authorization endpoint (GET - show login page or redirect)
  app.get(`${basePath}/authorize`, async (req, res) => {
    try {
      const params = {
        response_type: req.query.response_type as 'code',
        client_id: req.query.client_id as string,
        redirect_uri: req.query.redirect_uri as string,
        scope: req.query.scope as string,
        state: req.query.state as string,
        resource: req.query.resource as string,
        code_challenge: req.query.code_challenge as string,
        code_challenge_method: req.query.code_challenge_method as 'S256' | 'plain'
      }

      const requestContext = {
        ipAddress: req.ip || req.connection.remoteAddress || '0.0.0.0',
        userAgent: req.headers['user-agent']
      }

      const result = await oauthServer.handleAuthorizationRequest(params, undefined, (req as any).session, requestContext)
      
      if ('error' in result) {
        return res.status(400).json(result)
      }
      
      if ('loginPage' in result) {
        return res.type('html').send(result.loginPage)
      }
      
      if ('redirectUrl' in result) {
        res.redirect(result.redirectUrl)
      }
    } catch (error) {
      console.error('Authorization error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // Authorization endpoint (POST - handle login form submission)
  app.post(`${basePath}/authorize`, async (req, res) => {
    try {
      const params = {
        response_type: req.body.response_type as 'code',
        client_id: req.body.client_id as string,
        redirect_uri: req.body.redirect_uri as string,
        scope: req.body.scope as string,
        state: req.body.state as string,
        resource: req.body.resource as string,
        code_challenge: req.body.code_challenge as string,
        code_challenge_method: req.body.code_challenge_method as 'S256' | 'plain'
      }

      const credentials = req.body.username && req.body.password ? {
        username: req.body.username as string,
        password: req.body.password as string
      } : undefined

      const requestContext = {
        ipAddress: req.ip || req.connection.remoteAddress || '0.0.0.0',
        userAgent: req.headers['user-agent']
      }

      const result = await oauthServer.handleAuthorizationRequest(params, credentials, (req as any).session, requestContext)
      
      if ('error' in result) {
        return res.status(400).json(result)
      }
      
      if ('loginPage' in result) {
        return res.type('html').send(result.loginPage)
      }
      
      if ('redirectUrl' in result) {
        res.redirect(result.redirectUrl)
      }
    } catch (error) {
      console.error('Authorization error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // Token endpoint
  app.post(`${basePath}/token`, async (req, res) => {
    try {
      const params = {
        grant_type: req.body.grant_type as 'authorization_code' | 'refresh_token' | 'client_credentials',
        client_id: req.body.client_id as string,
        client_secret: req.body.client_secret as string,
        code: req.body.code as string,
        redirect_uri: req.body.redirect_uri as string,
        refresh_token: req.body.refresh_token as string,
        scope: req.body.scope as string,
        resource: req.body.resource as string,
        code_verifier: req.body.code_verifier as string
      }
      const result = await oauthServer.handleTokenRequest(params)
      if ('error' in result) {
        return res.status(400).json(result)
      }
      res.json(result)
    } catch (error) {
      console.error('Token error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // Token introspection endpoint
  app.post(`${basePath}/introspect`, async (req, res) => {
    try {
      const { token } = req.body
      if (!token) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'token parameter is required' })
      }

      const result = await oauthServer.introspectToken(token)
      res.json(result)
    } catch (error) {
      console.error('Introspection error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // Token revocation endpoint
  app.post(`${basePath}/revoke`, async (req, res) => {
    try {
      const { token, client_id } = req.body
      if (!token || !client_id) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'token and client_id parameters are required' })
      }

      const result = await oauthServer.revokeToken(token, client_id)
      res.json(result)
    } catch (error) {
      console.error('Revocation error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // User info endpoint
  app.get(`${basePath}/userinfo`, async (req, res) => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'invalid_token', error_description: 'Bearer token required' })
      }

      const token = authHeader.substring(7)
      const result = await oauthServer.getUserInfo(token)
      
      if ('error' in result) {
        return res.status(401).json(result)
      }

      res.json(result)
    } catch (error) {
      console.error('User info error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // Dynamic client registration endpoint (RFC 7591)
  app.post(`${basePath}/register`, async (req, res) => {
    try {
      const result = await oauthServer.registerClient(req.body)
      
      if ('error' in result) {
        return res.status(400).json(result)
      }

      res.status(201).json(result)
    } catch (error) {
      console.error('Client registration error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // ===== DISCOVERY ENDPOINTS =====

  // OAuth Authorization Server Metadata (RFC 8414)
  app.get(`${basePath}/.well-known/oauth-authorization-server`, (req, res) => {
    const metadata = oauthServer.getAuthorizationServerMetadata()
    res.json(metadata)
  })

  // JWKS endpoint
  app.get(`${basePath}/.well-known/jwks.json`, (req, res) => {
    // For now, return empty JWKS since we're using HMAC
    // In production, you'd use RSA keys
    res.json({ keys: [] })
  })

  // MCP Protected Resource Metadata (RFC 9728) - FIXED ENDPOINT
  app.get(`${basePath}/.well-known/oauth-protected-resource`, (req, res) => {
    const metadata = oauthServer.getProtectedResourceMetadata()
    res.json(metadata)
  })

  // ===== ADMIN ENDPOINTS =====

  // Health check
  app.get(`${basePath}/health`, (req, res) => {
    res.json({
      status: 'ok',
      service: 'mcp-oauth-server',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    })
  })

  // List clients
  app.get(`${basePath}/admin/clients`, async (req, res) => {
    try {
      const clients = await oauthServer.listClients()
      res.json(clients)
    } catch (error) {
      console.error('List clients error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // List users
  app.get(`${basePath}/admin/users`, async (req, res) => {
    try {
      const users = await oauthServer.listUsers()
      res.json(users)
    } catch (error) {
      console.error('List users error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // Server stats
  app.get(`${basePath}/admin/stats`, async (req, res) => {
    try {
      const stats = await oauthServer.getStats()
      res.json(stats)
    } catch (error) {
      console.error('Stats error:', error)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })

  // 404 handler
  // app.use(`${basePath}/*`, (req, res) => {
  //   res.status(404).json({ 
  //     error: 'not_found', 
  //     error_description: 'Endpoint not found',
  //     path: req.originalUrl
  //   })
  // })
}

export class MCPOAuthHttpServer {
  private app: express.Application
  private oauthServer: MCPOAuthServer
  private config: MCPOAuthConfig

  constructor(oauthServer: MCPOAuthServer, config: MCPOAuthConfig) {
    this.oauthServer = oauthServer
    this.config = config
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  private setupMiddleware(): void {
    const httpConfig = this.config.http || {}
    
    // Trust proxy (important for production behind load balancers)
    if (httpConfig.trustProxy !== undefined) {
      this.app.set('trust proxy', httpConfig.trustProxy)
    }

    // Security headers
    if (httpConfig.enableHelmet !== false) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      }))
    }

    // Compression
    if (httpConfig.enableCompression !== false) {
      this.app.use(compression())
    }

    // Rate limiting
    if (httpConfig.enableRateLimit !== false) {
      const rateLimitConfig = httpConfig.rateLimitConfig || {}
      const limiter = rateLimit({
        windowMs: rateLimitConfig.windowMs || 15 * 60 * 1000, // 15 minutes
        max: rateLimitConfig.max || 100, // limit each IP to 100 requests per windowMs
        message: rateLimitConfig.message || 'Too many requests from this IP, please try again later.',
        standardHeaders: rateLimitConfig.standardHeaders !== false, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: rateLimitConfig.legacyHeaders !== false, // Disable the `X-RateLimit-*` headers
      })
      this.app.use(limiter)
    }

    // CORS configuration - use provided config or sensible defaults
    const corsConfig: CorsOptions = httpConfig.cors || {
      origin: true, // Allow all origins by default
      credentials: true,
      exposedHeaders: ["mcp-session-id"],
      allowedHeaders: ["Content-Type", "mcp-session-id", "accept", "last-event-id", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
    this.app.use(cors(corsConfig))

    // JSON parsing with configurable limits
    this.app.use(express.json({ 
      limit: httpConfig.jsonLimit || '10mb' 
    }))
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: httpConfig.urlencodedLimit || '10mb' 
    }))
  }

  private setupRoutes(): void {
    // ===== OAUTH 2.1 ENDPOINTS =====

    // Authorization endpoint
    this.app.get('/authorize', async (req, res) => {
      try {
        const params = {
          response_type: req.query.response_type as 'code',
          client_id: req.query.client_id as string,
          redirect_uri: req.query.redirect_uri as string,
          scope: req.query.scope as string,
          state: req.query.state as string,
          resource: req.query.resource as string,
          code_challenge: req.query.code_challenge as string,
          code_challenge_method: req.query.code_challenge_method as 'S256' | 'plain'
        }

        const requestContext = {
          ipAddress: req.ip || req.connection.remoteAddress || '0.0.0.0',
          userAgent: req.headers['user-agent']
        }

        const result = await this.oauthServer.handleAuthorizationRequest(params, undefined, (req as any).session, requestContext)
        
        if ('error' in result) {
          return res.status(400).json(result)
        }
        
        if ('loginPage' in result) {
          return res.type('html').send(result.loginPage)
        }
        
        if ('redirectUrl' in result) {
          res.redirect(result.redirectUrl)
        }
      } catch (error) {
        console.error('Authorization error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // Authorization endpoint (POST - handle login form submission)
    this.app.post('/authorize', async (req, res) => {
      try {
        const params = {
          response_type: req.body.response_type as 'code',
          client_id: req.body.client_id as string,
          redirect_uri: req.body.redirect_uri as string,
          scope: req.body.scope as string,
          state: req.body.state as string,
          resource: req.body.resource as string,
          code_challenge: req.body.code_challenge as string,
          code_challenge_method: req.body.code_challenge_method as 'S256' | 'plain'
        }

        const credentials = req.body.username && req.body.password ? {
          username: req.body.username as string,
          password: req.body.password as string
        } : undefined

        const requestContext = {
          ipAddress: req.ip || req.connection.remoteAddress || '0.0.0.0',
          userAgent: req.headers['user-agent']
        }

        const result = await this.oauthServer.handleAuthorizationRequest(params, credentials, (req as any).session, requestContext)
        
        if ('error' in result) {
          return res.status(400).json(result)
        }
        
        if ('loginPage' in result) {
          return res.type('html').send(result.loginPage)
        }
        
        if ('redirectUrl' in result) {
          res.redirect(result.redirectUrl)
        }
      } catch (error) {
        console.error('Authorization error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // Token endpoint
    this.app.post('/token', async (req, res) => {
      try {
        const params = {
          grant_type: req.body.grant_type as 'authorization_code' | 'refresh_token' | 'client_credentials',
          client_id: req.body.client_id as string,
          client_secret: req.body.client_secret as string,
          code: req.body.code as string,
          redirect_uri: req.body.redirect_uri as string,
          refresh_token: req.body.refresh_token as string,
          scope: req.body.scope as string,
          resource: req.body.resource as string,
          code_verifier: req.body.code_verifier as string
        }

        const result = await this.oauthServer.handleTokenRequest(params)
        
        if ('error' in result) {
          return res.status(400).json(result)
        }

        res.json(result)
      } catch (error) {
        console.error('Token error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // Token introspection endpoint
    this.app.post('/introspect', async (req, res) => {
      try {
        const { token } = req.body
        if (!token) {
          return res.status(400).json({ error: 'invalid_request', error_description: 'token parameter is required' })
        }

        const result = await this.oauthServer.introspectToken(token)
        res.json(result)
      } catch (error) {
        console.error('Introspection error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // Token revocation endpoint
    this.app.post('/revoke', async (req, res) => {
      try {
        const { token, client_id } = req.body
        if (!token || !client_id) {
          return res.status(400).json({ error: 'invalid_request', error_description: 'token and client_id parameters are required' })
        }

        const result = await this.oauthServer.revokeToken(token, client_id)
        res.json(result)
      } catch (error) {
        console.error('Revocation error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // User info endpoint
    this.app.get('/userinfo', async (req, res) => {
      try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'invalid_token', error_description: 'Bearer token required' })
        }

        const token = authHeader.substring(7)
        const result = await this.oauthServer.getUserInfo(token)
        
        if ('error' in result) {
          return res.status(401).json(result)
        }

        res.json(result)
      } catch (error) {
        console.error('User info error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // Dynamic client registration endpoint (RFC 7591)
    this.app.post('/register', async (req, res) => {
      try {
        const result = await this.oauthServer.registerClient(req.body)
        
        if ('error' in result) {
          return res.status(400).json(result)
        }

        res.status(201).json(result)
      } catch (error) {
        console.error('Client registration error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // ===== DISCOVERY ENDPOINTS =====

    // OAuth Authorization Server Metadata (RFC 8414)
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
      const metadata = this.oauthServer.getAuthorizationServerMetadata()
      res.json(metadata)
    })

    // JWKS endpoint
    this.app.get('/.well-known/jwks.json', (req, res) => {
      // For now, return empty JWKS since we're using HMAC
      // In production, you'd use RSA keys
      res.json({ keys: [] })
    })

    // MCP Protected Resource Metadata (RFC 9728) - FIXED ENDPOINT
    this.app.get('/.well-known/oauth-protected-resource', (req, res) => {
      const metadata = this.oauthServer.getProtectedResourceMetadata()
      res.json(metadata)
    })

    // ===== ADMIN ENDPOINTS =====

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'mcp-oauth-server',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      })
    })

    // List clients
    this.app.get('/admin/clients', async (req, res) => {
      try {
        const clients = await this.oauthServer.listClients()
        res.json(clients)
      } catch (error) {
        console.error('List clients error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // List users
    this.app.get('/admin/users', async (req, res) => {
      try {
        const users = await this.oauthServer.listUsers()
        res.json(users)
      } catch (error) {
        console.error('List users error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // Server stats
    this.app.get('/admin/stats', async (req, res) => {
      try {
        const stats = await this.oauthServer.getStats()
        res.json(stats)
      } catch (error) {
        console.error('Stats error:', error)
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
      }
    })

    // 404 handler
    // this.app.use('*', (req, res) => {
    //   res.status(404).json({ 
    //     error: 'not_found', 
    //     error_description: 'Endpoint not found',
    //     path: req.originalUrl
    //   })
    // })
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error)
      
      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development'
      
      res.status(500).json({
        error: 'server_error',
        error_description: isDevelopment ? error.message : 'Internal server error',
        ...(isDevelopment && { stack: error.stack })
      })
    })
  }

  getApp(): express.Application {
    return this.app
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, () => {
        console.log(`MCP OAuth Server running on port ${port}`)
        console.log(`Health check: http://localhost:${port}/health`)
        console.log(`Authorization endpoint: http://localhost:${port}/authorize`)
        console.log(`Token endpoint: http://localhost:${port}/token`)
        console.log(`Discovery: http://localhost:${port}/.well-known/oauth-authorization-server`)
        resolve()
      })

      server.on('error', (error) => {
        console.error('Failed to start server:', error)
        reject(error)
      })
    })
  }
} 