/**
 * Weighted Classifier for Pearl Routing
 * Inspired by ClawRouter's 15-dimensional scoring system
 *
 * This classifier uses weighted scoring across multiple dimensions
 * to make more accurate routing decisions.
 */

import type {
  Message,
  RequestClassification,
  ClassificationOptions,
} from './types.js';

/**
 * Scoring dimensions with weights (sum to 1.0)
 */
interface ScoringWeights {
  reasoningMarkers: number;    // 0.18 - Math, logic, proofs
  codePresence: number;         // 0.15 - Code blocks, syntax
  technicalDepth: number;       // 0.12 - Architecture, algorithms
  domainSpecificity: number;    // 0.10 - Medical, legal, finance
  questionComplexity: number;   // 0.08 - Multi-part, depth
  contextLength: number;        // 0.08 - Message/conversation size
  multilingualContent: number;  // 0.06 - Non-English, mixed
  structuredOutput: number;     // 0.06 - Tables, lists, formatting
  toolRequirements: number;     // 0.05 - Needs external tools
  temporalAwareness: number;    // 0.04 - Time-sensitive, realtime
  creativityMarkers: number;    // 0.03 - Creative writing, art
  conversationalFlow: number;   // 0.02 - Chat, greetings
  sensitivityLevel: number;     // 0.02 - PII, health data
  ambiguityScore: number;       // 0.01 - Unclear intent
  customKeywords: number;       // 0.01 - User-defined overrides
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  reasoningMarkers: 0.18,
  codePresence: 0.15,
  technicalDepth: 0.12,
  domainSpecificity: 0.10,
  questionComplexity: 0.08,
  contextLength: 0.08,
  multilingualContent: 0.06,
  structuredOutput: 0.06,
  toolRequirements: 0.05,
  temporalAwareness: 0.04,
  creativityMarkers: 0.03,
  conversationalFlow: 0.02,
  sensitivityLevel: 0.02,
  ambiguityScore: 0.01,
  customKeywords: 0.01,
};

/**
 * Individual dimension scores (0-1 scale)
 */
interface DimensionScores {
  reasoningMarkers: number;
  codePresence: number;
  technicalDepth: number;
  domainSpecificity: number;
  questionComplexity: number;
  contextLength: number;
  multilingualContent: number;
  structuredOutput: number;
  toolRequirements: number;
  temporalAwareness: number;
  creativityMarkers: number;
  conversationalFlow: number;
  sensitivityLevel: number;
  ambiguityScore: number;
  customKeywords: number;
}

/**
 * Weighted classification result
 */
export interface WeightedClassificationResult extends RequestClassification {
  weightedScore: number;        // Final weighted score (0-1)
  dimensionScores: DimensionScores;
  dominantDimensions: string[]; // Top 3 dimensions
  confidence: number;           // Confidence in classification
}

export class WeightedClassifier {
  private weights: ScoringWeights;
  private customKeywordOverrides: Map<string, { complexity: string; type: string }>;

