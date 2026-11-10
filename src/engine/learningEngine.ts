import type {
  CoursePack,
  CourseReadinessReport,
  FailureCategory,
  MasteryTier,
  MistakeRecord,
  NodeMasteryState,
  NodeReadinessBreakdown,
  PropositionNode,
  UnitReadinessReport,
} from '../types/harness';

const TIER_BASE_SCORES: Record<MasteryTier, number> = {
  0: 0,
  1: 38,
  2: 74,
  3: 100,
};

const TIER_LABELS: Record<MasteryTier, 'Unseen' | 'Familiar' | 'Learned' | 'Mastered'> = {
  0: 'Unseen',
  1: 'Familiar',
  2: 'Learned',
  3: 'Mastered',
};

export function createInitialNodeState(nodeId: string): NodeMasteryState {
  return {
    nodeId,
    tier: 0,
    stabilityHours: 18, // Initial half-life of 18 hours before consolidation
    lastReviewedAt: null,
    attempts: 0,
    correctStreak: 0,
    unaidedSuccesses: 0,
    hintedSuccesses: 0,
    maxHintRungUsed: 0,
    confidenceHistory: [],
    probeBracket: 'unprobed',
    thinkingNotes: [],
  };
}

/**
 * Computes Ebbinghaus / FSRS spaced-repetition retrievability R(t) = 2^(-dt / S)
 */
export function computeRetrievability(
  state: NodeMasteryState,
  nowMs: number = Date.now()
): number {
  if (!state.lastReviewedAt || state.tier === 0) return 1.0;
  const elapsedHours = Math.max(0, (nowMs - state.lastReviewedAt) / (1000 * 60 * 60));
  if (elapsedHours <= 1.5) return 1.0; // Freshly studied in current/recent session
  const stability = Math.max(6, state.stabilityHours || 18);
  const rawDecay = Math.pow(2, -elapsedHours / stability);
  // Floor at 0.45 so decayed items signal "Review Needed" rather than erasing all progress
  return Math.max(0.45, Math.min(1.0, rawDecay));
}

export function computeNodeReadiness(
  node: PropositionNode,
  state: NodeMasteryState | undefined,
  nowMs: number = Date.now()
): NodeReadinessBreakdown {
  const s = state ?? createInitialNodeState(node.id);
  const rawTierScore = TIER_BASE_SCORES[s.tier];
  const retrievability = computeRetrievability(s, nowMs);

  // Confidence calibration multiplier: detect overconfident mistakes ("Illusion of Competence")
  let calibrationMultiplier = 1.0;
  let isOverconfidentTrap = false;
  if (s.confidenceHistory.length > 0) {
    const recent = s.confidenceHistory.slice(-4);
    const overconfidentMisses = recent.filter((c) => !c.correct && c.confidence >= 75).length;
    const confidentHits = recent.filter((c) => c.correct && c.confidence >= 70).length;
    if (overconfidentMisses > 0 && s.correctStreak < 2) {
      isOverconfidentTrap = true;
      calibrationMultiplier = 0.85;
    } else if (confidentHits >= 2) {
      calibrationMultiplier = 1.03;
    } else if (recent.every((c) => c.confidence < 45)) {
      // Hesitant / fragile understanding (LearnHarness Prober doctrine)
      calibrationMultiplier = 0.92;
    }
  }

  // Unaided multiplier: LearnHarness Practice Doctrine states R3+ surrenders retrieval
  let unaidedMultiplier = 1.0;
  if (s.tier >= 2) {
    if (s.unaidedSuccesses === 0 && s.maxHintRungUsed >= 3) {
      unaidedMultiplier = 0.82;
    } else if (s.maxHintRungUsed === 2 && s.unaidedSuccesses === 0) {
      unaidedMultiplier = 0.92;
    }
  }

  // Partial progress boost if probed as floor_held or attempted
  let baseScore = rawTierScore;
  if (s.tier === 0 && s.probeBracket === 'floor_held') {
    baseScore = 65;
  } else if (s.tier === 1 && s.correctStreak >= 2) {
    baseScore = 52;
  } else if (s.tier === 2 && s.unaidedSuccesses >= 1 && s.correctStreak >= 2) {
    baseScore = 84;
  }

  const effectiveReadiness = Math.round(
    Math.min(100, Math.max(0, baseScore * retrievability * calibrationMultiplier * unaidedMultiplier))
  );

  const isDueForReview = s.tier >= 1 && retrievability < 0.84;

  return {
    nodeId: node.id,
    title: node.title,
    unitId: node.unitId,
    tier: s.tier,
    tierLabel: TIER_LABELS[s.tier],
    rawTierScore,
    retrievability: Math.round(retrievability * 100) / 100,
    calibrationMultiplier,
    unaidedMultiplier,
    effectiveReadiness,
    examWeight: node.examWeight,
    isDueForReview,
    isOverconfidentTrap,
  };
}

