# Pearl API Reference

## Overview

Pearl exposes an **OpenAI-compatible API** at `/v1/chat/completions`, plus additional endpoints for memory management and stats.

Base URL: `http://localhost:8080` (configurable)

## Authentication

Pearl supports API key authentication:

```bash
curl -H "Authorization: Bearer pearl_sk_xxx" ...
```

Or pass agent context via header:
```bash
curl -H "X-Pearl-Agent-Id: main" ...
```

## Endpoints

### Chat Completions

**OpenAI-compatible chat endpoint.**

```
POST /v1/chat/completions
```

#### Request

```json
{
  "model": "pearl",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 4096,
  "metadata": {
    "agent_id": "main",
    "session_id": "sess_abc123"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| model | string | Yes | Use "pearl" or specific backend model |
| messages | array | Yes | Chat messages |
| stream | boolean | No | Stream response (default: false) |
| temperature | number | No | Sampling temperature (default: 1.0) |
| max_tokens | number | No | Max response tokens |
| metadata.agent_id | string | No | Agent namespace for memories |
| metadata.session_id | string | No | Session ID for dedup tracking |

#### Response (Non-Streaming)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1704067200,
  "model": "anthropic/claude-sonnet-4-20250514",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 10,
    "total_tokens": 35
  },
  "pearl": {
    "memories_injected": 3,
    "routed_to": "anthropic/claude-sonnet-4-20250514",
    "classification": {
      "complexity": "low",
      "type": "chat",
      "sensitive": false
    }
  }
}
```

#### Response (Streaming)

Server-sent events (SSE):

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"delta":{"content":"!"}}]}

data: [DONE]
```

### List Models

**Get available models through Pearl.**

```
GET /v1/models
```

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "pearl",
      "object": "model",
      "owned_by": "pearl"
    },
    {
      "id": "anthropic/claude-sonnet-4-20250514",
      "object": "model",
      "owned_by": "anthropic"
    },
    {
      "id": "anthropic/claude-3-5-haiku-20241022",
      "object": "model",
      "owned_by": "anthropic"
    },
    {
      "id": "ollama/llama3.1:70b",
      "object": "model",
      "owned_by": "ollama"
    }
  ]
}
```

### List Memories

**Get memories for an agent.**

```
GET /v1/memories?agent_id=main&type=preference&limit=50
```

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| agent_id | string | Required. Agent namespace |
| type | string | Filter by memory type |
| limit | number | Max results (default: 100) |
| offset | number | Pagination offset |
| search | string | Text search query |

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "018d5f3c-5b3b-7000-8000-000000000000",
      "agent_id": "main",
      "type": "preference",
      "content": "User prefers concise responses",
      "tags": ["communication", "style"],
      "confidence": 0.9,
      "created_at": 1704067200,
      "updated_at": 1704067200,
      "accessed_at": 1704153600,
      "access_count": 5
    }
  ],
  "total": 1
}
```

### Get Memory

**Get a specific memory by ID.**

```
GET /v1/memories/:id
```

#### Response

```json
{
  "id": "018d5f3c-5b3b-7000-8000-000000000000",
  "agent_id": "main",
  "type": "preference",
  "content": "User prefers concise responses",
  "tags": ["communication", "style"],
  "confidence": 0.9,
  "created_at": 1704067200,
  "updated_at": 1704067200,
  "accessed_at": 1704153600,
  "access_count": 5
}
```

### Create Memory

**Manually add a memory.**

```
POST /v1/memories
```

#### Request

```json
{
  "agent_id": "main",
  "type": "rule",
  "content": "Always format code with 2-space indentation",
  "tags": ["code", "formatting"],
  "expires_at": 1735689600
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agent_id | string | Yes | Agent namespace |
| type | string | Yes | Memory type |
| content | string | Yes | Memory content |
| tags | array | No | Tags for categorization |
| expires_at | number | No | Unix timestamp for expiration |

#### Response

```json
{
  "id": "018d5f3c-5b3b-7000-8000-000000000001",
  "agent_id": "main",
  "type": "rule",
  "content": "Always format code with 2-space indentation",
  "tags": ["code", "formatting"],
  "confidence": 1.0,
  "created_at": 1704067200,
  "updated_at": 1704067200
}
```

### Update Memory

**Update an existing memory.**

```
PUT /v1/memories/:id
```

#### Request

```json
{
  "content": "Updated content",
  "tags": ["new", "tags"]
}
```

#### Response

```json
{
  "id": "018d5f3c-5b3b-7000-8000-000000000000",
  "agent_id": "main",
  "type": "preference",
  "content": "Updated content",
  "tags": ["new", "tags"],
  "updated_at": 1704153600
}
```

### Delete Memory

**Delete a memory.**

```
DELETE /v1/memories/:id
```

#### Response

```json
{
  "deleted": true,
  "id": "018d5f3c-5b3b-7000-8000-000000000000"
}
```

### Search Memories

**Semantic search across memories.**

```
POST /v1/memories/search
```

#### Request

```json
{
  "agent_id": "main",
  "query": "user interface preferences",
  "limit": 10,
  "min_similarity": 0.7,
  "types": ["preference", "rule"]
}
```

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "018d5f3c-5b3b-7000-8000-000000000000",
      "type": "preference",
      "content": "User prefers dark mode",
      "similarity": 0.85
    },
    {
      "id": "018d5f3c-5b3b-7000-8000-000000000001",
      "type": "preference",
      "content": "User prefers minimal UIs",
      "similarity": 0.82
    }
  ]
}
```

### Health Check

**Check Pearl service health.**

```
GET /v1/health
```

#### Response

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 3600,
  "backends": {
    "anthropic": "connected",
    "ollama": "connected"
  },
  "memory_store": "connected"
}
```

