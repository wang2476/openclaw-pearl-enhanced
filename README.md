# Pearl Enhanced 🦪✨

**Persistent memory and intelligent routing for OpenClaw agents.**

> **Note:** This is an enhanced fork of [openclaw-pearl](https://github.com/samhotchkiss/openclaw-pearl) by [Sam Hotchkiss](https://github.com/samhotchkiss), with additional security improvements and advanced routing features.

Pearl is a model proxy that sits between OpenClaw and LLM providers. It intercepts prompts, extracts memorable content, augments prompts with relevant memories, and routes requests to the optimal model based on cost/speed/quality requirements.

## ✨ Enhancements in This Fork

### Security & Authentication
- **🔐 API Key Authentication**: Secure endpoint access with API key validation
- **🛡️ Prompt Injection Detection**: Multi-layered detection (regex, heuristic, LLM-based) with configurable actions
- **🌐 Multi-Language Security**: Protection against attacks in English, Korean, Japanese, and Chinese
- **⚡ Rate Limiting**: Per-user request throttling with escalation and ban policies
- **🔒 Response Filtering**: Automatic redaction of sensitive data in responses
- **🔑 OAuth2 Support**: Enterprise-grade Claude API authentication with token management

### Routing & Intelligence
- **⚖️ Weighted Classifier**: 15-dimensional scoring for accurate request classification
- **🧪 A/B Testing Framework**: Compare heuristic vs. weighted classifiers with detailed metrics
- **📊 Priority-Based Routing**: 7-tier routing rules with fallback chains
- **💰 Multi-Account Management**: Intelligent routing across multiple API accounts with budget tracking
- **🌅 Sunrise Session Recovery**: Automatic context restoration after conversation gaps

### Infrastructure
- **🌐 Localhost-Only Binding**: Security-first configuration for production deployment
- **📚 Comprehensive Documentation**: Detailed guides for all features
- **🧹 Clean Git History**: Secure credential management with environment variables

All enhancements maintain full compatibility with the original Pearl API.

## Feature Overview

| Feature | Description | Status |
|---------|-------------|--------|
| **Memory Extraction** | Automatic extraction of facts, preferences, decisions | ✅ Production |
| **Memory Retrieval** | Semantic search with embeddings | ✅ Production |
| **Weighted Routing** | 15-dimensional classifier for optimal model selection | ✅ Production |
| **Priority Rules** | 7-tier routing with fallback chains | ✅ Production |
| **A/B Testing** | Compare routing strategies with metrics | ✅ Production |
| **API Key Auth** | Secure endpoint access | ✅ Production |
| **Prompt Injection Detection** | Multi-strategy, multi-language threat detection | ✅ Production |
| **Rate Limiting** | Per-user throttling with escalation | ✅ Production |
| **Response Filtering** | Sensitive data redaction | ✅ Production |
| **OAuth2 Support** | Enterprise Claude authentication | ✅ Production |
| **Multi-Account Management** | Budget tracking and intelligent failover | ✅ Production |
| **Sunrise Recovery** | Automatic context restoration after gaps | ✅ Production |
| **Usage Statistics** | Token tracking and cost analysis | 🚧 In Progress |

## Why Pearl?

AI agents forget everything between sessions. Context compaction erases recent work. Important decisions, preferences, and facts get lost.

Pearl solves this by:
1. **Extracting** memories from every conversation automatically
2. **Storing** them with semantic embeddings for retrieval
3. **Augmenting** prompts with relevant memories before they reach the model
4. **Routing** requests to the right model for the job

## Architecture

```
┌─────────────┐     ┌────────────────────────────────────────────────────────┐     ┌──────────────┐
│             │     │                      PEARL                              │     │              │
│  OpenClaw   │────▶│  [Security] ─▶ Extract ─▶ Augment ─▶ Classify ─▶ Route │────▶│  LLM APIs    │
│             │◀────│      ↓            ↓          ↓           ↓         ↓    │◀────│  (Multi-     │
│             │     │   Auth       Memories   Sunrise   Weighted    Accounts  │     │   Account)   │
└─────────────┘     └────────────────────────────────────────────────────────┘     └──────────────┘
                                            │
                                            ▼
                              ┌──────────────────────────┐
                              │     Persistent Layer     │
                              │  ┌──────────────────┐    │
                              │  │ Memory Store     │    │
                              │  │ (SQLite + Vector)│    │
                              │  ├──────────────────┤    │
                              │  │ Transcript Logs  │    │
                              │  ├──────────────────┤    │
                              │  │ Security Events  │    │
                              │  ├──────────────────┤    │
                              │  │ Account Budgets  │    │
                              │  └──────────────────┘    │
                              └──────────────────────────┘
```

Pearl exposes an **OpenAI-compatible API**, so OpenClaw treats it like any other model. No changes to OpenClaw core required.

## Requirements

### System Requirements
- **Node.js**: ≥18.0.0
- **Operating System**: macOS, Linux, or Windows (WSL2)
- **Memory**: 2GB RAM minimum, 4GB recommended
- **Disk Space**: 500MB for dependencies + database

### Optional Dependencies
- **Ollama** (recommended for free local models):
  ```bash
  # macOS
  brew install ollama

  # Linux
  curl -fsSL https://ollama.ai/install.sh | sh

  # Pull required models
  ollama pull llama3.2:3b
  ollama pull nomic-embed-text
  ```

- **API Keys** (for cloud models):
  - Anthropic API key: [console.anthropic.com](https://console.anthropic.com)
  - OpenAI API key: [platform.openai.com](https://platform.openai.com)

**Request Flow:**
1. **Security Layer**: API key validation, rate limiting, injection detection
2. **Memory Extraction**: Background extraction of memorable content
3. **Sunrise Check**: Detect gaps and inject session summaries
4. **Memory Augmentation**: Semantic search and context injection
5. **Classification**: 15-dimensional weighted scoring
6. **Account Selection**: Choose optimal account based on budget/rules
7. **Model Routing**: Route to best model via priority rules
8. **Response Filtering**: Redact sensitive data before returning

## Core Components

### 1. Security Layer
- **API key authentication**: Validates requests before processing
- **Prompt injection detection**: Multi-strategy threat detection (regex, heuristic, LLM)
- **Rate limiting**: Per-user throttling with escalation policies
- **Response filtering**: Automatic redaction of sensitive data
- **Multi-language protection**: Detects attacks in 4+ languages
- **Configurable actions**: Log, warn, or block based on severity

### 2. Memory Extraction
- Classifies incoming user messages for memorable content
- Extracts facts, preferences, rules, decisions, health info, reminders
- Uses fast local LLM (llama3.2:3b) for classification
- Runs asynchronously — doesn't block the request

### 3. Memory Storage
- SQLite database per agent (namespaced)
- Each memory has: content, type, tags, timestamp, embedding
- Embeddings via local model (nomic-embed-text) or API
- Supports: create, update, search, delete, expire

### 4. Memory Retrieval & Augmentation
- Semantic search on incoming prompt
- Retrieves top-N relevant memories (configurable)
- Injects as system message prefix (invisible to user)
- Token budget cap prevents context overflow
- Tracks injected memories per session (no duplicates)

### 5. Model Routing

**Weighted 15-Dimensional Classifier:**
Pearl uses an advanced weighted scoring system to accurately classify requests across 15 dimensions:

| Dimension | Weight | Detects |
|-----------|--------|---------|
| Reasoning markers | 0.18 | "analyze", "prove", "explain why" |
| Code presence | 0.15 | Code blocks, function definitions |
| Technical depth | 0.12 | Technical jargon, architecture terms |
| Question complexity | 0.10 | Multi-part questions, nested logic |
| Context requirements | 0.08 | References to previous context |
| Token estimation | 0.07 | Prompt + expected response length |
| Instruction length | 0.06 | Number of distinct instructions |
| Creative markers | 0.05 | "create", "design", "imagine" |
| Data analysis | 0.05 | "summarize", "extract", "compare" |
| Urgency markers | 0.04 | "urgent", "ASAP", "immediately" |
| Sensitivity markers | 0.04 | Passwords, API keys, PII |
| Conversational tone | 0.03 | Casual language, questions |
| Language complexity | 0.02 | Vocabulary sophistication |
| Enumeration markers | 0.01 | Lists, step-by-step |
| Meta-instructions | 0.01 | Instructions about instructions |

**Classification Results:**
- **Score 0.0-0.2**: Low complexity → Fast/cheap models (Haiku, Llama)
- **Score 0.2-0.5**: Medium complexity → Balanced models (Haiku, GPT-4o-mini)
- **Score 0.5-0.7**: High complexity → Capable models (Sonnet, GPT-4o)
- **Score 0.7-1.0**: Very high complexity → Premium models (Opus, O1)

**Routing Rules:**
- Priority-based matching (highest priority wins)
- Fallback chains for reliability
- Token limits per model
- Cost optimization
- Sensitive data stays local (Ollama)

See [docs/WEIGHTED-ROUTING.md](docs/WEIGHTED-ROUTING.md) and [docs/ROUTING.md](docs/ROUTING.md) for details.

## Quick Start

```bash
# Clone and install
git clone https://github.com/samhotchkiss/openclaw-pearl
cd openclaw-pearl
npm install

# Set up environment variables
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
export PEARL_API_KEY="your-secure-api-key"  # For authentication

# Build the project
npm run build

# Start Pearl server
npm start

# Or run in development mode
npm run dev

# Configure OpenClaw to use Pearl
# See "OpenClaw Integration" section below
```

## Port Configuration

Pearl defaults to port **8080**. If this port is already in use (common with signal-cli, Jenkins, or other services), change it in `pearl.yaml`:

```yaml
server:
  port: 8081  # Or any available port
  host: 127.0.0.1
```

**Common port conflicts:**
- **signal-cli** (Signal messaging daemon) - Uses port 8080 by default
- **Jenkins** - Uses port 8080 by default
- **Tomcat** - Uses port 8080 by default

**Check if port 8080 is in use:**
```bash
lsof -i :8080 | grep LISTEN
```

**Find what's using the port:**
```bash
lsof -i :8080 | grep LISTEN | awk '{print $1, $2}'
```

After changing the port, update your OpenClaw configuration to match (see OpenClaw Integration section below).

## OpenClaw Integration

Pearl can be used as OpenClaw's primary model for intelligent routing. Follow these steps:

### 1. Start Pearl Server

```bash
cd openclaw-pearl
npm start
```

Verify Pearl is running:
```bash
curl http://localhost:8081/health
# Should return: {"status":"healthy","pearl_initialized":true}
```

### 2. Configure OpenClaw

Edit `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "pearl": {
        "baseUrl": "http://127.0.0.1:8081/v1",
        "apiKey": "dummy",
        "api": "openai-completions",
        "authHeader": true,
        "models": [
          {
            "id": "auto",
            "name": "Pearl Auto",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "pearl/auto",
        "fallbacks": [
          "anthropic/claude-sonnet-4-5",
          "openai/gpt-4o"
        ]
      },
      "models": {
        "pearl/auto": {
          "alias": "pearl"
        }
      }
    }
  }
}
```

**Important:** If you changed Pearl's port from 8080, update the `baseUrl` to match (e.g., `http://127.0.0.1:8081/v1`).

### 3. Verify Integration

Check OpenClaw config:
```bash
openclaw config
# Should show: model: pearl/auto
```

Now all OpenClaw requests will flow through Pearl's intelligent routing!

## Quick Examples

### Basic Chat Request
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer ${PEARL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "What is JSON?"}]
  }'
```

Pearl routes this simple query to Ollama (free) instead of Claude Sonnet ($3/1K tokens).

### Complex Reasoning Task
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer ${PEARL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{
      "role": "user",
      "content": "Prove that the square root of 2 is irrational"
    }]
  }'
```

Pearl detects high reasoning markers and routes to DeepSeek-R1 for optimal cost/quality.

### Using with Python (OpenAI SDK)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key=os.environ["PEARL_API_KEY"]
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Explain quantum entanglement"}]
)