export function scoreToLetterGrade(
  score: number
): 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D/F' {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 74) return 'B';
  if (score >= 67) return 'C+';
  if (score >= 60) return 'C';
  return 'D/F';
}

export function computeCourseReadiness(
  course: CoursePack,
  masteryMap: Record<string, NodeMasteryState>,
  mistakes: MistakeRecord[],
  nowMs: number = Date.now()
): CourseReadinessReport {
  const courseMistakes = mistakes.filter(
    (m) => m.courseId === course.id && !m.retestedAndCleared
  );

  // Compute downstream dependency count (Generator Power) for each node
  const downstreamCount: Record<string, number> = {};
  for (const node of course.nodes) {
    downstreamCount[node.id] = 0;
  }
  for (const node of course.nodes) {
    for (const prereq of node.prerequisites) {
      downstreamCount[prereq] = (downstreamCount[prereq] ?? 0) + 1;
    }
  }

  const unitReports: UnitReadinessReport[] = course.units.map((unit) => {
    const unitNodes = course.nodes.filter((n) => n.unitId === unit.id);
    const breakdowns = unitNodes.map((n) =>
      computeNodeReadiness(n, masteryMap[n.id], nowMs)
    );

    const tierCounts = {
      unseen: breakdowns.filter((b) => b.tier === 0).length,
      familiar: breakdowns.filter((b) => b.tier === 1).length,
      learned: breakdowns.filter((b) => b.tier === 2).length,
      mastered: breakdowns.filter((b) => b.tier === 3).length,
      total: breakdowns.length,
    };

    let weightedSum = 0;
    let totalWeight = 0;
    let highYieldSum = 0;
    let highYieldWeight = 0;

    for (const b of breakdowns) {
      const genBoost = 1 + 0.2 * (downstreamCount[b.nodeId] ?? 0);
      const w = b.examWeight * genBoost;
      weightedSum += b.effectiveReadiness * w;
      totalWeight += w;

      if (b.examWeight >= 4) {
        highYieldSum += b.effectiveReadiness * w;
        highYieldWeight += w;
      }
    }

    const unitMistakes = courseMistakes.filter((m) => m.unitId === unit.id).length;
    const mistakePenalty = Math.min(8, unitMistakes * 2);
    const rawUnitScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const readinessScore = Math.round(Math.max(0, Math.min(100, rawUnitScore - mistakePenalty)));

    const activeBreakdowns = breakdowns.filter((b) => b.tier >= 1);
    const freshnessPercent =
      activeBreakdowns.length > 0
        ? Math.round(
            (activeBreakdowns.reduce((acc, b) => acc + b.retrievability, 0) /
              activeBreakdowns.length) *
              100
          )
        : 100;

    const highYieldReadiness =
      highYieldWeight > 0 ? Math.round(highYieldSum / highYieldWeight) : readinessScore;

    return {
      unitId: unit.id,
      unitNumber: unit.number,
      title: unit.title,
      examSharePercent: unit.examSharePercent,
      readinessScore,
      letterGrade: scoreToLetterGrade(readinessScore),
      tierCounts,
      freshnessPercent,
      highYieldReadiness,
      unresolvedMistakes: unitMistakes,
      nodeBreakdowns: breakdowns,
    };
  });

  // Overall weighted readiness across units
  let overallWeighted = 0;
  let shareSum = 0;
  for (const u of unitReports) {
    overallWeighted += u.readinessScore * u.examSharePercent;
    shareSum += u.examSharePercent;
  }
  const overallScore =
    shareSum > 0 ? Math.round(overallWeighted / shareSum) : 0;

  const allBreakdowns = unitReports.flatMap((u) => u.nodeBreakdowns);
  const totalTierCounts = {
    unseen: allBreakdowns.filter((b) => b.tier === 0).length,
    familiar: allBreakdowns.filter((b) => b.tier === 1).length,
    learned: allBreakdowns.filter((b) => b.tier === 2).length,
    mastered: allBreakdowns.filter((b) => b.tier === 3).length,
    total: allBreakdowns.length,
  };

  // Confidence calibration accuracy across all recorded attempts
  const allConfPoints = Object.values(masteryMap).flatMap((m) => m.confidenceHistory);
  let calibrationScore = 88;
  if (allConfPoints.length > 0) {
    const errors = allConfPoints.map((pt) => {
      const target = pt.correct ? 100 : 0;
      return Math.abs(pt.confidence - target);
    });
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    calibrationScore = Math.round(Math.max(25, Math.min(100, 100 - avgError * 0.85)));
  }

  const activeNodes = allBreakdowns.filter((b) => b.tier >= 1);
  const retentionFreshness =
    activeNodes.length > 0
      ? Math.round(
          (activeNodes.reduce((acc, b) => acc + b.retrievability, 0) / activeNodes.length) * 100
        )
      : 100;

  const highYieldBreakdowns = allBreakdowns.filter((b) => b.examWeight >= 4);
  const highYieldCoverage =
    highYieldBreakdowns.length > 0
      ? Math.round(
          highYieldBreakdowns.reduce((acc, b) => acc + b.effectiveReadiness, 0) /
            highYieldBreakdowns.length
        )
      : overallScore;

  const dueForReviewCount = allBreakdowns.filter((b) => b.isDueForReview).length;

  // Probability of getting an A (90%+) on the college exam using logistic-like curve
  const aGradeLikelihoodPercent = Math.round(
    Math.min(
      99,
      Math.max(
        4,
        overallScore >= 90
          ? 90 + (overallScore - 90) * 0.9
          : overallScore >= 75
          ? 55 + (overallScore - 75) * 2.3
          : overallScore * 0.72
      )
    )
  );

  // Encouraging, Quizlet-Learn style progress messaging + MatthewSmith confidence coaching
  let encouragingHeadline = '';
  let encouragingSubtext = '';
  if (overallScore >= 90) {
    encouragingHeadline = 'A / A+ Exam Readiness Locked In — Trust Your Preparation!';
    encouragingSubtext = `You've mastered ${totalTierCounts.mastered}/${totalTierCounts.total} core propositions with ${highYieldCoverage}% high-yield generator coverage. A quick pre-exam overview is all you need.`;
  } else if (overallScore >= 78) {
    encouragingHeadline = 'Strong Momentum — Within Striking Distance of an A!';
    encouragingSubtext = `${totalTierCounts.learned + totalTierCounts.mastered} of ${totalTierCounts.total} concepts are in Learned/Mastered territory. Convert your remaining Familiar concepts to unaided recall to hit 90%+.`;
  } else if (overallScore >= 50) {
    encouragingHeadline = 'Solid Foundations Built — Keep the Incremental Streak Going!';
    encouragingSubtext = `Your mental model is taking shape (${overallScore}% readiness). Each 7-question Quizlet Learn sprint adds +6–10% directly to your exam score predictor.`;
  } else if (overallScore > 0) {
    encouragingHeadline = 'Great Start — Building Your 80/20 Prerequisite Skeleton!';
    encouragingSubtext = `Focus on locking in the Unconditional Truths first. Once the bedrock nodes click, downstream concepts will fall into place twice as fast.`;
  } else {
    encouragingHeadline = 'Ready to Launch — Start with a 2-Minute 80/20 Priming or Diagnostic Probe';
    encouragingSubtext = `We'll map what you already know, skip redundant material, and guide you step-by-step from Familiar to 100% Exam-Ready.`;
  }

  // Determine the highest-ROI Next Best Action
  let nextBestAction: CourseReadinessReport['nextBestAction'];
  if (courseMistakes.length >= 2) {
    nextBestAction = {
      mode: 'mistake_drill',
      headline: `Clear ${courseMistakes.length} Logged Exam Traps in Mistake Notebook`,
      reason: 'Fixing repeated mistakes in a fresh surface is the fastest way to jump +8–12% readiness before test day.',
      estimatedGainPercent: Math.min(14, courseMistakes.length * 3),
      targetNodeIds: courseMistakes.map((m) => m.nodeId),
    };
  } else if (totalTierCounts.unseen === totalTierCounts.total) {
    const foundationalIds = course.nodes
      .filter((n) => n.isUnconditionalTruth)
      .map((n) => n.id);
    nextBestAction = {
      mode: 'probe_teach',
      headline: 'Run Socratic Diagnostic Probe & 80/20 Priming',
      reason: 'Binary-search your starting edge so we prune what you already know and lock in the unconditional truths first.',
      estimatedGainPercent: 18,
      targetNodeIds: foundationalIds,
    };
  } else if (dueForReviewCount >= 2) {
    const dueIds = allBreakdowns.filter((b) => b.isDueForReview).map((b) => b.nodeId);
    nextBestAction = {
      mode: 'quizlet_learn',
      headline: `Spaced Review Sprint (${dueForReviewCount} Decaying Concepts)`,
      reason: 'Reactivating concepts right before they fade locks them into neocortex long-term storage.',
      estimatedGainPercent: Math.min(12, dueForReviewCount * 3),
      targetNodeIds: dueIds,
    };
  } else {
    // Find unit with highest exam share gap
    const weakestUnit = [...unitReports].sort(
      (a, b) =>
        (100 - b.readinessScore) * b.examSharePercent -
        (100 - a.readinessScore) * a.examSharePercent
    )[0];
    const targetNodes =
      weakestUnit?.nodeBreakdowns
        .filter((n) => n.effectiveReadiness < 90)
        .sort((a, b) => b.examWeight - a.examWeight)
        .slice(0, 4)
        .map((n) => n.nodeId) ?? [];

    nextBestAction = {
      mode: overallScore >= 82 ? 'strict_examiner' : 'quizlet_learn',
      headline:
        overallScore >= 82
          ? `Final Polish: Strict Examiner Drill on ${weakestUnit?.title ?? 'Core Units'}`
          : `7-Question Incremental Round: ${weakestUnit?.title ?? 'Next Unit'}`,
      reason:
        overallScore >= 82
          ? 'Test unaided Feynman explanations to push your readiness past 92% into guaranteed A+ territory.'
          : 'Advance concepts from Familiar (MCQ) -> Learned (Cued Recall) -> Mastered (Exam Application).',
      estimatedGainPercent: 9,
      targetUnitId: weakestUnit?.unitId,
      targetNodeIds: targetNodes,
    };
  }

  return {
    courseId: course.id,
    overallScore,
    letterGradePrediction:
      overallScore === 0 ? 'Building' : (scoreToLetterGrade(overallScore) as CourseReadinessReport['letterGradePrediction']),
    aGradeLikelihoodPercent,
    encouragingHeadline,
    encouragingSubtext,
    tierCounts: totalTierCounts,
    calibrationScore,
    retentionFreshness,
    highYieldCoverage,
    unresolvedMistakesCount: courseMistakes.length,
    dueForReviewCount,
    units: unitReports,
    nextBestAction,
  };
}

