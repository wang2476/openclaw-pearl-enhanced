# A/B Testing: Heuristic vs Weighted Classifier

Run both classifiers in parallel to compare performance and accuracy before fully committing to the weighted classifier.

## Quick Start

### Enable A/B Testing

Add to `pearl.yaml`:

```yaml
routing:
  classifier: anthropic/claude-haiku-4-5
  default_model: anthropic/claude-sonnet-4-5

  # A/B Testing Configuration
  ab_testing:
    enabled: true
    log_file: ./pearl-data/ab-testing.jsonl

  # ... rest of routing config
```

Or enable programmatically:

```typescript
import { Pearl } from './src/pearl.js';

const pearl = new Pearl(config);
await pearl.initialize();

// Enable A/B testing on the router
pearl.router.enableABTesting('./pearl-data/ab-testing.jsonl');
```

### View Results

```bash
# Get A/B testing report
curl http://localhost:8080/v1/ab-testing/report

# Or use Pearl CLI (if implemented)
npx tsx src/cli.ts ab-report
```

Or programmatically:

```typescript
// Generate report
const report = pearl.router.getABTestingReport();
console.log(report);

// Get raw metrics
const metrics = pearl.router.getABTestingMetrics();
console.log(JSON.stringify(metrics, null, 2));

// Export detailed data
await pearl.router.exportABTestingData('./ab-test-results.json');
```

## What Gets Tracked

Each request is classified by both classifiers, and the following is recorded:

### Input
- Message content (first 200 chars)
- Message length
- Timestamp
- Request ID

### Heuristic Results
- Complexity (low/medium/high)
- Type (general/code/creative/analysis/chat)
- Sensitive flag
- Estimated tokens
- Classification time (ms)

### Weighted Results
- Complexity (low/medium/high)
- Type (general/code/creative/analysis/chat)
- Sensitive flag
- Estimated tokens
- **Weighted score** (0-1)
- **Dominant dimensions** (top 3)
- **Confidence** (0-1)
- Classification time (ms)

### Comparison
- Complexity match (boolean)
- Type match (boolean)
- Sensitive match (boolean)
- Overall match (boolean)
- **Routing difference** (would route to different models)

## Sample Report

```
=== A/B Testing Report: Heuristic vs Weighted Classifier ===

Total Requests Analyzed: 247

## Agreement Rates
Complexity Agreement: 68.4%
Type Agreement: 82.2%
Sensitive Detection Agreement: 99.6%
Overall Agreement: 64.8%
Routing Difference: 28.3%

## Performance
Heuristic Avg Time: 0.52ms
Weighted Avg Time: 2.18ms
Speed Difference: 319.2% slower

## Complexity Distribution
Heuristic:
  Low: 198 (80.2%)
  Medium: 35 (14.2%)
  High: 14 (5.7%)
Weighted:
  Low: 156 (63.2%)
  Medium: 67 (27.1%)
  High: 24 (9.7%)

## Type Distribution
Heuristic: {"general":145,"code":62,"chat":28,"analysis":12}
Weighted: {"general":108,"code":71,"analysis":48,"chat":20}

## Recent Disagreements (Sample)

Content: Prove that the integral of sin²x equals x/2 - sin(2x)/4 + C using integr...
Heuristic: low/general
Weighted: low/general (score: 0.054, dims: reasoningMarkers, contextLength)

Content: How do I implement a binary search tree in TypeScript with insert, dele...
Heuristic: low/general
Weighted: low/analysis (score: 0.153, dims: questionComplexity, toolRequirements)

## Routing Differences (Sample)

Content: Explain the differences between Promise.all and Promise.race in JavaScr...
Heuristic would route to: anthropic/claude-sonnet-4-5
Weighted would route to: anthropic/claude-haiku-4-5
Reason: low/general vs medium/code
```

## Key Metrics to Watch

### 1. Overall Agreement Rate
- **> 80%**: Classifiers mostly agree, weighted adds minor improvements
- **60-80%**: Significant differences, review disagreements carefully
- **< 60%**: Major differences, weighted may need threshold tuning

### 2. Routing Difference Rate
- **< 20%**: Low impact on actual routing decisions
- **20-40%**: Moderate impact, affects 1 in 3-5 requests
- **> 40%**: High impact, most requests route differently

### 3. Performance Impact
- Weighted is typically **2-4x slower** than heuristic (2-3ms vs 0.5ms)
- Still very fast compared to LLM call (~1-2 seconds)
- **< 5ms**: Negligible impact on total request time
- **> 10ms**: May want to optimize or use heuristic for simple cases