### Stats

**Get usage statistics.**

```
GET /v1/stats
```

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| period | string | Time period: "hour", "day", "week", "month" |
| agent_id | string | Filter by agent |

#### Response

```json
{
  "period": "day",
  "start": "2024-01-01T00:00:00Z",
  "end": "2024-01-01T23:59:59Z",
  "requests": {
    "total": 500,
    "by_model": {
      "anthropic/claude-3-5-haiku-20241022": 350,
      "anthropic/claude-sonnet-4-20250514": 140,
      "ollama/llama3.1:70b": 10
    }
  },
  "tokens": {
    "input": 250000,
    "output": 125000
  },
  "cost_usd": 2.50,
  "memories": {
    "created": 45,
    "retrieved": 380
  },
  "latency": {
    "p50_ms": 450,
    "p95_ms": 1200,
    "p99_ms": 2500
  }
}
```

### Routing Stats

**Get routing statistics and savings.**

```
GET /v1/stats/routing
```

#### Response

```json
{
  "period": "month",
  "total_requests": 10000,
  "by_classification": {
    "low": 6500,
    "medium": 3000,
    "high": 500
  },
  "by_type": {
    "general": 5000,
    "code": 2500,
    "chat": 2000,
    "creative": 500
  },
  "routing_decisions": {
    "anthropic/claude-3-5-haiku-20241022": 6500,
    "anthropic/claude-sonnet-4-20250514": 3000,
    "ollama/llama3.1:70b": 500
  },
  "cost": {
    "actual_usd": 45.00,
    "without_routing_usd": 150.00,
    "savings_usd": 105.00,
    "savings_percent": 70
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "type": "invalid_request_error",
    "message": "agent_id is required",
    "code": "missing_required_field"
  }
}
```

### Error Types

| Type | HTTP Code | Description |
|------|-----------|-------------|
| invalid_request_error | 400 | Bad request |
| authentication_error | 401 | Invalid/missing API key |
| not_found_error | 404 | Resource not found |
| rate_limit_error | 429 | Too many requests |
| backend_error | 502 | Backend model failed |
| internal_error | 500 | Server error |

## WebSocket (Future)

Real-time memory updates:

```javascript
const ws = new WebSocket('ws://localhost:8080/v1/memories/stream?agent_id=main');

ws.onmessage = (event) => {
  const { type, memory } = JSON.parse(event.data);
  // type: "created" | "updated" | "deleted"
  console.log(`Memory ${type}:`, memory);
};
```