print(response.choices[0].message.content)
print(f"Routed to: {response.pearl.routing.selectedModel}")
```

See [docs/USING-PEARL.md](docs/USING-PEARL.md) for more examples.

## Configuration

```yaml
# pearl.yaml
server:
  port: 8080
  host: 127.0.0.1  # localhost-only for security

security:
  enabled: true
  api_key: ${PEARL_API_KEY}  # Required for authentication
  injection_detection:
    enabled: true
    strategies: [regex, heuristic, llm]
    sensitivity: medium
    multi_language:
      enabled: true
      languages: [en, ko, ja, zh]
    rate_limit:
      enabled: true
      max_attempts: 5
      window_seconds: 300
  llm_detection:
    enabled: false  # Enable for advanced threat analysis
    model: ollama/llama3.2:3b
    fallback_to_heuristic: true

memory:
  store: sqlite
  path: ~/.pearl/memories.db
  embedding_model: nomic-embed-text  # local via ollama
  extraction_model: llama3.2:3b      # local via ollama

routing:
  default: anthropic/claude-sonnet-4-20250514
  classifier: anthropic/claude-haiku-4-5  # For weighted classification
  enable_ab_testing: false
  rules:
    - match: { complexity: low, tokens: "<500" }
      model: anthropic/claude-haiku
    - match: { type: code }
      model: anthropic/claude-sonnet-4-20250514
    - match: { sensitive: true }
      model: ollama/llama3.1:70b