export interface QuizletRoundItem {
  id: string;
  node: PropositionNode;
  unitTitle: string;
  currentTier: MasteryTier;
  targetTier: MasteryTier;
  itemType: 'priming_predict' | 'recognition_mcq' | 'discrimination' | 'cued_recall' | 'exam_application';
  isMistakeRetest: boolean;
  isSpacedReview: boolean;
}

/**
 * Builds an interleaved Quizlet Learn Incremental Round respecting:
 * 1. Prerequisite Topological Order (Unconditional truths before derived nodes)
 * 2. The Inactivity Constraint (Interleaving across units/strands so adjacent items switch targets)
 * 3. Mistake Retesting in a fresh surface
 */
export function buildQuizletLearnRound(
  course: CoursePack,
  masteryMap: Record<string, NodeMasteryState>,
  mistakes: MistakeRecord[],
  selectedUnitId: string | 'all' = 'all',
  roundSize: number = 7
): QuizletRoundItem[] {
  const unitMap = new Map(course.units.map((u) => [u.id, u.title]));
  const eligibleNodes = course.nodes.filter(
    (n) => selectedUnitId === 'all' || n.unitId === selectedUnitId
  );

  const unresolvedMistakeNodeIds = new Set(
    mistakes
      .filter((m) => m.courseId === course.id && !m.retestedAndCleared)
      .map((m) => m.nodeId)
  );

  // Score each node for priority in this round
  const scoredCandidates = eligibleNodes.map((node) => {
    const state = masteryMap[node.id] ?? createInitialNodeState(node.id);
    const breakdown = computeNodeReadiness(node, state);
    const prereqsMet = node.prerequisites.every((pid) => {
      const pState = masteryMap[pid];
      return !pState || pState.tier >= 1 || pState.probeBracket === 'floor_held';
    });

    let priority = 0;
    const isMistakeRetest = unresolvedMistakeNodeIds.has(node.id);
    const isSpacedReview = breakdown.isDueForReview;

    if (isMistakeRetest) priority += 120;
    if (isSpacedReview) priority += 90;
    if (node.isUnconditionalTruth && state.tier < 2) priority += 70;
    if (prereqsMet && state.tier < 3) priority += 50;
    priority += node.examWeight * 10;
    priority += (100 - breakdown.effectiveReadiness) * 0.4;

    // Choose the appropriate incremental itemType based on current tier
    let itemType: QuizletRoundItem['itemType'];
    let targetTier: MasteryTier = state.tier;

    if (state.tier === 0) {
      itemType = state.attempts === 0 ? 'priming_predict' : 'recognition_mcq';
      targetTier = 1;
    } else if (state.tier === 1) {
      // Alternate between MCQ recognition and LearnHarness Near-Twin Discrimination
      itemType = state.attempts % 2 === 1 || isMistakeRetest ? 'discrimination' : 'cued_recall';
      targetTier = 2;
    } else if (state.tier === 2) {
      itemType = isMistakeRetest ? 'cued_recall' : 'exam_application';
      targetTier = 3;
    } else {
      // Tier 3 Mastered: keep fresh with discrimination or application
      itemType = isSpacedReview ? 'cued_recall' : 'discrimination';
      targetTier = 3;
    }

    return {
      node,
      state,
      priority,
      itemType,
      targetTier,
      isMistakeRetest,
      isSpacedReview,
    };
  });

  scoredCandidates.sort((a, b) => b.priority - a.priority);

  // Interleave so we don't repeat the same unit/node consecutively when possible
  const selected: QuizletRoundItem[] = [];
  const pool = [...scoredCandidates];

  while (selected.length < roundSize && pool.length > 0) {
    const lastUnitId = selected[selected.length - 1]?.node.unitId;
    const lastNodeId = selected[selected.length - 1]?.node.id;

    let pickIdx = pool.findIndex(
      (c) => c.node.id !== lastNodeId && (selectedUnitId !== 'all' || c.node.unitId !== lastUnitId)
    );
    if (pickIdx === -1) {
      pickIdx = pool.findIndex((c) => c.node.id !== lastNodeId);
    }
    if (pickIdx === -1) pickIdx = 0;

    const picked = pool.splice(pickIdx, 1)[0];
    selected.push({
      id: `${picked.node.id}-${selected.length}-${Date.now()}`,
      node: picked.node,
      unitTitle: unitMap.get(picked.node.unitId) ?? 'Unit',
      currentTier: picked.state.tier,
      targetTier: picked.targetTier,
      itemType: picked.itemType,
      isMistakeRetest: picked.isMistakeRetest,
      isSpacedReview: picked.isSpacedReview,
    });
  }

  return selected;
}

