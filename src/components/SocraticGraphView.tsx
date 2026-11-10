import React, { useState, useMemo } from 'react';
import {
  Network,
  Compass,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Flame,
  Eye,
  EyeOff,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import type {
  CoursePack,
  NodeMasteryState,
  PropositionNode,
  MasteryTier,
} from '../types/harness';
import { ForceGraph } from './ForceGraph';
import { gradeWithRubric, type AIGradeResult } from '../engine/aiClient';
import { useAIConnected, AILock, TypingDots } from './AITutorPanel';

interface SocraticGraphViewProps {
  course: CoursePack;
  masteryMap: Record<string, NodeMasteryState>;
  selectedUnitId: string | null;
  initialNodeId?: string | null;
  initialSubMode?: 'graph_and_teach' | 'diagnostic_probe';
  onSelectUnit: (unitId: string | null) => void;
  onFastTrackNode: (nodeId: string, targetTier: MasteryTier) => void;
  onPracticeSingleNode: (nodeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
  onConnectAI?: () => void;
}

type SubMode = 'graph_and_teach' | 'diagnostic_probe';

const TIER_LABELS: Record<MasteryTier, string> = {
  0: 'Unseen (Stage 0)',
  1: 'Familiar (Stage 1)',
  2: 'Learned (Stage 2)',
  3: 'Mastered (Stage 3)',
};


export const SocraticGraphView: React.FC<SocraticGraphViewProps> = ({
  course,
  masteryMap,
  selectedUnitId,
  initialNodeId = null,
  initialSubMode = 'graph_and_teach',
  onSelectUnit,
  onFastTrackNode,
  onPracticeSingleNode,
  onFocusNode,
  onConnectAI,
}) => {
  const aiConnected = useAIConnected();
  const [probeGrade, setProbeGrade] = useState<AIGradeResult | null>(null);
  const [probeGrading, setProbeGrading] = useState(false);
  const [subMode, setSubMode] = useState<SubMode>(initialSubMode);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    initialNodeId || course.nodes[0]?.id || ''
  );

  // Teach Cycle state per node
  const [selectedPredictionIdx, setSelectedPredictionIdx] = useState<number | null>(null);
  const [predictionSubmitted, setPredictionSubmitted] = useState(false);
  const [selectedCheckIdx, setSelectedCheckIdx] = useState<number | null>(null);
  const [checkRevealed, setCheckRevealed] = useState(false);

  // Live Socratic / Strict Examiner Chat state
  const [tutorPersona, setTutorPersona] = useState<'socratic' | 'strict_examiner'>('socratic');
  const [tutorInput, setTutorInput] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorReply, setTutorReply] = useState<{
    reply: string;
    providerUsed: string;
    cachedOrZeroToken: boolean;
  } | null>(null);

  // Diagnostic Probe Binary-Search state
  const [probeIndex, setProbeIndex] = useState(0);
  const [probeDraft, setProbeDraft] = useState('');
  const [probeHistory, setProbeHistory] = useState<
    Array<{
      nodeId: string;
      title: string;
      verdict: 'floor_held' | 'edge_target';
      prunedPrerequisites: string[];
    }>
  >([]);

  const filteredNodes = useMemo(() => {
    return selectedUnitId
      ? course.nodes.filter((n) => n.unitId === selectedUnitId)
      : course.nodes;
  }, [course.nodes, selectedUnitId]);

  const activeNode: PropositionNode | undefined = useMemo(() => {
    return (
      course.nodes.find((n) => n.id === selectedNodeId) ||
      filteredNodes[0] ||
      course.nodes[0]
    );
  }, [course.nodes, filteredNodes, selectedNodeId]);

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    onFocusNode?.(nodeId);
    setSelectedPredictionIdx(null);
    setPredictionSubmitted(false);
    setSelectedCheckIdx(null);
    setCheckRevealed(false);
    setTutorReply(null);
  };

  // Prerequisite & Dependent resolution for active node
  const prerequisiteNodes = useMemo(() => {
    if (!activeNode) return [];
    return activeNode.prerequisites
      .map((id) => course.nodes.find((n) => n.id === id))
      .filter((n): n is PropositionNode => Boolean(n));
  }, [activeNode, course.nodes]);

  const dependentNodes = useMemo(() => {
    if (!activeNode) return [];
    return course.nodes.filter((n) => n.prerequisites.includes(activeNode.id));
  }, [activeNode, course.nodes]);

  // Ask Socratic Tutor / Strict Examiner
  const handleAskTutor = async () => {
    if (!activeNode) return;
    setTutorLoading(true);
    try {
      let savedOpenAIToken = '';
      let savedXaiKey = '';
      let savedAnthropicKey = '';
      try {
        savedOpenAIToken = localStorage.getItem('lh_openai_account_token') || '';
        savedXaiKey = localStorage.getItem('lh_xai_key') || '';
        savedAnthropicKey = localStorage.getItem('lh_anthropic_key') || '';
        const savedKeysObj = JSON.parse(localStorage.getItem('lh_auth_keys_v1') || '{}');
        if (!savedXaiKey && savedKeysObj.XAI_API_KEY) savedXaiKey = savedKeysObj.XAI_API_KEY;
        if (!savedAnthropicKey && savedKeysObj.ANTHROPIC_API_KEY) savedAnthropicKey = savedKeysObj.ANTHROPIC_API_KEY;
        if (!savedOpenAIToken && savedKeysObj.OPENAI_API_KEY) savedOpenAIToken = savedKeysObj.OPENAI_API_KEY;
      } catch {
        // ignore
      }

      // Check Grok (xAI)
      if (savedXaiKey.startsWith('xai-') || savedXaiKey.length > 20) {
        try {
          const xaiRes = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${savedXaiKey}`,
            },
            body: JSON.stringify({
              model: 'grok-beta',
              max_tokens: 220,
              messages: [
                {
                  role: 'system',
                  content:
                    tutorPersona === 'strict_examiner'
                      ? `You are a strict exam grader. Concept: "${activeNode.title}" (${activeNode.statement}). Ask 1 sharp question testing causal mechanism in under 70 words.`
                      : `You are a Socratic tutor. Concept: "${activeNode.title}" (${activeNode.statement}). Give 1 short hint in under 70 words without spoiling the answer.`,
                },
                {
                  role: 'user',
                  content: tutorInput.trim() || 'Give me a Socratic nudge on this concept.',
                },
              ],
            }),
          });
          if (xaiRes.ok) {
            const xaiData = await xaiRes.json();
            const text = xaiData.choices?.[0]?.message?.content?.trim();
            if (text) {
              setTutorReply({
                reply: text,
                providerUsed: 'Grok (xAI grok-beta)',
                cachedOrZeroToken: false,
              });
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      if (savedOpenAIToken.startsWith('sk-') || savedOpenAIToken.length > 28) {
        const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${savedOpenAIToken}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 220,
            messages: [
              {
                role: 'system',
                content:
                  tutorPersona === 'strict_examiner'
                    ? `You are a strict exam grader. Concept: "${activeNode.title}" (${activeNode.statement}). Ask 1 sharp question testing causal mechanism in under 70 words.`
                    : `You are a Socratic tutor. Concept: "${activeNode.title}" (${activeNode.statement}). Give 1 short hint in under 70 words without spoiling the answer.`,
              },
              {
                role: 'user',
                content: tutorInput.trim() || 'Give me a Socratic nudge on this concept.',
              },
            ],
          }),
        });
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const text = oaiData.choices?.[0]?.message?.content?.trim();
          if (text) {
            setTutorReply({
              reply: text,
              providerUsed: 'OpenAI (gpt-4o-mini)',
              cachedOrZeroToken: false,
            });
            return;
          }
        }
      }

      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: tutorPersona === 'strict_examiner' ? 'strict_examiner' : 'socratic_hint',
          nodeTitle: activeNode.title,
          nodeStatement: activeNode.statement,
          learnerInput:
            tutorInput.trim() ||
            `Probe my causal understanding of "${activeNode.title}".`,
          learnerThinking: tutorInput,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTutorReply({
          reply: data.reply || data.message || activeNode.teachingStep.coreExplanation,
          providerUsed: data.provider || data.providerUsed || '0-Token Local Coach',
          cachedOrZeroToken: Boolean(data.cachedOrZeroToken ?? true),
        });
      } else {
        throw new Error('Fallback');
      }
    } catch {
      setTutorReply({
        reply:
          tutorPersona === 'strict_examiner'
            ? `[Strict Examiner]: State the exact causal chain for "${activeNode.title}" without buzzwords: ${activeNode.quizletStages.application.feynmanPrompt}`
            : `[Socratic Coach]: Focus on the key clue: ${activeNode.quizletStages.cuedRecall.hints[2]}`,
        providerUsed: '0-Token Local Coach',
        cachedOrZeroToken: true,
      });
    } finally {
      setTutorLoading(false);
    }
  };

  // Diagnostic Probe ordering: probe highest-dependency / 80-20 nodes first to binary-search the graph
  const probeQueue = useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
      const aDeps = a.prerequisites.length + (a.examWeight >= 4 ? 1 : 0);
      const bDeps = b.prerequisites.length + (b.examWeight >= 4 ? 1 : 0);
      return bDeps - aDeps;
    });
  }, [filteredNodes]);

  const currentProbeNode = probeQueue[probeIndex % Math.max(1, probeQueue.length)];

  const handleProbeVerdict = (holdsFloor: boolean) => {
    if (!currentProbeNode) return;
    if (holdsFloor) {
      // Binary search pruning: if a downstream node holds, credit it AND its upstream prerequisites!
      onFastTrackNode(currentProbeNode.id, 2);
      const prunedIds: string[] = [];
      currentProbeNode.prerequisites.forEach((preId) => {
        const currentPreTier = masteryMap[preId]?.tier || 0;
        if (currentPreTier < 2) {
          onFastTrackNode(preId, 2);
          prunedIds.push(preId);
        }
      });
      setProbeHistory((prev) => [
        {
          nodeId: currentProbeNode.id,
          title: currentProbeNode.title,
          verdict: 'floor_held',
          prunedPrerequisites: prunedIds,
        },
        ...prev,
      ]);
    } else {
      setProbeHistory((prev) => [
        {
          nodeId: currentProbeNode.id,
          title: currentProbeNode.title,
          verdict: 'edge_target',
          prunedPrerequisites: [],
        },
        ...prev,
      ]);
    }
    setProbeDraft('');
    setProbeGrade(null);
    setProbeIndex((i) => i + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Sub-Toolbar */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              LearnHarness Knowledge Graph & Socratic Teacher
            </span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '6px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              className="btn btn-sm"
              style={{
                border: 'none',
                background:
                  subMode === 'graph_and_teach' ? 'var(--bg-surface)' : 'transparent',
                color:
                  subMode === 'graph_and_teach'
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                boxShadow:
                  subMode === 'graph_and_teach' ? 'var(--shadow-card)' : 'none',
              }}
              onClick={() => setSubMode('graph_and_teach')}
            >
              <BookOpen size={14} />
              Predict → Teach → Check
            </button>
            <button
              className="btn btn-sm"
              style={{
                border: 'none',
                background:
                  subMode === 'diagnostic_probe' ? 'var(--bg-surface)' : 'transparent',
                color:
                  subMode === 'diagnostic_probe'
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                boxShadow:
                  subMode === 'diagnostic_probe' ? 'var(--shadow-card)' : 'none',
              }}
              onClick={() => setSubMode('diagnostic_probe')}
            >
              <Compass size={14} />
              Diagnostic Probe (Binary Search)
            </button>
          </div>
        </div>

        {/* Unit Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${selectedUnitId === null ? 'btn-primary' : ''}`}
            onClick={() => onSelectUnit(null)}
          >
            All Units ({course.nodes.length})
          </button>
          {course.units.map((u) => (
            <button
              key={u.id}
              className={`btn btn-sm ${selectedUnitId === u.id ? 'btn-primary' : ''}`}
              onClick={() => onSelectUnit(u.id)}
            >
              Unit {u.number}
            </button>
          ))}
        </div>
      </div>

      {subMode === 'diagnostic_probe' ? (
        /* DIAGNOSTIC PROBE BINARY SEARCH MODE */
        <div className="grid-12" style={{ alignItems: 'start' }}>
          <div className="card" style={{ gridColumn: 'span 7', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span className="badge badge-accent">
                <Compass size={12} /> LearnHarness Probe Doctrine: Binary Search
              </span>
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Probe Node {(probeIndex % Math.max(1, probeQueue.length)) + 1} of {probeQueue.length}
              </span>
            </div>

            {currentProbeNode && (
              <>
                <h2 className="serif-heading" style={{ fontSize: '1.35rem', marginBottom: '8px' }}>
                  {currentProbeNode.title}
                </h2>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Why we probe downstream first: If you can articulate this proposition, the harness automatically credits both this node and its{' '}
                  <strong>{currentProbeNode.prerequisites.length} prerequisite proposition(s)</strong> (<code>floor_held</code>), saving you study time.
                </p>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    borderLeft: '3px solid var(--accent-primary)',
                    marginBottom: '16px',
                  }}
                >
                  <div className="mono" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '6px' }}>
                    Diagnostic Probe Question
                  </div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 600 }}>
                    {currentProbeNode.predictionPrompt.question}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label
                    className="mono"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Your Diagnostic Formulation (Before Revealing Ground Truth)
                  </label>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={probeDraft}
                    onChange={(e) => setProbeDraft(e.target.value)}
                    placeholder="Write your mental model or causal prediction in 1-2 sentences..."
                  />
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '18px',
                  }}
                >
                  <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Reference Proposition (Compare Honestly)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {currentProbeNode.statement}
                  </div>
                </div>

                <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {aiConnected ? (
                    <button
                      className="btn btn-sm"
                      disabled={!probeDraft.trim() || probeGrading}
                      onClick={async () => {
                        setProbeGrading(true);
                        setProbeGrade(await gradeWithRubric(currentProbeNode, currentProbeNode.predictionPrompt.question, probeDraft, 'probe'));
                        setProbeGrading(false);
                      }}
                    >
                      <Sparkles size={13} /> {probeGrading ? 'AI is placing you...' : 'Let AI judge floor vs edge'}
                    </button>
                  ) : (
                    <AILock label="Connect AI to have it judge your floor and ceiling" onConnect={onConnectAI} />
                  )}
                  {probeGrading && <TypingDots />}
                  {probeGrade && (
                    <div className="ai-msg assistant">
                      <span className="ai-chip">AI verdict: {probeGrade.score >= 70 ? 'floor held' : 'edge target'} · {probeGrade.score}/100</span>
                      <div style={{ marginTop: 6 }}>{probeGrade.feedback}</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleProbeVerdict(true)}
                  >
                    <CheckCircle2 size={16} />
                    Floor Held — I Know This (Credit Node + Prereqs)
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleProbeVerdict(false)}
                  >
                    <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                    Edge Target — Add to My Study Plan
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      handleSelectNode(currentProbeNode.id);
                      setSubMode('graph_and_teach');
                    }}
                  >
                    Teach Me Now <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="card" style={{ gridColumn: 'span 5', padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>
              Diagnostic Bracket Log (`floor_held` vs `edge_target`)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Nodes marked <code>floor_held</code> jump straight to Stage 2 (Learned) alongside their prerequisite chain.
            </p>
            {probeHistory.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: '8px',
                }}
              >
                Answer the diagnostic probe on the left to start binary-searching your competence boundary.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {probeHistory.map((item, idx) => (
                  <div
                    key={`${item.nodeId}-${idx}`}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{item.title}</strong>
                      <span
                        className={`badge ${
                          item.verdict === 'floor_held' ? 'badge-success' : 'badge-warning'
                        }`}
                      >
                        {item.verdict}
                      </span>
                    </div>
                    {item.prunedPrerequisites.length > 0 && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--success)', marginTop: '4px' }}>
                        Auto-credited {item.prunedPrerequisites.length} upstream prerequisite node(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* INTERACTIVE PREREQUISITE GRAPH + PREDICT -> TEACH -> CHECK STUDIO */
        <div className="grid-12" style={{ alignItems: 'start' }}>
          {/* Obsidian-style force-directed knowledge graph */}
          <div className="card" style={{ gridColumn: 'span 12', padding: '12px' }}>
            <ForceGraph
              course={course}
              masteryMap={masteryMap}
              unitFilter={selectedUnitId}
              selectedId={activeNode?.id || null}
              onSelect={handleSelectNode}
              height={480}
            />
          </div>

          {/* Right Column: Active Node Predict -> Teach -> Check Inspector */}
          {activeNode && (
            <div
              className="card"
              style={{
                gridColumn: 'span 12',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-accent">
                      {activeNode.isUnconditionalTruth
                        ? 'Principle (i): Unconditional Truth'
                        : 'Principle (ii): Motivated Derivation'}
                    </span>
                    {activeNode.examWeight >= 4 && (
                      <span className="badge badge-warning">
                        <Sparkles size={11} /> 80/20 Exam Generator (Weight {activeNode.examWeight}/5)
                      </span>
                    )}
                    <span className="badge">
                      {TIER_LABELS[masteryMap[activeNode.id]?.tier || 0]}
                    </span>
                  </div>
                  <h2 className="serif-heading" style={{ fontSize: '1.45rem' }}>
                    {activeNode.title}
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => onPracticeSingleNode(activeNode.id)}
                  >
                    Drill This Node in Sprint <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Causal Graph Lineage (Prerequisites -> Active -> Unlocks) */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div className="mono" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Joint-Premise Causal Chain (LearnHarness Principle ii: No Unmotivated Steps)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                  {prerequisiteNodes.length === 0 ? (
                    <span className="badge">Root Axiom / Empirical Premise</span>
                  ) : (
                    prerequisiteNodes.map((pre) => (
                      <button
                        key={pre.id}
                        className="btn btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.76rem' }}
                        onClick={() => handleSelectNode(pre.id)}
                      >
                        Requires: {pre.title}
                      </button>
                    ))
                  )}
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  <span className="badge badge-accent" style={{ fontWeight: 700 }}>
                    {activeNode.title}
                  </span>
                  {dependentNodes.length > 0 && (
                    <>
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                      {dependentNodes.map((dep) => (
                        <button
                          key={dep.id}
                          className="btn btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.76rem' }}
                          onClick={() => handleSelectNode(dep.id)}
                        >
                          Unlocks: {dep.title}
                        </button>
                      ))}
                    </>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  <strong>Motivating Question ("How could I have discovered this?"): </strong>
                  {activeNode.motivatedHook}
                </div>
              </div>

              {/* STEP 1: PREDICT (Before Teaching) */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                    Step 1 · Predict Before Teaching (Active Priming)
                  </span>
                  {predictionSubmitted && (
                    <span className="badge badge-success">Prediction Evaluated</span>
                  )}
                </div>
                <p style={{ fontSize: '0.92rem', fontWeight: 500, marginBottom: '10px' }}>
                  {activeNode.predictionPrompt.question}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeNode.predictionPrompt.options.map((opt, idx) => {
                    const isPicked = selectedPredictionIdx === idx;
                    const isCorrect = idx === activeNode.predictionPrompt.correctIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedPredictionIdx(idx);
                          setPredictionSubmitted(true);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background:
                            predictionSubmitted && isCorrect
                              ? 'var(--success-subtle)'
                              : predictionSubmitted && isPicked && !isCorrect
                              ? 'var(--danger-subtle)'
                              : isPicked
                              ? 'var(--accent-subtle)'
                              : 'var(--bg-elevated)',
                          border: `1px solid ${
                            predictionSubmitted && isCorrect
                              ? 'var(--success)'
                              : predictionSubmitted && isPicked && !isCorrect
                              ? 'var(--danger)'
                              : 'var(--border-subtle)'
                          }`,
                          color: 'var(--text-primary)',
                          fontSize: '0.86rem',
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {predictionSubmitted && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-elevated)',
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong>Resolution: </strong>
                    {activeNode.predictionPrompt.resolution}
                  </div>
                )}
              </div>

              {/* STEP 2: TEACH (Core Intuition + Unconditional Truth + Visual Diagram + Formula) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Step 2 · First-Principles Derivation & Mental Model
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--accent-subtle)',
                    borderLeft: '3px solid var(--accent-primary)',
                  }}
                >
                  <div className="mono" style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                    Core Proposition Statement
                  </div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 600 }}>
                    {activeNode.statement}
                  </div>
                </div>

                <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.65 }}>
                  {activeNode.teachingStep.coreExplanation}
                </p>

                {activeNode.teachingStep.keyFormulaOrRule && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.86rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>Governing Rule / Equation:</span>
                    <strong>{activeNode.teachingStep.keyFormulaOrRule}</strong>
                  </div>
                )}

                <pre
                  style={{
                    margin: 0,
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-primary)',
                  }}
                >
                  {activeNode.teachingStep.visualMentalModel}
                </pre>

                {activeNode.quizletStages.application.commonTraps.length > 0 && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'var(--warning-subtle)',
                      border: '1px solid var(--warning)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong style={{ color: 'var(--warning)' }}>Exam Trap Alert: </strong>
                    {activeNode.quizletStages.application.commonTraps.join(' · ')}
                  </div>
                )}
              </div>

              {/* STEP 3: CHECK YOUR UNDERSTANDING (Collapsed Reveal Gate per LearnHarness Teacher Spec) */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Step 3 · Check Your Understanding (Landing Gate)
                </div>
                <p style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '10px' }}>
                  {activeNode.teachingStep.checkQuestion.question}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {activeNode.teachingStep.checkQuestion.options.map((opt, idx) => {
                    const isPicked = selectedCheckIdx === idx;
                    const isCorrect = idx === activeNode.teachingStep.checkQuestion.correctIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedCheckIdx(idx);
                          setCheckRevealed(true);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background:
                            checkRevealed && isCorrect
                              ? 'var(--success-subtle)'
                              : checkRevealed && isPicked && !isCorrect
                              ? 'var(--danger-subtle)'
                              : 'var(--bg-surface)',
                          border: `1px solid ${
                            checkRevealed && isCorrect
                              ? 'var(--success)'
                              : checkRevealed && isPicked && !isCorrect
                              ? 'var(--danger)'
                              : 'var(--border-subtle)'
                          }`,
                          color: 'var(--text-primary)',
                          fontSize: '0.86rem',
                        }}
                      >
                        <div>{opt.text}</div>
                        {checkRevealed && (isPicked || isCorrect) && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {opt.diagnosticFeedback}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => setCheckRevealed(!checkRevealed)}
                  >
                    {checkRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    {checkRevealed ? 'Hide Check Diagnostics' : 'Reveal Check Diagnostics'}
                  </button>

                  {checkRevealed && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        onFastTrackNode(
                          activeNode.id,
                          Math.max(1, masteryMap[activeNode.id]?.tier || 0) as MasteryTier
                        )
                      }
                    >
                      <CheckCircle2 size={14} /> Mark Teach Cycle Complete (Familiar+)
                    </button>
                  )}
                </div>
              </div>

              {/* LIVE AI SOCRATIC COACH / STRICT EXAMINER INTERROGATOR */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                      Interactive AI Interrogation (Codex / Claude / OAuth / Local)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className={`btn btn-sm ${tutorPersona === 'socratic' ? 'btn-primary' : ''}`}
                      onClick={() => setTutorPersona('socratic')}
                    >
                      <HelpCircle size={13} /> Socratic Coach
                    </button>
                    <button
                      className={`btn btn-sm ${tutorPersona === 'strict_examiner' ? 'btn-primary' : ''}`}
                      onClick={() => setTutorPersona('strict_examiner')}
                    >
                      <Flame size={13} /> Strict Examiner (Feynman Stress-Test)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input"
                    value={tutorInput}
                    onChange={(e) => setTutorInput(e.target.value)}
                    placeholder={
                      tutorPersona === 'strict_examiner'
                        ? 'Attempt to explain this concept to the Strict Examiner — they will attack any vague step...'
                        : 'Ask a clarifying question or request a Socratic hint...'
                    }
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleAskTutor}
                    disabled={tutorLoading}
                  >
                    {tutorLoading ? 'Thinking...' : 'Interrogate'}
                  </button>
                </div>

                {tutorReply && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.86rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="badge badge-accent">{tutorReply.providerUsed}</span>
                      {tutorReply.cachedOrZeroToken && (
                        <span className="badge badge-success">0-Token Instant</span>
                      )}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{tutorReply.reply}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
