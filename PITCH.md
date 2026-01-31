# Pearl — The Missing Layer for AI Agents

## The Problems

### 1. Token Burn
Multi-agent environments burn through tokens fast. Every agent uses the same expensive model for everything — simple questions, complex reasoning, sensitive data. There's no intelligence about which model to use when.

### 2. Prompt Inefficiency
Humans write prompts the way they think, not the way models process. Prompts are verbose, ambiguous, and wasteful. Every extra token costs money and degrades performance.

### 3. Memory is Broken
Current agent memory fails in multiple ways:
- **Compaction amnesia** — Context compression erases recent work, leaving agents disoriented
- **Rule forgetting** — Instructions set by users fade as context grows
- **False persistence** — Agents claim "I'll remember that!" then immediately forget
- **No cross-session continuity** — Each session starts from zero

### 4. Account Chaos
Power users have multiple accounts:
- Claude API (pay-per-token)
- Claude Max subscription (monthly, unlimited-ish)
- OpenAI API
- Gemini API
- Local Ollama

No good way to route requests to the right account based on cost, capability, or sensitivity.

## The Solution: Pearl

Pearl is a **proxy layer** that sits between your agent framework (OpenClaw, etc.) and LLM providers.

```
┌─────────────┐     ┌─────────────────────────────────────────────────┐     ┌─────────────┐
│             │     │                    PEARL                         │     │             │
│  OpenClaw   │────▶│  Extract → Optimize → Augment → Route → Track   │────▶│  LLM APIs   │
│             │◀────│                                                  │◀────│             │
└─────────────┘     └─────────────────────────────────────────────────┘     └─────────────┘
```

### What Pearl Does

1. **Extracts Memories**
   - Automatically identifies memorable content in conversations
   - Saves facts, preferences, rules, decisions to persistent storage
   - No more "I'll remember that" lies — it actually remembers

2. **Optimizes Prompts**
   - Rewrites verbose prompts to be clear and efficient
   - Removes redundancy, clarifies ambiguity
   - Saves tokens without losing meaning

3. **Augments with Context**
   - Semantic search for relevant memories
   - Injects context invisibly into system prompt
   - Agents "just know" things from past sessions

4. **Routes Intelligently**
   - Classifies requests: complexity, type, sensitivity
   - Routes to optimal model:
     - Simple → cheap/fast (Haiku)
     - Complex → capable (Sonnet/Opus)
     - Sensitive → local only (Ollama)
   - Saves 40-70% on API costs

5. **Validates Persistence**
   - Scans agent responses for memory claims
   - Verifies memories were actually saved
   - Catches false persistence before it reaches the user

6. **Manages Accounts**
   - Multiple API keys and OAuth connections
   - Claude Max via OAuth (use your subscription!)
   - Rules for which account handles which requests
   - Per-account usage tracking and budgets

## Architecture

Pearl exposes an **OpenAI-compatible API**. Your agent framework doesn't know Pearl exists — it just thinks it's talking to Claude or GPT.

```yaml
# Point OpenClaw at Pearl
model: http://localhost:8080/v1
```

Pearl handles everything transparently:
- Memory extraction runs async (doesn't block)
- Prompt optimization before routing
- Context injection invisible to agents
- Response validation after completion

## Key Design Principles

1. **Invisible to agents** — They just get smarter without knowing why
2. **No framework changes** — Works with any OpenAI-compatible client
3. **Local-first** — Memory extraction and embeddings use local models
4. **Privacy-aware** — Sensitive content routes to local models only
5. **Cost-conscious** — Every decision optimizes for value

## Who Is Pearl For?

- **OpenClaw users** running multi-agent setups
- **Power users** with Claude Max + API accounts
- **Anyone** tired of agents forgetting everything
- **Cost-conscious** teams burning through API credits

## Roadmap

### Phase 1: Core (MVP)
- [ ] OpenAI-compatible proxy server
- [ ] Memory extraction, storage, retrieval
- [ ] Prompt augmentation with context
- [ ] Basic model routing (complexity-based)

### Phase 2: Optimization
- [ ] Prompt optimizer/rewriter
- [ ] Response validation
- [ ] Advanced routing rules

### Phase 3: Accounts
- [ ] Multi-account management
- [ ] Claude OAuth (Max subscriptions)
- [ ] Per-account usage tracking
- [ ] Budget enforcement

### Phase 4: Scale
- [ ] Shared memory across agents
- [ ] Memory consolidation/forgetting
- [ ] Distributed storage (Redis/Postgres)

## Get Started

```bash
npm install -g openclaw-pearl
pearl serve --port 8080
```

Then point your agent framework at `http://localhost:8080/v1`.

## Repository

https://github.com/samhotchkiss/openclaw-pearl
