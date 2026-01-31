# Pearl Architecture

## Overview

Pearl is a **model proxy** that provides two capabilities:
1. **Persistent Memory** — Automatic extraction, storage, and retrieval of memorable content
2. **Intelligent Routing** — Route requests to optimal models based on cost/speed/quality

Pearl presents itself as an OpenAI-compatible model endpoint. OpenClaw (or any client) sends requests to Pearl, which processes them and forwards to the appropriate backend model.

## Design Principles

1. **Invisible to agents** — Agents don't know Pearl exists. They just get enriched prompts.
2. **No OpenClaw changes** — Pearl is just another model endpoint.
3. **Local-first** — Memory extraction and embeddings use local models by default.
4. **Privacy-aware** — Sensitive content can be forced to local-only models.
5. **Async extraction** — Memory extraction doesn't block request processing.

## System Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST FLOW                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. OpenClaw sends chat completion request to Pearl                         │
│     POST /v1/chat/completions                                                │
│     { model: "pearl", messages: [...], metadata: { agent_id, session_id }}  │
│                                                                              │
│  2. Pearl extracts agent_id from metadata (or generates from API key)       │
│                                                                              │
│  3. EXTRACT (async, non-blocking):                                          │
│     - Queue user message for memory extraction                               │
│     - Background worker classifies and stores memories                       │
│                                                                              │
│  4. RETRIEVE:                                                                │
│     - Embed the user message                                                 │
│     - Semantic search against agent's memory store                          │
│     - Retrieve top-N relevant memories (respect token budget)               │
│                                                                              │
│  5. AUGMENT:                                                                 │
│     - Prepend memories to system message                                     │
│     - Track injected memory IDs for this session                            │
│                                                                              │
│  6. ROUTE:                                                                   │
│     - Analyze prompt (complexity, length, type, sensitivity)                │
│     - Select backend model based on routing rules                           │
│     - Forward augmented request to backend                                  │
│                                                                              │
│  7. STREAM/RETURN:                                                          │
│     - Stream response back to OpenClaw                                       │
│     - (Optional) Queue assistant response for memory extraction             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. HTTP Server

**Technology:** Node.js with Fastify (or Hono for edge compatibility)

**Endpoints:**
- `POST /v1/chat/completions` — Main endpoint (OpenAI-compatible)
- `GET /v1/models` — List available models
- `GET /v1/memories` — List memories for agent
- `POST /v1/memories` — Manually add memory
- `DELETE /v1/memories/:id` — Delete memory
- `GET /v1/health` — Health check
- `GET /v1/stats` — Usage statistics

**Request metadata:**
OpenClaw can pass agent context via:
- Custom header: `X-Pearl-Agent-Id`
- Request body: `metadata.agent_id`
- Derived from API key (if using per-agent keys)

### 2. Memory Extractor

**Purpose:** Identify memorable content in messages and store it.

**Process:**
1. Receive message text
2. Call local LLM with classification prompt
3. Parse response for memory candidates
4. Store each memory with type, content, tags

**Classification prompt:**
```
Analyze this message for content worth remembering long-term.
Look for: facts, preferences, rules, decisions, health info, dates, people.
Return JSON: { "memories": [{ "type": "...", "content": "...", "tags": [...] }] }
If nothing memorable, return: { "memories": [] }

Message: {user_message}
```

**Memory types:**
- `fact` — Concrete information (names, dates, addresses)
- `preference` — User likes/dislikes
- `rule` — Instructions for agent behavior
- `decision` — Choices made with reasoning
- `health` — Medical/health information
- `reminder` — Time-based reminders
- `relationship` — People and their connections

### 3. Memory Store

**Technology:** SQLite with better-sqlite3 (sync, fast, no deps)

**Schema:**
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,  -- JSON array
  embedding BLOB,  -- Float32 array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accessed_at INTEGER,
  access_count INTEGER DEFAULT 0,
  expires_at INTEGER,
  source_session TEXT,
  source_message_id TEXT
);

CREATE INDEX idx_memories_agent ON memories(agent_id);
CREATE INDEX idx_memories_type ON memories(agent_id, type);
CREATE INDEX idx_memories_created ON memories(agent_id, created_at);
```

**Operations:**
- `create(agentId, memory)` — Store new memory with embedding
- `search(agentId, query, limit)` — Semantic search
- `get(agentId, id)` — Get specific memory
- `update(agentId, id, updates)` — Update memory
- `delete(agentId, id)` — Delete memory
- `listByType(agentId, type)` — List all of a type
- `prune(agentId, maxAge)` — Remove old memories

### 4. Embedding Service

**Purpose:** Generate embeddings for semantic search.

**Options:**
- **Local (default):** Ollama with nomic-embed-text (768 dims)
- **API:** OpenAI text-embedding-3-small (1536 dims)

**Interface:**
```typescript
interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

**Similarity:** Cosine similarity for retrieval.

### 5. Memory Retriever

**Purpose:** Find relevant memories for a prompt.

**Process:**
1. Embed the incoming prompt
2. Vector similarity search against agent's memories
3. Filter by recency, type, and relevance threshold
4. Respect token budget (configurable, default 500 tokens)
5. Return formatted memories

**Retrieval config:**
```yaml
retrieval:
  max_memories: 10
  min_similarity: 0.7
  token_budget: 500
  recency_boost: true  # Recent memories rank higher
  type_weights:        # Some types more important
    rule: 1.5
    decision: 1.3
    preference: 1.2
```

### 6. Prompt Augmenter

**Purpose:** Inject memories into the prompt without agent awareness.

