/**
 * Debug routing to see why rules aren't matching
 */

import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { createRulesFromConfig, RuleEngine } from './src/routing/rules.js';
import { WeightedClassifier } from './src/routing/weighted-classifier.js';

// Load config
const configFile = readFileSync('./pearl.yaml', 'utf-8');
const config = yaml.load(configFile) as any;

console.log('=== Routing Debug ===\n');
console.log('Config loaded:', !!config);
console.log('Routing config:', !!config.routing);
console.log('Rules count:', config.routing?.rules?.length || 0);

// Create rules
const rules = createRulesFromConfig(
  config.routing.rules,
  config.routing.default_model
);

console.log('\nRules created:', rules.length);
rules.forEach((rule, i) => {
  console.log(`${i + 1}. ${rule.name} (priority: ${rule.priority})`);
  console.log(`   Match:`, JSON.stringify(rule.match));
  console.log(`   Model: ${rule.model}`);
});

// Create classifier and classify "what is json?"
const classifier = new WeightedClassifier();
const classification = await classifier.classify([
  { role: 'user', content: 'what is json?' }
]);

console.log('\n=== Classification Result ===');
console.log('Complexity:', classification.complexity);
console.log('Type:', classification.type);
console.log('Sensitive:', classification.sensitive);
console.log('Estimated Tokens:', classification.estimatedTokens);
console.log('Weighted Score:', (classification as any).weightedScore);

// Test rule matching
const ruleEngine = new RuleEngine(rules);
const matchedRule = ruleEngine.findMatchingRule(classification);

console.log('\n=== Rule Matching ===');
if (matchedRule) {
  console.log('Matched Rule:', matchedRule.name);
  console.log('Model:', matchedRule.model);
  console.log('Priority:', matchedRule.priority);
  console.log('Match Conditions:', JSON.stringify(matchedRule.match));
} else {
  console.log('No rule matched!');
}

// Test each rule manually
console.log('\n=== Manual Rule Testing ===');
for (const rule of rules) {
  const matches = ruleEngine['matchesRule'](classification, rule);
  console.log(`${rule.name}: ${matches ? '✓ MATCH' : '✗ no match'}`);
  if (!matches && !rule.match.default) {
    // Debug why it didn't match
    console.log(`  Expected:`, JSON.stringify(rule.match));
    console.log(`  Got: complexity=${classification.complexity}, type=${classification.type}, tokens=${classification.estimatedTokens}, sensitive=${classification.sensitive}`);
  }
}
