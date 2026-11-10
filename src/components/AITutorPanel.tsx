import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, Lock, Send, ShieldAlert, Sparkles, RotateCcw } from 'lucide-react';
import type { PropositionNode } from '../types/harness';
import { isAIConnected, getActiveAIProvider, socraticTurn, type ChatMessage } from '../engine/aiClient';

export function useAIConnected(): boolean {
  const [connected, setConnected] = useState(isAIConnected());
  useEffect(() => {
    const update = () => setConnected(isAIConnected());
    window.addEventListener('lh-ai-status', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('lh-ai-status', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return connected;
}

export const AILock: React.FC<{ label?: string; onConnect?: () => void }> = ({ label = 'Connect AI to unlock', onConnect }) => (
  <button type="button" className="ai-lock" onClick={onConnect} style={{ background: 'transparent', cursor: onConnect ? 'pointer' : 'default', width: '100%' }}>
    <Lock size={12} /> {label}
  </button>
);

export const TypingDots = () => (
  <span className="typing-dots" aria-label="AI is thinking">
    <span />
    <span />
    <span />
  </span>
);

interface AITutorPanelProps {
  node: PropositionNode | null;
  /** Live context from the current study surface (question on screen, learner's answer). */
  studyContext?: string;
  onConnect: () => void;
}

/** Persistent Obsidian-style right pane: multi-turn Socratic tutor anchored to the focused node. */
export const AITutorPanel: React.FC<AITutorPanelProps> = ({ node, studyContext = '', onConnect }) => {
  const connected = useAIConnected();
  const activeProvider = getActiveAIProvider();
  const [persona, setPersona] = useState<'socratic' | 'strict_examiner'>('socratic');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory([]);
  }, [node?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, loading]);

  const send = async (text: string) => {
    if (!node || loading) return;
    const next: ChatMessage[] = [...history, { role: 'user', content: text }];
    setHistory(next);
    setInput('');
    setLoading(true);
    let reply: string | null = null;
    if (connected) reply = await socraticTurn(node, next, persona, studyContext);
    if (!reply) {
      // 0-token fallback: walk the pre-compiled predict -> teach -> check ladder
      const turn = next.filter((m) => m.role === 'user').length;
      const ladder = [
        `Before I explain: ${node.predictionPrompt.question}`,
        `Here's the step: ${node.teachingStep.coreExplanation}\n\nCheck: ${node.teachingStep.checkQuestion.question}`,
        `Mental model: ${node.teachingStep.visualMentalModel}\n\nNow explain it back in one sentence.`,
        `Reference: ${node.statement}\n\nCompare with your version. What did you leave out?`,
      ];
      reply = ladder[Math.min(turn - 1, ladder.length - 1)];
    }
    setHistory((h) => [...h, { role: 'assistant', content: reply! }]);
    setLoading(false);
  };

  const starters = node
    ? [
        'Teach me this one step at a time',
        'Quiz me on this',
        'Why does this rule exist?',
        studyContext ? 'Help with the question on screen' : 'What do people get wrong here?',
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Bot size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>AI Tutor</span>
              {activeProvider ? (
                <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                  {activeProvider.name}
                </span>
              ) : (
                <span className="badge" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                  0-Token
                </span>
              )}
            </div>
            <div className="mono" style={{ fontSize: '0.64rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node ? node.title : 'Select a concept'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn btn-sm"
            title={persona === 'socratic' ? 'Switch to Strict Examiner' : 'Switch to Socratic Coach'}
            onClick={() => setPersona((p) => (p === 'socratic' ? 'strict_examiner' : 'socratic'))}
            style={{ padding: '4px 7px', color: persona === 'strict_examiner' ? 'var(--danger)' : undefined }}
          >
            {persona === 'socratic' ? <Sparkles size={12} /> : <ShieldAlert size={12} />}
          </button>
          <button className="btn btn-sm" title="Reset conversation" onClick={() => setHistory([])} style={{ padding: '4px 7px' }}>
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!connected && <AILock label="0-token mode. Connect AI for a live tutor" onConnect={onConnect} />}
        {history.length === 0 && node && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{node.motivatedHook}</div>
            {starters.map((s, i) => (
              <motion.button
                key={s}
                className="tree-item"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, type: 'spring', stiffness: 400, damping: 28 }}
                onClick={() => send(s)}
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {history.map((m, i) => (
            <motion.div
              key={i}
              className={`ai-msg ${m.role}`}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              {m.content}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="ai-msg assistant" style={{ alignSelf: 'flex-start' }}>
            <TypingDots />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) send(input.trim());
        }}
        style={{ padding: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6 }}
      >
        <input
          className="input"
          value={input}
          disabled={!node}
          onChange={(e) => setInput(e.target.value)}
          placeholder={node ? 'Answer or ask...' : 'Pick a concept first'}
          style={{ flex: 1, fontSize: '0.8rem' }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!node || !input.trim() || loading} aria-label="Send">
          <Send size={13} />
        </button>
      </form>
    </div>
  );
};