/**
 * Updates a node's mastery state after an attempt, adjusting Quizlet Learn tier
 * and Ebbinghaus/FSRS stability half-life.
 */
export function recordNodeAttempt(
  prevState: NodeMasteryState | undefined,
  nodeId: string,
  params: {
    correct: boolean;
    confidence: number;
    hintRungUsed: number; // 0 = no hint or R0, 1..5 = R1..R5
    itemType: QuizletRoundItem['itemType'] | 'probe' | 'teach_check';
    thinkingText?: string;
    nowMs?: number;
  }
): {
  nextState: NodeMasteryState;
  tierPromoted: boolean;
  previousTier: MasteryTier;
  newTier: MasteryTier;
} {
  const now = params.nowMs ?? Date.now();
  const base = prevState ?? createInitialNodeState(nodeId);
  const previousTier = base.tier;

  let newTier: MasteryTier = base.tier;
  let stabilityHours = base.stabilityHours || 18;
  const unaided = params.hintRungUsed <= 1;

  if (params.correct) {
    // Promote tier based on the stage demonstrated
    if (params.itemType === 'priming_predict' || params.itemType === 'recognition_mcq') {
      newTier = Math.max(base.tier, 1) as MasteryTier;
      stabilityHours = Math.min(720, stabilityHours * 1.45);
    } else if (params.itemType === 'discrimination' || params.itemType === 'teach_check') {
      newTier = Math.max(base.tier, unaided ? 2 : 1) as MasteryTier;
      stabilityHours = Math.min(720, stabilityHours * (unaided ? 1.75 : 1.3));
    } else if (params.itemType === 'cued_recall') {
      newTier = Math.max(base.tier, unaided ? 2 : 1) as MasteryTier;
      if (base.tier === 2 && unaided && base.correctStreak >= 1) {
        newTier = 3; // Promoted after strong unaided recall streak
      }
      stabilityHours = Math.min(720, stabilityHours * (unaided ? 2.1 : 1.35));
    } else if (params.itemType === 'exam_application' || params.itemType === 'probe') {
      newTier = (unaided ? 3 : Math.max(base.tier, 2)) as MasteryTier;
      stabilityHours = Math.min(720, stabilityHours * (unaided ? 2.6 : 1.4));
    }
  } else {
    // On a miss, stability tightens so spaced repetition schedules it sooner
    stabilityHours = Math.max(8, stabilityHours * 0.55);
    if (base.tier === 3) {
      newTier = 2; // Step back from Mastered to Learned for re-consolidation
    }
  }

  const nextConfidenceHistory = [
    ...base.confidenceHistory.slice(-9),
    {
      confidence: params.confidence,
      correct: params.correct,
      timestamp: now,
    },
  ];

  const nextThinkingNotes =
    params.thinkingText && params.thinkingText.trim().length > 3
      ? [...base.thinkingNotes.slice(-5), params.thinkingText.trim()]
      : base.thinkingNotes;

  const nextState: NodeMasteryState = {
    ...base,
    tier: newTier,
    stabilityHours: Math.round(stabilityHours * 10) / 10,
    lastReviewedAt: now,
    attempts: base.attempts + 1,
    correctStreak: params.correct ? base.correctStreak + 1 : 0,
    unaidedSuccesses:
      params.correct && unaided ? base.unaidedSuccesses + 1 : base.unaidedSuccesses,
    hintedSuccesses:
      params.correct && !unaided ? base.hintedSuccesses + 1 : base.hintedSuccesses,
    maxHintRungUsed: Math.max(base.maxHintRungUsed, params.hintRungUsed),
    confidenceHistory: nextConfidenceHistory,
    thinkingNotes: nextThinkingNotes,
  };

  return {
    nextState,
    tierPromoted: newTier > previousTier,
    previousTier,
    newTier,
  };
}

