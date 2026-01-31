/**
 * Pearl HTTP Server
 * OpenAI-compatible API server
 */

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { uuidv7 } from 'uuidv7';
import type { ServerConfig } from '../types.js';

// OpenAI-compatible types
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  metadata?: {
    agent_id?: string;
    session_id?: string;
  };
}

interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ErrorResponse {
  error: {
    type: string;
    message: string;
    code?: string;
  };
}

interface ModelInfo {
  id: string;
  object: 'model';
  owned_by: string;
}

// Logger interface for structured logging
interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

function createLogger(): Logger {
  const log = (level: string, message: string, data?: Record<string, unknown>) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    };
    console.log(JSON.stringify(entry));
  };

  return {
    info: (message, data) => log('info', message, data),
    warn: (message, data) => log('warn', message, data),
    error: (message, data) => log('error', message, data),
    debug: (message, data) => log('debug', message, data),
  };
}

// Validation helpers
function validateChatRequest(body: unknown): { valid: true; request: ChatCompletionRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const req = body as Record<string, unknown>;

  if (!req.model || typeof req.model !== 'string') {
    return { valid: false, error: 'model is required and must be a string' };
  }

  if (!req.messages || !Array.isArray(req.messages)) {
    return { valid: false, error: 'messages is required and must be an array' };
  }

  if (req.messages.length === 0) {
    return { valid: false, error: 'messages array cannot be empty' };
  }

  for (let i = 0; i < req.messages.length; i++) {
    const msg = req.messages[i] as Record<string, unknown>;
    if (!msg.role || typeof msg.role !== 'string') {
      return { valid: false, error: `messages[${i}].role is required and must be a string` };
    }
    if (!['system', 'user', 'assistant'].includes(msg.role as string)) {
      return { valid: false, error: `messages[${i}].role must be 'system', 'user', or 'assistant'` };
    }
    if (typeof msg.content !== 'string') {
      return { valid: false, error: `messages[${i}].content must be a string` };
    }
  }

  return { valid: true, request: body as ChatCompletionRequest };
}

// Simple token estimation (4 chars ≈ 1 token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Create mock response (will be replaced with real routing later)
function createMockResponse(messages: ChatMessage[]): string {
  const lastMessage = messages[messages.length - 1];
  return `[Pearl mock response] Received: "${lastMessage?.content?.slice(0, 50)}..."`;
}

export async function createServer(config: Partial<ServerConfig> = {}): Promise<FastifyInstance> {
  const logger = createLogger();
  const port = config.port ?? 8080;
  const host = config.host ?? '0.0.0.0';

  const server = Fastify({
    logger: false, // We use our own logger
  });

  // Health check
  server.get('/v1/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    logger.debug('Health check requested');
    return reply.send({
      status: 'healthy',
      version: '0.1.0',
      uptime_seconds: Math.floor(process.uptime()),
    });
  });

  // List models
  server.get('/v1/models', async (_request: FastifyRequest, reply: FastifyReply) => {
    logger.debug('Models list requested');
    const models: ModelInfo[] = [
      { id: 'pearl', object: 'model', owned_by: 'pearl' },
      { id: 'anthropic/claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic' },
      { id: 'anthropic/claude-3-5-haiku-20241022', object: 'model', owned_by: 'anthropic' },
    ];
    return reply.send({
      object: 'list',
      data: models,
    });
  });

  // Chat completions (main endpoint)
  server.post('/v1/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    
    // Get agent ID from header or body
    const headerAgentId = request.headers['x-pearl-agent-id'] as string | undefined;
    
    // Validate request
    const validation = validateChatRequest(request.body);
    if (!validation.valid) {
      logger.warn('Invalid chat completion request', { error: validation.error });
      return reply.status(400).send({
        error: {
          type: 'invalid_request_error',
          message: validation.error,
          code: 'invalid_request',
        },
      } satisfies ErrorResponse);
    }

    const { request: chatRequest } = validation;
    const agentId = chatRequest.metadata?.agent_id ?? headerAgentId ?? 'anonymous';

    logger.info('Chat completion request', {
      agent_id: agentId,
      model: chatRequest.model,
      message_count: chatRequest.messages.length,
    });

    // Generate mock response (will be replaced with real routing)
    const mockContent = createMockResponse(chatRequest.messages);
    const promptTokens = chatRequest.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const completionTokens = estimateTokens(mockContent);

    const response: ChatCompletionResponse = {
      id: `chatcmpl-${uuidv7()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: chatRequest.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: mockContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };

    const duration = Date.now() - startTime;
    logger.info('Chat completion response', {
      agent_id: agentId,
      duration_ms: duration,
      tokens: response.usage,
    });

    return reply.send(response);
  });

  // 404 handler
  server.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    logger.warn('Route not found', { method: request.method, url: request.url });
    return reply.status(404).send({
      error: {
        type: 'not_found_error',
        message: `Route ${request.method} ${request.url} not found`,
      },
    } satisfies ErrorResponse);
  });

  // Global error handler
  server.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      url: request.url,
    });
    return reply.status(500).send({
      error: {
        type: 'internal_error',
        message: 'An internal error occurred',
      },
    } satisfies ErrorResponse);
  });

  logger.info('Pearl server created', { port, host });

  return server;
}

// Start server if run directly
async function main() {
  const server = await createServer();
  try {
    const address = await server.listen({ port: 8080, host: '0.0.0.0' });
    console.log(`Pearl server listening at ${address}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Check if this file is being run directly (ES module check)
// Note: This will be enabled when the project is built as ESM
// For now, use: npx tsx src/server/index.ts
// if (import.meta.url === `file://${process.argv[1]}`) {
//   main();
// }