### 4. Complexity Distribution Shift
- Watch for weighted classifier being **too conservative** (everything "low")
- Or **too aggressive** (too much "high")
- Ideal: Balanced distribution that matches your actual traffic

## Decision Framework

After collecting 100-500 requests:

### Scenario 1: High Agreement (>80%), Low Routing Diff (<20%)
**Decision**: Weighted classifier adds minimal value
**Action**: Stick with fast heuristic classifier

### Scenario 2: Moderate Agreement (60-80%), Moderate Routing Diff (20-40%)
**Decision**: Weighted classifier provides better routing
**Action**: Keep A/B testing, tune weighted thresholds

### Scenario 3: Low Agreement (<60%), High Routing Diff (>40%)
**Decision**: Classifiers fundamentally differ
**Action**:
1. Review disagreement samples to understand why
2. Tune weighted thresholds to align better
3. Or embrace the difference if weighted is more accurate

## Tuning Based on Results

### If Weighted is Too Conservative (Everything "Low")

```typescript
// Lower thresholds in weighted-classifier.ts
private scoreToComplexity(score: number): 'low' | 'medium' | 'high' {
  if (score < 0.15) return 'low';    // Was 0.3
  if (score < 0.35) return 'medium';  // Was 0.6
  return 'high';
}
```

### If Weighted is Too Aggressive (Too Much "High")

```typescript
// Raise thresholds
private scoreToComplexity(score: number): 'low' | 'medium' | 'high' {
  if (score < 0.4) return 'low';     // Was 0.3
  if (score < 0.7) return 'medium';   // Was 0.6
  return 'high';
}
```

### If Specific Dimensions are Wrong

```typescript
// Adjust dimension weights
const classifier = new WeightedClassifier({
  reasoningMarkers: 0.25,  // Increase (was 0.18)
  codePresence: 0.10,      // Decrease (was 0.15)
  // ... other weights
});
```

## Best Practices

1. **Run A/B test for at least 100 requests** before making decisions
2. **Sample different query types** - don't just test one pattern
3. **Review disagreement cases** - understand why classifiers differ
4. **Check routing differences** - see if they actually matter
5. **Monitor performance** - ensure weighted doesn't slow things down
6. **Export data periodically** - keep historical comparisons
7. **Tune iteratively** - adjust thresholds based on real traffic

## Example Workflow

```bash
# 1. Enable A/B testing
# Edit pearl.yaml, add ab_testing config

# 2. Restart Pearl server
npx tsx src/cli.ts serve --port 8080

# 3. Send real traffic (or test queries)
# Use OpenClaw or direct API calls

# 4. After 100+ requests, check report
curl http://localhost:8080/v1/ab-testing/report

# 5. Export detailed data
curl http://localhost:8080/v1/ab-testing/export > ab-results.json

# 6. Analyze and decide
# - If routing diff < 20%: keep heuristic
# - If routing diff > 30% AND weighted is better: switch to weighted
# - Otherwise: tune thresholds and re-test

# 7. Disable A/B testing once decided
# Remove ab_testing config from pearl.yaml
```

## Performance Considerations

### Memory Usage
- Keeps last 1000 comparisons in memory (~200KB)
- Log file grows at ~500 bytes/request
- 10,000 requests ≈ 5MB log file

### CPU Impact
- Runs both classifiers (2x classification cost)
- Heuristic: ~0.5ms, Weighted: ~2-3ms
- Total: ~3-4ms per request (still negligible vs LLM call)

### Production Use
- **Not recommended** for production long-term
- Use for evaluation periods (1-7 days)
- Then choose one classifier and disable A/B testing

## Interpreting Results

### Good Signs (Weighted is Better)
- Finds more code/analysis tasks that heuristic misses as "general"
- Detects reasoning tasks that heuristic marks as "low"
- Routes complex queries to better models, saving cost on simple ones
- Higher confidence scores on correct classifications

### Warning Signs (Need Tuning)
- Everything classified as "low" complexity
- Reasoning tasks not detected (low reasoningMarkers scores)
- Code tasks not detected (low codePresence scores)
- Random disagreements with no clear pattern

### When to Keep Heuristic
- A/B test shows < 20% routing difference
- Performance is critical (sub-millisecond classification needed)
- Heuristic is already well-tuned for your traffic
- Weighted doesn't improve cost savings

### When to Switch to Weighted
- > 30% routing difference with better accuracy
- Heuristic misclassifies complex reasoning/analysis tasks
- You want ClawRouter-style multi-dimensional scoring
- You can afford 2-3ms extra classification time