**Strategy:**
Prepend to system message:
```
[CONTEXT: The following information is relevant to this conversation]
- User prefers concise responses
- User's timezone is America/Denver
- Decision (2024-01-15): Use SQLite for storage
[END CONTEXT]

{original_system_message}
```

**Session tracking:**
Track which memories have been injected this session to avoid repetition:
```typescript
const sessionMemories = new Map<string, Set<string>>();
// sessionId -> Set of memory IDs already injected
```

### 7. Model Router

**Purpose:** Select the optimal backend model for each request.

**Factors:**
- **Complexity:** Simple question vs. multi-step reasoning
- **Length:** Short query vs. long document
- **Type:** General, code, creative, analysis
- **Sensitivity:** Contains PII, health info, secrets
- **Cost:** Budget constraints
- **Latency:** Time sensitivity

**Routing rules (evaluated in order):**
```yaml
routing:
  rules:
    # Sensitive content → local only
    - match: { sensitive: true }
      model: ollama/llama3.1:70b
    
    # Code tasks → Claude
    - match: { type: code }
      model: anthropic/claude-sonnet-4-20250514
    
    # Simple, short queries → fast/cheap
    - match: { complexity: low, tokens: "<500" }
      model: anthropic/claude-3-5-haiku-20241022
    
    # Default
    - match: { default: true }
      model: anthropic/claude-sonnet-4-20250514
```

**Classification prompt (for complexity/type):**
```
Classify this prompt:
- complexity: low/medium/high
- type: general/code/creative/analysis/chat
- sensitive: true/false (contains PII, health, secrets)

Prompt: {prompt}
Return JSON: { "complexity": "...", "type": "...", "sensitive": false }
```

### 8. Backend Clients

**Purpose:** Forward requests to actual LLM providers.

**Supported backends:**
- Anthropic (Claude)
- OpenAI (GPT)
- Ollama (local)
- OpenRouter (multi-provider)

**Interface:**
```typescript
interface BackendClient {
  chat(request: ChatRequest): AsyncGenerator<ChatChunk>;
  models(): Promise<Model[]>;
}
```

## Data Flow Examples

### Example 1: Simple Query

```
User: "What's the weather like?"

1. EXTRACT: No memorable content → skip
2. RETRIEVE: No relevant memories
3. AUGMENT: No changes to prompt
4. ROUTE: complexity=low, type=general → haiku
5. Forward to Claude Haiku
6. Stream response
```

### Example 2: Preference Statement

```
User: "I prefer dark mode and minimal UIs"

1. EXTRACT: 
   - Memory: { type: "preference", content: "prefers dark mode" }
   - Memory: { type: "preference", content: "prefers minimal UIs" }
   - Store both with embeddings

2. RETRIEVE: No relevant memories for this statement
3. AUGMENT: No injection needed
4. ROUTE: complexity=low → haiku
5. Forward, stream response
```

### Example 3: Query with Relevant Memory

```
User: "Can you help me with the login page design?"

1. EXTRACT: No memorable content
2. RETRIEVE: 
   - Found: "prefers dark mode" (similarity: 0.82)
   - Found: "prefers minimal UIs" (similarity: 0.79)
3. AUGMENT:
   [CONTEXT]
   - User prefers dark mode
   - User prefers minimal UIs
   [END CONTEXT]
4. ROUTE: complexity=medium, type=code → sonnet
5. Forward augmented prompt, stream response
```

## Configuration

### Full config example:

```yaml
# pearl.yaml
server:
  port: 8080
  host: 0.0.0.0
  cors: true

memory:
  store: sqlite
  path: ~/.pearl/memories.db
  
extraction:
  enabled: true
  model: ollama/llama3.2:3b
  async: true
  extract_from_assistant: false  # Also extract from responses?
  
embedding:
  provider: ollama
  model: nomic-embed-text
  dimensions: 768
  
retrieval:
  max_memories: 10
  min_similarity: 0.7
  token_budget: 500
  recency_boost: true
  
routing:
  classifier: ollama/llama3.2:3b  # For complexity/type classification
  default_model: anthropic/claude-sonnet-4-20250514
  rules:
    - match: { sensitive: true }
      model: ollama/llama3.1:70b
    - match: { type: code }
      model: anthropic/claude-sonnet-4-20250514
    - match: { complexity: low }
      model: anthropic/claude-3-5-haiku-20241022

backends:
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
  openai:
    api_key: ${OPENAI_API_KEY}
  ollama:
    base_url: http://localhost:11434

logging:
  level: info
  file: ~/.pearl/pearl.log
```

## Security Considerations

1. **Memory isolation:** Each agent has separate memory namespace
2. **No cross-agent leakage:** Memories never shared between agents
3. **Sensitive routing:** PII/health auto-routes to local models
4. **API key security:** Keys stored in env vars, never logged
5. **Memory expiration:** Old memories can auto-expire
6. **Audit logging:** Track all memory access

## Performance

- **Extraction:** Async, doesn't block requests (~50-100ms background)
- **Retrieval:** SQLite + vector search (~5-20ms for 1000 memories)
- **Augmentation:** String concat (~<1ms)
- **Routing:** Classification ~50ms (can be cached)
- **Total overhead:** ~20-70ms typical (mostly retrieval)

## Future Enhancements

1. **Shared memories:** Cross-agent knowledge base
2. **Memory consolidation:** Merge related memories
3. **Forgetting:** Automatically forget low-value memories
4. **Learning:** Improve extraction from feedback
5. **Multi-modal:** Remember images, files
6. **Distributed:** Redis/Postgres for multi-instance
