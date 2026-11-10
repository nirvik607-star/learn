import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import type {
  CoursePack,
  CourseReadinessReport,
  FailureCategory,
  MasteryTier,
  MistakeRecord,
  NodeMasteryState,
} from '../types/harness';
import {
  buildQuizletLearnRound,
  evaluateFreeResponseLocally,
  type QuizletRoundItem,
} from '../engine/learningEngine';

interface QuizletLearnSprintProps {
  course: CoursePack;
  report: CourseReadinessReport;
  masteryMap: Record<string, NodeMasteryState>;
  mistakes: MistakeRecord[];
  initialUnitFilter?: string | 'all';
  focusNodeId?: string | null;
  onRecordAttempt: (params: {
    nodeId: string;
    unitId: string;
    nodeTitle: string;
    correct: boolean;
    confidence: number;
    hintRungUsed: number;
    itemType: QuizletRoundItem['itemType'];
    thinkingText: string;
    learnerAnswer: string;
    questionText: string;
    correctTargetText: string;
    failureCategory?: FailureCategory;
    surgicalRepair?: string;
  }) => { tierPromoted: boolean; previousTier: MasteryTier; newTier: MasteryTier };
  onBackToDashboard: () => void;
  onLocalZeroTokenTick: () => void;
}

const TIER_NAMES: Record<MasteryTier, string> = {
  0: 'Unseen',
  1: 'Familiar',
  2: 'Learned',
  3: 'Mastered',
};