accounts:
  # Multi-account management with budget tracking
  providers:
    - name: primary-anthropic
      provider: anthropic
      api_key: ${ANTHROPIC_API_KEY}
      budget:
        daily_limit: 100.00
        alert_threshold: 80.00
    - name: backup-anthropic
      provider: anthropic
      api_key: ${ANTHROPIC_API_KEY_BACKUP}
      budget:
        daily_limit: 50.00
  routing_rules:
    - conditions:
        budget_remaining: ">50%"
      account: primary-anthropic
    - conditions:
        budget_remaining: "<=50%"
      account: backup-anthropic

backends:
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
  openai:
    api_key: ${OPENAI_API_KEY}
  ollama:
    base_url: http://localhost:11434

sunrise:
  # Session recovery configuration
  enabled: true
  gap_threshold_ms: 3600000  # 1 hour
  lookback_ms: 7200000  # 2 hours
  summary_provider: ollama
  summary_model: llama3.2:3b
```

## API

Pearl exposes an OpenAI-compatible `/v1/chat/completions` endpoint.

### Authentication
All API endpoints require authentication via API key:
```bash
curl -H "Authorization: Bearer ${PEARL_API_KEY}" http://localhost:8080/v1/chat/completions
```

### Core Endpoints
- `POST /v1/chat/completions` — OpenAI-compatible chat completion
- `GET /v1/models` — List available models
- `GET /v1/health` — Health check
- `GET /health` — Short health check
- `GET /api/v1/check` — OpenClaw compatibility check

### Memory Management
- `GET /v1/memories?agent_id=<id>` — List memories for an agent
- `POST /v1/memories` — Manually add a memory
- `DELETE /v1/memories/:id` — Delete a memory

### Security Monitoring
- `GET /v1/security/metrics` — Security event metrics
- `GET /v1/security/events?severity=<level>` — Recent security events

### Account Management
- `GET /v1/accounts` — List configured accounts
- `GET /v1/accounts/:name/budget` — Check account budget status

**Note:** Usage statistics endpoint (`/v1/stats`) is planned but not yet implemented. Monitor requests via `~/.pearl/requests.jsonl`.

## Development

```bash
# Clone
git clone https://github.com/samhotchkiss/openclaw-pearl
cd openclaw-pearl

