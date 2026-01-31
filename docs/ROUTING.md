# Pearl Routing System

## Overview

Pearl's router analyzes incoming requests and selects the optimal backend model based on:
- **Complexity** — Simple queries vs. multi-step reasoning
- **Type** — General chat, code, creative writing, analysis
- **Sensitivity** — PII, health info, secrets
- **Cost** — Budget constraints
- **Latency** — Time sensitivity

## Why Route?

Not every query needs the most expensive model:

| Query Type | Best Model | Why |
|------------|-----------|-----|
| "What time is it in Tokyo?" | Haiku | Simple, factual |
| "Explain quantum entanglement" | Sonnet | Requires depth |
| "Debug this async race condition" | Sonnet/Opus | Complex reasoning |
| "My SSN is 123-45-6789" | Local Llama | Privacy |

Routing saves 40-70% on API costs while maintaining quality.

## Classification

### Request Analysis

Before routing, Pearl classifies the request:

```typescript
interface RequestClassification {
  complexity: 'low' | 'medium' | 'high';
  type: 'general' | 'code' | 'creative' | 'analysis' | 'chat';
  sensitive: boolean;
  estimatedTokens: number;
  requiresTools: boolean;
}
```

### Classification Methods

#### 1. Heuristic (Fast, No LLM)

```typescript
function heuristicClassify(messages: Message[]): RequestClassification {
  const lastUser = messages.filter(m => m.role === 'user').pop();
  const content = lastUser?.content || '';
  
  return {
    // Complexity based on length and question words
    complexity: content.length < 100 ? 'low' : 
                content.length < 500 ? 'medium' : 'high',
    
    // Type based on keywords
    type: detectType(content),
    
    // Sensitive based on patterns
    sensitive: detectSensitive(content),
    
    estimatedTokens: estimateTokens(content),
    requiresTools: false
  };
}

function detectType(content: string): string {
  const lower = content.toLowerCase();
  if (/\b(code|function|debug|error|bug|api|class|method)\b/.test(lower)) return 'code';
  if (/\b(write|story|poem|creative|imagine)\b/.test(lower)) return 'creative';
  if (/\b(analyze|compare|evaluate|assess)\b/.test(lower)) return 'analysis';
  return 'general';
}

function detectSensitive(content: string): boolean {
  // SSN pattern
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(content)) return true;
  // Credit card pattern
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(content)) return true;
  // Health keywords
  if (/\b(diagnosis|prescription|medication|symptom|medical)\b/i.test(content)) return true;
  // Password/secret keywords
  if (/\b(password|secret|api.?key|token|credential)\b/i.test(content)) return true;
  return false;
}
```

#### 2. LLM Classification (Accurate, ~50ms)

```typescript
const CLASSIFY_PROMPT = `
Classify this request for routing to the optimal AI model.

Return JSON:
{
  "complexity": "low|medium|high",
  "type": "general|code|creative|analysis|chat",
  "sensitive": true|false,
  "reasoning": "brief explanation"
}

Definitions:
- complexity: low=simple lookup/chat, medium=explanation/moderate reasoning, high=complex analysis/multi-step
- type: general=broad topics, code=programming, creative=writing/art, analysis=deep evaluation, chat=casual
- sensitive: contains PII (SSN, credit cards), health info, passwords, secrets

Request:
{content}
`;

async function llmClassify(messages: Message[]): Promise<RequestClassification> {
  const content = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const response = await ollama.generate({
    model: 'llama3.2:3b',
    prompt: CLASSIFY_PROMPT.replace('{content}', content),
    format: 'json'
  });
  
  return JSON.parse(response.text);
}
```

#### 3. Hybrid (Recommended)

Use heuristics first, LLM for edge cases:

```typescript
async function classify(messages: Message[]): Promise<RequestClassification> {
  const heuristic = heuristicClassify(messages);
  
  // If clear-cut, skip LLM
  if (heuristic.sensitive) return heuristic; // Fast-path sensitive
  if (heuristic.complexity === 'low' && heuristic.type === 'chat') return heuristic;
  
  // For ambiguous cases, use LLM
  return llmClassify(messages);
}
```

## Routing Rules

### Rule Format

```yaml
routing:
  rules:
    - name: sensitive-local
      match:
        sensitive: true
      model: ollama/llama3.1:70b
      priority: 100  # Higher = checked first
    
    - name: code-tasks
      match:
        type: code
      model: anthropic/claude-sonnet-4-20250514
      priority: 50
    
    - name: simple-fast
      match:
        complexity: low
        estimatedTokens: "<500"
      model: anthropic/claude-3-5-haiku-20241022
      priority: 30
    
    - name: default
      match:
        default: true
      model: anthropic/claude-sonnet-4-20250514
      priority: 0
```

### Rule Matching