/**
 * Instant 0-Token Local Evaluation for Cued Recall & Exam Application.
 * Checks required reasoning moves & keywords, classifies any miss per LearnHarness
 * Practice Doctrine, and selects the exact surgical nudge on the R0-R5 ladder.
 */
export function evaluateFreeResponseLocally(
  node: PropositionNode,
  mode: 'cued_recall' | 'exam_application',
  learnerAnswer: string,
  learnerThinking: string,
  currentHintRung: number = 0
): {
  correct: boolean;
  scorePercent: number;
  matchedMoves: string[];
  missingMoves: string[];
  failureCategory: FailureCategory;
  verdictHeadline: string;
  surgicalFeedback: string;
  nextHintRung: number;
  nextHintText: string;
} {
  const combined = `${learnerAnswer} ${learnerThinking}`.toLowerCase();

  if (mode === 'cued_recall') {
    const keywords = node.quizletStages.cuedRecall.acceptedKeywords;
    const matched = keywords.filter((kw) => combined.includes(kw.toLowerCase()));
    const ratio = keywords.length > 0 ? matched.length / Math.min(2, keywords.length) : 1;
    const correct = ratio >= 0.5 || combined.includes(node.quizletStages.cuedRecall.canonicalAnswer.toLowerCase());

    const nextRung = Math.min(5, currentHintRung + 1);
    const hints = node.quizletStages.cuedRecall.hints;

    if (correct) {
      return {
        correct: true,
        scorePercent: 100,
        matchedMoves: matched,
        missingMoves: [],
        failureCategory: 'careless',
        verdictHeadline: 'Retrieval Confirmed — Key Mechanism Locked In',
        surgicalFeedback: `Spot on. Canonical anchor: ${node.quizletStages.cuedRecall.canonicalAnswer}`,
        nextHintRung: currentHintRung,
        nextHintText: hints[currentHintRung] ?? hints[0],
      };
    }

    const failureCategory: FailureCategory =
      learnerAnswer.trim().length < 8
        ? 'cue_miss'
        : matched.length > 0
        ? 'execution_slip'
        : 'structural_misconception';

    return {
      correct: false,
      scorePercent: Math.round(ratio * 100),
      matchedMoves: matched,
      missingMoves: keywords.filter((kw) => !matched.includes(kw)),
      failureCategory,
      verdictHeadline:
        failureCategory === 'cue_miss'
          ? 'Cue Miss — The Target Proposition Did Not Deploy Yet'
          : 'Partial Trace — Localize the Missing Mechanism',
      surgicalFeedback: `Pause before revealing the full answer. Use Rung R${nextRung} below to generate the missing link yourself.`,
      nextHintRung: nextRung,
      nextHintText: hints[nextRung] ?? hints[0],
    };
  }

  // Exam Application / Feynman mode: check against frozen requiredMoves rubric
  const moves = node.quizletStages.application.requiredMoves;
  const matchedMoves: string[] = [];
  const missingMoves: string[] = [];

  for (const move of moves) {
    const hit = move.keywords.some((kw) => combined.includes(kw.toLowerCase()));
    if (hit) {
      matchedMoves.push(move.label);
    } else {
      missingMoves.push(move.label);
    }
  }

  const scorePercent =
    moves.length > 0 ? Math.round((matchedMoves.length / moves.length) * 100) : 100;
  const correct = scorePercent >= 66;
  const nextRung = Math.min(5, currentHintRung + 1);
  const hints = node.quizletStages.application.hints;

  if (correct) {
    return {
      correct: true,
      scorePercent,
      matchedMoves,
      missingMoves,
      failureCategory: 'careless',
      verdictHeadline: `Verified (${matchedMoves.length}/${moves.length} Load-Bearing Moves Demonstrated)`,
      surgicalFeedback:
        missingMoves.length === 0
          ? `Every load-bearing derivation move landed cleanly.`
          : `Core chain succeeded! To make it 100% bulletproof on the exam, also explicitly state: ${missingMoves.join('; ')}.`,
      nextHintRung: currentHintRung,
      nextHintText: hints[currentHintRung] ?? hints[0],
    };
  }

  const failureCategory: FailureCategory =
    matchedMoves.length === 0
      ? 'cue_miss'
      : matchedMoves.length === 1
      ? 'discrimination_error'
      : 'execution_slip';

  return {
    correct: false,
    scorePercent,
    matchedMoves,
    missingMoves,
    failureCategory,
    verdictHeadline: `First Break Localized (${matchedMoves.length}/${moves.length} Moves Present)`,
    surgicalFeedback: `Missing move: "${missingMoves[0]}". Try stepping up one hint rung (R${nextRung}) rather than surrendering the problem.`,
    nextHintRung: nextRung,
    nextHintText: hints[nextRung] ?? hints[0],
  };
}