# Install dependencies
npm install

# Set up environment variables
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
export PEARL_API_KEY="dev-api-key-$(openssl rand -hex 16)"

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Lint code
npm run lint

# Dev server with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Project Structure
```
src/
├── accounts/       # Multi-account management and routing
├── auth/          # OAuth2 and API key authentication
├── backends/      # LLM provider integrations (Anthropic, OpenAI, Ollama)
├── cli/           # Command-line interface commands
├── config/        # Configuration loading and validation
├── memory/        # Memory extraction, storage, and retrieval
├── optimization/  # Prompt rewriting and optimization
├── routing/       # Weighted classifier and routing rules
├── security/      # Prompt injection detection and middleware
├── sunrise/       # Session recovery and transcript logging
├── usage/         # Token tracking and cost calculation
├── utils/         # Logger and utilities
└── validation/    # Request validation and persistence

tests/
├── accounts.test.ts           # Account management tests
├── augmenter.test.ts          # Memory augmentation tests
├── backends.test.ts           # LLM provider tests
├── classifier.test.ts         # Weighted classifier tests
├── config.test.ts             # Configuration tests
├── memory-*.test.ts           # Memory system tests
├── oauth.test.ts              # OAuth authentication tests
├── e2e/                       # End-to-end workflow tests
│   ├── extraction.test.ts
│   ├── retrieval.test.ts
│   └── routing.test.ts
└── integration/               # Integration tests
    ├── embedding-service-integration.test.ts
    ├── end-to-end-memory-flow.test.ts
    └── memory-embedding-integration.test.ts

docs/
├── AB-TESTING.md              # A/B testing guide
├── API.md                     # API reference
├── ARCHITECTURE.md            # Architecture details
├── MEMORY.md                  # Memory system guide
├── ROUTING.md                 # Routing configuration
├── USING-PEARL.md             # Usage guide
└── WEIGHTED-ROUTING.md        # Classifier details
```

