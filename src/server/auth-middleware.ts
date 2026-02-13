/**
 * Authentication Middleware for Pearl API
 * Implements API key authentication
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthConfig {
  enabled: boolean;
  apiKey?: string;
  headerName?: string;
}

export class AuthMiddleware {
  private config: AuthConfig;
  
  constructor(config: AuthConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      apiKey: config.apiKey,
      headerName: config.headerName ?? 'x-api-key'
    };
    
    if (this.config.enabled && !this.config.apiKey) {
      console.warn('[Auth] Authentication is enabled but no API key configured');
    }
  }
  
  /**
   * Fastify pre-handler hook for authentication
   */
  async authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Skip if authentication is disabled
    if (!this.config.enabled) {
      return;
    }
    
    // Health check endpoints don't require auth
    if (request.url === '/health' || request.url === '/api/v1/check') {
      return;
    }
    
    // If no API key is configured, allow all requests with a warning
    if (!this.config.apiKey) {
      return;
    }
    
    // Extract API key from header
    const headerName = this.config.headerName!;
    const providedKey = request.headers[headerName] as string | undefined;
    
    if (!providedKey) {
      reply.status(401).send({
        error: {
          message: 'Authentication required',
          type: 'authentication_error',
          code: 'missing_api_key'
        }
      });
      return;
    }
    
    // Validate API key
    if (providedKey !== this.config.apiKey) {
      reply.status(401).send({
        error: {
          message: 'Invalid API key',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
      return;
    }
    
    // Authentication successful
    // Attach auth info to request for downstream handlers
    (request as any).authenticated = true;
  }
  
  /**
   * Check if a request is authenticated
   */
  isAuthenticated(request: FastifyRequest): boolean {
    return (request as any).authenticated === true || !this.config.enabled;
  }
}