  // Reasoning markers
  private reasoningPatterns = {
    mathSymbols: /[∫∑∂∇αβγδεζηθλμπσφψω]|\\[a-z]+\{/g,
    equations: /=|≠|≈|≡|∝|∞|±|×|÷|≥|≤|⊂|⊃|∈|∉/g,
    logicWords: /\b(therefore|thus|hence|consequently|prove|derive|deduce|infer|implies|iff|qed|lemma|theorem|corollary)\b/gi,
    stepByStep: /\b(step\s+\d+|first|second|third|then|next|finally|lastly)\b/gi,
    reasoning: /\b(because|since|given|assume|suppose|let|consider)\b/gi,
  };

  // Code patterns
  private codePatterns = {
    codeBlocks: /```[\s\S]*?```|`[^`]+`/g,
    keywords: /\b(function|class|import|export|const|let|var|def|async|await|return|if|else|for|while|try|catch)\b/g,
    fileExtensions: /\.(js|ts|py|java|cpp|go|rs|rb|php|swift|kt)\b/gi,
    symbols: /[{}()[\];:,.]|=>|->|\|\||&&|===|!==|==|!=|<=|>=/g,
  };

  // Technical depth patterns
  private technicalPatterns = {
    architecture: /\b(microservices|distributed|scalable|fault[-\s]tolerant|load[-\s]balancing|cache|cdn|api|rest|graphql|grpc)\b/gi,
    algorithms: /\b(O\([n^2log]+\)|recursion|dynamic[-\s]programming|binary[-\s]search|sorting|hash[-\s]table|tree|graph|bfs|dfs)\b/gi,
    advanced: /\b(concurrency|parallelism|mutex|semaphore|deadlock|race[-\s]condition|thread|async|reactive)\b/gi,
  };

  // Domain-specific patterns
  private domainPatterns = {
    medical: /\b(diagnosis|prescription|symptom|treatment|patient|doctor|medical|clinical|therapy|pharmaceutical)\b/gi,
    legal: /\b(contract|litigation|statute|plaintiff|defendant|jurisdiction|tort|liability|compliance|regulation)\b/gi,
    financial: /\b(investment|portfolio|equity|derivative|hedge|dividend|interest[-\s]rate|fiscal|monetary)\b/gi,
    scientific: /\b(hypothesis|experiment|methodology|empirical|statistical|correlation|causation|peer[-\s]review)\b/gi,
  };

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.customKeywordOverrides = new Map();
  }

  /**
   * Main weighted classification method
   */
  async classify(
    messages: Message[],
    options: ClassificationOptions = {}
  ): Promise<WeightedClassificationResult> {
    const userMessage = this.getLatestUserMessage(messages);
    const content = userMessage?.content?.trim() || '';

    // Score each dimension
    const scores = this.scoreDimensions(content, messages);

    // Calculate weighted final score
    const weightedScore = this.calculateWeightedScore(scores);

    // Determine complexity based on weighted score
    const complexity = this.scoreToComplexity(weightedScore);

    // Determine type based on dominant dimensions
    const type = this.scoresToType(scores);

    // Check sensitivity
    const sensitive = scores.sensitivityLevel > 0.5;

    // Estimate tokens
    const estimatedTokens = this.estimateTokens(content);

    // Calculate confidence
    const confidence = this.calculateConfidence(scores);

    // Get dominant dimensions
    const dominantDimensions = this.getDominantDimensions(scores);

    return {
      complexity,
      type,
      sensitive,
      estimatedTokens,
      requiresTools: scores.toolRequirements > 0.5,
      weightedScore,
      dimensionScores: scores,
      dominantDimensions,
      confidence,
    };
  }

  /**
   * Score all 15 dimensions
   */
  private scoreDimensions(content: string, messages: Message[]): DimensionScores {
    const lower = content.toLowerCase();

    return {
      reasoningMarkers: this.scoreReasoningMarkers(content),
      codePresence: this.scoreCodePresence(content),
      technicalDepth: this.scoreTechnicalDepth(content),
      domainSpecificity: this.scoreDomainSpecificity(content),
      questionComplexity: this.scoreQuestionComplexity(content),
      contextLength: this.scoreContextLength(content, messages),
      multilingualContent: this.scoreMultilingualContent(content),
      structuredOutput: this.scoreStructuredOutput(content),
      toolRequirements: this.scoreToolRequirements(content),
      temporalAwareness: this.scoreTemporalAwareness(content),
      creativityMarkers: this.scoreCreativityMarkers(content),
      conversationalFlow: this.scoreConversationalFlow(content),
      sensitivityLevel: this.scoreSensitivityLevel(content),
      ambiguityScore: this.scoreAmbiguity(content),
      customKeywords: this.scoreCustomKeywords(content),
    };
  }

  /**
   * Score reasoning markers (weight: 0.18)
   * Made more aggressive after A/B testing showed under-detection
   */
  private scoreReasoningMarkers(content: string): number {
    let score = 0;
    const total = 5; // Number of sub-patterns

    // Math symbols (reduced threshold from 3 to 1)
    const mathMatches = content.match(this.reasoningPatterns.mathSymbols) || [];
    score += Math.min(mathMatches.length / 1, 1.0);

    // Equations (reduced threshold from 5 to 2)
    const eqMatches = content.match(this.reasoningPatterns.equations) || [];
    score += Math.min(eqMatches.length / 2, 1.0);

    // Logic words (kept at 2, but now any match gives 0.5+)
    const logicMatches = content.match(this.reasoningPatterns.logicWords) || [];
    score += Math.min(logicMatches.length / 2, 1.0);

    // Step-by-step (reduced threshold from 3 to 2)
    const stepMatches = content.match(this.reasoningPatterns.stepByStep) || [];
    score += Math.min(stepMatches.length / 2, 1.0);

    // Reasoning words (reduced threshold from 4 to 2)
    const reasoningMatches = content.match(this.reasoningPatterns.reasoning) || [];
    score += Math.min(reasoningMatches.length / 2, 1.0);

    return score / total;
  }

  /**
   * Score code presence (weight: 0.15)
   */
  private scoreCodePresence(content: string): number {
    let score = 0;
    const total = 4;

    // Code blocks
    const codeBlocks = content.match(this.codePatterns.codeBlocks) || [];
    score += Math.min(codeBlocks.length / 2, 1.0);

    // Keywords
    const keywords = content.match(this.codePatterns.keywords) || [];
    score += Math.min(keywords.length / 5, 1.0);

    // File extensions
    const files = content.match(this.codePatterns.fileExtensions) || [];
    score += Math.min(files.length / 2, 1.0);

    // Symbols
    const symbols = content.match(this.codePatterns.symbols) || [];
    score += Math.min(symbols.length / 10, 1.0);

    return score / total;
  }

  /**
   * Score technical depth (weight: 0.12)
   * More aggressive thresholds after A/B testing
   */
  private scoreTechnicalDepth(content: string): number {
    let score = 0;
    const total = 3;

    // Architecture terms (reduced from 3 to 1)
    const arch = content.match(this.technicalPatterns.architecture) || [];
    score += Math.min(arch.length / 1, 1.0);

    // Algorithms (kept at 2, but any match gives 0.5+)
    const algo = content.match(this.technicalPatterns.algorithms) || [];
    score += Math.min(algo.length / 2, 1.0);

    // Advanced (reduced from 2 to 1)
    const adv = content.match(this.technicalPatterns.advanced) || [];
    score += Math.min(adv.length / 1, 1.0);

    return score / total;
  }

  /**
   * Score domain specificity (weight: 0.10)
   */
  private scoreDomainSpecificity(content: string): number {
    const medical = (content.match(this.domainPatterns.medical) || []).length;
    const legal = (content.match(this.domainPatterns.legal) || []).length;
    const financial = (content.match(this.domainPatterns.financial) || []).length;
    const scientific = (content.match(this.domainPatterns.scientific) || []).length;

    const maxDomainScore = Math.max(medical, legal, financial, scientific);
    return Math.min(maxDomainScore / 3, 1.0);
  }

  /**
   * Score question complexity (weight: 0.08)
   */
  private scoreQuestionComplexity(content: string): number {
    const questionMarks = (content.match(/\?/g) || []).length;
    const howQuestions = (content.match(/\bhow\b/gi) || []).length;
    const whyQuestions = (content.match(/\bwhy\b/gi) || []).length;
    const multiPart = (content.match(/\b(and|also|additionally|furthermore)\b/gi) || []).length;

    const score =
      Math.min(questionMarks / 3, 0.3) +
      Math.min(howQuestions / 2, 0.3) +
      Math.min(whyQuestions / 2, 0.2) +
      Math.min(multiPart / 3, 0.2);

    return Math.min(score, 1.0);
  }

  /**
   * Score context length (weight: 0.08)
   */
  private scoreContextLength(content: string, messages: Message[]): number {
    const contentLength = content.length;
    const messageCount = messages.length;

    const lengthScore = Math.min(contentLength / 1000, 1.0);
    const countScore = Math.min(messageCount / 10, 1.0);

    return (lengthScore + countScore) / 2;
  }

  /**
   * Additional scoring methods (simplified for brevity)
   */
  private scoreMultilingualContent(content: string): number {
    // Detect non-ASCII characters
    const nonAscii = content.match(/[^\x00-\x7F]/g) || [];
    return Math.min(nonAscii.length / 50, 1.0);
  }

  private scoreStructuredOutput(content: string): number {
    const hasTable = /\|.*\|.*\|/g.test(content);
    const hasList = /^[\s]*[-*\d]+\./gm.test(content);
    const hasFormatting = /\b(format|table|list|bullet|structure)\b/gi.test(content);

    return (hasTable ? 0.4 : 0) + (hasList ? 0.3 : 0) + (hasFormatting ? 0.3 : 0);
  }

  private scoreToolRequirements(content: string): number {
    const toolKeywords = /\b(search|fetch|calculate|convert|translate|api|database|query)\b/gi;
    const matches = content.match(toolKeywords) || [];
    return Math.min(matches.length / 3, 1.0);
  }

  private scoreTemporalAwareness(content: string): number {
    const temporal = /\b(now|today|current|latest|recent|real[-\s]time|live|immediate)\b/gi;
    const matches = content.match(temporal) || [];
    return Math.min(matches.length / 2, 1.0);
  }

  private scoreCreativityMarkers(content: string): number {
    const creative = /\b(write|story|poem|creative|imagine|character|plot|narrative|fiction|novel)\b/gi;
    const matches = content.match(creative) || [];
    return Math.min(matches.length / 3, 1.0);
  }

  private scoreConversationalFlow(content: string): number {
    const greetings = /^(hi|hello|hey|thanks|thank you|goodbye|bye)!?$/i;
    const casual = /\b(just|actually|kinda|sorta|maybe|perhaps)\b/gi;

    const isGreeting = greetings.test(content.trim()) ? 0.6 : 0;
    const casualMatches = (content.match(casual) || []).length;

    return Math.min(isGreeting + casualMatches / 5, 1.0);
  }

  private scoreSensitivityLevel(content: string): number {
    const sensitive = /\b(password|secret|api[-\s]key|token|ssn|credit[-\s]card|confidential|private)\b/gi;
    const matches = content.match(sensitive) || [];
    return matches.length > 0 ? 1.0 : 0.0;
  }

  private scoreAmbiguity(content: string): number {
    const vague = /\b(something|somehow|maybe|perhaps|possibly|kind of|sort of|stuff|thing)\b/gi;
    const matches = content.match(vague) || [];
    return Math.min(matches.length / 4, 1.0);
  }

  private scoreCustomKeywords(content: string): number {
    for (const [keyword, override] of this.customKeywordOverrides) {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        return 1.0; // Full score if custom keyword matches
      }
    }
    return 0.0;
  }

  /**
   * Calculate weighted final score
   */
  private calculateWeightedScore(scores: DimensionScores): number {
    let total = 0;
    for (const [dimension, weight] of Object.entries(this.weights)) {
      const score = scores[dimension as keyof DimensionScores];
      total += score * weight;
    }
    return total;
  }

  /**
   * Convert weighted score to complexity level
   * Thresholds calibrated based on real scoring distribution
   */
  private scoreToComplexity(score: number): 'low' | 'medium' | 'high' {
    // Lowered thresholds based on A/B testing results
    // Most real queries score 0.05-0.20, not 0.3-0.6
    if (score < 0.12) return 'low';     // Was 0.3
    if (score < 0.25) return 'medium';  // Was 0.6
    return 'high';
  }

  /**
   * Determine type based on dominant dimensions
   * Thresholds adjusted based on A/B testing results
   */
  private scoresToType(scores: DimensionScores): 'general' | 'code' | 'creative' | 'analysis' | 'chat' {
    // Check for chat first (lowered from 0.7)
    if (scores.conversationalFlow > 0.5) return 'chat';

    // Check code (lowered thresholds)
    if (scores.codePresence > 0.3 || scores.technicalDepth > 0.4) return 'code';

    // Check creative (lowered from 0.6)
    if (scores.creativityMarkers > 0.4) return 'creative';

    // Check analysis (lowered thresholds)
    if (scores.reasoningMarkers > 0.3 || scores.questionComplexity > 0.4) return 'analysis';

    return 'general';
  }

  /**
   * Calculate confidence in classification
   */
  private calculateConfidence(scores: DimensionScores): number {
    // Higher confidence when dimensions have clear peaks
    const values = Object.values(scores);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // High confidence if there's a clear dominant dimension
    const separation = max - avg;
    return Math.min(separation * 2, 1.0);
  }

  /**
   * Get top 3 dominant dimensions
   */
  private getDominantDimensions(scores: DimensionScores): string[] {
    const entries = Object.entries(scores);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 3).map(([dim]) => dim);
  }

  /**
   * Helper methods
   */
  private getLatestUserMessage(messages: Message[]): Message | undefined {
    return messages.filter(m => m.role === 'user').pop();
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 3.5);
  }

  /**
   * Add custom keyword override
   */
  addCustomKeyword(keyword: string, override: { complexity: string; type: string }): void {
    this.customKeywordOverrides.set(keyword, override);
  }

  /**
   * Update weights
   */
  updateWeights(newWeights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }
}
