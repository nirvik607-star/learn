import React from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Brain,
  Clock,
  Compass,
  Flame,
  Layers,
  Play,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type {
  CoursePack,
  CourseReadinessReport,
  NodeMasteryState,
  PropositionNode,
} from '../types/harness';

interface ReadinessCommandCenterProps {
  course: CoursePack;
  report: CourseReadinessReport;
  masteryMap: Record<string, NodeMasteryState>;
  onStartQuizletSprint: (unitId?: string | 'all', focusNodeId?: string) => void;
  onOpenSocraticNode: (nodeId: string, startProbe?: boolean) => void;
  onOpenMistakeDrill: () => void;
  onOpenCramSheet: () => void;
  onFastForwardDecayDemo: () => void;
}

export const ReadinessCommandCenter: React.FC<ReadinessCommandCenterProps> = ({
  course,
  report,
  onStartQuizletSprint,
  onOpenSocraticNode,
  onOpenMistakeDrill,
  onOpenCramSheet,
  onFastForwardDecayDemo,
}) => {
  const total = Math.max(1, report.tierCounts.total);
  const masteredPct = (report.tierCounts.mastered / total) * 100;
  const learnedPct = (report.tierCounts.learned / total) * 100;
  const familiarPct = (report.tierCounts.familiar / total) * 100;

  const dialColor =
    report.overallScore >= 88
      ? 'var(--tier-mastered)'
      : report.overallScore >= 72
      ? 'var(--tier-learned)'
      : 'var(--accent-primary)';

  const handleNextBestAction = () => {
    const action = report.nextBestAction;
    if (action.mode === 'mistake_drill') {
      onOpenMistakeDrill();
    } else if (action.mode === 'probe_teach') {
      onOpenSocraticNode(action.targetNodeIds[0] ?? course.nodes[0].id, true);
    } else {
      onStartQuizletSprint(action.targetUnitId ?? 'all');
    }
  };

  return (
    <div>
      {/* Hero Exam Readiness Cockpit Console */}
      <motion.section
        initial={{ opacity: 0, y: -14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="surface-card readiness-hero"
        id="readiness-hero-card"
        data-tour-id="tour-readiness-hero"
      >
        {/* Left: Overall Readiness Dial & Grade Predictor */}
        <div className="readiness-dial-box">
          <div
            className="score-circle font-mono-tabular"
            style={{ borderColor: dialColor }}
            title="Overall Weighted Exam Readiness (100% = Very likely to score an A/A+)"
          >
            <span className="score-number">{report.overallScore}%</span>
            <span className="score-label">Readiness</span>
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.35rem',
                flexWrap: 'wrap',
              }}
            >
              <span className="badge badge-mastered font-mono-tabular">
                Projected: {report.letterGradePrediction}
              </span>
              <span className="badge badge-familiar font-mono-tabular">
                {report.aGradeLikelihoodPercent}% A-Grade Odds
              </span>
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 600, lineHeight: 1.18 }}>
              {course.examTitle}
            </h1>
            <p
              className="mono"
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginTop: '0.25rem',
              }}
            >
              TARGET THRESHOLD: 90%+ = VERIFIED A / A+
            </p>
          </div>
        </div>

        {/* Center: Progress Breakdown & 4-Tier Incremental Telemetry Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <h2 style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {report.encouragingHeadline}
            </h2>
            <span
              className="font-mono-tabular"
              style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}
            >
              {report.tierCounts.mastered + report.tierCounts.learned}/{report.tierCounts.total}{' '}
              SOLIDIFIED
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {report.encouragingSubtext}
          </p>

          {/* Quizlet Learn 4-Stage Mastery Bar */}
          <div className="segmented-bar" aria-label="Quizlet Learn Mastery Progression">
            <motion.div
              className="segment-mastered"
              initial={{ width: 0 }}
              animate={{ width: `${masteredPct}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              title={`Mastered (Stage 3 Exam Application): ${report.tierCounts.mastered}`}
            />
            <motion.div
              className="segment-learned"
              initial={{ width: 0 }}
              animate={{ width: `${learnedPct}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              title={`Learned (Stage 2 Cued Recall): ${report.tierCounts.learned}`}
            />
            <motion.div
              className="segment-familiar"
              initial={{ width: 0 }}
              animate={{ width: `${familiarPct}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              title={`Familiar (Stage 1 Recognition & Discrimination): ${report.tierCounts.familiar}`}
            />
            <div className="segment-unseen" style={{ flex: 1 }} />
          </div>

          {/* Legend & Cognitive Telemetry */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.85rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div
              className="font-mono-tabular"
              style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: 'var(--tier-mastered)',
                    display: 'inline-block',
                  }}
                />
                <strong style={{ color: 'var(--text-primary)' }}>
                  {report.tierCounts.mastered}
                </strong>{' '}
                Mastered
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: 'var(--tier-learned)',
                    display: 'inline-block',
                  }}
                />
                <strong style={{ color: 'var(--text-primary)' }}>
                  {report.tierCounts.learned}
                </strong>{' '}
                Learned
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: 'var(--accent-primary)',
                    display: 'inline-block',
                  }}
                />
                <strong style={{ color: 'var(--text-primary)' }}>
                  {report.tierCounts.familiar}
                </strong>{' '}
                Familiar
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: 'var(--tier-unseen)',
                    display: 'inline-block',
                  }}
                />
                <strong style={{ color: 'var(--text-secondary)' }}>
                  {report.tierCounts.unseen}
                </strong>{' '}
                Unseen
              </span>
            </div>

            <div
              style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
              className="font-mono-tabular"
            >
              <span title="80/20 High-Yield Generator Coverage">
                <Zap
                  size={12}
                  strokeWidth={1.75}
                  style={{
                    display: 'inline',
                    verticalAlign: '-2px',
                    color: 'var(--accent-primary)',
                  }}
                />{' '}
                80/20 Yield: {report.highYieldCoverage}%
              </span>
              <span title="Confidence Calibration (Detects Illusions of Competence)">
                <Target
                  size={12}
                  strokeWidth={1.75}
                  style={{
                    display: 'inline',
                    verticalAlign: '-2px',
                    color: 'var(--tier-learned)',
                  }}
                />{' '}
                Calibration: {report.calibrationScore}%
              </span>
              <span title="Spaced Repetition Memory Freshness (Ebbinghaus Retrievability)">
                <Clock
                  size={12}
                  strokeWidth={1.75}
                  style={{
                    display: 'inline',
                    verticalAlign: '-2px',
                    color: 'var(--tier-mastered)',
                  }}
                />{' '}
                Freshness: {report.retentionFreshness}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Highest-ROI Next Best Action Launchpad */}
        <div
          className="surface-elevated"
          data-tour-id="tour-next-action"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.55rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow-tag">Recommended Next Sprint</span>
            <span className="badge badge-mastered font-mono-tabular">
              +{report.nextBestAction.estimatedGainPercent}% Readiness
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {report.nextBestAction.headline}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.42 }}>
            {report.nextBestAction.reason}
          </p>
          <button
            id="launch-recommended-sprint-btn"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.15rem' }}
            onClick={handleNextBestAction}
          >
            <Play size={14} strokeWidth={2} /> Launch Optimized Sprint
          </button>
        </div>
      </motion.section>

      {/* Secondary Quick-Action Strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.65rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            id="quick-start-all-units-btn"
            className="btn btn-secondary"
            onClick={() => onStartQuizletSprint('all')}
          >
            <Flame size={14} strokeWidth={1.75} style={{ color: 'var(--accent-primary)' }} />{' '}
            Interleaved Quizlet Learn Round (All Units)
          </button>
          <button
            id="quick-probe-diagnostic-btn"
            className="btn btn-secondary"
            onClick={() => onOpenSocraticNode(course.nodes[0].id, true)}
          >
            <Compass size={14} strokeWidth={1.75} style={{ color: 'var(--tier-learned)' }} />{' '}
            Socratic Probe (Bracket Knowledge Edge)
          </button>
          <button
            id="quick-cram-sheet-btn"
            className="btn btn-secondary"
            onClick={onOpenCramSheet}
          >
            <BookOpen size={14} strokeWidth={1.75} style={{ color: 'var(--tier-mastered)' }} />{' '}
            80/20 Pre-Exam Cram Sheet
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {report.unresolvedMistakesCount > 0 && (
            <button
              id="quick-mistake-drill-btn"
              className="btn btn-secondary"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={onOpenMistakeDrill}
            >
              <ShieldAlert size={14} strokeWidth={1.75} /> Drill {report.unresolvedMistakesCount}{' '}
              Logged Mistake
              {report.unresolvedMistakesCount > 1 ? 's' : ''}
            </button>
          )}
          <button
            id="simulate-decay-btn"
            className="btn btn-ghost btn-sm"
            onClick={onFastForwardDecayDemo}
            title="Simulate +48 hours elapsed to see Ebbinghaus Spaced Repetition decay & review scheduling in action"
          >
            <Clock size={13} strokeWidth={1.75} /> Simulate +48h Memory Decay
          </button>
        </div>
      </div>

      {/* Unit Readiness Cards Grid (Max 2-Box Nesting: Card -> 1px Hairline Telemetry Rows) */}
      <div className="units-grid" data-tour-id="tour-unit-grid">
        {report.units.map((unitReport, unitIdx) => {
          const unitMeta = course.units.find((u) => u.id === unitReport.unitId)!;
          const unitNodes = course.nodes.filter((n) => n.unitId === unitReport.unitId);

          const uTotal = Math.max(1, unitReport.tierCounts.total);
          const uMastered = (unitReport.tierCounts.mastered / uTotal) * 100;
          const uLearned = (unitReport.tierCounts.learned / uTotal) * 100;
          const uFamiliar = (unitReport.tierCounts.familiar / uTotal) * 100;

          return (
            <motion.article
              key={unitReport.unitId}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: unitIdx * 0.07, type: 'spring', stiffness: 320, damping: 26 }}
              className="surface-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                {/* Unit Header + Readiness Score */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.35rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className="badge badge-unseen font-mono-tabular">
                        UNIT 0{unitReport.unitNumber} · {unitReport.examSharePercent}% OF EXAM
                      </span>
                      <span
                        className={`badge font-mono-tabular ${
                          unitReport.readinessScore >= 85
                            ? 'badge-mastered'
                            : unitReport.readinessScore >= 65
                            ? 'badge-learned'
                            : 'badge-familiar'
                        }`}
                      >
                        PROJ: {unitReport.letterGrade}
                      </span>
                      {unitReport.unresolvedMistakes > 0 && (
                        <span className="badge badge-danger">
                          {unitReport.unresolvedMistakes} Trap
                          {unitReport.unresolvedMistakes > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.06rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {unitReport.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.15rem',
                      }}
                    >
                      {unitMeta.subtitle}
                    </p>
                  </div>

                  <div
                    className="font-mono-tabular"
                    style={{
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.45rem',
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.05,
                        color:
                          unitReport.readinessScore >= 88
                            ? 'var(--tier-mastered)'
                            : unitReport.readinessScore >= 70
                            ? 'var(--tier-learned)'
                            : 'var(--accent-primary-text)',
                      }}
                    >
                      {unitReport.readinessScore}%
                    </div>
                    <div
                      style={{
                        fontSize: '0.64rem',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.06em',
                        marginTop: '2px',
                      }}
                    >
                      UNIT READY
                    </div>
                  </div>
                </div>

                {/* Unit Progress Bar */}
                <div className="segmented-bar" style={{ height: '6px', margin: '0.75rem 0' }}>
                  <div className="segment-mastered" style={{ width: `${uMastered}%` }} />
                  <div className="segment-learned" style={{ width: `${uLearned}%` }} />
                  <div className="segment-familiar" style={{ width: `${uFamiliar}%` }} />
                </div>

                {/* 80/20 Unconditional Truth Priming Callout */}
                <div
                  className="surface-elevated"
                  style={{
                    padding: '0.7rem 0.85rem',
                    marginBottom: '0.75rem',
                    borderLeft: '2.5px solid var(--accent-primary)',
                  }}
                >
                  <div className="eyebrow-tag" style={{ marginBottom: '0.2rem' }}>
                    Principle i · Bedrock Unconditional Truth
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.44 }}>
                    {unitMeta.unconditionalTruthSummary}
                  </p>
                </div>

                {/* Proposition Node Telemetry List (1px Hairline Rows — Zero Box-in-Box Clutter) */}
                <div className="telemetry-list">
                  {unitNodes.map((node: PropositionNode) => {
                    const b = unitReport.nodeBreakdowns.find((nb) => nb.nodeId === node.id)!;
                    const tierBadgeClass =
                      b.tier === 3
                        ? 'badge-mastered'
                        : b.tier === 2
                        ? 'badge-learned'
                        : b.tier === 1
                        ? 'badge-familiar'
                        : 'badge-unseen';

                    return (
                      <div key={node.id} className="telemetry-row">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span className={`badge ${tierBadgeClass}`}>{b.tierLabel}</span>
                            {node.isUnconditionalTruth && (
                              <span
                                className="badge badge-familiar"
                                title="Foundational Unconditional Truth (Principle i)"
                              >
                                <Sparkles size={10} strokeWidth={1.75} /> Bedrock
                              </span>
                            )}
                            {b.isDueForReview && (
                              <span
                                className="badge badge-danger"
                                title="Memory retrievability decayed — due for spaced review"
                              >
                                Due ({Math.round(b.retrievability * 100)}%)
                              </span>
                            )}
                            {b.isOverconfidentTrap && (
                              <span
                                className="badge badge-danger"
                                title="High confidence on a previous miss — needs recalibration"
                              >
                                Blind Spot
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              marginTop: '0.22rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={node.title}
                          >
                            {node.title}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            className="font-mono-tabular"
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              minWidth: '34px',
                              textAlign: 'right',
                            }}
                          >
                            {b.effectiveReadiness}%
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onOpenSocraticNode(node.id, false)}
                            title="Step-by-step LearnHarness Predict -> Teach -> Check"
                          >
                            <Brain size={12} strokeWidth={1.75} /> Teach
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onStartQuizletSprint(unitReport.unitId, node.id)}
                            title="Drill this concept in Quizlet Learn incremental mode"
                          >
                            <TrendingUp size={12} strokeWidth={1.75} /> Drill
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unit Footer CTA */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  paddingTop: '0.35rem',
                }}
              >
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => onStartQuizletSprint(unitReport.unitId)}
                >
                  <Layers size={14} strokeWidth={1.75} /> Study Unit {unitReport.unitNumber} (
                  {unitReport.readinessScore}% → 100%)
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    onOpenSocraticNode(unitNodes[0]?.id ?? course.nodes[0].id, false)
                  }
                  title="Open Prerequisite Knowledge Graph for this unit"
                >
                  <Award size={14} strokeWidth={1.75} /> Graph
                </button>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
};
