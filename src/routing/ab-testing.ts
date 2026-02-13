/**
 * A/B Testing Framework for Classifier Comparison
 * Runs both heuristic and weighted classifiers in parallel
 * Tracks performance and accuracy metrics
 */

import { RequestClassifier } from './classifier.js';
import { WeightedClassifier, type WeightedClassificationResult } from './weighted-classifier.js';
import type { Message, RequestClassification } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ClassifierComparison {
  timestamp: number;
  requestId: string;

  // Input
  messageContent: string;
  messageLength: number;

  // Heuristic Results
  heuristic: {
    complexity: string;
    type: string;
    sensitive: boolean;
    estimatedTokens: number;
    classificationTime: number;
  };

  // Weighted Results
  weighted: {
    complexity: string;
    type: string;
    sensitive: boolean;
    estimatedTokens: number;
    weightedScore: number;
    dominantDimensions: string[];
    confidence: number;
    classificationTime: number;
  };

  // Comparison
  agreement: {
    complexityMatch: boolean;
    typeMatch: boolean;
    sensitiveMatch: boolean;
    overallMatch: boolean;
  };

  // Routing Impact
  heuristicWouldRoute: string;
  weightedWouldRoute: string;
  routingDifference: boolean;
}

export interface ABTestMetrics {
  totalRequests: number;
  complexityAgreement: number;
  typeAgreement: number;
  sensitiveAgreement: number;
  overallAgreement: number;
  routingDifference: number;

  avgHeuristicTime: number;
  avgWeightedTime: number;

  complexityDistribution: {
    heuristic: { low: number; medium: number; high: number };
    weighted: { low: number; medium: number; high: number };
  };

  typeDistribution: {
    heuristic: Record<string, number>;
    weighted: Record<string, number>;
  };
}

export class ABTestingFramework {
  private heuristicClassifier: RequestClassifier;
  private weightedClassifier: WeightedClassifier;
  private comparisons: ClassifierComparison[] = [];
  private logFile?: string;
  private maxComparisons = 1000; // Keep last 1000 in memory

  constructor(options?: { logFile?: string; maxComparisons?: number }) {
    this.heuristicClassifier = new RequestClassifier();
    this.weightedClassifier = new WeightedClassifier();
    this.logFile = options?.logFile;
    if (options?.maxComparisons) {
      this.maxComparisons = options.maxComparisons;
    }
  }

  /**
   * Run both classifiers and compare results
   */
  async compareClassifiers(
    messages: Message[],
    requestId: string
  ): Promise<{
    heuristic: RequestClassification;
    weighted: WeightedClassificationResult;
    comparison: ClassifierComparison;
  }> {
    const userMessage = messages.filter(m => m.role === 'user').pop();
    const content = userMessage?.content || '';

    // Run both classifiers in parallel
    const startHeuristic = performance.now();
    const heuristicResult = await this.heuristicClassifier.classify(messages);
    const heuristicTime = performance.now() - startHeuristic;

    const startWeighted = performance.now();
    const weightedResult = await this.weightedClassifier.classify(messages);
    const weightedTime = performance.now() - startWeighted;

    // Calculate agreement
    const agreement = {
      complexityMatch: heuristicResult.complexity === weightedResult.complexity,
      typeMatch: heuristicResult.type === weightedResult.type,
      sensitiveMatch: heuristicResult.sensitive === weightedResult.sensitive,
      overallMatch: false,
    };
    agreement.overallMatch =
      agreement.complexityMatch &&
      agreement.typeMatch &&
      agreement.sensitiveMatch;

    // Determine what each would route to (simplified - you'd use actual rule engine)
    const heuristicRoute = this.simulateRouting(heuristicResult);
    const weightedRoute = this.simulateRouting(weightedResult);

    // Create comparison object
    const comparison: ClassifierComparison = {
      timestamp: Date.now(),
      requestId,
      messageContent: content.substring(0, 200), // First 200 chars
      messageLength: content.length,
      heuristic: {
        complexity: heuristicResult.complexity,
        type: heuristicResult.type,
        sensitive: heuristicResult.sensitive,
        estimatedTokens: heuristicResult.estimatedTokens,
        classificationTime: heuristicTime,
      },
      weighted: {
        complexity: weightedResult.complexity,
        type: weightedResult.type,
        sensitive: weightedResult.sensitive,
        estimatedTokens: weightedResult.estimatedTokens,
        weightedScore: weightedResult.weightedScore || 0,
        dominantDimensions: weightedResult.dominantDimensions || [],
        confidence: weightedResult.confidence || 0,
        classificationTime: weightedTime,
      },
      agreement,
      heuristicWouldRoute: heuristicRoute,
      weightedWouldRoute: weightedRoute,
      routingDifference: heuristicRoute !== weightedRoute,
    };

    // Store comparison
    this.comparisons.push(comparison);
    if (this.comparisons.length > this.maxComparisons) {
      this.comparisons.shift(); // Remove oldest
    }

    // Log to file if configured
    if (this.logFile) {
      await this.logComparison(comparison);
    }

    return {
      heuristic: heuristicResult,
      weighted: weightedResult,
      comparison,
    };
  }

