/**
 * Quick test of weighted classifier
 */

import { WeightedClassifier } from './src/routing/weighted-classifier.js';

const classifier = new WeightedClassifier();

// Test 1: Math proof (should score high on reasoning)
const test1 = await classifier.classify([
  {
    role: 'user',
    content: 'Prove that the integral ∫sin²x dx = x/2 - sin(2x)/4 + C using integration by parts'
  }
]);

console.log('\n=== Test 1: Math Proof ===');
console.log('Content:', 'Prove that the integral ∫sin²x...');
console.log('Complexity:', test1.complexity);
console.log('Type:', test1.type);
console.log('Weighted Score:', test1.weightedScore?.toFixed(3));
console.log('Dominant Dimensions:', test1.dominantDimensions?.join(', '));
console.log('Dimension Scores:');
if (test1.dimensionScores) {
  const topDims = Object.entries(test1.dimensionScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  topDims.forEach(([dim, score]) => {
    console.log(`  ${dim}: ${score.toFixed(3)}`);
  });
}

// Test 2: Simple greeting
const test2 = await classifier.classify([
  {
    role: 'user',
    content: 'hello'
  }
]);

console.log('\n=== Test 2: Simple Greeting ===');
console.log('Content:', 'hello');
console.log('Complexity:', test2.complexity);
console.log('Type:', test2.type);
console.log('Weighted Score:', test2.weightedScore?.toFixed(3));
console.log('Dominant Dimensions:', test2.dominantDimensions?.join(', '));

// Test 3: Code question
const test3 = await classifier.classify([
  {
    role: 'user',
    content: 'How do I implement a binary search tree in TypeScript with insert, delete, and search methods?'
  }
]);

console.log('\n=== Test 3: Code Question ===');
console.log('Content:', 'How do I implement a binary search tree...');
console.log('Complexity:', test3.complexity);
console.log('Type:', test3.type);
console.log('Weighted Score:', test3.weightedScore?.toFixed(3));
console.log('Dominant Dimensions:', test3.dominantDimensions?.join(', '));
console.log('Dimension Scores:');
if (test3.dimensionScores) {
  const topDims = Object.entries(test3.dimensionScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  topDims.forEach(([dim, score]) => {
    console.log(`  ${dim}: ${score.toFixed(3)}`);
  });
}
