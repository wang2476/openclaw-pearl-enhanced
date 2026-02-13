# Using Pearl

Pearl is now fully operational with advanced weighted routing, memory extraction, and intelligent model selection. However, it works best as a **standalone API server** rather than being integrated into OpenClaw's routing system.

## Why Not OpenClaw Integration?

OpenClaw's configuration schema (`openclaw.json`) doesn't support custom OpenAI-compatible providers. The config only recognizes:
- `anthropic/*` - Official Anthropic models
- `openai/*` - Official OpenAI models
- `ollama/*` - Local Ollama models

There's no mechanism to define custom providers with `baseURL` and `apiKey` fields in the JSON configuration.

## Pearl as a Standalone Server

Pearl is designed to be a **meta-router** that sits in front of your LLM providers. Instead of routing within OpenClaw, you route TO Pearl, and Pearl routes to the optimal backend.

### Current Configuration

Pearl is running at `http://localhost:8080` with:

**7-tier intelligent routing rules:**
1. **large-context-to-sonnet** (priority 7) - Routes 100K+ token requests to Claude Sonnet
2. **reasoning-to-deepseek** (priority 6) - Routes complex analysis to DeepSeek-R1
3. **sensitive-to-local** (priority 5) - Routes sensitive data to local Ollama
4. **short-to-ollama** (priority 4) - Routes simple queries (<500 tokens) to Ollama
5. **code-to-sonnet** (priority 3) - Routes code tasks to Claude Sonnet
6. **medium-to-haiku** (priority 2) - Routes medium tasks to Claude Haiku
7. **default** (priority 1) - Fallback to Claude Sonnet

**Weighted 15-dimensional classification:**
- Reasoning markers: 0.18
- Code presence: 0.15
- Technical depth: 0.12
- Question complexity: 0.10
- Context requirements: 0.08
- Token estimation: 0.07
- ... and 9 more dimensions

**Fallback chains:**
```yaml
ollama/llama3.2 → anthropic/claude-haiku-4-5
ollama/DeepSeek-R1:32B → anthropic/claude-sonnet-4-5 → anthropic/claude-haiku-4-5
anthropic/claude-sonnet-4-5 → anthropic/claude-haiku-4-5 → ollama/llama3.2
```

## Using Pearl via API

### 1. Basic Chat Completion

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "What is JSON?"}
    ]
  }'
```

Pearl will:
1. Classify the request (weighted scoring: ~0.05 = low complexity, chat type)
2. Route to `ollama/llama3.2` (matches "short-to-ollama" rule)
3. Return the response with routing metadata

### 2. Complex Reasoning Task

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Prove that the square root of 2 is irrational using contradiction."}
    ]
  }'
```

Pearl will:
1. Detect high reasoning markers (0.3+), high question complexity (0.4+)
2. Classify as high complexity, analysis type
3. Route to `ollama/DeepSeek-R1:32B` (matches "reasoning-to-deepseek" rule)
4. Fall back to Claude Sonnet if DeepSeek fails

### 3. Code Generation

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Write a TypeScript function to merge two sorted arrays"}
    ]
  }'
```

Pearl will:
1. Detect code presence (0.3+), technical depth (0.4+)
2. Classify as medium/high complexity, code type
3. Route to `anthropic/claude-sonnet-4-5` (matches "code-to-sonnet" rule)

### 4. Sensitive Data

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Here is my password: hunter2. Can you encrypt it?"}
    ]
  }'
```

Pearl will:
1. Detect sensitive data (password mention)
2. Set `sensitive: true` flag
3. Route to `ollama/llama3.2` (matches "sensitive-to-local" rule, keeps data local)

### 5. Large Context

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Analyze this codebase: [paste 50K tokens]"}
    ]
  }'
```

Pearl will:
1. Estimate tokens > 100K
2. Route to `anthropic/claude-sonnet-4-5` (matches "large-context-to-sonnet" rule)

## Routing Metadata

Pearl includes routing information in responses:

```json
{
  "choices": [...],
  "model": "ollama/llama3.2",
  "usage": {...},
  "pearl": {
    "classification": {
      "complexity": "low",
      "type": "chat",
      "sensitive": false,
      "estimatedTokens": 150,
      "weightedScore": 0.054,
      "confidence": 0.92
    },
    "routing": {
      "selectedModel": "ollama/llama3.2",
      "matchedRule": "short-to-ollama",
      "fallbackChain": ["anthropic/claude-haiku-4-5"]
    },
    "performance": {
      "classificationTime": 0.36,
      "totalTime": 1423.5
    }
  }
}
```

## Using Pearl Programmatically

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="dummy"  # Pearl doesn't check API keys for local use
)

response = client.chat.completions.create(
    model="auto",
    messages=[
        {"role": "user", "content": "Explain quantum entanglement"}
    ]
)

print(response.choices[0].message.content)

# Access Pearl metadata
if hasattr(response, 'pearl'):
    print(f"Routed to: {response.pearl['routing']['selectedModel']}")
    print(f"Rule matched: {response.pearl['routing']['matchedRule']}")
```

### TypeScript (OpenAI SDK)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'dummy'
});

const response = await client.chat.completions.create({
  model: 'auto',
  messages: [
    { role: 'user', content: 'What is the fastest sorting algorithm?' }
  ]
});

console.log(response.choices[0].message.content);