```typescript
interface RoutingRule {
  name: string;
  match: MatchConditions;
  model: string;
  priority: number;
}

interface MatchConditions {
  default?: boolean;
  complexity?: 'low' | 'medium' | 'high';
  type?: string;
  sensitive?: boolean;
  estimatedTokens?: string; // e.g., "<500", ">1000"
}

function matchRule(classification: RequestClassification, rule: RoutingRule): boolean {
  const { match } = rule;
  
  if (match.default) return true;
  
  if (match.complexity && match.complexity !== classification.complexity) return false;
  if (match.type && match.type !== classification.type) return false;
  if (match.sensitive !== undefined && match.sensitive !== classification.sensitive) return false;
  
  if (match.estimatedTokens) {
    const [op, value] = parseOperator(match.estimatedTokens);
    if (!compareTokens(classification.estimatedTokens, op, parseInt(value))) return false;
  }
  
  return true;
}

function selectModel(classification: RequestClassification, rules: RoutingRule[]): string {
  const sorted = rules.sort((a, b) => b.priority - a.priority);
  
  for (const rule of sorted) {
    if (matchRule(classification, rule)) {
      return rule.model;
    }
  }
  
  return rules.find(r => r.match.default)?.model || 'anthropic/claude-sonnet-4-20250514';
}
```

## Model Backends

### Supported Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | claude-opus-4-5, claude-sonnet-4-20250514, haiku | Primary |
| OpenAI | gpt-4o, gpt-4o-mini, o1 | Alternative |
| Ollama | llama3.1:70b, llama3.2:3b, codellama | Local/private |
| OpenRouter | Any | Multi-provider fallback |

### Backend Config

```yaml
backends:
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
    base_url: https://api.anthropic.com
    default_params:
      max_tokens: 4096
  
  openai:
    api_key: ${OPENAI_API_KEY}
    base_url: https://api.openai.com/v1
  
  ollama:
    base_url: http://localhost:11434
    default_params:
      num_ctx: 8192
  
  openrouter:
    api_key: ${OPENROUTER_API_KEY}
    base_url: https://openrouter.ai/api/v1
```

### Model Normalization

Map model strings to backend + model:

```typescript
function parseModel(model: string): { backend: string; model: string } {
  const [backend, ...rest] = model.split('/');
  return {
    backend,
    model: rest.join('/')
  };
}

// "anthropic/claude-sonnet-4-20250514" → { backend: "anthropic", model: "claude-sonnet-4-20250514" }
// "ollama/llama3.1:70b" → { backend: "ollama", model: "llama3.1:70b" }
```

## Cost Tracking

### Per-Request Logging

```typescript
interface RequestLog {
  id: string;
  timestamp: number;
  agent_id: string;
  classification: RequestClassification;
  selected_model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

const MODEL_PRICING = {
  'anthropic/claude-opus-4-5': { input: 15.0, output: 75.0 }, // per 1M tokens
  'anthropic/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-5-haiku-20241022': { input: 0.25, output: 1.25 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'ollama/*': { input: 0, output: 0 } // Local = free
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['anthropic/claude-sonnet-4-20250514'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
```

### Savings Report

```bash
GET /v1/stats/routing

{
  "period": "2024-01-01 to 2024-01-31",
  "total_requests": 10000,
  "by_model": {
    "anthropic/claude-3-5-haiku-20241022": 6500,
    "anthropic/claude-sonnet-4-20250514": 3000,
    "ollama/llama3.1:70b": 500
  },
  "total_cost_usd": 45.00,
  "estimated_without_routing": 150.00,
  "savings_usd": 105.00,
  "savings_percent": 70
}
```

## Fallback & Retry

### Fallback Chain

If primary model fails, try alternates:

```yaml
routing:
  fallback:
    anthropic/claude-sonnet-4-20250514:
      - anthropic/claude-3-5-haiku-20241022
      - openai/gpt-4o
    ollama/llama3.1:70b:
      - ollama/llama3.2:3b
      - anthropic/claude-sonnet-4-20250514
```

### Retry Logic

```typescript
async function routeWithRetry(
  request: ChatRequest, 
  model: string,
  fallbacks: string[]
): Promise<ChatResponse> {
  const models = [model, ...fallbacks];
  
  for (const m of models) {
    try {
      return await callBackend(m, request);
    } catch (error) {
      console.warn(`Model ${m} failed: ${error.message}`);
      if (models.indexOf(m) === models.length - 1) throw error;
    }
  }
}
```

## Advanced: Dynamic Routing

### Load-Based Routing

Route to less-loaded backends:

```typescript
const backendLatency = new Map<string, number[]>();

function selectByLoad(candidates: string[]): string {
  return candidates.reduce((best, current) => {
    const bestLatency = avgLatency(backendLatency.get(best) || []);
    const currentLatency = avgLatency(backendLatency.get(current) || []);
    return currentLatency < bestLatency ? current : best;
  });
}
```

### Time-Based Routing

Different models for different times:

```yaml
routing:
  schedules:
    - hours: "00:00-06:00"  # Night: cheaper
      default_model: anthropic/claude-3-5-haiku-20241022
    - hours: "09:00-17:00"  # Work hours: best quality
      default_model: anthropic/claude-sonnet-4-20250514
```

### Agent-Specific Overrides

Some agents always use specific models:

```yaml
routing:
  agent_overrides:
    code-agent:
      default_model: anthropic/claude-sonnet-4-20250514
    research-agent:
      default_model: anthropic/claude-opus-4-5
```