  /**
   * Simulate routing decision based on classification
   */
  private simulateRouting(classification: RequestClassification): string {
    // Simplified routing logic - matches pearl.yaml rules
    if (classification.sensitive) {
      return 'ollama/llama3.2';
    }

    if (classification.complexity === 'low' && classification.estimatedTokens < 500) {
      return 'ollama/llama3.2';
    }

    if (classification.type === 'code') {
      return 'anthropic/claude-sonnet-4-5';
    }

    if (classification.type === 'analysis' && classification.complexity === 'high') {
      return 'ollama/DeepSeek-R1:32B';
    }

    if (classification.complexity === 'medium') {
      return 'anthropic/claude-haiku-4-5';
    }

    return 'anthropic/claude-sonnet-4-5'; // default
  }

  /**
   * Log comparison to file
   */
  private async logComparison(comparison: ClassifierComparison): Promise<void> {
    if (!this.logFile) return;

    try {
      const logEntry = JSON.stringify(comparison) + '\n';
      await fs.appendFile(this.logFile, logEntry, 'utf-8');
    } catch (error) {
      console.error('Failed to log comparison:', error);
    }
  }

  /**
   * Get metrics from all comparisons
   */
  getMetrics(): ABTestMetrics {
    if (this.comparisons.length === 0) {
      return this.emptyMetrics();
    }

    const total = this.comparisons.length;
    let complexityMatch = 0;
    let typeMatch = 0;
    let sensitiveMatch = 0;
    let overallMatch = 0;
    let routingDiff = 0;
    let totalHeuristicTime = 0;
    let totalWeightedTime = 0;

    const complexityDist = {
      heuristic: { low: 0, medium: 0, high: 0 },
      weighted: { low: 0, medium: 0, high: 0 },
    };

    const typeDist = {
      heuristic: {} as Record<string, number>,
      weighted: {} as Record<string, number>,
    };

    for (const comp of this.comparisons) {
      // Agreement counts
      if (comp.agreement.complexityMatch) complexityMatch++;
      if (comp.agreement.typeMatch) typeMatch++;
      if (comp.agreement.sensitiveMatch) sensitiveMatch++;
      if (comp.agreement.overallMatch) overallMatch++;
      if (comp.routingDifference) routingDiff++;

      // Timing
      totalHeuristicTime += comp.heuristic.classificationTime;
      totalWeightedTime += comp.weighted.classificationTime;

      // Distributions
      complexityDist.heuristic[comp.heuristic.complexity as 'low' | 'medium' | 'high']++;
      complexityDist.weighted[comp.weighted.complexity as 'low' | 'medium' | 'high']++;

      typeDist.heuristic[comp.heuristic.type] = (typeDist.heuristic[comp.heuristic.type] || 0) + 1;
      typeDist.weighted[comp.weighted.type] = (typeDist.weighted[comp.weighted.type] || 0) + 1;
    }

    return {
      totalRequests: total,
      complexityAgreement: complexityMatch / total,
      typeAgreement: typeMatch / total,
      sensitiveAgreement: sensitiveMatch / total,
      overallAgreement: overallMatch / total,
      routingDifference: routingDiff / total,
      avgHeuristicTime: totalHeuristicTime / total,
      avgWeightedTime: totalWeightedTime / total,
      complexityDistribution: complexityDist,
      typeDistribution: typeDist,
    };
  }

