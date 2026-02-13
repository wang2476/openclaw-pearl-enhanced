/**
 * A/B Testing Demo
 * Compares heuristic and weighted classifiers
 */

import { ABTestingFramework } from './src/routing/ab-testing.js';

const abTest = new ABTestingFramework({
  logFile: './pearl-data/ab-testing-demo.jsonl',
});

console.log('=== A/B Testing Demo ===\n');
console.log('Running both classifiers on sample queries...\n');

// Test cases covering different types
const testCases = [
  {
    name: 'Math Proof',
    content: 'Prove that ∫sin²x dx = x/2 - sin(2x)/4 + C using integration by parts',
  },
  {
    name: 'Simple Greeting',
    content: 'hello',
  },
  {
    name: 'Code Question',
    content: 'How do I implement a binary search tree in TypeScript with insert, delete, and search methods?',
  },
  {
    name: 'System Architecture',
    content: 'Explain how to design a distributed microservices architecture with fault tolerance and load balancing for high concurrency',
  },
  {
    name: 'Simple Factual',
    content: 'What is JSON?',
  },
  {
    name: 'API Key (Sensitive)',
    content: 'My API key is sk-12345 and I need help',
  },
];

// Run comparisons
for (const test of testCases) {
  const result = await abTest.compareClassifiers(
    [{ role: 'user', content: test.content }],
    `test_${test.name.toLowerCase().replace(/\s+/g, '_')}`
  );

  console.log(`## ${test.name}`);
  console.log(`Content: "${test.content.substring(0, 60)}${test.content.length > 60 ? '...' : ''}"`);
  console.log(`\nHeuristic:`);
  console.log(`  Complexity: ${result.heuristic.complexity}`);
  console.log(`  Type: ${result.heuristic.type}`);
  console.log(`  Tokens: ${result.heuristic.estimatedTokens}`);
  console.log(`  Time: ${result.comparison.heuristic.classificationTime.toFixed(2)}ms`);

  console.log(`\nWeighted:`);
  console.log(`  Complexity: ${result.weighted.complexity}`);
  console.log(`  Type: ${result.weighted.type}`);
  console.log(`  Tokens: ${result.weighted.estimatedTokens}`);
  console.log(`  Score: ${result.comparison.weighted.weightedScore.toFixed(3)}`);
  console.log(`  Top Dims: ${result.comparison.weighted.dominantDimensions.slice(0, 3).join(', ')}`);
  console.log(`  Confidence: ${result.comparison.weighted.confidence.toFixed(2)}`);
  console.log(`  Time: ${result.comparison.weighted.classificationTime.toFixed(2)}ms`);

  console.log(`\nComparison:`);
  console.log(`  Overall Match: ${result.comparison.agreement.overallMatch ? '✓' : '✗'}`);
  console.log(`  Complexity Match: ${result.comparison.agreement.complexityMatch ? '✓' : '✗'}`);
  console.log(`  Type Match: ${result.comparison.agreement.typeMatch ? '✓' : '✗'}`);
  console.log(`  Routing Diff: ${result.comparison.routingDifference ? '✗ YES' : '✓ NO'}`);
  if (result.comparison.routingDifference) {
    console.log(`    Heuristic → ${result.comparison.heuristicWouldRoute}`);
    console.log(`    Weighted → ${result.comparison.weightedWouldRoute}`);
  }
  console.log('');
}

// Generate report
console.log('\n' + '='.repeat(60));
console.log(abTest.generateReport());

// Export data
await abTest.exportComparisons('./pearl-data/ab-test-demo-results.json');
console.log('\n✓ Detailed results exported to: ./pearl-data/ab-test-demo-results.json');
