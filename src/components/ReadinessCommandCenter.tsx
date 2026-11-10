import React from 'react';
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
      {/* Hero Exam Readiness Banner */}
      <section className="surface-card readiness-hero" id="readiness-hero-card">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-mastered font-mono-tabular">
                Projected: {report.letterGradePrediction}
              </span>
              <span className="badge badge-familiar font-mono-tabular">
                {report.aGradeLikelihoodPercent}% A-Grade Odds
              </span>
            </div>
            <h1
              className="font-serif-editorial"
              style={{ fontSize: '1.45rem', fontWeight: 400, lineHeight: 1.2 }}
            >
              {course.examTitle}
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Target: 90%+ Readiness = Very likely to excel (A / A+)
            </p>
          </div>
        </div>

        {/* Center: Encouraging Progress Breakdown & 4-Tier Incremental Bar */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {report.encouragingHeadline}
            </h2>
            <span className="font-mono-tabular" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {report.tierCounts.mastered + report.tierCounts.learned}/{report.tierCounts.total} Solidified
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {report.encouragingSubtext}
          </p>

          {/* Quizlet Learn 4-Stage Mastery Bar */}
          <div className="segmented-bar" aria-label="Quizlet Learn Mastery Progression">
            <div
              className="segment-mastered"
              style={{ width: `${masteredPct}%` }}
              title={`Mastered (Stage 3 Exam Application): ${report.tierCounts.mastered}`}
            />
            <div
              className="segment-learned"
              style={{ width: `${learnedPct}%` }}
              title={`Learned (Stage 2 Cued Recall): ${report.tierCounts.learned}`}
            />
            <div
              className="segment-familiar"
              style={{ width: `${familiarPct}%` }}
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
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span>
                <strong style={{ color: 'var(--tier-mastered)' }}>● {report.tierCounts.mastered}</strong> Mastered (100%)
              </span>
              <span>
                <strong style={{ color: 'var(--tier-learned)' }}>● {report.tierCounts.learned}</strong> Learned (74%)
              </span>
              <span>
                <strong style={{ color: 'var(--accent-primary)' }}>● {report.tierCounts.familiar}</strong> Familiar (38%)
              </span>
              <span>
                <strong style={{ color: 'var(--text-muted)' }}>● {report.tierCounts.unseen}</strong> Unseen (0%)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }} className="font-mono-tabular">
              <span title="80/20 High-Yield Generator Coverage">
                <Zap size={12} style={{ display: 'inline', verticalAlign: '-2px', color: 'var(--accent-primary)' }} />{' '}
                80/20 Yield: {report.highYieldCoverage}%
              </span>
              <span title="Confidence Calibration (Detects Illusions of Competence)">
                <Target size={12} style={{ display: 'inline', verticalAlign: '-2px', color: 'var(--tier-learned)' }} />{' '}
                Calibration: {report.calibrationScore}%
              </span>
              <span title="Spaced Repetition Memory Freshness (Ebbinghaus Retrievability)">
                <Clock size={12} style={{ display: 'inline', verticalAlign: '-2px', color: 'var(--tier-mastered)' }} />{' '}
                Freshness: {report.retentionFreshness}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Highest-ROI Next Best Action Card */}
        <div className="surface-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--accent-primary-text)',
              }}
            >
              Recommended Next Sprint
            </span>
            <span className="badge badge-mastered font-mono-tabular">
              +{report.nextBestAction.estimatedGainPercent}% Readiness
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {report.nextBestAction.headline}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {report.nextBestAction.reason}
          </p>
          <button
            id="launch-recommended-sprint-btn"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.2rem' }}
            onClick={handleNextBestAction}
          >
            <Play size={15} /> Launch Optimized Sprint
          </button>
        </div>
      </section>

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
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            id="quick-start-all-units-btn"
            className="btn btn-secondary"
            onClick={() => onStartQuizletSprint('all')}
          >
            <Flame size={15} style={{ color: 'var(--accent-primary)' }} /> Interleaved Quizlet Learn Round (All Units)
          </button>
          <button
            id="quick-probe-diagnostic-btn"
            className="btn btn-secondary"
            onClick={() => onOpenSocraticNode(course.nodes[0].id, true)}
          >
            <Compass size={15} style={{ color: 'var(--tier-learned)' }} /> Socratic Probe (Bracket My Knowledge Edge)
          </button>
          <button
            id="quick-cram-sheet-btn"
            className="btn btn-secondary"
            onClick={onOpenCramSheet}
          >
            <BookOpen size={15} style={{ color: 'var(--tier-mastered)' }} /> 80/20 Pre-Exam Cram Sheet
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
              <ShieldAlert size={15} /> Drill {report.unresolvedMistakesCount} Logged Mistake
              {report.unresolvedMistakesCount > 1 ? 's' : ''}
            </button>
          )}
          <button
            id="simulate-decay-btn"
            className="btn btn-ghost"
            style={{ fontSize: '0.76rem', padding: '0.4rem 0.7rem' }}
            onClick={onFastForwardDecayDemo}
            title="Simulate +48 hours elapsed to see Ebbinghaus Spaced Repetition decay & review scheduling in action"
          >
            <Clock size={13} /> Simulate +48h Memory Decay
          </button>
        </div>
      </div>

      {/* Unit Readiness Cards Grid */}
      <div className="units-grid">
        {report.units.map((unitReport) => {
          const unitMeta = course.units.find((u) => u.id === unitReport.unitId)!;
          const unitNodes = course.nodes.filter((n) => n.unitId === unitReport.unitId);

          const uTotal = Math.max(1, unitReport.tierCounts.total);
          const uMastered = (unitReport.tierCounts.mastered / uTotal) * 100;
          const uLearned = (unitReport.tierCounts.learned / uTotal) * 100;
          const uFamiliar = (unitReport.tierCounts.familiar / uTotal) * 100;

          return (
            <article key={unitReport.unitId} className="surface-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                {/* Unit Header + Readiness Score */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem' }}>
                      <span className="badge badge-unseen font-mono-tabular">
                        {unitReport.examSharePercent}% of Exam
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
                        Grade: {unitReport.letterGrade}
                      </span>
                      {unitReport.unresolvedMistakes > 0 && (
                        <span className="badge badge-danger">
                          {unitReport.unresolvedMistakes} Trap{unitReport.unresolvedMistakes > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {unitReport.title}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {unitMeta.subtitle}
                    </p>
                  </div>

                  <div
                    className="font-mono-tabular"
                    style={{
                      textAlign: 'right',
                      background: 'var(--bg-elevated)',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.3rem',
                        fontWeight: 700,
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
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>UNIT READY</div>
                  </div>
                </div>

                {/* Unit Progress Bar */}
                <div className="segmented-bar" style={{ height: '7px', margin: '0.8rem 0 0.65rem' }}>
                  <div className="segment-mastered" style={{ width: `${uMastered}%` }} />
                  <div className="segment-learned" style={{ width: `${uLearned}%` }} />
                  <div className="segment-familiar" style={{ width: `${uFamiliar}%` }} />
                </div>

                {/* 80/20 Unconditional Truth Priming Box */}
                <div
                  className="surface-elevated"
                  style={{
                    padding: '0.7rem 0.85rem',
                    marginBottom: '0.85rem',
                    borderLeft: '3px solid var(--accent-primary)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--accent-primary-text)',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Principle i · Bedrock Unconditional Truth
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.42 }}>
                    {unitMeta.unconditionalTruthSummary}
                  </p>
                </div>

                {/* Proposition Node List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      <div
                        key={node.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.6rem',
                          padding: '0.55rem 0.7rem',
                          borderRadius: '8px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span className={`badge ${tierBadgeClass}`}>{b.tierLabel}</span>
                            {node.isUnconditionalTruth && (
                              <span
                                className="badge"
                                style={{
                                  background: 'var(--accent-primary-soft)',
                                  color: 'var(--accent-primary-text)',
                                }}
                                title="Foundational Unconditional Truth (Principle i)"
                              >
                                <Sparkles size={10} /> Bedrock
                              </span>
                            )}
                            {b.isDueForReview && (
                              <span className="badge badge-danger" title="Memory retrievability decayed — due for spaced review">
                                Due Review ({Math.round(b.retrievability * 100)}%)
                              </span>
                            )}
                            {b.isOverconfidentTrap && (
                              <span className="badge badge-danger" title="High confidence on a previous miss — needs recalibration">
                                Blind Spot
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginTop: '0.25rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={node.title}
                          >
                            {node.title}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                          <span
                            className="font-mono-tabular"
                            style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}
                          >
                            {b.effectiveReadiness}%
                          </span>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.74rem' }}
                            onClick={() => onOpenSocraticNode(node.id, false)}
                            title="Step-by-step LearnHarness Predict -> Teach -> Check"
                          >
                            <Brain size={13} /> Teach
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.74rem' }}
                            onClick={() => onStartQuizletSprint(unitReport.unitId, node.id)}
                            title="Drill this concept in Quizlet Learn incremental mode"
                          >
                            <TrendingUp size={13} /> Drill
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unit Footer CTA */}
              <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => onStartQuizletSprint(unitReport.unitId)}
                >
                  <Layers size={14} /> Study Unit {unitReport.unitNumber} ({unitReport.readinessScore}% → 100%)
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => onOpenSocraticNode(unitNodes[0]?.id ?? course.nodes[0].id, false)}
                  title="Open Prerequisite Knowledge Graph for this unit"
                >
                  <Award size={14} /> Graph
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