  /**
   * Get recent comparisons where classifiers disagreed
   */
  getDisagreements(limit = 10): ClassifierComparison[] {
    return this.comparisons
      .filter(c => !c.agreement.overallMatch)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get recent comparisons where routing would differ
   */
  getRoutingDifferences(limit = 10): ClassifierComparison[] {
    return this.comparisons
      .filter(c => c.routingDifference)
      .slice(-limit)
      .reverse();
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const disagreements = this.getDisagreements(5);
    const routingDiffs = this.getRoutingDifferences(5);

    let report = '=== A/B Testing Report: Heuristic vs Weighted Classifier ===\n\n';

    report += `Total Requests Analyzed: ${metrics.totalRequests}\n\n`;

    report += '## Agreement Rates\n';
    report += `Complexity Agreement: ${(metrics.complexityAgreement * 100).toFixed(1)}%\n`;
    report += `Type Agreement: ${(metrics.typeAgreement * 100).toFixed(1)}%\n`;
    report += `Sensitive Detection Agreement: ${(metrics.sensitiveAgreement * 100).toFixed(1)}%\n`;
    report += `Overall Agreement: ${(metrics.overallAgreement * 100).toFixed(1)}%\n`;
    report += `Routing Difference: ${(metrics.routingDifference * 100).toFixed(1)}%\n\n`;

    report += '## Performance\n';
    report += `Heuristic Avg Time: ${metrics.avgHeuristicTime.toFixed(2)}ms\n`;
    report += `Weighted Avg Time: ${metrics.avgWeightedTime.toFixed(2)}ms\n`;
    report += `Speed Difference: ${((metrics.avgWeightedTime / metrics.avgHeuristicTime - 1) * 100).toFixed(1)}% slower\n\n`;

    report += '## Complexity Distribution\n';
    report += 'Heuristic:\n';
    report += `  Low: ${metrics.complexityDistribution.heuristic.low} (${(metrics.complexityDistribution.heuristic.low / metrics.totalRequests * 100).toFixed(1)}%)\n`;
    report += `  Medium: ${metrics.complexityDistribution.heuristic.medium} (${(metrics.complexityDistribution.heuristic.medium / metrics.totalRequests * 100).toFixed(1)}%)\n`;
    report += `  High: ${metrics.complexityDistribution.heuristic.high} (${(metrics.complexityDistribution.heuristic.high / metrics.totalRequests * 100).toFixed(1)}%)\n`;
    report += 'Weighted:\n';
    report += `  Low: ${metrics.complexityDistribution.weighted.low} (${(metrics.complexityDistribution.weighted.low / metrics.totalRequests * 100).toFixed(1)}%)\n`;
    report += `  Medium: ${metrics.complexityDistribution.weighted.medium} (${(metrics.complexityDistribution.weighted.medium / metrics.totalRequests * 100).toFixed(1)}%)\n`;
    report += `  High: ${metrics.complexityDistribution.weighted.high} (${(metrics.complexityDistribution.weighted.high / metrics.totalRequests * 100).toFixed(1)}%)\n\n`;

    report += '## Type Distribution\n';
    report += 'Heuristic: ' + JSON.stringify(metrics.typeDistribution.heuristic) + '\n';
    report += 'Weighted: ' + JSON.stringify(metrics.typeDistribution.weighted) + '\n\n';

    if (disagreements.length > 0) {
      report += '## Recent Disagreements (Sample)\n';
      for (const d of disagreements.slice(0, 3)) {
        report += `\nContent: ${d.messageContent.substring(0, 80)}...\n`;
        report += `Heuristic: ${d.heuristic.complexity}/${d.heuristic.type}\n`;
        report += `Weighted: ${d.weighted.complexity}/${d.weighted.type} (score: ${d.weighted.weightedScore.toFixed(3)}, dims: ${d.weighted.dominantDimensions.slice(0, 2).join(', ')})\n`;
      }
    }

    if (routingDiffs.length > 0) {
      report += '\n\n## Routing Differences (Sample)\n';
      for (const r of routingDiffs.slice(0, 3)) {
        report += `\nContent: ${r.messageContent.substring(0, 80)}...\n`;
        report += `Heuristic would route to: ${r.heuristicWouldRoute}\n`;
        report += `Weighted would route to: ${r.weightedWouldRoute}\n`;
        report += `Reason: ${r.heuristic.complexity}/${r.heuristic.type} vs ${r.weighted.complexity}/${r.weighted.type}\n`;
      }
    }

    return report;
  }

  /**
   * Export comparisons to JSON file
   */
  async exportComparisons(filepath: string): Promise<void> {
    const data = {
      exportedAt: new Date().toISOString(),
      totalComparisons: this.comparisons.length,
      metrics: this.getMetrics(),
      comparisons: this.comparisons,
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Clear all stored comparisons
   */
  clearComparisons(): void {
    this.comparisons = [];
  }

  private emptyMetrics(): ABTestMetrics {
    return {
      totalRequests: 0,
      complexityAgreement: 0,
      typeAgreement: 0,
      sensitiveAgreement: 0,
      overallAgreement: 0,
      routingDifference: 0,
      avgHeuristicTime: 0,
      avgWeightedTime: 0,
      complexityDistribution: {
        heuristic: { low: 0, medium: 0, high: 0 },
        weighted: { low: 0, medium: 0, high: 0 },
      },
      typeDistribution: {
        heuristic: {},
        weighted: {},
      },
    };
  }
}
