export type MasteryTier = 0 | 1 | 2 | 3; // 0: Unseen, 1: Familiar (Recognition), 2: Learned (Cued Recall), 3: Mastered (Exam Application)

export type FailureCategory =
  | 'cue_miss'
  | 'discrimination_error'
  | 'execution_slip'
  | 'careless'
  | 'structural_misconception';

export type HintRung = 0 | 1 | 2 | 3 | 4 | 5;

export interface HintLadder {
  0: string; // R0: Attention redirect (costs nothing)
  1: string; // R1: Pattern re-description (names pattern class)
  2: string; // R2: Candidate cluster (narrows space)
  3: string; // R3: Named proposition (retrieval surrendered, execution remains)
  4: string; // R4: Move outline (execution outlined)
  5: string; // R5: Worked step (boundary lesson)
}

export interface PropositionNode {
  id: string;
  unitId: string;
  title: string;
  statement: string;
  /** Principle i: True if this is a foundational, caveat-free truth accepted at face value */
  isUnconditionalTruth: boolean;
  /** Prerequisite proposition IDs that jointly lead to this node */
  prerequisites: string[];
  /** 1-5 Pareto 80/20 generator weight (5 = core exam generator that unlocks many downstream concepts) */
  examWeight: 1 | 2 | 3 | 4 | 5;
  /** Principle ii: "How could I have discovered this?" — the problem that forces this idea to exist */
  motivatedHook: string;
  /** LearnHarness open prediction question before teaching the step */
  predictionPrompt: {
    question: string;
    options: string[];
    correctIndex: number;
    resolution: string;
  };
  /** LearnHarness step-by-step teaching unit + immediate landing check */
  teachingStep: {
    coreExplanation: string;
    visualMentalModel: string;
    keyFormulaOrRule?: string;
    checkQuestion: {
      question: string;
      options: {
        text: string;
        misconceptionTag?: string;
        diagnosticFeedback: string;
      }[];
      correctIndex: number;
    };
  };
  /** Quizlet Learn 4-stage incremental mastery items (pre-compiled for 0ms, 0-token execution) */
  quizletStages: {
    recognition: {
      question: string;
      options: {
        text: string;
        misconception: string;
        explanation: string;
      }[];
      correctIndex: number;
    };
    discrimination: {
      scenario: string;
      confusableWith: string;
      question: string;
      options: {
        text: string;
        whyRightOrWrong: string;
      }[];
      correctIndex: number;
    };
    cuedRecall: {
      prompt: string;
      acceptedKeywords: string[];
      canonicalAnswer: string;
      hints: [string, string, string, string, string, string];
    };
    application: {
      examProblem: string;
      feynmanPrompt: string;
      requiredMoves: {
        id: string;
        label: string;
        keywords: string[];
      }[];
      modelSolution: string;
      commonTraps: string[];
      hints: [string, string, string, string, string, string];
    };
  };
}

export interface CourseUnit {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  examSharePercent: number;
  primingSummary: string;
  unconditionalTruthSummary: string;
}

export interface CoursePack {
  id: string;
  code: string;
  title: string;
  institutionTag: string;
  examTitle: string;
  description: string;
  lastUpdated: string;
  units: CourseUnit[];
  nodes: PropositionNode[];
}

export interface ConfidencePoint {
  confidence: number; // 0-100
  correct: boolean;
  timestamp: number;
}

export interface NodeMasteryState {
  nodeId: string;
  tier: MasteryTier;
  /** Ebbinghaus / FSRS memory stability half-life in hours */
  stabilityHours: number;
  lastReviewedAt: number | null;
  attempts: number;
  correctStreak: number;
  unaidedSuccesses: number;
  hintedSuccesses: number;
  maxHintRungUsed: number;
  confidenceHistory: ConfidencePoint[];
  probeBracket: 'floor_held' | 'edge_target' | 'ceiling_gap' | 'unprobed';
  thinkingNotes: string[];
}

export interface MistakeRecord {
  id: string;
  courseId: string;
  unitId: string;
  nodeId: string;
  nodeTitle: string;
  timestamp: number;
  stage:
    | 'probe'
    | 'predict'
    | 'recognition'
    | 'discrimination'
    | 'cued_recall'
    | 'application'
    | 'examiner';
  failureCategory: FailureCategory;
  question: string;
  learnerAnswer: string;
  learnerThinking: string;
  confidence: number;
  correctTarget: string;
  surgicalRepair: string;
  retestedAndCleared: boolean;
}

export interface NodeReadinessBreakdown {
  nodeId: string;
  title: string;
  unitId: string;
  tier: MasteryTier;
  tierLabel: 'Unseen' | 'Familiar' | 'Learned' | 'Mastered';
  rawTierScore: number; // 0, 38, 74, 100
  retrievability: number; // 0.0 - 1.0 (spaced repetition freshness)
  calibrationMultiplier: number; // 0.80 - 1.05
  unaidedMultiplier: number; // 0.75 - 1.0
  effectiveReadiness: number; // 0 - 100
  examWeight: number;
  isDueForReview: boolean;
  isOverconfidentTrap: boolean;
}

export interface UnitReadinessReport {
  unitId: string;
  unitNumber: number;
  title: string;
  examSharePercent: number;
  readinessScore: number; // 0 - 100
  letterGrade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D/F';
  tierCounts: {
    unseen: number;
    familiar: number;
    learned: number;
    mastered: number;
    total: number;
  };
  freshnessPercent: number;
  highYieldReadiness: number;
  unresolvedMistakes: number;
  nodeBreakdowns: NodeReadinessBreakdown[];
}

export interface CourseReadinessReport {
  courseId: string;
  overallScore: number; // 0 - 100
  letterGradePrediction: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'Building';
  aGradeLikelihoodPercent: number; // 0 - 100% probability of getting an A or above
  encouragingHeadline: string;
  encouragingSubtext: string;
  tierCounts: {
    unseen: number;
    familiar: number;
    learned: number;
    mastered: number;
    total: number;
  };
  calibrationScore: number; // 0 - 100
  retentionFreshness: number; // 0 - 100
  highYieldCoverage: number; // 0 - 100
  unresolvedMistakesCount: number;
  dueForReviewCount: number;
  units: UnitReadinessReport[];
  nextBestAction: {
    mode: 'quizlet_learn' | 'probe_teach' | 'mistake_drill' | 'priming_80_20' | 'strict_examiner';
    headline: string;
    reason: string;
    estimatedGainPercent: number;
    targetUnitId?: string;
    targetNodeIds: string[];
  };
}

export type AIProviderId =
  | 'auto'
  | 'codex-cli'
  | 'claude-cli'
  | 'chatgpt-oauth'
  | 'openai-api'
  | 'anthropic-api'
  | 'custom-local'
  | 'zero-token-local';

export interface AIProviderStatus {
  activeProvider: AIProviderId;
  codexCliAvailable: boolean;
  codexCliVersion?: string;
  claudeCliAvailable: boolean;
  claudeCliVersion?: string;
  chatgptOAuthConnected: boolean;
  chatgptOAuthEmail?: string;
  chatgptOAuthPending?: boolean;
  openaiKeyConfigured: boolean;
  anthropicKeyConfigured: boolean;
  customEndpointUrl?: string;
  tokenStats: {
    localZeroTokenActions: number;
    aiAssistedActions: number;
    estimatedTokensSaved: number;
    estimatedApiCostUsd: number;
  };
}