// Access Pearl metadata (if available)
if (response.pearl) {
  console.log(`Routed to: ${response.pearl.routing.selectedModel}`);
  console.log(`Weighted score: ${response.pearl.classification.weightedScore}`);
}
```

### JavaScript (Fetch)

```javascript
const response = await fetch('http://localhost:8080/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'auto',
    messages: [
      { role: 'user', content: 'Write a haiku about coding' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
console.log('Routed to:', data.pearl.routing.selectedModel);
```

## Memory Extraction

Pearl automatically extracts important information from conversations:

```bash
# After a conversation about a project
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "I am working on a React project called MyApp"},
      {"role": "assistant", "content": "Great! What would you like to build?"},
      {"role": "user", "content": "A todo list with TypeScript and Tailwind"}
    ]
  }'
```

Pearl will extract:
- Project name: MyApp
- Framework: React
- Language: TypeScript
- Styling: Tailwind CSS

These memories are stored in ChromaDB and retrieved for future queries about the same project.

## A/B Testing

Enable A/B testing to compare heuristic vs weighted classifiers:

```bash
# Edit pearl.yaml
routing:
  classifier: anthropic/claude-haiku-4-5
  enable_ab_testing: true
  ab_testing_log: /tmp/pearl-ab-test.log
```

Restart Pearl, then review the comparison logs:

```bash
tail -f /tmp/pearl-ab-test.log
```

You'll see side-by-side comparisons showing:
- Agreement rates between classifiers
- Performance differences (classification time)
- Routing differences (when they choose different models)
- Confidence scores

## API Endpoints

Pearl implements an OpenAI-compatible API with additional endpoints:

### Health Checks

**Standard health check:**
```bash
curl http://localhost:8080/v1/health
```

Response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 3600,
  "pearl_initialized": true
}
```

**Short health check (also at `/health`):**
```bash
curl http://localhost:8080/health
```

**OpenClaw compatibility check:**
```bash
curl http://localhost:8080/api/v1/check
```

### List Available Models

```bash
curl http://localhost:8080/v1/models
```

Response:
```json
{
  "object": "list",
  "data": [
    {"id": "auto", "object": "model", "owned_by": "pearl"},
    {"id": "pearl", "object": "model", "owned_by": "pearl"},
    {"id": "anthropic/claude-sonnet-4-5", "object": "model", "owned_by": "anthropic"}
  ]
}
```

### Memory Management

**List memories for an agent:**
```bash
curl "http://localhost:8080/v1/memories?agent_id=my-agent"
```

Response:
```json
{
  "object": "list",
  "data": [
    {
      "id": "mem_123",
      "agentId": "my-agent",
      "content": "User is working on a React project called MyApp",
      "type": "fact",
      "tags": ["project", "react"],
      "confidence": 0.95,
      "createdAt": "2026-02-12T20:00:00.000Z",
      "updatedAt": "2026-02-12T20:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Manually add a memory:**
```bash
curl -X POST http://localhost:8080/v1/memories \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-agent",
    "content": "User prefers TypeScript over JavaScript",
    "type": "preference",
    "tags": ["language", "typescript"],
    "confidence": 1.0
  }'
```

**Delete a memory:**
```bash
curl -X DELETE http://localhost:8080/v1/memories/mem_123
```

### Usage Statistics

**Note:** The `/v1/stats` endpoint mentioned in the README is **planned but not yet implemented**.

To monitor Pearl's usage, check the request logs at `~/.pearl/requests.jsonl`:
```bash
tail -f ~/.pearl/requests.jsonl | jq
```

## Using Pearl with OpenClaw

While you can't integrate Pearl as an OpenClaw backend, you can still use Pearl for specific queries:

```bash
# In your OpenClaw workflow:
# 1. For normal queries, use OpenClaw directly (it will use Anthropic/OpenAI)
openclaw tui

# 2. For queries that need intelligent routing, use Pearl's API directly
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Your complex query here"}
    ]
  }' | jq -r '.choices[0].message.content'
```

## Performance

Pearl's weighted classifier is fast:
- **Classification time:** ~0.36ms (vs 0.20ms for heuristic)
- **Overhead:** Negligible for API calls (< 1ms added latency)
- **Accuracy:** Higher than simple heuristics for complex routing decisions

The 0.16ms difference is far outweighed by the cost savings from intelligent routing (sending a simple query to Llama3.2 instead of Claude Sonnet saves ~$0.015 per 1K tokens).

## Cost Optimization

Pearl's intelligent routing can save significant costs:

**Example savings per 1K tokens:**
- Simple query: `ollama/llama3.2` (free) vs `claude-sonnet-4-5` ($3.00) = **$3.00 saved**
- Reasoning task: `DeepSeek-R1` ($0.55) vs `claude-sonnet-4-5` ($3.00) = **$2.45 saved**
- Medium task: `claude-haiku-4-5` ($0.25) vs `claude-sonnet-4-5` ($3.00) = **$2.75 saved**

Over 1000 queries/day, this can save hundreds of dollars per month.

## Next Steps

1. **Test Pearl:** Try the curl examples above to see routing in action
2. **Integrate:** Use Pearl's API in your applications via OpenAI SDK
3. **Tune:** Adjust routing rules in `pearl.yaml` based on your usage patterns
4. **Monitor:** Enable A/B testing to validate routing decisions
5. **Scale:** Add more models and fallback chains as needed

Pearl is production-ready and actively routing requests with:
- ✅ Weighted 15-dimensional classification
- ✅ 7-tier routing rules with priorities
- ✅ Fallback chains for reliability
- ✅ Memory extraction and retrieval
- ✅ OpenAI-compatible API
- ✅ Health checks and monitoring
- ✅ A/B testing framework

For more details, see:
- [WEIGHTED-ROUTING.md](./WEIGHTED-ROUTING.md) - Classifier implementation
- [AB-TESTING.md](./AB-TESTING.md) - A/B testing guide
- [pearl.yaml](../pearl.yaml) - Configuration reference
