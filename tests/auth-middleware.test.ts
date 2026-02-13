import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { createServer } from '../src/server/index.js';
import { createTestConfig, mockExternalServices } from './setup/test-helpers.js';

describe('Auth middleware', () => {
  let server: FastifyInstance;

  const apiKey = 'test-pearl-key';

  beforeEach(async () => {
    mockExternalServices();
    const testConfig = createTestConfig();
    server = await createServer({
      serverConfig: {
        port: 0,
        host: '127.0.0.1',
        auth: {
          enabled: true,
          apiKey,
        },
      },
      pearlConfig: testConfig,
    });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  it('allows requests with x-api-key', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/models',
      headers: {
        'x-api-key': apiKey,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('allows requests with Authorization bearer token', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/models',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects requests with missing credentials', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/models',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        message: 'Authentication required',
        type: 'authentication_error',
        code: 'missing_api_key',
      },
    });
  });

  it('rejects requests with invalid bearer token', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/models',
      headers: {
        Authorization: 'Bearer wrong-key',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        message: 'Invalid API key',
        type: 'authentication_error',
        code: 'invalid_api_key',
      },
    });
  });

  it('keeps health endpoint unauthenticated', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
  });
});
