import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../src/server/index.js';

type CapturedRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
};

function createFakePearl(
  onRequest: (request: CapturedRequest) => void,
  chunks?: Array<Record<string, unknown>>
) {
  return {
    isInitialized: () => true,
    async *chatCompletion(request: CapturedRequest) {
      onRequest(request);

      if (chunks && chunks.length > 0) {
        for (const chunk of chunks) {
          yield chunk;
        }
        return;
      }

      yield {
        id: 'test-chunk',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: 'ok' },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
        },
      };
    },
  };
}

describe('Server Message Normalization', () => {
  describe('User envelope and content block normalization', () => {
    let server: FastifyInstance;
    let captured: CapturedRequest | undefined;

    beforeAll(async () => {
      server = await createServer({
        serverConfig: { port: 0, host: '127.0.0.1' },
        pearl: createFakePearl((request) => {
          captured = request;
        }) as any,
      });
      await server.ready();
    });

    afterAll(async () => {
      await server.close();
    });

    it('preserves URL text across mixed content blocks and strips bridge metadata wrappers', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          model: 'auto',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'input_text', input_text: '[Telegram Aaron id:652119074 Tue 2026-02-17 17:31 EST] ' },
                { type: 'text', text: 'https://jobs.gem.com/bikky/' },
                { type: 'output_text', output_text: 'am9icG9zdDrP5IqcZu0IhY1Emnex5eON' },
                { type: 'text', text: '\n[message_id: 8f6308ed-8bec-4ca3-aa52-fadb45433e84]' },
              ],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(captured).toBeDefined();
      expect(captured!.messages).toHaveLength(1);
      expect(captured!.messages[0].content).toBe('https://jobs.gem.com/bikky/am9icG9zdDrP5IqcZu0IhY1Emnex5eON');
    });
  });

  describe('Tool call chunk aggregation', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
      server = await createServer({
        serverConfig: { port: 0, host: '127.0.0.1' },
        pearl: createFakePearl(
          () => {},
          [
            {
              id: 'chunk-1',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'auto',
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        id: 'call_1',
                        type: 'function',
                        function: {
                          name: 'run_job_application_automation',
                          arguments: '{"url":"https://jobs.gem.com/bikky/',
                        },
                      },
                    ],
                  },
                  finishReason: null,
                },
              ],
            },
            {
              id: 'chunk-2',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'auto',
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        type: 'function',
                        function: {
                          arguments: 'am9icG9zdDrP5IqcZu0IhY1Emnex5eON"}',
                        },
                      },
                    ],
                  },
                  finishReason: 'tool_calls',
                },
              ],
            },
          ]
        ) as any,
      });
      await server.ready();
    });

    afterAll(async () => {
      await server.close();
    });

    it('merges partial tool call arguments into one complete call', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          model: 'auto',
          messages: [{ role: 'user', content: 'Run automation on this job URL.' }],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.choices[0].finish_reason).toBe('tool_calls');
      expect(body.choices[0].message.tool_calls).toHaveLength(1);
      expect(body.choices[0].message.tool_calls[0].function.name).toBe('run_job_application_automation');
      expect(body.choices[0].message.tool_calls[0].function.arguments).toBe(
        '{"url":"https://jobs.gem.com/bikky/am9icG9zdDrP5IqcZu0IhY1Emnex5eON"}'
      );
    });
  });
});
