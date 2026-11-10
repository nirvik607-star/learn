import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Plus,
  Play,
  Filter,
  Flame,
  FileText,
} from 'lucide-react';
import type {
  CoursePack,
  MistakeRecord,
  FailureCategory,
  CourseReadinessReport,
} from '../types/harness';
import { motion, AnimatePresence } from 'motion/react';
import { generateVariant, gradeWithRubric, type VariantQuestion, type AIGradeResult } from '../engine/aiClient';
import { useAIConnected, AILock, TypingDots } from './AITutorPanel';

/** AI writes a fresh-surface variant targeting the logged failure type, then grades the retry. */
const VariantRetest: React.FC<{ course: CoursePack; mistake: MistakeRecord; onCleared: () => void; onConnectAI?: () => void }> = ({ course, mistake, onCleared, onConnectAI }) => {
  const connected = useAIConnected();
  const node = course.nodes.find((n) => n.id === mistake.nodeId);
  const [variant, setVariant] = useState<VariantQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [grade, setGrade] = useState<AIGradeResult | null>(null);
  if (!node) return null;
  if (!connected) return <AILock label="Connect AI to generate fresh-surface retest questions" onConnect={onConnectAI} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!variant && (
        <button
          className="btn btn-sm"
          disabled={loading}
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            setLoading(true);
            setVariant(await generateVariant(node, mistake.question, mistake.learnerAnswer, mistake.failureCategory));
            setLoading(false);
          }}
        >
          <Sparkles size={13} /> {loading ? 'Writing a fresh variant...' : 'AI fresh-surface retest'}
        </button>
      )}
      {loading && <TypingDots />}
      <AnimatePresence>
        {variant && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const g = await gradeWithRubric(node, variant.question, answer, 'application');
              setLoading(false);
              setGrade(g);
              if (g?.correct) setTimeout(onCleared, 900);
            }}
          >
            <div className="ai-msg assistant"><span className="ai-chip">Fresh surface</span><div style={{ marginTop: 4 }}>{variant.question}</div></div>
            <textarea className="textarea" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer cold, without looking at the repair rule..." />
            <button className="btn btn-sm btn-primary" type="submit" disabled={!answer.trim() || loading} style={{ alignSelf: 'flex-start' }}>Grade my retry</button>
            {grade && (
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ai-msg assistant" style={{ borderColor: grade.correct ? 'var(--success)' : 'var(--danger)' }}>
                <strong style={{ color: grade.correct ? 'var(--success)' : 'var(--danger)' }}>{grade.correct ? 'Cleared. Mistake repaired.' : `Not yet (${grade.score}/100)`}</strong>
                <div>{grade.feedback}</div>
                {!grade.correct && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>Model answer: {variant.answer}</div>}
              </motion.div>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

interface MistakeNotebookAndCramProps {
  course: CoursePack;
  mistakes: MistakeRecord[];
  readiness: CourseReadinessReport;
  initialTab?: 'mistakes' | 'cram_sheet';
  onStartMistakeDrill: () => void;
  onResolveMistake: (mistakeId: string) => void;
  onAddManualMistake: (
    nodeId: string,
    questionPrompt: string,
    learnerAnswer: string,
    failureType: FailureCategory
  ) => void;
  onConnectAI?: () => void;
}

const FAILURE_LABELS: Record<
  FailureCategory,
  { label: string; badgeClass: string; prescription: string }
> = {
  discrimination_error: {
    label: 'Discrimination Trap (Near-Twin Confusion)',
    badgeClass: 'badge-danger',
    prescription: 'Contrast the exact boundary condition that separates the two concepts.',
  },
  cue_miss: {
    label: 'Cue Miss (Recognized When Shown, Missed Cold)',
    badgeClass: 'badge-warning',
    prescription: 'Practice uncued active recall without peeking at options or R3+ hints.',
  },
  structural_misconception: {
    label: 'Structural Misconception (Inverted Causal Rule)',
    badgeClass: 'badge-danger',
    prescription: 'Re-derive from the upstream Unconditional Truth (Principle i).',
  },
  execution_slip: {
    label: 'Execution Slip (Right Principle, Formula/Step Slip)',
    badgeClass: 'badge-warning',
    prescription: 'Write out intermediate units/signs explicitly on scratch paper.',
  },
  careless: {
    label: 'High-Confidence Slip (Misread Negation / Premise)',
    badgeClass: 'badge-accent',
    prescription: 'Slow down on stem qualifiers ("EXCEPT", "constant", "net vs gross").',
  },
};

export const MistakeNotebookAndCram: React.FC<MistakeNotebookAndCramProps> = ({
  course,
  mistakes,
  readiness,
  initialTab = 'mistakes',
  onStartMistakeDrill,
  onResolveMistake,
  onAddManualMistake,
  onConnectAI,
}) => {
  const [activeTab, setActiveTab] = useState<'mistakes' | 'cram_sheet'>(initialTab);
  const [showResolved, setShowResolved] = useState(false);
  const [onlyParetoCram, setOnlyParetoCram] = useState(false);

  // Manual Mistake Logger state
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(course.nodes[0]?.id || '');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customWrongAnswer, setCustomWrongAnswer] = useState('');
  const [customFailureType, setCustomFailureType] =
    useState<FailureCategory>('discrimination_error');

  const courseMistakes = useMemo(() => {
    return mistakes.filter(
      (m) =>
        m.courseId === course.id &&
        (showResolved ? true : !m.retestedAndCleared)
    );
  }, [mistakes, course.id, showResolved]);

  const unresolvedCount = useMemo(
    () =>
      mistakes.filter((m) => m.courseId === course.id && !m.retestedAndCleared)
        .length,
    [mistakes, course.id]
  );

  const handleCreateManualMistake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNodeId || !customPrompt.trim()) return;
    onAddManualMistake(
      selectedNodeId,
      customPrompt.trim(),
      customWrongAnswer.trim() || 'Missed on practice exam',
      customFailureType
    );
    setCustomPrompt('');
    setCustomWrongAnswer('');
    setShowAddForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-Navigation Header */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeTab === 'mistakes' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('mistakes')}
          >
            <AlertTriangle size={14} />
            Mistake Notebook ("Screw-Up Log") ({unresolvedCount} Open)
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'cram_sheet' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('cram_sheet')}
          >
            <FileText size={14} />
            1-Page 80/20 Exam Cram Sheet & Confidence Briefing
          </button>
        </div>

        {activeTab === 'mistakes' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              <Filter size={13} />
              {showResolved ? 'Hide Resolved' : 'Show Resolved'}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={14} /> Log Practice Exam Mistake
            </button>
            {unresolvedCount > 0 && (
              <button className="btn btn-sm btn-primary" onClick={onStartMistakeDrill}>
                <Play size={14} /> Drill & Clear {unresolvedCount} Mistake(s) in Fresh Surface
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'mistakes' ? (
        /* MISTAKE NOTEBOOK ("SCREW-UP LOG") */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {showAddForm && (
            <form
              onSubmit={handleCreateManualMistake}
              className="card"
              style={{
                padding: '20px',
                border: '1px solid var(--accent-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>
                  Log an Error from a Homework, Quiz, or Practice Midterm
                </h3>
                <span className="badge badge-accent">Surgical Error Tagging</span>
              </div>

              <div className="grid-12">
                <div style={{ gridColumn: 'span 6' }}>
                  <label className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Proposition Node
                  </label>
                  <select
                    className="input"
                    value={selectedNodeId}
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                  >
                    {course.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 6' }}>
                  <label className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Failure Classification
                  </label>
                  <select
                    className="input"
                    value={customFailureType}
                    onChange={(e) =>
                      setCustomFailureType(e.target.value as FailureCategory)
                    }
                  >
                    {Object.entries(FAILURE_LABELS).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  What question or scenario tripped you up?
                </label>
                <input
                  className="input"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., Confused non-competitive inhibition Vmax effect when [S] was saturating..."
                  required
                />
              </div>

              <div>
                <label className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Your Wrong Assumption / Trap Chosen
                </label>
                <input
                  className="input"
                  value={customWrongAnswer}
                  onChange={(e) => setCustomWrongAnswer(e.target.value)}
                  placeholder="e.g., Assumed high [S] could outcompete allosteric inhibitor..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-primary">
                  Save to Mistake Notebook
                </button>
              </div>
            </form>
          )}

          {courseMistakes.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '36px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
              <h3 className="serif-heading" style={{ fontSize: '1.25rem' }}>
                Zero Unresolved Mistakes in Your Screw-Up Log
              </h3>
              <p style={{ maxWidth: '540px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Every time you miss a question or rely on a heavy hint (R3+) in a Quizlet Learn Sprint, the harness automatically logs the exact failure type and repair rule here so you never repeat the same mistake on exam day.
              </p>
              <button
                className="btn btn-sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus size={14} /> Manually Log a Practice Exam Error
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {courseMistakes.map((mistake) => {
                const meta = FAILURE_LABELS[mistake.failureCategory];
                return (
                  <div
                    key={mistake.id}
                    className="card"
                    style={{
                      padding: '18px 20px',
                      borderLeft: `4px solid ${
                        mistake.retestedAndCleared
                          ? 'var(--success)'
                          : 'var(--danger)'
                      }`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={`badge ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                        <strong style={{ fontSize: '0.96rem' }}>
                          {mistake.nodeTitle}
                        </strong>
                        {mistake.confidence >= 75 && (
                          <span className="badge badge-danger">
                            <Flame size={11} /> High-Confidence Blind Spot (
                            {mistake.confidence}% sure)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {mistake.retestedAndCleared ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={12} /> Cleared in Fresh Surface
                          </span>
                        ) : (
                          <button
                            className="btn btn-sm"
                            onClick={() => onResolveMistake(mistake.id)}
                          >
                            <CheckCircle2 size={13} /> Mark Repaired
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                        Prompt:{' '}
                      </span>
                      {mistake.question}
                    </div>

                    <div className="grid-12" style={{ gap: '12px' }}>
                      <div
                        style={{
                          gridColumn: 'span 5',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--danger-subtle)',
                          fontSize: '0.83rem',
                        }}
                      >
                        <div className="mono" style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: '3px' }}>
                          Your Previous Answer / Trap
                        </div>
                        {mistake.learnerAnswer}
                      </div>

                      <div
                        style={{
                          gridColumn: 'span 7',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--success-subtle)',
                          fontSize: '0.83rem',
                        }}
                      >
                        <div className="mono" style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '3px' }}>
                          First-Principles Surgical Repair Rule
                        </div>
                        {mistake.surgicalRepair}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <strong>Cognitive Prescription:</strong> {meta.prescription}
                    </div>
                    {!mistake.retestedAndCleared && (
                      <VariantRetest course={course} mistake={mistake} onCleared={() => onResolveMistake(mistake.id)} onConnectAI={onConnectAI} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 1-PAGE PRE-EXAM 80/20 CRAM SHEET & CONFIDENCE REGULATION BRIEFING */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pre-Exam Confidence & Readiness Briefing (from Matthew Smith Exam Video) */}
          <div
            className="card"
            style={{
              padding: '22px 24px',
              background: 'var(--bg-surface)',
              borderLeft: '4px solid var(--accent-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ maxWidth: '720px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
                <span className="mono" style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
                  Pre-Exam Solidification & Confidence Regulation Briefing
                </span>
              </div>
              <h2 className="serif-heading" style={{ fontSize: '1.35rem', marginBottom: '6px' }}>
                {course.title} — High-Level Exam Architecture
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Before walking into an exam, avoid frantic last-minute textbook re-reading. Review the{' '}
                <strong>Unconditional Truths (Principle i)</strong> and <strong>Exam Trap Boundaries</strong> below so your working memory stays calm and anchored on first principles. Even if an exam problem uses unfamiliar surface wording, it must obey these invariants.
              </p>
            </div>

            <div
              style={{
                padding: '14px 18px',
                borderRadius: '8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'right',
              }}
            >
              <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Verified Exam Readiness
              </div>
              <div className="mono" style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {readiness.overallScore}% ({readiness.letterGradePrediction})
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', marginTop: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onlyParetoCram}
                  onChange={(e) => setOnlyParetoCram(e.target.checked)}
                />
                Show Only 80/20 Pareto Generators
              </label>
            </div>
          </div>

          {/* Unit-by-Unit Cram Cards */}
          {course.units.map((unit) => {
            const unitNodes = course.nodes.filter(
              (n) =>
                n.unitId === unit.id &&
                (onlyParetoCram ? n.examWeight >= 4 : true)
            );
            if (unitNodes.length === 0) return null;

            return (
              <div
                key={unit.id}
                className="card"
                style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <div>
                    <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                      UNIT {unit.number}
                    </span>
                    <h3 className="serif-heading" style={{ fontSize: '1.15rem' }}>
                      {unit.title}
                    </h3>
                  </div>
                  <span className="badge">{unitNodes.length} Core Propositions</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {unitNodes.map((node) => (
                    <div
                      key={node.id}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BookOpen size={14} style={{ color: 'var(--accent-primary)' }} />
                          <strong style={{ fontSize: '0.94rem' }}>{node.title}</strong>
                          {node.examWeight >= 4 && (
                            <span className="badge badge-warning">
                              <Sparkles size={11} /> 80/20 Generator
                            </span>
                          )}
                        </div>
                        {node.teachingStep.keyFormulaOrRule && (
                          <code
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.78rem',
                            }}
                          >
                            {node.teachingStep.keyFormulaOrRule}
                          </code>
                        )}
                      </div>

                      <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        <strong>Invariant Rule: </strong>
                        {node.statement}
                      </div>

                      {node.quizletStages.application.commonTraps.length > 0 && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--warning)' }}>
                          <strong>Exam Trap Guardrail: </strong>
                          {node.quizletStages.application.commonTraps.join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
