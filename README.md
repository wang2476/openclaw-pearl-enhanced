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

## Why Pearl?

AI agents forget everything between sessions. Context compaction erases recent work. Important decisions, preferences, and facts get lost.

Pearl solves this by:
1. **Extracting** memories from every conversation automatically
2. **Storing** them with semantic embeddings for retrieval
3. **Augmenting** prompts with relevant memories before they reach the model
4. **Routing** requests to the right model for the job

## Architecture

```
┌─────────────┐     ┌─────────────────────────────────────────┐     ┌─────────────┐
│             │     │                 PEARL                    │     │             │
│  OpenClaw   │────▶│  Extract ─▶ Store ─▶ Augment ─▶ Route   │────▶│  LLM APIs   │
│             │◀────│                                          │◀────│             │
└─────────────┘     └─────────────────────────────────────────┘     └─────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Memory Store │
                              │   (SQLite +   │
                              │  Embeddings)  │
                              └───────────────┘
```

Pearl exposes an **OpenAI-compatible API**, so OpenClaw treats it like any other model. No changes to OpenClaw core required.

## Core Components

### 1. Memory Extraction
- Classifies incoming user messages for memorable content
- Extracts facts, preferences, rules, decisions, health info, reminders
- Uses fast local LLM (llama3.2:3b) for classification
- Runs asynchronously — doesn't block the request

### 2. Memory Storage
- SQLite database per agent (namespaced)
- Each memory has: content, type, tags, timestamp, embedding
- Embeddings via local model (nomic-embed-text) or API
- Supports: create, update, search, delete, expire

### 3. Memory Retrieval & Augmentation
- Semantic search on incoming prompt
- Retrieves top-N relevant memories (configurable)
- Injects as system message prefix (invisible to user)
- Token budget cap prevents context overflow
- Tracks injected memories per session (no duplicates)

### 4. Model Routing
- Analyzes prompt complexity, length, type
- Routes to optimal backend model:
  - Simple queries → fast/cheap (haiku, gpt-4o-mini)
  - Complex reasoning → capable (sonnet, gpt-4o)
  - Code tasks → specialized (claude, codellama)
  - Sensitive content → local only (ollama)
- Configurable routing rules per agent

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

# Configure OpenClaw to use Pearl as model
# In your openclaw config:
# model: "http://localhost:8080/v1"
```

## Configuration

```yaml
# pearl.yaml
server:
  port: 8080
  host: 0.0.0.0

memory:
  store: sqlite
  path: ~/.pearl/memories.db
  embedding_model: nomic-embed-text  # local via ollama
  extraction_model: llama3.2:3b      # local via ollama

routing:
  default: anthropic/claude-sonnet-4-20250514
  rules:
    - match: { complexity: low, tokens: "<500" }
      model: anthropic/claude-haiku
    - match: { type: code }
      model: anthropic/claude-sonnet-4-20250514
    - match: { sensitive: true }
      model: ollama/llama3.1:70b

backends:
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
  openai:
    api_key: ${OPENAI_API_KEY}
  ollama:
    base_url: http://localhost:11434
```

## API

Pearl exposes an OpenAI-compatible `/v1/chat/completions` endpoint.

Additional endpoints:
- `GET /v1/memories` — list memories for an agent
- `POST /v1/memories` — manually add a memory
- `DELETE /v1/memories/:id` — delete a memory
- `GET /v1/health` — health check
- `GET /v1/stats` — usage statistics

## Development

```bash
# Clone
git clone https://github.com/wang2476/openclaw-pearl-enhanced
cd openclaw-pearl-enhanced

# Install deps
npm install

# Set up environment variables
cp pearl.yaml.example pearl.yaml
# Edit pearl.yaml or set environment variables:
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"

# Run tests
npm test

# Dev server
npm run dev
```

## Contributing

Contributions are welcome! This fork aims to maintain compatibility with the original Pearl while adding security and routing enhancements.

See [GitHub Issues](https://github.com/wang2476/openclaw-pearl-enhanced/issues) for planned features and bugs.

To contribute features back to the original Pearl, see [samhotchkiss/openclaw-pearl](https://github.com/samhotchkiss/openclaw-pearl).

## License

MIT License

Copyright (c) 2026 Sam Hotchkiss (original author)
Copyright (c) 2026 wang2476 (enhancements)

See [LICENSE](LICENSE) file for details.