### Testing

Pearl has comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test tests/classifier.test.ts

# Run integration tests only
npm test tests/integration/

# Run e2e tests
npm test tests/e2e/
```

**Test Categories:**
- **Unit tests**: Individual module functionality
- **Integration tests**: Cross-module workflows (memory + embeddings, extraction flows)
- **E2E tests**: Full request-response cycles (extraction, retrieval, routing)
- **Mock backends**: Test without real API calls

**Key Test Files:**
- `classifier.test.ts` - Weighted routing classifier with 15 dimensions
- `memory-*.test.ts` - Memory extraction, storage, retrieval, embeddings
- `security/*.test.ts` - Prompt injection detection
- `accounts.test.ts` - Multi-account management
- `oauth.test.ts` - OAuth2 authentication flows

## Security Features

Pearl includes comprehensive security protections:

### Prompt Injection Detection
- **Multi-strategy detection**: Regex patterns, heuristic analysis, and optional LLM-based validation
- **Multi-language support**: Detects attacks in English, Korean, Japanese, and Chinese
- **Threat categories**: Instruction override, role manipulation, system impersonation, secret extraction, urgency manipulation
- **Configurable actions**: Log, warn, or block based on severity (SAFE, LOW, MEDIUM, HIGH, CRITICAL)

### Rate Limiting
- **Per-user throttling**: Configurable attempt limits and time windows
- **Escalation policies**: Automatic ban for repeat offenders
- **Bypass system**: Emergency bypass for legitimate urgent requests

### Response Filtering
- **Sensitive data redaction**: Automatically removes API keys, passwords, credentials
- **Context-aware filtering**: Reduces false positives in legitimate technical discussions

### Authentication
- **API key authentication**: Secure endpoint access
- **OAuth2 support**: Enterprise-grade Claude API authentication
- **Token management**: Automatic refresh and expiration handling

See [docs/SECURITY.md](docs/SECURITY.md) for detailed security configuration.

## Multi-Account Management

Pearl supports intelligent routing across multiple API accounts:

### Features
- **Budget tracking**: Daily spending limits per account
- **Alert thresholds**: Notifications when approaching limits
- **Automatic failover**: Routes to backup accounts when primary is exhausted
- **Priority rules**: Route based on budget remaining, cost, or custom conditions

### Example Use Cases
- **Cost optimization**: Use cheaper accounts for simple queries, premium for complex
- **Rate limiting**: Distribute load across multiple accounts
- **Regional compliance**: Route sensitive data to specific regions
- **Failover**: Automatic backup when primary account fails

See [docs/ACCOUNTS.md](docs/ACCOUNTS.md) for configuration examples.

## Session Recovery (Sunrise)

Pearl automatically restores context after conversation gaps:

### How It Works
1. **Gap detection**: Identifies when an agent resumes after idle period (default: 1 hour)
2. **Transcript reading**: Reads conversation history from logs
3. **Summary generation**: Creates concise summary of previous context
4. **Context injection**: Adds summary to system message invisibly

### Configuration
- **Gap threshold**: Minimum time to trigger recovery
- **Lookback window**: How far back to read transcripts
- **Summary provider**: Choose Ollama (free) or Claude/GPT for higher quality

See [docs/SUNRISE.md](docs/SUNRISE.md) for details.

## Documentation

Pearl includes comprehensive documentation:

### Core Guides
- **[USING-PEARL.md](docs/USING-PEARL.md)** - Getting started, API usage, examples
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design and component details
- **[API.md](docs/API.md)** - Complete API reference with examples

### Feature-Specific
- **[MEMORY.md](docs/MEMORY.md)** - Memory extraction, storage, and retrieval
- **[ROUTING.md](docs/ROUTING.md)** - Routing rules and configuration
- **[WEIGHTED-ROUTING.md](docs/WEIGHTED-ROUTING.md)** - 15-dimensional classifier details
- **[AB-TESTING.md](docs/AB-TESTING.md)** - Comparing routing strategies

### Advanced Topics
- **SECURITY.md** (planned) - Security configuration and best practices
- **ACCOUNTS.md** (planned) - Multi-account management guide
- **SUNRISE.md** (planned) - Session recovery configuration

## Performance

Pearl is optimized for production use:

### Classification Speed
- **Weighted classifier**: ~0.36ms per request
- **Heuristic classifier**: ~0.20ms per request
- **Overhead**: <1ms added latency

The 0.16ms difference is negligible compared to network latency and API response times, while delivering significantly better routing accuracy.

### Cost Optimization
Pearl's intelligent routing saves substantial costs:

**Per 1K tokens savings:**
- Simple query: Free (Ollama) vs $3.00 (Claude Sonnet) = **$3.00 saved**
- Reasoning task: $0.55 (DeepSeek-R1) vs $3.00 (Claude Sonnet) = **$2.45 saved**
- Medium task: $0.25 (Claude Haiku) vs $3.00 (Claude Sonnet) = **$2.75 saved**

**Monthly savings** (1000 queries/day):
- 30% simple queries: 300/day × $3.00 × 30 days = **$27,000/month**
- 50% medium tasks: 500/day × $2.75 × 30 days = **$41,250/month**
- 20% reasoning: 200/day × $2.45 × 30 days = **$14,700/month**
- **Total potential savings: $83,000/month**

### Memory Performance
- **Extraction**: Async, non-blocking (<100ms background)
- **Retrieval**: Vector search with SQLite FTS (<50ms)
- **Augmentation**: <5ms to inject memories into prompt

### Reliability
- **Fallback chains**: Automatic retry with backup models
- **Health checks**: `/v1/health` endpoint with uptime monitoring
- **Error handling**: Graceful degradation on provider failures
- **Request logging**: JSONL format at `~/.pearl/requests.jsonl`

## Troubleshooting

For comprehensive troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

### Quick Fixes

**Port Already in Use (EADDRINUSE)**
Port 8080 is commonly used by signal-cli, Jenkins, or Tomcat. Change Pearl's port:
```yaml
# pearl.yaml
server:
  port: 8081  # Or any available port
```
Then update OpenClaw's baseUrl to match. See [Port Configuration](#port-configuration) above.

**"Unauthorized" / 401 Error**
- Ensure `PEARL_API_KEY` is set: `export PEARL_API_KEY="your-key"`
- Include in request: `-H "Authorization: Bearer ${PEARL_API_KEY}"`

**"Rate limit exceeded"**
- Default limit: 5 attempts per 5 minutes
- Configure in `pearl.yaml`:
  ```yaml
  security:
    injection_detection:
      rate_limit:
        max_attempts: 10  # Increase limit
        window_seconds: 300
  ```

**Prompt injection false positives**
- Lower sensitivity: `sensitivity: low` in config
- Disable specific strategies:
  ```yaml
  security:
    injection_detection:
      strategies: [regex]  # Disable heuristic and LLM
  ```

**"No account available"**
- Check account budgets: `curl http://localhost:8080/v1/accounts`
- Increase daily limits in `pearl.yaml`
- Add backup accounts in configuration

**Memory not persisting**
- Check database path: `~/.pearl/memories.db`
- Ensure write permissions: `chmod 700 ~/.pearl/`
- Verify extraction model is running: `ollama list | grep llama3.2`

**Sunrise summaries not appearing**
- Check gap threshold: default is 1 hour idle
- Verify transcript logging: `ls ~/.pearl/transcripts/`
- Enable debug logging: `LOG_LEVEL=debug npm start`

**Ollama connection failed**
- Start Ollama: `ollama serve`
- Check URL in config: `base_url: http://localhost:11434`
- Pull required models:
  ```bash
  ollama pull llama3.2:3b
  ollama pull nomic-embed-text
  ```

**Routing not working as expected**
- Enable A/B testing to compare classifiers
- Check routing logs: `tail -f ~/.pearl/routing.log`
- Verify rule priorities in `pearl.yaml`

**High API costs**
- Review routing metrics: check which models are being used
- Adjust routing rules to prefer cheaper models
- Enable multi-account management for budget control

### Debug Mode

Enable verbose logging:
```bash
export LOG_LEVEL=debug
npm start
```

Check logs:
```bash
# Request logs
tail -f ~/.pearl/requests.jsonl | jq

# Security events
tail -f ~/.pearl/security.log

# Routing decisions
tail -f ~/.pearl/routing.log
```

## Contributing

Contributions are welcome! This is an enhanced fork with additional security and routing features while maintaining compatibility with the original Pearl.

See [GitHub Issues](https://github.com/samhotchkiss/openclaw-pearl/issues) for planned features and bugs.

To contribute features back to the original Pearl, see [samhotchkiss/openclaw-pearl](https://github.com/samhotchkiss/openclaw-pearl).

## Roadmap

### In Progress (v0.2.0)
- [ ] Usage statistics endpoint (`/v1/stats`)
- [ ] Cost tracking dashboard
- [ ] WebSocket support for streaming

### Planned (v0.3.0)
- [ ] **Advanced Security**
  - [ ] IP allowlisting/blocklisting
  - [ ] HMAC request signing
  - [ ] Audit log export
- [ ] **Enhanced Memory**
  - [ ] Memory expiration policies
  - [ ] Cross-session memory sharing
  - [ ] Memory importance ranking
- [ ] **Routing Improvements**
  - [ ] Custom classifier models
  - [ ] Request cost prediction
  - [ ] Latency-based routing
- [ ] **Observability**
  - [ ] Prometheus metrics
  - [ ] OpenTelemetry tracing
  - [ ] Grafana dashboards

### Future Considerations (v0.4.0+)
- [ ] Distributed caching (Redis)
- [ ] Multi-region support
- [ ] Load balancing across instances
- [ ] GraphQL API
- [ ] Web UI for configuration
- [ ] Plugin system for custom extractors

See [GitHub Issues](https://github.com/samhotchkiss/openclaw-pearl/issues) for detailed feature requests.

## License

MIT License

**Original Work:**
Copyright (c) 2026 [Sam Hotchkiss](https://github.com/samhotchkiss)

**Enhancements:**
Copyright (c) 2026 Contributors

This is an enhanced fork of [openclaw-pearl](https://github.com/samhotchkiss/openclaw-pearl) with additional security, routing, and account management features.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

See [LICENSE](LICENSE) file for complete details.

## Acknowledgments

- **[Sam Hotchkiss](https://github.com/samhotchkiss)** - Original Pearl architecture and implementation
- **[OpenClaw](https://github.com/claw-sh/openclaw)** - Inspiration for agent architecture
- **Anthropic** - Claude API and model capabilities
- **Ollama** - Local model serving infrastructure
- All contributors who have helped improve Pearl