export const QuizletLearnSprint: React.FC<QuizletLearnSprintProps> = ({
  course,
  report,
  masteryMap,
  mistakes,
  initialUnitFilter = 'all',
  focusNodeId = null,
  onRecordAttempt,
  onBackToDashboard,
  onLocalZeroTokenTick,
}) => {
  const [unitFilter, setUnitFilter] = useState<string | 'all'>(initialUnitFilter);
  const [roundItems, setRoundItems] = useState<QuizletRoundItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [roundStartReadiness, setRoundStartReadiness] = useState(report.overallScore);
  const [roundPromotions, setRoundPromotions] = useState<
    { title: string; from: MasteryTier; to: MasteryTier }[]
  >([]);
  const [roundFinished, setRoundFinished] = useState(false);

  // Per-question interaction state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [freeAnswer, setFreeAnswer] = useState('');
  const [thinkingTrace, setThinkingTrace] = useState('');
  const [confidence, setConfidence] = useState<number>(75);
  const [hintRung, setHintRung] = useState<number>(-1); // -1 = no hints requested yet
  const [coverOptionsMode, setCoverOptionsMode] = useState<boolean>(false);
  const [optionsRevealed, setOptionsRevealed] = useState<boolean>(true);
  const [feynmanExaminerMode, setFeynmanExaminerMode] = useState<boolean>(false);

  // Verdict state
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [verdictHeadline, setVerdictHeadline] = useState('');
  const [verdictDetail, setVerdictDetail] = useState('');
  const [promotionBanner, setPromotionBanner] = useState<string | null>(null);

  // Optional live AI Socratic Coach / Strict Examiner state
  const [aiCoachLoading, setAiCoachLoading] = useState(false);
  const [aiCoachReply, setAiCoachReply] = useState<string | null>(null);
  const [aiCoachProvider, setAiCoachProvider] = useState<string | null>(null);

  const startNewRound = (selectedUnit: string | 'all' = unitFilter) => {
    let items = buildQuizletLearnRound(course, masteryMap, mistakes, selectedUnit, 7);
    if (focusNodeId) {
      const focusNode = course.nodes.find((n) => n.id === focusNodeId);
      if (focusNode) {
        const focusState = masteryMap[focusNode.id];
        const tier = focusState?.tier ?? 0;
        const firstType: QuizletRoundItem['itemType'] =
          tier === 0
            ? 'priming_predict'
            : tier === 1
            ? 'discrimination'
            : tier === 2
            ? 'cued_recall'
            : 'exam_application';
        const focusItem: QuizletRoundItem = {
          id: `${focusNode.id}-focus-${Date.now()}`,
          node: focusNode,
          unitTitle: course.units.find((u) => u.id === focusNode.unitId)?.title ?? 'Unit',
          currentTier: tier,
          targetTier: Math.min(3, tier + 1) as MasteryTier,
          itemType: firstType,
          isMistakeRetest: false,
          isSpacedReview: false,
        };
        items = [focusItem, ...items.filter((i) => i.node.id !== focusNode.id).slice(0, 6)];
      }
    }
    setRoundItems(items);
    setCurrentIndex(0);
    setRoundStartReadiness(report.overallScore);
    setRoundPromotions([]);
    setRoundFinished(false);
    resetQuestionState(coverOptionsMode);
  };

  const resetQuestionState = (coverMode: boolean) => {
    setSelectedOption(null);
    setFreeAnswer('');
    setThinkingTrace('');
    setConfidence(75);
    setHintRung(-1);
    setOptionsRevealed(!coverMode);
    setSubmitted(false);
    setIsCorrect(false);
    setVerdictHeadline('');
    setVerdictDetail('');
    setPromotionBanner(null);
    setAiCoachReply(null);
    setAiCoachProvider(null);
  };

  useEffect(() => {
    startNewRound(initialUnitFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, initialUnitFilter, focusNodeId]);

  const currentItem = roundItems[currentIndex];
  if (!currentItem) {
    return null;
  }

  const { node, itemType } = currentItem;

  // Determine the active question payload based on itemType
  const isMcqStage =
    itemType === 'priming_predict' ||
    itemType === 'recognition_mcq' ||
    itemType === 'discrimination';

  const getActiveHints = (): string[] => {
    if (itemType === 'cued_recall') return node.quizletStages.cuedRecall.hints;
    if (itemType === 'exam_application') return node.quizletStages.application.hints;
    return [
      `R0: Re-read the core question constraint carefully.`,
      `R1: Motivated hook: ${node.motivatedHook}`,
      `R2: Focus on how ${node.title} connects to its prerequisite foundation.`,
      `R3: Core proposition: ${node.statement}`,
      `R4: Eliminate any choice that reverses the cause-and-effect direction.`,
      `R5: Target rule: ${node.teachingStep.keyFormulaOrRule ?? node.statement}`,
    ];
  };

  const handleRequestNextHint = () => {
    const next = Math.min(5, hintRung + 1);
    setHintRung(next);
    onLocalZeroTokenTick();
  };

  const handleMcqSelect = (optIndex: number) => {
    if (submitted) return;
    setSelectedOption(optIndex);
    onLocalZeroTokenTick();

    let correctIdx = 0;
    let chosenText = '';
    let correctText = '';
    let feedback = '';
    let failureCat: FailureCategory = 'discrimination_error';

    if (itemType === 'priming_predict') {
      correctIdx = node.predictionPrompt.correctIndex;
      chosenText = node.predictionPrompt.options[optIndex];
      correctText = node.predictionPrompt.options[correctIdx];
      feedback = node.predictionPrompt.resolution;
    } else if (itemType === 'recognition_mcq') {
      correctIdx = node.quizletStages.recognition.correctIndex;
      const opt = node.quizletStages.recognition.options[optIndex];
      chosenText = opt.text;
      correctText = node.quizletStages.recognition.options[correctIdx].text;
      feedback =
        optIndex === correctIdx
          ? opt.explanation
          : `Misconception Detected (${opt.misconception}): ${opt.explanation}`;
      failureCat = 'structural_misconception';
    } else {
      // discrimination
      correctIdx = node.quizletStages.discrimination.correctIndex;
      const opt = node.quizletStages.discrimination.options[optIndex];
      chosenText = opt.text;
      correctText = node.quizletStages.discrimination.options[correctIdx].text;
      feedback = opt.whyRightOrWrong;
      failureCat = 'discrimination_error';
    }

    const hit = optIndex === correctIdx;
    setSubmitted(true);
    setIsCorrect(hit);
    setStreak((s) => (hit ? s + 1 : 0));

    const res = onRecordAttempt({
      nodeId: node.id,
      unitId: node.unitId,
      nodeTitle: node.title,
      correct: hit,
      confidence,
      hintRungUsed: Math.max(0, hintRung),
      itemType,
      thinkingText: thinkingTrace,
      learnerAnswer: chosenText,
      questionText:
        itemType === 'priming_predict'
          ? node.predictionPrompt.question
          : itemType === 'recognition_mcq'
          ? node.quizletStages.recognition.question
          : node.quizletStages.discrimination.question,
      correctTargetText: correctText,
      failureCategory: hit ? undefined : failureCat,
      surgicalRepair: feedback,
    });

    if (hit) {
      setVerdictHeadline(
        itemType === 'priming_predict'
          ? 'Prediction Landed — Core Mechanism Unlocked!'
          : itemType === 'discrimination'
          ? 'Clean Discrimination — You Separated the Confusable!'
          : 'Correct Recognition — Concept Anchored!'
      );
      if (res.tierPromoted) {
        const msg = `Graduated: ${TIER_NAMES[res.previousTier]} → ${TIER_NAMES[res.newTier]}!`;
        setPromotionBanner(msg);
        setRoundPromotions((prev) => [
          ...prev,
          { title: node.title, from: res.previousTier, to: res.newTier },
        ]);
      }
    } else {
      setVerdictHeadline('Logged to Mistake Notebook — Re-Queued in Fresh Surface');
      // LearnHarness Practice Doctrine Section IX: retest every miss at the end of the round in a fresh surface!
      if (roundItems.length < 10) {
        const retestType: QuizletRoundItem['itemType'] =
          itemType === 'recognition_mcq' ? 'discrimination' : 'recognition_mcq';
        setRoundItems((prev) => [
          ...prev,
          {
            ...currentItem,
            id: `${node.id}-retest-${Date.now()}`,
            itemType: retestType,
            isMistakeRetest: true,
          },
        ]);
      }
    }
    setVerdictDetail(feedback);
  };

  const handleFreeResponseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted || (!freeAnswer.trim() && !thinkingTrace.trim())) return;
    onLocalZeroTokenTick();

    const mode = itemType === 'cued_recall' ? 'cued_recall' : 'exam_application';
    const evalRes = evaluateFreeResponseLocally(
      node,
      mode,
      freeAnswer,
      thinkingTrace,
      Math.max(0, hintRung)
    );

    setSubmitted(true);
    setIsCorrect(evalRes.correct);
    setStreak((s) => (evalRes.correct ? s + 1 : 0));
    setVerdictHeadline(evalRes.verdictHeadline);
    setVerdictDetail(evalRes.surgicalFeedback);

    if (!evalRes.correct && hintRung < evalRes.nextHintRung) {
      setHintRung(evalRes.nextHintRung);
    }

    const res = onRecordAttempt({
      nodeId: node.id,
      unitId: node.unitId,
      nodeTitle: node.title,
      correct: evalRes.correct,
      confidence,
      hintRungUsed: Math.max(0, hintRung),
      itemType,
      thinkingText: thinkingTrace,
      learnerAnswer: freeAnswer || thinkingTrace,
      questionText:
        itemType === 'cued_recall'
          ? node.quizletStages.cuedRecall.prompt
          : feynmanExaminerMode
          ? node.quizletStages.application.feynmanPrompt
          : node.quizletStages.application.examProblem,
      correctTargetText:
        itemType === 'cued_recall'
          ? node.quizletStages.cuedRecall.canonicalAnswer
          : node.quizletStages.application.modelSolution,
      failureCategory: evalRes.correct ? undefined : evalRes.failureCategory,
      surgicalRepair: evalRes.surgicalFeedback,
    });

    if (evalRes.correct && res.tierPromoted) {
      const msg = `Graduated: ${TIER_NAMES[res.previousTier]} → ${TIER_NAMES[res.newTier]}!`;
      setPromotionBanner(msg);
      setRoundPromotions((prev) => [
        ...prev,
        { title: node.title, from: res.previousTier, to: res.newTier },
      ]);
    } else if (!evalRes.correct && roundItems.length < 10) {
      setRoundItems((prev) => [
        ...prev,
        {
          ...currentItem,
          id: `${node.id}-retest-${Date.now()}`,
          itemType: 'discrimination',
          isMistakeRetest: true,
        },
      ]);
    }
  };

  const handleAskLiveAiCoach = async (mode: 'socratic_nudge' | 'strict_examiner') => {
    setAiCoachLoading(true);
    try {
      const resp = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          nodeTitle: node.title,
          nodeStatement: node.statement,
          learnerInput: freeAnswer,
          learnerThinking: thinkingTrace,
        }),
      });
      const data = await resp.json();
      setAiCoachReply(data.reply || 'Focus on the foundational causal step.');
      setAiCoachProvider(data.provider || 'zero-token-local');
    } catch {
      setAiCoachReply(
        `[Offline Socratic Coach] Connect your reasoning "${
          thinkingTrace || freeAnswer || 'step 1'
        }" directly to: ${node.statement}`
      );
      setAiCoachProvider('zero-token-local');
    } finally {
      setAiCoachLoading(false);
    }
  };

  const handleNextItem = () => {
    if (currentIndex + 1 >= roundItems.length) {
      setRoundFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      resetQuestionState(coverOptionsMode);
    }
  };

  if (roundFinished) {
    const delta = Math.max(0, report.overallScore - roundStartReadiness);
    return (
      <div className="study-stage-shell">
        <div className="surface-card" style={{ textAlign: 'center', padding: '2.2rem 1.5rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--tier-mastered-soft)',
              color: 'var(--tier-mastered)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <Award size={32} />
          </div>
          <h2 className="font-serif-editorial" style={{ fontSize: '2rem', fontWeight: 400 }}>
            Sprint Complete — Exam Readiness Now {report.overallScore}%!
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '0.4rem auto 1.25rem' }}>
            {delta > 0
              ? `You gained +${delta}% overall exam readiness in this sprint. Projected Grade: ${report.letterGradePrediction} (${report.aGradeLikelihoodPercent}% A-Grade Likelihood).`
              : `You reinforced long-term stability (half-life S) across ${roundItems.length} interleaved propositions.`}
          </p>

          {roundPromotions.length > 0 && (
            <div
              className="surface-elevated"
              style={{ maxWidth: '520px', margin: '0 auto 1.5rem', textAlign: 'left' }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--tier-mastered)',
                  marginBottom: '0.5rem',
                }}
              >
                Concepts Promoted This Round
              </div>
              {roundPromotions.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.84rem',
                    padding: '0.35rem 0',
                    borderBottom:
                      idx < roundPromotions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <span>{p.title}</span>
                  <span className="badge badge-mastered">
                    {TIER_NAMES[p.from]} → {TIER_NAMES[p.to]}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => startNewRound(unitFilter)}>
              <Flame size={16} /> Start Next 7-Question Sprint
            </button>
            <button className="btn btn-secondary" onClick={onBackToDashboard}>
              View Unit & Overall Readiness Map
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeHints = getActiveHints();
  const stageBadgeLabel =
    itemType === 'priming_predict'
      ? 'Stage 0 · 80/20 Priming & Prediction (Unseen → Familiar)'
      : itemType === 'recognition_mcq'
      ? 'Stage 1 · Diagnostic Recognition (Unseen → Familiar)'
      : itemType === 'discrimination'
      ? 'Stage 1.5 · Near-Twin Discrimination (Familiar → Learned)'
      : itemType === 'cued_recall'
      ? 'Stage 2 · Cued Active Recall (Familiar → Learned)'
      : 'Stage 3 · Exam Application & Composition (Learned → Mastered)';

  return (
    <div className="study-stage-shell">
      {/* Sprint Top Progress & Controls Bar */}
      <div
        className="surface-card"
        style={{
          padding: '0.85rem 1.15rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
          <select
            aria-label="Filter Sprint Unit"
            className="course-select"
            value={unitFilter}
            onChange={(e) => {
              const val = e.target.value;
              setUnitFilter(val);
              startNewRound(val);
            }}
          >
            <option value="all">Interleaved: All Units (Recommended)</option>
            {course.units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.number}: {u.title}
              </option>
            ))}
          </select>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              <span>
                Sprint Progress: <strong>{currentIndex + 1} / {roundItems.length}</strong>
              </span>
              <span className="font-mono-tabular">
                Overall Readiness: <strong style={{ color: 'var(--tier-mastered)' }}>{report.overallScore}%</strong> ({report.letterGradePrediction})
              </span>
            </div>
            <div className="segmented-bar" style={{ height: '6px', margin: '0.35rem 0 0' }}>
              <div
                className="segment-mastered"
                style={{ width: `${((currentIndex + (submitted ? 1 : 0)) / roundItems.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <span className="badge badge-familiar font-mono-tabular" title="Active Recall Streak">
            <Flame size={13} /> Streak: {streak}
          </span>
          {isMcqStage && (
            <button
              className="btn btn-ghost"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
              onClick={() => {
                const nextMode = !coverOptionsMode;
                setCoverOptionsMode(nextMode);
                setOptionsRevealed(!nextMode);
              }}
              title="EvolvingMedic Active Hypothesis Rule: Formulate your answer in your head before seeing the A/B/C/D options!"
            >
              {coverOptionsMode ? <EyeOff size={13} /> : <Eye size={13} />} Cover Options First
            </button>
          )}
        </div>
      </div>

      {/* Main Question Card */}
      <div className="surface-card">
        {/* Card Metadata Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span className="badge badge-learned">{stageBadgeLabel}</span>
            {currentItem.isMistakeRetest && (
              <span className="badge badge-danger">
                <RefreshCw size={11} /> Fresh-Surface Mistake Retest
              </span>
            )}
            {node.isUnconditionalTruth && (
              <span className="badge badge-familiar">
                <Sparkles size={11} /> Principle i: Unconditional Truth
              </span>
            )}
          </div>
          <span className="font-mono-tabular" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {currentItem.unitTitle} · Yield {node.examWeight}/5
          </span>
        </div>

        {/* Node Title */}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.65rem' }}>
          {node.title}
        </h2>

        {/* Stage 0 Priming Hook (Principle ii: "How could I have discovered this?") */}
        {itemType === 'priming_predict' && (
          <div
            className="surface-elevated"
            style={{
              marginBottom: '1rem',
              borderLeft: '3px solid var(--accent-primary)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--accent-primary-text)',
                marginBottom: '0.25rem',
              }}
            >
              Principle ii · Motivated Discovery ("How could I have discovered this?")
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{node.motivatedHook}</p>
          </div>
        )}

        {/* Stage 1.5 Near-Twin Discrimination Scenario Box */}
        {itemType === 'discrimination' && (
          <div
            className="surface-elevated"
            style={{
              marginBottom: '1rem',
              borderLeft: '3px solid var(--tier-learned)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--tier-learned)',
                marginBottom: '0.25rem',
              }}
            >
              Near-Twin Discrimination · Separating: {node.quizletStages.discrimination.confusableWith}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {node.quizletStages.discrimination.scenario}
            </p>
          </div>
        )}

        {/* Question Prompt */}
        <div
          style={{
            fontSize: '1.02rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1.1rem',
            lineHeight: 1.5,
          }}
        >
          {itemType === 'priming_predict' && node.predictionPrompt.question}
          {itemType === 'recognition_mcq' && node.quizletStages.recognition.question}
          {itemType === 'discrimination' && node.quizletStages.discrimination.question}
          {itemType === 'cued_recall' && node.quizletStages.cuedRecall.prompt}
          {itemType === 'exam_application' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  {feynmanExaminerMode
                    ? 'Feynman / Angry Examiner Prompt (Explain clearly without jargon traps):'
                    : 'Exam-Level Multi-Step Application Problem:'}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem' }}
                  onClick={() => setFeynmanExaminerMode((v) => !v)}
                >
                  <Zap size={12} /> Switch to {feynmanExaminerMode ? 'Standard Exam Problem' : 'Strict Feynman Prompt'}
                </button>
              </div>
              <div>
                {feynmanExaminerMode
                  ? node.quizletStages.application.feynmanPrompt
                  : node.quizletStages.application.examProblem}
              </div>
            </div>
          )}
        </div>

        {/* LearnHarness "Think Out Loud" + Confidence Calibration Row */}
        <div
          className="surface-elevated"
          style={{
            marginBottom: '1.1rem',
            padding: '0.85rem 1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <label
              htmlFor="learner-thinking-field"
              style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}
            >
              Think Out Loud (Optional for MCQ · Captures your reasoning chain & uncertainties):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <label
                htmlFor="confidence-slider"
                className="font-mono-tabular"
                style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}
              >
                Confidence: <strong>{confidence}%</strong>
              </label>
              <input
                id="confidence-slider"
                type="range"
                min={10}
                max={100}
                step={5}
                value={confidence}
                disabled={submitted}
                onChange={(e) => setConfidence(Number(e.target.value))}
                style={{ width: '100px', accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </div>
          <textarea
            id="learner-thinking-field"
            className="thinking-textarea"
            style={{ minHeight: '54px' }}
            placeholder="Jot down your mental hypothesis, equation setup, or where you feel unsure before answering..."
            value={thinkingTrace}
            disabled={submitted}
            onChange={(e) => setThinkingTrace(e.target.value)}
          />
        </div>

        {/* MCQ Options or Free-Response Box */}
        {isMcqStage ? (
          <div>
            {!optionsRevealed && !submitted ? (
              <div
                className="surface-elevated"
                style={{ textAlign: 'center', padding: '1.5rem', marginBottom: '1rem' }}
              >
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Active Hypothesis Mode: Lock in your prediction above first so multiple-choice options don’t trick you with false familiarity!
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setOptionsRevealed(true)}
                >
                  <Eye size={15} /> Reveal Options Now
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {(itemType === 'priming_predict'
                  ? node.predictionPrompt.options.map((t) => ({ text: t }))
                  : itemType === 'recognition_mcq'
                  ? node.quizletStages.recognition.options
                  : node.quizletStages.discrimination.options
                ).map((opt, idx) => {
                  const correctIdx =
                    itemType === 'priming_predict'
                      ? node.predictionPrompt.correctIndex
                      : itemType === 'recognition_mcq'
                      ? node.quizletStages.recognition.correctIndex
                      : node.quizletStages.discrimination.correctIndex;

                  let stateClass = '';
                  if (submitted) {
                    if (idx === correctIdx) stateClass = 'selected-correct';
                    else if (idx === selectedOption) stateClass = 'selected-wrong';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={submitted}
                      className={`option-button ${stateClass}`}
                      onClick={() => handleMcqSelect(idx)}
                    >
                      <span className="option-index font-mono-tabular">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleFreeResponseSubmit}>
            <label
              htmlFor="free-response-input"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.4rem',
              }}
            >
              Your Unaided Recall / Exam Solution:
            </label>
            <textarea
              id="free-response-input"
              className="thinking-textarea"
              style={{ minHeight: '95px', marginBottom: '0.85rem' }}
              placeholder="Write your derivation or explanation here (graded in 0ms against required reasoning moves)..."
              value={freeAnswer}
              disabled={submitted}
              onChange={(e) => setFreeAnswer(e.target.value)}
            />
            {!submitted && (
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Check Answer (0-Token Rubric Grader)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRequestNextHint}
                  disabled={hintRung >= 5}
                >
                  <Lightbulb size={15} style={{ color: 'var(--accent-primary)' }} />{' '}
                  {hintRung < 0 ? 'Request Minimal Hint (R0)' : `Next Hint Rung (R${Math.min(5, hintRung + 1)}/R5)`}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleAskLiveAiCoach(feynmanExaminerMode ? 'strict_examiner' : 'socratic_nudge')}
                  disabled={aiCoachLoading}
                >
                  <MessageSquare size={15} />{' '}
                  {aiCoachLoading ? 'Asking Coach...' : 'Ask Live Socratic / Strict Examiner'}
                </button>
              </div>
            )}
          </form>
        )}

        {/* 6-Rung Hint Ladder Display (LearnHarness Practice Doctrine Section VI) */}
        {hintRung >= 0 && (
          <div
            className="surface-elevated"
            style={{
              marginTop: '1rem',
              borderLeft: '3px solid var(--accent-primary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--accent-primary-text)',
                }}
              >
                LearnHarness 6-Rung Minimal Hint Ladder (R0 → R{hintRung} Active)
              </span>
              {hintRung < 5 && !submitted && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                  onClick={handleRequestNextHint}
                >
                  Step Up to R{hintRung + 1}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.84rem' }}>
              {activeHints.slice(0, hintRung + 1).map((h, i) => (
                <div key={i} style={{ color: i === hintRung ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  • {h}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live AI Coach / Strict Examiner Reply */}
        {aiCoachReply && (
          <div
            className="surface-elevated"
            style={{
              marginTop: '1rem',
              borderLeft: '3px solid var(--tier-learned)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--tier-learned)', fontWeight: 700, marginBottom: '0.25rem' }}>
              <span>LIVE AGENT FEEDBACK</span>
              <span className="font-mono-tabular">Provider: {aiCoachProvider}</span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{aiCoachReply}</p>
          </div>
        )}

        {/* Verdict & Explanation Banner after Submit */}
        {submitted && (
          <div
            className="surface-elevated"
            style={{
              marginTop: '1.2rem',
              borderLeft: `4px solid ${isCorrect ? 'var(--tier-mastered)' : 'var(--danger)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isCorrect ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--tier-mastered)' }} />
                ) : (
                  <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                )}
                <strong style={{ fontSize: '0.96rem', color: isCorrect ? 'var(--tier-mastered)' : 'var(--danger)' }}>
                  {verdictHeadline}
                </strong>
              </div>
              {promotionBanner && (
                <span className="badge badge-mastered">
                  <Sparkles size={12} /> {promotionBanner}
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {verdictDetail}
            </p>

            {/* Show Core Teaching Explanation & Formula if it was Priming or a Miss */}
            {(itemType === 'priming_predict' || !isCorrect || itemType === 'exam_application') && (
              <div
                style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.84rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Core Mechanism & Structural Anchor:
                </div>
                <p>{node.teachingStep.coreExplanation}</p>
                {node.teachingStep.keyFormulaOrRule && (
                  <pre
                    className="font-mono-tabular"
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-canvas)',
                      borderRadius: '6px',
                      overflowX: 'auto',
                      color: 'var(--accent-primary-text)',
                      fontSize: '0.8rem',
                    }}
                  >
                    {node.teachingStep.keyFormulaOrRule}
                  </pre>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem' }}
                onClick={() => handleAskLiveAiCoach('strict_examiner')}
                disabled={aiCoachLoading}
              >
                <ShieldAlert size={14} /> Challenge Me with Strict Examiner
              </button>
              <button
                id="next-sprint-question-btn"
                type="button"
                className="btn btn-primary"
                onClick={handleNextItem}
              >
                {currentIndex + 1 >= roundItems.length ? 'Finish Sprint & See Readiness Gain' : 'Next Question'}{' '}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
